import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

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
    const vpatBot = await dbService.findVPATBotById(params.id)

    if (!vpatBot) {
      return NextResponse.json({ error: 'VPAT bot not found' }, { status: 404 })
    }

    if (vpatBot.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json(vpatBot)
  } catch (error) {
    console.error('Get VPAT bot error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch VPAT bot' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    const vpatBot = await dbService.findVPATBotById(params.id)

    if (!vpatBot) {
      return NextResponse.json({ error: 'VPAT bot not found' }, { status: 404 })
    }

    if (vpatBot.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updates = await req.json()
    const updatedBot = await dbService.updateVPATBot(params.id, updates)

    return NextResponse.json(updatedBot)
  } catch (error) {
    console.error('Update VPAT bot error:', error)
    return NextResponse.json(
      { error: 'Failed to update VPAT bot' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    const vpatBot = await dbService.findVPATBotById(params.id)

    if (!vpatBot) {
      return NextResponse.json({ error: 'VPAT bot not found' }, { status: 404 })
    }

    if (vpatBot.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await dbService.deleteVPATBot(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete VPAT bot error:', error)
    return NextResponse.json(
      { error: 'Failed to delete VPAT bot' },
      { status: 500 }
    )
  }
}
