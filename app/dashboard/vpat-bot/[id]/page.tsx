'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface VPATBot {
  id: string
  name: string
  shareableLink: string
  isActive: boolean
  processedCount: number
}

interface VPATSubmission {
  id: string
  vpatBotId: string
  submittedDocument: {
    fileName: string
    uploadedAt: number
  }
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'needs_review'
  extractedData?: {
    productName?: string
    vendorName?: string
  }
}

export default function VPATBotDetail() {
  const params = useParams()
  const router = useRouter()
  const [bot, setBot] = useState<VPATBot | null>(null)
  const [submissions, setSubmissions] = useState<VPATSubmission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBotAndSubmissions()
  }, [params.id])

  const loadBotAndSubmissions = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      // Fetch bot details
      const botRes = await fetch(`/api/vpat-bots/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!botRes.ok) {
        throw new Error('Failed to fetch bot')
      }

      const botData = await botRes.json()
      setBot(botData)

      // Fetch submissions
      const submissionsRes = await fetch(`/api/vpat-bots/${params.id}/submissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!submissionsRes.ok) {
        throw new Error('Failed to fetch submissions')
      }

      const submissionsData = await submissionsRes.json()
      setSubmissions(submissionsData)
    } catch (error) {
      console.error('Error loading bot:', error)
      alert('Failed to load bot details')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-600" />
      case 'needs_review':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />
      default:
        return <Clock className="w-5 h-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700'
      case 'failed':
        return 'bg-red-100 text-red-700'
      case 'processing':
        return 'bg-blue-100 text-blue-700'
      case 'needs_review':
        return 'bg-yellow-100 text-yellow-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-black/60">Loading bot details...</p>
        </div>
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-black/60 mb-4">Bot not found</p>
          <Link href="/dashboard">
            <button className="px-6 py-3 bg-black text-white rounded-lg hover:bg-black/80">
              Back to Dashboard
            </button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <button className="p-2 hover:bg-black/5 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{bot.name}</h1>
              <p className="text-sm text-black/60">VPAT Bot</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href={`/vpat/submit/${bot.shareableLink}`}>
              <button className="px-6 py-3 bg-black text-white rounded-lg hover:bg-black/80 transition-colors font-medium">
                Use Bot
              </button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Submissions</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              bot.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {bot.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-black/10 rounded-lg">
            <FileText className="w-12 h-12 text-black/20 mx-auto mb-4" />
            <p className="text-black/60 mb-4">No submissions yet</p>
            <button
              onClick={() => window.open(`/vpat/submit/${bot.shareableLink}`, '_blank')}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-black/80 transition-colors font-medium"
            >
              Submit First Document
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <Link
                key={submission.id}
                href={`/dashboard/vpat-submission/${submission.id}`}
              >
                <div className="p-6 border-2 border-black/10 rounded-lg hover:border-black/30 transition-all cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(submission.status)}
                        <h3 className="font-bold text-lg">
                          {submission.extractedData?.productName || submission.submittedDocument.fileName}
                        </h3>
                      </div>
                      {submission.extractedData?.vendorName && (
                        <p className="text-sm text-black/60 mb-2">
                          Vendor: {submission.extractedData.vendorName}
                        </p>
                      )}
                      <p className="text-sm text-black/60">
                        {submission.submittedDocument.fileName} • {new Date(submission.submittedDocument.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                      {submission.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
