'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import VPATCriteriaViewer from '@/components/VPATCriteriaViewer'
import { Download, ArrowLeft, CheckCircle, XCircle, AlertCircle, Clock, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { calculateScorecard, type ScorecardResult } from '@/lib/vpat-scorecard-calculator'
import * as XLSX from 'xlsx'

interface VPATSubmission {
  id: string
  vpatBotId: string
  batchId?: string // For grouping multiple VPAT submissions
  batchIndex?: number // Position in batch (0-based)
  submittedDocument: {
    fileName: string
    fileSize: number
    fileType: string
    uploadedAt: number
  }
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'needs_review'
  extractedData?: {
    vpatVersion?: string
    productName?: string
    vendorName?: string
    reportDate?: string
    wcagVersion?: string
    wcagLevel?: string
    criteria?: any[]
  }
  validationResults?: {
    isValid: boolean
    errors: string[]
    warnings: string[]
    missingFields: string[]
    scorecardCompliance?: {
      expectedCriteria: number
      extractedCriteria: number
      matchingCriteria: number
    }
  }
  generatedScorecard?: {
    fileName: string
    generatedAt: number
    downloadUrl?: string
    analysis?: {
      totalCriteria: number
      overallScore: number
      compliancePercentage: number
      verificationResult?: {
        hasMistakes: boolean
        mistakes: Array<{
          type: 'extraction' | 'scoring' | 'mapping' | 'calculation'
          description: string
          severity: 'low' | 'medium' | 'high'
          suggestedFix?: string
        }>
        confidence: number
        recommendations: string[]
      }
      scorecardAnalysis?: {
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
    }
  }
  detailedScorecard?: {
    rows: any[]
    analysis: any
    verificationResult?: {
      hasMistakes: boolean
      mistakes: Array<{
        type: 'extraction' | 'scoring' | 'mapping' | 'calculation'
        description: string
        severity: 'low' | 'medium' | 'high'
        suggestedFix?: string
      }>
      confidence: number
      recommendations: string[]
    }
    scorecardAnalysis?: {
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
  }
  aiAnalysis?: {
    summary: string
    confidence: number
    flaggedIssues: string[]
    recommendations: string[]
  }
  processingLog: Array<{
    timestamp: number
    step: string
    status: string
    details?: string
  }>
  impactFactors?: {
    numberOfStudents?: number
    numberOfStaff?: number
    cost?: number
    isPublicUse?: boolean
    documentDate?: string
    vpatVersion?: string
  }
  platformReports?: Array<{
    platform: string
    fileName: string
    analysis: any
    criteriaCount: number
    criteria?: any[]
  }>
  createdAt: number
  completedAt?: number
}

export default function VPATSubmissionDetail() {
  const params = useParams()
  const router = useRouter()
  const [submission, setSubmission] = useState<VPATSubmission | null>(null)
  const [batchSubmissions, setBatchSubmissions] = useState<VPATSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'criteria' | 'grading'>('overview')
  const [activePlatform, setActivePlatform] = useState<string>('Default')
  const [scorecardResult, setScorecardResult] = useState<ScorecardResult | null>(null)
  const [expandedDisabilities, setExpandedDisabilities] = useState<Set<number>>(new Set())
  const [expandedWCAG, setExpandedWCAG] = useState<'2.0' | '2.1' | '2.2' | null>(null)

  const availablePlatforms = useMemo(() => {
    return submission?.platformReports?.map((report) => report.platform) || []
  }, [submission?.platformReports])

  const selectedPlatformReport = useMemo(() => {
    if (!submission?.platformReports?.length) return null
    return (
      submission.platformReports.find((report) => report.platform === activePlatform) ||
      submission.platformReports[0]
    )
  }, [submission?.platformReports, activePlatform])

  const currentCriteria = useMemo(() => {
    return selectedPlatformReport?.criteria || submission?.extractedData?.criteria || []
  }, [selectedPlatformReport?.criteria, submission?.extractedData?.criteria])
  
  // Toggle disability dropdown
  const toggleDisability = (index: number) => {
    const newExpanded = new Set(expandedDisabilities)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedDisabilities(newExpanded)
  }
  
  // Toggle WCAG section
  const toggleWCAG = (version: '2.0' | '2.1' | '2.2') => {
    setExpandedWCAG(expandedWCAG === version ? null : version)
  }
  
  // Resource metadata for grading
  const [annualCost, setAnnualCost] = useState(0)
  const [studentCount, setStudentCount] = useState(0)
  const [staffCount, setStaffCount] = useState(0)
  const [isPublicUse, setIsPublicUse] = useState(false)

  useEffect(() => {
    if (!submission) return

    const impact = submission.impactFactors
    setAnnualCost(impact?.cost ?? 0)
    setStudentCount(impact?.numberOfStudents ?? 0)
    setStaffCount(impact?.numberOfStaff ?? 0)
    setIsPublicUse(impact?.isPublicUse ?? false)
  }, [submission?.id])

  useEffect(() => {
    if (!submission) return
    if (submission.platformReports?.length) {
      const defaultPlatform = submission.platformReports[0].platform
      if (!submission.platformReports.some((report) => report.platform === activePlatform)) {
        setActivePlatform(defaultPlatform)
      }
      return
    }
    setActivePlatform('Default')
  }, [submission?.id, submission?.platformReports, activePlatform])

  const renderWCAGExpandedDetails = (score: ScorecardResult['wcag21Score'], versionLabel: '2.0' | '2.1' | '2.2') => (
    <div className="mt-4 pt-4 border-t border-gray-300">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="font-bold text-gray-900 mb-3">📊 Score Calculation</h4>
          <div className="space-y-2 text-sm">
            <div className="font-mono bg-gray-50 p-2 rounded">
              <div className="font-bold mb-1">Extremely Important:</div>
              <div>({score.extremelyImportantSupports} × 100) + ({score.extremelyImportantPartiallySupports} × 30) + ({score.extremelyImportantNotSupported} × 0.01)</div>
              <div className="text-blue-700">= {(score.extremelyImportantSupports * 100) + (score.extremelyImportantPartiallySupports * 30) + (score.extremelyImportantNotSupported * 0.01)} points</div>
            </div>
            <div className="font-mono bg-gray-50 p-2 rounded">
              <div className="font-bold mb-1">Somewhat Important:</div>
              <div>({score.somewhatImportantSupports} × 100) + ({score.somewhatImportantPartiallySupports} × 40) + ({score.somewhatImportantNotSupported} × 0.01)</div>
              <div className="text-blue-700">= {(score.somewhatImportantSupports * 100) + (score.somewhatImportantPartiallySupports * 40) + (score.somewhatImportantNotSupported * 0.01)} points</div>
            </div>
            <div className="font-mono bg-gray-50 p-2 rounded">
              <div className="font-bold mb-1">Standard:</div>
              <div>({score.standardSupports} × 100) + ({score.standardPartiallySupports} × 50) + ({score.standardNotSupported} × 0.01)</div>
              <div className="text-blue-700">= {(score.standardSupports * 100) + (score.standardPartiallySupports * 50) + (score.standardNotSupported * 0.01)} points</div>
            </div>
            <div className="font-bold text-lg text-gray-900 mt-2 pt-2 border-t border-gray-200">
              Total Score: {score.score.toFixed(2)} / {score.perfectScore}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="font-bold text-gray-900 mb-3">📋 All Criteria ({score.criteriaDetails.length})</h4>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {score.criteriaDetails.map((criterion, idx) => (
              <div
                key={idx}
                className={`p-2 rounded text-xs border ${
                  criterion.isExclusive ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="font-medium">{criterion.criterion}</div>
                    {criterion.isExclusive && <span className="text-blue-600 text-xs">⭐ WCAG {versionLabel} Exclusive</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      criterion.impactCategory === 'Extremely important' ? 'bg-red-100 text-red-800' :
                      criterion.impactCategory === 'Somewhat important' ? 'bg-orange-100 text-orange-800' :
                      criterion.impactCategory === 'Standard' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {criterion.impactCategory}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      criterion.supportStatus === 'Supports' || criterion.supportStatus === 'N/A' ? 'bg-green-100 text-green-800' :
                      criterion.supportStatus === 'Partially Supports' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {criterion.supportStatus}
                    </span>
                    <span className="font-mono text-blue-700 font-bold">{criterion.points} pts</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const downloadGradingReport = async () => {
    if (!submission) return

    // Prefer server-generated scorecard for the selected platform
    try {
      const platformQuery = selectedPlatformReport?.platform
      const url = platformQuery
        ? `/api/vpat/scorecard/${submission.id}?platform=${encodeURIComponent(platformQuery)}`
        : `/api/vpat/scorecard/${submission.id}`

      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Failed to download server scorecard: ${res.status}`)
      }

      const blob = await res.blob()
      const downloadLink = document.createElement('a')
      downloadLink.href = URL.createObjectURL(blob)
      downloadLink.download = selectedPlatformReport?.fileName || submission.generatedScorecard?.fileName || `vpat_scorecard_${submission.id}.xlsx`
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
      URL.revokeObjectURL(downloadLink.href)
      return
    } catch (err) {
      console.warn('Falling back to client-generated comprehensive workbook:', err)
    }

    if (!scorecardResult) return

    const workbook = XLSX.utils.book_new()

    const extractedCriteria = currentCriteria

    const overviewRows = [
      ['VPAT Comprehensive Report'],
      ['Generated At', new Date().toLocaleString()],
      ['Submission ID', submission.id],
      ['Product Name', submission.extractedData?.productName || 'N/A'],
      ['Platform', selectedPlatformReport?.platform || 'Default'],
      ['Vendor Name', submission.extractedData?.vendorName || 'N/A'],
      ['VPAT Version', submission.extractedData?.vpatVersion || 'N/A'],
      ['Report Date', submission.extractedData?.reportDate || 'N/A'],
      [''],
      ['Resource Inputs (Required Before Upload)'],
      ['Annual Cost ($)', annualCost],
      ['Public Use', isPublicUse ? 'Yes' : 'No'],
      ['Student Users (Annual)', studentCount],
      ['Staff Users (Annual)', staffCount],
      ['Total Users (Student + Staff)', studentCount + staffCount],
      [''],
      ['Overall Grade (WCAG 2.1)'],
      ['Grade', scorecardResult.wcag21Score.grade],
      ['Grade Range', scorecardResult.wcag21Score.gradeRange],
      ['Score', scorecardResult.wcag21Score.score.toFixed(2)],
      ['Perfect Score', scorecardResult.wcag21Score.perfectScore],
      ['Percentage', `${((scorecardResult.wcag21Score.score / scorecardResult.wcag21Score.perfectScore) * 100).toFixed(2)}%`],
      ['Risk Level', scorecardResult.riskLevel],
      ['Resource Requirement', scorecardResult.resourceRequirement],
      ['Overall Recommendation', scorecardResult.overallRecommendation]
    ]

    const wcagRows = [
      ['WCAG Version', 'Grade', 'Grade Range', 'Score', 'Perfect Score', 'Percentage', 'Total', 'Supports (incl. N/A)', 'Partials', 'Not Supported', 'N/A', 'NEGLIGIBLE'],
      [
        'WCAG 2.0',
        scorecardResult.wcag20Score.grade,
        scorecardResult.wcag20Score.gradeRange,
        scorecardResult.wcag20Score.score.toFixed(2),
        scorecardResult.wcag20Score.perfectScore,
        `${((scorecardResult.wcag20Score.score / scorecardResult.wcag20Score.perfectScore) * 100).toFixed(2)}%`,
        scorecardResult.wcag20Score.totalCriteria,
        scorecardResult.wcag20Score.totalSupports,
        scorecardResult.wcag20Score.totalPartials,
        scorecardResult.wcag20Score.totalNotSupported,
        scorecardResult.wcag20Score.totalNA,
        scorecardResult.wcag20Score.negligibleCount
      ],
      [
        'WCAG 2.1',
        scorecardResult.wcag21Score.grade,
        scorecardResult.wcag21Score.gradeRange,
        scorecardResult.wcag21Score.score.toFixed(2),
        scorecardResult.wcag21Score.perfectScore,
        `${((scorecardResult.wcag21Score.score / scorecardResult.wcag21Score.perfectScore) * 100).toFixed(2)}%`,
        scorecardResult.wcag21Score.totalCriteria,
        scorecardResult.wcag21Score.totalSupports,
        scorecardResult.wcag21Score.totalPartials,
        scorecardResult.wcag21Score.totalNotSupported,
        scorecardResult.wcag21Score.totalNA,
        scorecardResult.wcag21Score.negligibleCount
      ],
      [
        'WCAG 2.2',
        scorecardResult.wcag22Score.grade,
        scorecardResult.wcag22Score.gradeRange,
        scorecardResult.wcag22Score.score.toFixed(2),
        scorecardResult.wcag22Score.perfectScore,
        `${((scorecardResult.wcag22Score.score / scorecardResult.wcag22Score.perfectScore) * 100).toFixed(2)}%`,
        scorecardResult.wcag22Score.totalCriteria,
        scorecardResult.wcag22Score.totalSupports,
        scorecardResult.wcag22Score.totalPartials,
        scorecardResult.wcag22Score.totalNotSupported,
        scorecardResult.wcag22Score.totalNA,
        scorecardResult.wcag22Score.negligibleCount
      ]
    ]

    const disabilityRows = [
      ['Disability', 'Supported Criteria', 'Total Criteria', 'Percent Supported', 'Affected Population %', 'Status', 'Not Fully Supported Criteria'],
      ...scorecardResult.disabilityImpacts.map((impact) => [
        impact.disability,
        impact.criteriaSupported,
        impact.totalCriteria,
        `${(impact.percentSupported * 100).toFixed(1)}%`,
        `${(impact.affectedPopulationPercent * 100).toFixed(2)}%`,
        impact.status,
        impact.notFullySupportedCriteria.join(' | ')
      ])
    ]

    const rawCriteriaRows = [
      ['Criterion ID', 'Criterion Name', 'WCAG Level', 'Conformance Level', 'Scorecard Equivalent', 'Reasoning'],
      ...extractedCriteria.map((criterion: any) => [
        criterion.criterionId || '',
        criterion.criterionName || '',
        criterion.level || '',
        criterion.conformanceLevel || '',
        criterion.scorecardEquivalent || '',
        criterion.reasoning || ''
      ])
    ]

    const buildDetailedRows = (label: '2.0' | '2.1' | '2.2', details: any[]) => {
      return [
        [`WCAG ${label} Criteria Details`],
        ['Criterion', 'Status', 'Impact Category', 'Points', 'Exclusive?'],
        ...details.map((d) => [
          d.criterion,
          d.supportStatus,
          d.impactCategory,
          d.points,
          d.isExclusive ? 'Yes' : 'No'
        ])
      ]
    }

    const wcag20DetailRows = buildDetailedRows('2.0', scorecardResult.wcag20Score.criteriaDetails)
    const wcag21DetailRows = buildDetailedRows('2.1', scorecardResult.wcag21Score.criteriaDetails)
    const wcag22DetailRows = buildDetailedRows('2.2', scorecardResult.wcag22Score.criteriaDetails)

    const disabilityCriteriaRows = [
      ['Disability', 'Criterion Not Fully Supported'],
      ...scorecardResult.disabilityImpacts.flatMap((impact) => {
        if (impact.notFullySupportedCriteria.length === 0) {
          return [[impact.disability, 'None']]
        }
        return impact.notFullySupportedCriteria.map((criterion) => [
          impact.disability,
          criterion
        ])
      })
    ]

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(overviewRows), 'Grading Overview')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(wcagRows), 'WCAG Scoring')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(disabilityRows), 'Disability Impact')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rawCriteriaRows), 'Extracted Criteria')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(wcag20DetailRows), 'WCAG 2.0 Details')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(wcag21DetailRows), 'WCAG 2.1 Details')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(wcag22DetailRows), 'WCAG 2.2 Details')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(disabilityCriteriaRows), 'Disability Criteria')

    const safeProduct = (submission.extractedData?.productName || 'Product').replace(/[^a-zA-Z0-9_-]/g, '_')
    const platformSuffix = selectedPlatformReport?.platform ? `_${selectedPlatformReport.platform.replace(/[^a-zA-Z0-9]/g, '_')}` : ''
    XLSX.writeFile(workbook, `vpat_comprehensive_report_${safeProduct}${platformSuffix}_${Date.now()}.xlsx`)
  }

  // Calculate scorecard results from extracted criteria
  useMemo(() => {
    console.log('🔍 [SCORECARD DEBUG] Submission exists:', !!submission)
    console.log('🔍 [SCORECARD DEBUG] extractedData exists:', !!submission?.extractedData)
    console.log('🔍 [SCORECARD DEBUG] criteria exists:', !!submission?.extractedData?.criteria)
    console.log('🔍 [SCORECARD DEBUG] Full extractedData:', submission?.extractedData)
    
    if (currentCriteria.length > 0) {
      try {
        const criteria = currentCriteria
        
        console.log('🔍 [SCORECARD] Total criteria from Method 1:', criteria.length)
        console.log('🔍 [SCORECARD] Sample criterion:', criteria[0])
        
        // Extract all criterion data (we need ID, name, and level for matching)
        const criterionData = criteria.map((c: any) => ({
          id: c.criterionId,
          name: c.criterionName,
          level: c.level,
          fullName: `${c.criterionId} ${c.criterionName} (Level ${c.level})`
        }))
        console.log('🔍 [SCORECARD] First 3 full criterion names:', criterionData.slice(0, 3).map(c => c.fullName))
        
        // Build platform results from criteria
        const platformResultsMap: Record<string, { supported: string[], partiallySupported: string[], notSupported: string[], notApplicable: string[] }> = {
          'Default': { supported: [], partiallySupported: [], notSupported: [], notApplicable: [] }
        }
        
        criteria.forEach((c: any, idx: number) => {
          const platform = 'Default'
          const fullName = criterionData[idx].fullName
          
          if (c.scorecardEquivalent === 'Supports') {
            platformResultsMap[platform].supported.push(fullName)
          } else if (c.scorecardEquivalent === 'Partially Supports') {
            platformResultsMap[platform].partiallySupported.push(fullName)
          } else if (c.scorecardEquivalent === 'Does Not Support') {
            platformResultsMap[platform].notSupported.push(fullName)
          } else if (c.scorecardEquivalent === 'Not Applicable') {
            platformResultsMap[platform].notApplicable.push(fullName)
          }
        })
        
        console.log('🔍 [SCORECARD] Platform results:', {
          supported: platformResultsMap.Default.supported.length,
          partiallySupported: platformResultsMap.Default.partiallySupported.length,
          notSupported: platformResultsMap.Default.notSupported.length,
          notApplicable: platformResultsMap.Default.notApplicable.length
        })
        
        // Build per-criterion support data
        const criteriaSupport = criterionData.map((cd, idx) => {
          const c = criteria[idx]
          return {
            criterion: cd.fullName,
            supports: c.scorecardEquivalent === 'Supports',
            partiallySupports: c.scorecardEquivalent === 'Partially Supports',
            doesNotSupport: c.scorecardEquivalent === 'Does Not Support',
            notApplicable: c.scorecardEquivalent === 'Not Applicable'
          }
        })
        
        console.log('🔍 [SCORECARD] Criteria support data:', criteriaSupport.slice(0, 3))
        
        // Calculate scorecard with user-provided metadata
        const result = calculateScorecard(
          criteriaSupport,
          studentCount,
          staffCount,
          isPublicUse,
          annualCost
        )
        
        console.log('🔍 [SCORECARD] Calculation result:', result)
        setScorecardResult(result)
      } catch (error) {
        console.error('❌ [SCORECARD] Error calculating scorecard:', error)
        setScorecardResult(null)
      }
    }
  }, [currentCriteria, studentCount, staffCount, isPublicUse, annualCost])

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const data = await fetchSubmission()
        if (!isMounted) return

        // If this submission is part of a batch, load all batch submissions
        if (data?.batchId) {
          await fetchBatchSubmissions(data.batchId)
        }

        // Start or stop polling based on status
        const status = data?.status
        const isTerminal = status === 'completed' || status === 'failed' || status === 'needs_review'
        
        console.log('🔄 [POLLING] Status:', status, 'IsTerminal:', isTerminal, 'PollingActive:', !!pollingRef.current)

        // Only poll if not terminal and no polling is active
        if (!isTerminal && !pollingRef.current) {
          const intervalMs = 5000 // Faster polling to reduce staleness
          pollingRef.current = setInterval(() => {
            fetchSubmission().then((updatedData) => {
              if (updatedData) {
                const updatedStatus = updatedData.status
                const updatedTerminal =
                  updatedStatus === 'completed' ||
                  updatedStatus === 'failed' ||
                  updatedStatus === 'needs_review'

                if (updatedTerminal && pollingRef.current) {
                  // Fetch once more to ensure UI has freshest state, then stop
                  fetchSubmission().finally(() => {
                    clearInterval(pollingRef.current as NodeJS.Timeout)
                    pollingRef.current = null
                  })
                }
              }
            })
          }, intervalMs)
        }

        if (isTerminal && pollingRef.current) {
          console.log('🛑 [POLLING] Stopping polling due to terminal status:', status)
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      isMounted = false
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [params.id])

  // Refresh when tab regains focus/visibility to avoid stale state
  useEffect(() => {
    const handleFocus = () => {
      fetchSubmission()
    }
    const handleVisibility = () => {
      if (!document.hidden) {
        fetchSubmission()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const getCanonicalSubmissionId = (idParam: string): string => {
    if (!idParam.includes('_')) return idParam
    const parts = idParam.split('_')
    const lastPart = parts[parts.length - 1]
    if (!/^[0-9a-f]+$/i.test(lastPart)) {
      return parts.slice(0, -1).join('_')
    }
    return idParam
  }

  useEffect(() => {
    const rawId = String(params.id)
    const canonicalId = getCanonicalSubmissionId(rawId)
    if (rawId !== canonicalId) {
      router.replace(`/dashboard/vpat-submission/${canonicalId}`)
    }
  }, [params.id, router])

  const inferSubmissionStatus = (data: VPATSubmission): VPATSubmission['status'] => {
    if (data.status !== 'processing') {
      return data.status
    }

    const hasCompletionArtifacts = Boolean(data.generatedScorecard || data.completedAt)
    const hasCompletionLog = Boolean(
      data.processingLog?.some((log) =>
        ['processing_completed', 'evaluation_completed', 'step13_files_saved', 'scorecard_generation_completed'].includes(log.step)
      )
    )

    if (hasCompletionArtifacts || hasCompletionLog) {
      if (data.validationResults && !data.validationResults.isValid) {
        return 'needs_review'
      }
      return 'completed'
    }

    return 'processing'
  }

  const fetchSubmission = async () => {
    try {
      const token = localStorage.getItem('token')
      
      if (!token) {
        console.error('No authentication token found')
        return null
      }
      
      const res = await fetch(`/api/vpat-submissions/${params.id}?t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        cache: 'no-store'
      })

      if (res.status === 404) {
        console.log('Submission not found, might still be processing...')
        return null
      }

      if (res.status === 401) {
        console.error('Unauthorized - token may be expired')
        return null
      }

      if (!res.ok) throw new Error('Failed to fetch submission')

      const data = await res.json()

      let normalizedData = data as VPATSubmission

      // Cross-check via bot submissions list in case the single-submission endpoint is stale
      if (normalizedData.vpatBotId) {
        try {
          const submissionsRes = await fetch(
            `/api/vpat-bots/${normalizedData.vpatBotId}/submissions?t=${Date.now()}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              },
              cache: 'no-store'
            }
          )

          if (submissionsRes.ok) {
            const allSubmissions = await submissionsRes.json()
            const canonicalId = getCanonicalSubmissionId(String(params.id))
            const freshest = allSubmissions.find((s: VPATSubmission) => s.id === canonicalId)

            if (freshest) {
              // Prefer freshest status/details from list endpoint, preserve platform-specific shaping from detail endpoint
              normalizedData = {
                ...normalizedData,
                ...freshest,
                id: normalizedData.id,
                extractedData: normalizedData.extractedData || freshest.extractedData,
                generatedScorecard: normalizedData.generatedScorecard || freshest.generatedScorecard,
                platformReports: normalizedData.platformReports || freshest.platformReports,
                processingLog: normalizedData.processingLog || freshest.processingLog
              }
            }
          }
        } catch (fallbackErr) {
          console.warn('Failed to cross-check latest submission status from bot submissions:', fallbackErr)
        }
      }

      const inferredStatus = inferSubmissionStatus(normalizedData)
      const finalData = inferredStatus === normalizedData.status
        ? normalizedData
        : { ...normalizedData, status: inferredStatus }

      setSubmission(finalData)
      return finalData
    } catch (error) {
      console.error('Fetch error:', error)
      return null
    } finally {
      // loading state handled by outer effect
    }
  }

  const fetchBatchSubmissions = async (batchId: string) => {
    try {
      const token = localStorage.getItem('token')
      
      if (!token) {
        console.error('No authentication token found for batch fetch')
        return []
      }
      
      const res = await fetch(`/api/vpat-batches/${batchId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!res.ok) {
        console.error('Failed to fetch batch submissions:', res.status)
        return []
      }

      const data = await res.json()
      setBatchSubmissions(data.submissions || [])
      return data.submissions
    } catch (error) {
      console.error('Fetch batch error:', error)
      return []
    }
  }

  const navigateToSubmission = (direction: 'prev' | 'next') => {
    if (!submission || !submission.batchId || batchSubmissions.length === 0) return

    const currentIndex = batchSubmissions.findIndex(s => s.id === submission.id)
    if (currentIndex === -1) return

    let targetIndex
    if (direction === 'prev') {
      targetIndex = currentIndex > 0 ? currentIndex - 1 : batchSubmissions.length - 1
    } else {
      targetIndex = currentIndex < batchSubmissions.length - 1 ? currentIndex + 1 : 0
    }

    const targetSubmission = batchSubmissions[targetIndex]
    if (targetSubmission) {
      router.push(`/dashboard/vpat-submission/${targetSubmission.id}`)
    }
  }

  const getCurrentSubmissionIndex = () => {
    if (!submission || !submission.batchId || batchSubmissions.length === 0) return -1
    return batchSubmissions.findIndex(s => s.id === submission.id)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-600" />
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-600" />
      case 'needs_review':
        return <AlertCircle className="w-6 h-6 text-yellow-600" />
      case 'processing':
        return <Clock className="w-6 h-6 text-blue-600 animate-spin" />
      default:
        return <Clock className="w-6 h-6 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'needs_review':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading submission...</p>
          <p className="text-sm text-gray-500 mt-2">If this is a new batch submission, it may take a moment to initialize.</p>
        </div>
      </div>
    )
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-600 mb-4">Submission not found or still processing</p>
          <p className="text-sm text-gray-500 mb-6">
            This can happen with new batch submissions. Please wait a moment and refresh.
          </p>
          <div className="space-x-4">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>
            <Link href="/dashboard" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors inline-block">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              </Link>
              
              {/* Navigation arrows for batch submissions */}
              {submission?.batchId && batchSubmissions.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigateToSubmission('prev')}
                    className="flex items-center gap-1 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Previous VPAT"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-600 font-medium min-w-[60px] text-center">
                    {getCurrentSubmissionIndex() + 1} / {batchSubmissions.length}
                  </span>
                  <button
                    onClick={() => navigateToSubmission('next')}
                    className="flex items-center gap-1 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Next VPAT"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">VPAT Submission</h1>
                <p className="text-sm text-gray-600">
                  {submission.extractedData?.productName || submission.submittedDocument.fileName}
                  {selectedPlatformReport?.platform ? ` • ${selectedPlatformReport.platform}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusIcon(submission.status)}
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(submission.status)}`}>
                {submission.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {availablePlatforms.length > 1 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Platform Dashboard</h2>
                <p className="text-xs text-gray-600">Toggle platform-specific criteria, grading, and analysis.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {availablePlatforms.map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setActivePlatform(platform)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      activePlatform === platform
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('criteria')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'criteria'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Criteria Analysis
            </button>
            <button
              onClick={() => setActiveTab('grading')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'grading'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Grading
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Metadata */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Document Information</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-700">Product Name</label>
                  <p className="text-gray-900 mt-1">{submission.extractedData?.productName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Vendor Name</label>
                  <p className="text-gray-900 mt-1">{submission.extractedData?.vendorName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">VPAT Version</label>
                  <p className="text-gray-900 mt-1">{submission.extractedData?.vpatVersion || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Report Date</label>
                  <p className="text-gray-900 mt-1">{submission.extractedData?.reportDate || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">WCAG Version</label>
                  <p className="text-gray-900 mt-1">{submission.extractedData?.wcagVersion || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">WCAG Level</label>
                  <p className="text-gray-900 mt-1">{submission.extractedData?.wcagLevel || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Download Scorecard */}

          </div>
        )}

        {/* Grading Tab - Consolidated */}
        {activeTab === 'grading' && (
          <div className="space-y-6">
            {scorecardResult ? (
              <>
                {/* Resource Metadata Inputs */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Resource Information</h2>
                    <button
                      onClick={downloadGradingReport}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Download Comprehensive Excel
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Annual Cost ($) <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="e.g., 30000"
                        value={annualCost}
                        onChange={(e) => setAnnualCost(parseInt(e.target.value) || 0)}
                      />
                      <p className="text-xs text-gray-500 mt-1">Required pre-upload input. 0 means placeholder only.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Public Use? <span className="text-red-600">*</span>
                      </label>
                      <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        value={isPublicUse ? "Yes" : "No"}
                        onChange={(e) => setIsPublicUse(e.target.value === "Yes")}
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Required pre-upload input. Select actual production exposure.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Student Users (Annual) <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="e.g., 0"
                        value={studentCount}
                        onChange={(e) => setStudentCount(parseInt(e.target.value) || 0)}
                      />
                      <p className="text-xs text-gray-500 mt-1">Required pre-upload input. 0 means placeholder only.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Staff Users (Annual) <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="e.g., 10"
                        value={staffCount}
                        onChange={(e) => setStaffCount(parseInt(e.target.value) || 0)}
                      />
                      <p className="text-xs text-gray-500 mt-1">Required pre-upload input. 0 means placeholder only.</p>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>Current Values:</strong> {studentCount} students, {staffCount} staff, 
                      {isPublicUse ? ' public use' : ' no public use'}, ${annualCost.toLocaleString()} annual cost
                    </p>
                    {(annualCost === 0 || studentCount === 0 || staffCount === 0) && (
                      <p className="text-xs text-amber-700 mt-2">
                        One or more fields are still 0. Confirm these are intentional and not placeholder defaults.
                      </p>
                    )}
                  </div>
                </div>

                {/* Overall Grade Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Overall Grade & Approval (WCAG 2.1)</h2>
                  
                  <div className="text-center mb-6">
                    <div className={`text-6xl font-bold mb-2 ${
                      scorecardResult.wcag21Score.grade === 'A' ? 'text-green-600' :
                      scorecardResult.wcag21Score.grade === 'B' ? 'text-blue-600' :
                      scorecardResult.wcag21Score.grade === 'C' ? 'text-yellow-600' :
                      scorecardResult.wcag21Score.grade === 'D' ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {scorecardResult.wcag21Score.grade}
                    </div>
                    <div className="text-lg text-gray-600 mb-2">
                      {scorecardResult.wcag21Score.gradeRange}
                    </div>
                    <div className="text-sm text-gray-500">
                      Score: {scorecardResult.wcag21Score.score.toFixed(0)} / {scorecardResult.wcag21Score.perfectScore.toFixed(0)} ({((scorecardResult.wcag21Score.score / scorecardResult.wcag21Score.perfectScore) * 100).toFixed(1)}%)
                    </div>
                  </div>

                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-medium text-blue-900 mb-2">Recommendation</h3>
                    <p className="text-sm text-blue-700">{scorecardResult.overallRecommendation}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{currentCriteria.length}</div>
                      <div className="text-sm text-gray-600">Total Criteria</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {currentCriteria.filter((c: any) => c.scorecardEquivalent === 'Supports').length}
                      </div>
                      <div className="text-sm text-gray-600">Supports</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {currentCriteria.filter((c: any) => c.scorecardEquivalent === 'Does Not Support').length}
                      </div>
                      <div className="text-sm text-gray-600">Not Supported</div>
                    </div>
                  </div>
                </div>

                {/* Disabilities Impact */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Disabilities Impacted</h2>
                  <div className="grid grid-cols-1 gap-4">
                    {scorecardResult.disabilityImpacts.map((impact, index) => (
                      <div key={index} className="p-4 border border-gray-200 rounded-lg">
                        <div 
                          className="flex justify-between items-center mb-2 cursor-pointer"
                          onClick={() => toggleDisability(index)}
                        >
                          <h3 className="font-medium text-gray-900">{impact.disability}</h3>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <span className="text-sm text-gray-600">
                                {impact.criteriaSupported} / {impact.totalCriteria} criteria
                              </span>
                              <span className={`ml-3 px-2 py-1 text-xs rounded-full ${
                                impact.status === 'Supported' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {impact.status}
                              </span>
                            </div>
                            {impact.notFullySupportedCriteria.length > 0 && (
                              <ChevronDown 
                                className={`w-4 h-4 text-gray-500 transition-transform ${
                                  expandedDisabilities.has(index) ? 'rotate-180' : ''
                                }`}
                              />
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                          <div 
                            className={`h-3 rounded-full ${
                              impact.percentSupported === 1 ? 'bg-green-600' :
                              impact.percentSupported >= 0.8 ? 'bg-blue-600' :
                              impact.percentSupported >= 0.5 ? 'bg-yellow-600' :
                              'bg-red-600'
                            }`}
                            style={{width: `${impact.percentSupported * 100}%`}}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{(impact.percentSupported * 100).toFixed(1)}% supported</span>
                          <span>{(impact.affectedPopulationPercent * 100).toFixed(1)}% of US population</span>
                        </div>
                        
                        {/* Dropdown for not fully supported criteria */}
                        {expandedDisabilities.has(index) && impact.notFullySupportedCriteria.length > 0 && (
                          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <h4 className="font-medium text-red-800 mb-2">
                              Not Fully Supported Criteria ({impact.notFullySupportedCriteria.length})
                            </h4>
                            <div className="space-y-1">
                              {impact.notFullySupportedCriteria.map((criterion, idx) => (
                                <div key={idx} className="text-sm text-red-700 bg-white p-2 rounded border border-red-100">
                                  {criterion}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risk Assessment */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Risk Assessment</h2>
                  <div className={`p-4 rounded-lg mb-4 ${
                    scorecardResult.riskLevel === 'Low Risk' ? 'bg-green-50 border border-green-200' :
                    scorecardResult.riskLevel === 'Moderate Risk' ? 'bg-yellow-50 border border-yellow-200' :
                    scorecardResult.riskLevel === 'High Risk' ? 'bg-orange-50 border border-orange-200' :
                    'bg-red-50 border border-red-200'
                  }`}>
                    <h3 className={`font-bold text-lg mb-2 ${
                      scorecardResult.riskLevel === 'Low Risk' ? 'text-green-800' :
                      scorecardResult.riskLevel === 'Moderate Risk' ? 'text-yellow-800' :
                      scorecardResult.riskLevel === 'High Risk' ? 'text-orange-800' :
                      'text-red-800'
                    }`}>
                      Risk Level: {scorecardResult.riskLevel}
                    </h3>
                    <p className="text-sm">{scorecardResult.resourceRequirement}</p>
                  </div>
                </div>

                {/* WCAG Version Comparison - Detailed */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">WCAG Version Breakdown</h2>
                  <div className={`grid gap-4 ${expandedWCAG ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
                    {/* WCAG 2.0 */}
                    <div
                      className="p-4 border border-gray-200 rounded-lg cursor-pointer"
                      onClick={() => toggleWCAG('2.0')}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium text-gray-900">WCAG 2.0 (38 criteria)</h3>
                        <ChevronDown
                          className={`w-5 h-5 text-gray-500 transition-transform ${
                            expandedWCAG === '2.0' ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                      <div className="text-4xl font-bold mb-2">{scorecardResult.wcag20Score.grade}</div>
                      <div className="text-sm text-gray-600 mb-3">
                        {scorecardResult.wcag20Score.score.toFixed(0)} / {scorecardResult.wcag20Score.perfectScore.toFixed(0)} 
                        ({((scorecardResult.wcag20Score.score / scorecardResult.wcag20Score.perfectScore) * 100).toFixed(1)}%)
                      </div>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-medium">{scorecardResult.wcag20Score.totalCriteria}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-600">Supports:</span>
                          <span className="font-medium">{scorecardResult.wcag20Score.totalSupports}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-yellow-600">Partial:</span>
                          <span className="font-medium">{scorecardResult.wcag20Score.totalPartials}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-600">Not Support:</span>
                          <span className="font-medium">{scorecardResult.wcag20Score.totalNotSupported}</span>
                        </div>
                      </div>

                      {expandedWCAG === '2.0' && renderWCAGExpandedDetails(scorecardResult.wcag20Score, '2.0')}
                    </div>

                    {/* WCAG 2.1 - Primary */}
                    <div 
                      className="p-4 border-2 border-blue-500 rounded-lg bg-blue-50 cursor-pointer"
                      onClick={() => toggleWCAG('2.1')}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium text-blue-900">WCAG 2.1 (50 criteria)</h3>
                        <ChevronDown 
                          className={`w-5 h-5 text-blue-600 transition-transform ${
                            expandedWCAG === '2.1' ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                      <div className="text-4xl font-bold mb-2 text-blue-600">{scorecardResult.wcag21Score.grade}</div>
                      <div className="text-sm text-gray-700 mb-3">
                        {scorecardResult.wcag21Score.score.toFixed(0)} / {scorecardResult.wcag21Score.perfectScore.toFixed(0)}
                        ({((scorecardResult.wcag21Score.score / scorecardResult.wcag21Score.perfectScore) * 100).toFixed(1)}%)
                      </div>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-700">Total:</span>
                          <span className="font-medium">{scorecardResult.wcag21Score.totalCriteria}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Supports:</span>
                          <span className="font-medium">{scorecardResult.wcag21Score.totalSupports}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-yellow-700">Partial:</span>
                          <span className="font-medium">{scorecardResult.wcag21Score.totalPartials}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-700">Not Support:</span>
                          <span className="font-medium">{scorecardResult.wcag21Score.totalNotSupported}</span>
                        </div>
                      </div>

                      {expandedWCAG === '2.1' && renderWCAGExpandedDetails(scorecardResult.wcag21Score, '2.1')}
                    </div>

                    {/* WCAG 2.2 */}
                    <div
                      className="p-4 border border-gray-200 rounded-lg cursor-pointer"
                      onClick={() => toggleWCAG('2.2')}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium text-gray-900">WCAG 2.2 (56 criteria)</h3>
                        <ChevronDown
                          className={`w-5 h-5 text-gray-500 transition-transform ${
                            expandedWCAG === '2.2' ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                      <div className="text-4xl font-bold mb-2">{scorecardResult.wcag22Score.grade}</div>
                      <div className="text-sm text-gray-600 mb-3">
                        {scorecardResult.wcag22Score.score.toFixed(0)} / {scorecardResult.wcag22Score.perfectScore.toFixed(0)}
                        ({((scorecardResult.wcag22Score.score / scorecardResult.wcag22Score.perfectScore) * 100).toFixed(1)}%)
                      </div>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-medium">{scorecardResult.wcag22Score.totalCriteria}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-600">Supports:</span>
                          <span className="font-medium">{scorecardResult.wcag22Score.totalSupports}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-yellow-600">Partial:</span>
                          <span className="font-medium">{scorecardResult.wcag22Score.totalPartials}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-600">Not Support:</span>
                          <span className="font-medium">{scorecardResult.wcag22Score.totalNotSupported}</span>
                        </div>
                      </div>

                      {expandedWCAG === '2.2' && renderWCAGExpandedDetails(scorecardResult.wcag22Score, '2.2')}
                    </div>
                  </div>
                </div>

                {/* Grading Scale Reference */}

              </>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <p className="text-gray-600 text-center">Calculating scorecard results...</p>
              </div>
            )}

            {submission.detailedScorecard?.verificationResult && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Scorecard Verification Results</h2>
                
                <div className={`p-4 rounded-lg mb-4 ${
                  submission.detailedScorecard.verificationResult.hasMistakes 
                    ? 'bg-red-50 border border-red-200' 
                    : 'bg-green-50 border border-green-200'
                }`}>
                  <div className="flex items-center gap-3">
                    {submission.detailedScorecard.verificationResult.hasMistakes ? (
                      <XCircle className="w-6 h-6 text-red-600" />
                    ) : (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    )}
                    <div>
                      <h3 className={`font-bold ${
                        submission.detailedScorecard.verificationResult.hasMistakes 
                          ? 'text-red-800' 
                          : 'text-green-800'
                      }`}>
                        {submission.detailedScorecard.verificationResult.hasMistakes 
                          ? 'Issues Detected' 
                          : 'No Issues Found'}
                      </h3>
                      <p className={`text-sm ${
                        submission.detailedScorecard.verificationResult.hasMistakes 
                          ? 'text-red-600' 
                          : 'text-green-600'
                      }`}>
                        Confidence: {submission.detailedScorecard.verificationResult.confidence}%
                      </p>
                    </div>
                  </div>
                </div>

                {submission.detailedScorecard.verificationResult.mistakes.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Detected Issues:</h4>
                    {submission.detailedScorecard.verificationResult.mistakes.map((mistake, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            mistake.severity === 'high' ? 'bg-red-500' :
                            mistake.severity === 'medium' ? 'bg-yellow-500' :
                            'bg-blue-500'
                          }`} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900 capitalize">
                                {mistake.type} Issue
                              </span>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                mistake.severity === 'high' ? 'bg-red-100 text-red-800' :
                                mistake.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {mistake.severity}
                              </span>
                            </div>
                            <p className="text-gray-700 text-sm mb-2">{mistake.description}</p>
                            {mistake.suggestedFix && (
                              <div className="bg-gray-50 p-3 rounded text-sm">
                                <span className="font-medium text-gray-900">Suggested Fix:</span>
                                <p className="text-gray-700 mt-1">{mistake.suggestedFix}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {submission.detailedScorecard.verificationResult.recommendations.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Recommendations:</h4>
                    <ul className="space-y-1">
                      {submission.detailedScorecard.verificationResult.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-blue-600 mt-1">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {submission.detailedScorecard?.scorecardAnalysis && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Scorecard Analysis</h2>
                
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 mb-2">Evaluation Methodology</h3>
                  <p className="text-gray-700 text-sm">{submission.detailedScorecard.scorecardAnalysis.evaluationMethodology}</p>
                </div>

                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 mb-2">Scoring System</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Supports:</span> {submission.detailedScorecard.scorecardAnalysis.scoringSystem.supports}
                    </div>
                    <div>
                      <span className="font-medium">Partially Supports:</span> {submission.detailedScorecard.scorecardAnalysis.scoringSystem.partiallySupports}
                    </div>
                    <div>
                      <span className="font-medium">Does Not Support:</span> {submission.detailedScorecard.scorecardAnalysis.scoringSystem.doesNotSupport}
                    </div>
                    {submission.detailedScorecard.scorecardAnalysis.scoringSystem.notApplicable && (
                      <div>
                        <span className="font-medium">Not Applicable:</span> {submission.detailedScorecard.scorecardAnalysis.scoringSystem.notApplicable}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 mb-2">Criteria Found ({submission.detailedScorecard.scorecardAnalysis.criteriaList.length})</h3>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">ID</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Level</th>
                          {submission.detailedScorecard.scorecardAnalysis.criteriaList.some(c => c.weight) && (
                            <th className="px-3 py-2 text-left">Weight</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {submission.detailedScorecard.scorecardAnalysis.criteriaList.map((criterion, index) => (
                          <tr key={index} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-mono text-xs">{criterion.id}</td>
                            <td className="px-3 py-2">{criterion.name}</td>
                            <td className="px-3 py-2">{criterion.level}</td>
                            {criterion.weight !== undefined && (
                              <td className="px-3 py-2">{criterion.weight}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {submission.detailedScorecard.scorecardAnalysis.validationRules.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Validation Rules</h3>
                    <ul className="space-y-1 text-sm">
                      {submission.detailedScorecard.scorecardAnalysis.validationRules.map((rule, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className={rule.mandatory ? 'text-red-600' : 'text-blue-600'}>
                            {rule.mandatory ? '●' : '○'}
                          </span>
                          <span className="text-gray-700">
                            <span className="font-medium">{rule.field}:</span> {rule.requirement}
                            {rule.mandatory && <span className="text-red-600 font-medium"> (Required)</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Criteria Tab */}
        {activeTab === 'criteria' && currentCriteria.length > 0 && (
          <VPATCriteriaViewer
            criteria={currentCriteria}
            productName={
              selectedPlatformReport?.platform
                ? `${submission.extractedData?.productName || 'Product'} (${selectedPlatformReport.platform})`
                : submission.extractedData?.productName
            }
            submissionId={submission.id}
          />
        )}

        {/* OLD TABS REMOVED - Content moved to grading tab */}
        {false && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">WCAG 2.1 Weighted Score</h2>
              
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {submission.generatedScorecard?.analysis?.compliancePercentage || 0}%
                  </div>
                  <div className="text-sm text-gray-600">Overall Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round((submission.generatedScorecard?.analysis?.compliancePercentage || 0) * 0.6)}
                  </div>
                  <div className="text-sm text-gray-600">Supports</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {Math.round((submission.generatedScorecard?.analysis?.compliancePercentage || 0) * 0.3)}
                  </div>
                  <div className="text-sm text-gray-600">Partial</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {Math.round((submission.generatedScorecard?.analysis?.compliancePercentage || 0) * 0.1)}
                  </div>
                  <div className="text-sm text-gray-600">Not Support</div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Scoring Method</h3>
                <p className="text-sm text-gray-700">
                  Weighted scoring based on impact levels: Extremely Important (30 points), Somewhat Important (40 points), Standard (50 points)
                </p>
              </div>
            </div>
          </div>
        )}

        {false && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">WCAG 2.2 Weighted Score</h2>
              
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {submission.generatedScorecard?.analysis?.compliancePercentage || 0}%
                  </div>
                  <div className="text-sm text-gray-600">Overall Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round((submission.generatedScorecard?.analysis?.compliancePercentage || 0) * 0.6)}
                  </div>
                  <div className="text-sm text-gray-600">Supports</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {Math.round((submission.generatedScorecard?.analysis?.compliancePercentage || 0) * 0.3)}
                  </div>
                  <div className="text-sm text-gray-600">Partial</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {Math.round((submission.generatedScorecard?.analysis?.compliancePercentage || 0) * 0.1)}
                  </div>
                  <div className="text-sm text-gray-600">Not Support</div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">WCAG 2.2 Latest Standard</h3>
                <p className="text-sm text-blue-700">
                  Includes all 56 WCAG criteria with the most recent accessibility requirements
                </p>
              </div>
            </div>
          </div>
        )}

        {false && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">WCAG 2.0 Weighted Score</h2>
              
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round((submission.generatedScorecard?.analysis?.compliancePercentage || 0) * 0.8)}%
                  </div>
                  <div className="text-sm text-gray-600">Overall Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round((submission.generatedScorecard?.analysis?.compliancePercentage || 0) * 0.8 * 0.6)}
                  </div>
                  <div className="text-sm text-gray-600">Supports</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {Math.round((submission.generatedScorecard?.analysis?.compliancePercentage || 0) * 0.8 * 0.3)}
                  </div>
                  <div className="text-sm text-gray-600">Partial</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {Math.round((submission.generatedScorecard?.analysis?.compliancePercentage || 0) * 0.8 * 0.1)}
                  </div>
                  <div className="text-sm text-gray-600">Not Support</div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Legacy Standard</h3>
                <p className="text-sm text-gray-700">
                  WCAG 2.0 includes 38 criteria (subset of 2.1/2.2). May not include newer requirements.
                </p>
              </div>
            </div>
          </div>
        )}

        {false && (
          <div className="space-y-6">
            {scorecardResult ? (
              <>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Overall Grade & Approval (WCAG 2.1)</h2>
                  
                  <div className="text-center mb-6">
                    <div className={`text-6xl font-bold mb-2 ${
                      scorecardResult.wcag21Score.grade === 'A' ? 'text-green-600' :
                      scorecardResult.wcag21Score.grade === 'B' ? 'text-blue-600' :
                      scorecardResult.wcag21Score.grade === 'C' ? 'text-yellow-600' :
                      scorecardResult.wcag21Score.grade === 'D' ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {scorecardResult.wcag21Score.grade}
                    </div>
                    <div className="text-lg text-gray-600 mb-2">
                      {scorecardResult.wcag21Score.gradeRange}
                    </div>
                    <div className="text-sm text-gray-500">
                      Score: {scorecardResult.wcag21Score.score.toFixed(0)} / {scorecardResult.wcag21Score.perfectScore.toFixed(0)} ({((scorecardResult.wcag21Score.score / scorecardResult.wcag21Score.perfectScore) * 100).toFixed(1)}%)
                    </div>
                  </div>

                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-medium text-blue-900 mb-2">Recommendation</h3>
                    <p className="text-sm text-blue-700">{scorecardResult.overallRecommendation}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{submission.extractedData.criteria.length}</div>
                      <div className="text-sm text-gray-600">Total Criteria</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {submission.extractedData.criteria.filter((c: any) => c.scorecardEquivalent === 'Supports').length}
                      </div>
                      <div className="text-sm text-gray-600">Supports</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {submission.extractedData.criteria.filter((c: any) => c.scorecardEquivalent === 'Does Not Support').length}
                      </div>
                      <div className="text-sm text-gray-600">Not Supported</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900 mb-2">Grading Scale</h3>
                    <div className="flex justify-between p-3 bg-green-50 rounded">
                      <span className="font-medium">A (Accessible)</span>
                      <span className="text-sm">95%+ of perfect score - 2 year approval</span>
                    </div>
                    <div className="flex justify-between p-3 bg-blue-50 rounded">
                      <span className="font-medium">B (Conditional)</span>
                      <span className="text-sm">85%+ and no student/public use - 2 year approval</span>
                    </div>
                    <div className="flex justify-between p-3 bg-yellow-50 rounded">
                      <span className="font-medium">C (Blanket EAE)</span>
                      <span className="text-sm">&lt;95%, ≤50 users, &lt;$25k - 2 year approval</span>
                    </div>
                    <div className="flex justify-between p-3 bg-orange-50 rounded">
                      <span className="font-medium">D (EAE - TAC/DOJ)</span>
                      <span className="text-sm">&lt;$25k annually - Set by EIRAC</span>
                    </div>
                    <div className="flex justify-between p-3 bg-red-50 rounded">
                      <span className="font-medium">F (Enhanced EAE)</span>
                      <span className="text-sm">Additional defense required - Set by EIRAC</span>
                    </div>
                  </div>
                </div>

                {/* WCAG Version Comparison */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">WCAG Version Comparison</h2>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-2">WCAG 2.0</h3>
                      <div className="text-3xl font-bold mb-1">{scorecardResult.wcag20Score.grade}</div>
                      <div className="text-sm text-gray-600 mb-2">
                        {scorecardResult.wcag20Score.score.toFixed(0)} / {scorecardResult.wcag20Score.perfectScore.toFixed(0)}
                      </div>
                      <div className="text-xs text-gray-500">{scorecardResult.wcag20Score.gradeRange}</div>
                    </div>
                    <div className="p-4 border-2 border-blue-500 rounded-lg bg-blue-50">
                      <h3 className="font-medium text-blue-900 mb-2">WCAG 2.1 ⭐</h3>
                      <div className="text-3xl font-bold mb-1 text-blue-600">{scorecardResult.wcag21Score.grade}</div>
                      <div className="text-sm text-gray-600 mb-2">
                        {scorecardResult.wcag21Score.score.toFixed(0)} / {scorecardResult.wcag21Score.perfectScore.toFixed(0)}
                      </div>
                      <div className="text-xs text-gray-500">{scorecardResult.wcag21Score.gradeRange}</div>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-2">WCAG 2.2</h3>
                      <div className="text-3xl font-bold mb-1">{scorecardResult.wcag22Score.grade}</div>
                      <div className="text-sm text-gray-600 mb-2">
                        {scorecardResult.wcag22Score.score.toFixed(0)} / {scorecardResult.wcag22Score.perfectScore.toFixed(0)}
                      </div>
                      <div className="text-xs text-gray-500">{scorecardResult.wcag22Score.gradeRange}</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <p className="text-gray-600 text-center">Calculating scorecard results...</p>
              </div>
            )}
          </div>
        )}

        {false && (
          <div className="space-y-6">
            {scorecardResult ? (
              <>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Disabilities Impacted Analysis</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Analysis based on WCAG 2.1 criteria and their impact on different disability groups.
                  </p>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {scorecardResult.disabilityImpacts.map((impact, index) => (
                      <div key={index} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-medium text-gray-900">{impact.disability}</h3>
                          <div className="text-right">
                            <span className="text-sm text-gray-600">
                              {impact.criteriaSupported} / {impact.totalCriteria} criteria
                            </span>
                            <span className={`ml-3 px-2 py-1 text-xs rounded-full ${
                              impact.status === 'Supported' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {impact.status}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                          <div 
                            className={`h-3 rounded-full ${
                              impact.percentSupported === 1 ? 'bg-green-600' :
                              impact.percentSupported >= 0.8 ? 'bg-blue-600' :
                              impact.percentSupported >= 0.5 ? 'bg-yellow-600' :
                              'bg-red-600'
                            }`}
                            style={{width: `${impact.percentSupported * 100}%`}}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{(impact.percentSupported * 100).toFixed(1)}% supported</span>
                          <span>{(impact.affectedPopulationPercent * 100).toFixed(1)}% of US adult population</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Population Impact Summary</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h3 className="font-medium text-green-900 mb-2">Fully Supported Disabilities</h3>
                      <div className="space-y-1">
                        {scorecardResult.disabilityImpacts
                          .filter(d => d.status === 'Supported')
                          .map((d, i) => (
                            <div key={i} className="text-sm text-green-700">• {d.disability}</div>
                          ))}
                        {scorecardResult.disabilityImpacts.filter(d => d.status === 'Supported').length === 0 && (
                          <div className="text-sm text-gray-500">None</div>
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <h3 className="font-medium text-yellow-900 mb-2">Partially Supported Disabilities</h3>
                      <div className="space-y-1">
                        {scorecardResult.disabilityImpacts
                          .filter(d => d.status === 'Not Fully Support')
                          .map((d, i) => (
                            <div key={i} className="text-sm text-yellow-700">
                              • {d.disability} ({(d.percentSupported * 100).toFixed(0)}%)
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <p className="text-gray-600 text-center">Calculating disability impacts...</p>
              </div>
            )}
          </div>
        )}

        {false && (
          <div className="space-y-6">
            {scorecardResult ? (
              <>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Risk Assessment & Metrics</h2>
                  
                  <div className="mb-6">
                    <div className={`p-4 rounded-lg ${
                      scorecardResult.riskLevel === 'Low Risk' ? 'bg-green-50 border border-green-200' :
                      scorecardResult.riskLevel === 'Moderate Risk' ? 'bg-yellow-50 border border-yellow-200' :
                      scorecardResult.riskLevel === 'High Risk' ? 'bg-orange-50 border border-orange-200' :
                      'bg-red-50 border border-red-200'
                    }`}>
                      <h3 className={`font-bold text-lg mb-2 ${
                        scorecardResult.riskLevel === 'Low Risk' ? 'text-green-800' :
                        scorecardResult.riskLevel === 'Moderate Risk' ? 'text-yellow-800' :
                        scorecardResult.riskLevel === 'High Risk' ? 'text-orange-800' :
                        'text-red-800'
                      }`}>
                        Risk Level: {scorecardResult.riskLevel}
                      </h3>
                      <p className="text-sm mb-2">
                        Grade {scorecardResult.wcag21Score.grade} - {scorecardResult.wcag21Score.gradeRange}
                      </p>
                      <p className="text-xs opacity-75">
                        {scorecardResult.overallRecommendation}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">Resource Requirements</h3>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-900 mb-1">{scorecardResult.resourceRequirement}</p>
                        <p className="text-xs text-gray-600">
                          Based on current accessibility score and compliance level
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">Compliance Metrics</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">WCAG 2.1 Grade:</span>
                          <span className="font-medium">{scorecardResult.wcag21Score.grade}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Score:</span>
                          <span className="font-medium">
                            {scorecardResult.wcag21Score.score.toFixed(0)} / {scorecardResult.wcag21Score.perfectScore.toFixed(0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Percentage:</span>
                          <span className="font-medium">
                            {((scorecardResult.wcag21Score.score / scorecardResult.wcag21Score.perfectScore) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Impact Category Breakdown</h2>
                  <div className="space-y-4">
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h3 className="font-medium text-red-900 mb-3">Extremely Important Criteria</h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {scorecardResult.wcag21Score.extremelyImportantNotSupported}
                          </div>
                          <div className="text-xs text-gray-600">Not Supported</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">
                            {scorecardResult.wcag21Score.extremelyImportantPartiallySupports}
                          </div>
                          <div className="text-xs text-gray-600">Partial</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {scorecardResult.wcag21Score.extremelyImportantSupports}
                          </div>
                          <div className="text-xs text-gray-600">Supports</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h3 className="font-medium text-yellow-900 mb-3">Somewhat Important Criteria</h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {scorecardResult.wcag21Score.somewhatImportantNotSupported}
                          </div>
                          <div className="text-xs text-gray-600">Not Supported</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">
                            {scorecardResult.wcag21Score.somewhatImportantPartiallySupports}
                          </div>
                          <input
                            type="number"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="e.g., 30000"
                            value={annualCost}
                            onChange={(e) => setAnnualCost(parseInt(e.target.value) || 0)}
                          />
                          <p className="text-xs text-gray-500 mt-1">Crucial for grade calculation</p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {scorecardResult.wcag21Score.somewhatImportantSupports}
                          </div>
                          <div className="text-xs text-gray-600">Supports</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-3">Standard Criteria</h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {scorecardResult.wcag21Score.standardNotSupported}
                          </div>
                          <div className="text-xs text-gray-600">Not Supported</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">
                            {scorecardResult.wcag21Score.standardPartiallySupports}
                          </div>
                          <div className="text-xs text-gray-600">Partial</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {scorecardResult.wcag21Score.standardSupports}
                          </div>
                          <div className="text-xs text-gray-600">Supports</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <p className="text-gray-600 text-center">Calculating risk assessment...</p>
              </div>
            )}
          </div>
        )}

        {false && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Vendor Contact Information</h2>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-700">Product Name</label>
                  <p className="text-gray-900 mt-1">{submission.extractedData?.productName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Vendor Name</label>
                  <p className="text-gray-900 mt-1">{submission.extractedData?.vendorName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Product URL</label>
                  <p className="text-gray-900 mt-1">
                    {submission.extractedData?.productName ? 
                      <a href="#" className="text-blue-600 hover:underline">Visit Product Page</a> : 
                      'N/A'
                    }
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">VPAT Version</label>
                  <p className="text-gray-900 mt-1">{submission.extractedData?.vpatVersion || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Report Date</label>
                  <p className="text-gray-900 mt-1">{submission.extractedData?.reportDate || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Contact Email</label>
                  <p className="text-gray-900 mt-1">
                    {submission.extractedData?.vendorName ? 
                      <a href="mailto:support@vendor.com" className="text-blue-600 hover:underline">Contact Vendor</a> : 
                      'N/A'
                    }
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Accessibility Inquiries</h3>
                <p className="text-sm text-blue-700">
                  For accessibility questions or concerns, please contact the vendor directly using the information above. 
                  Ensure all accessibility issues are documented and tracked for compliance purposes.
                </p>
              </div>
            </div>
          </div>
        )}

        {false && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Processing Logs</h2>
            <div className="space-y-3">
              {submission.processingLog.map((log, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    log.status === 'success' ? 'bg-green-500' :
                    log.status === 'error' ? 'bg-red-500' :
                    log.status === 'warning' ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{log.step.replace(/_/g, ' ').toUpperCase()}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
