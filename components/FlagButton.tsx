'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Flag, X, Loader2 } from 'lucide-react'

interface FlagButtonProps {
  botId: string
  flagType: 'course' | 'requirement' | 'tccns' | 'general'
  itemType: 'degree_plan' | 'tccns_equivalency' | 'scorecard'
  itemId?: string
  originalValue?: string
  editedValue?: string
  onFlagCreated?: () => void
}

export default function FlagButton({
  botId,
  flagType,
  itemType,
  itemId,
  originalValue,
  editedValue,
  onFlagCreated
}: FlagButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!description.trim()) return

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/transcript-bot/${botId}/flags`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          flagType,
          itemType,
          itemId,
          description,
          originalValue,
          editedValue
        })
      })

      if (response.ok) {
        setShowModal(false)
        setDescription('')
        onFlagCreated?.()
      }
    } catch (error) {
      console.error('Flag creation error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        className="bg-orange-500 hover:bg-orange-600 text-white"
      >
        <Flag className="w-4 h-4 mr-2" />
        Flag Issue
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Report an Issue</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What's wrong?
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue you found. For example: 'The course code is incorrect' or 'This requirement is missing'"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors resize-none"
                  rows={5}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>💡 Tip:</strong> Your report will be sent to administrators who will review and fix the issue. Your current edits will be saved separately.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!description.trim() || loading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Flagging...
                    </>
                  ) : (
                    <>
                      <Flag className="w-4 h-4 mr-2" />
                      Submit Flag
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
