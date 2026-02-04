import OpenAI from 'openai'
import redis from './redis'
import { createHash } from 'crypto'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export class AIService {
  static async generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    return response.data[0].embedding
  }

  static async generateHandbook(schema: any): Promise<any> {
    const tables = Object.keys(schema)
    const preview: any = {}
    for (const t of tables) {
      const row0 = Array.isArray(schema[t].sampleData) && schema[t].sampleData.length > 0 ? schema[t].sampleData[0] : null
      preview[t] = {
        columns: (schema[t].columns || []).map((c: any) => ({
          name: c.column_name,
          type: c.data_type,
          example: row0 ? (row0[c.column_name] !== undefined ? String(row0[c.column_name]).slice(0, 80) : undefined) : undefined,
        })),
        rowCountHint: Array.isArray(schema[t].sampleData) ? schema[t].sampleData.length : 0,
      }
    }

    const prompt = `You are creating a COMPLETE, strictly factual database handbook. Using ONLY the provided schema preview, write one-line descriptions for EVERY table and EVERY column. Include ALL columns - do NOT skip any. Do NOT invent tables or columns.

CRITICAL: Include ALL columns from the schema preview. If a column has an example value, mention it in the description.

Output JSON in this exact shape:
{
  "tables": {
    "<tableName>": {
      "description": "one line purpose of this table",
      "columns": {
        "<columnName>": "type, purpose, example: value"
      }
    }
  }
}

SCHEMA PREVIEW (include ALL columns from here):
${JSON.stringify(preview, null, 2)}

Generate COMPLETE handbook with ALL tables and ALL columns:`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 4000,
    })

    const content = response.choices[0].message.content || '{}'
    try {
      return JSON.parse(content)
    } catch {
      // Fallback minimal handbook
      const hb: any = { tables: {} }
      for (const t of tables) {
        hb.tables[t] = { description: `${t} table`, columns: {} }
        for (const c of (schema[t].columns || [])) hb.tables[t].columns[c.column_name] = `${c.column_name} (${c.data_type})`
      }
      return hb
    }
  }

  static buildWhitelistFromHandbook(handbook?: any): Record<string, Set<string>> {
    const wl: Record<string, Set<string>> = {}
    if (!handbook || !handbook.tables) return wl
    for (const [t, info] of Object.entries<any>(handbook.tables)) {
      wl[t] = new Set(Object.keys(info.columns || {}))
    }
    return wl
  }

  static async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    })
    return response.data.map(d => d.embedding)
  }

  static async generateSchemaEmbeddings(schema: any): Promise<any[]> {
    const embeddings = []

    for (const [tableName, tableData] of Object.entries(schema as any)) {
      for (const column of (tableData as any).columns) {
        const text = `Table: ${tableName}, Column: ${column.column_name || column.COLUMN_NAME}, Type: ${column.data_type || column.DATA_TYPE}`
        const embedding = await this.generateEmbedding(text)
        
        embeddings.push({
          id: `${tableName}.${column.column_name || column.COLUMN_NAME}`,
          table: tableName,
          column: column.column_name || column.COLUMN_NAME,
          embedding,
          metadata: {
            dataType: column.data_type || column.DATA_TYPE,
            nullable: column.is_nullable || column.IS_NULLABLE,
          },
        })
      }

      if ((tableData as any).sampleData && (tableData as any).sampleData.length > 0) {
        const sampleText = `Table: ${tableName}, Sample data: ${JSON.stringify((tableData as any).sampleData[0])}`
        const embedding = await this.generateEmbedding(sampleText)
        
        embeddings.push({
          id: `${tableName}._sample`,
          table: tableName,
          column: '_sample',
          embedding,
          metadata: {
            sampleData: (tableData as any).sampleData,
          },
        })
      }
    }

    return embeddings
  }

  static cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  static findRelevantColumns(queryEmbedding: number[], vectorData: any[], topK: number = 10): any[] {
    const similarities = vectorData.map((vec) => ({
      ...vec,
      similarity: this.cosineSimilarity(queryEmbedding, vec.embedding),
    }))

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
  }

  static async generateSQLQuery(
    naturalLanguageQuery: string,
    schema: any,
    relevantColumns: any[],
    dbType: string,
    dbContext?: string,
    dbIntelligence?: string,
    handbook?: any
  ): Promise<string> {
    const schemaContext = relevantColumns
      .map((col) => `${col.table}.${col.column} (${col.type || col.metadata?.dataType || 'unknown'})`)
      .join(', ')

    // Build CONCISE schema - only relevant tables
    const relevantTableNames = [...new Set(relevantColumns.map(c => c.table))]
    const tablesList = relevantTableNames.slice(0, 10).map(tableName => {
      const table = schema[tableName]
      if (!table) return ''
      const columns = table.columns.slice(0, 10).map((c: any) => `${c.column_name}:${c.data_type}`).join(',')
      return `${tableName}(${columns})`
    }).filter(Boolean).join(' | ')

    // Build strict valid columns list (for top 3 relevant tables), preferring handbook
    const validMap: Record<string, string[]> = {}
    const hb = handbook && handbook.tables ? handbook.tables : null
    for (const t of relevantTableNames.slice(0, 3)) {
      if (hb && hb[t] && hb[t].columns) {
        validMap[t] = Object.keys(hb[t].columns)
        continue
      }
      const table = schema[t]
      if (!table) continue
      validMap[t] = table.columns.map((c: any) => c.column_name)
    }
    const validText = Object.entries(validMap)
      .map(([t, cols]) => `${t}: ${cols.slice(0, 50).join(', ')}`)
      .join('\n')

    // Build FULL Handbook context with table summaries, columns, and examples
    let handbookText = ''
    if (hb) {
      const hbLines: string[] = []
      for (const [tName, tInfo] of Object.entries<any>(hb)) {
        if (relevantTableNames.includes(tName)) {
          const desc = tInfo.description || `${tName} table`
          const colLines = Object.entries<any>(tInfo.columns || {}).map(([cName, cDesc]) => `  - ${cName}: ${cDesc}`).join('\n')
          hbLines.push(`${tName}: ${desc}\n${colLines}`)
        }
      }
      handbookText = hbLines.length > 0 ? `\nHANDBOOK (table/column descriptions with examples):\n${hbLines.join('\n\n')}\n` : ''
    }

    // Build a per-DB prompt so the model emits the correct dialect/shape
    const header = `You are an expert data analyst. Generate a single ${dbType.toUpperCase()} query for this question.`

    const shared = `${dbIntelligence ? `DATABASE INTELLIGENCE:\n${dbIntelligence}\n\n` : ''}${dbContext ? `USER CONTEXT: ${dbContext}\n\n` : ''}${handbookText}AVAILABLE OBJECTS: ${tablesList}\n\nRELEVANT FIELDS: ${schemaContext}\n\nVALID TABLES AND COLUMNS (use ONLY from this list):\n${validText}\n\nUSER QUESTION: "${naturalLanguageQuery}"\n`;

    const prompts: Record<string, string> = {
      postgresql: `${header}\n\n${shared}\nGenerate a valid PostgreSQL query. Return ONLY the SQL text, no markdown or explanations.\n\nQuery:`,
      mysql: `${header}\n\n${shared}\nGenerate a valid MySQL query. Return ONLY the SQL text, no markdown or explanations.\n\nQuery:`,
      mssql: `${header}\n\n${shared}\nGenerate a valid T-SQL query for SQL Server. Return ONLY the SQL text, no markdown or explanations.\n\nQuery:`,
      mongodb: `${header}\n\n${shared}\nGenerate a valid MongoDB query as a single JSON object: {collection, filter, projection, sort, limit}. Return ONLY the JSON, no markdown or explanations.\n\nQuery:`,
    }

    const dbKey = ['postgresql','mysql','mssql','mongodb'].includes(dbType) ? dbType : 'postgresql'
    const prompt = prompts[dbKey]

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    })

    let sql = response.choices[0].message.content?.trim() || ''

    // Remove markdown/code fences if present
    sql = sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim()

    // Validate/repair per dialect
    const needsRepair = () => {
      if (dbKey === 'mongodb') {
        try { JSON.parse(sql); return false } catch { return true }
      }
      const tooShort = sql.length < 20
      const hasFrom = /\bfrom\b/i.test(sql)
      return tooShort || !hasFrom
    }

    // STRICT column validation: ensure ALL columns exist in Handbook
    const extractSqlColumns = (q: string): Array<{table?: string, column: string}> => {
      const cols: Array<{table?: string, column: string}> = []
      // Match table.column or "table"."column" or [table].[column]
      const patterns = [
        /([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/g,
        /"([A-Za-z0-9_]+)"\."([A-Za-z0-9_]+)"/g,
        /\[([A-Za-z0-9_]+)\]\.\[([A-Za-z0-9_]+)\]/g,
      ]
      for (const re of patterns) {
        let m
        while ((m = re.exec(q)) !== null) {
          cols.push({table: m[1], column: m[2]})
        }
      }
      return cols
    }

    let invalidColumns: string[] = []
    if (dbKey !== 'mongodb' && hb) {
      const usedCols = extractSqlColumns(sql)
      for (const {table, column} of usedCols) {
        if (table && hb[table] && hb[table].columns) {
          if (!hb[table].columns[column]) {
            invalidColumns.push(`${table}.${column}`)
          }
        }
      }
    }

    // Basic SQL table validation: ensure FROM/JOIN tables exist in schema
    const extractSqlTables = (q: string): string[] => {
      const names = new Set<string>()
      const patterns = [
        /\bfrom\s+(["`\[]?)([A-Za-z0-9_]+)\1/gi,
        /\bjoin\s+(["`\[]?)([A-Za-z0-9_]+)\1/gi,
      ]
      for (const re of patterns) {
        let m
        while ((m = re.exec(q)) !== null) {
          names.add(m[2])
        }
      }
      return Array.from(names)
    }
    let invalidTables = [] as string[]
    if (dbKey !== 'mongodb') {
      const used = extractSqlTables(sql)
      invalidTables = used.filter(t => !schema[t])
    }

    if (needsRepair() || (invalidTables.length > 0) || (invalidColumns.length > 0)) {
      const issues = []
      if (invalidTables.length > 0) issues.push(`Invalid tables: ${invalidTables.join(', ')}`)
      if (invalidColumns.length > 0) issues.push(`Invalid columns (DO NOT USE): ${invalidColumns.join(', ')}`)
      const issueText = issues.length > 0 ? `\n\nISSUES FOUND:\n${issues.join('\n')}` : ''
      
      const repairPrompt = `You produced an incomplete or invalid ${dbKey.toUpperCase()} query. Regenerate a SINGLE, COMPLETE query that strictly follows these rules and answers the user's question.${issueText}

${shared}

Rules:
- Output ONLY the query text (or a single JSON object for MongoDB)
- Include a proper FROM clause (SQL) or valid JSON with collection+filter (MongoDB)
- Use correct dialect for ${dbKey}
- Keep it efficient with ORDER BY and LIMIT/TOP when applicable
- Use ONLY tables and columns listed in VALID TABLES AND COLUMNS above
- DO NOT use any columns marked as invalid

Fixed Output:`

      const fix = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: repairPrompt }],
        temperature: 0.2,
        max_tokens: 400,
      })
      sql = (fix.choices[0].message.content || '').replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim()
    }

    // Final guard: synthesize a minimal baseline if still invalid
    if (needsRepair()) {
      const fallbackTable = relevantTableNames[0]
      const table = schema[fallbackTable]
      if (dbKey === 'mongodb') {
        sql = JSON.stringify({ collection: fallbackTable, filter: {}, limit: 50 })
      } else if (table && table.columns && table.columns.length > 0) {
        const col = table.columns[0].column_name
        if (dbKey === 'mssql') {
          sql = `SELECT TOP 50 [${col}] FROM [${fallbackTable}]`
        } else if (dbKey === 'mysql') {
          sql = `SELECT \`${col}\` FROM \`${fallbackTable}\` LIMIT 50`
        } else { // postgresql default
          sql = `SELECT "${col}" FROM "${fallbackTable}" LIMIT 50`
        }
      } else {
        sql = dbKey === 'mssql' ? 'SELECT TOP 50 1' : 'SELECT 1 LIMIT 50'
      }
    }

    return sql
  }

  static async answerQuestion(
    naturalLanguageQuery: string,
    queryResults: any[],
    schema: any
  ): Promise<string> {
    const cacheKey = `answer:${createHash('md5').update(naturalLanguageQuery + JSON.stringify(queryResults)).digest('hex')}`
    
    if (redis) {
      try {
        const cached = await redis.get(cacheKey)
        if (cached) return cached
      } catch (error) {
        console.log('Cache unavailable')
      }
    }

    const prompt = `You are a helpful data analyst having a conversation with someone about their database. Be natural, insightful, and conversational.

User Question: ${naturalLanguageQuery}

Query Results:
${JSON.stringify(queryResults, null, 2)}

Provide a natural, conversational answer that:
1. Directly answers their question in plain language
2. Highlights interesting patterns or insights
3. Makes connections between different data points
4. Suggests follow-up questions they might want to ask

Be creative and helpful, not robotic. Talk like a human analyst would.

Answer:`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 1000,
    })

    const answer = response.choices[0].message.content || ''
    
    if (redis) {
      try {
        await redis.setex(cacheKey, 3600, answer)
      } catch (error) {
        console.log('Cache unavailable')
      }
    }

    return answer
  }

  static async processNaturalLanguageQuery(
    query: string,
    botId: string,
    schema: any,
    vectorData: any[],
    dbType: string,
    dbContext?: string,
    dbIntelligence?: string,
    handbook?: any
  ): Promise<{ sql: string; answer: string; relevantTables: string[] }> {
    const cacheKey = `query:${botId}:${createHash('md5').update(query).digest('hex')}`
    
    if (redis) {
      try {
        const cached = await redis.get(cacheKey)
        if (cached) return JSON.parse(cached)
      } catch (error) {
        console.log('Cache unavailable')
      }
    }

    const queryEmbedding = await this.generateEmbedding(query)
    const relevantColumns = this.findRelevantColumns(queryEmbedding, vectorData, 15)
    
    const relevantTables = [...new Set(relevantColumns.map(col => col.table))]
    
    const sqlQuery = await this.generateSQLQuery(query, schema, relevantColumns, dbType, dbContext, dbIntelligence, handbook)
    
    const result = {
      sql: sqlQuery,
      answer: '',
      relevantTables,
    }

    if (redis) {
      try {
        await redis.setex(cacheKey, 300, JSON.stringify(result))
      } catch (error) {
        console.log('Cache unavailable')
      }
    }

    return result
  }

  static async analyzeDatabase(schema: any, tableAnalysis: any): Promise<string> {
    // Create a CONCISE summary focusing on key tables only
    const tables = Object.keys(schema)
    const tablesSummary = tables.slice(0, 20).map(tableName => { // Limit to 20 tables
      const table = schema[tableName]
      const analysis = tableAnalysis[tableName]
      
      // Get top 3 columns only
      const keyColumns = table.columns.slice(0, 3).map((col: any) => {
        return `${col.column_name}:${col.data_type}`
      }).join(', ')
      
      return `${tableName}(${keyColumns})`
    }).join(' | ')

    const prompt = `Analyze this database for SQL query generation.

Tables: ${tablesSummary}
Total: ${tables.length} tables

Provide analysis in this format:

PURPOSE: [What this database stores]

RELATIONSHIPS: [How tables connect - look for id/session_id/user_id columns]

QUERY PATTERNS:
- For "what do people talk about": [exact SQL pattern with table.column names]
- For "user activity": [exact SQL pattern]
- For "trends": [exact SQL pattern]

Be EXTREMELY specific with actual table and column names from the schema above.

Analysis:`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 1500,
    })

    return response.choices[0].message.content || 'Unable to analyze database'
  }
}
