import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export async function GET(
  req: NextRequest,
  { params }: { params: { botId: string } }
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

    const bot = await dbService.findTranscriptBotById(params.botId)

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    if (bot.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json(bot)
  } catch (error) {
    console.error('Get transcript bot error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transcript bot' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { botId: string } }
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

    const bot = await dbService.findTranscriptBotById(params.botId)

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    if (bot.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updates = await req.json()
    const updatedBot = await dbService.updateTranscriptBot(params.botId, updates)

    return NextResponse.json(updatedBot)
  } catch (error) {
    console.error('Update transcript bot error:', error)
    return NextResponse.json(
      { error: 'Failed to update transcript bot' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { botId: string } }
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

    const bot = await dbService.findTranscriptBotById(params.botId)

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    if (bot.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await dbService.deleteTranscriptBot(params.botId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete transcript bot error:', error)
    return NextResponse.json(
      { error: 'Failed to delete transcript bot' },
      { status: 500 }
    )
  }
}
