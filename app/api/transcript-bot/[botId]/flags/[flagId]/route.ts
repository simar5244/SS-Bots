import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { botId: string; flagId: string } }
) {
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

    const user = await dbService.findUserById(decoded.userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only admins can review flags
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const flag = await dbService.findTranscriptFlagById(params.flagId)
    if (!flag) {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
    }

    if (flag.transcriptBotId !== params.botId) {
      return NextResponse.json({ error: 'Flag does not belong to this bot' }, { status: 400 })
    }

    const { status, reviewNotes } = await req.json()

    const updatedFlag = await dbService.updateTranscriptFlag(params.flagId, {
      status,
      reviewNotes,
      reviewedBy: decoded.userId,
      reviewedAt: Date.now()
    })

    return NextResponse.json(updatedFlag)
  } catch (error) {
    console.error('Update flag error:', error)
    return NextResponse.json(
      { error: 'Failed to update flag' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { botId: string; flagId: string } }
) {
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

    const user = await dbService.findUserById(decoded.userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only admins can delete flags
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const flag = await dbService.findTranscriptFlagById(params.flagId)
    if (!flag) {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
    }

    if (flag.transcriptBotId !== params.botId) {
      return NextResponse.json({ error: 'Flag does not belong to this bot' }, { status: 400 })
    }

    await dbService.deleteTranscriptFlag(params.flagId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete flag error:', error)
    return NextResponse.json(
      { error: 'Failed to delete flag' },
      { status: 500 }
    )
  }
}
