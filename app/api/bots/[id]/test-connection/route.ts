import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import { DatabaseConnector } from '@/lib/db-connectors'
import { getUserFromRequest } from '@/lib/auth'


export async function POST(
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

    const isConnected = await DatabaseConnector.testConnection(bot.dbType, bot.dbConfig)

    await dbService.updateBot(bot.id, { isConnected })

    return NextResponse.json({ success: isConnected })
  } catch (error) {
    console.error('Connection test error:', error)
    return NextResponse.json(
      { error: 'Connection failed', details: (error as Error).message },
      { status: 500 }
    )
  }
}
