'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

export default function VPATResultsPage() {
  const params = useParams()
  const submissionId = params.id as string
  
  const [submission, setSubmission] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSubmission()
    const interval = setInterval(fetchSubmission, 3000)
    return () => clearInterval(interval)
  }, [submissionId])

  const fetchSubmission = async () => {
    try {
      const res = await fetch(`/api/vpat/submission/${submissionId}`)
      if (res.ok) {
        const data = await res.json()
        setSubmission(data)
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'needs_review') {
          clearInterval
        }
      } else {
        setError('Submission not found')
      }
    } catch (err) {
      setError('Failed to load submission')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-300'
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'needs_review': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'failed': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅'
      case 'processing': return '⏳'
      case 'needs_review': return '⚠️'
      case 'failed': return '❌'
      default: return '📄'
    }
  }

  if (loading && !submission) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-black/20 border-t-black rounded-full animate-spin mb-4"></div>
          <p className="text-black/60">Loading submission...</p>
        </div>
      </div>
    )
  }

  if (error && !submission) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p className="text-black/60">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-black/10">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold">VPAT Evaluation Results</h1>
          <p className="text-black/60 mt-1">Submission ID: {submissionId}</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Status Card */}
        <div className={`border-2 rounded-lg p-6 ${getStatusColor(submission?.status)}`}>
          <div className="flex items-center gap-4">
            <span className="text-4xl">{getStatusIcon(submission?.status)}</span>
            <div className="flex-1">
              <h2 className="text-xl font-bold capitalize">{submission?.status?.replace('_', ' ')}</h2>
              <p className="text-sm mt-1">
                {submission?.status === 'processing' && 'Your VPAT is being analyzed...'}
                {submission?.status === 'completed' && 'Evaluation completed successfully!'}
                {submission?.status === 'needs_review' && 'Manual review required'}
                {submission?.status === 'failed' && 'Processing failed'}
              </p>
            </div>
            {submission?.status === 'processing' && (
              <div className="w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
        </div>

        {/* Document Info */}
        <div className="border-2 border-black/10 rounded-lg p-6">
          <h3 className="font-bold text-lg mb-4">📄 Submitted Document</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-black/60">File Name</p>
              <p className="font-medium">{submission?.submittedDocument?.fileName}</p>
            </div>
            <div>
              <p className="text-black/60">File Size</p>
              <p className="font-medium">{(submission?.submittedDocument?.fileSize / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <div>
              <p className="text-black/60">File Type</p>
              <p className="font-medium">{submission?.submittedDocument?.fileType}</p>
            </div>
            <div>
              <p className="text-black/60">Uploaded</p>
              <p className="font-medium">{new Date(submission?.submittedDocument?.uploadedAt).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Extracted Data */}
        {submission?.extractedData && (
          <div className="border-2 border-black/10 rounded-lg p-6">
            <h3 className="font-bold text-lg mb-4">📊 Extracted VPAT Data</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-black/60">Product Name</p>
                <p className="font-medium">{submission.extractedData.productName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-black/60">Vendor Name</p>
                <p className="font-medium">{submission.extractedData.vendorName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-black/60">VPAT Version</p>
                <p className="font-medium">{submission.extractedData.vpatVersion || 'N/A'}</p>
              </div>
              <div>
                <p className="text-black/60">Report Date</p>
                <p className="font-medium">{submission.extractedData.reportDate || 'N/A'}</p>
              </div>
              <div>
                <p className="text-black/60">WCAG Version</p>
                <p className="font-medium">{submission.extractedData.wcagVersion || 'N/A'}</p>
              </div>
              <div>
                <p className="text-black/60">WCAG Level</p>
                <p className="font-medium">{submission.extractedData.wcagLevel || 'N/A'}</p>
              </div>
            </div>
            {submission.detailedScorecard && (
              <div className="mt-4 pt-4 border-t border-black/10">
                <p className="text-black/60 text-sm">Total Criteria</p>
                <p className="font-bold text-2xl">{submission.detailedScorecard.rows.length}</p>
              </div>
            )}
          </div>
        )}

        {/* Validation Results - REMOVED */}
        {/* AI Analysis - REMOVED */}

        {/* Processing Log */}
        {submission?.processingLog && submission.processingLog.length > 0 && (
          <div className="border-2 border-black/10 rounded-lg p-6">
            <h3 className="font-bold text-lg mb-4">📋 Processing Log</h3>
            <div className="space-y-2">
              {submission.processingLog.map((log: any, i: number) => (
                <div key={i} className="flex items-start gap-3 text-sm p-3 bg-black/5 rounded-lg">
                  <span className="text-lg">
                    {log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : log.status === 'warning' ? '⚠️' : '📌'}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{log.step.replace(/_/g, ' ').toUpperCase()}</p>
                    {log.details && <p className="text-black/60 text-xs mt-1">{log.details}</p>}
                  </div>
                  <span className="text-xs text-black/40">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scorecard Summary */}
        {submission?.generatedScorecard?.analysis && (
          <div className="border-2 border-black/10 rounded-lg p-6">
            <h3 className="font-bold text-lg mb-4">📊 Scorecard Summary</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-black/5 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold">{submission.generatedScorecard.analysis.overallScore}</p>
                <p className="text-sm text-black/60 mt-1">Overall Score</p>
              </div>
              <div className="bg-black/5 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold">{submission.generatedScorecard.analysis.compliancePercentage}%</p>
                <p className="text-sm text-black/60 mt-1">Compliance</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center border-2 border-green-200">
                <p className="text-3xl font-bold text-green-700">{submission.generatedScorecard.analysis.supports}</p>
                <p className="text-sm text-black/60 mt-1">Supports</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg text-center border-2 border-yellow-200">
                <p className="text-3xl font-bold text-yellow-700">{submission.generatedScorecard.analysis.partiallySupports}</p>
                <p className="text-sm text-black/60 mt-1">Partial</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                <p className="text-sm text-black/60">Level A</p>
                <p className="text-2xl font-bold text-blue-700">{submission.generatedScorecard.analysis.levelACompliance}%</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                <p className="text-sm text-black/60">Level AA</p>
                <p className="text-2xl font-bold text-blue-700">{submission.generatedScorecard.analysis.levelAACompliance}%</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                <p className="text-sm text-black/60">Level AAA</p>
                <p className="text-2xl font-bold text-blue-700">{submission.generatedScorecard.analysis.levelAAACompliance}%</p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div>
                <p className="font-medium">{submission.generatedScorecard.fileName}</p>
                <p className="text-sm text-black/60">
                  Generated {new Date(submission.generatedScorecard.generatedAt).toLocaleString()}
                </p>
                <p className="text-xs text-black/60 mt-1">
                  Includes: Summary, Detailed Criteria, Critical Issues, Strengths, Level Analysis
                </p>
              </div>
              {submission.generatedScorecard.downloadUrl && (
                <a 
                  href={submission.generatedScorecard.downloadUrl}
                  className="px-6 py-3 bg-black text-white rounded-lg hover:bg-black/80 transition-colors font-medium whitespace-nowrap"
                >
                  Download Excel
                </a>
              )}
            </div>
          </div>
        )}

        {/* Detailed Criteria Table */}
        {submission?.detailedScorecard?.rows && (
          <div className="border-2 border-black/10 rounded-lg p-6">
            <h3 className="font-bold text-lg mb-4">📋 Detailed Criteria Mapping</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black/5 border-b-2 border-black/10">
                    <th className="text-left p-3 font-bold">ID</th>
                    <th className="text-left p-3 font-bold">Criterion</th>
                    <th className="text-left p-3 font-bold">Level</th>
                    <th className="text-left p-3 font-bold">Submitted</th>
                    <th className="text-left p-3 font-bold">Scorecard</th>
                    <th className="text-left p-3 font-bold">Score</th>
                    <th className="text-left p-3 font-bold">Page #</th>
                    <th className="text-left p-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {submission.detailedScorecard.rows.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-black/5 hover:bg-black/5">
                      <td className="p-3 font-mono text-xs">{row.criterionId}</td>
                      <td className="p-3">{row.criterionName}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          row.level === 'A' ? 'bg-blue-100 text-blue-800' :
                          row.level === 'AA' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {row.level}
                        </span>
                      </td>
                      <td className="p-3 text-xs">{row.submittedConformance}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          row.scorecardEquivalent === 'Supports' ? 'bg-green-100 text-green-800' :
                          row.scorecardEquivalent === 'Partially Supports' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {row.scorecardEquivalent}
                        </span>
                      </td>
                      <td className="p-3 font-bold">{row.score}</td>
                      <td className="p-3">
                        {row.pageNumber ? (
                          <a
                            href={`/vpat/view/${submissionId}?page=${row.pageNumber}`}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            Page {row.pageNumber}
                          </a>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          row.status === 'Pass' ? 'bg-green-100 text-green-800' :
                          row.status === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                          row.status === 'Fail' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-xs text-black/60">
              <p>Total Criteria: {submission.detailedScorecard.rows.length}</p>
              <p className="mt-1">
                <strong>Scoring:</strong> Supports = 100, Partially Supports = 50, Does Not Support = 0
              </p>
            </div>
          </div>
        )}

        {/* Comparative Analysis */}
        {submission?.detailedScorecard?.analysis && (
          <div className="border-2 border-black/10 rounded-lg p-6">
            <h3 className="font-bold text-lg mb-4">📈 Comparative Analysis</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-bold mb-3 text-red-800">Critical Issues ({submission.detailedScorecard.analysis.criticalIssues.length})</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {submission.detailedScorecard.analysis.criticalIssues.map((issue: string, i: number) => (
                    <div key={i} className="bg-red-50 border-l-4 border-red-500 p-3 text-sm">
                      {issue}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold mb-3 text-green-800">Strengths ({submission.detailedScorecard.analysis.strengths.length})</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {submission.detailedScorecard.analysis.strengths.slice(0, 10).map((strength: string, i: number) => (
                    <div key={i} className="bg-green-50 border-l-4 border-green-500 p-3 text-sm">
                      {strength}
                    </div>
                  ))}
                  {submission.detailedScorecard.analysis.strengths.length > 10 && (
                    <p className="text-xs text-black/60 p-3">
                      + {submission.detailedScorecard.analysis.strengths.length - 10} more (see Excel download)
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
