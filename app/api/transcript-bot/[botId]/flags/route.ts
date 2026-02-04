import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export async function POST(
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

    const { flagType, itemType, description, originalValue, editedValue, itemId } = await req.json()

    const flag = await dbService.createTranscriptFlag(
      params.botId,
      decoded.userId,
      flagType,
      itemType,
      description,
      originalValue,
      editedValue,
      itemId
    )

    return NextResponse.json(flag)
  } catch (error) {
    console.error('Create flag error:', error)
    return NextResponse.json(
      { error: 'Failed to create flag' },
      { status: 500 }
    )
  }
}

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

    const user = await dbService.findUserById(decoded.userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const bot = await dbService.findTranscriptBotById(params.botId)
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    // Only bot owner or admin can view flags
    if (bot.userId !== decoded.userId && user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const flags = await dbService.findTranscriptFlagsByBotId(params.botId)

    return NextResponse.json(flags)
  } catch (error) {
    console.error('Get flags error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch flags' },
      { status: 500 }
    )
  }
}
