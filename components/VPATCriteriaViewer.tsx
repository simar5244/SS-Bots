'use client'

import { useState, useMemo } from 'react'
import { Search, ArrowUpDown, Filter, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface WCAGCriterion {
  criterionId: string
  criterionName: string
  level: string
  conformanceLevel: string
  scorecardEquivalent: string
  remarks?: string
  pageNumber?: number
  excerpt?: string
  confidence?: number
}

interface VPATCriteriaViewerProps {
  criteria: WCAGCriterion[]
  productName?: string
  submissionId?: string
}

type SortField = 'criterionId' | 'level' | 'conformanceLevel' | 'pageNumber' | 'confidence'
type SortDirection = 'asc' | 'desc'
type FilterLevel = 'all' | 'A' | 'AA' | 'AAA'
type FilterStatus = 'all' | 'Supports' | 'Partially Supports' | 'Does Not Support'

export default function VPATCriteriaViewer({ criteria, productName, submissionId }: VPATCriteriaViewerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('criterionId')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const toggleRow = (criterionId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(criterionId)) {
      newExpanded.delete(criterionId)
    } else {
      newExpanded.add(criterionId)
    }
    setExpandedRows(newExpanded)
  }

  const filteredAndSortedCriteria = useMemo(() => {
    let result = [...criteria]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c => 
        c.criterionId.toLowerCase().includes(query) ||
        c.criterionName.toLowerCase().includes(query) ||
        c.remarks?.toLowerCase().includes(query) ||
        c.excerpt?.toLowerCase().includes(query)
      )
    }

    // Level filter
    if (filterLevel !== 'all') {
      result = result.filter(c => c.level === filterLevel)
    }

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(c => c.scorecardEquivalent === filterStatus)
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField]
      let bVal: any = b[sortField]

      if (sortField === 'criterionId') {
        const aParts = aVal.split('.').map(Number)
        const bParts = bVal.split('.').map(Number)
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const diff = (aParts[i] || 0) - (bParts[i] || 0)
          if (diff !== 0) return sortDirection === 'asc' ? diff : -diff
        }
        return 0
      }

      if (aVal === undefined) aVal = sortDirection === 'asc' ? Infinity : -Infinity
      if (bVal === undefined) bVal = sortDirection === 'asc' ? Infinity : -Infinity

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [criteria, searchQuery, sortField, sortDirection, filterLevel, filterStatus])

  const stats = useMemo(() => {
    const total = criteria.length
    const supports = criteria.filter(c => c.scorecardEquivalent === 'Supports').length
    const partial = criteria.filter(c => c.scorecardEquivalent === 'Partially Supports').length
    const doesNotSupport = criteria.filter(c => c.scorecardEquivalent === 'Does Not Support').length
    const withPageNumbers = criteria.filter(c => c.pageNumber).length
    const avgConfidence = criteria.filter(c => c.confidence).length > 0
      ? Math.round(criteria.filter(c => c.confidence).reduce((sum, c) => sum + (c.confidence || 0), 0) / criteria.filter(c => c.confidence).length)
      : 0

    return { total, supports, partial, doesNotSupport, withPageNumbers, avgConfidence }
  }, [criteria])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Supports':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'Partially Supports':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />
      case 'Does Not Support':
        return <XCircle className="w-5 h-5 text-red-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Supports':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'Partially Supports':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'Does Not Support':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          VPAT Criteria Analysis
          {productName && <span className="text-gray-500 text-lg ml-2">- {productName}</span>}
        </h2>
        
        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
            <div className="text-xs text-blue-700">Total Criteria</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <div className="text-2xl font-bold text-green-900">{stats.supports}</div>
            <div className="text-xs text-green-700">Supports</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-900">{stats.partial}</div>
            <div className="text-xs text-yellow-700">Partial</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 border border-red-200">
            <div className="text-2xl font-bold text-red-900">{stats.doesNotSupport}</div>
            <div className="text-xs text-red-700">Not Supported</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
            <div className="text-2xl font-bold text-purple-900">{stats.withPageNumbers}</div>
            <div className="text-xs text-purple-700">With Page #</div>
          </div>
          <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
            <div className="text-2xl font-bold text-indigo-900">{stats.avgConfidence}%</div>
            <div className="text-xs text-indigo-700">Avg Confidence</div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search criteria, remarks, or excerpts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Level Filter */}
          <div>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as FilterLevel)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Levels</option>
              <option value="A">Level A</option>
              <option value="AA">Level AA</option>
              <option value="AAA">Level AAA</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="Supports">Supports</option>
              <option value="Partially Supports">Partially Supports</option>
              <option value="Does Not Support">Does Not Support</option>
            </select>
          </div>
        </div>

        {/* Active Filters */}
        {(searchQuery || filterLevel !== 'all' || filterStatus !== 'all') && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <Filter className="w-4 h-4" />
            <span>Active filters:</span>
            {searchQuery && <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">Search: "{searchQuery}"</span>}
            {filterLevel !== 'all' && <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">Level: {filterLevel}</span>}
            {filterStatus !== 'all' && <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">Status: {filterStatus}</span>}
            <button
              onClick={() => {
                setSearchQuery('')
                setFilterLevel('all')
                setFilterStatus('all')
              }}
              className="ml-2 text-blue-600 hover:text-blue-800 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing {filteredAndSortedCriteria.length} of {criteria.length} criteria
      </div>

      {/* Criteria Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('criterionId')}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase hover:text-gray-900"
                  >
                    Criterion
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('level')}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase hover:text-gray-900"
                  >
                    Level
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('conformanceLevel')}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase hover:text-gray-900"
                  >
                    Status
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('pageNumber')}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase hover:text-gray-900"
                  >
                    Page #
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('confidence')}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase hover:text-gray-900"
                  >
                    Confidence
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedCriteria.map((criterion) => (
                <>
                  <tr
                    key={criterion.criterionId}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => toggleRow(criterion.criterionId)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{criterion.criterionId}</div>
                      <div className="text-sm text-gray-600">{criterion.criterionName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        Level {criterion.level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(criterion.scorecardEquivalent)}
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getStatusColor(criterion.scorecardEquivalent)}`}>
                          {criterion.scorecardEquivalent}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {criterion.pageNumber ? (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <FileText className="w-4 h-4" />
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                            Page {criterion.pageNumber}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {criterion.confidence ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                            <div
                              className={`h-2 rounded-full ${
                                criterion.confidence >= 80 ? 'bg-green-500' :
                                criterion.confidence >= 60 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${criterion.confidence}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700">{criterion.confidence}%</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        {expandedRows.has(criterion.criterionId) ? 'Hide' : 'Show'}
                      </button>
                    </td>
                  </tr>
                  {expandedRows.has(criterion.criterionId) && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="space-y-3">
                          {criterion.excerpt && (
                            <div>
                              <div className="text-xs font-semibold text-gray-700 uppercase mb-1">
                                Excerpt from PDF {criterion.pageNumber && `(Page ${criterion.pageNumber})`}
                              </div>
                              <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-700 italic">
                                "{criterion.excerpt}"
                              </div>
                            </div>
                          )}
                          {criterion.remarks && (
                            <div>
                              <div className="text-xs font-semibold text-gray-700 uppercase mb-1">Remarks</div>
                              <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                                {criterion.remarks}
                              </div>
                            </div>
                          )}
                          {!criterion.excerpt && !criterion.remarks && (
                            <div className="text-sm text-gray-500 italic">No additional details available</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedCriteria.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No criteria match your filters. Try adjusting your search or filters.
          </div>
        )}
      </div>
    </div>
  )
}
