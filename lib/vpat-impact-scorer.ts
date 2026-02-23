import { VPATMetadata, WCAGCriterion } from './vpat-parser'

export interface ImpactFactors {
  numberOfStudents?: number
  numberOfStaff?: number
  cost?: number
  documentDate?: string
  vpatVersion?: string
}

export interface WeightedImpactScore {
  baseScore: number
  weightedScore: number
  impactMultiplier: number
  breakdown: {
    criterionScore: number
    peopleImpactFactor: number
    costFactor: number
    staffFactor: number
    dateFactor: number
    versionFactor: number
  }
  priorityLevel: 'Critical' | 'High' | 'Medium' | 'Low'
  recommendation: string
}

export class VPATImpactScorer {
  
  calculateWeightedImpactScore(
    baseScore: number,
    criteriaCount: number,
    impactFactors?: ImpactFactors,
    metadata?: VPATMetadata
  ): WeightedImpactScore {
    
    if (!impactFactors || Object.keys(impactFactors).length === 0) {
      return {
        baseScore,
        weightedScore: baseScore,
        impactMultiplier: 1.0,
        breakdown: {
          criterionScore: baseScore,
          peopleImpactFactor: 1.0,
          costFactor: 1.0,
          staffFactor: 1.0,
          dateFactor: 0,
          versionFactor: 0
        },
        priorityLevel: this.determinePriorityLevel(baseScore, 1.0),
        recommendation: 'No impact factors provided. Using base criterion score only.'
      }
    }

    const studentsImpactFactor = this.calculateStudentsImpactFactor(impactFactors.numberOfStudents)
    const staffImpactFactor = this.calculateStaffImpactFactor(impactFactors.numberOfStaff)
    const costFactor = this.calculateCostFactor(impactFactors.cost)
    const dateFactor = this.calculateDateFactor(impactFactors.documentDate || metadata?.reportDate)

    const impactMultiplier = (
      studentsImpactFactor * 0.333 +
      staffImpactFactor * 0.333 +
      costFactor * 0.334
    )

    const weightedScore = baseScore * impactMultiplier

    const priorityLevel = this.determinePriorityLevel(baseScore, impactMultiplier)
    const recommendation = this.generateRecommendation(baseScore, weightedScore, impactFactors, priorityLevel)

    return {
      baseScore,
      weightedScore: Math.round(weightedScore * 100) / 100,
      impactMultiplier: Math.round(impactMultiplier * 100) / 100,
      breakdown: {
        criterionScore: baseScore,
        peopleImpactFactor: Math.round(studentsImpactFactor * 100) / 100,
        costFactor: Math.round(costFactor * 100) / 100,
        staffFactor: Math.round(staffImpactFactor * 100) / 100,
        dateFactor: 0,
        versionFactor: 0
      },
      priorityLevel,
      recommendation
    }
  }

  private calculateStudentsImpactFactor(numberOfStudents?: number): number {
    if (!numberOfStudents || numberOfStudents <= 0) return 1.0

    if (numberOfStudents < 10) return 0.5
    if (numberOfStudents < 100) return 0.7
    if (numberOfStudents < 1000) return 0.9
    if (numberOfStudents < 5000) return 1.1
    if (numberOfStudents < 10000) return 1.3
    if (numberOfStudents < 50000) return 1.6
    return 2.0
  }

  private calculateCostFactor(cost?: number): number {
    if (!cost || cost <= 0) return 1.0

    if (cost < 1000) return 0.6
    if (cost < 10000) return 0.8
    if (cost < 50000) return 1.0
    if (cost < 100000) return 1.2
    if (cost < 500000) return 1.5
    return 1.8
  }

  private calculateStaffImpactFactor(numberOfStaff?: number): number {
    if (!numberOfStaff || numberOfStaff <= 0) return 1.0

    if (numberOfStaff < 5) return 0.7
    if (numberOfStaff < 20) return 0.9
    if (numberOfStaff < 50) return 1.1
    if (numberOfStaff < 100) return 1.3
    return 1.5
  }

  private calculateDateFactor(documentDate?: string): number {
    if (!documentDate) return 1.0

    try {
      const date = new Date(documentDate)
      const now = new Date()
      const ageInMonths = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30)

      if (ageInMonths < 3) return 1.3
      if (ageInMonths < 6) return 1.2
      if (ageInMonths < 12) return 1.1
      if (ageInMonths < 24) return 1.0
      if (ageInMonths < 36) return 0.9
      return 0.7
    } catch {
      return 1.0
    }
  }


  private determinePriorityLevel(baseScore: number, impactMultiplier: number): 'Critical' | 'High' | 'Medium' | 'Low' {
    const weightedScore = baseScore * impactMultiplier

    if (baseScore < 50 && impactMultiplier >= 1.5) return 'Critical'
    if (baseScore < 60 && impactMultiplier >= 1.3) return 'Critical'
    if (baseScore < 70 && impactMultiplier >= 1.2) return 'High'
    if (baseScore < 80) return 'High'
    if (baseScore < 90) return 'Medium'
    return 'Low'
  }

  private generateRecommendation(
    baseScore: number,
    weightedScore: number,
    impactFactors: ImpactFactors,
    priorityLevel: string
  ): string {
    const recommendations: string[] = []

    if (priorityLevel === 'Critical') {
      recommendations.push('URGENT: This product requires immediate accessibility remediation.')
    } else if (priorityLevel === 'High') {
      recommendations.push('High priority: Address accessibility issues promptly.')
    }

    if (impactFactors.numberOfStudents && impactFactors.numberOfStudents > 10000) {
      recommendations.push(`Large student base (${impactFactors.numberOfStudents.toLocaleString()} students) significantly increases impact.`)
    }
    
    if (impactFactors.numberOfStaff && impactFactors.numberOfStaff > 100) {
      recommendations.push(`Significant staff impact (${impactFactors.numberOfStaff.toLocaleString()} staff members).`)
    }

    if (impactFactors.cost && impactFactors.cost > 100000) {
      recommendations.push(`High investment ($${impactFactors.cost.toLocaleString()}) warrants thorough accessibility review.`)
    }

    if (baseScore < 70) {
      recommendations.push('Consider alternative solutions or require vendor to improve accessibility before procurement.')
    } else if (baseScore < 85) {
      recommendations.push('Request vendor accessibility roadmap and timeline for improvements.')
    }

    return recommendations.join(' ') || 'Product meets basic accessibility requirements.'
  }
}

export const vpatImpactScorer = new VPATImpactScorer()
