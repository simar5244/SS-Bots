import { OpenAI } from 'openai'
import { WCAGCriterion, PlatformVersion } from './vpat-parser'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface PlatformVariationAnalysis {
  hasPlatformVariations: boolean
  detectedPlatforms: string[]
  criteriaWithVariations: Array<{
    criterionId: string
    criterionName: string
    level: string
    platformVersions: PlatformVersion[]
    defaultConformance?: string
  }>
  criteriaWithoutVariations: WCAGCriterion[]
}

export class VPATPlatformParser {
  
  async detectPlatformVariations(
    documentText: string,
    extractedCriteria: WCAGCriterion[]
  ): Promise<PlatformVariationAnalysis> {
    
    console.log('🔍 [PLATFORM PARSER] Starting platform variation detection...')
    
    const detectionPrompt = `Analyze this VPAT document to determine if it contains platform-specific variations for accessibility criteria.

Look for patterns like:
- "Web: Supports, Desktop: Partially Supports, Mobile: Does Not Support"
- Separate columns or sections for different platforms (Web, Desktop, Mobile, iOS, Android, etc.)
- Criteria where conformance varies by platform/environment
- Platform-specific remarks or notes (e.g., "Portrait mode only on desktop", "Landscape not available on mobile")

Document excerpt (first 25000 characters):
${documentText.substring(0, 25000)}

Return JSON:
{
  "hasPlatformVariations": boolean,
  "detectedPlatforms": ["Web", "Desktop", "Mobile", "iOS", "Android"] (list all detected platforms),
  "variationPattern": "Description of how platforms are distinguished in the document",
  "exampleCriteria": [
    {
      "criterionId": "1.3.4",
      "platforms": {
        "Web": "Supports",
        "Desktop": "Partially Supports"
      }
    }
  ]
}`

    try {
      const detectionResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert at analyzing VPAT documents and identifying platform-specific accessibility variations. Return only valid JSON.' 
          },
          { role: 'user', content: detectionPrompt }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })

      const detection = JSON.parse(detectionResponse.choices[0].message.content || '{}')
      console.log('📊 [PLATFORM PARSER] Detection result:', {
        hasPlatformVariations: detection.hasPlatformVariations,
        platforms: detection.detectedPlatforms,
        pattern: detection.variationPattern
      })

      if (!detection.hasPlatformVariations || !detection.detectedPlatforms || detection.detectedPlatforms.length === 0) {
        return {
          hasPlatformVariations: false,
          detectedPlatforms: [],
          criteriaWithVariations: [],
          criteriaWithoutVariations: extractedCriteria
        }
      }

      const extractionResult = await this.extractPlatformSpecificCriteria(
        documentText,
        extractedCriteria,
        detection.detectedPlatforms
      )

      console.log('✅ [PLATFORM PARSER] Extraction complete:', {
        criteriaWithVariations: extractionResult.criteriaWithVariations.length,
        criteriaWithoutVariations: extractionResult.criteriaWithoutVariations.length
      })

      return {
        hasPlatformVariations: true,
        detectedPlatforms: detection.detectedPlatforms,
        ...extractionResult
      }

    } catch (error) {
      console.error('❌ [PLATFORM PARSER] Detection error:', error)
      return {
        hasPlatformVariations: false,
        detectedPlatforms: [],
        criteriaWithVariations: [],
        criteriaWithoutVariations: extractedCriteria
      }
    }
  }

  private async extractPlatformSpecificCriteria(
    documentText: string,
    extractedCriteria: WCAGCriterion[],
    platforms: string[]
  ): Promise<{
    criteriaWithVariations: Array<{
      criterionId: string
      criterionName: string
      level: string
      platformVersions: PlatformVersion[]
      defaultConformance?: string
    }>
    criteriaWithoutVariations: WCAGCriterion[]
  }> {
    
    console.log(`🔍 [PLATFORM PARSER] Extracting platform-specific data for ${extractedCriteria.length} criteria across ${platforms.length} platforms...`)
    
    const extractionPrompt = `This VPAT document contains platform-specific variations across these platforms: ${platforms.join(', ')}.

Document text:
${documentText.substring(0, 40000)}

For EACH of the following criteria, determine if it has platform-specific variations:

Criteria to analyze:
${extractedCriteria.map(c => `${c.criterionId}: ${c.criterionName} (Level ${c.level})`).join('\n')}

For each criterion:
1. If it has the SAME conformance level across ALL platforms, mark it as "uniform"
2. If it has DIFFERENT conformance levels for different platforms, extract each platform's specific conformance

Return JSON:
{
  "criteriaWithVariations": [
    {
      "criterionId": "1.3.4",
      "criterionName": "Orientation",
      "level": "AA",
      "platformVersions": [
        {
          "platform": "Web",
          "conformanceLevel": "Supports",
          "remarks": "Both portrait and landscape supported",
          "pageNumber": 12,
          "excerpt": "Web version supports all orientations",
          "confidence": 95
        },
        {
          "platform": "Desktop",
          "conformanceLevel": "Partially Supports",
          "remarks": "Only portrait mode available",
          "pageNumber": 12,
          "excerpt": "Desktop application limited to portrait",
          "confidence": 90
        }
      ]
    }
  ],
  "criteriaWithoutVariations": [
    {
      "criterionId": "1.1.1",
      "criterionName": "Non-text Content",
      "level": "A",
      "conformanceLevel": "Supports",
      "remarks": "All platforms support text alternatives",
      "pageNumber": 8
    }
  ]
}

IMPORTANT: 
- Only include criteria in "criteriaWithVariations" if they truly have DIFFERENT conformance levels across platforms
- Include ALL platforms for criteria with variations (${platforms.join(', ')})
- Be precise about conformance levels: "Supports", "Partially Supports", "Does Not Support", "Not Applicable", "Not Evaluated"`

    try {
      const extractionResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: `You are extracting platform-specific VPAT data. Be thorough and accurate. Only mark criteria as having variations if they truly differ across platforms.` 
          },
          { role: 'user', content: extractionPrompt }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      })

      const result = JSON.parse(extractionResponse.choices[0].message.content || '{}')
      
      console.log('📥 [PLATFORM PARSER] Extraction result:', {
        criteriaWithVariations: result.criteriaWithVariations?.length || 0,
        criteriaWithoutVariations: result.criteriaWithoutVariations?.length || 0
      })

      const criteriaWithVariations = (result.criteriaWithVariations || []).map((c: any) => ({
        criterionId: c.criterionId,
        criterionName: c.criterionName,
        level: c.level,
        platformVersions: (c.platformVersions || []).map((pv: any) => ({
          platform: pv.platform,
          conformanceLevel: pv.conformanceLevel,
          scorecardEquivalent: this.mapToScorecardEquivalent(pv.conformanceLevel),
          remarks: pv.remarks,
          pageNumber: pv.pageNumber,
          excerpt: pv.excerpt,
          confidence: pv.confidence
        })),
        defaultConformance: c.defaultConformance
      }))

      const criteriaWithoutVariations = (result.criteriaWithoutVariations || []).map((c: any) => ({
        criterionId: c.criterionId,
        criterionName: c.criterionName,
        level: c.level,
        conformanceLevel: c.conformanceLevel,
        scorecardEquivalent: this.mapToScorecardEquivalent(c.conformanceLevel),
        remarks: c.remarks,
        pageNumber: c.pageNumber,
        excerpt: c.excerpt,
        confidence: c.confidence
      }))

      return {
        criteriaWithVariations,
        criteriaWithoutVariations
      }

    } catch (error) {
      console.error('❌ [PLATFORM PARSER] Extraction error:', error)
      return {
        criteriaWithVariations: [],
        criteriaWithoutVariations: extractedCriteria
      }
    }
  }

  mergePlatformVariationsIntoCriteria(
    platformAnalysis: PlatformVariationAnalysis
  ): WCAGCriterion[] {
    console.log('🔄 [PLATFORM PARSER] Merging platform variations into criteria...')
    
    const mergedCriteria: WCAGCriterion[] = []

    platformAnalysis.criteriaWithVariations.forEach(criterion => {
      const mostCommonConformance = this.getMostCommonConformance(criterion.platformVersions)
      
      mergedCriteria.push({
        criterionId: criterion.criterionId,
        criterionName: criterion.criterionName,
        level: criterion.level,
        conformanceLevel: mostCommonConformance,
        scorecardEquivalent: this.mapToScorecardEquivalent(mostCommonConformance),
        remarks: `Platform variations detected: ${criterion.platformVersions.map(pv => `${pv.platform}: ${pv.conformanceLevel}`).join(', ')}`,
        platformVersions: criterion.platformVersions,
        hasPlatformVariations: true
      })
    })

    platformAnalysis.criteriaWithoutVariations.forEach(criterion => {
      mergedCriteria.push({
        ...criterion,
        hasPlatformVariations: false
      })
    })

    console.log('✅ [PLATFORM PARSER] Merge complete:', {
      totalCriteria: mergedCriteria.length,
      withVariations: mergedCriteria.filter(c => c.hasPlatformVariations).length,
      withoutVariations: mergedCriteria.filter(c => !c.hasPlatformVariations).length
    })

    return mergedCriteria
  }

  private getMostCommonConformance(platformVersions: PlatformVersion[]): 'Supports' | 'Partially Supports' | 'Does Not Support' | 'Not Applicable' | 'Not Evaluated' {
    const conformanceCounts = new Map<string, number>()
    
    platformVersions.forEach(pv => {
      const count = conformanceCounts.get(pv.conformanceLevel) || 0
      conformanceCounts.set(pv.conformanceLevel, count + 1)
    })

    let maxCount = 0
    let mostCommon: any = 'Not Evaluated'
    
    conformanceCounts.forEach((count, conformance) => {
      if (count > maxCount) {
        maxCount = count
        mostCommon = conformance
      }
    })

    const priority = ['Supports', 'Partially Supports', 'Does Not Support', 'Not Applicable', 'Not Evaluated']
    const conformanceArray = Array.from(conformanceCounts.keys())
    
    for (const level of priority) {
      if (conformanceArray.includes(level)) {
        return level as any
      }
    }

    return mostCommon
  }

  private mapToScorecardEquivalent(conformanceLevel: string): 'Supports' | 'Partially Supports' | 'Does Not Support' | 'Not Applicable' {
    if (conformanceLevel === 'Not Applicable') return 'Not Applicable'
    if (conformanceLevel === 'Not Evaluated') return 'Does Not Support'
    if (conformanceLevel === 'Supports') return 'Supports'
    if (conformanceLevel === 'Partially Supports') return 'Partially Supports'
    return 'Does Not Support'
  }

  generatePlatformComparisonReport(
    criteriaWithVariations: Array<{
      criterionId: string
      criterionName: string
      level: string
      platformVersions: PlatformVersion[]
    }>,
    platforms: string[]
  ): {
    platformComparison: Array<{
      platform: string
      supports: number
      partiallySupports: number
      doesNotSupport: number
      notApplicable: number
      compliancePercentage: number
    }>
    criticalDifferences: Array<{
      criterionId: string
      criterionName: string
      level: string
      differences: string
      impact: 'high' | 'medium' | 'low'
    }>
  } {
    console.log('📊 [PLATFORM PARSER] Generating platform comparison report...')
    
    const platformStats = new Map<string, {
      supports: number
      partiallySupports: number
      doesNotSupport: number
      notApplicable: number
      total: number
    }>()

    platforms.forEach(platform => {
      platformStats.set(platform, {
        supports: 0,
        partiallySupports: 0,
        doesNotSupport: 0,
        notApplicable: 0,
        total: 0
      })
    })

    criteriaWithVariations.forEach(criterion => {
      criterion.platformVersions.forEach(pv => {
        const stats = platformStats.get(pv.platform)
        if (stats) {
          stats.total++
          if (pv.conformanceLevel === 'Supports') stats.supports++
          else if (pv.conformanceLevel === 'Partially Supports') stats.partiallySupports++
          else if (pv.conformanceLevel === 'Does Not Support') stats.doesNotSupport++
          else if (pv.conformanceLevel === 'Not Applicable') stats.notApplicable++
        }
      })
    })

    const platformComparison = platforms.map(platform => {
      const stats = platformStats.get(platform)!
      const applicableTotal = stats.total - stats.notApplicable
      const compliancePercentage = applicableTotal > 0 
        ? Math.round((stats.supports / applicableTotal) * 100) 
        : 100

      return {
        platform,
        supports: stats.supports,
        partiallySupports: stats.partiallySupports,
        doesNotSupport: stats.doesNotSupport,
        notApplicable: stats.notApplicable,
        compliancePercentage
      }
    })

    const criticalDifferences = criteriaWithVariations
      .filter(criterion => {
        const conformanceLevels = new Set(criterion.platformVersions.map(pv => pv.conformanceLevel))
        return conformanceLevels.size > 1
      })
      .map(criterion => {
        const hasSupports = criterion.platformVersions.some(pv => pv.conformanceLevel === 'Supports')
        const hasDoesNotSupport = criterion.platformVersions.some(pv => pv.conformanceLevel === 'Does Not Support')
        
        let impact: 'high' | 'medium' | 'low' = 'low'
        if (hasSupports && hasDoesNotSupport) impact = 'high'
        else if (criterion.level === 'A') impact = 'high'
        else if (criterion.level === 'AA') impact = 'medium'

        return {
          criterionId: criterion.criterionId,
          criterionName: criterion.criterionName,
          level: criterion.level,
          differences: criterion.platformVersions.map(pv => `${pv.platform}: ${pv.conformanceLevel}`).join(', '),
          impact
        }
      })
      .sort((a, b) => {
        const impactOrder = { high: 0, medium: 1, low: 2 }
        return impactOrder[a.impact] - impactOrder[b.impact]
      })

    console.log('✅ [PLATFORM PARSER] Comparison report generated:', {
      platforms: platformComparison.length,
      criticalDifferences: criticalDifferences.length
    })

    return {
      platformComparison,
      criticalDifferences
    }
  }
}

export const vpatPlatformParser = new VPATPlatformParser()
