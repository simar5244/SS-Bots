import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { dbService } from '@/lib/db'
import { processVPATSubmission } from '@/lib/vpat-processor'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const UPLOAD_DIR = join(process.env.HOME || '', 'Desktop', 'db', 'vpat-submissions')

export async function POST(
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

    // Reset submission status for reprocessing
    await dbService.updateVPATSubmission(submission.id, {
      status: 'pending',
      extractedData: undefined,
      validationResults: undefined,
      aiAnalysis: undefined,
      generatedScorecard: undefined,
      detailedScorecard: undefined,
      completedAt: undefined
    })

    // Note: clearProcessingLogs doesn't exist in current dbService
    // New logs will be added during reprocessing, old ones will remain in history

    // Start background processing
    processVPATSubmission(submission.id, vpatBot, buffer, submission.submittedDocument.fileType).catch((err: Error) => {
      console.error('Background reprocessing error:', err)
    })

    return NextResponse.json({
      message: 'Reprocessing started successfully',
      submissionId: submission.id
    })
  } catch (error) {
    console.error('Reprocess error:', error)
    return NextResponse.json(
      { error: 'Failed to start reprocessing' },
      { status: 500 }
    )
  }
}
