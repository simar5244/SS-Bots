import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'


export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bots = await dbService.findBotsByUserId(user.id)
    return NextResponse.json(bots)
  } catch (error) {
    console.error('Error fetching bots:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, dbType, dbConfig } = await request.json()

    if (!name || !dbType || !dbConfig) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const bot = await dbService.createBot(user.id, name, dbType, dbConfig)

    return NextResponse.json(bot)
  } catch (error) {
    console.error('Error creating bot:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
