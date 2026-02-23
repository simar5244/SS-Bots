import { WCAGCriterion } from './vpat-parser'

export interface NegligibleImpactResult {
  isNegligible: boolean
  reason?: string
  originalConformanceLevel?: string
  overriddenToSupports: boolean
}

export class VPATNegligibleImpactHandler {
  
  private negligibleKeywords = [
    'negligible',
    'none',
    'no impact',
    'minimal',
    'not applicable',
    'n/a',
    'not relevant',
    'insignificant',
    'trivial',
    'zero impact',
    'does not apply'
  ]

  checkNegligibleImpact(
    criterion: WCAGCriterion,
    scorecardImpactColumn?: string
  ): NegligibleImpactResult {
    
    if (!scorecardImpactColumn) {
      return {
        isNegligible: false,
        overriddenToSupports: false
      }
    }

    const impactText = scorecardImpactColumn.toLowerCase().trim()
    
    const isNegligible = this.negligibleKeywords.some(keyword => 
      impactText.includes(keyword)
    )

    if (isNegligible) {
      return {
        isNegligible: true,
        reason: `Impact listed as "${scorecardImpactColumn}" - automatically marked as Supports`,
        originalConformanceLevel: criterion.conformanceLevel,
        overriddenToSupports: true
      }
    }

    return {
      isNegligible: false,
      overriddenToSupports: false
    }
  }

  applyNegligibleImpactOverride(
    criterion: WCAGCriterion,
    scorecardImpactColumn?: string
  ): WCAGCriterion {
    
    const negligibleCheck = this.checkNegligibleImpact(criterion, scorecardImpactColumn)

    if (negligibleCheck.overriddenToSupports) {
      return {
        ...criterion,
        conformanceLevel: 'Supports',
        scorecardEquivalent: 'Supports',
        remarks: criterion.remarks 
          ? `${criterion.remarks} | ${negligibleCheck.reason}`
          : negligibleCheck.reason
      }
    }

    return criterion
  }

  processAllCriteria(
    criteria: WCAGCriterion[],
    scorecardImpactMap?: Map<string, string>
  ): {
    processedCriteria: WCAGCriterion[]
    overriddenCount: number
    overriddenCriteria: Array<{
      criterionId: string
      criterionName: string
      originalLevel: string
      impactReason: string
    }>
  } {
    const processedCriteria: WCAGCriterion[] = []
    const overriddenCriteria: Array<{
      criterionId: string
      criterionName: string
      originalLevel: string
      impactReason: string
    }> = []

    criteria.forEach(criterion => {
      const impactValue = scorecardImpactMap?.get(criterion.criterionId)
      const processed = this.applyNegligibleImpactOverride(criterion, impactValue)
      
      if (processed.conformanceLevel !== criterion.conformanceLevel) {
        overriddenCriteria.push({
          criterionId: criterion.criterionId,
          criterionName: criterion.criterionName,
          originalLevel: criterion.conformanceLevel,
          impactReason: impactValue || 'Unknown'
        })
      }

      processedCriteria.push(processed)
    })

    return {
      processedCriteria,
      overriddenCount: overriddenCriteria.length,
      overriddenCriteria
    }
  }
}

export const vpatNegligibleImpactHandler = new VPATNegligibleImpactHandler()
