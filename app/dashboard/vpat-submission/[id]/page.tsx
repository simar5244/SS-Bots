'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import VPATCriteriaViewer from '@/components/VPATCriteriaViewer'
import { Download, ArrowLeft, CheckCircle, XCircle, AlertCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react'

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
  const [activeTab, setActiveTab] = useState<'overview' | 'criteria' | 'logs' | 'verification'>('overview')

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
          const intervalMs = 30000 // Increased to 30 seconds to reduce API calls
          pollingRef.current = setInterval(() => {
            fetchSubmission().then((updatedData) => {
              if (updatedData) {
                const updatedStatus = updatedData.status
                const updatedTerminal =
                  updatedStatus === 'completed' ||
                  updatedStatus === 'failed' ||
                  updatedStatus === 'needs_review'

                if (updatedTerminal && pollingRef.current) {
                  clearInterval(pollingRef.current)
                  pollingRef.current = null
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

  const fetchSubmission = async () => {
    try {
      const token = localStorage.getItem('token')
      
      if (!token) {
        console.error('No authentication token found')
        return null
      }
      
      const res = await fetch(`/api/vpat-submissions/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
      setSubmission(data)
      return data as VPATSubmission
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
                <p className="text-sm text-gray-600">{submission.extractedData?.productName || submission.submittedDocument.fileName}</p>
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
              Criteria Analysis ({submission.detailedScorecard?.rows?.length || submission.extractedData?.criteria?.length || 0})
            </button>
            {(submission.detailedScorecard?.verificationResult || submission.generatedScorecard?.analysis?.verificationResult) && (
              <button
                onClick={() => setActiveTab('verification')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'verification'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Verification Results
                {(submission.detailedScorecard?.verificationResult?.hasMistakes || submission.generatedScorecard?.analysis?.verificationResult?.hasMistakes) && (
                  <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                    Issues Found
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'logs'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Processing Logs
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
            {submission.generatedScorecard && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Generated Scorecard</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{submission.generatedScorecard.fileName}</p>
                    <p className="text-sm text-gray-600">
                      Generated {new Date(submission.generatedScorecard.generatedAt).toLocaleString()}
                    </p>
                  </div>
                  <a
                    href={submission.generatedScorecard.downloadUrl}
                    download
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Verification Tab */}
        {activeTab === 'verification' && (
          <div className="space-y-6">
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
        {activeTab === 'criteria' && submission.extractedData?.criteria && (
          <VPATCriteriaViewer
            criteria={submission.extractedData.criteria}
            productName={submission.extractedData.productName}
            submissionId={submission.id}
          />
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
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
