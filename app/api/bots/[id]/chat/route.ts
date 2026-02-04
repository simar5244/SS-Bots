import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import { DatabaseConnector } from '@/lib/db-connectors'
import { AIService } from '@/lib/ai-service'
import { getUserFromRequest } from '@/lib/auth'
// import { createHash } from 'crypto' // CACHING DISABLED


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
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    // Handbook is optional - nuclear mode works without it
    const handbook: any = (bot as any).dbHandbook
    console.log('📖 Handbook status:', handbook?.tables ? `${Object.keys(handbook.tables).length} tables` : 'not generated')

    // SMART ROUTING: Calculate DB size to decide SQL vs Nuclear
    const schema: any = bot.schema || {}
    let totalRows = 0
    for (const tableName of Object.keys(schema)) {
      const sampleData = schema[tableName]?.sampleData
      if (Array.isArray(sampleData)) {
        totalRows += sampleData.length
      }
    }
    
    const { query, responseMode } = await request.json()
    
    const NUCLEAR_THRESHOLD = 150 // rows
    const userPrefersQuality = responseMode === 'better' // 'better' or 'cheaper'
    const isSmallDB = totalRows > 0 && totalRows <= NUCLEAR_THRESHOLD
    
    // Decision logic:
    // - If user wants 'better': always nuclear
    // - If user wants 'cheaper': nuclear only if DB is small (< 150 rows)
    const useNuclearFirst = userPrefersQuality || isSmallDB
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎯 QUERY ROUTING DECISION')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📊 Database Size:`)
    console.log(`   • Total sample rows: ${totalRows}`)
    console.log(`   • Nuclear threshold: ${NUCLEAR_THRESHOLD} rows`)
    console.log(`   • Classification: ${isSmallDB ? '🟢 SMALL DB' : '🔴 LARGE DB'}`)
    console.log(``)
    console.log(`👤 User Preference:`)
    console.log(`   • Mode: ${responseMode || 'cheaper (default)'}`)
    console.log(`   • Prefers quality: ${userPrefersQuality ? 'YES' : 'NO'}`)
    console.log(``)
    console.log(`⚡ DECISION: ${useNuclearFirst ? '🔥 NUCLEAR METHOD' : '🔍 SQL METHOD'}`)
    if (useNuclearFirst) {
      console.log(`   Reason: ${userPrefersQuality ? 'User selected BETTER quality' : 'Small DB (cost-effective)'}`)
      console.log(`   • Fetches real data directly`)
      console.log(`   • Better, more detailed answers`)
      console.log(`   • Higher token usage (~8k tokens)`)
    } else {
      console.log(`   Reason: Large DB + user selected CHEAPER`)
      console.log(`   • Generates SQL queries (3 attempts max)`)
      console.log(`   • Cost-effective for large databases`)
      console.log(`   • Lower token usage (~1.5k tokens)`)
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // CACHING DISABLED - always fetch fresh data
    // const queryHash = createHash('md5').update(query).digest('hex')
    // const cached = await dbService.findQueryCache(bot.id, queryHash)
    // if (cached) { return NextResponse.json({ ... }) }

    let sql = ''
    let relevantTables: string[] = []
    let queryResults: any[] = []
    let nuclearUsed = false
    let answerText = ''

    // If DB is small, skip SQL and go nuclear - fetch ALL data directly from DB
    if (useNuclearFirst) {
      console.log('⚡ NUCLEAR: Fetching entire database directly...')
      nuclearUsed = true
      
      // Get ALL table names directly from the database (not from handbook/schema)
      let tableNames: string[] = []
      try {
        let listTablesQuery = ''
        if (bot.dbType === 'postgresql') {
          listTablesQuery = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
        } else if (bot.dbType === 'mysql') {
          listTablesQuery = `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()`
        } else if (bot.dbType === 'mssql') {
          listTablesQuery = `SELECT TABLE_NAME as table_name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`
        }
        if (listTablesQuery) {
          const tablesResult = await DatabaseConnector.executeQuery(bot.dbType, bot.dbConfig, listTablesQuery)
          tableNames = tablesResult.map((r: any) => r.table_name || r.TABLE_NAME).filter(Boolean)
        }
      } catch (e: any) {
        console.log(`  ⚠️ Could not list tables: ${e.message}`)
      }
      
      // Fallback to schema if direct query failed
      if (tableNames.length === 0) {
        tableNames = Object.keys(bot.schema || {})
      }
      
      console.log(`  📋 Found ${tableNames.length} tables: ${tableNames.join(', ')}`)
      
      // Fetch ALL rows from ALL tables (no limits - we want complete data)
      const allTablesData: { [tableName: string]: any[] } = {}
      let totalRowsFetched = 0
      
      for (const tableName of tableNames) {
        try {
          let fetchQuery = ''
          if (bot.dbType === 'mssql') {
            fetchQuery = `SELECT * FROM [${tableName}]`
          } else if (bot.dbType === 'mysql') {
            fetchQuery = `SELECT * FROM \`${tableName}\``
          } else if (bot.dbType === 'mongodb') {
            fetchQuery = JSON.stringify({ collection: tableName, filter: {}, limit: 10000 })
          } else {
            fetchQuery = `SELECT * FROM "${tableName}"`
          }
          const tableData = await DatabaseConnector.executeQuery(bot.dbType, bot.dbConfig, fetchQuery)
          if (Array.isArray(tableData) && tableData.length > 0) {
            allTablesData[tableName] = tableData
            totalRowsFetched += tableData.length
            console.log(`    ✓ ${tableName}: ${tableData.length} rows`)
          } else {
            console.log(`    ○ ${tableName}: empty`)
          }
        } catch (e: any) {
          console.log(`    ✗ ${tableName}: ${e.message}`)
        }
      }
      
      console.log(`  📊 Total: ${totalRowsFetched} rows from ${Object.keys(allTablesData).length} tables`)

      // PHASE 1: Use AI to identify which tables are relevant (lightweight)
      const tableList = Object.keys(allTablesData).map(name => {
        const rows = allTablesData[name]
        const sampleRow = rows[0] || {}
        const columns = Object.keys(sampleRow).join(', ')
        return `- ${name}: ${columns}`
      }).join('\n')

      const openai = require('openai')
      const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY })
      
      const tableSelectionResp = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `Given this user question and list of database tables, identify which tables are most relevant.

USER QUESTION: ${query}

AVAILABLE TABLES:
${tableList}

Respond with ONLY a comma-separated list of relevant table names (e.g., "chatbots, profiles, knowledge_bases"). If the question is general or you're unsure, list ALL tables.` }],
        temperature: 0,
        max_tokens: 200,
      })
      
      const relevantTablesText = (tableSelectionResp.choices[0].message.content || '').trim()
      const relevantTables = relevantTablesText.split(',').map((t: string) => t.trim()).filter((t: string) => t in allTablesData)
      
      console.log(`  🎯 AI selected ${relevantTables.length} relevant tables: ${relevantTables.join(', ')}`)

      // PHASE 2: Build data text with ONLY relevant tables
      const dataSections: string[] = []
      for (const tableName of relevantTables) {
        const rows = allTablesData[tableName]
        dataSections.push(`=== ${tableName} (${rows.length} rows) ===\n${JSON.stringify(rows, null, 2)}`)
      }
      const dataText = dataSections.join('\n\n')

      // Smart token management: Use GPT-4o (128K context) for large datasets
      const estimatedTokens = Math.ceil(dataText.length / 4) // Rough estimate: 4 chars = 1 token
      const useGPT4o = estimatedTokens > 25000 // Switch to GPT-4o if > 25K tokens
      const maxContextTokens = useGPT4o ? 120000 : 25000 // GPT-4o: 128K, GPT-4o-mini: 128K but we use 25K for safety
      const maxChars = maxContextTokens * 4

      let finalDataText = dataText
      let modelToUse = 'gpt-4o-mini'
      
      if (dataText.length > maxChars) {
        // If even GPT-4o can't handle it, use compact representation
        console.log(`  ⚠️ Data too large (${estimatedTokens} tokens), using compact format...`)
        const compactSections: string[] = []
        for (const tableName of relevantTables) {
          const rows = allTablesData[tableName]
          // Compact format: one row per line, key fields only
          const compactRows = rows.map(r => {
            const keys = Object.keys(r).slice(0, 10) // First 10 columns only
            return keys.map(k => `${k}:${JSON.stringify(r[k])}`).join(' | ')
          }).join('\n')
          compactSections.push(`=== ${tableName} (${rows.length} rows) ===\n${compactRows}`)
        }
        finalDataText = compactSections.join('\n\n')
      } else if (useGPT4o) {
        console.log(`  🚀 Using GPT-4o for large dataset (${estimatedTokens} tokens)`)
        modelToUse = 'gpt-4o'
      }

      const resp = await client.chat.completions.create({
        model: modelToUse,
        messages: [{ role: 'user', content: `You are a data analyst. Answer the user's question using ONLY the database data provided below.

USER QUESTION: ${query}

DATABASE DATA:
${finalDataText}

Answer directly and cite specific data. Be thorough and analyze ALL the data provided.` }],
        temperature: 0.2,
        max_tokens: 2000,
      })
      answerText = (resp.choices[0].message.content || '').trim()
      sql = 'NUCLEAR_DIRECT_DB_FETCH'
    } else {
      // Normal SQL flow for large DBs
      const result = await AIService.processNaturalLanguageQuery(
        query,
        bot.id,
        bot.schema || {},
        bot.vectorData || [],
        bot.dbType,
        (bot as any).dbContext,
        (bot as any).dbIntelligence,
        (bot as any).dbHandbook
      )
      sql = result.sql
      relevantTables = result.relevantTables
    }

    // Sanity probes: validate specific filters before executing complex query
    if (bot.dbType !== 'mongodb') {
      const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/i)
      if (whereMatch) {
        const whereClause = whereMatch[1]
        // Extract specific value filters (e.g., name ILIKE 'Anna%')
        const specificFilters = whereClause.match(/\b(\w+)\s+(?:ILIKE|LIKE|=)\s+['"]([^'"]+)['"]/gi)
        if (specificFilters && specificFilters.length > 0) {
          // Run a quick probe to see if any rows match
          const firstTable = sql.match(/FROM\s+["`\[]?(\w+)["`\]]?/i)?.[1]
          if (firstTable && (bot.schema as any)[firstTable]) {
            try {
              let probeQuery = ''
              if (bot.dbType === 'mssql') {
                probeQuery = `SELECT TOP 1 * FROM [${firstTable}] WHERE ${whereClause}`
              } else if (bot.dbType === 'mysql') {
                probeQuery = `SELECT * FROM \`${firstTable}\` WHERE ${whereClause} LIMIT 1`
              } else {
                probeQuery = `SELECT * FROM "${firstTable}" WHERE ${whereClause} LIMIT 1`
              }
              const probeResult = await DatabaseConnector.executeQuery(bot.dbType, bot.dbConfig, probeQuery)
              if (Array.isArray(probeResult) && probeResult.length === 0) {
                // Filter doesn't match any data; drop it and go broad
                if (bot.dbType === 'mssql') {
                  sql = `SELECT TOP 50 * FROM [${firstTable}] ORDER BY (SELECT NULL)`
                } else if (bot.dbType === 'mysql') {
                  sql = `SELECT * FROM \`${firstTable}\` LIMIT 50`
                } else {
                  sql = `SELECT * FROM "${firstTable}" LIMIT 50`
                }
              }
            } catch {
              // probe failed, continue with original query
            }
          }
        }
      }
    }

    // Pre-execution validation & fallback synthesis
    try {
      if (bot.dbType === 'mongodb') {
        JSON.parse(sql)
      } else {
        const hasFrom = /\bfrom\b/i.test(sql)
        if (!hasFrom) throw new Error('No FROM detected')
      }
    } catch {
      const pick = Array.isArray(relevantTables) && relevantTables.length > 0 ? relevantTables[0] : Object.keys(bot.schema || {})[0]
      const table = pick ? (bot.schema as any)[pick] : null
      if (bot.dbType === 'mongodb') {
        sql = JSON.stringify({ collection: pick || 'unknown', filter: {}, limit: 50 })
      } else if (table && table.columns && table.columns.length > 0) {
        const col = table.columns[0].column_name
        if (bot.dbType === 'mssql') {
          sql = `SELECT TOP 50 [${col}] FROM [${pick}]`
        } else if (bot.dbType === 'mysql') {
          sql = `SELECT \`${col}\` FROM \`${pick}\` LIMIT 50`
        } else { // postgresql default
          sql = `SELECT "${col}" FROM "${pick}" LIMIT 50`
        }
      } else {
        sql = bot.dbType === 'mssql' ? 'SELECT TOP 50 1' : 'SELECT 1 LIMIT 50'
      }
    }

    let executionError = null
    let retryCount = 0
    const maxRetries = 3
    const queryHistory: Array<{attempt: number, query: string, error?: string, rows?: number}> = []
    if (!nuclearUsed) queryHistory.push({attempt: 0, query: sql})

    // Skip all SQL execution if nuclear method was used (answer already generated)
    if (!nuclearUsed) {
      // Presence probes: find non-empty tables to steer retries
      const schemaAny: any = bot.schema || {}
    const tableNamesAll = Object.keys(schemaAny)
    const keywords = ['conversation','message','topic','intent','knowledge','kb','document','upload','content','text','user','session']
    const scoreTable = (t: string) => {
      const nameScore = keywords.some(k => t.toLowerCase().includes(k)) ? 2 : 0
      const cols = (schemaAny[t]?.columns || []) as any[]
      const colScore = cols.some(c => keywords.some(k => (c.column_name||'').toLowerCase().includes(k))) ? 2 : 0
      const texty = cols.some(c => /text|varchar|char|json|jsonb|nvarchar|ntext/i.test(c.data_type||'')) ? 1 : 0
      return nameScore + colScore + texty
    }
    const candidateTables = (
      (Array.isArray(relevantTables) && relevantTables.length > 0 ? relevantTables : tableNamesAll)
        .map((t: string) => ({ t, s: scoreTable(t) }))
        .sort((a,b) => b.s - a.s)
        .slice(0, Math.min(8, tableNamesAll.length))
        .map(x => x.t)
    )
    const nonEmptyTables: string[] = []
    for (const t of candidateTables) {
      try {
        let probeSql = ''
        if (bot.dbType === 'mongodb') {
          const probe = JSON.stringify({ collection: t, filter: {}, limit: 1 })
          const res = await DatabaseConnector.executeQuery(bot.dbType, bot.dbConfig, probe)
          if (Array.isArray(res) && res.length > 0) nonEmptyTables.push(t)
        } else if (bot.dbType === 'mssql') {
          probeSql = `SELECT TOP 1 * FROM [${t}]`
          const res = await DatabaseConnector.executeQuery(bot.dbType, bot.dbConfig, probeSql)
          if (Array.isArray(res) && res.length > 0) nonEmptyTables.push(t)
        } else if (bot.dbType === 'mysql') {
          probeSql = `SELECT * FROM \`${t}\` LIMIT 1`
          const res = await DatabaseConnector.executeQuery(bot.dbType, bot.dbConfig, probeSql)
          if (Array.isArray(res) && res.length > 0) nonEmptyTables.push(t)
        } else { // postgresql
          probeSql = `SELECT * FROM "${t}" LIMIT 1`
          const res = await DatabaseConnector.executeQuery(bot.dbType, bot.dbConfig, probeSql)
          if (Array.isArray(res) && res.length > 0) nonEmptyTables.push(t)
        }
      } catch {
        // ignore probe errors
      }
    }

    // Smart retry loop: if query fails, learn from error and retry
    while (retryCount < maxRetries) {
      try {
        queryResults = await DatabaseConnector.executeQuery(
          bot.dbType,
          bot.dbConfig,
          sql
        )
        // If executed but empty, try to broaden/relax query and retry
        if (Array.isArray(queryResults) && queryResults.length === 0 && retryCount < maxRetries - 1) {
          queryHistory.push({attempt: retryCount, query: sql, rows: 0})
          retryCount++
          const handbook: any = (bot as any).dbHandbook || {}
          const hbText = JSON.stringify(handbook, null, 2).slice(0, 8000)
          const historyText = queryHistory.map(h => `Attempt ${h.attempt}: ${h.query}${h.error ? ` ERROR: ${h.error}` : ''}${h.rows !== undefined ? ` ROWS: ${h.rows}` : ''}`).join('\n')
          let relaxPrompt = ''
          if (retryCount === 1) {
            // Retry 1: widen text filters, keep structure
            relaxPrompt = `The following ${bot.dbType.toUpperCase()} query returned 0 rows. WIDEN TEXT FILTERS (e.g., equals→LIKE/ILIKE, narrow→broad patterns) but keep the same join structure.

Original Question: ${query}

HANDBOOK (all tables/columns with descriptions):
${hbText}

QUERY HISTORY (all attempts so far):
${historyText}

Database Type: ${bot.dbType}
Known Non-Empty Tables: ${nonEmptyTables.join(', ') || 'unknown'}

Rules:
- Use correct dialect for ${bot.dbType}
- Convert specific text matches to LIKE/ILIKE '%pattern%'
- Use ONLY columns from Handbook
- Keep ORDER BY and LIMIT
- Return ONLY the query, no explanations.

Widened Query:`
          } else if (retryCount === 2) {
            // Retry 2: drop user-specified filters, go broad with recency
            relaxPrompt = `The query still returned 0 rows. DROP user-specified filters (names, specific values) and fetch RECENT data from the most relevant non-empty table.

Original Question: ${query}

HANDBOOK (all tables/columns with descriptions):
${hbText}

QUERY HISTORY (all attempts so far):
${historyText}

Database Type: ${bot.dbType}
Known Non-Empty Tables: ${nonEmptyTables.join(', ') || 'unknown'}

Rules:
- Use correct dialect for ${bot.dbType}
- Remove WHERE clauses with specific user values
- Add ORDER BY timestamp/created_at/id DESC
- Use ONLY columns from Handbook
- Use LIMIT/TOP 50
- Return ONLY the query, no explanations.

Broad Query:`
          } else {
            // Retry 3: simplify to single table
            relaxPrompt = `Still 0 rows. Simplify to a SINGLE-TABLE query on the most relevant non-empty table with ORDER BY recency and LIMIT.

Original Question: ${query}

HANDBOOK (all tables/columns with descriptions):
${hbText}

QUERY HISTORY (all attempts so far):
${historyText}

Database Type: ${bot.dbType}
Known Non-Empty Tables: ${nonEmptyTables.join(', ') || 'unknown'}

Rules:
- Use correct dialect for ${bot.dbType}
- Single table only, no JOINs
- ORDER BY timestamp/id DESC
- Use ONLY columns from Handbook
- LIMIT/TOP 50
- Return ONLY the query, no explanations.

Simple Query:`
          }
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
        break // Success, exit loop
      } catch (error) {
        executionError = (error as Error).message
        console.error(`Query execution error (attempt ${retryCount + 1}):`, error)
        queryHistory.push({attempt: retryCount, query: sql, error: executionError})
        retryCount++
        
        if (retryCount < maxRetries) {
          // Ask AI to fix the query based on the error
          console.log('Asking AI to fix query based on error...')
          // Build strict column whitelist from handbook for error context
          const handbook: any = (bot as any).dbHandbook || {}
          const validColsText = Object.keys(bot.schema || {}).slice(0, 5).map(t => {
            const hbCols = handbook?.tables?.[t]?.columns ? Object.keys(handbook.tables[t].columns) : []
            const schemaCols = ((bot.schema as any)[t]?.columns || []).map((c: any) => c.column_name)
            const cols = hbCols.length > 0 ? hbCols : schemaCols
            return `${t}: ${cols.slice(0, 20).join(', ')}`
          }).join('\n')

          const hbText = JSON.stringify(handbook, null, 2).slice(0, 8000)
          const historyText = queryHistory.map(h => `Attempt ${h.attempt}: ${h.query}${h.error ? ` ERROR: ${h.error}` : ''}${h.rows !== undefined ? ` ROWS: ${h.rows}` : ''}`).join('\n')
          const fixPrompt = `The following SQL query failed with an error. Fix it using ONLY the valid columns from the Handbook.

Original Question: ${query}

HANDBOOK (all tables/columns with descriptions):
${hbText}

QUERY HISTORY (all attempts so far):
${historyText}

Database Type: ${bot.dbType}
Known Non-Empty Tables: ${nonEmptyTables.join(', ') || 'unknown'}

VALID COLUMNS (use ONLY from this list):
${validColsText}

Rules:
- Use ONLY columns listed in Handbook
- Do NOT invent columns (e.g., if "response" doesn't exist, don't use it)
- Learn from previous errors in Query History
- Use correct dialect for ${bot.dbType}
- Return ONLY the SQL query, no explanations

Fixed Query:`

          const openai = require('openai')
          const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY })
          const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: fixPrompt }],
            temperature: 0.2,
            max_tokens: 500,
          })
          
          sql = response.choices[0].message.content?.trim() || sql
          // Strip markdown from retry too
          sql = sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim()
          console.log('Retrying with fixed query:', sql)
        }
      }
    }

    // Final fallback: if still empty and no hard error, sample likely content tables (up to 5)
    if (!executionError && Array.isArray(queryResults) && queryResults.length === 0) {
      const schema: any = bot.schema || {}
      const tableNames = Object.keys(schema)
      const keywords = ['conversation','message','topic','intent','knowledge','kb','document','upload','content','text']
      const scoreTable = (t: string) => {
        const nameScore = keywords.some(k => t.toLowerCase().includes(k)) ? 2 : 0
        const cols = (schema[t]?.columns || []) as any[]
        const colScore = cols.some(c => keywords.some(k => (c.column_name||'').toLowerCase().includes(k))) ? 2 : 0
        const texty = cols.some(c => /text|varchar|char|json|jsonb|nvarchar|ntext/i.test(c.data_type||'')) ? 1 : 0
        return nameScore + colScore + texty
      }
      const candidates = tableNames
        .map(t => ({ t, s: scoreTable(t) }))
        .sort((a,b) => b.s - a.s)
        .slice(0, Math.min(5, tableNames.length))
        .map(x => x.t)

      for (const best of candidates) {
        const cols = (schema[best]?.columns || []) as any[]
        const pickCols = ((): string[] => {
          const preferred = ['topic','intent','category','title','name','content','text','message']
          const found = preferred
            .map(p => cols.find(c => (c.column_name||'').toLowerCase() === p))
            .filter(Boolean)
            .map((c: any) => c.column_name)
          const fallback = cols.slice(0, 3).map((c:any) => c.column_name)
          const out = Array.from(new Set([...(found as string[]), ...fallback])).slice(0,3)
          return out.length ? out : fallback
        })()

        if (bot.dbType === 'mongodb') {
          sql = JSON.stringify({ collection: best, filter: {}, limit: 50 })
        } else if (pickCols.length > 0) {
          if (bot.dbType === 'mssql') {
            sql = `SELECT TOP 50 ${pickCols.map(c => `[${c}]`).join(', ')} FROM [${best}]`
          } else if (bot.dbType === 'mysql') {
            sql = `SELECT ${pickCols.map(c => `\`${c}\``).join(', ')} FROM \`${best}\` LIMIT 50`
          } else {
            sql = `SELECT ${pickCols.map(c => `"${c}"`).join(', ')} FROM "${best}" LIMIT 50`
          }
        } else {
          continue
        }
        try {
          const probe = await DatabaseConnector.executeQuery(
            bot.dbType,
            bot.dbConfig,
            sql
          )
          if (Array.isArray(probe) && probe.length > 0) {
            queryResults = probe
            break
          }
        } catch (e) {
          // try next candidate
        }
      }
    }

    // Ultimate fallback: choose the largest table and fetch some rows
    if (!executionError && Array.isArray(queryResults) && queryResults.length === 0) {
      try {
        let largestTable: string | null = null
        if (bot.dbType === 'postgresql') {
          const statSql = 'SELECT relname AS table_name, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 1'
          const stats = await DatabaseConnector.executeQuery(bot.dbType, bot.dbConfig, statSql)
          largestTable = Array.isArray(stats) && stats[0]?.table_name ? stats[0].table_name : null
        } else if (bot.dbType === 'mysql') {
          const dbName = (bot.dbConfig as any).database
          const statSql = `SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema='${dbName}' ORDER BY table_rows DESC LIMIT 1`
          const stats = await DatabaseConnector.executeQuery(bot.dbType, bot.dbConfig, statSql)
          largestTable = Array.isArray(stats) && (stats[0]?.table_name || stats[0]?.TABLE_NAME) ? (stats[0].table_name || stats[0].TABLE_NAME) : null
        } else if (bot.dbType === 'mssql') {
          const statSql = `SELECT TOP 1 t.name AS table_name, SUM(p.rows) AS rows\nFROM sys.tables t\nJOIN sys.partitions p ON t.object_id = p.object_id\nWHERE p.index_id IN (0,1)\nGROUP BY t.name\nORDER BY rows DESC`
          const stats = await DatabaseConnector.executeQuery(bot.dbType, bot.dbConfig, statSql)
          largestTable = Array.isArray(stats) && stats[0]?.table_name ? stats[0].table_name : null
        } else if (bot.dbType === 'mongodb') {
          // For MongoDB, fallback is already simple find on candidates; skip
        }

        if (largestTable) {
          if (bot.dbType === 'mssql') {
            sql = `SELECT TOP 50 * FROM [${largestTable}]`
          } else if (bot.dbType === 'mysql') {
            sql = `SELECT * FROM \`${largestTable}\` LIMIT 50`
          } else if (bot.dbType === 'postgresql') {
            sql = `SELECT * FROM "${largestTable}" LIMIT 50`
          }
          const probe = await DatabaseConnector.executeQuery(bot.dbType, bot.dbConfig, sql)
          if (Array.isArray(probe) && probe.length > 0) {
            queryResults = probe
          }
        }
      } catch {
        // swallow
      }
    }
    } // End of if (!nuclearUsed) block - skip all SQL execution when nuclear method used

    // Nuclear Failsafe: if SQL failed, fetch entire DB directly
    if (!nuclearUsed && Array.isArray(queryResults) && queryResults.length === 0) {
      console.log('  🔥 NUCLEAR FAILSAFE: SQL returned 0 rows, fetching entire DB...')
      nuclearUsed = true
      
      // Get ALL table names directly from the database
      let tableNames: string[] = []
      try {
        let listTablesQuery = ''
        if (bot.dbType === 'postgresql') {
          listTablesQuery = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
        } else if (bot.dbType === 'mysql') {
          listTablesQuery = `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()`
        } else if (bot.dbType === 'mssql') {
          listTablesQuery = `SELECT TABLE_NAME as table_name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`
        }
        if (listTablesQuery) {
          const tablesResult = await DatabaseConnector.executeQuery(bot.dbType, bot.dbConfig, listTablesQuery)
          tableNames = tablesResult.map((r: any) => r.table_name || r.TABLE_NAME).filter(Boolean)
        }
      } catch (e: any) {
        console.log(`  ⚠️ Could not list tables: ${e.message}`)
        tableNames = Object.keys(bot.schema || {})
      }
      
      console.log(`  📋 Found ${tableNames.length} tables`)
      
      const allTablesData: { [tableName: string]: any[] } = {}
      let totalRowsFetched = 0
      const maxRowsPerTable = Math.max(5, Math.floor(150 / Math.max(1, tableNames.length)))
      
      for (const tableName of tableNames) {
        try {
          let fetchQuery = ''
          if (bot.dbType === 'mssql') {
            fetchQuery = `SELECT TOP ${maxRowsPerTable} * FROM [${tableName}]`
          } else if (bot.dbType === 'mysql') {
            fetchQuery = `SELECT * FROM \`${tableName}\` LIMIT ${maxRowsPerTable}`
          } else if (bot.dbType === 'mongodb') {
            fetchQuery = JSON.stringify({ collection: tableName, filter: {}, limit: maxRowsPerTable })
          } else {
            fetchQuery = `SELECT * FROM "${tableName}" LIMIT ${maxRowsPerTable}`
          }
          const tableData = await DatabaseConnector.executeQuery(bot.dbType, bot.dbConfig, fetchQuery)
          if (Array.isArray(tableData) && tableData.length > 0) {
            allTablesData[tableName] = tableData
            totalRowsFetched += tableData.length
            console.log(`    ✓ ${tableName}: ${tableData.length} rows`)
          }
        } catch (e: any) {
          console.log(`    ✗ ${tableName}: ${e.message}`)
        }
      }
      
      console.log(`  📊 Total: ${totalRowsFetched} rows from ${Object.keys(allTablesData).length} tables`)

      const dataSections: string[] = []
      for (const [tableName, rows] of Object.entries(allTablesData)) {
        dataSections.push(`=== ${tableName} (${rows.length} rows) ===\n${JSON.stringify(rows, null, 2)}`)
      }
      const dataText = dataSections.join('\n\n')

      try {
        const openai = require('openai')
        const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY })
        const resp = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: `You are a data analyst. Answer the user's question using ONLY the database data provided below.

USER QUESTION: ${query}

DATABASE DATA:
${dataText.slice(0, 100000)}

Answer directly and cite specific data.` }],
          temperature: 0.2,
          max_tokens: 1500,
        })
        answerText = (resp.choices[0].message.content || '').trim()
      } catch (e: any) {
        answerText = `Failed to analyze data: ${e.message}`
      }
    }

    if (!nuclearUsed) {
      answerText = executionError && retryCount >= maxRetries
        ? `I couldn't get a valid result after ${maxRetries} attempts. If you can clarify key fields or date ranges, I can target the right tables faster.`
        : await AIService.answerQuestion(query, queryResults, bot.schema)
    }

    const metadata = {
      sql: nuclearUsed
        ? 'NUCLEAR_FAILSAFE_ANALYSIS_ONLY'
        : (executionError && retryCount >= maxRetries ? `Failed after ${maxRetries} attempts. Last query: ${sql}` : sql),
      relevantTables,
      rowsReturned: nuclearUsed ? 1 : queryResults.length,
      executionError: executionError && retryCount >= maxRetries ? executionError : null,
    }

    // CACHING DISABLED
    // await dbService.createQueryCache(bot.id, queryHash, answerText, metadata, 3600)

    return NextResponse.json({
      answer: answerText,
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
