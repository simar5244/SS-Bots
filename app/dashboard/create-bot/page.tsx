'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CreateBot() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [dbType, setDbType] = useState('postgresql')
  const [dbContext, setDbContext] = useState('')
  const [dbConfig, setDbConfig] = useState({
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    useSSH: false,
    sshConfig: {
      host: '',
      port: 22,
      username: '',
      password: '',
    },
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [botId, setBotId] = useState('')
  const [loading, setLoading] = useState(false)

  const handleDbTypeChange = (type: string) => {
    setDbType(type)
    const defaultPorts: any = {
      postgresql: 5432,
      mysql: 3306,
      mssql: 1433,
      mongodb: 27017,
      oracle: 1521,
      sharepoint: 443,
    }
    setDbConfig({ ...dbConfig, port: defaultPorts[type] || 5432 })
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    setErrorMessage('')

    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name, dbType, dbConfig }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to create bot')
      }

      const bot = await res.json()
      setBotId(bot.id)

      const testRes = await fetch(`/api/bots/${bot.id}/test-connection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      const testData = await testRes.json()

      if (testData.success) {
        setTestResult('success')
        setErrorMessage('')
      } else {
        setTestResult('error')
        setErrorMessage(testData.details || testData.error || 'Connection failed')
      }
    } catch (error) {
      setTestResult('error')
      setErrorMessage((error as Error).message)
      console.error('Test connection error:', error)
    } finally {
      setTesting(false)
    }
  }

  const handleContinue = async () => {
    if (testResult !== 'success') return

    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      
      // Update bot with context if provided
      if (dbContext) {
        await fetch(`/api/bots/${botId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ dbContext }),
        })
      }
      
      const res = await fetch(`/api/bots/${botId}/scan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (res.ok) {
        router.push(`/dashboard/bot/${botId}`)
      }
    } catch (error) {
      console.error('Scan error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard">
            <button className="px-4 py-2 hover:bg-black/5 rounded-lg transition-colors">
              Back
            </button>
          </Link>
          <span className="text-2xl font-bold">Create Bot</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Bot Details</h2>
              <p className="text-black/60">Give your bot a name and select database type</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Bot Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sales Analytics Bot"
                className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-4">Database Type</label>
              <div className="grid grid-cols-3 gap-4">
                {['postgresql', 'mysql', 'mssql', 'mongodb', 'oracle', 'sharepoint'].map((type) => (
                  <button
                    key={type}
                    onClick={() => handleDbTypeChange(type)}
                    className={`p-6 border-2 rounded-xl transition-all text-left ${
                      dbType === type
                        ? 'border-black bg-black text-white shadow-lg scale-105'
                        : 'border-black/20 hover:border-black/40 bg-white'
                    }`}
                  >
                    <div className={`text-xl font-bold mb-2 ${
                      dbType === type ? 'text-white' : 'text-black'
                    }`}>
                      {type === 'postgresql' && 'PostgreSQL'}
                      {type === 'mysql' && 'MySQL'}
                      {type === 'mssql' && 'SQL Server'}
                      {type === 'mongodb' && 'MongoDB'}
                      {type === 'oracle' && 'Oracle'}
                      {type === 'sharepoint' && 'SharePoint'}
                    </div>
                    <div className={`text-sm ${
                      dbType === type ? 'text-white/80' : 'text-black/60'
                    }`}>
                      {dbType === type && '✓ Selected'}
                      {dbType !== type && 'Click to select'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!name}
              className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Database Configuration</h2>
              <p className="text-black/60">Enter your database connection details</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Host</label>
                <input
                  type="text"
                  value={dbConfig.host}
                  onChange={(e) => setDbConfig({ ...dbConfig, host: e.target.value })}
                  placeholder="localhost"
                  className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Port</label>
                <input
                  type="number"
                  value={dbConfig.port}
                  onChange={(e) => setDbConfig({ ...dbConfig, port: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Database Name</label>
              <input
                type="text"
                value={dbConfig.database}
                onChange={(e) => setDbConfig({ ...dbConfig, database: e.target.value })}
                placeholder="my_database"
                className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Username</label>
                <input
                  type="text"
                  value={dbConfig.username}
                  onChange={(e) => setDbConfig({ ...dbConfig, username: e.target.value })}
                  placeholder="admin"
                  className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <input
                  type="password"
                  value={dbConfig.password}
                  onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                />
              </div>
            </div>

            <div className="border-2 border-black/10 rounded-lg p-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dbConfig.useSSH}
                  onChange={(e) => setDbConfig({ ...dbConfig, useSSH: e.target.checked })}
                  className="w-5 h-5"
                />
                <div>
                  <span className="font-medium">Use SSH Tunnel</span>
                  <p className="text-xs text-black/60 mt-1">
                    Only check this if you need the app to create an SSH tunnel. 
                    If you already have a tunnel running in terminal, leave this unchecked.
                  </p>
                </div>
              </label>

              {dbConfig.useSSH && (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">SSH Host</label>
                      <input
                        type="text"
                        value={dbConfig.sshConfig.host}
                        onChange={(e) => setDbConfig({
                          ...dbConfig,
                          sshConfig: { ...dbConfig.sshConfig, host: e.target.value }
                        })}
                        placeholder="ssh.example.com"
                        className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">SSH Port</label>
                      <input
                        type="number"
                        value={dbConfig.sshConfig.port}
                        onChange={(e) => setDbConfig({
                          ...dbConfig,
                          sshConfig: { ...dbConfig.sshConfig, port: parseInt(e.target.value) }
                        })}
                        className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">SSH Username</label>
                    <input
                      type="text"
                      value={dbConfig.sshConfig.username}
                      onChange={(e) => setDbConfig({
                        ...dbConfig,
                        sshConfig: { ...dbConfig.sshConfig, username: e.target.value }
                      })}
                      placeholder="ubuntu"
                      className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">SSH Password</label>
                    <input
                      type="password"
                      value={dbConfig.sshConfig.password}
                      onChange={(e) => setDbConfig({
                        ...dbConfig,
                        sshConfig: { ...dbConfig.sshConfig, password: e.target.value }
                      })}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>

            {testResult && (
              <div className={`p-4 rounded-lg border ${
                testResult === 'success'
                  ? 'bg-green-500/10 border-green-500/20 text-green-500'
                  : 'bg-red-500/10 border-red-500/20 text-red-500'
              }`}>
                {testResult === 'success' ? (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✓</span>
                    <span>Connection successful! Click Continue to scan your database.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">✗</span>
                      <span>Connection failed. Please check your credentials and try again.</span>
                    </div>
                    {errorMessage && (
                      <div className="text-sm pl-9 font-mono bg-black/5 p-2 rounded">
                        {errorMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {testResult === 'success' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  Database Context <span className="text-black/40">(Optional)</span>
                </label>
                <textarea
                  value={dbContext}
                  onChange={(e) => setDbContext(e.target.value)}
                  placeholder="e.g., This database stores customer conversations, chatbot analytics, and user feedback for our support system. The conversation_sessions table tracks chat sessions, and conversation_messages stores individual messages."
                  rows={4}
                  className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors resize-none"
                />
                <p className="text-xs text-black/60">
                  Help the AI understand your database by describing what data it stores. This makes queries more accurate and intelligent.
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 border-2 border-black/10 rounded-lg font-medium hover:bg-black/5 transition-colors"
              >
                Back
              </button>

              {testResult === 'success' ? (
                <button
                  onClick={handleContinue}
                  disabled={loading}
                  className="flex-1 py-3 bg-black text-white rounded-lg font-medium hover:bg-black/80 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Scanning Database...' : 'Continue to Chat'}
                </button>
              ) : (
                <button
                  onClick={handleTestConnection}
                  disabled={testing || !dbConfig.host || !dbConfig.database || !dbConfig.username}
                  className="flex-1 py-3 bg-black text-white rounded-lg font-medium hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testing ? 'Testing Connection...' : 'Test Connection'}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
