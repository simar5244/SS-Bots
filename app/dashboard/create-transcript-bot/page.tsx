'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Loader2, CheckCircle, AlertCircle, ChevronRight, ExternalLink, Copy } from 'lucide-react'
import { loadTccnsData } from '@/lib/tccns-parser'
import SimpleFlagButton from '@/components/SimpleFlagButton'

export default function CreateTranscriptBotPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [botName, setBotName] = useState('')
  const [degreePlanFile, setDegreePlanFile] = useState<File | null>(null)
  const [createdBot, setCreatedBot] = useState<any>(null)
  const [editedPrograms, setEditedPrograms] = useState<any[]>([])
  const [expandedProgram, setExpandedProgram] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingTccns, setLoadingTccns] = useState(false)
  const [editedTccns, setEditedTccns] = useState<any[]>([])
  const [flaggedItems, setFlaggedItems] = useState<Set<string>>(new Set())
  const [tccnsSearch, setTccnsSearch] = useState('')
  const [expandedTccns, setExpandedTccns] = useState<Set<string>>(new Set())

  const handleDegreePlanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
        'application/csv'
      ]
      
      if (!validTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setError('Please upload an Excel (.xlsx, .xls) or CSV (.csv) file')
        return
      }
      
      setDegreePlanFile(file)
      setError('')
    }
  }

  const loadTccns = async () => {
    setLoadingTccns(true)
    try {
      const data = await loadTccnsData()
      setEditedTccns(data)
    } catch (error) {
      console.error('Error loading TCCNS data:', error)
    } finally {
      setLoadingTccns(false)
    }
  }

  const handleCreateBot = async () => {
    if (!botName || !degreePlanFile) {
      setError('Please provide a bot name and upload a degree plan file')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('name', botName)
      formData.append('degreePlan', degreePlanFile)

      const token = localStorage.getItem('token')
      const response = await fetch('/api/transcript-bot', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create bot')
      }

      const bot = await response.json()
      setCreatedBot(bot)
      setEditedPrograms(bot.degreePlans.parsedData?.programs || [])
      await loadTccns()
      setStep(2)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const saveCourse = async (programIdx: number, courseIdx: number) => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/transcript-bot/${createdBot.id}/configuration`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          degreePlans: { programs: editedPrograms }
        })
      })
    } catch (error) {
      console.error('Save error:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleViewBot = () => {
    router.push(`/dashboard/transcript-bot/${createdBot.id}`)
  }

  const handleCreateAnother = () => {
    setBotName('')
    setDegreePlanFile(null)
    setCreatedBot(null)
    setStep(1)
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
          <span className="text-2xl font-bold">Create Transcript Bot</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Bot Details</h2>
              <p className="text-black/60">Name your transcript evaluation bot and upload degree plan</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Bot Name
              </label>
              <Input
                type="text"
                placeholder="e.g., TTU Transcript Evaluator"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Degree Plan
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-black transition-colors cursor-pointer">
                <input
                  type="file"
                  onChange={handleDegreePlanChange}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  id="degree-plan-upload"
                />
                <label
                  htmlFor="degree-plan-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <div className="w-12 h-12 mb-4 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-blue-500" />
                  </div>
                  <span className="text-sm font-medium text-black mb-1">
                    {degreePlanFile ? degreePlanFile.name : 'Click to upload degree plan'}
                  </span>
                  <p className="text-sm text-black/60 mt-2">
                    Upload Excel (.xlsx, .xls) or CSV (.csv) file containing degree requirements
                  </p>
                </label>
              </div>
              <p className="text-xs text-black/60 mt-2">
                Upload your degree plan template. The AI will match the structure and format when generating evaluations.
              </p>
            </div>

            <Button
              onClick={handleCreateBot}
              disabled={loading || !botName || !degreePlanFile}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Continue to Configuration'
              )}
            </Button>
          </div>
        )}

        {step === 2 && createdBot && (
          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Step 2: Review & Edit Scorecard
              </h2>
              <p className="text-gray-600">
                Click on any degree program to edit courses. Each course has TCCNS equivalents.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bot Name
                </label>
                <p className="text-xl font-semibold text-gray-900">{createdBot.name}</p>
              </div>

              {editedPrograms.map((program: any, progIdx: number) => (
                <div key={progIdx} className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:border-black transition-colors">
                  <button
                    onClick={() => setExpandedProgram(expandedProgram === progIdx ? null : progIdx)}
                    className="w-full p-6 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900 text-2xl">{program.name}</h3>
                        <p className="text-sm text-gray-600 mt-2">
                          Code: {program.code} | Credits: {program.totalCredits}
                        </p>
                      </div>
                      <ChevronRight className={`w-6 h-6 text-gray-600 transition-transform ${expandedProgram === progIdx ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {expandedProgram === progIdx && (
                    <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Program Name</label>
                          <input
                            type="text"
                            value={program.name}
                            onChange={(e) => {
                              const updated = [...editedPrograms]
                              updated[progIdx].name = e.target.value
                              setEditedPrograms(updated)
                            }}
                            className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                          <input
                            type="text"
                            value={program.code}
                            onChange={(e) => {
                              const updated = [...editedPrograms]
                              updated[progIdx].code = e.target.value
                              setEditedPrograms(updated)
                            }}
                            className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Total Credits</label>
                          <input
                            type="number"
                            value={program.totalCredits}
                            onChange={(e) => {
                              const updated = [...editedPrograms]
                              updated[progIdx].totalCredits = parseInt(e.target.value)
                              setEditedPrograms(updated)
                            }}
                            className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className="block text-lg font-semibold text-gray-900">Courses</label>
                          <Button
                            onClick={() => {
                              const updated = [...editedPrograms]
                              if (!updated[progIdx].requirements) updated[progIdx].requirements = []
                              if (!updated[progIdx].requirements[0]) {
                                updated[progIdx].requirements[0] = {
                                  id: 'req-core',
                                  category: 'Core Requirements',
                                  type: 'specific_courses',
                                  courses: [],
                                  credits: 0,
                                  description: 'Core courses'
                                }
                              }
                              if (!updated[progIdx].requirements[0].courses) {
                                updated[progIdx].requirements[0].courses = []
                              }
                              updated[progIdx].requirements[0].courses.push({
                                code: 'CS 0000',
                                name: 'New Course',
                                credits: 3,
                                category: 'Core',
                                minGrade: 'C',
                                tccnsEquivalents: []
                              })
                              setEditedPrograms(updated)
                            }}
                            className="bg-black hover:bg-gray-800 text-white"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Add Course
                          </Button>
                        </div>

                        <div className="space-y-4">
                          {program.requirements?.flatMap((req: any) => req.courses || []).map((course: any, courseIdx: number) => {
                            const reqIdx = program.requirements.findIndex((r: any) => r.courses?.includes(course))
                            const actualCourseIdx = program.requirements[reqIdx]?.courses?.indexOf(course) || 0
                            const courseObj = typeof course === 'string' ? {
                              code: course,
                              name: '',
                              credits: 3,
                              category: 'Core',
                              minGrade: 'C',
                              tccnsEquivalents: []
                            } : course
                            return (
                              <div key={courseIdx} className="bg-gray-100 p-4 rounded-lg border-2 border-gray-300 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Course Code</label>
                                    <input
                                      type="text"
                                      value={courseObj.code}
                                      onChange={(e) => {
                                        const updated = [...editedPrograms]
                                        if (typeof updated[progIdx].requirements[reqIdx].courses[actualCourseIdx] === 'string') {
                                          updated[progIdx].requirements[reqIdx].courses[actualCourseIdx] = { ...courseObj, code: e.target.value }
                                        } else {
                                          updated[progIdx].requirements[reqIdx].courses[actualCourseIdx].code = e.target.value
                                        }
                                        setEditedPrograms(updated)
                                      }}
                                      placeholder="e.g., CS 1301"
                                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Course Name</label>
                                    <input
                                      type="text"
                                      value={courseObj.name}
                                      onChange={(e) => {
                                        const updated = [...editedPrograms]
                                        if (typeof updated[progIdx].requirements[reqIdx].courses[actualCourseIdx] === 'string') {
                                          updated[progIdx].requirements[reqIdx].courses[actualCourseIdx] = { ...courseObj, name: e.target.value }
                                        } else {
                                          updated[progIdx].requirements[reqIdx].courses[actualCourseIdx].name = e.target.value
                                        }
                                        setEditedPrograms(updated)
                                      }}
                                      placeholder="e.g., Intro to CS"
                                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Credit Hours</label>
                                    <input
                                      type="number"
                                      value={courseObj.credits}
                                      onChange={(e) => {
                                        const updated = [...editedPrograms]
                                        if (typeof updated[progIdx].requirements[reqIdx].courses[actualCourseIdx] === 'string') {
                                          updated[progIdx].requirements[reqIdx].courses[actualCourseIdx] = { ...courseObj, credits: parseInt(e.target.value) }
                                        } else {
                                          updated[progIdx].requirements[reqIdx].courses[actualCourseIdx].credits = parseInt(e.target.value)
                                        }
                                        setEditedPrograms(updated)
                                      }}
                                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                                    <input
                                      type="text"
                                      value={courseObj.category}
                                      onChange={(e) => {
                                        const updated = [...editedPrograms]
                                        if (typeof updated[progIdx].requirements[reqIdx].courses[actualCourseIdx] === 'string') {
                                          updated[progIdx].requirements[reqIdx].courses[actualCourseIdx] = { ...courseObj, category: e.target.value }
                                        } else {
                                          updated[progIdx].requirements[reqIdx].courses[actualCourseIdx].category = e.target.value
                                        }
                                        setEditedPrograms(updated)
                                      }}
                                      placeholder="Core/Elective"
                                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Min Grade</label>
                                    <input
                                      type="text"
                                      value={courseObj.minGrade}
                                      onChange={(e) => {
                                        const updated = [...editedPrograms]
                                        if (typeof updated[progIdx].requirements[reqIdx].courses[actualCourseIdx] === 'string') {
                                          updated[progIdx].requirements[reqIdx].courses[actualCourseIdx] = { ...courseObj, minGrade: e.target.value }
                                        } else {
                                          updated[progIdx].requirements[reqIdx].courses[actualCourseIdx].minGrade = e.target.value
                                        }
                                        setEditedPrograms(updated)
                                      }}
                                      placeholder="C, B, A"
                                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2 pt-2 border-t border-gray-300">
                                  <Button
                                    onClick={() => saveCourse(progIdx, courseIdx)}
                                    disabled={saving}
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs"
                                  >
                                    {saving ? 'Saving...' : 'Save Course'}
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      const updated = [...editedPrograms]
                                      updated[progIdx].requirements[reqIdx].courses = 
                                        updated[progIdx].requirements[reqIdx].courses.filter((_: any, i: number) => i !== actualCourseIdx)
                                      setEditedPrograms(updated)
                                    }}
                                    size="sm"
                                    className="bg-red-600 hover:bg-red-700 text-white text-xs"
                                  >
                                    Delete
                                  </Button>
                                  {flaggedItems.has(`course-${courseObj.code}`) ? (
                                    <Button
                                      size="sm"
                                      disabled
                                      className="bg-gray-400 text-white text-xs cursor-not-allowed"
                                    >
                                      Flagged
                                    </Button>
                                  ) : (
                                    <SimpleFlagButton
                                      itemType="course"
                                      itemId={courseObj.code}
                                      originalValue={`${courseObj.code} - ${courseObj.name}`}
                                      editedValue={`Credits: ${courseObj.credits}, Category: ${courseObj.category}, Min Grade: ${courseObj.minGrade}`}
                                      onFlagSubmit={async (description: string) => {
                                        const token = localStorage.getItem('token')
                                        await fetch(`/api/transcript-bot/${createdBot.id}/flags`, {
                                          method: 'POST',
                                          headers: {
                                            'Authorization': `Bearer ${token}`,
                                            'Content-Type': 'application/json'
                                          },
                                          body: JSON.stringify({
                                            flagType: 'data_issue',
                                            itemType: 'course',
                                            itemId: courseObj.code,
                                            description,
                                            originalValue: `${courseObj.code} - ${courseObj.name}`,
                                            editedValue: `Credits: ${courseObj.credits}, Category: ${courseObj.category}, Min Grade: ${courseObj.minGrade}`
                                          })
                                        })
                                        setFlaggedItems(prev => new Set(prev).add(`course-${courseObj.code}`))
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-gray-200">
                        <Button
                          onClick={() => {
                            const updated = editedPrograms.filter((_: any, i: number) => i !== progIdx)
                            setEditedPrograms(updated)
                            setExpandedProgram(null)
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Delete Program
                        </Button>
                        {flaggedItems.has(`program-${program.code}`) ? (
                          <Button
                            disabled
                            className="bg-gray-400 text-white cursor-not-allowed"
                          >
                            Flagged
                          </Button>
                        ) : (
                          <SimpleFlagButton
                            itemType="program"
                            itemId={program.code}
                            originalValue={`${program.name} (${program.code})`}
                            editedValue={`Total Credits: ${program.totalCredits}`}
                            onFlagSubmit={async (description: string) => {
                              const token = localStorage.getItem('token')
                              await fetch(`/api/transcript-bot/${createdBot.id}/flags`, {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${token}`,
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                  flagType: 'data_issue',
                                  itemType: 'program',
                                  itemId: program.code,
                                  description,
                                  originalValue: `${program.name} (${program.code})`,
                                  editedValue: `Total Credits: ${program.totalCredits}`
                                })
                              })
                              setFlaggedItems(prev => new Set(prev).add(`program-${program.code}`))
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <Button
                onClick={() => {
                  setEditedPrograms([...editedPrograms, {
                    id: `prog-${Date.now()}`,
                    name: 'New Program',
                    code: 'NEW',
                    totalCredits: 120,
                    courses: []
                  }])
                }}
                className="w-full bg-black hover:bg-gray-800 text-white"
              >
                <Upload className="w-4 h-4 mr-2" />
                Add New Program
              </Button>

              <div className="flex gap-4">
                <Button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900"
                >
                  Back
                </Button>
                <Button
                  onClick={async () => {
                    setSaving(true)
                    try {
                      const token = localStorage.getItem('token')
                      await fetch(`/api/transcript-bot/${createdBot.id}/configuration`, {
                        method: 'PUT',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          degreePlans: { programs: editedPrograms }
                        })
                      })
                      setStep(3)
                    } catch (error) {
                      console.error('Save error:', error)
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={saving}
                  className="flex-1 bg-black hover:bg-gray-800 text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save & Continue to TCCNS'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && createdBot && (
          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Step 3: Verify & Edit Transfer Equivalencies (TCCNS)
              </h2>
              <p className="text-gray-600">
                Review and manage transfer course equivalencies. TCCNS data has been loaded automatically.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> TCCNS data is a reference. Your institution may have different policies. Verify and edit as needed.
              </p>
            </div>

            {loadingTccns ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-black" />
                <span className="ml-3 text-gray-600">Loading TCCNS data...</span>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Transfer Equivalencies ({editedTccns.filter(equiv => {
                    return tccnsSearch === '' || 
                      equiv.tccnsCode?.toLowerCase().includes(tccnsSearch.toLowerCase()) ||
                      equiv.courseName?.toLowerCase().includes(tccnsSearch.toLowerCase())
                  }).length})</h3>
                  <Button
                    onClick={() => {
                      setEditedTccns([{
                        id: `new-${Date.now()}`,
                        ttuCourse: 'TTU 0000',
                        tccnsCode: 'TCCNS 0000',
                        courseName: 'New Course',
                        credits: 3,
                        institutions: 'All Texas Community Colleges',
                        notes: ''
                      }, ...editedTccns])
                    }}
                    className="bg-black hover:bg-gray-800 text-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Add Equivalency
                  </Button>
                </div>

                <div className="mb-4">
                  <Input
                    type="text"
                    placeholder="Search by TTU course, TCCNS code, or course name..."
                    value={tccnsSearch}
                    onChange={(e) => setTccnsSearch(e.target.value)}
                    className="w-full px-4 py-2 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black text-gray-900 placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {editedTccns.filter(equiv => {
                    return tccnsSearch === '' || 
                      equiv.tccnsCode?.toLowerCase().includes(tccnsSearch.toLowerCase()) ||
                      equiv.courseName?.toLowerCase().includes(tccnsSearch.toLowerCase())
                  }).map((equiv: any, idx: number) => {
                    const actualIdx = editedTccns.indexOf(equiv)
                    return (
                    <div key={actualIdx} className="bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-black transition-colors">
                      <div className="space-y-3">
                        <div 
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => {
                            const newExpanded = new Set(expandedTccns)
                            if (newExpanded.has(equiv.id)) {
                              newExpanded.delete(equiv.id)
                            } else {
                              newExpanded.add(equiv.id)
                            }
                            setExpandedTccns(newExpanded)
                          }}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg font-bold text-gray-900">{equiv.tccnsCode}</span>
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {equiv.institutionCount} institutions
                              </span>
                              {expandedTccns.has(equiv.id) ? (
                                <ChevronRight className="w-4 h-4 text-gray-400 transform rotate-90 transition-transform" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400 transition-transform" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{equiv.courseName}</p>
                          </div>
                        </div>
                        
                        {equiv.institutions && equiv.institutions.length > 0 && (
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-xs font-medium text-gray-700 mb-2">
                              {expandedTccns.has(equiv.id) ? 'All Institution Mappings:' : 'Sample Institution Mappings:'}
                            </p>
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                              {(expandedTccns.has(equiv.id) ? equiv.institutions : equiv.institutions.slice(0, 5)).map((inst: any, i: number) => (
                                <div key={i} className="text-xs text-gray-600 flex items-center gap-2 p-1 hover:bg-white rounded">
                                  <span className="font-medium min-w-[120px]">{inst.name}:</span>
                                  <input
                                    type="text"
                                    value={inst.courseCode}
                                    onChange={(e) => {
                                      const updated = [...editedTccns]
                                      updated[actualIdx].institutions[i].courseCode = e.target.value
                                      setEditedTccns(updated)
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-white px-2 py-0.5 rounded border border-gray-200 focus:border-black focus:outline-none"
                                  />
                                  <input
                                    type="number"
                                    value={inst.credits}
                                    onChange={(e) => {
                                      const updated = [...editedTccns]
                                      updated[actualIdx].institutions[i].credits = parseInt(e.target.value)
                                      setEditedTccns(updated)
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-16 bg-white px-2 py-0.5 rounded border border-gray-200 focus:border-black focus:outline-none"
                                  />
                                  <span className="text-gray-500">credits</span>
                                </div>
                              ))}
                              {!expandedTccns.has(equiv.id) && equiv.institutions.length > 5 && (
                                <p className="text-xs text-gray-500 italic">Click to see all {equiv.institutions.length} institutions</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            const updated = editedTccns.filter((_: any, i: number) => i !== actualIdx)
                            setEditedTccns(updated)
                          }}
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Remove
                        </Button>
                        {flaggedItems.has(`tccns-${equiv.id}`) ? (
                          <Button
                            size="sm"
                            disabled
                            className="bg-gray-400 text-white text-xs cursor-not-allowed"
                          >
                            Flagged
                          </Button>
                        ) : (
                          <SimpleFlagButton
                            itemType="tccns_equivalency"
                            itemId={equiv.id}
                            originalValue={`${equiv.tccnsCode} - ${equiv.courseName}`}
                            editedValue={`${equiv.institutionCount} institutions mapped`}
                            onFlagSubmit={async (description: string) => {
                              await fetch(`/api/transcript-bot/${createdBot.id}/flags`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  itemType: 'tccns_equivalency',
                                  itemId: equiv.id,
                                  description,
                                  originalValue: `${equiv.tccnsCode} - ${equiv.courseName}`,
                                  editedValue: `${equiv.institutionCount} institutions`
                                })
                              })
                              setFlaggedItems(prev => new Set(prev).add(`tccns-${equiv.id}`))
                            }}
                          />
                        )}
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-8">
              <Button
                onClick={() => setStep(2)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900"
              >
                Back
              </Button>
              <Button
                onClick={async () => {
                  const saveTccns = async () => {
                    if (!createdBot?.id) return
                    
                    try {
                      setSaving(true)
                      
                      // Ensure all requirements have proper structure
                      const programsToSave = editedPrograms.map(prog => ({
                        ...prog,
                        requirements: prog.requirements?.map((req: any) => ({
                          id: req.id || 'req-core',
                          category: req.category || 'Core Requirements',
                          type: req.type || 'specific_courses',
                          courses: req.courses || [],
                          credits: req.credits || 0,
                          description: req.description || 'Course requirements'
                        })) || []
                      }))
                      
                      const response = await fetch(`/api/transcript-bot/${createdBot.id}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({
                          degreePlans: {
                            programs: programsToSave
                          },
                          tccnsData: {
                            fileName: 'tccns-equivalencies.json',
                            uploadedAt: Date.now(),
                            totalEquivalencies: editedTccns.length
                          }
                        })
                      })

                      if (!response.ok) throw new Error('Failed to save data')
                      
                      alert('Data saved successfully!')
                    } catch (error) {
                      console.error('Save error:', error)
                      alert('Failed to save data')
                    } finally {
                      setSaving(false)
                    }
                  }
                  setSaving(true)
                  try {
                    await saveTccns()
                    setStep(4)
                  } catch (err) {
                    console.error('Failed to save TCCNS data:', err)
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
                className="flex-1 bg-black hover:bg-gray-800 text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Continue to Final Step'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && createdBot && (
          <div className="p-8">
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>

              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Congratulations! Bot is Ready!
                </h2>
                <p className="text-gray-600">
                  Your transcript evaluation bot has been successfully created and configured
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bot Name
                </label>
                <p className="text-xl font-semibold text-gray-900">{createdBot.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => window.open(`/transcript-bot/${createdBot.shareableLink}`, '_blank')}
                  className="bg-black hover:bg-gray-800 text-white"
                >
                  Use Bot
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Edit Bot
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
