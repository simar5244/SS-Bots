'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Loader2 } from 'lucide-react'

interface PageModalProps {
  isOpen: boolean
  onClose: () => void
  submissionId: string
  pageNumber: number
}

export default function PageModal({ isOpen, onClose, submissionId, pageNumber }: PageModalProps) {
  const [pageContent, setPageContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (isOpen && submissionId && pageNumber) {
      fetchPageContent()
    }
  }, [isOpen, submissionId, pageNumber])

  const fetchPageContent = async () => {
    setLoading(true)
    setError('')
    
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/vpat-submissions/${submissionId}/page/${pageNumber}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!res.ok) {
        throw new Error('Failed to fetch page content')
      }

      const data = await res.json()
      setPageContent(data.content || '')
    } catch (error) {
      console.error('Error fetching page:', error)
      setError(error instanceof Error ? error.message : 'Failed to load page content')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Page {pageNumber}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[60vh]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading page content...</span>
              </div>
            ) : error ? (
              <div className="px-6 py-12 text-center">
                <div className="text-red-600 mb-2">Error: {error}</div>
                <button
                  onClick={fetchPageContent}
                  className="text-blue-600 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : pageContent ? (
              <div className="px-6 py-6">
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap font-sans text-gray-900 leading-relaxed bg-gray-50 p-6 rounded-lg border border-gray-200 text-sm">
                    {pageContent}
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-gray-500">
                No content available for page {pageNumber}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
