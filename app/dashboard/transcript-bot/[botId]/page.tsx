'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import FlagButton from '@/components/FlagButton'
import {
  Loader2,
  Edit2,
  Save,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

// Helper function to format labels
const formatLabel = (text: string) => {
  return text
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default function TranscriptBotInstancePage() {
  const params = useParams()
  const router = useRouter()
  const botId = params.botId as string

  const [bot, setBot] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editedPrograms, setEditedPrograms] = useState<any[]>([])

  useEffect(() => {
    fetchBot()
  }, [botId])

  const fetchBot = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/transcript-bot/${botId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setBot(data)
        setEditedPrograms(data.degreePlans.parsedData?.programs || [])
      }
    } catch (error) {
      console.error('Error fetching bot:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfiguration = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/transcript-bot/${botId}/configuration`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          degreePlans: {
            programs: editedPrograms
          }
        })
      })

      if (response.ok) {
        await fetchBot()
        setEditMode(false)
      }
    } catch (error) {
      console.error('Error saving configuration:', error)
    } finally {
      setSaving(false)
    }
  }

  const addProgram = () => {
    setEditedPrograms([
      ...editedPrograms,
      {
        id: `prog-${Date.now()}`,
        name: 'New Program',
        code: 'NEW',
        totalCredits: 120,
        requirements: []
      }
    ])
  }

  const updateProgram = (index: number, field: string, value: any) => {
    const updated = [...editedPrograms]
    updated[index] = { ...updated[index], [field]: value }
    setEditedPrograms(updated)
  }

  const deleteProgram = (index: number) => {
    setEditedPrograms(editedPrograms.filter((_, i) => i !== index))
  }

  const addRequirement = (programIndex: number) => {
    const updated = [...editedPrograms]
    updated[programIndex].requirements.push({
      id: `req-${Date.now()}`,
      category: 'Core Requirements',
      type: 'specific_courses',
      courses: [],
      credits: 0,
      description: ''
    })
    setEditedPrograms(updated)
  }

  const updateRequirement = (programIndex: number, reqIndex: number, field: string, value: any) => {
    const updated = [...editedPrograms]
    updated[programIndex].requirements[reqIndex] = {
      ...updated[programIndex].requirements[reqIndex],
      [field]: value
    }
    setEditedPrograms(updated)
  }

  const addCourse = (programIndex: number, reqIndex: number) => {
    const updated = [...editedPrograms]
    if (!updated[programIndex].requirements[reqIndex].courses) {
      updated[programIndex].requirements[reqIndex].courses = []
    }
    updated[programIndex].requirements[reqIndex].courses.push('NEW 0000')
    setEditedPrograms(updated)
  }

  const updateCourse = (programIndex: number, reqIndex: number, courseIndex: number, value: string) => {
    const updated = [...editedPrograms]
    updated[programIndex].requirements[reqIndex].courses[courseIndex] = value
    setEditedPrograms(updated)
  }

  const deleteCourse = (programIndex: number, reqIndex: number, courseIndex: number) => {
    const updated = [...editedPrograms]
    updated[programIndex].requirements[reqIndex].courses = 
      updated[programIndex].requirements[reqIndex].courses.filter((_: string, i: number) => i !== courseIndex)
    setEditedPrograms(updated)
  }

  const deleteRequirement = (programIndex: number, reqIndex: number) => {
    const updated = [...editedPrograms]
    updated[programIndex].requirements = updated[programIndex].requirements.filter(
      (_: any, i: number) => i !== reqIndex
    )
    setEditedPrograms(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Bot not found</p>
      </div>
    )
  }

  const shareableUrl = `${window.location.origin}/transcript-bot/${bot.shareableLink}`

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{bot.name}</h1>
            <p className="text-gray-600">
              Manage degree requirements and view evaluations
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => router.push('/dashboard')}
              className="bg-black hover:bg-gray-800 text-white"
            >
              Back to Dashboard
            </Button>
            <Button
              onClick={() => window.open(shareableUrl, '_blank')}
              className="bg-black hover:bg-gray-800 text-white"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Try Bot
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-white border border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Evaluations</h3>
            <p className="text-3xl font-bold text-gray-900">{bot.evaluationCount}</p>
          </Card>

          <Card className="p-6 bg-white border border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Status</h3>
            <Badge className={bot.isActive ? 'bg-green-500' : 'bg-gray-500'}>
              {bot.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </Card>

          <Card className="p-6 bg-white border border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Verification</h3>
            <Badge
              className={
                bot.degreePlans.verificationStatus === 'verified'
                  ? 'bg-green-500 text-white'
                  : 'bg-orange-500 text-white'
              }
            >
              {formatLabel(bot.degreePlans.verificationStatus || 'pending')}
            </Badge>
          </Card>
        </div>

        <Card className="p-6 mb-6 bg-white border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Shareable Link</h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={shareableUrl}
              readOnly
              className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-sm font-mono"
            />
            <Button
              onClick={() => navigator.clipboard.writeText(shareableUrl)}
              variant="outline"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-6 mb-6 bg-white border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Degree Requirements</h3>
            <div className="flex gap-2">
              {editMode ? (
                <>
                  <Button
                    onClick={() => {
                      setEditMode(false)
                      setEditedPrograms(bot.degreePlans.parsedData?.programs || [])
                    }}
                    className="bg-black hover:bg-gray-800 text-white"
                  >
                    Cancel
                  </Button>
                  <FlagButton
                    botId={botId}
                    flagType="general"
                    itemType="degree_plan"
                    originalValue={JSON.stringify(bot.degreePlans.parsedData?.programs)}
                    editedValue={JSON.stringify(editedPrograms)}
                    onFlagCreated={() => {
                      alert('Issue flagged for admin review!')
                    }}
                  />
                  <Button
                    onClick={handleSaveConfiguration}
                    disabled={saving}
                    className="bg-black hover:bg-gray-800 text-white"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setEditMode(true)}
                  className="bg-black hover:bg-gray-800 text-white"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Requirements
                </Button>
              )}
            </div>
          </div>

          {bot.degreePlans.verificationStatus === 'needs_review' && (
            <div className="flex items-start gap-2 p-4 bg-gray-50 border border-gray-300 rounded-lg mb-6">
              <AlertCircle className="w-5 h-5 text-gray-700 mt-0.5" />
              <div className="text-sm text-gray-900">
                <p className="font-medium mb-1">Manual Review Required</p>
                <ul className="list-disc list-inside space-y-1">
                  {bot.degreePlans.verificationNotes?.map((note: string, i: number) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {editedPrograms.map((program, programIndex) => (
              <div key={program.id} className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 space-y-3">
                    {editMode ? (
                      <>
                        <input
                          type="text"
                          value={program.name}
                          onChange={(e) => updateProgram(programIndex, 'name', e.target.value)}
                          placeholder="Program Name"
                          className="w-full px-4 py-2 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors font-semibold"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={program.code}
                            onChange={(e) => updateProgram(programIndex, 'code', e.target.value)}
                            placeholder="Code"
                            className="w-full px-4 py-2 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors"
                          />
                          <input
                            type="number"
                            value={program.totalCredits}
                            onChange={(e) =>
                              updateProgram(programIndex, 'totalCredits', parseInt(e.target.value))
                            }
                            placeholder="Total Credits"
                            className="w-full px-4 py-2 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <h4 className="text-xl font-semibold text-gray-900">{program.name}</h4>
                        <div className="flex gap-4 text-sm text-gray-600">
                          <span>Code: {program.code}</span>
                          <span>Total Credits: {program.totalCredits}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {editMode && (
                    <Button
                      onClick={() => deleteProgram(programIndex)}
                      size="sm"
                      className="bg-white hover:bg-gray-50 text-red-600 border-2 border-gray-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-medium text-gray-700">Requirements</h5>
                    {editMode && (
                      <Button
                        onClick={() => addRequirement(programIndex)}
                        size="sm"
                        className="bg-black hover:bg-gray-800 text-white"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Requirement
                      </Button>
                    )}
                  </div>

                  {program.requirements?.map((req: any, reqIndex: number) => (
                    <div key={req.id} className="bg-white p-4 rounded border border-gray-200">
                      {editMode ? (
                        <div className="space-y-3">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 space-y-3">
                              <input
                                type="text"
                                value={req.category}
                                onChange={(e) =>
                                  updateRequirement(programIndex, reqIndex, 'category', e.target.value)
                                }
                                placeholder="Category"
                                className="w-full px-4 py-2 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors"
                              />
                              <select
                                value={req.type}
                                onChange={(e) =>
                                  updateRequirement(programIndex, reqIndex, 'type', e.target.value)
                                }
                                className="w-full px-4 py-2 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors"
                              >
                                <option value="specific_courses">Specific Courses</option>
                                <option value="credit_hours">Credit Hours</option>
                                <option value="grade_requirement">Grade Requirement</option>
                                <option value="elective">Elective</option>
                              </select>
                              <input
                                type="text"
                                value={req.description || ''}
                                onChange={(e) =>
                                  updateRequirement(programIndex, reqIndex, 'description', e.target.value)
                                }
                                placeholder="Description"
                                className="w-full px-4 py-2 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors"
                              />
                              
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-sm font-medium text-gray-700">Courses</label>
                                  <Button
                                    onClick={() => addCourse(programIndex, reqIndex)}
                                    size="sm"
                                    className="bg-black hover:bg-gray-800 text-white"
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add Course
                                  </Button>
                                </div>
                                {req.courses?.map((course: string, courseIndex: number) => (
                                  <div key={courseIndex} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={course}
                                      onChange={(e) =>
                                        updateCourse(programIndex, reqIndex, courseIndex, e.target.value)
                                      }
                                      placeholder="e.g., CS 1301"
                                      className="flex-1 px-3 py-2 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors text-sm"
                                    />
                                    <Button
                                      onClick={() => deleteCourse(programIndex, reqIndex, courseIndex)}
                                      size="sm"
                                      className="bg-white hover:bg-gray-50 text-red-600 border-2 border-gray-200"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <Button
                              onClick={() => deleteRequirement(programIndex, reqIndex)}
                              size="sm"
                              className="bg-white hover:bg-gray-50 text-red-600 border-2 border-gray-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="border-gray-300 text-gray-700">{formatLabel(req.type)}</Badge>
                            <span className="font-medium text-gray-900">{req.category}</span>
                          </div>
                          {req.description && (
                            <p className="text-sm text-gray-600">{req.description}</p>
                          )}
                          {req.courses && req.courses.length > 0 && (
                            <p className="text-sm text-gray-600 mt-1">
                              Courses: {req.courses.join(', ')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {editMode && (
              <Button
                onClick={addProgram}
                className="w-full bg-black hover:bg-gray-800 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Program
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
