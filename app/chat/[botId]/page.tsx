'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
  metadata?: any
}

export default function PublicBotChat({ params }: { params: { botId: string } }) {
  const router = useRouter()
  const [bot, setBot] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchBotInfo()
  }, [params.botId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchBotInfo = async () => {
    try {
      const res = await fetch(`/api/public/bots/${params.botId}`)
      if (res.ok) {
        const data = await res.json()
        setBot(data)
      } else {
        setError('Bot not found or not accessible')
      }
    } catch (error) {
      setError('Failed to load bot')
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages([...messages, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`/api/public/bots/${params.botId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: input }),
      })

      const data = await res.json()

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        metadata: data.metadata,
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

  if (error) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Bot Not Found</h1>
          <p className="text-black/60 mb-8">{error}</p>
          <Link href="/">
            <button className="px-8 py-3 bg-black text-white rounded-lg hover:bg-black/80 transition-colors">
              Go Home
            </button>
          </Link>
        </div>
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-white text-black flex flex-col">
      <header className="border-b border-black/10 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{bot.name}</h1>
            <p className="text-sm text-black/60">{bot.dbType.toUpperCase()}</p>
          </div>
          <Link href="/">
            <span className="text-lg font-bold">AI Services</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {messages.length === 0 ? (
            <div className="text-center py-20">
              <h2 className="text-3xl font-bold mb-4">Ask me anything about the database</h2>
              <p className="text-black/60 mb-8">I can help you analyze data and answer questions in natural language.</p>
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
              placeholder="Ask a question about the data..."
              className="flex-1 px-6 py-4 bg-white border-2 border-black/10 rounded-2xl focus:outline-none focus:border-black transition-colors"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-8 py-4 bg-black text-white rounded-2xl hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <footer className="py-3 text-center text-xs text-black/40 border-t border-black/5">
        <p>Made with ❤️ by Sim</p>
      </footer>
    </div>
  )
}
