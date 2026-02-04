'use client'

import { useState } from 'react'
import { X, FileText, Calendar, Clock, Users, Send, Download, FileDown } from 'lucide-react'
import ChartRenderer from './ChartRenderer'
import { ChartConfig } from '@/lib/chart-service'

interface ReportBuilderProps {
  botId: string
  onClose: () => void
}

export default function ReportBuilder({ botId, onClose }: ReportBuilderProps) {
  const [step, setStep] = useState(1)
  
  // Report Configuration
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dataRequest, setDataRequest] = useState('')
  const [tone, setTone] = useState<'professional' | 'casual' | 'technical' | 'executive'>('professional')
  const [wordLimit, setWordLimit] = useState(1000)
  const [stakeholders, setStakeholders] = useState('')
  const [sections, setSections] = useState('Executive Summary\nKey Findings\nDetailed Analysis\nRecommendations')
  const [includeCharts, setIncludeCharts] = useState(true)
  const [includeRawData, setIncludeRawData] = useState(false)
  
  // Scheduling
  const [isScheduled, setIsScheduled] = useState(false)
  const [frequency, setFrequency] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [time, setTime] = useState('09:00')
  const [recipients, setRecipients] = useState('')
  
  // Generation
  const [generating, setGenerating] = useState(false)
  const [generatedReport, setGeneratedReport] = useState('')
  const [generatedCharts, setGeneratedCharts] = useState<ChartConfig[]>([])
  const [error, setError] = useState('')

  const handleGenerateReport = async () => {
    if (!title || !dataRequest) {
      setError('Title and data request are required')
      return
    }

    setGenerating(true)
    setError('')

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/bots/${botId}/generate-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          config: {
            title,
            description,
            dataRequest,
            tone,
            wordLimit,
            stakeholders: stakeholders.split(',').map(s => s.trim()).filter(Boolean),
            sections: sections.split('\n').filter(Boolean),
            includeCharts,
            includeRawData
          },
          schedule: isScheduled ? {
            frequency,
            dayOfWeek,
            dayOfMonth,
            time,
            recipients: recipients.split(',').map(s => s.trim()).filter(Boolean)
          } : null
        })
      })

      const data = await res.json()

      if (res.ok) {
        setGeneratedReport(data.report)
        setGeneratedCharts(data.charts || [])
        setStep(3)
      } else {
        setError(data.error || 'Failed to generate report')
      }
    } catch (err) {
      setError('Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const downloadReport = () => {
    const blob = new Blob([generatedReport], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadDocx = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/bots/${botId}/export-docx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          report: generatedReport,
          title,
          charts: generatedCharts
        })
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.docx`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        setError('Failed to export DOCX')
      }
    } catch (err) {
      setError('Failed to export DOCX')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-black/10">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <h2 className="text-2xl font-bold">Report Builder</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-black/10">
          <div className="flex items-center justify-center gap-4">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                  step >= s ? 'bg-black text-white' : 'bg-black/10 text-black/40'
                }`}>
                  {s}
                </div>
                <span className={`text-sm font-medium ${step >= s ? 'text-black' : 'text-black/40'}`}>
                  {s === 1 && 'Configure'}
                  {s === 2 && 'Schedule'}
                  {s === 3 && 'Review'}
                </span>
                {s < 3 && <div className="w-12 h-0.5 bg-black/10" />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div>
                <label className="block text-sm font-medium mb-2">Report Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Q4 Sales Performance Report"
                  className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what this report covers..."
                  rows={2}
                  className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Data Request *</label>
                <textarea
                  value={dataRequest}
                  onChange={(e) => setDataRequest(e.target.value)}
                  placeholder="Show me all sales data from Q4 2024, including revenue, product categories, and top customers"
                  rows={4}
                  className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors resize-none"
                />
                <p className="text-xs text-black/60 mt-2">
                  Describe what data you need in natural language. The AI will extract the relevant information from your database.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as any)}
                    className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="technical">Technical</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Word Limit</label>
                  <input
                    type="number"
                    value={wordLimit}
                    onChange={(e) => setWordLimit(parseInt(e.target.value))}
                    min={500}
                    max={5000}
                    step={100}
                    className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Stakeholders (comma-separated)</label>
                <input
                  type="text"
                  value={stakeholders}
                  onChange={(e) => setStakeholders(e.target.value)}
                  placeholder="CEO, Sales Team, Marketing Department"
                  className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Report Sections (one per line)</label>
                <textarea
                  value={sections}
                  onChange={(e) => setSections(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors resize-none"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCharts}
                    onChange={(e) => setIncludeCharts(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="text-sm font-medium">Suggest charts and visualizations</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeRawData}
                    onChange={(e) => setIncludeRawData(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="text-sm font-medium">Include raw data appendix</span>
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Schedule this report</p>
                  <p className="text-sm text-blue-700">Automatically generate and email this report on a schedule</p>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                  className="w-5 h-5"
                />
                <span className="text-sm font-medium">Enable scheduling</span>
              </label>

              {isScheduled && (
                <div className="space-y-6 pl-8 border-l-2 border-black/10">
                  <div>
                    <label className="block text-sm font-medium mb-2">Frequency</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as any)}
                      className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                    >
                      <option value="once">One-time (generate now)</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  {frequency === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Day of Week</label>
                      <select
                        value={dayOfWeek}
                        onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                        className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                      >
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                        <option value={5}>Friday</option>
                        <option value={6}>Saturday</option>
                        <option value={0}>Sunday</option>
                      </select>
                    </div>
                  )}

                  {frequency === 'monthly' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Day of Month</label>
                      <input
                        type="number"
                        value={dayOfMonth}
                        onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                        min={1}
                        max={31}
                        className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2">Time</label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Email Recipients (comma-separated) *</label>
                    <input
                      type="text"
                      value={recipients}
                      onChange={(e) => setRecipients(e.target.value)}
                      placeholder="john@company.com, jane@company.com"
                      className="w-full px-4 py-3 bg-white border-2 border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              {generatedReport ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Generated Report</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={downloadDocx}
                        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-black/80 transition-colors flex items-center gap-2 text-sm font-medium"
                      >
                        <FileDown className="w-4 h-4" />
                        Download DOCX
                      </button>
                      <button
                        onClick={downloadReport}
                        className="px-4 py-2 border border-black/10 rounded-lg hover:bg-black/5 transition-colors flex items-center gap-2 text-sm font-medium"
                      >
                        <Download className="w-4 h-4" />
                        Download Markdown
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-black/5 border border-black/10 rounded-lg max-h-[360px] overflow-auto">
                    <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-black/80">
                      {generatedReport}
                    </div>
                  </div>

                  {/* Display Charts */}
                  {generatedCharts && generatedCharts.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-bold mb-3">Visualizations</h3>
                      <div className="space-y-4">
                        {generatedCharts.map((chart, idx) => (
                          <div key={idx} className="w-full">
                            <ChartRenderer config={chart} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-black/40" />
                  <p className="text-black/60">Report will appear here after generation</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-black/10 flex items-center justify-between">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-6 py-3 border border-black/10 rounded-lg hover:bg-black/5 transition-colors font-medium"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => step === 2 ? handleGenerateReport() : setStep(step + 1)}
              disabled={generating || (step === 1 && (!title || !dataRequest))}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              {step === 2 ? (
                <>
                  {generating ? 'Generating...' : 'Generate Report'}
                  <Send className="w-4 h-4" />
                </>
              ) : (
                'Next'
              )}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-black/80 transition-colors font-medium"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
