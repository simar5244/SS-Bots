import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import { getBatchResults } from '@/lib/vpat-multi-processor'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key'

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
    
    const batchResults = await getBatchResults(params.batchId)
    
    if (!batchResults || batchResults.submissions.length === 0) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Verify user owns at least one submission in this batch
    const firstSubmission = batchResults.submissions[0]
    const vpatBot = await dbService.findVPATBotById(firstSubmission.vpatBotId)
    if (!vpatBot || vpatBot.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json(batchResults)
  } catch (error) {
    console.error('Get batch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch batch results' },
      { status: 500 }
    )
  }
}
