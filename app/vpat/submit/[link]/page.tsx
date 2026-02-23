'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function VPATSubmitPage() {
  const params = useParams()
  const router = useRouter()
  const link = params.link as string
  
  const [botInfo, setBotInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [files, setFiles] = useState<File[]>([])
  const [fileImpactData, setFileImpactData] = useState<{[key: string]: {
    numberOfStudents?: number
    numberOfStaff?: number
    cost?: number
    isPublicUse?: boolean
    documentDate?: string
    vpatVersion?: string
  }}>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submissionId, setSubmissionId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchBotInfo()
  }, [link])

  const fetchBotInfo = async () => {
    try {
      const res = await fetch(`/api/vpat/submit/${link}`)
      if (res.ok) {
        const data = await res.json()
        setBotInfo(data)
      } else {
        setError('Invalid or inactive VPAT bot link')
      }
    } catch (err) {
      setError('Failed to load VPAT bot')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles(selectedFiles)
      
      const initialImpactData: {[key: string]: {
        numberOfStudents?: number
        numberOfStaff?: number
        cost?: number
        isPublicUse?: boolean
        documentDate?: string
        vpatVersion?: string
      }} = {}
      selectedFiles.forEach(file => {
        initialImpactData[file.name] = {
          numberOfStudents: 0,
          numberOfStaff: 0,
          cost: 0,
          isPublicUse: false,
          documentDate: undefined,
          vpatVersion: undefined
        }
      })
      setFileImpactData(initialImpactData)
      setError('')
    }
  }

  const updateImpactData = (
    fileName: string,
    field: 'numberOfStudents' | 'numberOfStaff' | 'cost' | 'isPublicUse' | 'documentDate' | 'vpatVersion',
    value: string
  ) => {
    setFileImpactData(prev => ({
      ...prev,
      [fileName]: {
        ...prev[fileName],
        [field]: field === 'documentDate' || field === 'vpatVersion'
          ? (value === '' ? undefined : value)
          : field === 'isPublicUse'
            ? value === 'Yes'
            : (value === '' ? undefined : parseFloat(value))
      }
    }))
  }

  const normalizeImpactData = (impact?: {
    numberOfStudents?: number
    numberOfStaff?: number
    cost?: number
    isPublicUse?: boolean
    documentDate?: string
    vpatVersion?: string
  }) => ({
    numberOfStudents: impact?.numberOfStudents ?? 0,
    numberOfStaff: impact?.numberOfStaff ?? 0,
    cost: impact?.cost ?? 0,
    isPublicUse: impact?.isPublicUse ?? false,
    documentDate: impact?.documentDate || '0',
    vpatVersion: impact?.vpatVersion || '0'
  })

  const handleSubmit = async () => {
    if (files.length === 0) {
      setError('Please select at least one file to upload')
      return
    }

    if (files.length > 10) {
      setError('Maximum 10 files allowed per batch')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const formData = new FormData()
      const normalizedImpactDataMap: {[key: string]: ReturnType<typeof normalizeImpactData>} = {}

      files.forEach((file) => {
        normalizedImpactDataMap[file.name] = normalizeImpactData(fileImpactData[file.name])
      })
      
      if (files.length === 1) {
        // Single file submission
        formData.append('document', files[0])
        formData.append('impactData', JSON.stringify(normalizedImpactDataMap[files[0].name]))
      } else {
        // Multiple file submission
        files.forEach(file => formData.append('documents', file))
        formData.append('impactDataMap', JSON.stringify(normalizedImpactDataMap))
      }

      const res = await fetch(`/api/vpat/submit/${link}`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error('Failed to submit document(s)')
      }

      const data = await res.json()
      
      if (data.isBatch) {
        // For batch submissions, wait a moment then redirect to first submission
        setTimeout(() => {
          window.location.href = `/dashboard/vpat-submission/${data.submissions[0].id}`
        }, 3000) // Increased delay to 3 seconds
      } else {
        setSubmissionId(data.submissionId)
        // Redirect to dashboard results page after 2 seconds
        setTimeout(() => {
          window.location.href = `/dashboard/vpat-submission/${data.submissionId}`
        }, 2000)
      }
    } catch (err) {
      setError('Failed to submit document(s). Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error && !botInfo) {
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

  if (submitted) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-black/10">
          <div className="max-w-4xl mx-auto px-6 py-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-black/5 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold">{botInfo?.name}</h1>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-12">
          <div className="text-center space-y-6">
            <div className="text-6xl">✅</div>
            <h2 className="text-3xl font-bold">Submission Received!</h2>
            <p className="text-black/60 text-lg">
              {files.length === 1 
                ? 'Your VPAT document has been uploaded and is being processed.'
                : `Your ${files.length} VPAT documents have been uploaded and are being processed simultaneously.`
              }
            </p>

            <div className="bg-black/5 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-sm font-medium mb-2">
                {files.length === 1 ? 'Submission ID' : 'Batch ID'}
              </p>
              <p className="font-mono text-sm text-black/60">
                {files.length === 1 ? submissionId : 'Processing...'}
              </p>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-sm text-blue-900">
                🔄 Redirecting to results page in {files.length === 1 ? '2' : '3'} seconds...
              </p>
            </div>

            <div className="space-y-3 text-left max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔍</span>
                <div>
                  <p className="font-medium">AI Analysis</p>
                  <p className="text-sm text-black/60">
                    {files.length === 1 
                      ? 'Extracting VPAT metadata and WCAG criteria'
                      : `Extracting metadata from ${files.length} documents simultaneously`
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-2xl">✓</span>
                <div>
                  <p className="font-medium">Validation</p>
                  <p className="text-sm text-black/60">Checking compliance requirements</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <p className="font-medium">Scorecard Generation</p>
                  <p className="text-sm text-black/60">Creating professional evaluation report{files.length > 1 ? 's' : ''}</p>
                </div>
              </div>

              {files.length > 1 && (
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🔄</span>
                  <div>
                    <p className="font-medium">Navigation</p>
                    <p className="text-sm text-black/60">Use arrow keys to navigate between reports</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <span className="text-2xl">📧</span>
                <div>
                  <p className="font-medium">Notification</p>
                  <p className="text-sm text-black/60">Results will be sent via email when complete</p>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={() => {
                  setSubmitted(false)
                  setFiles([])
                  setSubmissionId('')
                }}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-black/80 transition-colors font-medium"
              >
                Submit Another Document
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-black/10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-black/5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">{botInfo?.name}</h1>
              <p className="text-black/60 mt-1">VPAT Document Evaluation</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Submit VPAT Document</h2>
            <p className="text-black/60">
              Upload your VPAT (Voluntary Product Accessibility Template) for automated evaluation and scorecard generation.
            </p>
          </div>



          <div className="border-2 border-dashed border-black/20 rounded-lg p-8 text-center hover:border-black/40 transition-colors">
            <input
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.json,.txt"
              multiple
              className="hidden"
              id="vpat-upload"
            />
            <label htmlFor="vpat-upload" className="cursor-pointer">
              {files.length === 0 ? (
                <div>
                  <div className="text-6xl mb-4">�</div>
                  <p className="text-xl font-bold mb-2">Click to upload VPAT document(s)</p>
                  <p className="text-black/60">or drag and drop</p>
                  <p className="text-sm text-black/40 mt-4">
                    Any format accepted • Up to 10 files • No size limit
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-4xl mb-2">📄</div>
                  <p className="text-lg font-bold mb-1">
                    {files.length === 1 ? '1 file selected' : `${files.length} files selected`}
                  </p>
                  <p className="text-sm text-black/40">Click to change files</p>
                </div>
              )}
            </label>
          </div>

          {files.length > 0 && (
            <div className="bg-white border-2 border-black/10 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4">Resource Information</h3>

              <div className="space-y-4">
                {files.map((file, index) => (
                  <div key={index} className="border border-black/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        <p className="text-xs text-black/60">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-black/70 mb-1">
                          Annual Cost ($) <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="e.g., 50000"
                          value={fileImpactData[file.name]?.cost ?? ''}
                          onChange={(e) => updateImpactData(file.name, 'cost', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-black/20 rounded-lg focus:outline-none focus:border-black transition-colors"
                        />
                        <p className="text-xs text-black/50 mt-1">Required pre-upload input. 0 means placeholder only.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black/70 mb-1">
                          Public Use? <span className="text-red-600">*</span>
                        </label>
                        <select
                          value={fileImpactData[file.name]?.isPublicUse ? 'Yes' : 'No'}
                          onChange={(e) => updateImpactData(file.name, 'isPublicUse', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-black/20 rounded-lg focus:outline-none focus:border-black transition-colors"
                        >
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </select>
                        <p className="text-xs text-black/50 mt-1">Required pre-upload input. Select actual production exposure.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black/70 mb-1">
                          Student Users (Annual) <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g., 40000"
                          value={fileImpactData[file.name]?.numberOfStudents ?? ''}
                          onChange={(e) => updateImpactData(file.name, 'numberOfStudents', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-black/20 rounded-lg focus:outline-none focus:border-black transition-colors"
                        />
                        <p className="text-xs text-black/50 mt-1">Required pre-upload input. 0 means placeholder only.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black/70 mb-1">
                          Staff Users (Annual) <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g., 150"
                          value={fileImpactData[file.name]?.numberOfStaff ?? ''}
                          onChange={(e) => updateImpactData(file.name, 'numberOfStaff', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-black/20 rounded-lg focus:outline-none focus:border-black transition-colors"
                        />
                        <p className="text-xs text-black/50 mt-1">Required pre-upload input. 0 means placeholder only.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black/70 mb-1">
                          Document Date <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="date"
                          value={fileImpactData[file.name]?.documentDate ?? ''}
                          onChange={(e) => updateImpactData(file.name, 'documentDate', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-black/20 rounded-lg focus:outline-none focus:border-black transition-colors"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-black/70 mb-1">
                          VPAT Version <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., 2.5"
                          value={fileImpactData[file.name]?.vpatVersion ?? ''}
                          onChange={(e) => updateImpactData(file.name, 'vpatVersion', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-black/20 rounded-lg focus:outline-none focus:border-black transition-colors"
                        />
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-red-900">
              <p className="font-medium">{error}</p>
            </div>
          )}



          <button
            onClick={handleSubmit}
            disabled={files.length === 0 || submitting}
            className="w-full py-4 bg-black text-white rounded-lg font-bold text-lg hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting 
              ? 'Processing...' 
              : files.length === 1 
                ? 'Submit for Evaluation' 
                : `Submit ${files.length} Documents for Evaluation`
            }
          </button>


        </div>
      </main>
    </div>
  )
}
