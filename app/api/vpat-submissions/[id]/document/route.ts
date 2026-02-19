import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { dbService } from '@/lib/db'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key'
const UPLOAD_DIR = join(process.env.HOME || '', 'Desktop', 'db', 'vpat-submissions')

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    const submission = await dbService.findVPATSubmissionById(params.id)

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // Verify user owns the bot that this submission belongs to
    const vpatBot = await dbService.findVPATBotById(submission.vpatBotId)
    if (!vpatBot || vpatBot.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Find the uploaded document file
    const files = await readdir(UPLOAD_DIR)
    const submissionFile = files.find((file: string) => file.includes(submission.id))
    
    if (!submissionFile) {
      return NextResponse.json({ error: 'Document file not found' }, { status: 404 })
    }

    const filePath = join(UPLOAD_DIR, submissionFile)
    const buffer = await readFile(filePath)

    // For now, return the raw text content
    // In a production environment, you might want to:
    // 1. Parse PDF/DOCX to text with proper formatting
    // 2. Cache the parsed text
    // 3. Return structured page data
    
    // Simple text extraction for demonstration
    const text = buffer.toString('utf-8')
    
    return new NextResponse(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Get document error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    )
  }
}
