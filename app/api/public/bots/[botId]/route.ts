import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { botId: string } }
) {
  try {
    const bot = await dbService.findBotById(params.botId)
    
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    // Return only public info (no credentials)
    return NextResponse.json({
      id: bot.id,
      name: bot.name,
      dbType: bot.dbType,
      isConnected: bot.isConnected,
    })
  } catch (error) {
    console.error('Error fetching bot:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
