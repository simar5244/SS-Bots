import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { dbService } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { createTranscriptBotService } from '@/lib/transcript-bot-loader'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const UPLOAD_DIR = join(homedir(), 'Desktop', 'db', 'transcript-bot-uploads')

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = await verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const formData = await req.formData()
    
    const name = formData.get('name') as string
    const degreePlanFile = formData.get('degreePlan') as File

    if (!name || !degreePlanFile) {
      return NextResponse.json({ error: 'Name and degree plan file required' }, { status: 400 })
    }

    await mkdir(UPLOAD_DIR, { recursive: true })

    const buffer = Buffer.from(await degreePlanFile.arrayBuffer())
    const fileName = `${Date.now()}-${degreePlanFile.name}`
    const filePath = join(UPLOAD_DIR, fileName)
    await writeFile(filePath, buffer)

    // Verify file was written and wait for filesystem to sync
    const { existsSync, statSync } = await import('fs')
    if (!existsSync(filePath)) {
      throw new Error(`Failed to write file to ${filePath}`)
    }
    
    // Wait a moment for filesystem to fully sync
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const fileStats = statSync(filePath)
    console.log(`File written successfully: ${filePath}, size: ${fileStats.size} bytes`)

    // Parse degree plan using backend service
    const botService = createTranscriptBotService()
    const parseResult = await botService.parseAndVerifyDegreePlan(filePath)

    console.log('Parse result:', JSON.stringify(parseResult, null, 2))

    const degreePlans = {
      fileName: degreePlanFile.name,
      fileSize: degreePlanFile.size,
      fileType: degreePlanFile.type,
      uploadedAt: Date.now(),
      parsedData: parseResult?.parsedData || undefined,
      verificationStatus: parseResult?.verificationStatus || 'pending',
      verificationNotes: parseResult?.verificationNotes || []
    }

    const transcriptBot = await dbService.createTranscriptBot(
      decoded.userId,
      name,
      degreePlans
    )

    return NextResponse.json(transcriptBot)
  } catch (error) {
    console.error('Create transcript bot error:', error)
    return NextResponse.json(
      { error: 'Failed to create transcript bot' },
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

    const decoded = await verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const transcriptBots = await dbService.findTranscriptBotsByUserId(decoded.userId)

    return NextResponse.json(transcriptBots)
  } catch (error) {
    console.error('Get transcript bots error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transcript bots' },
      { status: 500 }
    )
  }
}
