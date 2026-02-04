'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Flag, X, Loader2 } from 'lucide-react'

interface SimpleFlagButtonProps {
  itemType: string
  itemId: string
  originalValue?: string
  editedValue?: string
  onFlagSubmit: (description: string) => Promise<void>
}

export default function SimpleFlagButton({
  itemType,
  itemId,
  originalValue,
  editedValue,
  onFlagSubmit
}: SimpleFlagButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!description.trim()) return

    setLoading(true)
    try {
      await onFlagSubmit(description)
      setShowModal(false)
      setDescription('')
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
        size="sm"
        className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
      >
        <Flag className="w-3 h-3 mr-1" />
        Flag
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Flag Issue for Admin Review</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {originalValue && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Original Value
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm">
                    {originalValue}
                  </div>
                </div>
              )}

              {editedValue && editedValue !== originalValue && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Edit
                  </label>
                  <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    {editedValue}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Describe the Issue
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain what's wrong and what should be corrected..."
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors resize-none"
                  rows={4}
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-900">
                  <strong>Note:</strong> This flag will be sent to administrators for review.
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
