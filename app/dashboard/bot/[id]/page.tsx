'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Brain, ArrowLeft, Send, Database, Eye, FileText, BarChart3 } from 'lucide-react'
import DatabaseViewer from '@/components/DatabaseViewer'
import ReportBuilder from '@/components/ReportBuilder'
import ChartRenderer from '@/components/ChartRenderer'
import { ChartConfig } from '@/lib/chart-service'

interface Message {
  role: 'user' | 'assistant'
  content: string
  metadata?: any
  charts?: ChartConfig[]
}

export default function BotChat({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [bot, setBot] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDatabaseViewer, setShowDatabaseViewer] = useState(false)
  const [showReportBuilder, setShowReportBuilder] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    fetchBot(token)
  }, [params.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchBot = async (token: string) => {
    try {
      const res = await fetch('/api/bots', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (res.ok) {
        const bots = await res.json()
        const currentBot = bots.find((b: any) => b.id === params.id)
        setBot(currentBot)
      }
    } catch (error) {
      console.error('Error fetching bot:', error)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages([...messages, userMessage])
    const currentInput = input
    setInput('')
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      
      // Get chat response
      const res = await fetch(`/api/bots/${params.id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query: currentInput }),
      })

      const data = await res.json()

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        metadata: data.metadata
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!bot) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-white text-black flex flex-col">
      <header className="border-b border-black/10 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <button className="p-2 hover:bg-black/5 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8" />
              <div>
                <h1 className="text-xl font-bold">{bot.name}</h1>
                <p className="text-sm text-black/60">{bot.dbType.toUpperCase()}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReportBuilder(true)}
              className="px-4 py-2 border border-black/10 rounded-lg hover:bg-black/5 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <FileText className="w-4 h-4" />
              Generate Report
            </button>
            <button
              onClick={() => setShowDatabaseViewer(true)}
              className="px-4 py-2 border border-black/10 rounded-lg hover:bg-black/5 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Eye className="w-4 h-4" />
              View Database
            </button>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              bot.isConnected 
                ? 'bg-green-500/10 text-green-600' 
                : 'bg-red-500/10 text-red-600'
            }`}>
              {bot.isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {messages.length === 0 ? (
            <div className="text-center py-20">
              <Brain className="w-16 h-16 mx-auto mb-4 text-black/40" />
              <h2 className="text-2xl font-bold mb-2">Ask me anything about your database</h2>
              <p className="text-black/60 mb-8">I can help you analyze data, generate insights, and answer questions in natural language.</p>
              <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <button
                  onClick={() => setInput('What are the top 5 customers by revenue?')}
                  className="p-4 border border-black/10 rounded-lg hover:border-black/20 transition-colors text-left"
                >
                  <div className="font-medium mb-1">Top Customers</div>
                  <div className="text-sm text-black/60">Find highest revenue customers</div>
                </button>
                <button
                  onClick={() => setInput('Show me sales trends for the last 6 months')}
                  className="p-4 border border-black/10 rounded-lg hover:border-black/20 transition-colors text-left"
                >
                  <div className="font-medium mb-1">Sales Trends</div>
                  <div className="text-sm text-black/60">Analyze recent performance</div>
                </button>
                <button
                  onClick={() => setInput('Which products have the lowest inventory?')}
                  className="p-4 border border-black/10 rounded-lg hover:border-black/20 transition-colors text-left"
                >
                  <div className="font-medium mb-1">Inventory Check</div>
                  <div className="text-sm text-black/60">Monitor stock levels</div>
                </button>
                <button
                  onClick={() => setInput('Compare revenue across different regions')}
                  className="p-4 border border-black/10 rounded-lg hover:border-black/20 transition-colors text-left"
                >
                  <div className="font-medium mb-1">Regional Analysis</div>
                  <div className="text-sm text-black/60">Geographic performance</div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-3xl px-6 py-4 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-black text-white'
                        : 'bg-black/5 border border-black/10'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-3xl px-6 py-4 rounded-2xl bg-black/5 border border-black/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-black rounded-full animate-pulse delay-75"></div>
                      <div className="w-2 h-2 bg-black rounded-full animate-pulse delay-150"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-black/10 flex-shrink-0">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your data..."
              className="flex-1 px-6 py-4 bg-white border-2 border-black/10 rounded-2xl focus:outline-none focus:border-black transition-colors"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-8 py-4 bg-black text-white rounded-2xl hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
            >
              <Send className="w-5 h-5" />
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Database Viewer Modal */}
      {showDatabaseViewer && (
        <DatabaseViewer
          botId={params.id}
          onClose={() => setShowDatabaseViewer(false)}
        />
      )}

      {/* Report Builder Modal */}
      {showReportBuilder && (
        <ReportBuilder
          botId={params.id}
          onClose={() => setShowReportBuilder(false)}
        />
      )}
    </div>
  )
}
