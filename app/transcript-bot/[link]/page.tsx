'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  TrendingUp,
  Award,
  Clock,
  ArrowLeft
} from 'lucide-react'

export default function TranscriptBotPublicPage() {
  const params = useParams()
  const router = useRouter()
  const link = params.link as string

  const [bot, setBot] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [selectedProgram, setSelectedProgram] = useState('')
  const [transcriptFiles, setTranscriptFiles] = useState<File[]>([])
  const [evaluationId, setEvaluationId] = useState<string | null>(null)
  const [evaluation, setEvaluation] = useState<any>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [batchResults, setBatchResults] = useState<any[]>([])
  const [isBatch, setIsBatch] = useState(false)
  const [expandedResult, setExpandedResult] = useState<number | null>(null)

  useEffect(() => {
    fetchBotInfo()
  }, [link])

  useEffect(() => {
    if (evaluationId && !evaluation) {
      startPolling()
    }
    return () => {
      if (pollingInterval) clearInterval(pollingInterval)
    }
  }, [evaluationId])

  const fetchBotInfo = async () => {
    try {
      const response = await fetch(`/api/transcript-bot/submit/${link}`)
      if (response.ok) {
        const data = await response.json()
        setBot(data)
        if (data.programs.length > 0) {
          setSelectedProgram(data.programs[0].name)
        }
      } else {
        setError('Bot not found or inactive')
      }
    } catch (err) {
      setError('Failed to load bot information')
    } finally {
      setLoading(false)
    }
  }

  const startPolling = () => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/transcript-bot/evaluation/${evaluationId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.status === 'completed' || data.status === 'failed') {
            setEvaluation(data)
            if (pollingInterval) clearInterval(pollingInterval)
          }
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 3000)
    setPollingInterval(interval)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setTranscriptFiles(Array.from(e.target.files))
      setError('')
    }
  }

  const handleSubmit = async () => {
    if (!selectedProgram || transcriptFiles.length === 0) {
      setError('Please select a program and upload at least one transcript')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('programName', selectedProgram)
      transcriptFiles.forEach((file) => {
        formData.append('transcripts', file)
      })

      const response = await fetch(`/api/transcript-bot/submit/${link}`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Submission failed')
      }

      const result = await response.json()
      
      if (result.isBatch) {
        setIsBatch(true)
        setBatchResults(result.evaluationResults || [])
      } else {
        setEvaluationId(result.evaluationId)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    )
  }

  if (error && !bot) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Card className="p-8 max-w-md border border-gray-200">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle className="w-6 h-6" />
            <p>{error}</p>
          </div>
        </Card>
      </div>
    )
  }

  if (isBatch && batchResults.length > 0) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-black/10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-black/5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Batch Evaluation Complete
            </h1>
            <p className="text-gray-600">
              Processed {batchResults.length} transcripts
            </p>
          </div>

          <div className="space-y-6">
            {batchResults.map((result: any, idx: number) => (
              <div key={result.id} className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-black transition-colors cursor-pointer" onClick={() => setExpandedResult(expandedResult === idx ? null : idx)}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Student {idx + 1}: {result.studentTranscripts[0]?.fileName || 'Transcript'}
                  </h3>
                  {result.finalReport?.eligibility === 'eligible' ? (
                    <Badge className="bg-green-500 text-white">Eligible</Badge>
                  ) : result.finalReport?.eligibility === 'conditional' ? (
                    <Badge className="bg-yellow-500 text-white">Conditional</Badge>
                  ) : (
                    <Badge className="bg-red-500 text-white">Not Eligible</Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Completion</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {result.requirementEvaluation?.completionPercentage?.toFixed(0) || 0}%
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Courses Matched</p>
                    <p className="text-2xl font-bold text-green-600">
                      {result.requirementEvaluation?.coursesMatched || 0} / {result.requirementEvaluation?.totalCoursesRequired || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Missing Courses</p>
                    <p className="text-2xl font-bold text-red-600">
                      {result.finalReport?.missingCourses?.length || 0}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Summary</p>
                  <p className="text-sm text-gray-600">
                    {result.finalReport?.summary || 'No summary available'}
                  </p>
                </div>

                {result.finalReport?.missingCourses && result.finalReport.missingCourses.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Missing Courses:</p>
                    <div className="flex flex-wrap gap-2">
                      {(expandedResult === idx ? result.finalReport.missingCourses : result.finalReport.missingCourses.slice(0, 5)).map((course: string, i: number) => (
                        <Badge key={i} className="bg-red-100 text-red-800 border border-red-300">
                          {course}
                        </Badge>
                      ))}
                      {result.finalReport.missingCourses.length > 5 && expandedResult !== idx && (
                        <Badge className="bg-gray-100 text-gray-800">
                          +{result.finalReport.missingCourses.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {expandedResult === idx && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                    {result.requirementEvaluation?.unmetRequirements && result.requirementEvaluation.unmetRequirements.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Unmet Requirements</h4>
                        <div className="space-y-2">
                          {result.requirementEvaluation.unmetRequirements.map((req: any, i: number) => (
                            <div key={i} className="p-3 bg-red-50 rounded border border-red-200">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className="bg-red-600 text-white text-xs">{req.category}</Badge>
                                <span className="text-sm font-medium text-gray-900">{req.requirement}</span>
                              </div>
                              <p className="text-xs text-gray-700">{req.details}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.finalReport?.actionItems && result.finalReport.actionItems.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Action Items</h4>
                        <div className="space-y-2">
                          {result.finalReport.actionItems.map((item: any, i: number) => (
                            <div key={i} className="p-3 bg-blue-50 rounded border border-blue-200">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={item.priority === 'high' ? 'bg-red-600 text-white text-xs' : item.priority === 'medium' ? 'bg-yellow-600 text-white text-xs' : 'bg-gray-600 text-white text-xs'}>
                                  {item.priority}
                                </Badge>
                                <span className="text-sm font-medium text-gray-900">{item.action}</span>
                              </div>
                              {item.details && <p className="text-xs text-gray-700">{item.details}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 text-center pt-2">
                      Click to collapse details
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Button
              onClick={() => {
                setIsBatch(false)
                setBatchResults([])
                setTranscriptFiles([])
              }}
              className="bg-black hover:bg-gray-800 text-white"
            >
              Evaluate More Transcripts
            </Button>
          </div>
        </div>
        </div>
      </div>
    )
  }

  if (evaluation) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-black/10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-black/5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            {evaluation.status === 'completed' && evaluation.finalReport ? (
              <div className="space-y-8">
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    {evaluation.finalReport.eligibility === 'eligible' ? (
                      <CheckCircle className="w-16 h-16 text-green-500" />
                    ) : evaluation.finalReport.eligibility === 'conditional' ? (
                      <AlertCircle className="w-16 h-16 text-gray-600" />
                    ) : (
                      <AlertCircle className="w-16 h-16 text-red-500" />
                    )}
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Evaluation Complete
                  </h1>
                  <p className="text-lg text-gray-600">{evaluation.programName}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="p-6 bg-white border border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                      <TrendingUp className="w-6 h-6 text-gray-700" />
                      <h3 className="font-semibold text-gray-900">Completion</h3>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                      {evaluation.requirementEvaluation?.completionPercentage.toFixed(0)}%
                    </p>
                  </Card>

                  <Card className="p-6 bg-white border border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <h3 className="font-semibold text-gray-900">Courses Matched</h3>
                    </div>
                    <p className="text-3xl font-bold text-green-600">
                      {evaluation.requirementEvaluation?.coursesMatched} / {evaluation.requirementEvaluation?.totalCoursesRequired}
                    </p>
                  </Card>

                  <Card className="p-6 bg-white border border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                      <Award className="w-6 h-6 text-gray-700" />
                      <h3 className="font-semibold text-gray-900">Eligibility</h3>
                    </div>
                    <Badge
                      className={
                        evaluation.finalReport.eligibility === 'eligible'
                          ? 'bg-green-500 text-lg px-4 py-1'
                          : evaluation.finalReport.eligibility === 'conditional'
                          ? 'bg-gray-500 text-white text-lg px-4 py-1'
                          : 'bg-red-500 text-lg px-4 py-1'
                      }
                    >
                      {evaluation.finalReport.eligibility === 'eligible' 
                        ? 'Eligible' 
                        : evaluation.finalReport.eligibility === 'conditional' 
                        ? 'Conditional' 
                        : 'Not Eligible'}
                    </Badge>
                  </Card>
                </div>

                <Card className="p-6 bg-white border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Summary</h3>
                  <p className="text-gray-700 leading-relaxed">
                    {evaluation.finalReport.summary}
                  </p>
                </Card>

                {evaluation.finalReport.missingCourses && evaluation.finalReport.missingCourses.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Missing Courses</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {evaluation.finalReport.missingCourses.map((course: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-3 bg-red-50 rounded border border-red-200">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm text-red-900">{course}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {evaluation.finalReport.actionItems && evaluation.finalReport.actionItems.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Action Items</h3>
                    <div className="space-y-3">
                      {evaluation.finalReport.actionItems.map((item: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 rounded border">
                          <Badge
                            className={
                              item.priority === 'high'
                                ? 'bg-red-500'
                                : item.priority === 'medium'
                                ? 'bg-gray-500'
                                : 'bg-gray-400'
                            }
                          >
                            {item.priority}
                          </Badge>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.action}</p>
                            {item.details && (
                              <p className="text-sm text-gray-600 mt-1">{item.details}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {evaluation.requirementEvaluation?.unmetRequirements && evaluation.requirementEvaluation.unmetRequirements.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Unmet Requirements</h3>
                    <div className="space-y-3">
                      {evaluation.requirementEvaluation.unmetRequirements.map((req: any, i: number) => (
                        <div key={i} className="p-4 bg-gray-50 rounded border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="border-gray-300 text-gray-700">{req.category}</Badge>
                            <span className="font-medium text-gray-900">{req.requirement}</span>
                          </div>
                          <p className="text-sm text-gray-700">{req.details}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <div className="text-center pt-6 border-t">
                  <p className="text-sm text-gray-500">
                    Evaluation completed on {new Date(evaluation.completedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Evaluation Failed</h2>
                <p className="text-gray-600">
                  There was an error processing your transcripts. Please try again or contact support.
                </p>
              </div>
            )}
        </div>
        </div>
      </div>
    )
  }

  if (evaluationId) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-black/10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-black/5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[calc(100vh-73px)]">
          <Card className="p-12 max-w-md text-center border border-gray-200">
            <Loader2 className="w-16 h-16 animate-spin text-black mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Your Transcripts</h2>
            <p className="text-gray-600 mb-4">
              This may take a few minutes. Please don't close this page.
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <p>✓ Parsing transcripts</p>
              <p>✓ Matching courses with TCCNS</p>
              <p>✓ Evaluating requirements</p>
              <p className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 animate-pulse" />
                Generating report...
              </p>
            </div>
        </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-black/5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
      </header>
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{bot.name}</h1>
            <p className="text-lg text-gray-600">
              Upload your transcripts for degree requirement evaluation
            </p>
          </div>

        <div className="p-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Program
              </label>
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {bot.programs.map((program: any) => (
                  <option key={program.code} value={program.name}>
                    {program.name} ({program.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Transcripts (PDF or Excel)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors">
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xls,.docx"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="transcript-upload"
                />
                <label
                  htmlFor="transcript-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="w-12 h-12 text-gray-400 mb-4" />
                  <span className="text-sm text-gray-600 mb-2">
                    {transcriptFiles.length > 0
                      ? `${transcriptFiles.length} file(s) selected`
                      : 'Click to upload or drag and drop'}
                  </span>
                  <span className="text-xs text-gray-500">
                    PDF or Excel files (up to 100 transcripts)
                  </span>
                </label>
              </div>

              {transcriptFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {transcriptFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
                      <FileText className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700 flex-1">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedProgram || transcriptFiles.length === 0}
              className="w-full bg-black hover:bg-gray-800 text-white py-6 text-lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit for Evaluation'
              )}
            </Button>

            <div className="text-center text-xs text-gray-500 pt-4 border-t">
              <p>
                Your transcripts will be analyzed using AI and matched against Texas Tech's
                transfer credit database (TCCNS). Results typically available in 2-5 minutes.
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
