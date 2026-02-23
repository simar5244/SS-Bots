'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface VPATBotConfig {
  processingMethod: 'method1';
  requireWCAGLevel: string;
  strictMode: boolean;
  requireVPATVersion: string;
  notifyOnCompletion: boolean;
  notifyOnErrors: boolean;
  recipientEmail: string;
  autoApprove: boolean;
}

export default function CreateVPATBot() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [scorecardFile, setScorecardFile] = useState<File | null>(null)
  const [config, setConfig] = useState<VPATBotConfig>({
    processingMethod: 'method1',
    requireWCAGLevel: 'AA',
    strictMode: true,
    requireVPATVersion: '2.4',
    notifyOnCompletion: false,
    notifyOnErrors: false,
    recipientEmail: '',
    autoApprove: false,
  })
  const [loading, setLoading] = useState(false)
  const [shareableLink, setShareableLink] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setScorecardFile(e.target.files[0])
    }
  }

  const handleCreate = async () => {
    if (!name || !scorecardFile) return

    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('name', name)
      if (scorecardFile) {
        formData.append('scorecard', scorecardFile)
      }
      formData.append('config', JSON.stringify(config))

      const response = await fetch('/api/vpat-bots', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to create VPAT bot')
      }

      const bot = await response.json()
      setShareableLink(bot.shareableLink)
      setStep(2)
    } catch (error) {
      console.error('Create VPAT bot error:', error)
      alert('Failed to create VPAT bot')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button 
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 hover:bg-black/5 rounded-lg transition-colors"
          >
            Back
          </button>
          <span className="text-2xl font-bold">Create VPAT Bot</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Bot Details</h2>
              <p className="text-black/60">Choose processing method and configure your VPAT evaluation bot</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Bot Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="TTU VPAT Evaluator"
                className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Reference Scorecard</label>
              <div className="border-2 border-dashed border-black/20 rounded-lg p-8 text-center hover:border-black/40 transition-colors">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  id="scorecard-upload"
                />
                <label htmlFor="scorecard-upload" className="cursor-pointer">
                  {scorecardFile ? (
                    <div>
                      <div className="text-4xl mb-2">📊</div>
                      <p className="font-medium">{scorecardFile.name}</p>
                      <p className="text-sm text-black/60 mt-1">
                        {(scorecardFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl mb-2">📤</div>
                      <p className="font-medium">Click to upload scorecard</p>
                      <p className="text-sm text-black/60 mt-1">
                        Excel, CSV - Any format accepted
                      </p>
                    </div>
                  )}
                </label>
              </div>
              <p className="text-xs text-black/60 mt-2">
                Upload your reference scorecard template. The AI will match the structure and format when generating evaluations.
              </p>
            </div>

            <button
              onClick={handleCreate}
              disabled={!name || !scorecardFile || loading}
              className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Bot...' : 'Create VPAT Bot'}
            </button>
          </div>
        )}


        {step === 2 && (
          <div className="space-y-8">
            <div className="text-center">
              <div className="text-6xl mb-4"></div>
              <h2 className="text-3xl font-bold mb-2">VPAT Bot Created!</h2>
              <p className="text-black/60">Your bot is ready to accept VPAT submissions</p>
            </div>



              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-medium text-yellow-900">
                  ⚠️ <strong>Legal Compliance Notice:</strong> This bot uses AI for VPAT evaluation. All submissions should be reviewed by qualified accessibility professionals before making legal decisions.
                </p>
              </div>

            <div className="flex gap-4">
              <button 
                onClick={() => router.push(`/vpat/submit/${shareableLink}`)}
                className="flex-1 py-3 bg-black text-white rounded-lg font-medium hover:bg-black/80 transition-colors"
              >
                Use Bot
              </button>
              <button 
                onClick={() => router.push('/dashboard')}
                className="flex-1 py-3 bg-white border-2 border-black text-black rounded-lg font-medium hover:bg-black hover:text-white transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
