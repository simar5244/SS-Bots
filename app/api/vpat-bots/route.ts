import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import jwt from 'jsonwebtoken'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const UPLOAD_DIR = join(process.env.HOME || '', 'Desktop', 'db', 'vpat-uploads')

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        return NextResponse.json({ error: 'Token expired. Please log in again.' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const formData = await req.formData()
    
    const name = formData.get('name') as string
    const file = formData.get('scorecard') as File
    const config = JSON.parse(formData.get('config') as string)

    if (!name || !file) {
      return NextResponse.json({ error: 'Name and scorecard file required' }, { status: 400 })
    }

    await mkdir(UPLOAD_DIR, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = `${Date.now()}-${file.name}`
    const filePath = join(UPLOAD_DIR, fileName)
    await writeFile(filePath, buffer)

    const referenceScorecard = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: Date.now(),
    }

    const vpatBot = await dbService.createVPATBot(
      decoded.userId,
      name,
      referenceScorecard,
      config
    )

    return NextResponse.json(vpatBot)
  } catch (error) {
    console.error('Create VPAT bot error:', error)
    return NextResponse.json(
      { error: 'Failed to create VPAT bot' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        return NextResponse.json({ error: 'Token expired. Please log in again.' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const vpatBots = await dbService.findVPATBotsByUserId(decoded.userId)

    return NextResponse.json(vpatBots)
  } catch (error) {
    console.error('Get VPAT bots error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch VPAT bots' },
      { status: 500 }
    )
  }
}
