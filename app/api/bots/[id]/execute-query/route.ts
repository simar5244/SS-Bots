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

    const { query } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Security: Basic query validation (prevent destructive operations)
    const lowerQuery = query.toLowerCase().trim()
    const destructiveKeywords = ['drop', 'delete', 'truncate', 'alter', 'create', 'insert', 'update']
    
    for (const keyword of destructiveKeywords) {
      if (lowerQuery.includes(keyword)) {
        return NextResponse.json(
          { error: `Destructive operation '${keyword}' is not allowed` },
          { status: 403 }
        )
      }
    }

    const results = await DatabaseConnector.executeQuery(
      bot.dbType,
      bot.dbConfig,
      query
    )

    return NextResponse.json({ results: results || [] })
  } catch (error) {
    console.error('Query execution error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Query execution failed' },
      { status: 500 }
    )
  }
}
