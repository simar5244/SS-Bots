import { dbService, VPATBot } from './db'
import { vpatParser } from './vpat-parser'
import { EmailService } from './email-service'
import { scorecardGenerator } from './scorecard-generator'
import { vpatImpactScorer } from './vpat-impact-scorer'
import { vpatMultiProductParser } from './vpat-multi-product-parser'
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

    const processingMethod = (vpatBot.config.processingMethod || 'method1') as 'method1' | 'dynamic'
    
    if (processingMethod === 'dynamic') {
      // Use the new dynamic processor
      const { processVPATSubmissionDynamic } = await import('./vpat-processor-dynamic')
      return processVPATSubmissionDynamic(submissionId, vpatBot, documentBuffer, fileType)
    }
    
    // Method 1: Read scorecard to get criteria list
    const { readFile, readdir } = await import('fs/promises')
    const uploadsDir = join(process.env.HOME || '', 'Desktop', 'db', 'vpat-uploads')
    const files = await readdir(uploadsDir)
    const scorecardFile = files.find(file => file.includes(vpatBot.referenceScorecard.fileName))
    
    if (!scorecardFile) {
      throw new Error(`Scorecard file not found: ${vpatBot.referenceScorecard.fileName}`)
    }
    
    const scorecardFilePath = join(uploadsDir, scorecardFile)
    const scorecardBuffer = await readFile(scorecardFilePath)
    
    // Analyze scorecard to get criteria list
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(scorecardBuffer as any)
    
    const criteriaIds: string[] = []
    workbook.eachSheet((worksheet) => {
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // Skip header
          const cellValue = row.getCell(1).value
          if (cellValue && typeof cellValue === 'string') {
            const match = cellValue.match(/^\d+\.\d+\.\d+/)
            if (match) {
              criteriaIds.push(match[0])
            }
          }
        }
      })
    })
    
    console.log(`📋 [METHOD 1] Found ${criteriaIds.length} criteria in scorecard`)
    
    const { metadata, criteria } = await vpatParser.extractVPATData(documentText, 'method1', criteriaIds)

    await dbService.addProcessingLog(
      submissionId, 
      'extraction_method', 
      'success', 
      'Using Method 1 (Chunking)'
    )

    const submission = await dbService.findVPATSubmissionById(submissionId)
    const multiProductAnalysis = await vpatMultiProductParser.detectAndSeparateProducts(documentText, criteria)
    
    if (multiProductAnalysis.hasMultipleProducts) {
      await dbService.updateVPATSubmission(submissionId, {
        multiProduct: {
          hasMultipleProducts: true,
          products: multiProductAnalysis.products
        }
      })
      await dbService.addProcessingLog(
        submissionId,
        'multi_product_detected',
        'success',
        `Detected ${multiProductAnalysis.products.length} product variants: ${multiProductAnalysis.products.map(p => p.productType).join(', ')}`
      )
    }

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

    const impactScore = submission?.impactFactors 
      ? vpatImpactScorer.calculateWeightedImpactScore(
          analysis.overallScore,
          criteria.length,
          submission.impactFactors,
          metadata
        )
      : null

    if (impactScore) {
      await dbService.addProcessingLog(
        submissionId,
        'impact_scoring_completed',
        'success',
        `Weighted impact score: ${impactScore.weightedScore} (${impactScore.priorityLevel} priority)`
      )
    }

    const generatedScorecard = {
      fileName: scorecardFileName,
      generatedAt: Date.now(),
      downloadUrl: `/api/vpat/scorecard/${submissionId}`,
      analysis: {
        totalCriteria: rows.length,
        overallScore: analysis.overallScore,
        compliancePercentage: analysis.compliancePercentage,
        weightedImpactScore: impactScore?.weightedScore,
        impactFactorsUsed: impactScore ? {
          numberOfStudents: submission?.impactFactors?.numberOfStudents,
          numberOfStaff: submission?.impactFactors?.numberOfStaff,
          cost: submission?.impactFactors?.cost,
          documentDate: submission?.impactFactors?.documentDate,
          vpatVersion: submission?.impactFactors?.vpatVersion || metadata.vpatVersion
        } : undefined,
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
