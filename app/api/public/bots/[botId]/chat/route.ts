import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import { DatabaseConnector } from '@/lib/db-connectors'
import { AIService } from '@/lib/ai-service'
import { createHash } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: { botId: string } }
) {
  try {
    const bot = await dbService.findBotById(params.botId)
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    const { query } = await request.json()
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const queryHash = createHash('md5').update(query).digest('hex')
    const cached = await dbService.findQueryCache(bot.id, queryHash)

    if (cached) {
      return NextResponse.json({
        answer: cached.response,
        cached: true,
        metadata: cached.metadata,
      })
    }

    let { sql, relevantTables } = await AIService.processNaturalLanguageQuery(
      query,
      bot.id,
      bot.schema || {},
      bot.vectorData || [],
      bot.dbType,
      (bot as any).dbContext,
      (bot as any).dbIntelligence
    )

    let queryResults: any[] = []
    let executionError: string | null = null
    let retryCount = 0
    const maxRetries = 3

    while (retryCount < maxRetries) {
      try {
        queryResults = await DatabaseConnector.executeQuery(
          bot.dbType,
          bot.dbConfig,
          sql
        )
        // If executed but empty, try to broaden/relax query and retry
        if (Array.isArray(queryResults) && queryResults.length === 0 && retryCount < maxRetries - 1) {
          retryCount++
          const relaxPrompt = `The following ${bot.dbType.toUpperCase()} query returned 0 rows. Loosen constraints and broaden the search while still answering the original question. Keep it efficient.

Original Question: ${query}
Query With 0 Rows: ${sql}

Database Type: ${bot.dbType}
Database Intelligence (hints): ${(bot as any).dbIntelligence || 'N/A'}
Available Schema: ${JSON.stringify(bot.schema, null, 2)}

Rules:
- Use the correct dialect for ${bot.dbType}
- Prefer LIKE/ILIKE (or LOWER()) for fuzzy text, widen date ranges, remove overly strict filters
- Keep results capped (LIMIT/TOP) and include ORDER BY when helpful
- Return ONLY the query (or JSON for MongoDB), no explanations.

Broadened Query:`
          const openai = require('openai')
          const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY })
          const resp = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: relaxPrompt }],
            temperature: 0.3,
            max_tokens: 500,
          })
          sql = (resp.choices[0].message.content || '').replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim()
          continue
        }
        // Non-empty success
        break
      } catch (error: any) {
        executionError = error.message
        retryCount++
        if (retryCount >= maxRetries) break
        const fixPrompt = `The following ${bot.dbType.toUpperCase()} query failed with an error. Fix it.

Original Question: ${query}
Failed Query: ${sql}
Error: ${executionError}

Database Type: ${bot.dbType}
Database Intelligence (hints): ${(bot as any).dbIntelligence || 'N/A'}
Available Schema: ${JSON.stringify(bot.schema, null, 2)}

Rules:
- Use the correct dialect for ${bot.dbType}
- Keep it simple; fix identifiers, functions, date/time, joins, and limits per dialect
- Return ONLY the query (or JSON for MongoDB), no explanations.

Fixed Query:`
        const openai = require('openai')
        const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY })
        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: fixPrompt }],
          temperature: 0.2,
          max_tokens: 500,
        })
        sql = (response.choices[0].message.content || '').replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim()
      }
    }

    const answer = executionError && retryCount >= maxRetries
      ? `I couldn't get a valid result after ${maxRetries} attempts. If you can clarify fields or date ranges, I can target the right tables faster.`
      : await AIService.answerQuestion(query, queryResults, bot.schema)

    const metadata = {
      sql,
      relevantTables,
      rowsReturned: queryResults.length,
      executionError,
    }

    await dbService.createQueryCache(
      bot.id,
      queryHash,
      answer,
      metadata,
      3600
    )

    return NextResponse.json({
      answer,
      cached: false,
      sql: metadata.sql,
      rowsReturned: metadata.rowsReturned,
      metadata,
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process query', details: (error as Error).message },
      { status: 500 }
    )
  }
}
