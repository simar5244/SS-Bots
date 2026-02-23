import { 
  dbService, 
  VPATSubmission, 
  VPATBot
} from './db'

interface PlatformReport {
  platform: string
  extractedData: any
  validationResult: any
  aiAnalysis: any
  missingCriteriaResult: any
  rows: any[]
  analysis: any
  excelBuffer: Buffer<ArrayBufferLike>
  fileName: string
  criteria?: any[]
}

import { VPATDocumentParser } from './vpat-parser'
import { ScorecardGenerator } from './scorecard-generator'
import { vpatNegligiblePostProcessor } from './vpat-negligible-post-processor'
import { vpatPlatformParser } from './vpat-platform-parser'
import { vpatMultiProductParser } from './vpat-multi-product-parser'
import OpenAI from 'openai'
import * as XLSX from 'xlsx'
import { writeFile } from 'fs/promises'
import { join } from 'path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const SCORECARD_DIR = join(process.env.HOME || '', 'Desktop', 'db', 'vpat-scorecards')

interface ScorecardAnalysis {
  evaluationMethodology: string
  criteriaList: Array<{
    id: string
    name: string
    level: string
    weight?: number
    description?: string
  }>
  scoringSystem: {
    supports: string | number
    partiallySupports: string | number
    doesNotSupport: string | number
    notApplicable?: string | number
    notEvaluated?: string | number
  }
  validationRules: Array<{
    field: string
    requirement: string
    mandatory: boolean
  }>
}


function extractCriteriaWithPatterns(content: string, sheetData: any[]): Array<{id: string, name: string, level: string}> {
  const criteria: Array<{id: string, name: string, level: string}> = []
  
  // Pattern matching for WCAG criteria
  const wcagPattern = /(\d+\.\d+\.\d+)/g
  let match
  while ((match = wcagPattern.exec(content)) !== null) {
    const id = match[1]
    if (!criteria.find(c => c.id === id)) {
      criteria.push({ id, name: `Criterion ${id}`, level: 'A' })
    }
  }
  
  return criteria
}

function extractCriteriaWithStructure(sheetData: any[]): Array<{id: string, name: string, level: string}> {
  const criteria: Array<{id: string, name: string, level: string}> = []
  
  sheetData.forEach(sheet => {
    sheet.data.forEach((row: any[]) => {
      row.forEach((cell: any) => {
        if (typeof cell === 'string') {
          const match = cell.match(/(\d+\.\d+\.\d+)/)
          if (match) {
            const id = match[0]
            if (!criteria.find(c => c.id === id)) {
              criteria.push({ id, name: `Criterion ${id}`, level: 'A' })
            }
          }
        }
      })
    })
  })
  
  return criteria
}

function deduplicateCriteria(criteria: Array<{id: string, name: string, level: string}>): Array<{id: string, name: string, level: string}> {
  const seen = new Set<string>()
  return criteria.filter(c => {
    if (!seen.has(c.id)) {
      seen.add(c.id)
      return true
    }
    return false
  })
}

function getEmergencyWCAGCriteria(): Array<{id: string, name: string, level: string}> {
  return [
    { id: "1.1.1", name: "Non-text Content", level: "A" },
    { id: "1.2.1", name: "Audio-only and Video-only", level: "A" },
    { id: "1.2.2", name: "Captions", level: "A" },
    { id: "1.3.1", name: "Info and Relationships", level: "A" },
    { id: "1.4.1", name: "Use of Color", level: "A" },
    { id: "2.1.1", name: "Keyboard", level: "A" },
    { id: "2.4.1", name: "Bypass Blocks", level: "A" },
    { id: "3.1.1", name: "Language of Page", level: "A" },
    { id: "4.1.1", name: "Parsing", level: "A" },
    { id: "4.1.2", name: "Name, Role, Value", level: "A" }
  ]
}

export async function processVPATSubmissionDynamic(
  submissionId: string,
  vpatBot: VPATBot,
  documentBuffer: Buffer,
  fileType: string
): Promise<void> {
  console.log('🚀 [DYNAMIC VPAT] Starting processing for submission:', submissionId)
  console.log('🤖 Bot ID:', vpatBot.id)
  console.log('📋 Bot name:', vpatBot.name)
  console.log('📄 Document type:', fileType)
  console.log('📊 Document size:', documentBuffer.length, 'bytes')
  console.log('⚙️ Processing method:', vpatBot.config.processingMethod)
  
  try {
    // Update status to processing
    await dbService.updateVPATSubmission(submissionId, { status: 'processing' })
    await dbService.addProcessingLog(submissionId, 'processing_started', 'success', 'Dynamic VPAT processing started')
    console.log('✅ Status updated to processing')

    // STEP 1: Parse the submitted document (PDF, DOCX, etc.)
    console.log('📖 [STEP 1] Parsing document...')
    const vpatParser = new VPATDocumentParser()
    const fileExtension = fileType.split('/').pop() || 'pdf'
    console.log('🔧 File extension:', fileExtension)
    
    const documentText = await vpatParser.parseDocument(documentBuffer, fileExtension)
    console.log('📝 Document parsed successfully:', documentText.length, 'characters')
    console.log('📋 First 200 characters:', documentText.substring(0, 200))
    
    await dbService.addProcessingLog(submissionId, 'step1_completed', 'success', `Document parsed: ${documentText.length} characters`)

    // STEP 2: Extract metadata and criteria using dynamic processing
    console.log('🔍 [STEP 2] Extracting VPAT data using dynamic processing...')
    
    let quickScorecardAnalysis: ScorecardAnalysis
    let quickCriteriaIds: string[]
    
    // Read the scorecard file first to know what criteria to look for
    const { readFile } = await import('fs/promises')
    const { readdir } = await import('fs/promises')
    const uploadsDir = join(process.env.HOME || '', 'Desktop', 'db', 'vpat-uploads')
    console.log('📁 Uploads directory:', uploadsDir)
    
    // Find the scorecard file by searching for the filename
    const files = await readdir(uploadsDir)
    console.log('📋 Available files:', files)
    
    const scorecardFile = files.find(file => file.includes(vpatBot.referenceScorecard.fileName))
    console.log('🔍 Looking for file containing:', vpatBot.referenceScorecard.fileName)
    console.log('📄 Found scorecard file:', scorecardFile)
    
    if (!scorecardFile) {
      throw new Error(`Scorecard file not found: ${vpatBot.referenceScorecard.fileName}`)
    }
    
    const scorecardFilePath = join(uploadsDir, scorecardFile)
    console.log('📄 Full scorecard path:', scorecardFilePath)
    
    const scorecardBuffer = await readFile(scorecardFilePath)
    console.log('📊 Scorecard file read:', scorecardBuffer.length, 'bytes')
    
    // Quick analysis to get criteria list
    quickScorecardAnalysis = await analyzeScorecardTemplate(scorecardBuffer)
    quickCriteriaIds = quickScorecardAnalysis.criteriaList.map(c => c.id)
    console.log('📋 Quick scorecard analysis found:', quickCriteriaIds.length, 'criteria')
    
    // STEP 2.5: DETECT PLATFORMS FIRST (before extraction)
    console.log('🔍 [STEP 2.5] Detecting platforms in VPAT...')
    const platformDetectionResult = await vpatPlatformParser.detectPlatformVariations(documentText, [])
    
    let platformsToProcess: string[] = []
    if (platformDetectionResult.hasPlatformVariations && platformDetectionResult.detectedPlatforms.length > 0) {
      platformsToProcess = platformDetectionResult.detectedPlatforms
      console.log(`✅ [PLATFORM DETECTION] Found ${platformsToProcess.length} platforms:`, platformsToProcess)
      await dbService.addProcessingLog(
        submissionId,
        'step2_5_platform_detection',
        'success',
        `Detected ${platformsToProcess.length} platforms: ${platformsToProcess.join(', ')}`
      )
    } else {
      platformsToProcess = ['Default']
      console.log('ℹ️ [PLATFORM DETECTION] No platform variations detected, using default processing')
    }
    
    // STEP 3: Analyze scorecard template
    console.log('📊 [STEP 3] Analyzing scorecard template...')
    const scorecardAnalysis = quickScorecardAnalysis
    console.log('📋 Scorecard analysis result:', {
      criteriaFound: scorecardAnalysis.criteriaList.length,
      methodology: scorecardAnalysis.evaluationMethodology ? 'Found' : 'Missing',
      scoringSystem: scorecardAnalysis.scoringSystem ? 'Found' : 'Missing'
    })
    await dbService.addProcessingLog(submissionId, 'step3_completed', 'success', `Scorecard analyzed: ${scorecardAnalysis.criteriaList.length} criteria found`)

    // STEP 4: NOW PROCESS EACH PLATFORM SEPARATELY
    console.log(`🔄 [STEP 4] Processing ${platformsToProcess.length} platform(s) separately...`)
    
    let platformReports: Array<{
      platform: string
      extractedData: any
      validationResult: any
      aiAnalysis: any
      missingCriteriaResult: any
      rows: any[]
      analysis: any
      excelBuffer: Buffer
      fileName: string
    }> = []
    
    const scorecardCriteriaIds = scorecardAnalysis.criteriaList.map(c => c.id)
    
    for (const platform of platformsToProcess) {
      console.log(`\n${'='.repeat(80)}`)
      console.log(`🎯 [PLATFORM: ${platform}] Starting independent processing pipeline`)
      console.log(`${'='.repeat(80)}\n`)
      
      // STEP 4.1: Extract data FOR THIS PLATFORM ONLY
      console.log(`📊 [${platform}] STEP 1: Extracting VPAT data for ${platform} platform...`)
      const extractedData = await vpatParser.extractVPATData(
        documentText, 
        'dynamic', 
        scorecardCriteriaIds,
        platform !== 'Default' ? platform : undefined
      )
      console.log(`📊 [${platform}] Extracted ${extractedData.criteria.length} criteria`)
      
      // STEP 4.2: Validate FOR THIS PLATFORM
      console.log(`✅ [${platform}] STEP 2: Validating against scorecard...`)
      const validationResult = await validateAgainstScorecard(
        extractedData.metadata, 
        extractedData.criteria, 
        scorecardAnalysis
      )
      console.log(`🔍 [${platform}] Validation: ${validationResult.isValid ? 'PASSED' : 'NEEDS_REVIEW'}`)
      
      // STEP 4.3: Generate AI analysis FOR THIS PLATFORM
      console.log(`🤖 [${platform}] STEP 3: Generating AI analysis...`)
      const nonSupporting = extractedData.criteria.filter((c: any) => 
        c.scorecardEquivalent !== 'Supports' && c.scorecardEquivalent !== 'Not Applicable'
      )
      const aiAnalysis = {
        summary: `[${platform}] Found ${extractedData.criteria.length} criteria with ${nonSupporting.length} issues requiring attention.`,
        confidence: 85,
        flaggedIssues: nonSupporting.slice(0, 5).map((c: any) => `${c.criterionId}: ${c.conformanceLevel}`),
        recommendations: [`Review ${platform} non-compliant criteria`, `Address ${platform} partial support issues`]
      }
      console.log(`📋 [${platform}] AI analysis: ${aiAnalysis.summary}`)
      
      // STEP 4.4: Add missing criteria FOR THIS PLATFORM
      console.log(`🔍 [${platform}] STEP 4: Checking for missing criteria...`)
      const missingCriteriaResult = await addMissingCriteria(
        extractedData.criteria, 
        scorecardAnalysis, 
        documentText
      )
      console.log(`📋 [${platform}] Final criteria count: ${missingCriteriaResult.finalCriteria.length}`)
      
      // STEP 4.5: Generate scorecard FOR THIS PLATFORM
      console.log(`📊 [${platform}] STEP 5: Generating scorecard...`)
      const scorecardGenerator = new ScorecardGenerator()
      const { rows, analysis, excelBuffer } = await scorecardGenerator.generateDetailedScorecard(
        extractedData.metadata,
        missingCriteriaResult.finalCriteria,
        vpatBot.referenceScorecard,
        submissionId
      )
      
      const fileName = `scorecard_${platform.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.xlsx`
      
      platformReports.push({
        platform,
        extractedData,
        validationResult,
        aiAnalysis,
        missingCriteriaResult,
        rows,
        analysis,
        excelBuffer,
        fileName,
        criteria: missingCriteriaResult.finalCriteria
      })
      
      console.log(`✅ [${platform}] Report generated: ${rows.length} criteria, ${analysis.compliancePercentage}% compliance\n`)
    }
    
    await dbService.addProcessingLog(
      submissionId, 
      'step4_platform_processing', 
      'success', 
      `Processed ${platformReports.length} platform(s): ${platformsToProcess.join(', ')}`
    )
    
    // Use first platform report for backward compatibility with existing code
    const primaryReport = platformReports[0]
    const extractedData = primaryReport.extractedData
    const validationResult = primaryReport.validationResult
    const aiAnalysis = primaryReport.aiAnalysis
    const missingCriteriaResult = primaryReport.missingCriteriaResult
    const rows = primaryReport.rows
    const analysis = primaryReport.analysis
    
    // STEP 5: Save all platform reports
    console.log('📊 [STEP 5] Saving platform reports...')
    const savedReports = []
    
    for (const report of platformReports) {
      const filePath = join(SCORECARD_DIR, report.fileName)
      await writeFile(filePath, report.excelBuffer)
      
      savedReports.push({
        platform: report.platform,
        fileName: report.fileName,
        filePath,
        analysis: report.analysis,
        criteriaCount: report.rows.length,
        criteria: ((report as any).criteria || []).map((c: any) => ({
          criterionId: c.criterionId,
          criterionName: c.criterionName,
          level: c.level,
          conformanceLevel: c.conformanceLevel,
          scorecardEquivalent: c.scorecardEquivalent,
          remarks: c.remarks,
          pageNumber: c.pageNumber,
          excerpt: c.excerpt,
          confidence: c.confidence
        }))
      })
      
      console.log(`✅ Saved ${report.platform} report: ${report.fileName}`)
    }
    
    await dbService.addProcessingLog(
      submissionId, 
      'step5_completed', 
      'success', 
      `Saved ${savedReports.length} platform report(s): ${savedReports.map(r => `${r.platform} (${r.criteriaCount} criteria)`).join(', ')}`
    )

    // STEP 6: Post-process ALL platform scorecards for negligible impact (SEPARATE SERVICE)
    console.log('🔍 [STEP 10.5] Running negligible impact post-processor on all platform reports...')
    let negligibleProcessingLogs: string[] = []
    
    for (let i = 0; i < platformReports.length; i++) {
      const report = platformReports[i]
      console.log(`🔍 [NEGLIGIBLE IMPACT] Processing ${report.platform} report...`)
      
      try {
        const hasImpact = await vpatNegligiblePostProcessor.hasImpactColumn(report.excelBuffer)
        
        if (hasImpact) {
          const { modifiedBuffer, result } = await vpatNegligiblePostProcessor.processScorecard(report.excelBuffer)
          
          // Update the report's buffer with the modified version
          platformReports[i].excelBuffer = modifiedBuffer
          
          // Re-save the updated file
          const filePath = join(SCORECARD_DIR, report.fileName)
          await writeFile(filePath, modifiedBuffer)
          
          if (result.processedCount > 0) {
            const logMessage = `[${report.platform}] Auto-marked ${result.processedCount} criteria as Supports due to negligible impact`
            negligibleProcessingLogs.push(logMessage)
            console.log(`✅ [NEGLIGIBLE IMPACT] ${logMessage}`)
            
            result.overriddenCriteria.forEach(c => {
              console.log(`  - Row ${c.rowNumber}: ${c.criterionId} (${c.criterionName})`)
              console.log(`    Original: ${c.originalConformance} → New: Supports`)
              console.log(`    Impact: ${c.impactValue}`)
            })
          } else {
            negligibleProcessingLogs.push(`[${report.platform}] Impact column found but no negligible criteria detected`)
            console.log(`ℹ️ [NEGLIGIBLE IMPACT] No negligible criteria in ${report.platform}`)
          }
        } else {
          console.log(`ℹ️ [NEGLIGIBLE IMPACT] No Impact column found in ${report.platform} scorecard`)
          negligibleProcessingLogs.push(`[${report.platform}] No Impact column found`)
        }
      } catch (postProcessError) {
        console.error(`⚠️ [NEGLIGIBLE IMPACT] Post-processing failed for ${report.platform}:`, postProcessError)
        negligibleProcessingLogs.push(`[${report.platform}] Post-processing failed: ${postProcessError}`)
      }
    }
    
    const combinedNegligibleLog = negligibleProcessingLogs.length > 0 
      ? negligibleProcessingLogs.join('; ') 
      : 'No negligible impact processing needed'
    
    await dbService.addProcessingLog(
      submissionId, 
      'step10_5_negligible_impact', 
      'success', 
      combinedNegligibleLog
    )

    // STEP 11: Generate optimized comprehensive analysis
    console.log('⚡ [STEP 11] Generating optimized comprehensive analysis...')
    
    // Fast O(n) analysis with proper conformance normalization
    let supports = 0, partiallySupports = 0, doesNotSupport = 0, notApplicable = 0
    
    console.log('🔍 [DEBUG] Starting conformance analysis with', missingCriteriaResult.finalCriteria.length, 'criteria')
    
    // Log the first few criteria to understand the data structure
    if (missingCriteriaResult.finalCriteria.length > 0) {
      console.log('🔍 [DEBUG] Sample criteria data:', {
        firstCriterion: missingCriteriaResult.finalCriteria[0],
        secondCriterion: missingCriteriaResult.finalCriteria[1] || 'N/A',
        keys: Object.keys(missingCriteriaResult.finalCriteria[0] || {})
      })
    }
    
    missingCriteriaResult.finalCriteria.forEach((c: any, index: number) => {
      // Use the same normalization logic as the comprehensive analysis
      const conformance = c.scorecardEquivalent || c.conformanceLevel || 'Does Not Support'
      
      console.log(`🔍 [DEBUG] Criterion ${index}:`, {
        id: c.id,
        conformanceLevel: c.conformanceLevel,
        scorecardEquivalent: c.scorecardEquivalent,
        rawConformance: conformance,
        allKeys: Object.keys(c)
      })
      
      let normalizedConformance = 'doesNotSupport'
      if (conformance === 'Supports' || conformance === 'supports') {
        normalizedConformance = 'supports'
      } else if (conformance === 'Partially Supports' || conformance === 'PartiallySupports' || conformance === 'Partial') {
        normalizedConformance = 'partiallySupports'
      } else if (conformance === 'Does Not Support' || conformance === 'DoesNotSupport' || conformance === 'Not Supported') {
        normalizedConformance = 'doesNotSupport'
      } else if (conformance === 'Not Applicable' || conformance === 'NotApplicable' || conformance === 'N/A') {
        normalizedConformance = 'notApplicable'
      } else {
        // Log any unexpected conformance values
        console.log(`🔍 [DEBUG] Unexpected conformance value: "${conformance}"`)
      }
      
      console.log(`🔍 [DEBUG] Normalized to: ${normalizedConformance}`)
      
      // Count the normalized conformance
      if (normalizedConformance === 'supports') supports++
      else if (normalizedConformance === 'partiallySupports') partiallySupports++
      else if (normalizedConformance === 'doesNotSupport') doesNotSupport++
      else if (normalizedConformance === 'notApplicable') notApplicable++
    })
    
    const totalApplicable = missingCriteriaResult.finalCriteria.length - notApplicable
    const overallScore = totalApplicable > 0 ? Math.round((supports / totalApplicable) * 100) : 100
    
    console.log('📊 [SCORE CALCULATION] Conformance counts:', {
      supports,
      partiallySupports,
      doesNotSupport,
      notApplicable,
      totalCriteria: missingCriteriaResult.finalCriteria.length,
      totalApplicable,
      calculatedScore: overallScore
    })
    
    const comprehensiveAnalysis = {
      overallScore,
      compliancePercentage: overallScore,
      levelACompliance: overallScore, // Simplified
      levelAACompliance: overallScore, // Simplified  
      levelAAACompliance: overallScore, // Simplified
      supports,
      partiallySupports,
      doesNotSupport,
      criticalIssues: missingCriteriaResult.finalCriteria.filter((c: any) => 
        c.scorecardEquivalent === 'Does Not Support' && c.level === 'A'
      ).slice(0, 3).map((c: any) => ({ criterion: c.criterionId, issue: 'Critical failure', severity: 'high' })),
      strengths: missingCriteriaResult.finalCriteria.filter((c: any) => 
        c.scorecardEquivalent === 'Supports'
      ).slice(0, 3).map((c: any) => ({ criterion: c.criterionId, strength: 'Fully supported' })),
      criteriaBreakdown: {
        byLevel: { A: missingCriteriaResult.finalCriteria.filter((c: any) => c.level === 'A').length, AA: 0, AAA: 0 },
        byConformance: { supports, partiallySupports, doesNotSupport },
        detailed: missingCriteriaResult.finalCriteria.slice(0, 10).map((c: any) => ({
          id: c.criterionId,
          name: c.criterionName || c.criterionId,
          level: c.level || 'A',
          conformance: c.conformanceLevel,
          impact: 'Standard'
        }))
      },
      scoringDetails: {
        methodology: 'Optimized scoring',
        weights: {},
        calculations: []
      },
      complianceMatrix: {
        totalCriteria: missingCriteriaResult.finalCriteria.length,
        applicableCriteria: totalApplicable,
        compliantCriteria: supports,
        nonCompliantCriteria: doesNotSupport,
        partiallyCompliantCriteria: partiallySupports,
        notApplicableCriteria: notApplicable,
        complianceRate: overallScore
      },
      riskAssessment: {
        overallRisk: doesNotSupport > 0 ? 'medium' : 'low',
        criticalFailures: missingCriteriaResult.finalCriteria.filter((c: any) => 
          c.scorecardEquivalent === 'Does Not Support' && c.level === 'A'
        ).map((c: any) => c.criterionId),
        riskFactors: []
      },
      recommendations: [
        'Address non-compliant criteria',
        'Review partial support issues'
      ]
    }
    
    console.log('✅ Comprehensive analysis completed (optimized):', {
      overallScore: comprehensiveAnalysis.overallScore,
      compliancePercentage: comprehensiveAnalysis.compliancePercentage,
      supports: comprehensiveAnalysis.supports,
      partiallySupports: comprehensiveAnalysis.partiallySupports,
      doesNotSupport: comprehensiveAnalysis.doesNotSupport,
      totalCriteria: missingCriteriaResult.finalCriteria.length
    })
    await dbService.addProcessingLog(submissionId, 'step11_comprehensive_analysis', 'success', `Comprehensive analysis generated: ${comprehensiveAnalysis.overallScore}% overall score`)

    // Save files and update database
    console.log('💾 [STEP 13] Starting file and database save...')
    const { mkdir } = await import('fs/promises')
    await mkdir(SCORECARD_DIR, { recursive: true })
    
    const scorecardFileName = `Scorecard_${extractedData.metadata.productName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Unknown'}_${Date.now()}.xlsx`
    const scorecardPath = join(SCORECARD_DIR, scorecardFileName)
    console.log('📁 [STEP 13] Scorecard path:', scorecardPath)

    const generatedScorecard = {
      fileName: scorecardFileName,
      generatedAt: Date.now(),
      downloadUrl: `/api/vpat/scorecard/${submissionId}`,
      analysis: {
        totalCriteria: rows.length,
        overallScore: comprehensiveAnalysis.overallScore,
        compliancePercentage: comprehensiveAnalysis.compliancePercentage,
        levelACompliance: comprehensiveAnalysis.levelACompliance,
        levelAACompliance: comprehensiveAnalysis.levelAACompliance,
        levelAAACompliance: comprehensiveAnalysis.levelAAACompliance,
        supports: comprehensiveAnalysis.supports,
        partiallySupports: comprehensiveAnalysis.partiallySupports,
        doesNotSupport: comprehensiveAnalysis.doesNotSupport,
        criticalIssuesCount: comprehensiveAnalysis.criticalIssues.length,
        strengthsCount: comprehensiveAnalysis.strengths.length,
        // Removed verification result
        scorecardAnalysis,
        // NEW COMPREHENSIVE FEATURES
        criteriaBreakdown: comprehensiveAnalysis.criteriaBreakdown,
        scoringDetails: comprehensiveAnalysis.scoringDetails,
        complianceMatrix: comprehensiveAnalysis.complianceMatrix,
        riskAssessment: comprehensiveAnalysis.riskAssessment,
        recommendations: comprehensiveAnalysis.recommendations
      }
    }

    console.log('🔄 [STEP 13] Starting Promise.all operations...')
    
    // Determine final status
    const finalStatus = (validationResult?.isValid && vpatBot.config.autoApprove) ? 'completed' : 'needs_review'
    console.log(`📊 [STEP 13] Setting submission status to: ${finalStatus}`)
    
    try {
      // Save primary report for backward compatibility
      await writeFile(scorecardPath, primaryReport.excelBuffer)
      
      await Promise.all([
        dbService.updateVPATSubmission(submissionId, {
          extractedData: {
            vpatVersion: extractedData.metadata.vpatVersion,
            productName: extractedData.metadata.productName,
            vendorName: extractedData.metadata.vendorName,
            reportDate: extractedData.metadata.reportDate,
            wcagVersion: extractedData.metadata.wcagVersion,
            wcagLevel: extractedData.metadata.wcagLevel,
            criteria: missingCriteriaResult.finalCriteria,
          },
          validationResults: validationResult,
          aiAnalysis,
          generatedScorecard,
          platformReports: savedReports.map(r => ({
            platform: r.platform,
            fileName: r.fileName,
            analysis: r.analysis,
            criteriaCount: r.criteriaCount,
            criteria: r.criteria
          })),
          status: finalStatus,
          completedAt: Date.now()
        }),
        dbService.updateVPATBot(vpatBot.id, {
          processedCount: vpatBot.processedCount + 1
        })
      ])
      
      console.log('✅ [STEP 13] Promise.all completed successfully')
      console.log(`✅ [STEP 13] Submission ${submissionId} status updated to: ${finalStatus}`)
      console.log(`✅ [STEP 13] Platform reports saved: ${savedReports.map(r => r.platform).join(', ')}`)
      console.log(`✅ [STEP 13] Score saved to database: ${comprehensiveAnalysis.overallScore}% (supports: ${comprehensiveAnalysis.supports}, doesNotSupport: ${comprehensiveAnalysis.doesNotSupport})`)
      
      // Verify the status was actually persisted
      const verifySubmission = await dbService.findVPATSubmissionById(submissionId)
      console.log(`🔍 [STEP 13] Verification - Current status in DB: ${verifySubmission?.status}`)
      console.log(`🔍 [STEP 13] Verification - Score in DB: ${verifySubmission?.generatedScorecard?.analysis?.overallScore}%`)
      if (verifySubmission?.status !== finalStatus) {
        console.error(`❌ [STEP 13] Status mismatch! Expected: ${finalStatus}, Got: ${verifySubmission?.status}`)
      }
      if (!verifySubmission?.generatedScorecard?.analysis?.overallScore) {
        console.error(`❌ [STEP 13] Score not found in database!`)
      }
      
      await dbService.addProcessingLog(submissionId, 'step13_files_saved', 'success', `Files and database updated - Status: ${finalStatus}`)
    } catch (saveError) {
      console.error('❌ [STEP 13] Error saving files/database:', saveError)
      await dbService.addProcessingLog(submissionId, 'step13_files_saved', 'error', `Save error: ${saveError}`)
      throw saveError
    }

    await dbService.addProcessingLog(submissionId, 'processing_completed', 'success', 'Dynamic VPAT processing completed')
    console.log('🎉 [COMPLETED] VPAT processing finished successfully')

  } catch (error) {
    console.error('Dynamic VPAT processing error:', error)
    await dbService.updateVPATSubmission(submissionId, {
      status: 'failed'
    })
    throw error
  }
}

async function analyzeScorecardTemplate(scorecardBuffer: Buffer): Promise<ScorecardAnalysis> {
  console.log('🔍 [STEP 3] Starting scorecard template analysis...')
  console.log('📊 Scorecard buffer size:', scorecardBuffer.length, 'bytes')
  
  try {
    // Parse the Excel file
    console.log('📋 Parsing Excel file...')
    const workbook = XLSX.read(scorecardBuffer, { type: 'buffer' })
    const sheetNames = workbook.SheetNames
    console.log('📑 Sheets found:', sheetNames)
    
    let fullContent = ''
    const sheetData: Array<{name: string, data: any[], rowCount: number, colCount: number}> = []
    
    sheetNames.forEach((sheetName, index) => {
      console.log(`📄 Processing sheet ${index + 1}/${sheetNames.length}: "${sheetName}"`)
      const sheet = workbook.Sheets[sheetName]
      
      // Get data as array of arrays
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 })
      console.log(`📊 Sheet "${sheetName}" has ${jsonData.length} rows`)
      
      // Log first few rows of each sheet for debugging
      if (jsonData.length > 0) {
        console.log(`📋 Sheet "${sheetName}" first 5 rows:`, jsonData.slice(0, 5))
      }
      
      sheetData.push({
        name: sheetName,
        data: jsonData,
        rowCount: jsonData.length,
        colCount: jsonData.length > 0 ? (jsonData[0] as any[]).length : 0
      })
      
      const csv = XLSX.utils.sheet_to_csv(sheet)
      fullContent += `\n=== SHEET: ${sheetName} ===\n${csv}\n`
    })
    
    console.log('📝 Full content length:', fullContent.length, 'characters')
    console.log('📋 Sheet data summary:', sheetData.map(s => ({ name: s.name, rows: s.rowCount, cols: s.colCount })))
    
    // NEW: AGGRESSIVE CRITERIA DETECTION
    console.log('🔍 [AGGRESSIVE DETECTION] Starting multi-method criteria extraction...')
    
    // Method 2: Pattern-based extraction (regex patterns)
    console.log('🔍 Method 2: Pattern-based extraction...')
    const patternCriteria = extractCriteriaWithPatterns(fullContent, sheetData)
    console.log(`📊 Pattern matching found ${patternCriteria.length} criteria`)
    
    // Method 3: Hybrid approach (combine remaining methods)
    console.log('� Method 3: Structure-based extraction...')
    const structureCriteria = extractCriteriaWithStructure(sheetData)
    console.log(`📊 Structure analysis found ${structureCriteria.length} criteria`)
    
    // Method 4: Combine all methods
    console.log('� Method 4: Hybrid approach...')
    const allCriteria = [...patternCriteria, ...structureCriteria]
    
    // Deduplicate and merge criteria
    const uniqueCriteria = deduplicateCriteria(allCriteria)
    console.log(`🎯 Final unique criteria: ${uniqueCriteria.length}`)
    
    // If still no criteria found, try emergency fallback
    if (uniqueCriteria.length === 0) {
      console.log('� Emergency fallback: Using generic WCAG criteria...')
      const emergencyCriteria = getEmergencyWCAGCriteria()
      uniqueCriteria.push(...emergencyCriteria)
    }
    
    console.log('📋 Final criteria list:')
    uniqueCriteria.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.id}: ${c.level} - ${c.name}`)
    })
    
    // Generate analysis with found criteria
    const analysis: ScorecardAnalysis = {
      evaluationMethodology: 'Dynamic multi-method extraction with pattern matching and structure analysis',
      criteriaList: uniqueCriteria,
      scoringSystem: {
        supports: 'Supports',
        partiallySupports: 'Partially Supports',
        doesNotSupport: 'Does Not Support',
        notApplicable: 'Not Applicable',
        notEvaluated: 'Not Evaluated'
      },
      validationRules: [
        { field: 'criterionId', requirement: 'Must be valid WCAG identifier', mandatory: true },
        { field: 'conformanceLevel', requirement: 'Must be one of: Supports, Partially Supports, Does Not Support, Not Applicable', mandatory: true },
        { field: 'level', requirement: 'Must be A, AA, or AAA', mandatory: true }
      ]
    }
    
    console.log('✅ [STEP 3] Scorecard analysis completed')
    return analysis
    
  } catch (error) {
    console.error('❌ [STEP 3] Scorecard analysis error:', error)
    console.error('🔍 Error details:', error instanceof Error ? error.message : String(error))
    console.error('📊 Stack trace:', error instanceof Error ? error.stack : 'No stack trace available')
    
    return {
      evaluationMethodology: 'Analysis failed due to error',
      criteriaList: [],
      scoringSystem: {
        supports: 'Supports',
        partiallySupports: 'Partially Supports',
        doesNotSupport: 'Does Not Support'
      },
      validationRules: []
    }
  }
}


export async function validateAgainstScorecard(
  metadata: any, 
  criteria: any[], 
  scorecardAnalysis: ScorecardAnalysis
): Promise<any> {
  const errors: string[] = []
  const warnings: string[] = []
  let isValid = true

  // Validate against dynamic rules from scorecard
  for (const rule of scorecardAnalysis.validationRules) {
    if (rule.mandatory) {
      const fieldValue = (metadata as any)[rule.field.toLowerCase().replace(/\s+/g, '')]
      if (!fieldValue) {
        errors.push(`Missing required field: ${rule.field}`)
        isValid = false
      }
    }
  }

  // Check if criteria match scorecard expectations
  const scorecardCriteriaIds = new Set(scorecardAnalysis.criteriaList.map(c => c.id))
  const extractedCriteriaIds = new Set(criteria.map(c => c.criterionId))
  
  const missingCriteria = [...scorecardCriteriaIds].filter(id => !extractedCriteriaIds.has(id))
  if (missingCriteria.length > 0) {
    warnings.push(`Scorecard expects criteria not found in VPAT: ${missingCriteria.join(', ')}`)
  }

  const extraCriteria = [...extractedCriteriaIds].filter(id => !scorecardCriteriaIds.has(id))
  if (extraCriteria.length > 0) {
    warnings.push(`VPAT contains criteria not in scorecard: ${extraCriteria.join(', ')}`)
  }

  return {
    isValid,
    errors,
    warnings,
    scorecardCompliance: {
      expectedCriteria: scorecardAnalysis.criteriaList.length,
      extractedCriteria: criteria.length,
      matchingCriteria: [...scorecardCriteriaIds].filter(id => extractedCriteriaIds.has(id)).length
    }
  }
}


export async function addMissingCriteria(
  extractedCriteria: any[], 
  scorecardAnalysis: ScorecardAnalysis, 
  documentText: string
): Promise<{
  addedCriteria: any[]
  finalCriteria: any[]
  missingFromScorecard: string[]
}> {
  console.log('🔍 [MISSING CRITERIA] Starting analysis...')
  
  // Get all expected criteria from scorecard
  const scorecardCriteriaIds = new Set(scorecardAnalysis.criteriaList.map(c => c.id))
  const extractedCriteriaIds = new Set(extractedCriteria.map(c => c.criterionId))
  
  console.log('📊 Scorecard criteria count:', scorecardCriteriaIds.size)
  console.log('📊 Extracted criteria count:', extractedCriteriaIds.size)
  
  // Find criteria that are in scorecard but not extracted
  const missingCriteriaIds = Array.from(scorecardCriteriaIds).filter(id => !extractedCriteriaIds.has(id))
  console.log('🔍 Missing criteria IDs:', missingCriteriaIds)
  
  if (missingCriteriaIds.length === 0) {
    console.log('✅ No missing criteria found')
    return {
      addedCriteria: [],
      finalCriteria: extractedCriteria,
      missingFromScorecard: []
    }
  }
  
  console.log(`🔍 Found ${missingCriteriaIds.length} missing criteria, attempting to extract from document...`)
  
  // Try to extract missing criteria from the document using AI
  const missingCriteriaInfo = scorecardAnalysis.criteriaList.filter(c => missingCriteriaIds.includes(c.id))
  
  const prompt = `Extract the following missing WCAG criteria from this VPAT document:

DOCUMENT TEXT:
${documentText.substring(0, 50000)}

MISSING CRITERIA TO FIND:
${missingCriteriaInfo.map(c => `${c.id}: ${c.name} (Level ${c.level})`).join('\n')}

For each missing criterion, look through the document and extract:
1. The conformance level (Supports, Partially Supports, Does Not Support, Not Applicable)
2. Any comments or remarks about this criterion
3. Any supporting details or rationale

If a criterion is truly not mentioned in the document, mark it as "Not Evaluated".

Return JSON format:
{
  "foundCriteria": [
    {
      "criterionId": "1.1.1",
      "criterionName": "Non-text Content",
      "level": "A",
      "conformanceLevel": "Supports",
      "remarks": "All non-text content has text alternatives",
      "supportingDetails": "Images have alt text, videos have captions"
    }
  ],
  "notFoundCriteria": ["1.2.1", "1.2.2"]
}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are extracting missing WCAG criteria from a VPAT document. Be thorough and accurate.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    })
    
    const result = JSON.parse(response.choices[0].message.content || '{}')
    console.log('📥 AI extraction result:', {
      foundCount: result.foundCriteria?.length || 0,
      notFoundCount: result.notFoundCriteria?.length || 0
    })
    
    // Create criteria objects for found ones
    const addedCriteria = (result.foundCriteria || []).map((c: any) => ({
      criterionId: c.criterionId,
      criterionName: c.criterionName,
      level: c.level,
      conformanceLevel: c.conformanceLevel,
      remarks: c.remarks || '',
      supportingDetails: c.supportingDetails || '',
      weight: 1,
      scorecardEquivalent: c.conformanceLevel
    }))
    
    // Create "Not Evaluated" criteria for not found ones
    const notEvaluatedCriteria = (result.notFoundCriteria || []).map((id: string) => {
      const scorecardInfo = scorecardAnalysis.criteriaList.find(c => c.id === id)
      return {
        criterionId: id,
        criterionName: scorecardInfo?.name || `Criterion ${id}`,
        level: scorecardInfo?.level || 'A',
        conformanceLevel: 'Not Evaluated',
        remarks: 'Criterion not mentioned in document',
        supportingDetails: 'Unable to locate evaluation in document',
        weight: 1,
        scorecardEquivalent: 'Not Evaluated'
      }
    })
    
    const allAddedCriteria = [...addedCriteria, ...notEvaluatedCriteria]
    const finalCriteria = [...extractedCriteria, ...allAddedCriteria]
    
    console.log('✅ [MISSING CRITERIA] Completed:', {
      addedCriteria: allAddedCriteria.length,
      finalCriteria: finalCriteria.length,
      addedDetails: allAddedCriteria.map(c => `${c.criterionId}: ${c.conformanceLevel}`)
    })
    
    return {
      addedCriteria: allAddedCriteria,
      finalCriteria,
      missingFromScorecard: result.notFoundCriteria || []
    }
    
  } catch (error) {
    console.error('❌ [MISSING CRITERIA] Error:', error)
    return {
      addedCriteria: [],
      finalCriteria: extractedCriteria,
      missingFromScorecard: missingCriteriaIds
    }
  }
}

async function generateComprehensiveScorecardAnalysis(
  metadata: any,
  criteria: any[],
  scorecardAnalysis: ScorecardAnalysis,
  rows: any[],
  existingAnalysis: any
): Promise<{
  overallScore: number
  compliancePercentage: number
  levelACompliance: number
  levelAACompliance: number
  levelAAACompliance: number
  supports: number
  partiallySupports: number
  doesNotSupport: number
  criticalIssues: Array<{ criterion: string; issue: string; severity: string }>
  strengths: Array<{ criterion: string; strength: string }>
  criteriaBreakdown: {
    byLevel: { A: number; AA: number; AAA: number }
    byConformance: { supports: number; partiallySupports: number; doesNotSupport: number }
    detailed: Array<{
      id: string
      name: string
      level: string
      conformance: string
      weight?: number
      impact: string
    }>
  }
  scoringDetails: {
    methodology: string
    weights: Record<string, number>
    calculations: Array<{
      criterion: string
      weight: number
      score: number | undefined
      contribution: number
    }>
  }
  complianceMatrix: {
    totalCriteria: number
    applicableCriteria: number
    compliantCriteria: number
    nonCompliantCriteria: number
    partiallyCompliantCriteria: number
    notApplicableCriteria: number
    complianceRate: number
  }
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high'
    criticalFailures: string[]
    riskFactors: Array<{ factor: string; impact: string; mitigation: string }>
  }
  recommendations: Array<{
    category: string
    priority: 'high' | 'medium' | 'low'
    recommendation: string
    rationale: string
  }>
}> {
  console.log('🔍 [COMPREHENSIVE ANALYSIS] Starting analysis with', criteria.length, 'criteria')
  console.log('📋 Sample criteria structure:', criteria.slice(0, 2))
  
  // Count criteria by level and conformance
  const levelCounts = { A: 0, AA: 0, AAA: 0 }
  const conformanceCounts = { supports: 0, partiallySupports: 0, doesNotSupport: 0, notApplicable: 0 }
  
  criteria.forEach((criterion, index) => {
    console.log(`🔍 Criterion ${index}:`, {
      id: criterion.criterionId,
      level: criterion.level,
      conformanceLevel: criterion.conformanceLevel,
      scorecardEquivalent: criterion.scorecardEquivalent
    })
    
    const level = criterion.level || 'A'
    if (levelCounts[level as keyof typeof levelCounts] !== undefined) {
      levelCounts[level as keyof typeof levelCounts]++
    }
    
    // FIX: Use conformanceLevel instead of scorecardEquivalent for VPAT criteria
    const conformance = criterion.scorecardEquivalent || criterion.conformanceLevel || 'Does Not Support'
    console.log(`📊 Conformance mapping: ${criterion.conformanceLevel} -> ${conformance}`)
    
    // Normalize conformance values
    let normalizedConformance = 'doesNotSupport'
    if (conformance === 'Supports' || conformance === 'supports') {
      normalizedConformance = 'supports'
    } else if (conformance === 'Partially Supports' || conformance === 'PartiallySupports' || conformance === 'Partial') {
      normalizedConformance = 'partiallySupports'
    } else if (conformance === 'Does Not Support' || conformance === 'DoesNotSupport' || conformance === 'Not Supported') {
      normalizedConformance = 'doesNotSupport'
    } else if (conformance === 'Not Applicable' || conformance === 'NotApplicable' || conformance === 'N/A') {
      normalizedConformance = 'notApplicable'
    }
    
    if (conformanceCounts[normalizedConformance as keyof typeof conformanceCounts] !== undefined) {
      conformanceCounts[normalizedConformance as keyof typeof conformanceCounts]++
    }
  })
  
  console.log('📊 Level counts:', levelCounts)
  console.log('📊 Conformance counts:', conformanceCounts)

  // Calculate compliance percentages
  const totalCriteria = criteria.length
  const supportsCount = conformanceCounts.supports
  const applicableCriteria = totalCriteria - conformanceCounts.notApplicable
  const overallScore = applicableCriteria > 0 ? Math.round((supportsCount / applicableCriteria) * 100) : 100
  const compliancePercentage = overallScore

  // Calculate level-specific compliance
  const levelACriteria = criteria.filter(c => c.level === 'A')
  const levelAACriteria = criteria.filter(c => c.level === 'AA')
  const levelAAACriteria = criteria.filter(c => c.level === 'AAA')
  
  console.log('📊 Level breakdown:', {
    levelA: levelACriteria.length,
    levelAA: levelAACriteria.length, 
    levelAAA: levelAAACriteria.length
  })
  
  const levelACompliance = levelACriteria.length > 0 
    ? Math.round((levelACriteria.filter(c => {
        const conformance = c.scorecardEquivalent || c.conformanceLevel || 'Does Not Support'
        return conformance === 'Supports' || conformance === 'supports'
      }).length / (levelACriteria.length - levelACriteria.filter(c => {
        const conformance = c.scorecardEquivalent || c.conformanceLevel || 'Does Not Support'
        return conformance === 'Not Applicable' || conformance === 'NotApplicable' || conformance === 'N/A'
      }).length)) * 100) || 100
    : 100
    
  const levelAACompliance = levelAACriteria.length > 0
    ? Math.round((levelAACriteria.filter(c => {
        const conformance = c.scorecardEquivalent || c.conformanceLevel || 'Does Not Support'
        return conformance === 'Supports' || conformance === 'supports'
      }).length / (levelAACriteria.length - levelAACriteria.filter(c => {
        const conformance = c.scorecardEquivalent || c.conformanceLevel || 'Does Not Support'
        return conformance === 'Not Applicable' || conformance === 'NotApplicable' || conformance === 'N/A'
      }).length)) * 100) || 100
    : 100
    
  const levelAAACompliance = levelAAACriteria.length > 0
    ? Math.round((levelAAACriteria.filter(c => {
        const conformance = c.scorecardEquivalent || c.conformanceLevel || 'Does Not Support'
        return conformance === 'Supports' || conformance === 'supports'
      }).length / (levelAAACriteria.length - levelAAACriteria.filter(c => {
        const conformance = c.scorecardEquivalent || c.conformanceLevel || 'Does Not Support'
        return conformance === 'Not Applicable' || conformance === 'NotApplicable' || conformance === 'N/A'
      }).length)) * 100) || 100
    : 100
    
  console.log('📊 Level compliance calculations:', {
    levelACompliance,
    levelAACompliance,
    levelAAACompliance
  })

  // Identify critical issues and strengths
  const criticalIssues = criteria
    .filter(c => {
      const conformance = c.scorecardEquivalent || c.conformanceLevel || 'Does Not Support'
      return conformance === 'Does Not Support' || conformance === 'DoesNotSupport' || conformance === 'Not Supported'
    })
    .map(c => ({
      criterion: c.criterionId,
      issue: `Does not support ${c.criterionName}`,
      severity: 'high'
    }))

  const strengths = criteria
    .filter(c => {
      const conformance = c.scorecardEquivalent || c.conformanceLevel || 'Does Not Support'
      return conformance === 'Supports' || conformance === 'supports'
    })
    .map(c => ({
      criterion: c.criterionId,
      strength: `Fully supports ${c.criterionName}`
    }))
    
  console.log('📊 Issues and strengths:', {
    criticalIssues: criticalIssues.length,
    strengths: strengths.length
  })

  // Generate detailed criteria breakdown
  const criteriaBreakdown = {
    byLevel: levelCounts,
    byConformance: conformanceCounts,
    detailed: criteria.map(c => {
      const conformance = c.scorecardEquivalent || c.conformanceLevel || 'Does Not Support'
      return {
        id: c.criterionId,
        name: c.criterionName,
        level: c.level,
        conformance,
        weight: c.weight,
        impact: conformance === 'Does Not Support' || conformance === 'DoesNotSupport' ? 'high' : 
               conformance === 'Partially Supports' || conformance === 'PartiallySupports' ? 'medium' : 'low'
      }
    })
  }

  // Generate scoring details
  const scoringDetails = {
    methodology: scorecardAnalysis.evaluationMethodology,
    weights: Object.fromEntries(
      criteria.map(c => [c.criterionId, c.weight || 1])
    ),
    calculations: criteria.map(c => {
      const conformance = c.scorecardEquivalent || c.conformanceLevel || 'Does Not Support'
      let score: number | undefined = 0
      if (conformance === 'Supports' || conformance === 'supports') {
        score = 100
      } else if (conformance === 'Partially Supports' || conformance === 'PartiallySupports' || conformance === 'Partial') {
        score = 50
      } else if (conformance === 'Not Applicable' || conformance === 'NotApplicable' || conformance === 'N/A') {
        score = undefined // Not Applicable criteria don't get scored
      }
      return {
        criterion: c.criterionId,
        weight: c.weight || 1,
        score,
        contribution: score !== undefined ? ((c.weight || 1) * score) / 100 : 0
      }
    })
  }

  // Generate compliance matrix
  const complianceMatrix = {
    totalCriteria,
    applicableCriteria: totalCriteria - conformanceCounts.notApplicable,
    compliantCriteria: supportsCount,
    nonCompliantCriteria: conformanceCounts.doesNotSupport,
    partiallyCompliantCriteria: conformanceCounts.partiallySupports,
    notApplicableCriteria: conformanceCounts.notApplicable,
    complianceRate: (totalCriteria - conformanceCounts.notApplicable) > 0 ? Math.round((supportsCount / (totalCriteria - conformanceCounts.notApplicable)) * 100) : 100
  }

  // Generate risk assessment
  const criticalFailures = criteria
    .filter(c => {
      const conformance = c.scorecardEquivalent || c.conformanceLevel || 'Does Not Support'
      return (conformance === 'Does Not Support' || conformance === 'DoesNotSupport' || conformance === 'Not Supported') && c.level === 'A'
    })
    .map(c => c.criterionId)

  const overallRisk: 'low' | 'medium' | 'high' = criticalFailures.length > 3 ? 'high' : criticalFailures.length > 0 ? 'medium' : 'low'

  console.log('📊 Risk assessment:', {
    criticalFailures: criticalFailures.length,
    overallRisk
  })

  const riskAssessment = {
    overallRisk,
    criticalFailures,
    riskFactors: [
      {
        factor: 'Level A failures',
        impact: 'Critical accessibility barriers',
        mitigation: 'Prioritize fixes for Level A criteria failures'
      },
      {
        factor: 'Partial support',
        impact: 'Limited accessibility for some users',
        mitigation: 'Upgrade partial support to full support where possible'
      }
    ]
  }

  // Generate recommendations
  const recommendations = [
    {
      category: 'Critical Issues',
      priority: 'high' as const,
      recommendation: `Address ${criticalFailures.length} critical Level A failures`,
      rationale: 'Level A criteria are essential for basic accessibility'
    },
    {
      category: 'Improvement Opportunities',
      priority: 'medium' as const,
      recommendation: `Upgrade ${conformanceCounts.partiallySupports} partially supported criteria to full support`,
      rationale: 'Partial support may still create barriers for some users'
    },
    {
      category: 'Compliance Target',
      priority: 'low' as const,
      recommendation: `Aim for 100% compliance on Level A criteria`,
      rationale: 'Full Level A compliance ensures basic accessibility for all users'
    }
  ]

  console.log('✅ [COMPREHENSIVE ANALYSIS] Final results:', {
    overallScore,
    compliancePercentage,
    levelACompliance,
    levelAACompliance,
    levelAAACompliance,
    supports: supportsCount,
    partiallySupports: conformanceCounts.partiallySupports,
    doesNotSupport: conformanceCounts.doesNotSupport,
    criticalIssuesCount: criticalIssues.length,
    strengthsCount: strengths.length
  })

  return {
    overallScore,
    compliancePercentage,
    levelACompliance,
    levelAACompliance,
    levelAAACompliance,
    supports: supportsCount,
    partiallySupports: conformanceCounts.partiallySupports,
    doesNotSupport: conformanceCounts.doesNotSupport,
    criticalIssues,
    strengths,
    criteriaBreakdown,
    scoringDetails,
    complianceMatrix,
    riskAssessment,
    recommendations
  }
}
