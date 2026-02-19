'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

export default function VPATSubmitPage() {
  const params = useParams()
  const link = params.link as string
  
  const [botInfo, setBotInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [files, setFiles] = useState<File[]>([])
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
      setError('')
    }
  }

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
      
      if (files.length === 1) {
        // Single file submission
        formData.append('document', files[0])
      } else {
        // Multiple file submission
        files.forEach(file => formData.append('documents', file))
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
            <h1 className="text-2xl font-bold">{botInfo?.name}</h1>
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
          <h1 className="text-2xl font-bold">{botInfo?.name}</h1>
          <p className="text-black/60 mt-1">VPAT Document Evaluation</p>
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



          <div className="border-2 border-dashed border-black/20 rounded-lg p-12 text-center hover:border-black/40 transition-colors">
            <input
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.json,.txt"
              multiple
              className="hidden"
              id="vpat-upload"
            />
            <label htmlFor="vpat-upload" className="cursor-pointer">
              {files.length > 0 ? (
                <div>
                  <div className="text-6xl mb-4">📄</div>
                  <p className="text-xl font-bold mb-2">
                    {files.length === 1 ? files[0].name : `${files.length} files selected`}
                  </p>
                  <p className="text-black/60">
                    {files.length === 1 
                      ? `${(files[0].size / 1024 / 1024).toFixed(2)} MB`
                      : `${files.reduce((total, f) => total + f.size, 0) / 1024 / 1024} MB total`
                    }
                  </p>
                  <p className="text-sm text-black/40 mt-4">
                    {files.length === 1 ? 'Click to change file' : 'Click to change files'}
                  </p>
                  {files.length > 1 && (
                    <div className="mt-4 text-sm text-black/60">
                      <p>Files:</p>
                      <ul className="mt-2 space-y-1">
                        {files.map((f, i) => (
                          <li key={i} className="text-xs">• {f.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-6xl mb-4">📤</div>
                  <p className="text-xl font-bold mb-2">Click to upload VPAT document(s)</p>
                  <p className="text-black/60">
                    or drag and drop
                  </p>
                  <p className="text-sm text-black/40 mt-4">
                    Any format accepted • Up to 10 files • No size limit
                  </p>
                </div>
              )}
            </label>
          </div>

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
