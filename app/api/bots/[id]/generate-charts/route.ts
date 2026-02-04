import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ChartService } from '@/lib/chart-service'
import { AIService } from '@/lib/ai-service'
import { DatabaseConnector } from '@/lib/db-connectors'


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

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Step 1: Use existing AI chat service to get data
    const result = await AIService.processNaturalLanguageQuery(
      query,
      bot.id,
      bot.schema || {},
      bot.vectorData || [],
      bot.dbType,
      (bot as any).dbContext || '',
      (bot as any).dbIntelligence || '',
      (bot as any).dbHandbook || {}
    )

    // Step 2: Execute the SQL query
    const data = await DatabaseConnector.executeQuery(
      bot.dbType,
      bot.dbConfig,
      result.sql
    )

    if (!data || data.length === 0) {
      return NextResponse.json({
        charts: [],
        message: 'No data returned from query'
      })
    }

    // Step 3: Use Chart AI Service to generate chart configurations
    const context = (bot as any).dbContext || `Database: ${bot.dbType}`
    const charts = await ChartService.generateCharts({
      query,
      data,
      context,
      sqlQuery: result.sql
    })

    return NextResponse.json({
      charts,
      dataRows: data.length,
      sql: result.sql
    })
  } catch (error) {
    console.error('Chart generation error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to generate charts' },
      { status: 500 }
    )
  }
}
