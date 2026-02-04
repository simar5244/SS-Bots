'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Download } from 'lucide-react'

interface VPATSubmission {
  id: string
  vpatBotId: string
  submittedDocument: {
    fileName: string
    fileSize: number
    fileType: string
    uploadedAt: number
  }
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'needs_review'
  extractedData?: {
    productName?: string
    vendorName?: string
    vpatVersion?: string
    wcagVersion?: string
    wcagLevel?: string
    criteria?: any[]
  }
  generatedScorecard?: {
    fileName: string
    generatedAt: number
    downloadUrl?: string
  }
}

export default function VPATViewer() {
  const params = useParams()
  const [submission, setSubmission] = useState<VPATSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageText, setPageText] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState<number | null>(null)

  useEffect(() => {
    const pageParam = typeof window !== 'undefined' 
      ? new URLSearchParams(window.location.search).get('page')
      : null
    if (pageParam) {
      const pageNum = parseInt(pageParam, 10)
      if (!isNaN(pageNum)) setCurrentPage(pageNum)
    }
  }, [])

  useEffect(() => {
    fetchSubmission()
  }, [params.id])

  const fetchSubmission = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/vpat-submissions/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!res.ok) throw new Error('Failed to fetch submission')

      const data = await res.json()
      setSubmission(data)
    } catch (error) {
      console.error('Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (submission?.submittedDocument.fileName) {
      loadDocumentText()
    }
  }, [submission])

  const loadDocumentText = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/vpat-submissions/${params.id}/document`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!res.ok) throw new Error('Failed to load document')

      const text = await res.text()
      console.log('Raw document text length:', text.length)
      
      // Check if text has page markers
      if (text.includes('--- PAGE')) {
        const pages = text.split('\n--- PAGE ').filter(Boolean).map((page, i) => {
          const cleanPage = page.replace(/^(\d+) ---\n/, '').trim()
          return cleanPage
        })
        console.log('Number of pages extracted with markers:', pages.length)
        setPageText(pages)
      } else {
        // If no page markers, split by reasonable chunk size
        const chunkSize = 2000
        const pages = []
        for (let i = 0; i < text.length; i += chunkSize) {
          pages.push(text.substring(i, i + chunkSize))
        }
        console.log('Number of pages created by chunking:', pages.length)
        setPageText(pages)
      }
    } catch (error) {
      console.error('Document load error:', error)
    }
  }

  useEffect(() => {
    if (currentPage && pageText.length > 0) {
      // Small delay to ensure the page content is rendered
      setTimeout(() => {
        const element = document.getElementById(`vpat-page-${currentPage}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          // Add a more visible highlight
          element.style.backgroundColor = '#fef3c7'
          element.style.border = '2px solid #f59e0b'
          element.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          element.style.padding = '16px'
          element.style.margin = '-16px'
          setTimeout(() => {
            element.style.backgroundColor = ''
            element.style.border = ''
            element.style.boxShadow = ''
            element.style.padding = ''
            element.style.margin = ''
          }, 3000)
        }
      }, 100)
    }
  }, [currentPage, pageText])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading VPAT document...</p>
        </div>
      </div>
    )
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">VPAT document not found</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to Dashboard
          </Link>
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
              <Link href={`/dashboard/vpat-submission/${params.id}`}>
                <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Submission
                </button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">VPAT Document Viewer</h1>
                <p className="text-sm text-gray-600">{submission.extractedData?.productName || submission.submittedDocument.fileName}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {currentPage && (
                <div className="text-sm text-gray-600">
                  Viewing Page <span className="font-bold text-gray-900">{currentPage}</span> of {pageText.length}
                </div>
              )}
              {submission.generatedScorecard?.downloadUrl && (
                <a
                  href={submission.generatedScorecard.downloadUrl}
                  download
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Scorecard
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <FileText className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">{submission.submittedDocument.fileName}</span>
                <span className="text-sm text-gray-500">
                  ({Math.round(submission.submittedDocument.fileSize / 1024)} KB)
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {pageText.length} pages
                {currentPage && (
                  <button
                    onClick={() => setCurrentPage(null)}
                    className="ml-4 text-blue-600 hover:underline"
                  >
                    Clear page view
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {pageText.map((page, index) => (
              <div
                key={index}
                id={`vpat-page-${index + 1}`}
                className="px-6 py-8 scroll-mt-4"
              >
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900">Page {index + 1}</h3>
                </div>
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap font-sans text-gray-900 leading-relaxed bg-white p-4 rounded border border-gray-200">
                    {page}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
