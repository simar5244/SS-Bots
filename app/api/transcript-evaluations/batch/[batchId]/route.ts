import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export async function GET(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    
    const evaluations = await dbService.findTranscriptEvaluationsByBatchId(params.batchId)
    
    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Verify user owns the bot
    const firstEvaluation = evaluations[0]
    const bot = await dbService.findTranscriptBotById(firstEvaluation.transcriptBotId)
    if (!bot || bot.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({
      batchId: params.batchId,
      evaluations,
      count: evaluations.length
    })
  } catch (error) {
    console.error('Get batch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch batch evaluations' },
      { status: 500 }
    )
  }
}
