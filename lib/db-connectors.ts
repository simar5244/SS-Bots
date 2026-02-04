import { Client as PgClient } from 'pg'
import mysql from 'mysql2/promise'
import sql from 'mssql'
import { Client as SSHClient } from 'ssh2'
import { MongoClient } from 'mongodb'
import oracledb from 'oracledb'
import spauth from 'node-sp-auth'
import sprequest from 'sp-request'

export interface DBConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  useSSH?: boolean
  sshConfig?: {
    host: string
    port: number
    username: string
    privateKey?: string
    password?: string
  }
  // Oracle specific
  serviceName?: string
  sid?: string
  // SharePoint specific
  siteUrl?: string
  listName?: string
  domain?: string
}

export class DatabaseConnector {
  static async testConnection(dbType: string, config: DBConfig): Promise<boolean> {
    try {
      switch (dbType) {
        case 'postgresql':
          return await this.testPostgreSQL(config)
        case 'mysql':
          return await this.testMySQL(config)
        case 'mssql':
          return await this.testMSSQL(config)
        case 'mongodb':
          return await this.testMongoDB(config)
        case 'oracle':
          return await this.testOracle(config)
        case 'sharepoint':
          return await this.testSharePoint(config)
        default:
          throw new Error(`Unsupported database type: ${dbType}`)
      }
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }

  private static async testPostgreSQL(config: DBConfig): Promise<boolean> {
    if (config.useSSH && config.sshConfig) {
      return await this.testPostgreSQLWithSSH(config)
    }

    const client = new PgClient({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
    })

    await client.connect()
    await client.query('SELECT 1')
    await client.end()
    return true
  }

  private static async testPostgreSQLWithSSH(config: DBConfig): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const sshClient = new SSHClient()
      const net = require('net')
      let server: any = null
      let connectionTimeout: NodeJS.Timeout

      connectionTimeout = setTimeout(() => {
        if (server) server.close()
        sshClient.end()
        reject(new Error('SSH connection timeout after 30 seconds'))
      }, 30000)

      sshClient.on('ready', () => {
        console.log('SSH connection established')
        
        // Create a local server that forwards to remote
        server = net.createServer((sock: any) => {
          sshClient.forwardOut(
            sock.remoteAddress!,
            sock.remotePort!,
            config.host,
            config.port,
            (err: Error | undefined, stream: any) => {
              if (err) {
                sock.end()
                return
              }
              sock.pipe(stream).pipe(sock)
            }
          )
        }).listen(0, 'localhost', async () => {
          const localPort = server.address().port
          console.log(`SSH tunnel created on localhost:${localPort}`)

          const pgClient = new PgClient({
            host: 'localhost',
            port: localPort,
            database: config.database,
            user: config.username,
            password: config.password,
          })

          try {
            await pgClient.connect()
            console.log('PostgreSQL connected')
            await pgClient.query('SELECT 1')
            await pgClient.end()
            clearTimeout(connectionTimeout)
            server.close()
            sshClient.end()
            resolve(true)
          } catch (error) {
            clearTimeout(connectionTimeout)
            await pgClient.end().catch(() => {})
            server.close()
            sshClient.end()
            reject(new Error(`PostgreSQL connection failed: ${(error as Error).message}`))
          }
        })
      })

      sshClient.on('error', (err: Error) => {
        clearTimeout(connectionTimeout)
        if (server) server.close()
        reject(new Error(`SSH connection failed: ${err.message}`))
      })

      const sshConfig: any = {
        host: config.sshConfig!.host,
        port: config.sshConfig!.port,
        username: config.sshConfig!.username,
        readyTimeout: 30000,
      }

      if (config.sshConfig!.password) {
        sshConfig.password = config.sshConfig!.password
      }

      if (config.sshConfig!.privateKey) {
        sshConfig.privateKey = config.sshConfig!.privateKey
      }

      console.log(`Attempting SSH connection to ${sshConfig.host}:${sshConfig.port} as ${sshConfig.username}`)
      sshClient.connect(sshConfig)
    })
  }

  private static async testMySQL(config: DBConfig): Promise<boolean> {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
    })

    await connection.query('SELECT 1')
    await connection.end()
    return true
  }

  private static async testMSSQL(config: DBConfig): Promise<boolean> {
    await sql.connect({
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
    })

    await sql.query('SELECT 1')
    await sql.close()
    return true
  }

  private static async testMongoDB(config: DBConfig): Promise<boolean> {
    const uri = `mongodb://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`
    const client = new MongoClient(uri)
    
    await client.connect()
    await client.db().admin().ping()
    await client.close()
    return true
  }

  private static async testOracle(config: DBConfig): Promise<boolean> {
    const connectionString = config.serviceName 
      ? `${config.host}:${config.port}/${config.serviceName}`
      : `${config.host}:${config.port}/${config.sid || config.database}`
    
    const connection = await oracledb.getConnection({
      user: config.username,
      password: config.password,
      connectString: connectionString,
    })

    await connection.execute('SELECT 1 FROM DUAL')
    await connection.close()
    return true
  }

  private static async testSharePoint(config: DBConfig): Promise<boolean> {
    if (!config.siteUrl || !config.listName) {
      throw new Error('SharePoint requires siteUrl and listName')
    }

    const authOptions: any = {
      username: config.username,
      password: config.password,
    }

    if (config.domain) {
      authOptions.domain = config.domain
    }

    const auth = await spauth.getAuth(config.siteUrl, authOptions)
    const spr = sprequest.create(auth)
    
    // Test by getting list items
    const response = await spr.get(`${config.siteUrl}/_api/web/lists/getbytitle('${config.listName}')/items?$top=1`)
    
    return response.statusCode === 200
  }

  static async getSchema(dbType: string, config: DBConfig): Promise<any> {
    switch (dbType) {
      case 'postgresql':
        return await this.getPostgreSQLSchema(config)
      case 'mysql':
        return await this.getMySQLSchema(config)
      case 'mssql':
        return await this.getMSSQLSchema(config)
      case 'mongodb':
        return await this.getMongoDBSchema(config)
      case 'oracle':
        return await this.getOracleSchema(config)
      case 'sharepoint':
        return await this.getSharePointSchema(config)
      default:
        throw new Error(`Unsupported database type: ${dbType}`)
    }
  }

  private static async getPostgreSQLSchema(config: DBConfig): Promise<any> {
    if (config.useSSH && config.sshConfig) {
      return await this.getPostgreSQLSchemaWithSSH(config)
    }

    const client = new PgClient({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
    })

    await client.connect()

    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `
    const tablesResult = await client.query(tablesQuery)
    const tables: any = {}

    for (const row of tablesResult.rows) {
      const tableName = row.table_name
      const columnsQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `
      const columnsResult = await client.query(columnsQuery, [tableName])
      
      tables[tableName] = {
        columns: columnsResult.rows,
        sampleData: await this.getSampleData(client, tableName, 'postgresql'),
      }
    }

    await client.end()
    return tables
  }

  private static async getPostgreSQLSchemaWithSSH(config: DBConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      const sshClient = new SSHClient()
      const net = require('net')
      let server: any = null

      sshClient.on('ready', () => {
        server = net.createServer((sock: any) => {
          sshClient.forwardOut(
            sock.remoteAddress!,
            sock.remotePort!,
            config.host,
            config.port,
            (err: Error | undefined, stream: any) => {
              if (err) {
                sock.end()
                return
              }
              sock.pipe(stream).pipe(sock)
            }
          )
        }).listen(0, 'localhost', async () => {
          const localPort = server.address().port

          const client = new PgClient({
            host: 'localhost',
            port: localPort,
            database: config.database,
            user: config.username,
            password: config.password,
          })

          try {
            await client.connect()

            const tablesQuery = `
              SELECT table_name 
              FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            `
            const tablesResult = await client.query(tablesQuery)
            const tables: any = {}

            for (const row of tablesResult.rows) {
              const tableName = row.table_name
              const columnsQuery = `
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position
              `
              const columnsResult = await client.query(columnsQuery, [tableName])
              
              tables[tableName] = {
                columns: columnsResult.rows,
                sampleData: await this.getSampleData(client, tableName, 'postgresql'),
              }
            }

            await client.end()
            server.close()
            sshClient.end()
            resolve(tables)
          } catch (error) {
            await client.end().catch(() => {})
            server.close()
            sshClient.end()
            reject(error)
          }
        })
      })

      sshClient.on('error', (err: any) => {
        if (server) server.close()
        reject(new Error(`SSH connection failed: ${err.message}`))
      })

      const sshConfig: any = {
        host: config.sshConfig!.host,
        port: config.sshConfig!.port,
        username: config.sshConfig!.username,
        readyTimeout: 30000,
      }

      if (config.sshConfig!.password) {
        sshConfig.password = config.sshConfig!.password
      }

      if (config.sshConfig!.privateKey) {
        sshConfig.privateKey = config.sshConfig!.privateKey
      }

      sshClient.connect(sshConfig)
    })
  }

  private static async getMySQLSchema(config: DBConfig): Promise<any> {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
    })

    const [tables] = await connection.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
      [config.database]
    )

    const schema: any = {}

    for (const table of tables as any[]) {
      const tableName = table.table_name || table.TABLE_NAME
      const [columns] = await connection.query(
        'SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = ? AND table_schema = ?',
        [tableName, config.database]
      )

      schema[tableName] = {
        columns,
        sampleData: await this.getSampleDataMySQL(connection, tableName),
      }
    }

    await connection.end()
    return schema
  }

  private static async getMSSQLSchema(config: DBConfig): Promise<any> {
    await sql.connect({
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
    })

    const tablesResult = await sql.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `)

    const schema: any = {}

    for (const row of tablesResult.recordset) {
      const tableName = row.TABLE_NAME
      const columnsResult = await sql.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${tableName}'
      `)

      schema[tableName] = {
        columns: columnsResult.recordset,
        sampleData: await this.getSampleDataMSSQL(tableName),
      }
    }

    await sql.close()
    return schema
  }

  private static async getSampleData(client: any, tableName: string, dbType: string): Promise<any[]> {
    try {
      const result = await client.query(`SELECT * FROM "${tableName}"`)
      return result.rows
    } catch (error) {
      return []
    }
  }

  private static async getSampleDataMySQL(connection: any, tableName: string): Promise<any[]> {
    try {
      const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``)
      return rows as any[]
    } catch (error) {
      return []
    }
  }

  private static async getSampleDataMSSQL(tableName: string): Promise<any[]> {
    try {
      const result = await sql.query(`SELECT * FROM [${tableName}]`)
      return result.recordset
    } catch (error) {
      return []
    }
  }

  private static async getMongoDBSchema(config: DBConfig): Promise<any> {
    const uri = `mongodb://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`
    const client = new MongoClient(uri)
    
    await client.connect()
    const db = client.db(config.database)
    const collections = await db.listCollections().toArray()
    
    const schema: any = {}
    
    for (const collection of collections) {
      const collectionName = collection.name
      const sampleDocs = await db.collection(collectionName).find().limit(5).toArray()
      
      const fields = new Set<string>()
      sampleDocs.forEach(doc => {
        Object.keys(doc).forEach(key => fields.add(key))
      })
      
      schema[collectionName] = {
        columns: Array.from(fields).map(field => ({
          column_name: field,
          data_type: 'mixed',
          is_nullable: 'YES'
        })),
        sampleData: sampleDocs
      }
    }
    
    await client.close()
    return schema
  }

  private static async getOracleSchema(config: DBConfig): Promise<any> {
    const connectionString = config.serviceName 
      ? `${config.host}:${config.port}/${config.serviceName}`
      : `${config.host}:${config.port}/${config.sid || config.database}`
    
    const connection = await oracledb.getConnection({
      user: config.username,
      password: config.password,
      connectString: connectionString,
    })

    // Get all tables
    const tablesResult = await connection.execute(
      `SELECT table_name FROM user_tables ORDER BY table_name`
    )

    const schema: any = {}

    for (const row of (tablesResult.rows || []) as any[]) {
      const tableName = row[0]
      
      // Get columns for this table
      const columnsResult = await connection.execute(
        `SELECT column_name, data_type, nullable 
         FROM user_tab_columns 
         WHERE table_name = :tableName 
         ORDER BY column_id`,
        [tableName]
      )

      const columns = (columnsResult.rows || []).map((col: any) => ({
        column_name: col[0],
        data_type: col[1],
        is_nullable: col[2]
      }))

      // Get sample data
      const sampleResult = await connection.execute(
        `SELECT * FROM "${tableName}"`
      )

      const sampleData = (sampleResult.rows || []).map((row: any) => {
        const obj: any = {}
        columns.forEach((col: any, idx: number) => {
          obj[col.column_name] = row[idx]
        })
        return obj
      })

      schema[tableName] = {
        columns,
        sampleData
      }
    }

    await connection.close()
    return schema
  }

  private static async getSharePointSchema(config: DBConfig): Promise<any> {
    if (!config.siteUrl || !config.listName) {
      throw new Error('SharePoint requires siteUrl and listName')
    }

    const authOptions: any = {
      username: config.username,
      password: config.password,
    }

    if (config.domain) {
      authOptions.domain = config.domain
    }

    const auth = await spauth.getAuth(config.siteUrl, authOptions)
    const spr = sprequest.create(auth)
    
    // Get list fields
    const fieldsResponse = await spr.get(
      `${config.siteUrl}/_api/web/lists/getbytitle('${config.listName}')/fields?$filter=Hidden eq false`
    )
    
    const fields = fieldsResponse.body.d.results
    const columns = fields.map((field: any) => ({
      column_name: field.InternalName,
      data_type: field.TypeAsString,
      is_nullable: !field.Required ? 'YES' : 'NO'
    }))

    // Get sample items
    const itemsResponse = await spr.get(
      `${config.siteUrl}/_api/web/lists/getbytitle('${config.listName}')/items`
    )
    
    const sampleData = itemsResponse.body.d.results

    const schema: any = {}
    schema[config.listName] = {
      columns,
      sampleData
    }

    return schema
  }

  static async executeQuery(dbType: string, config: DBConfig, query: string): Promise<any> {
    switch (dbType) {
      case 'postgresql':
        return await this.executePostgreSQLQuery(config, query)
      case 'mysql':
        return await this.executeMySQLQuery(config, query)
      case 'mssql':
        return await this.executeMSSQLQuery(config, query)
      case 'mongodb':
        return await this.executeMongoDBQuery(config, query)
      case 'oracle':
        return await this.executeOracleQuery(config, query)
      case 'sharepoint':
        return await this.executeSharePointQuery(config, query)
      default:
        throw new Error(`Unsupported database type: ${dbType}`)
    }
  }

  static async discoverRelationships(dbType: string, config: DBConfig): Promise<any> {
    try {
      if (dbType === 'postgresql') {
        const fkQuery = `
          SELECT
            tc.table_name AS source_table,
            kcu.column_name AS source_column,
            ccu.table_name AS target_table,
            ccu.column_name AS target_column
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
        `
        const fks = await this.executePostgreSQLQuery(config, fkQuery)
        return { foreignKeys: fks || [] }
      } else if (dbType === 'mysql') {
        const dbName = config.database
        const fkQuery = `
          SELECT
            TABLE_NAME AS source_table,
            COLUMN_NAME AS source_column,
            REFERENCED_TABLE_NAME AS target_table,
            REFERENCED_COLUMN_NAME AS target_column
          FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = '${dbName}'
            AND REFERENCED_TABLE_NAME IS NOT NULL
        `
        const fks = await this.executeMySQLQuery(config, fkQuery)
        return { foreignKeys: fks || [] }
      } else if (dbType === 'mssql') {
        const fkQuery = `
          SELECT
            OBJECT_NAME(fk.parent_object_id) AS source_table,
            COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS source_column,
            OBJECT_NAME(fk.referenced_object_id) AS target_table,
            COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS target_column
          FROM sys.foreign_keys AS fk
          INNER JOIN sys.foreign_key_columns AS fkc
            ON fk.object_id = fkc.constraint_object_id
        `
        const fks = await this.executeMSSQLQuery(config, fkQuery)
        return { foreignKeys: fks || [] }
      } else {
        return { foreignKeys: [] }
      }
    } catch (error) {
      console.error('FK discovery error:', error)
      return { foreignKeys: [] }
    }
  }

  private static async executePostgreSQLQuery(config: DBConfig, query: string): Promise<any> {
    if (config.useSSH && config.sshConfig) {
      return await this.executePostgreSQLQueryWithSSH(config, query)
    }

    const client = new PgClient({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
    })

    await client.connect()
    const result = await client.query(query)
    await client.end()
    return result.rows
  }

  private static async executePostgreSQLQueryWithSSH(config: DBConfig, query: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const sshClient = new SSHClient()
      const net = require('net')
      let server: any = null

      sshClient.on('ready', () => {
        server = net.createServer((sock: any) => {
          sshClient.forwardOut(
            sock.remoteAddress!,
            sock.remotePort!,
            config.host,
            config.port,
            (err: Error | undefined, stream: any) => {
              if (err) {
                sock.end()
                return
              }
              sock.pipe(stream).pipe(sock)
            }
          )
        }).listen(0, 'localhost', async () => {
          const localPort = server.address().port

          const client = new PgClient({
            host: 'localhost',
            port: localPort,
            database: config.database,
            user: config.username,
            password: config.password,
          })

          try {
            await client.connect()
            const result = await client.query(query)
            await client.end()
            server.close()
            sshClient.end()
            resolve(result.rows)
          } catch (error) {
            await client.end().catch(() => {})
            server.close()
            sshClient.end()
            reject(error)
          }
        })
      })

      sshClient.on('error', (err: Error) => {
        if (server) server.close()
        reject(new Error(`SSH connection failed: ${err.message}`))
      })

      const sshConfig: any = {
        host: config.sshConfig!.host,
        port: config.sshConfig!.port,
        username: config.sshConfig!.username,
        readyTimeout: 30000,
      }

      if (config.sshConfig!.password) {
        sshConfig.password = config.sshConfig!.password
      }

      if (config.sshConfig!.privateKey) {
        sshConfig.privateKey = config.sshConfig!.privateKey
      }

      sshClient.connect(sshConfig)
    })
  }

  private static async executeMySQLQuery(config: DBConfig, query: string): Promise<any> {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
    })

    const [rows] = await connection.query(query)
    await connection.end()
    return rows
  }

  private static async executeMSSQLQuery(config: DBConfig, query: string): Promise<any> {
    await sql.connect({
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
    })

    const result = await sql.query(query)
    await sql.close()
    return result.recordset
  }

  private static async executeMongoDBQuery(config: DBConfig, query: string): Promise<any> {
    const uri = `mongodb://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`
    const client = new MongoClient(uri)
    
    await client.connect()
    const db = client.db(config.database)
    
    // Parse the query as JSON (expecting MongoDB query format)
    try {
      const queryObj = JSON.parse(query)
      const collection = db.collection(queryObj.collection)
      const results = await collection.find(queryObj.filter || {}).limit(queryObj.limit || 100).toArray()
      await client.close()
      return results
    } catch (error) {
      await client.close()
      throw new Error('Invalid MongoDB query format. Expected JSON with collection and filter fields.')
    }
  }

  private static async executeOracleQuery(config: DBConfig, query: string): Promise<any> {
    const connectionString = config.serviceName 
      ? `${config.host}:${config.port}/${config.serviceName}`
      : `${config.host}:${config.port}/${config.sid || config.database}`
    
    const connection = await oracledb.getConnection({
      user: config.username,
      password: config.password,
      connectString: connectionString,
    })

    const result = await connection.execute(query, [], { outFormat: oracledb.OUT_FORMAT_OBJECT })
    await connection.close()
    
    return result.rows || []
  }

  private static async executeSharePointQuery(config: DBConfig, query: string): Promise<any> {
    if (!config.siteUrl || !config.listName) {
      throw new Error('SharePoint requires siteUrl and listName')
    }

    const authOptions: any = {
      username: config.username,
      password: config.password,
    }

    if (config.domain) {
      authOptions.domain = config.domain
    }

    const auth = await spauth.getAuth(config.siteUrl, authOptions)
    const spr = sprequest.create(auth)
    
    // Parse query as OData filter
    // Expected format: { filter: "...", select: "...", top: 100 }
    let queryParams = ''
    try {
      const queryObj = JSON.parse(query)
      const params: string[] = []
      
      if (queryObj.filter) params.push(`$filter=${queryObj.filter}`)
      if (queryObj.select) params.push(`$select=${queryObj.select}`)
      if (queryObj.top) params.push(`$top=${queryObj.top}`)
      else params.push('$top=100')
      
      queryParams = params.length > 0 ? '?' + params.join('&') : '?$top=100'
    } catch {
      // If not JSON, treat as raw OData query string
      queryParams = query.startsWith('?') ? query : `?${query}`
    }
    
    const response = await spr.get(
      `${config.siteUrl}/_api/web/lists/getbytitle('${config.listName}')/items${queryParams}`
    )
    
    return response.body.d.results
  }
}
