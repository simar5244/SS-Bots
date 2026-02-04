'use client'

import { useState } from 'react'

interface ResponseModeToggleProps {
  value: 'cheaper' | 'better'
  onChange: (mode: 'cheaper' | 'better') => void
  className?: string
}

export default function ResponseModeToggle({ value, onChange, className = '' }: ResponseModeToggleProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Response Quality:</label>
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onChange('cheaper')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              value === 'cheaper'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            💰 Cheaper
          </button>
          <button
            onClick={() => onChange('better')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              value === 'better'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ⭐ Better
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        {value === 'cheaper' ? (
          <>
            <span className="font-medium">Cheaper mode:</span> Uses SQL queries for cost-effective responses. 
            Best for large databases where costs can add up quickly.
          </>
        ) : (
          <>
            <span className="font-medium">Better mode:</span> Analyzes data directly for more detailed, accurate answers. 
            Higher token usage (~5x cost), but superior quality.
          </>
        )}
      </p>
    </div>
  )
}
