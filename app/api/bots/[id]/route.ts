import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'


export async function PATCH(
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

    const updates = await request.json()
    await dbService.updateBot(params.id, updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating bot:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
