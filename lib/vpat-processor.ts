import { dbService, VPATBot } from './db'
import { vpatParser } from './vpat-parser'
import { EmailService } from './email-service'
import { scorecardGenerator } from './scorecard-generator'
import { writeFile } from 'fs/promises'
import { join } from 'path'

const SCORECARD_DIR = join(process.env.HOME || '', 'Desktop', 'db', 'vpat-scorecards')

export async function processVPATSubmission(
  submissionId: string,
  vpatBot: VPATBot,
  documentBuffer: Buffer,
  fileType: string
) {
  try {
    await Promise.all([
      dbService.updateVPATSubmission(submissionId, { status: 'processing' }),
      dbService.addProcessingLog(submissionId, 'parsing_started', 'success', 'Starting document parsing')
    ])

    const fileExtension = fileType.split('/').pop() || 'pdf'
    const documentText = await vpatParser.parseDocument(documentBuffer, fileExtension)

    await dbService.addProcessingLog(submissionId, 'parsing_completed', 'success', `Extracted ${documentText.length} characters`)

    const processingMethod = vpatBot.config.processingMethod || 'method1'
    
    if (processingMethod === 'dynamic') {
      // Use the new dynamic processor
      const { processVPATSubmissionDynamic } = await import('./vpat-processor-dynamic')
      return processVPATSubmissionDynamic(submissionId, vpatBot, documentBuffer, fileType)
    }
    
    const { metadata, criteria } = await vpatParser.extractVPATData(documentText, processingMethod)

    await dbService.addProcessingLog(
      submissionId, 
      'extraction_method', 
      'success', 
      `Using ${processingMethod === 'method2' ? 'Method 2 (Direct PDF to LLM)' : 'Method 1 (Chunking)'}`
    )

    const validationResult = vpatParser.validateVPAT(
      metadata,
      vpatBot.config.requireVPATVersion,
      vpatBot.config.requireWCAGLevel
    )

    const [aiAnalysis] = await Promise.all([
      vpatParser.generateAIAnalysis(metadata, criteria, validationResult),
      dbService.updateVPATSubmission(submissionId, {
        extractedData: {
          vpatVersion: metadata.vpatVersion,
          productName: metadata.productName,
          vendorName: metadata.vendorName,
          reportDate: metadata.reportDate,
          wcagVersion: metadata.wcagVersion,
          wcagLevel: metadata.wcagLevel,
          criteria,
        },
        validationResults: validationResult
      }),
      dbService.addProcessingLog(submissionId, 'ai_extraction_completed', 'success', `Extracted ${criteria.length} WCAG criteria`),
      dbService.addProcessingLog(
        submissionId,
        'validation_completed',
        validationResult.isValid ? 'success' : 'warning',
        `Validation: ${validationResult.isValid ? 'PASSED' : 'FAILED'} - ${validationResult.errors.length} errors, ${validationResult.warnings.length} warnings`
      )
    ])

    if (vpatBot.config.emailNotifications && vpatBot.config.notifyOnMissingData && validationResult.missingFields.length > 0) {
      const recipients = vpatBot.config.recipientEmail ? [vpatBot.config.recipientEmail] : []
      if (recipients.length > 0) {
        EmailService.sendVPATMissingDataEmail(
          recipients,
          metadata.productName || 'Unknown Product',
          validationResult.missingFields,
          submissionId
        ).catch(err => console.error('Email error:', err))
        dbService.updateVPATSubmission(submissionId, {
          emailsSent: [{
            type: 'missing_data',
            sentAt: Date.now(),
            recipient: recipients[0]
          }]
        }).catch(err => console.error('DB error:', err))
      }
    }

    const { rows, analysis, excelBuffer } = await scorecardGenerator.generateDetailedScorecard(
      metadata,
      criteria,
      vpatBot.referenceScorecard,
      submissionId
    )

    const { mkdir } = await import('fs/promises')
    await mkdir(SCORECARD_DIR, { recursive: true })
    
    const scorecardFileName = `Scorecard_${metadata.productName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Unknown'}_${Date.now()}.xlsx`
    const scorecardPath = join(SCORECARD_DIR, scorecardFileName)

    const generatedScorecard = {
      fileName: scorecardFileName,
      generatedAt: Date.now(),
      downloadUrl: `/api/vpat/scorecard/${submissionId}`,
      analysis: {
        totalCriteria: rows.length,
        overallScore: analysis.overallScore,
        compliancePercentage: analysis.compliancePercentage,
        levelACompliance: analysis.levelACompliance,
        levelAACompliance: analysis.levelAACompliance,
        levelAAACompliance: analysis.levelAAACompliance,
        supports: analysis.supports,
        partiallySupports: analysis.partiallySupports,
        doesNotSupport: analysis.doesNotSupport,
        criticalIssuesCount: analysis.criticalIssues.length,
        strengthsCount: analysis.strengths.length
      }
    }

    await Promise.all([
      writeFile(scorecardPath, excelBuffer),
      dbService.updateVPATSubmission(submissionId, {
        aiAnalysis,
        generatedScorecard,
        detailedScorecard: {
          rows,
          analysis
        },
        status: validationResult.isValid && vpatBot.config.autoApprove ? 'completed' : 'needs_review',
        completedAt: Date.now()
      }),
      dbService.addProcessingLog(submissionId, 'scorecard_generation_completed', 'success', `Generated detailed scorecard with ${rows.length} criteria mapped`),
      dbService.updateVPATBot(vpatBot.id, {
        processedCount: vpatBot.processedCount + 1
      })
    ])

    await dbService.addProcessingLog(
      submissionId,
      'evaluation_completed',
      'success',
      `Generated scorecard with ${rows.length} criteria evaluated`
    )

    // Email notifications disabled
    // if (vpatBot.config.notifyOnCompletion && vpatBot.config.recipientEmail) {
    //   try {
    //     await emailService.sendNotification({
    //       to: vpatBot.config.recipientEmail,
    //       subject: `VPAT Evaluation Complete: ${metadata.productName}`,
    //       template: 'vpat-complete',
    //       data: { metadata, analysis, scorecardUrl: generatedScorecard.downloadUrl }
    //     })
    //   } catch (emailError) {
    //     console.error('Failed to send completion email:', emailError)
    //   }
    // }

  } catch (error) {
    console.error('VPAT processing error:', error)
    
    await dbService.updateVPATSubmission(submissionId, {
      status: 'failed'
    })

    // Email notifications disabled
    // if (vpatBot.config.notifyOnCompletion && vpatBot.config.recipientEmail) {
    //   try {
    //     await emailService.sendNotification({
    //       to: vpatBot.config.recipientEmail,
    //       subject: `VPAT Evaluation Complete: ${metadata.productName}`,
    //       template: 'vpat-complete',
    //       data: { metadata, analysis, scorecardUrl: generatedScorecard.downloadUrl }
    //     })
    //   } catch (emailError) {
    //     console.error('Failed to send completion email:', emailError)
    //   }
    // }

    throw error
  }
}
