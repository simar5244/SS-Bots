'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Bot {
  id: string
  name: string
  dbType: string
  isConnected: boolean
  lastScanned?: string
  createdAt: string
}

interface VPATBot {
  id: string
  name: string
  botType: 'vpat'
  shareableLink: string
  isActive: boolean
  processedCount: number
  createdAt: number
  updatedAt: number
}

interface TranscriptBot {
  id: string
  name: string
  botType: 'transcript'
  shareableLink: string
  isActive: boolean
  evaluationCount: number
  createdAt: number
  updatedAt: number
}

export default function Dashboard() {
  const router = useRouter()
  const [bots, setBots] = useState<Bot[]>([])
  const [vpatBots, setVpatBots] = useState<VPATBot[]>([])
  const [transcriptBots, setTranscriptBots] = useState<TranscriptBot[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (!token) {
      router.push('/login')
      return
    }

    if (userData) {
      setUser(JSON.parse(userData))
    }

    fetchBots(token)
    fetchVPATBots(token)
    fetchTranscriptBots(token)
  }, [])

  const fetchVPATBots = async (token: string) => {
    try {
      const res = await fetch('/api/vpat-bots', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        setVpatBots(data)
      }
    } catch (error) {
      console.error('Error fetching VPAT bots:', error)
    }
  }

  const fetchTranscriptBots = async (token: string) => {
    try {
      const res = await fetch('/api/transcript-bot', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        setTranscriptBots(data)
      }
    } catch (error) {
      console.error('Error fetching transcript bots:', error)
    }
  }

  const fetchBots = async (token: string) => {
    try {
      const res = await fetch('/api/bots', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        setBots(data)
      }
    } catch (error) {
      console.error('Error fetching bots:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      // Call logout API to clear server-side cookie
      await fetch('/api/auth/logout', {
        method: 'POST',
      })
    } catch (error) {
      console.error('Logout error:', error)
    }
    
    // Clear client-side storage
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <span className="text-2xl font-bold">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-black/60">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-black/60 hover:text-black transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Your Bots</h1>
            <p className="text-black/60">Create and manage your database intelligence bots</p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/create-transcript-bot">
              <button className="px-6 py-3 bg-white border-2 border-black text-black rounded-lg hover:bg-black hover:text-white transition-colors font-medium">
                Transcript Bot
              </button>
            </Link>
            <Link href="/dashboard/create-vpat-bot">
              <button className="px-6 py-3 bg-white border-2 border-black text-black rounded-lg hover:bg-black hover:text-white transition-colors font-medium">
                VPAT Bot
              </button>
            </Link>
            <Link href="/dashboard/create-bot">
              <button className="px-6 py-3 bg-white border-2 border-black text-black rounded-lg hover:bg-black hover:text-white transition-colors font-medium">
                Database Bot
              </button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin"></div>
          </div>
        ) : bots.length === 0 && vpatBots.length === 0 && transcriptBots.length === 0 ? (
          <div className="text-center py-20 border-2 border-black/10 rounded-2xl">
            <h2 className="text-2xl font-bold mb-2">No bots yet</h2>
            <p className="text-black/60 mb-6">Create your first bot to get started</p>
            <Link href="/dashboard/create-bot">
              <button className="px-6 py-3 bg-black text-white rounded-lg hover:bg-black/80 transition-colors font-medium">
                Create Your First Bot
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Regular Bots */}
            {bots.map((bot) => (
              <Link key={bot.id} href={`/dashboard/bot/${bot.id}`}>
                <div className="p-6 border-2 border-black/10 rounded-2xl hover:border-black/30 transition-all cursor-pointer group">
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-2xl font-bold">{bot.dbType.toUpperCase()}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      bot.isConnected 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {bot.isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{bot.name}</h3>
                  <p className="text-sm text-black/60">Click to chat</p>
                </div>
              </Link>
            ))}
            
            {/* VPAT Bots */}
            {vpatBots.map((vpatBot) => (
              <Link key={vpatBot.id} href={`/dashboard/vpat-bot/${vpatBot.id}`}>
                <div className="p-6 border-2 border-black/10 rounded-2xl hover:border-black/30 transition-all cursor-pointer group">
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-2xl font-bold">VPAT</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      vpatBot.isActive 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {vpatBot.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{vpatBot.name}</h3>
                  <p className="text-sm text-black/60 mb-2">Processed: {vpatBot.processedCount} documents</p>
                </div>
              </Link>
            ))}

            {/* Transcript Bots */}
            {transcriptBots.map((transcriptBot) => (
              <Link key={transcriptBot.id} href={`/dashboard/transcript-bot/${transcriptBot.id}`}>
                <div className="p-6 border-2 border-blue-200 rounded-2xl hover:border-blue-400 transition-all cursor-pointer group bg-blue-50">
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-2xl font-bold text-blue-600">TRANSCRIPT</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      transcriptBot.isActive 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {transcriptBot.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{transcriptBot.name}</h3>
                  <p className="text-sm text-black/60 mb-2">Evaluations: {transcriptBot.evaluationCount}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
