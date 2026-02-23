import * as XLSX from 'xlsx'
import { VPATMetadata, WCAGCriterion } from './vpat-parser'
import { vpatNegligibleImpactHandler } from './vpat-negligible-impact-handler'
import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface ScorecardRow {
  criterionId: string
  criterionName: string
  level: string
  submittedConformance: string
  scorecardEquivalent: string
  remarks: string
  score: number
  status: 'Pass' | 'Fail' | 'Partial' | 'N/A'
  inReference?: boolean
  referenceRequirement?: string | null
  pageNumber?: number
  excerpt?: string
  confidence?: number
  hasPlatformVariations?: boolean
  platformVersions?: string
  // Dynamic columns from template
  [key: string]: any
}

export interface ComparativeAnalysis {
  overallScore: number
  compliancePercentage: number
  supports: number
  partiallySupports: number
  doesNotSupport: number
  notApplicable: number
  notEvaluated: number
  levelACompliance: number
  levelAACompliance: number
  levelAAACompliance: number
  criticalIssues: string[]
  strengths: string[]
  finalGrade?: string
  failedRules?: string[]
  scoringMethod?: string
}

export class ScorecardGenerator {
  
  /**
   * Generate comprehensive scorecard with tabular mapping
   */
  async generateDetailedScorecard(
    metadata: VPATMetadata,
    criteria: WCAGCriterion[],
    referenceScorecard?: any,
    submissionId?: string
  ): Promise<{
    rows: ScorecardRow[]
    analysis: ComparativeAnalysis
    excelBuffer: Buffer
    templateStructure?: any
    scoringSystem?: { [key: string]: number }
    scoringSheet?: string
    scoringInstructions?: string
  }> {
    // Parse reference scorecard if provided to get expected requirements and structure
    let referenceRequirements: Map<string, any> = new Map()
    let templateStructure: any = null
    
    if (referenceScorecard?.parsedStructure) {
      templateStructure = referenceScorecard.parsedStructure
      
      // Extract requirements from reference scorecard
      // Assuming reference has WCAG criteria IDs as keys
      const refData = Array.isArray(templateStructure) ? templateStructure : []
      refData.forEach((item: any) => {
        if (item.criterionId) {
          referenceRequirements.set(item.criterionId, item)
        }
      })
    }
    
    // Extract impact column data from reference scorecard for negligible impact detection
    const impactMap = new Map<string, string>()
    if (templateStructure && Array.isArray(templateStructure)) {
      templateStructure.forEach((item: any) => {
        if (item.criterionId && item.impact) {
          impactMap.set(item.criterionId, item.impact)
        }
      })
    }
    
    // Process criteria for negligible impact auto-support
    const { processedCriteria, overriddenCount, overriddenCriteria } = 
      vpatNegligibleImpactHandler.processAllCriteria(criteria, impactMap)
    
    if (overriddenCount > 0) {
      console.log(`[NEGLIGIBLE IMPACT] Auto-marked ${overriddenCount} criteria as Supports due to negligible impact`)
      overriddenCriteria.forEach(c => {
        console.log(`  - ${c.criterionId}: ${c.criterionName} (was ${c.originalLevel}, impact: ${c.impactReason})`)
      })
    }
    
    // Use AI to determine optimal column placement
    const aiColumnPlan = await this.optimizeColumnPlacement(templateStructure, processedCriteria)
    
    // Extract scoring system from template
    const scoringAnalysis = await this.extractScoringSystem(templateStructure)
    
    // Map each criterion to scorecard format, matching against reference
    const rows: ScorecardRow[] = processedCriteria.map(criterion => {
      const score = this.calculateScore(criterion.scorecardEquivalent, scoringAnalysis.scoringSystem)
      const status = this.determineStatus(criterion.scorecardEquivalent)
      
      // Check if this criterion exists in reference scorecard
      const refRequirement = referenceRequirements.get(criterion.criterionId)
      
      // Start with template columns
      const row: ScorecardRow = {
        criterionId: criterion.criterionId,
        criterionName: criterion.criterionName,
        level: criterion.level,
        submittedConformance: criterion.conformanceLevel,
        scorecardEquivalent: criterion.scorecardEquivalent,
        remarks: criterion.remarks || '',
        score,
        status,
        inReference: !!refRequirement,
        referenceRequirement: refRequirement?.requirement || null,
        pageNumber: criterion.pageNumber,
        excerpt: criterion.excerpt,
        confidence: criterion.confidence,
        hasPlatformVariations: criterion.hasPlatformVariations || false,
        platformVersions: criterion.hasPlatformVariations && criterion.platformVersions 
          ? criterion.platformVersions.map(pv => `${pv.platform}: ${pv.conformanceLevel}`).join('; ')
          : undefined
      }
      
      // Add any additional columns from template
      if (refRequirement) {
        Object.keys(refRequirement).forEach(key => {
          if (!['criterionId', 'criterionName', 'level', 'requirement'].includes(key)) {
            row[key] = refRequirement[key]
          }
        })
      }
      
      return row
    })

    // Generate comparative analysis with complex scoring
    const analysis = this.generateComparativeAnalysis(
      rows, 
      criteria,
      scoringAnalysis.weights,
      scoringAnalysis.minimumScores,
      scoringAnalysis.grades,
      scoringAnalysis.overallScoringMethod,
      scoringAnalysis.specialRules
    )

    // Generate Excel scorecard with reference mapping and AI-optimized structure
    const excelBuffer = this.generateExcelScorecard(
      metadata, 
      rows, 
      analysis, 
      referenceRequirements,
      aiColumnPlan,
      templateStructure,
      submissionId,
      scoringAnalysis.scoringSystem,
      scoringAnalysis.weights,
      scoringAnalysis.minimumScores,
      scoringAnalysis.grades,
      scoringAnalysis.scoringInstructions,
      scoringAnalysis.overallScoringMethod,
      scoringAnalysis.specialRules
    )

    return { rows, analysis, excelBuffer, templateStructure, ...scoringAnalysis }
  }

  /**
   * Use AI to determine optimal placement of AI columns in the template
   */
  private async optimizeColumnPlacement(
    templateStructure: any,
    criteria: WCAGCriterion[]
  ): Promise<{
    columnOrder: string[]
    aiColumns: string[]
    insertPositions: { column: string; position: 'before' | 'after' }[]
  }> {
    if (!templateStructure) {
      // Default structure if no template
      return {
        columnOrder: ['Criterion ID', 'Criterion Name', 'Level', 'Conformance', 'Score', 'Status', 'Page #', 'Excerpt', 'Reasoning', 'Confidence'],
        aiColumns: ['Page #', 'Excerpt', 'Reasoning', 'Confidence'],
        insertPositions: []
      }
    }

    // Analyze template structure
    const templateColumns = this.extractTemplateColumns(templateStructure)
    
    const prompt = `You are an expert in creating VPAT scorecards. I need to integrate AI analysis columns into an existing scorecard template.

Template columns: ${templateColumns.join(', ')}

AI analysis columns to add:
- Page # (the page number in the VPAT document)
- Excerpt (direct quote from the VPAT)
- Reasoning (AI explanation for the rating)
- Confidence (AI confidence score)

Please determine the optimal placement of these AI columns. Consider:
1. Logical flow (criteria info -> VPAT result -> AI evidence -> AI analysis)
2. User readability
3. Professional scorecard format

Return JSON:
{
  "columnOrder": ["complete ordered list of all columns including template and AI columns"],
  "aiColumns": ["Page #", "Excerpt", "Reasoning", "Confidence"],
  "insertPositions": [
    {"column": "Page #", "position": "before", "relativeTo": "Conformance"},
    {"column": "Excerpt", "position": "after", "relativeTo": "Page #"},
    {"column": "Reasoning", "position": "after", "relativeTo": "Excerpt"},
    {"column": "Confidence", "position": "after", "relativeTo": "Reasoning"}
  ]
}`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert in VPAT scorecard design. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })

      const result = JSON.parse(response.choices[0].message.content || '{}')
      return result
    } catch (error) {
      console.error('AI column placement error:', error)
      // Fallback to default placement
      return {
        columnOrder: [...templateColumns, 'Page #', 'Excerpt', 'Reasoning', 'Confidence'],
        aiColumns: ['Page #', 'Excerpt', 'Reasoning', 'Confidence'],
        insertPositions: templateColumns.map(col => ({
          column: col,
          position: 'before' as const,
          relativeTo: 'Page #'
        }))
      }
    }
  }

  /**
   * Extract column names from template structure
   */
  private extractTemplateColumns(templateStructure: any): string[] {
    if (!Array.isArray(templateStructure) || templateStructure.length === 0) {
      return ['Criterion ID', 'Criterion Name', 'Level', 'Conformance']
    }

    const firstRow = templateStructure[0]
    const columns = Object.keys(firstRow).filter(key => 
      !['criterionId', 'level'].includes(key)
    )

    // Map to human-readable column names
    const columnMap: { [key: string]: string } = {
      'criterionName': 'Criterion Name',
      'conformanceLevel': 'Conformance',
      'requirement': 'Requirement',
      'impact': 'Impact',
      'category': 'Category',
      'priority': 'Priority',
      'notes': 'Notes'
    }

    return ['Criterion ID', 'Criterion Name', 'Level', ...columns.map(col => columnMap[col] || col)]
  }

  /**
   * Extract comprehensive scoring system from uploaded scorecard template using AI
   */
  private async extractScoringSystem(templateStructure: any): Promise<{
    scoringSystem: { [key: string]: number }
    weights?: { [key: string]: number }
    minimumScores?: { [key: string]: number }
    grades?: { [key: string]: { min: number, max: number, label: string } }
    scoringInstructions?: string
    overallScoringMethod?: string
    specialRules?: string[]
  }> {
    const defaultScoring = {
      'Supports': 100,
      'Partially Supports': 50,
      'Does Not Support': 0,
      'Not Applicable': 0,
      'Not Evaluated': 0
    }

    if (!templateStructure) {
      return { scoringSystem: defaultScoring }
    }

    // Use AI to analyze the template and extract complex scoring rules
    const templateText = JSON.stringify(templateStructure, null, 2)
    
    const prompt = `Analyze this VPAT scorecard template and extract ALL scoring and grading requirements:

${templateText.substring(0, 15000)}

Look for and extract:
1. Individual criterion scoring (points for Supports, Partially Supports, Does Not Support, etc.)
2. Category or level weights (e.g., Level A criteria worth 50%, Level AA worth 30%, etc.)
3. Minimum score requirements (e.g., "Must score at least 80% on Level A criteria")
4. Grade thresholds (e.g., 90-100 = A, 80-89 = B, etc.)
5. Overall scoring method (weighted average, sum, special calculations)
6. Special rules or conditions (e.g., "All Level A criteria must be Supports")
7. Pass/fail criteria
8. Any bonus points or penalties

Return JSON with this structure:
{
  "scoringSystem": {"Supports": 100, "Partially Supports": 50, "Does Not Support": 0},
  "weights": {"Level A": 0.5, "Level AA": 0.3, "Level AAA": 0.2},
  "minimumScores": {"Level A": 80, "Overall": 70},
  "grades": {"A": {"min": 90, "max": 100, "label": "Excellent"}, "B": {"min": 80, "max": 89, "label": "Good"}},
  "overallScoringMethod": "Weighted average by level",
  "specialRules": ["All Level A criteria must be Supports to pass"],
  "scoringInstructions": "Detailed explanation of how scoring works..."
}

If no custom scoring is found, return the default scoring system.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are an expert at analyzing VPAT scoring systems and extracting complex grading requirements. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })

      const aiAnalysis = JSON.parse(response.choices[0].message.content || '{}')
      
      // Validate and merge with defaults
      const scoringSystem = { ...defaultScoring, ...aiAnalysis.scoringSystem }
      
      return {
        scoringSystem,
        weights: aiAnalysis.weights,
        minimumScores: aiAnalysis.minimumScores,
        grades: aiAnalysis.grades,
        scoringInstructions: aiAnalysis.scoringInstructions,
        overallScoringMethod: aiAnalysis.overallScoringMethod || 'Weighted average',
        specialRules: aiAnalysis.specialRules || []
      }
    } catch (error) {
      console.error('AI scoring analysis failed:', error)
      return { scoringSystem: defaultScoring }
    }
  }

  /**
   * Calculate numeric score for conformance level using extracted or default scoring
   */
  private calculateScore(conformance: string, scoringSystem?: { [key: string]: number }): number {
    const system = scoringSystem || {
      'Supports': 100,
      'Partially Supports': 50,
      'Does Not Support': 0,
      'Not Applicable': 0,
      'Not Evaluated': 0
    }
    return system[conformance] || 0
  }

  /**
   * Determine pass/fail status
   */
  private determineStatus(conformance: string): 'Pass' | 'Fail' | 'Partial' | 'N/A' {
    switch (conformance) {
      case 'Supports':
        return 'Pass'
      case 'Partially Supports':
        return 'Partial'
      case 'Does Not Support':
        return 'Fail'
      default:
        return 'N/A'
    }
  }

  /**
   * Generate comprehensive comparative analysis using complex scoring system
   */
  private generateComparativeAnalysis(
    rows: ScorecardRow[], 
    criteria: WCAGCriterion[],
    weights?: { [key: string]: number },
    minimumScores?: { [key: string]: number },
    grades?: { [key: string]: { min: number, max: number, label: string } },
    overallScoringMethod?: string,
    specialRules?: string[]
  ): ComparativeAnalysis {
    const totalCriteria = criteria.length
    
    // Filter to only evaluated criteria (exclude Not Applicable and Not Evaluated)
    const evaluatedCriteria = criteria.filter(c => 
      c.conformanceLevel !== 'Not Applicable' && 
      c.conformanceLevel !== 'Not Evaluated'
    )
    
    // Count conformance levels (only from evaluated criteria)
    const supports = evaluatedCriteria.filter(c => c.scorecardEquivalent === 'Supports').length
    const partiallySupports = evaluatedCriteria.filter(c => c.scorecardEquivalent === 'Partially Supports').length
    const doesNotSupport = evaluatedCriteria.filter(c => c.scorecardEquivalent === 'Does Not Support').length
    const notApplicable = criteria.filter(c => c.conformanceLevel === 'Not Applicable').length
    const notEvaluated = criteria.filter(c => c.conformanceLevel === 'Not Evaluated').length

    // Calculate overall score using the specified method
    let overallScore = 0
    if (overallScoringMethod === 'Weighted average' && weights) {
      // Calculate weighted average by level
      const levelScores: { [key: string]: { total: number, count: number } } = {}
      
      evaluatedCriteria.forEach(criterion => {
        const row = rows.find(r => r.criterionId === criterion.criterionId)
        if (row) {
          if (!levelScores[criterion.level]) {
            levelScores[criterion.level] = { total: 0, count: 0 }
          }
          levelScores[criterion.level].total += row.score
          levelScores[criterion.level].count++
        }
      })
      
      overallScore = Object.entries(levelScores).reduce((total, [level, scores]) => {
        const average = scores.count > 0 ? scores.total / scores.count : 0
        const weight = weights[level] || weights[`Level ${level}`] || 0
        return total + (average * weight)
      }, 0)
    } else {
      // Simple average
      const totalScore = evaluatedCriteria.reduce((sum, c) => {
        const row = rows.find(r => r.criterionId === c.criterionId)
        return sum + (row?.score || 0)
      }, 0)
      overallScore = evaluatedCriteria.length > 0 ? totalScore / evaluatedCriteria.length : 0
    }

    // Determine grade based on thresholds
    let finalGrade = 'N/A'
    if (grades) {
      for (const [grade, threshold] of Object.entries(grades)) {
        if (overallScore >= threshold.min && overallScore <= threshold.max) {
          finalGrade = grade
          break
        }
      }
    }

    // Check special rules
    const failedRules: string[] = []
    if (specialRules) {
      specialRules.forEach(rule => {
        if (rule.toLowerCase().includes('level a') && rule.toLowerCase().includes('must be supports')) {
          const levelAFailures = criteria.filter(c => 
            c.level === 'A' && c.scorecardEquivalent !== 'Supports'
          )
          if (levelAFailures.length > 0) {
            failedRules.push(`Failed: ${levelAFailures.length} Level A criteria not fully supported`)
          }
        }
        if (rule.toLowerCase().includes('minimum score')) {
          const match = rule.match(/(\d+)/)
          if (match) {
            const minRequired = parseInt(match[1])
            if (overallScore < minRequired) {
              failedRules.push(`Failed: Overall score ${overallScore.toFixed(1)} below minimum ${minRequired}`)
            }
          }
        }
      })
    }

    // Calculate compliance percentage (supports + 50% of partial, divided by total evaluated)
    const compliancePercentage = evaluatedCriteria.length > 0 
      ? Math.round(((supports + (partiallySupports * 0.5)) / evaluatedCriteria.length) * 100)
      : 0

    // Calculate level-specific compliance
    const levelACriteria = criteria.filter(c => c.level === 'A')
    const levelACompliance = this.calculateLevelCompliance(levelACriteria)
    
    const levelAACriteria = criteria.filter(c => c.level === 'AA')
    const levelAACompliance = this.calculateLevelCompliance(levelAACriteria)
    
    const levelAAACriteria = criteria.filter(c => c.level === 'AAA')
    const levelAAACompliance = this.calculateLevelCompliance(levelAAACriteria)

    // Generate critical issues and strengths
    const criticalIssues: string[] = []
    const strengths: string[] = []

    // Critical issues: Level A & AA failures
    criteria.filter(c => c.level === 'A' || c.level === 'AA').forEach(criterion => {
      if (criterion.scorecardEquivalent === 'Does Not Support') {
        criticalIssues.push(`${criterion.criterionId} - ${criterion.criterionName}: Does Not Support`)
      } else if (criterion.scorecardEquivalent === 'Partially Supports') {
        criticalIssues.push(`${criterion.criterionId} - ${criterion.criterionName}: Partially Supports`)
      }
    })

    // Strengths: Fully supported criteria
    criteria.filter(c => c.scorecardEquivalent === 'Supports').forEach(criterion => {
      strengths.push(`${criterion.criterionId} - ${criterion.criterionName}: Fully Supported`)
    })

    // Add failed rules to critical issues
    failedRules.forEach(rule => criticalIssues.push(rule))

    return {
      overallScore: Math.round(overallScore * 100) / 100, // Round to 2 decimal places
      compliancePercentage,
      supports,
      partiallySupports,
      doesNotSupport,
      notApplicable,
      notEvaluated,
      levelACompliance,
      levelAACompliance,
      levelAAACompliance: this.calculateLevelCompliance(criteria.filter(c => c.level === 'AAA')),
      criticalIssues,
      strengths,
      finalGrade,
      failedRules,
      scoringMethod: overallScoringMethod || 'Standard average'
    }

  }

  /**
   * Calculate compliance percentage for specific WCAG level
   */
  private calculateLevelCompliance(criteria: WCAGCriterion[]): number {
    if (criteria.length === 0) return 0
    
    // Only count criteria that are actually evaluated (not N/A or Not Evaluated)
    const evaluatedCriteria = criteria.filter(c => 
      c.conformanceLevel !== 'Not Applicable' && 
      c.conformanceLevel !== 'Not Evaluated'
    )
    
    if (evaluatedCriteria.length === 0) return 0
    
    const supports = evaluatedCriteria.filter(c => c.scorecardEquivalent === 'Supports').length
    const partiallySupports = evaluatedCriteria.filter(c => c.scorecardEquivalent === 'Partially Supports').length
    
    return Math.round(((supports + (partiallySupports * 0.5)) / evaluatedCriteria.length) * 100)
  }

  /**
   * Generate Excel scorecard matching reference format with AI-optimized structure
   */
  private generateExcelScorecard(
    metadata: VPATMetadata,
    rows: ScorecardRow[],
    analysis: ComparativeAnalysis,
    referenceRequirements?: Map<string, any>,
    aiColumnPlan?: any,
    templateStructure?: any,
    submissionId?: string,
    scoringSystem?: { [key: string]: number },
    weights?: { [key: string]: number },
    minimumScores?: { [key: string]: number },
    grades?: { [key: string]: { min: number, max: number, label: string } },
    scoringInstructions?: string,
    overallScoringMethod?: string,
    specialRules?: string[]
  ): Buffer {
    const workbook = XLSX.utils.book_new()

    // Sheet 1: Summary - Using same data source as UI frontend
    // Count directly from rows to match UI exactly
    const totalCriteria = rows.length
    const supportsCount = rows.filter(r => r.scorecardEquivalent === 'Supports').length
    const partiallySupportsCount = rows.filter(r => r.scorecardEquivalent === 'Partially Supports').length
    const doesNotSupportCount = rows.filter(r => r.scorecardEquivalent === 'Does Not Support').length
    const notApplicableCount = rows.filter(r => r.scorecardEquivalent === 'Not Applicable').length
    const notEvaluatedCount = rows.filter(r => r.scorecardEquivalent === 'Not Evaluated').length
    
    const summaryRows = [
      ['VPAT Evaluation Scorecard'],
      [''],
      ['Product Information'],
      ['Product Name', metadata.productName || 'N/A'],
      ['Vendor Name', metadata.vendorName || 'N/A'],
      ['VPAT Version', metadata.vpatVersion || 'N/A'],
      ['WCAG Version', metadata.wcagVersion || 'N/A'],
      ['WCAG Level', metadata.wcagLevel || 'N/A'],
      ['Report Date', metadata.reportDate || 'N/A']
    ]
    
    // Add platform information if this is a platform-specific report
    if ((metadata as any).platformVersion) {
      summaryRows.push(['Platform/Version', (metadata as any).platformVersion])
      summaryRows.push(['Note', `This report is specific to the ${(metadata as any).platformVersion} platform`])
    }
    
    summaryRows.push(
      [''],
      ['Overall Compliance Summary'],
      ['Overall Score', `${analysis.overallScore}/100`],
      ['Compliance Percentage', `${analysis.compliancePercentage}%`],
      ['Total Criteria', totalCriteria.toString()],
      ['Supports', supportsCount.toString()],
      ['Partially Supports', partiallySupportsCount.toString()],
      ['Does Not Support', doesNotSupportCount.toString()],
      ['Not Applicable', notApplicableCount.toString()],
      ['Not Evaluated', notEvaluatedCount.toString()],
      [''],
      ['Level-Specific Compliance'],
      ['Level A Compliance', `${analysis.levelACompliance}%`],
      ['Level AA Compliance', `${analysis.levelAACompliance}%`],
      ['Level AAA Compliance', `${analysis.levelAAACompliance}%`]
    )
    
    const metadataSheet = XLSX.utils.aoa_to_sheet(summaryRows)
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Summary')

    // Sheet 2: Comprehensive Scoring System
    if (scoringInstructions || weights || minimumScores || grades || specialRules) {
      const scoringData = [
        ['Comprehensive Scoring System'],
        [''],
        ['Scoring Method', overallScoringMethod || 'Standard scoring'],
        ['']
      ]

      // Individual criterion scoring
      if (scoringSystem) {
        scoringData.push(['Individual Criterion Scoring'])
        scoringData.push(['Conformance Level', 'Points'])
        Object.entries(scoringSystem).forEach(([level, points]) => {
          scoringData.push([level, points.toString()])
        })
        scoringData.push([''])
      }

      // Weights
      if (weights) {
        scoringData.push(['Category Weights'])
        scoringData.push(['Category', 'Weight'])
        Object.entries(weights).forEach(([category, weight]) => {
          scoringData.push([category, `${(weight * 100).toFixed(1)}%`])
        })
        scoringData.push([''])
      }

      // Minimum scores
      if (minimumScores) {
        scoringData.push(['Minimum Score Requirements'])
        scoringData.push(['Category', 'Minimum Score'])
        Object.entries(minimumScores).forEach(([category, minScore]) => {
          scoringData.push([category, minScore.toString()])
        })
        scoringData.push([''])
      }

      // Grade thresholds
      if (grades) {
        scoringData.push(['Grade Thresholds'])
        scoringData.push(['Grade', 'Min Score', 'Max Score', 'Label'])
        Object.entries(grades).forEach(([grade, threshold]) => {
          scoringData.push([grade, threshold.min.toString(), threshold.max.toString(), threshold.label])
        })
        scoringData.push([''])
      }

      // Special rules
      if (specialRules && specialRules.length > 0) {
        scoringData.push(['Special Rules'])
        specialRules.forEach((rule, index) => {
          scoringData.push([`${index + 1}. ${rule}`])
        })
        scoringData.push([''])
      }

      // Detailed instructions
      if (scoringInstructions) {
        scoringData.push(['Scoring Instructions'])
        scoringData.push([scoringInstructions])
      }

      const scoringSheetObj = XLSX.utils.aoa_to_sheet(scoringData)
      scoringSheetObj['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }]
      XLSX.utils.book_append_sheet(workbook, scoringSheetObj, 'Scoring System')
    }

    // Sheet 3: AI-Enhanced Detailed Criteria
    const columnOrder = aiColumnPlan?.columnOrder || [
      'Criterion ID', 'Criterion Name', 'Level', 'Conformance', 
      'Page #', 'Excerpt', 'Reasoning', 'Confidence', 'Score', 'Status'
    ]

    // Build data with AI-optimized column order
    const criteriaData = [columnOrder]
    rows.forEach(row => {
      const rowData: any[] = []
      columnOrder.forEach((column: string) => {
        switch (column) {
          case 'Criterion ID':
            rowData.push(row.criterionId)
            break
          case 'Criterion Name':
            rowData.push(row.criterionName)
            break
          case 'Level':
            rowData.push(row.level)
            break
          case 'Conformance':
            rowData.push(row.submittedConformance)
            break
          case 'Page #':
            if (row.pageNumber && typeof row.pageNumber === 'number') {
              // Create hyperlink with proper XLSX format
              rowData.push({
                v: `Page ${row.pageNumber}`,
                l: { Target: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/vpat/view/${submissionId}?page=${row.pageNumber}`, Tooltip: `View Page ${row.pageNumber}` }
              })
            } else {
              rowData.push('N/A')
            }
            break
          case 'Excerpt':
            rowData.push(row.excerpt || 'N/A')
            break
          case 'Reasoning':
            rowData.push(row.remarks || 'N/A')
            break
          case 'Confidence':
            rowData.push(row.confidence ? `${row.confidence}%` : 'N/A')
            break
          case 'Score':
            rowData.push(row.score)
            break
          case 'Status':
            rowData.push(row.status)
            break
          default:
            // Handle dynamic template columns
            rowData.push(row[column] || 'N/A')
        }
      })
      criteriaData.push(rowData)
    })

    const criteriaSheet = XLSX.utils.aoa_to_sheet(criteriaData)
    
    // Set column widths
    criteriaSheet['!cols'] = columnOrder.map((col: string) => {
      const widthMap: { [key: string]: number } = {
        'Criterion ID': 12,
        'Criterion Name': 30,
        'Level': 10,
        'Conformance': 20,
        'Page #': 8,
        'Excerpt': 50,
        'Reasoning': 60,
        'Confidence': 10,
        'Score': 8,
        'Status': 10
      }
      return { wch: widthMap[col] || 20 }
    })
    
    XLSX.utils.book_append_sheet(workbook, criteriaSheet, 'AI-Enhanced Scorecard')

    // Sheet 4: Original Template (if available)
    if (templateStructure && Array.isArray(templateStructure)) {
      const originalColumns = Object.keys(templateStructure[0])
      const originalData = [originalColumns]
      templateStructure.forEach((row: any) => {
        originalData.push(originalColumns.map(col => row[col] || ''))
      })
      
      const originalSheet = XLSX.utils.aoa_to_sheet(originalData)
      originalSheet['!cols'] = originalColumns.map(() => ({ wch: 20 }))
      XLSX.utils.book_append_sheet(workbook, originalSheet, 'Original Template')
    }

    // Sheet 5: Critical Issues
    const criticalIssuesData = [
      ['Critical Issues (Level A & AA)'],
      [''],
      ['Issue'],
      ...analysis.criticalIssues.map(issue => [issue])
    ]
    const criticalIssuesSheet = XLSX.utils.aoa_to_sheet(criticalIssuesData)
    criticalIssuesSheet['!cols'] = [{ wch: 80 }]
    XLSX.utils.book_append_sheet(workbook, criticalIssuesSheet, 'Critical Issues')

    // Sheet 6: Strengths
    const strengthsData = [
      ['Strengths (Fully Supported Criteria)'],
      [''],
      ['Criterion'],
      ...analysis.strengths.map(strength => [strength])
    ]
    const strengthsSheet = XLSX.utils.aoa_to_sheet(strengthsData)
    strengthsSheet['!cols'] = [{ wch: 80 }]
    XLSX.utils.book_append_sheet(workbook, strengthsSheet, 'Strengths')

    // Generate buffer
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  }

  /**
   * Generate level-by-level breakdown
   */
  private generateLevelBreakdown(rows: ScorecardRow[]): any[][] {
    const levels = ['A', 'AA', 'AAA']
    
    return levels.map(level => {
      const levelRows = rows.filter(r => r.level === level)
      const total = levelRows.length
      const supports = levelRows.filter(r => r.scorecardEquivalent === 'Supports').length
      const partiallySupports = levelRows.filter(r => r.scorecardEquivalent === 'Partially Supports').length
      const doesNotSupport = levelRows.filter(r => r.scorecardEquivalent === 'Does Not Support').length
      const compliance = total > 0 
        ? Math.round(((supports + (partiallySupports * 0.5)) / total) * 100)
        : 0
      
      return [level, total, supports, partiallySupports, doesNotSupport, `${compliance}%`]
    })
  }
}

export const scorecardGenerator = new ScorecardGenerator()
