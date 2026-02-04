import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import { DatabaseConnector } from '@/lib/db-connectors'
import { AIService } from '@/lib/ai-service'
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

    const schema = await DatabaseConnector.getSchema(bot.dbType, bot.dbConfig)

    const vectorData: any[] = []
    const tableNames = Object.keys(schema)
    
    // SMART ANALYSIS: Sample actual data from each table to understand what's stored
    console.log('🧠 Analyzing database content...')
    const tableAnalysis: any = {}
    
    for (const tableName of tableNames) {
      const table = schema[tableName]
      
      // Get sample data to understand what's actually in the table
      const sampleData = table.sampleData || []
      const rowCount = sampleData.length
      
      // Analyze what kind of data is in each column
      const columnInsights: any = {}
      for (const column of table.columns) {
        const colName = column.column_name
        const sampleValues = sampleData.slice(0, 5).map((row: any) => row[colName]).filter((v: any) => v != null)
        
        columnInsights[colName] = {
          type: column.data_type,
          hasSampleData: sampleValues.length > 0,
          sampleValues: sampleValues.slice(0, 3), // First 3 non-null values
        }
      }
      
      tableAnalysis[tableName] = {
        rowCount,
        columns: columnInsights,
      }
    }
    
    // Generate descriptions WITHOUT sample data in embeddings (too large)
    const allTexts: Array<{ text: string; table: string; column: string; type: string }> = []
    
    for (const tableName of tableNames) {
      const table = schema[tableName]
      
      for (const column of table.columns) {
        const colName = column.column_name
        
        // Simple description for embeddings
        const description = `Table: ${tableName}, Column: ${colName}, Type: ${column.data_type}`
        
        allTexts.push({
          text: description,
          table: tableName,
          column: colName,
          type: column.data_type,
        })
      }
    }

    // Generate embeddings in batches of 100 for speed
    const batchSize = 100
    for (let i = 0; i < allTexts.length; i += batchSize) {
      const batch = allTexts.slice(i, i + batchSize)
      const embeddings = await AIService.generateBatchEmbeddings(batch.map(t => t.text))
      
      batch.forEach((item, idx) => {
        vectorData.push({
          table: item.table,
          column: item.column,
          type: item.type,
          embedding: embeddings[idx],
        })
      })
    }

    // Discover FK/PK relationships for accurate joins
    console.log('🔗 Discovering foreign key relationships...')
    const relationships = await DatabaseConnector.discoverRelationships(bot.dbType, bot.dbConfig)
    const fkMap = (relationships.foreignKeys || []).map((fk: any) => 
      `${fk.source_table}.${fk.source_column} → ${fk.target_table}.${fk.target_column}`
    ).join('\n')

    // Generate AI summary of what's in the database
    console.log('🤖 Generating database intelligence summary...')
    const dbIntelligence = await AIService.analyzeDatabase(schema, tableAnalysis)
    const dbHandbook = await AIService.generateHandbook(schema)

    // CRITICAL: Validate and log Handbook generation
    console.log('📖 HANDBOOK GENERATION COMPLETE:')
    console.log('  - Handbook exists:', !!dbHandbook)
    console.log('  - Has tables:', !!dbHandbook?.tables)
    if (dbHandbook && dbHandbook.tables) {
      const tableNames = Object.keys(dbHandbook.tables)
      console.log(`  - Total tables: ${tableNames.length}`)
      let totalCols = 0
      for (const [tName, tInfo] of Object.entries<any>(dbHandbook.tables)) {
        const colCount = tInfo.columns ? Object.keys(tInfo.columns).length : 0
        totalCols += colCount
        console.log(`    • ${tName}: ${colCount} columns, desc: "${(tInfo.description || '').slice(0, 60)}..."`)
      }
      console.log(`  - Total columns with descriptions: ${totalCols}`)
    } else {
      console.error('❌ HANDBOOK GENERATION FAILED - No tables found!')
    }

    // Build a concise SCHEMA CATALOG to act as an index for the model
    const makeValuePreview = (v: any) => {
      if (v == null) return 'null'
      const s = typeof v === 'string' ? v : JSON.stringify(v)
      return s.length > 60 ? s.slice(0, 57) + '...' : s
    }
    const catalogLines: string[] = []
    for (const tableName of tableNames) {
      const t = schema[tableName]
      const row0 = Array.isArray(t.sampleData) && t.sampleData.length > 0 ? t.sampleData[0] : null
      const cols = (t.columns || []).map((c: any) => {
        const val = row0 ? makeValuePreview(row0[c.column_name]) : undefined
        return `${c.column_name}(${c.data_type}${c.is_nullable === 'NO' ? ',notnull' : ''}${val !== undefined ? `,e.g.${val}` : ''})`
      }).join(', ')
      catalogLines.push(`${tableName}: ${cols}`)
    }
    const schemaCatalog = `SCHEMA CATALOG:\n${catalogLines.join('\n')}`
    const fkSection = fkMap ? `\n\nFOREIGN KEY RELATIONSHIPS:\n${fkMap}` : ''

    // Create lightweight schema (metadata only, no row data)
    const lightweightSchema: any = {}
    for (const tableName of tableNames) {
      lightweightSchema[tableName] = {
        columns: schema[tableName].columns,
        sampleData: [] // Don't store actual rows - too large for JSON
      }
    }

    await dbService.updateBot(bot.id, { 
      schema: lightweightSchema, // Only save column metadata, not rows
      vectorData,
      dbIntelligence: `${dbIntelligence}\n\n${schemaCatalog}${fkSection}`,
      dbHandbook, // Persist structured handbook for primary use in prompts
    })

    return NextResponse.json({
      success: true,
      tablesScanned: tableNames.length,
      columnsVectorized: vectorData.length,
    })
  } catch (error) {
    console.error('Schema scan error:', error)
    return NextResponse.json(
      { error: 'Scan failed', details: (error as Error).message },
      { status: 500 }
    )
  }
}
