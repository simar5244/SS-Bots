import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import jwt from 'jsonwebtoken'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key'
const UPLOAD_DIR = join(homedir(), 'Desktop', 'db', 'transcript-uploads')

export async function POST(
  req: NextRequest,
  { params }: { params: { botId: string } }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }

    const bot = await dbService.findTranscriptBotById(params.botId)
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    if (bot.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const formData = await req.formData()
    const programName = formData.get('programName') as string
    const files = formData.getAll('transcripts') as File[]

    if (!programName || files.length === 0) {
      return NextResponse.json({ error: 'Program name and at least one transcript required' }, { status: 400 })
    }

    if (files.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 transcripts allowed per batch' }, { status: 400 })
    }

    await mkdir(UPLOAD_DIR, { recursive: true })

    const studentTranscriptsList = []

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const fileName = `${Date.now()}-${file.name}`
      const filePath = join(UPLOAD_DIR, fileName)
      await writeFile(filePath, buffer)

      studentTranscriptsList.push([{
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadedAt: Date.now()
      }])
    }

    const { batchId, evaluations } = await dbService.createTranscriptEvaluationBatch(
      params.botId,
      programName,
      studentTranscriptsList
    )

    return NextResponse.json({
      isBatch: true,
      batchId,
      evaluations,
      count: evaluations.length
    })
  } catch (error) {
    console.error('Create batch evaluation error:', error)
    return NextResponse.json(
      { error: 'Failed to create batch evaluation' },
      { status: 500 }
    )
  }
}
