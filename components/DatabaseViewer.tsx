'use client'

import { useState, useEffect, useRef } from 'react'
import { Database, Table, Play, Download, X, ChevronRight, ChevronDown, Search, RefreshCw } from 'lucide-react'

interface DatabaseViewerProps {
  botId: string
  onClose: () => void
}

interface TableSchema {
  columns: Array<{
    column_name: string
    data_type: string
    is_nullable: string
  }>
  sampleData: any[]
}

export default function DatabaseViewer({ botId, onClose }: DatabaseViewerProps) {
  const [schema, setSchema] = useState<Record<string, TableSchema>>({})
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [queryText, setQueryText] = useState('')
  const [queryResults, setQueryResults] = useState<any[]>([])
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const topScrollRef = useRef<HTMLDivElement | null>(null)
  const mainScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetchSchema()
  }, [botId])

  const fetchSchema = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/bots/${botId}/schema`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await res.json()
        setSchema(data.schema || {})
        
        // Auto-select first table
        const tables = Object.keys(data.schema || {})
        if (tables.length > 0) {
          setSelectedTable(tables[0])
          setExpandedTables(new Set([tables[0]]))
        }
      }
    } catch (err) {
      console.error('Failed to fetch schema:', err)
    } finally {
      setLoading(false)
    }
  }

  const executeQuery = async () => {
    if (!queryText.trim()) return
    
    setExecuting(true)
    setError('')
    
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/bots/${botId}/execute-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: queryText })
      })
      
      const data = await res.json()
      
      if (res.ok) {
        setQueryResults(data.results || [])
        setError('')
      } else {
        setError(data.error || 'Query execution failed')
        setQueryResults([])
      }
    } catch (err) {
      setError('Failed to execute query')
      setQueryResults([])
    } finally {
      setExecuting(false)
    }
  }

  const toggleTableExpand = (tableName: string) => {
    const newExpanded = new Set(expandedTables)
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName)
    } else {
      newExpanded.add(tableName)
    }
    setExpandedTables(newExpanded)
  }

  const exportToCSV = () => {
    if (queryResults.length === 0) return
    
    const headers = Object.keys(queryResults[0])
    const csvContent = [
      headers.join(','),
      ...queryResults.map(row => 
        headers.map(h => JSON.stringify(row[h] || '')).join(',')
      )
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query-results-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredTables = Object.keys(schema).filter(table =>
    table.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const currentTableData = selectedTable ? schema[selectedTable] : null

  const getCurrentColumnCount = () => {
    if (queryResults.length > 0) {
      return Object.keys(queryResults[0]).length
    }
    if (currentTableData) {
      return currentTableData.columns.length
    }
    return 0
  }

  const getTopScrollWidth = () => {
    const cols = getCurrentColumnCount()
    if (!cols) return 800
    return Math.max(800, cols * 160)
  }

  const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  const handleMainScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (topScrollRef.current) {
      topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex flex-col w-full h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-black/10">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6" />
            <h2 className="text-2xl font-bold">Database Explorer</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setLoading(true)
                fetchSchema()
              }}
              disabled={loading}
              className="px-3 py-2 border border-black/10 rounded-lg hover:bg-black/5 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
              title="Refresh schema with all data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-black/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Tables */}
          <div className="w-80 border-r border-black/10 flex flex-col">
            <div className="p-4 border-b border-black/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search tables..."
                  className="w-full pl-10 pr-4 py-2 bg-black/5 border border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {loading ? (
                <div className="text-center py-8 text-black/60">Loading schema...</div>
              ) : filteredTables.length === 0 ? (
                <div className="text-center py-8 text-black/60">No tables found</div>
              ) : (
                filteredTables.map(tableName => {
                  const tableData = schema[tableName]
                  const isExpanded = expandedTables.has(tableName)
                  const isSelected = selectedTable === tableName
                  
                  return (
                    <div key={tableName} className="space-y-1">
                      <button
                        onClick={() => {
                          setSelectedTable(tableName)
                          toggleTableExpand(tableName)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                          isSelected ? 'bg-black text-white' : 'hover:bg-black/5'
                        }`}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 flex-shrink-0" />
                        )}
                        <Table className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium truncate">{tableName}</span>
                        <span className={`ml-auto text-xs ${isSelected ? 'text-white/60' : 'text-black/40'}`}>
                          {tableData.columns.length}
                        </span>
                      </button>
                      
                      {isExpanded && (
                        <div className="ml-6 space-y-0.5">
                          {tableData.columns.map(col => (
                            <div
                              key={col.column_name}
                              className="px-3 py-1.5 text-sm flex items-center justify-between hover:bg-black/5 rounded"
                            >
                              <span className="text-black/80 truncate">{col.column_name}</span>
                              <span className="text-xs text-black/40 ml-2 flex-shrink-0">
                                {col.data_type}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Query Editor */}
            <div className="border-b border-black/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Custom Query</label>
                <div className="flex gap-2">
                  {queryResults.length > 0 && (
                    <button
                      onClick={exportToCSV}
                      className="px-3 py-1.5 text-sm border border-black/10 rounded-lg hover:bg-black/5 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </button>
                  )}
                  <button
                    onClick={executeQuery}
                    disabled={executing || !queryText.trim()}
                    className="px-4 py-1.5 bg-black text-white rounded-lg hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                  >
                    <Play className="w-4 h-4" />
                    {executing ? 'Executing...' : 'Run Query'}
                  </button>
                </div>
              </div>
              
              <textarea
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="SELECT * FROM table_name LIMIT 100"
                className="w-full h-24 px-4 py-3 bg-black/5 border border-black/10 rounded-lg focus:outline-none focus:border-black transition-colors font-mono text-sm resize-none"
              />
              
              {error && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}
            </div>

            {/* Results Area */}
            <div className="flex-1 p-4">
              {queryResults.length > 0 ? (
                <div className="w-[800px] mx-auto">
                  {/* TOP horizontal scroller */}
                  <div
                    ref={topScrollRef}
                    className="overflow-x-scroll overflow-y-hidden border border-black/10 rounded-t-lg bg-gray-100"
                    style={{ height: '16px' }}
                    onScroll={handleTopScroll}
                  >
                    <div style={{ width: getTopScrollWidth(), height: 1 }} />
                  </div>

                  {/* MAIN table scroller */}
                  <div
                    ref={mainScrollRef}
                    className="border border-t-0 border-black/10 rounded-b-lg overflow-auto"
                    style={{ maxHeight: '350px', paddingBottom: '16px' }}
                    onScroll={handleMainScroll}
                  >
                    <table className="border-collapse" style={{ width: 'max-content' }}>
                      <thead className="bg-black/5 border-b border-black/10">
                        <tr>
                          {Object.keys(queryResults[0]).map(key => (
                            <th
                              key={key}
                              className="px-4 py-3 text-left text-sm font-semibold text-black/80 whitespace-nowrap min-w-[160px]"
                            >
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResults.map((row, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-black/5 hover:bg-black/5 transition-colors"
                          >
                            {Object.values(row).map((val: any, colIdx) => (
                              <td
                                key={colIdx}
                                className="px-4 py-3 text-sm text-black/80 whitespace-nowrap min-w-[160px]"
                              >
                                {val === null ? (
                                  <span className="text-black/40 italic">null</span>
                                ) : typeof val === 'object' ? (
                                  <span className="text-black/60 font-mono text-xs">
                                    {JSON.stringify(val)}
                                  </span>
                                ) : (
                                  String(val)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-4 py-2 bg-black/5 border border-t-0 border-black/10 text-xs text-black/60">
                    {queryResults.length} row{queryResults.length !== 1 ? 's' : ''} returned
                  </div>
                </div>
              ) : currentTableData ? (
                <div className="w-[800px] mx-auto">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold mb-2">{selectedTable}</h3>
                    <p className="text-sm text-black/60">
                      {currentTableData.columns.length} columns · {currentTableData.sampleData.length} rows
                    </p>
                  </div>

                  {/* TOP horizontal scroller for preview table */}
                  <div
                    ref={topScrollRef}
                    className="overflow-x-scroll overflow-y-hidden border border-black/10 rounded-t-lg bg-gray-100"
                    style={{ height: '16px' }}
                    onScroll={handleTopScroll}
                  >
                    <div style={{ width: getTopScrollWidth(), height: 1 }} />
                  </div>

                  {/* MAIN preview table scroller */}
                  <div
                    ref={mainScrollRef}
                    className="border border-t-0 border-black/10 rounded-b-lg overflow-auto"
                    style={{ maxHeight: '350px', paddingBottom: '16px' }}
                    onScroll={handleMainScroll}
                  >
                    <table className="border-collapse" style={{ width: 'max-content' }}>
                      <thead className="bg-black/5 border-b border-black/10">
                        <tr>
                          {currentTableData.columns.map(col => (
                            <th
                              key={col.column_name}
                              className="px-4 py-3 text-left whitespace-nowrap min-w-[160px]"
                            >
                              <div className="text-sm font-semibold text-black/80">{col.column_name}</div>
                              <div className="text-xs text-black/40">{col.data_type}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentTableData.sampleData.map((row, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-black/5 hover:bg-black/5 transition-colors"
                          >
                            {currentTableData.columns.map(col => {
                              const val = row[col.column_name]
                              return (
                                <td
                                  key={col.column_name}
                                  className="px-4 py-3 text-sm text-black/80 whitespace-nowrap min-w-[160px]"
                                >
                                  {val === null || val === undefined ? (
                                    <span className="text-black/40 italic">null</span>
                                  ) : typeof val === 'object' ? (
                                    <span className="text-black/60 font-mono text-xs">
                                      {JSON.stringify(val).slice(0, 100)}
                                    </span>
                                  ) : (
                                    String(val).slice(0, 100)
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-black/40">
                  <div className="text-center">
                    <Database className="w-16 h-16 mx-auto mb-4 opacity-40" />
                    <p>Select a table or run a custom query</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
