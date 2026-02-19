import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key'

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

    return NextResponse.json({
      degreePlans: bot.degreePlans,
      tccnsData: bot.tccnsData,
      shareableLink: bot.shareableLink
    })
  } catch (error) {
    console.error('Get configuration error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    )
  }
}

export async function PUT(
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

    const { degreePlans } = await req.json()

    const updatedBot = await dbService.updateTranscriptBot(params.botId, {
      degreePlans: {
        ...bot.degreePlans,
        parsedData: degreePlans,
        verificationStatus: 'verified'
      }
    })

    return NextResponse.json(updatedBot)
  } catch (error) {
    console.error('Update configuration error:', error)
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    )
  }
}
