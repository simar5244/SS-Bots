/**
 * VPAT EXCEL GENERATOR
 * 
 * Generates a complete 9-sheet Excel workbook matching TTU VPAT SCORECARD.xlsx structure
 * 
 * SHEET STRUCTURE:
 * 1. Overview - Resource details and metadata
 * 2. Criteria Breakdown - All criteria with support status (Supports/Partially/Not/Not Applicable)
 * 3. WCAG 2.1 Score - Weighted scoring for WCAG 2.1
 * 4. WCAG 2.2 Score - Weighted scoring for WCAG 2.2
 * 5. WCAG 2.0 Score - Weighted scoring for WCAG 2.0
 * 6. Overall Grade - Grade definitions and approval terms
 * 7. Disabilities Impacted - Impact analysis by disability type
 * 8. Misc - Risk assessment and additional metrics
 * 9. Contact Vendor - Vendor contact information
 */

import ExcelJS from 'exceljs'

// Grade definitions for scorecard
const GRADE_DEFINITIONS = [
  { grade: 'A+', name: 'Excellent', parameters: '95-100%', term: 'Approved' },
  { grade: 'A', name: 'Very Good', parameters: '90-94%', term: 'Approved' },
  { grade: 'B+', name: 'Good', parameters: '85-89%', term: 'Approved with Conditions' },
  { grade: 'B', name: 'Above Average', parameters: '80-84%', term: 'Approved with Conditions' },
  { grade: 'C+', name: 'Average', parameters: '75-79%', term: 'Conditional Approval' },
  { grade: 'C', name: 'Below Average', parameters: '70-74%', term: 'Conditional Approval' },
  { grade: 'D', name: 'Poor', parameters: '60-69%', term: 'Not Approved' },
  { grade: 'F', name: 'Failing', parameters: '0-59%', term: 'Not Approved' }
]

// Risk definitions
const RISK_DEFINITIONS = [
  { condition: 'High Impact + High Cost', level: 'Critical Risk' },
  { condition: 'High Impact + Low Cost', level: 'High Priority' },
  { condition: 'Low Impact + High Cost', level: 'Medium Priority' },
  { condition: 'Low Impact + Low Cost', level: 'Low Priority' }
]

// Disability criteria mapping (placeholder - not used in current implementation)
const DISABILITY_CRITERIA_MAPPING: any = {}

export interface ExcelDashboardData {
  // Tab 1: Overview
  overview: {
    productName: string
    vendorName?: string
    url?: string
    vpatVersion?: string
    dateOfVPAT?: string
    scoredBy?: string
    dateGraded?: string
    annualCost?: number
    studentsAnnually?: number
    employeesAnnually?: number
    publicAccess?: boolean
    confidenceLevel?: string
    manualTesting?: boolean
  }
  
  // Tab 2: Criteria Breakdown
  criteriaBreakdown: Array<{
    criterionId: string
    criterionName: string
    level: string
    impact: string
    conformanceLevel: string
    remarks?: string
    wcag20: boolean
    wcag21: boolean
    wcag22: boolean
  }>
  
  // Tab 3: WCAG 2.1 Score
  wcag21Score: {
    extremelyImportant: {
      notSupported: number
      partiallySupports: number
      supports: number
      total: number
    }
    somewhatImportant: {
      notSupported: number
      partiallySupports: number
      supports: number
      total: number
    }
    standard: {
      notSupported: number
      partiallySupports: number
      supports: number
      total: number
    }
    totals: {
      notSupported: number
      partiallySupports: number
      supports: number
      total: number
    }
    score: {
      perfectScore: number
      actualScore: number
      percentage: number
      grade: string
    }
  }
  
  // Tab 4: WCAG 2.2 Score
  wcag22Score: {
    extremelyImportant: {
      notSupported: number
      partiallySupports: number
      supports: number
      total: number
    }
    somewhatImportant: {
      notSupported: number
      partiallySupports: number
      supports: number
      total: number
    }
    standard: {
      notSupported: number
      partiallySupports: number
      supports: number
      total: number
    }
    totals: {
      notSupported: number
      partiallySupports: number
      supports: number
      total: number
    }
    score: {
      perfectScore: number
      actualScore: number
      percentage: number
      grade: string
    }
  }
  
  // Tab 5: WCAG 2.0 Score
  wcag20Score?: {
    extremelyImportant: {
      notSupported: number
      partiallySupports: number
      supports: number
      total: number
    }
    somewhatImportant: {
      notSupported: number
      partiallySupports: number
      supports: number
      total: number
    }
    standard: {
      notSupported: number
      partiallySupports: number
      supports: number
      total: number
    }
    totals: {
      notSupported: number
      partiallySupports: number
      supports: number
      total: number
    }
    score: {
      perfectScore: number
      actualScore: number
      percentage: number
      grade: string
    }
  }
  
  // Tab 6: Overall Grade
  overallGrade: {
    grade: string
    gradeName: string
    parameters: string
    term: string
    meetsRequirements: boolean
  }
  
  // Tab 7: Disabilities Impacted
  disabilitiesImpacted: Array<{
    disability: string
    totalCriteria: number
    supportedCriteria: number
    percentageSupported: number
    status: string
    unsupportedCriteria: string[]
  }>
  
  // Tab 8: Misc/Risk
  misc: {
    riskLevel: string
    riskCondition: string
    userCount: number
    publicAccess: boolean
    annualCost: number
  }
  
  // Tab 9: Contact Vendor
  contactVendor: {
    productName: string
    vendorName?: string
    url?: string
    contactEmail?: string
    contactPhone?: string
    supportUrl?: string
  }
}

export class VPATExcelGenerator {
  
  async generateExcel(data: ExcelDashboardData): Promise<Buffer> {
    console.log('📊 [EXCEL GENERATOR] Starting Excel generation with 9 sheets...')
    
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'VPAT Scorecard System'
    workbook.created = new Date()
    
    // Generate all 9 sheets
    await this.createOverviewSheet(workbook, data)
    await this.createCriteriaBreakdownSheet(workbook, data)
    await this.createWCAG21ScoreSheet(workbook, data)
    await this.createWCAG22ScoreSheet(workbook, data)
    await this.createWCAG20ScoreSheet(workbook, data)
    await this.createOverallGradeSheet(workbook, data)
    await this.createDisabilitiesImpactedSheet(workbook, data)
    await this.createMiscSheet(workbook, data)
    await this.createContactVendorSheet(workbook, data)
    
    console.log('✅ [EXCEL GENERATOR] All 9 sheets created successfully')
    
    const buffer = await workbook.xlsx.writeBuffer()
    console.log(`📦 [EXCEL GENERATOR] Excel file generated: ${buffer.length} bytes`)
    
    return Buffer.from(buffer)
  }
  
  private async createOverviewSheet(workbook: ExcelJS.Workbook, data: ExcelDashboardData) {
    console.log('📄 [EXCEL GENERATOR] Creating Tab 1: Overview...')
    
    const sheet = workbook.addWorksheet('Overview')
    
    // Header styling
    const headerStyle = {
      font: { bold: true, size: 12 },
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9E1F2' } }
    }
    
    // Resource Details
    sheet.addRow(['VPAT SCORECARD - RESOURCE DETAILS']).font = { bold: true, size: 14 }
    sheet.addRow([])
    sheet.addRow(['Product Name:', data.overview.productName])
    sheet.addRow(['Vendor Name:', data.overview.vendorName || 'N/A'])
    sheet.addRow(['URL:', data.overview.url || 'N/A'])
    sheet.addRow(['VPAT Version:', data.overview.vpatVersion || 'N/A'])
    sheet.addRow(['Date of VPAT:', data.overview.dateOfVPAT || 'N/A'])
    sheet.addRow(['Scored By:', data.overview.scoredBy || 'Automated System'])
    sheet.addRow(['Date Graded:', data.overview.dateGraded || new Date().toISOString().split('T')[0]])
    sheet.addRow([])
    
    // Usage Details
    sheet.addRow(['USAGE DETAILS']).font = { bold: true, size: 12 }
    sheet.addRow([])
    sheet.addRow(['Annual Cost:', data.overview.annualCost || 0])
    sheet.addRow(['Students Annually:', data.overview.studentsAnnually || 0])
    sheet.addRow(['Employees Annually:', data.overview.employeesAnnually || 0])
    sheet.addRow(['Public Access:', data.overview.publicAccess ? 'Yes' : 'No'])
    sheet.addRow(['Manual Testing Included:', data.overview.manualTesting ? 'Yes' : 'No'])
    sheet.addRow(['Confidence Level:', data.overview.confidenceLevel || 'Medium'])
    
    // Column widths
    sheet.getColumn(1).width = 30
    sheet.getColumn(2).width = 50
    
    console.log('✅ [EXCEL GENERATOR] Tab 1: Overview created')
  }
  
  private async createCriteriaBreakdownSheet(workbook: ExcelJS.Workbook, data: ExcelDashboardData) {
    console.log('📄 [EXCEL GENERATOR] Creating Tab 2: Criteria Breakdown...')
    
    const sheet = workbook.addWorksheet('Criteria Breakdown')
    
    // Headers
    const headers = ['Criterion ID', 'Criterion Name', 'Level', 'Impact', 'Conformance Level', 'WCAG 2.0', 'WCAG 2.1', 'WCAG 2.2', 'Remarks']
    const headerRow = sheet.addRow(headers)
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    
    // Add criteria data
    for (const criterion of data.criteriaBreakdown) {
      sheet.addRow([
        criterion.criterionId,
        criterion.criterionName,
        criterion.level,
        criterion.impact,
        criterion.conformanceLevel,
        criterion.wcag20 ? '✓' : '',
        criterion.wcag21 ? '✓' : '',
        criterion.wcag22 ? '✓' : '',
        criterion.remarks || ''
      ])
    }
    
    // Column widths
    sheet.getColumn(1).width = 15
    sheet.getColumn(2).width = 50
    sheet.getColumn(3).width = 10
    sheet.getColumn(4).width = 20
    sheet.getColumn(5).width = 20
    sheet.getColumn(6).width = 12
    sheet.getColumn(7).width = 12
    sheet.getColumn(8).width = 12
    sheet.getColumn(9).width = 40
    
    console.log(`✅ [EXCEL GENERATOR] Tab 2: Criteria Breakdown created with ${data.criteriaBreakdown.length} criteria`)
  }
  
  private async createWCAG21ScoreSheet(workbook: ExcelJS.Workbook, data: ExcelDashboardData) {
    console.log('📄 [EXCEL GENERATOR] Creating Tab 3: WCAG 2.1 Score...')
    
    const sheet = workbook.addWorksheet('WCAG 2.1 Score')
    
    // Title
    sheet.addRow(['WCAG 2.1 WEIGHTED SCORE']).font = { bold: true, size: 14 }
    sheet.addRow([])
    
    // Headers
    const headerRow = sheet.addRow(['Impact Category', 'Not Supported/Not Evaluated', 'Partially Supports', 'Supports', 'Total Success Criteria'])
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
    
    // Data rows
    sheet.addRow([
      'Extremely Important',
      data.wcag21Score.extremelyImportant.notSupported,
      data.wcag21Score.extremelyImportant.partiallySupports,
      data.wcag21Score.extremelyImportant.supports,
      data.wcag21Score.extremelyImportant.total
    ])
    
    sheet.addRow([
      'Somewhat Important',
      data.wcag21Score.somewhatImportant.notSupported,
      data.wcag21Score.somewhatImportant.partiallySupports,
      data.wcag21Score.somewhatImportant.supports,
      data.wcag21Score.somewhatImportant.total
    ])
    
    sheet.addRow([
      'Standard',
      data.wcag21Score.standard.notSupported,
      data.wcag21Score.standard.partiallySupports,
      data.wcag21Score.standard.supports,
      data.wcag21Score.standard.total
    ])
    
    const totalsRow = sheet.addRow([
      'Success Criteria Totals',
      data.wcag21Score.totals.notSupported,
      data.wcag21Score.totals.partiallySupports,
      data.wcag21Score.totals.supports,
      data.wcag21Score.totals.total
    ])
    totalsRow.font = { bold: true }
    
    // Scoring section
    sheet.addRow([])
    sheet.addRow(['SCORING']).font = { bold: true, size: 12 }
    sheet.addRow(['Perfect Score:', data.wcag21Score.score.perfectScore])
    sheet.addRow(['Actual Score:', data.wcag21Score.score.actualScore])
    sheet.addRow(['Percentage:', `${data.wcag21Score.score.percentage}%`])
    sheet.addRow(['Grade:', data.wcag21Score.score.grade])
    
    // Column widths
    sheet.getColumn(1).width = 30
    sheet.getColumn(2).width = 30
    sheet.getColumn(3).width = 20
    sheet.getColumn(4).width = 15
    sheet.getColumn(5).width = 25
    
    console.log('✅ [EXCEL GENERATOR] Tab 3: WCAG 2.1 Score created')
  }
  
  private async createWCAG22ScoreSheet(workbook: ExcelJS.Workbook, data: ExcelDashboardData) {
    console.log('📄 [EXCEL GENERATOR] Creating Tab 4: WCAG 2.2 Score...')
    
    const sheet = workbook.addWorksheet('WCAG 2.2 Score')
    
    // Title
    sheet.addRow(['WCAG 2.2 WEIGHTED SCORE']).font = { bold: true, size: 14 }
    sheet.addRow([])
    
    // Headers
    const headerRow = sheet.addRow(['Impact Category', 'Not Supported/Not Evaluated', 'Partially Supports', 'Supports', 'Total Success Criteria'])
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
    
    // Data rows
    sheet.addRow([
      'Extremely Important',
      data.wcag22Score.extremelyImportant.notSupported,
      data.wcag22Score.extremelyImportant.partiallySupports,
      data.wcag22Score.extremelyImportant.supports,
      data.wcag22Score.extremelyImportant.total
    ])
    
    sheet.addRow([
      'Somewhat Important',
      data.wcag22Score.somewhatImportant.notSupported,
      data.wcag22Score.somewhatImportant.partiallySupports,
      data.wcag22Score.somewhatImportant.supports,
      data.wcag22Score.somewhatImportant.total
    ])
    
    sheet.addRow([
      'Standard',
      data.wcag22Score.standard.notSupported,
      data.wcag22Score.standard.partiallySupports,
      data.wcag22Score.standard.supports,
      data.wcag22Score.standard.total
    ])
    
    const totalsRow = sheet.addRow([
      'Success Criteria Totals',
      data.wcag22Score.totals.notSupported,
      data.wcag22Score.totals.partiallySupports,
      data.wcag22Score.totals.supports,
      data.wcag22Score.totals.total
    ])
    totalsRow.font = { bold: true }
    
    // Scoring section
    sheet.addRow([])
    sheet.addRow(['SCORING']).font = { bold: true, size: 12 }
    sheet.addRow(['Perfect Score:', data.wcag22Score.score.perfectScore])
    sheet.addRow(['Actual Score:', data.wcag22Score.score.actualScore])
    sheet.addRow(['Percentage:', `${data.wcag22Score.score.percentage}%`])
    sheet.addRow(['Grade:', data.wcag22Score.score.grade])
    
    // Column widths
    sheet.getColumn(1).width = 30
    sheet.getColumn(2).width = 30
    sheet.getColumn(3).width = 20
    sheet.getColumn(4).width = 15
    sheet.getColumn(5).width = 25
    
    console.log('✅ [EXCEL GENERATOR] Tab 4: WCAG 2.2 Score created')
  }
  
  private async createWCAG20ScoreSheet(workbook: ExcelJS.Workbook, data: ExcelDashboardData) {
    console.log('📄 [EXCEL GENERATOR] Creating Tab 5: WCAG 2.0 Score...')
    
    const sheet = workbook.addWorksheet('WCAG 2.0 Score')
    
    if (!data.wcag20Score) {
      sheet.addRow(['WCAG 2.0 scoring not available'])
      console.log('⚠️ [EXCEL GENERATOR] Tab 5: WCAG 2.0 Score - No data available')
      return
    }
    
    // Title
    sheet.addRow(['WCAG 2.0 WEIGHTED SCORE']).font = { bold: true, size: 14 }
    sheet.addRow([])
    
    // Headers
    const headerRow = sheet.addRow(['Impact Category', 'Not Supported/Not Evaluated', 'Partially Supports', 'Supports', 'Total Success Criteria'])
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
    
    // Data rows
    sheet.addRow([
      'Extremely Important',
      data.wcag20Score.extremelyImportant.notSupported,
      data.wcag20Score.extremelyImportant.partiallySupports,
      data.wcag20Score.extremelyImportant.supports,
      data.wcag20Score.extremelyImportant.total
    ])
    
    sheet.addRow([
      'Somewhat Important',
      data.wcag20Score.somewhatImportant.notSupported,
      data.wcag20Score.somewhatImportant.partiallySupports,
      data.wcag20Score.somewhatImportant.supports,
      data.wcag20Score.somewhatImportant.total
    ])
    
    sheet.addRow([
      'Standard',
      data.wcag20Score.standard.notSupported,
      data.wcag20Score.standard.partiallySupports,
      data.wcag20Score.standard.supports,
      data.wcag20Score.standard.total
    ])
    
    const totalsRow = sheet.addRow([
      'Success Criteria Totals',
      data.wcag20Score.totals.notSupported,
      data.wcag20Score.totals.partiallySupports,
      data.wcag20Score.totals.supports,
      data.wcag20Score.totals.total
    ])
    totalsRow.font = { bold: true }
    
    // Scoring section
    sheet.addRow([])
    sheet.addRow(['SCORING']).font = { bold: true, size: 12 }
    sheet.addRow(['Perfect Score:', data.wcag20Score.score.perfectScore])
    sheet.addRow(['Actual Score:', data.wcag20Score.score.actualScore])
    sheet.addRow(['Percentage:', `${data.wcag20Score.score.percentage}%`])
    sheet.addRow(['Grade:', data.wcag20Score.score.grade])
    
    // Column widths
    sheet.getColumn(1).width = 30
    sheet.getColumn(2).width = 30
    sheet.getColumn(3).width = 20
    sheet.getColumn(4).width = 15
    sheet.getColumn(5).width = 25
    
    console.log('✅ [EXCEL GENERATOR] Tab 5: WCAG 2.0 Score created')
  }
  
  private async createOverallGradeSheet(workbook: ExcelJS.Workbook, data: ExcelDashboardData) {
    console.log('📄 [EXCEL GENERATOR] Creating Tab 6: Overall Grade...')
    
    const sheet = workbook.addWorksheet('Overall Grade')
    
    // Title
    sheet.addRow(['OVERALL GRADE AND APPROVAL']).font = { bold: true, size: 14 }
    sheet.addRow([])
    
    // Current Grade
    sheet.addRow(['CURRENT GRADE']).font = { bold: true, size: 12 }
    sheet.addRow(['Grade:', data.overallGrade.grade])
    sheet.addRow(['Grade Name:', data.overallGrade.gradeName])
    sheet.addRow(['Parameters:', data.overallGrade.parameters])
    sheet.addRow(['Approval Term:', data.overallGrade.term])
    sheet.addRow(['Meets Requirements:', data.overallGrade.meetsRequirements ? 'Yes' : 'No'])
    sheet.addRow([])
    
    // Grade Logic Table
    sheet.addRow(['GRADE LOGIC TABLE']).font = { bold: true, size: 12 }
    sheet.addRow([])
    
    const headerRow = sheet.addRow(['Grade', 'Approval Name', 'Parameters', 'Term'])
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
    
    for (const grade of GRADE_DEFINITIONS) {
      sheet.addRow([grade.grade, grade.name, grade.parameters, grade.term])
    }
    
    // Column widths
    sheet.getColumn(1).width = 10
    sheet.getColumn(2).width = 30
    sheet.getColumn(3).width = 80
    sheet.getColumn(4).width = 20
    
    console.log('✅ [EXCEL GENERATOR] Tab 6: Overall Grade created')
  }
  
  private async createDisabilitiesImpactedSheet(workbook: ExcelJS.Workbook, data: ExcelDashboardData) {
    console.log('📄 [EXCEL GENERATOR] Creating Tab 7: Disabilities Impacted...')
    
    const sheet = workbook.addWorksheet('Disabilities Impacted')
    
    // Title
    sheet.addRow(['DISABILITIES IMPACTED BY UNSUPPORTED SUCCESS CRITERIA']).font = { bold: true, size: 14 }
    sheet.addRow([])
    
    // Headers
    const headerRow = sheet.addRow(['Population', 'Total Criteria', 'Criteria Supported', '% Supported', 'Status', 'Unsupported Criteria'])
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
    
    // Data rows
    for (const disability of data.disabilitiesImpacted) {
      sheet.addRow([
        disability.disability,
        disability.totalCriteria,
        disability.supportedCriteria,
        `${disability.percentageSupported}%`,
        disability.status,
        disability.unsupportedCriteria.join(', ')
      ])
    }
    
    // Column widths
    sheet.getColumn(1).width = 25
    sheet.getColumn(2).width = 15
    sheet.getColumn(3).width = 20
    sheet.getColumn(4).width = 15
    sheet.getColumn(5).width = 20
    sheet.getColumn(6).width = 60
    
    console.log(`✅ [EXCEL GENERATOR] Tab 7: Disabilities Impacted created with ${data.disabilitiesImpacted.length} disability types`)
  }
  
  private async createMiscSheet(workbook: ExcelJS.Workbook, data: ExcelDashboardData) {
    console.log('📄 [EXCEL GENERATOR] Creating Tab 8: Misc/Risk...')
    
    const sheet = workbook.addWorksheet('Misc')
    
    // Title
    sheet.addRow(['RISK ASSESSMENT AND ADDITIONAL METRICS']).font = { bold: true, size: 14 }
    sheet.addRow([])
    
    // Risk Assessment
    sheet.addRow(['RISK ASSESSMENT']).font = { bold: true, size: 12 }
    sheet.addRow(['Risk Level:', data.misc.riskLevel])
    sheet.addRow(['Risk Condition:', data.misc.riskCondition])
    sheet.addRow([])
    
    // Usage Metrics
    sheet.addRow(['USAGE METRICS']).font = { bold: true, size: 12 }
    sheet.addRow(['Total User Count:', data.misc.userCount])
    sheet.addRow(['Public Access:', data.misc.publicAccess ? 'Yes' : 'No'])
    sheet.addRow(['Annual Cost:', `$${data.misc.annualCost.toLocaleString()}`])
    sheet.addRow([])
    
    // Risk Logic Table
    sheet.addRow(['RISK LOGIC TABLE']).font = { bold: true, size: 12 }
    sheet.addRow([])
    
    const headerRow = sheet.addRow(['Condition', 'Risk Level'])
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
    
    for (const risk of RISK_DEFINITIONS) {
      sheet.addRow([risk.condition, risk.level])
    }
    
    // Column widths
    sheet.getColumn(1).width = 50
    sheet.getColumn(2).width = 20
    
    console.log('✅ [EXCEL GENERATOR] Tab 8: Misc/Risk created')
  }
  
  private async createContactVendorSheet(workbook: ExcelJS.Workbook, data: ExcelDashboardData) {
    console.log('📄 [EXCEL GENERATOR] Creating Tab 9: Contact Vendor...')
    
    const sheet = workbook.addWorksheet('Contact Vendor')
    
    // Title
    sheet.addRow(['VENDOR CONTACT INFORMATION']).font = { bold: true, size: 14 }
    sheet.addRow([])
    
    // Contact Details
    sheet.addRow(['Product Name:', data.contactVendor.productName])
    sheet.addRow(['Vendor Name:', data.contactVendor.vendorName || 'N/A'])
    sheet.addRow(['Product URL:', data.contactVendor.url || 'N/A'])
    sheet.addRow(['Contact Email:', data.contactVendor.contactEmail || 'N/A'])
    sheet.addRow(['Contact Phone:', data.contactVendor.contactPhone || 'N/A'])
    sheet.addRow(['Support URL:', data.contactVendor.supportUrl || 'N/A'])
    sheet.addRow([])
    
    // Additional Notes
    sheet.addRow(['NOTES']).font = { bold: true, size: 12 }
    sheet.addRow(['For accessibility inquiries, contact the vendor directly using the information above.'])
    sheet.addRow(['Ensure all accessibility concerns are documented and tracked.'])
    
    // Column widths
    sheet.getColumn(1).width = 25
    sheet.getColumn(2).width = 60
    
    console.log('✅ [EXCEL GENERATOR] Tab 9: Contact Vendor created')
  }
}

export const vpatExcelGenerator = new VPATExcelGenerator()
