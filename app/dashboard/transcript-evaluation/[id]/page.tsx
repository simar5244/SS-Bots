'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react'
import Link from 'next/link'

interface TranscriptEvaluation {
  id: string
  transcriptBotId: string
  batchId?: string
  batchIndex?: number
  programName: string
  studentTranscripts: Array<{
    fileName: string
    fileSize: number
    fileType: string
    uploadedAt: number
  }>
  status: 'pending' | 'parsing' | 'matching' | 'evaluating' | 'completed' | 'failed'
  parsedTranscripts?: any[]
  tccnsMatching?: any[]
  requirementEvaluation?: any
  finalReport?: any
  processingLog: Array<{
    timestamp: number
    step: string
    status: string
    details?: string
  }>
  createdAt: number
  completedAt?: number
}

export default function TranscriptEvaluationPage() {
  const params = useParams()
  const router = useRouter()
  const [evaluation, setEvaluation] = useState<TranscriptEvaluation | null>(null)
  const [batchEvaluations, setBatchEvaluations] = useState<TranscriptEvaluation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvaluation()
  }, [params.id])

  const fetchEvaluation = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/transcript-evaluations/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setEvaluation(data)

        // If part of a batch, load all batch evaluations
        if (data.batchId) {
          await fetchBatchEvaluations(data.batchId)
        }
      }
    } catch (error) {
      console.error('Error fetching evaluation:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBatchEvaluations = async (batchId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/transcript-evaluations/batch/${batchId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setBatchEvaluations(data.evaluations || [])
      }
    } catch (error) {
      console.error('Error fetching batch evaluations:', error)
    }
  }

  const navigateToEvaluation = (direction: 'prev' | 'next') => {
    if (!evaluation || !evaluation.batchId || batchEvaluations.length === 0) return

    const currentIndex = batchEvaluations.findIndex(e => e.id === evaluation.id)
    if (currentIndex === -1) return

    let targetIndex
    if (direction === 'prev') {
      targetIndex = currentIndex > 0 ? currentIndex - 1 : batchEvaluations.length - 1
    } else {
      targetIndex = currentIndex < batchEvaluations.length - 1 ? currentIndex + 1 : 0
    }

    const targetEvaluation = batchEvaluations[targetIndex]
    if (targetEvaluation) {
      router.push(`/dashboard/transcript-evaluation/${targetEvaluation.id}`)
    }
  }

  const getCurrentEvaluationIndex = () => {
    if (!evaluation || !evaluation.batchId || batchEvaluations.length === 0) return -1
    return batchEvaluations.findIndex(e => e.id === evaluation.id)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'pending':
      case 'parsing':
      case 'matching':
      case 'evaluating':
        return <Clock className="w-5 h-5 text-yellow-500" />
      default:
        return <FileText className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'failed':
        return 'bg-red-500'
      case 'pending':
        return 'bg-gray-500'
      case 'parsing':
      case 'matching':
      case 'evaluating':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Evaluation not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <button className="px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors">
                Back to Dashboard
              </button>
            </Link>
            
            {/* Navigation arrows for batch evaluations */}
            {evaluation.batchId && batchEvaluations.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateToEvaluation('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600 font-medium min-w-[60px] text-center">
                  {getCurrentEvaluationIndex() + 1} / {batchEvaluations.length}
                </span>
                <button
                  onClick={() => navigateToEvaluation('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {getStatusIcon(evaluation.status)}
            <Badge className={getStatusColor(evaluation.status)}>
              {evaluation.status.toUpperCase()}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-white border border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Program</h3>
            <p className="text-2xl font-bold text-gray-900">{evaluation.programName}</p>
          </Card>

          <Card className="p-6 bg-white border border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Transcripts</h3>
            <p className="text-2xl font-bold text-gray-900">{evaluation.studentTranscripts.length}</p>
          </Card>

          <Card className="p-6 bg-white border border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Created</h3>
            <p className="text-lg font-semibold text-gray-900">
              {new Date(evaluation.createdAt).toLocaleDateString()}
            </p>
          </Card>
        </div>

        <Card className="p-6 mb-6 bg-white border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Uploaded Transcripts</h3>
          <div className="space-y-3">
            {evaluation.studentTranscripts.map((transcript, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">{transcript.fileName}</p>
                    <p className="text-sm text-gray-600">
                      {(transcript.fileSize / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="border-gray-300 text-gray-700">
                  {transcript.fileType}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {evaluation.finalReport && (
          <Card className="p-6 mb-6 bg-white border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Evaluation Report</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Eligibility
                </label>
                <Badge className={
                  evaluation.finalReport.eligibility === 'eligible' ? 'bg-green-500' :
                  evaluation.finalReport.eligibility === 'conditional' ? 'bg-yellow-500' :
                  'bg-red-500'
                }>
                  {evaluation.finalReport.eligibility === 'eligible' 
                    ? 'Eligible' 
                    : evaluation.finalReport.eligibility === 'conditional' 
                    ? 'Conditional' 
                    : 'Not Eligible'}
                </Badge>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Summary
                </label>
                <p className="text-gray-900">{evaluation.finalReport.summary}</p>
              </div>

              {evaluation.finalReport.missingCourses?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Missing Courses
                  </label>
                  <ul className="list-disc list-inside space-y-1">
                    {evaluation.finalReport.missingCourses.map((course: string, idx: number) => (
                      <li key={idx} className="text-gray-900">{course}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        )}

        <Card className="p-6 bg-white border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Log</h3>
          <div className="space-y-2">
            {evaluation.processingLog.map((log, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{log.step}</p>
                    <Badge variant="outline" className={
                      log.status === 'success' ? 'border-green-500 text-green-700' :
                      log.status === 'error' ? 'border-red-500 text-red-700' :
                      'border-gray-300 text-gray-700'
                    }>
                      {log.status}
                    </Badge>
                  </div>
                  {log.details && (
                    <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
