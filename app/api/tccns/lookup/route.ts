import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

// GET /api/tccns/lookup?institution=3580&course=MATH 1314
// Returns TCCNS equivalent for a given institution's course
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const institution = searchParams.get('institution') // FICE code
    const course = searchParams.get('course') // Course code like "MATH 1314"
    
    if (!institution || !course) {
      return NextResponse.json(
        { error: 'Missing institution or course parameter' },
        { status: 400 }
      )
    }
    
    // Load reverse lookup data
    const reversePath = path.join(process.cwd(), 'public/data/TX_equivalencies_reverse.json')
    const reverseData = JSON.parse(await fs.readFile(reversePath, 'utf-8'))
    
    // Create lookup key
    const key = `${institution}:${course}`
    
    if (key in reverseData) {
      return NextResponse.json({
        success: true,
        institutionCourse: course,
        institution,
        tccnsEquivalents: reverseData[key]
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'No TCCNS equivalent found for this course',
        institutionCourse: course,
        institution
      })
    }
  } catch (error) {
    console.error('TCCNS lookup error:', error)
    return NextResponse.json(
      { error: 'Failed to lookup TCCNS equivalent' },
      { status: 500 }
    )
  }
}

// GET /api/tccns/lookup/tccns?code=ACCT 2301
// Returns all institution courses that map to a TCCNS code
export async function POST(req: NextRequest) {
  try {
    const { tccnsCode } = await req.json()
    
    if (!tccnsCode) {
      return NextResponse.json(
        { error: 'Missing tccnsCode parameter' },
        { status: 400 }
      )
    }
    
    // Load TCCNS data
    const tccnsPath = path.join(process.cwd(), 'public/data/TX_equivalencies.json')
    const tccnsData = JSON.parse(await fs.readFile(tccnsPath, 'utf-8'))
    
    if (tccnsCode in tccnsData) {
      return NextResponse.json({
        success: true,
        tccnsCode,
        courseName: tccnsData[tccnsCode].courseName,
        institutions: tccnsData[tccnsCode].institutions
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'TCCNS code not found',
        tccnsCode
      })
    }
  } catch (error) {
    console.error('TCCNS lookup error:', error)
    return NextResponse.json(
      { error: 'Failed to lookup TCCNS code' },
      { status: 500 }
    )
  }
}
