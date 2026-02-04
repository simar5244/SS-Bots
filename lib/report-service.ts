import { DatabaseConnector, DBConfig } from './db-connectors'
import { Logger, LogLevel, ServiceType } from './logger'
import { ChartConfig } from './chart-service'

export interface ReportConfig {
  title: string
  description: string
  dataRequest: string // Natural language description of what data is needed
  tone: 'professional' | 'casual' | 'technical' | 'executive'
  wordLimit: number
  stakeholders: string[]
  sections: string[]
  includeCharts: boolean
  includeRawData: boolean
}

export interface ReportSchedule {
  frequency: 'once' | 'daily' | 'weekly' | 'monthly'
  dayOfWeek?: number // 0-6 for weekly
  dayOfMonth?: number // 1-31 for monthly
  time: string // HH:MM format
  recipients: string[]
}

export class ReportService {
  /**
   * Generate a data report using AI analysis
   * This uses the AI service to extract data, then generates a report
   */
  static async generateReport(
    config: ReportConfig,
    botId: string,
    chatApiUrl: string, // URL to the chat API endpoint
    authToken: string, // Auth token to pass to chat API
    chartServiceModule?: any // Pass ChartService for chart generation
  ): Promise<{ report: string; sql: string; data: any[]; answer: string; charts?: ChartConfig[] }> {
    const startTime = Logger.startTimer()
    Logger.log(LogLevel.INFO, ServiceType.REPORT_AI, 'START_REPORT_GENERATION', {
      title: config.title,
      dataRequest: config.dataRequest,
      includeCharts: config.includeCharts
    })

    // Step 1: Call the chat API directly with the data request
    Logger.logHandoff(ServiceType.REPORT_AI, ServiceType.CHAT_AI, 'REQUEST_DATA_VIA_CHAT_API', {
      dataRequest: config.dataRequest,
      chatApiUrl
    })
    
    let sql = ''
    let data: any[] = []
    let answer = ''
    
    try {
      const queryStart = Logger.startTimer()
      
      // Call the existing chat API with auth token
      const response = await fetch(chatApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ 
          query: config.dataRequest 
        })
      })

      if (!response.ok) {
        throw new Error(`Chat API returned ${response.status}`)
      }

      const chatResult = await response.json()
      
      sql = chatResult.metadata?.sql || ''
      data = chatResult.metadata?.queryResults || []
      answer = chatResult.answer || ''
      
      Logger.endTimer(queryStart, LogLevel.SUCCESS, ServiceType.CHAT_AI, 'CHAT_API_RESPONSE_RECEIVED', { 
        sql,
        dataRows: data.length,
        hasAnswer: !!answer
      })
      
      Logger.logHandoff(ServiceType.CHAT_AI, ServiceType.REPORT_AI, 'DATA_EXTRACTED_FROM_CHAT', {
        rows: data.length,
        columns: Object.keys(data[0] || {}).length
      })
    } catch (error) {
      Logger.log(LogLevel.ERROR, ServiceType.REPORT_AI, 'CHAT_API_CALL_FAILED', {
        error: (error as Error).message
      })
      throw new Error(`Failed to get data from chat API: ${(error as Error).message}`)
    }

    // If no structured data but we have an answer (e.g., NUCLEAR method), use the answer as the data source
    if ((!data || data.length === 0) && !answer) {
      Logger.log(LogLevel.WARNING, ServiceType.REPORT_AI, 'NO_DATA_OR_ANSWER', {})
      throw new Error('No data or answer found for the specified request')
    }
    
    if (!data || data.length === 0) {
      Logger.log(LogLevel.INFO, ServiceType.REPORT_AI, 'USING_ANSWER_AS_DATA_SOURCE', {
        method: sql === 'NUCLEAR_FAILSAFE_ANALYSIS_ONLY' ? 'NUCLEAR' : 'UNKNOWN'
      })
      // Create a synthetic data entry with the answer for report generation
      data = [{ analysis: answer }]
    }

    // Step 2: Prepare data summary for AI
    const dataSummary = this.prepareDataSummary(data)
    
    // Step 3: Generate charts if requested
    let charts: ChartConfig[] | undefined
    if (config.includeCharts && chartServiceModule) {
      Logger.logHandoff(ServiceType.REPORT_AI, ServiceType.CHART_AI, 'REQUEST_CHART_GENERATION', {
        dataRows: data.length,
        dataRequest: config.dataRequest
      })
      
      try {
        const chartStart = Logger.startTimer()
        charts = await chartServiceModule.generateCharts({
          query: config.dataRequest,
          data,
          context: answer, // Use the chat answer as context
          sqlQuery: sql
        })
        Logger.endTimer(chartStart, LogLevel.SUCCESS, ServiceType.CHART_AI, 'CHARTS_GENERATED', {
          chartCount: charts?.length || 0,
          types: charts?.map((c: ChartConfig) => c.type) || []
        })
        
        Logger.logHandoff(ServiceType.CHART_AI, ServiceType.REPORT_AI, 'CHARTS_READY', {
          chartCount: charts?.length || 0
        })
      } catch (chartError) {
        Logger.log(LogLevel.WARNING, ServiceType.CHART_AI, 'CHART_GENERATION_FAILED', {
          error: (chartError as Error).message
        })
        // Continue without charts
      }
    }

    // Step 4: Generate report using OpenAI (separate from chat service)
    Logger.log(LogLevel.INFO, ServiceType.REPORT_AI, 'GENERATE_REPORT_TEXT', {
      wordLimit: config.wordLimit,
      tone: config.tone
    })
    
    const openai = require('openai')
    const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY })

    const prompt = this.buildReportPrompt(config, dataSummary, answer, charts)

    const aiStart = Logger.startTimer()
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional data analyst and report writer. Generate comprehensive, well-structured reports based on database query results.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: Math.min(config.wordLimit * 2, 4000), // Rough token estimate,
    })
    Logger.endTimer(aiStart, LogLevel.SUCCESS, ServiceType.REPORT_AI, 'REPORT_TEXT_GENERATED', {
      wordCount: response.choices[0].message.content?.split(' ').length || 0
    })

    const reportText = response.choices[0].message.content || ''

    // Step 5: Format the report
    const formattedReport = this.formatReport(reportText, config, data, charts)
    
    Logger.endTimer(startTime, LogLevel.SUCCESS, ServiceType.REPORT_AI, 'REPORT_GENERATION_COMPLETE', {
      title: config.title,
      hasCharts: !!charts && charts.length > 0
    })
    
    return {
      report: formattedReport,
      sql,
      data,
      answer,
      charts
    }
  }

  private static prepareDataSummary(data: any[]): string {
    const rowCount = data.length
    const columns = Object.keys(data[0] || {})
    
    // Calculate basic statistics for numeric columns
    const stats: any = {}
    columns.forEach(col => {
      const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined)
      const numericValues = values.filter(v => typeof v === 'number' || !isNaN(Number(v)))
      
      if (numericValues.length > 0) {
        const nums = numericValues.map(v => Number(v))
        stats[col] = {
          min: Math.min(...nums),
          max: Math.max(...nums),
          avg: nums.reduce((a, b) => a + b, 0) / nums.length,
          count: nums.length
        }
      } else {
        // For non-numeric, show unique count
        const unique = new Set(values)
        stats[col] = {
          uniqueCount: unique.size,
          sampleValues: Array.from(unique).slice(0, 5)
        }
      }
    })

    return JSON.stringify({
      rowCount,
      columns,
      statistics: stats,
      sampleRows: data.slice(0, 10) // First 10 rows as sample
    }, null, 2)
  }

  private static buildReportPrompt(config: ReportConfig, dataSummary: string, context: string, charts?: ChartConfig[]): string {
    const toneInstructions = {
      professional: 'Use formal, business-appropriate language. Be objective and data-driven.',
      casual: 'Use conversational, easy-to-understand language. Make it engaging and accessible.',
      technical: 'Use precise technical terminology. Include detailed methodology and statistical analysis.',
      executive: 'Focus on high-level insights and actionable recommendations. Be concise and strategic.'
    }

    return `
# REPORT GENERATION TASK

## Report Details
- **Title**: ${config.title}
- **Description**: ${config.description}
- **Target Audience**: ${config.stakeholders.join(', ')}
- **Tone**: ${config.tone} - ${toneInstructions[config.tone]}
- **Word Limit**: Approximately ${config.wordLimit} words

## Database Context
${context}

## Query Results Summary
${dataSummary}

## Required Sections
${config.sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Instructions
1. Analyze the data thoroughly
2. Generate a comprehensive report following the required sections
3. Use the specified tone: ${config.tone}
4. Stay within ${config.wordLimit} words
5. Include specific data points and statistics
6. Provide actionable insights and recommendations
7. Format with clear headings and structure
${charts && charts.length > 0 ? `8. Reference the following visualizations that have been generated:\n${charts.map((c, i) => `   - Chart ${i + 1}: ${c.title} (${c.type})`).join('\n')}` : ''}

Generate the report now:
`
  }

  private static formatReport(reportText: string, config: ReportConfig, rawData: any[], charts?: ChartConfig[]): string {
    let formatted = `# ${config.title}\n\n`
    formatted += `**Generated**: ${new Date().toLocaleString()}\n\n`
    formatted += `---\n\n`
    formatted += reportText
    
    if (config.includeRawData) {
      formatted += `\n\n---\n\n## Appendix: Raw Data\n\n`
      formatted += `Total Records: ${rawData.length}\n\n`
      formatted += '```json\n'
      formatted += JSON.stringify(rawData.slice(0, 100), null, 2) // Limit to first 100 rows
      formatted += '\n```\n'
    }

    return formatted
  }

  /**
   * Convert markdown report to HTML for email
   */
  static markdownToHtml(markdown: string): string {
    // Simple markdown to HTML conversion
    let html = markdown
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/```[\s\S]+?```/g, (match) => `<pre><code>${match.replace(/```\w*\n?/g, '')}</code></pre>`)
      .replace(/\n\n/g, '</p><p>')

    // Wrap consecutive list items in ul tags
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => {
      if (!match.includes('<ul>')) {
        return `<ul>${match}</ul>`
      }
      return match
    })

    return `<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;"><p>${html}</p></body></html>`
  }

  /**
   * Generate a cron expression from schedule config
   */
  static generateCronExpression(schedule: ReportSchedule): string {
    const [hour, minute] = schedule.time.split(':').map(Number)

    switch (schedule.frequency) {
      case 'daily':
        return `${minute} ${hour} * * *`
      
      case 'weekly':
        const day = schedule.dayOfWeek ?? 1 // Default Monday
        return `${minute} ${hour} * * ${day}`
      
      case 'monthly':
        const dayOfMonth = schedule.dayOfMonth ?? 1
        return `${minute} ${hour} ${dayOfMonth} * *`
      
      case 'once':
      default:
        return '' // No cron for one-time reports
    }
  }
}
