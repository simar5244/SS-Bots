import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import { DatabaseConnector } from '@/lib/db-connectors'
import { getUserFromRequest } from '@/lib/auth'


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bot = await dbService.findBotById(params.id)
    if (!bot || bot.userId !== user.id) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    // Fetch fresh schema with ALL data (no limits)
    const schema = await DatabaseConnector.getSchema(bot.dbType, bot.dbConfig)
    
    // Don't save to bot - just return it (too large for JSON storage)
    return NextResponse.json({ schema })
  } catch (error) {
    console.error('Schema fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schema' },
      { status: 500 }
    )
  }
}
