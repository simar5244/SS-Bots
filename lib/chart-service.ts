/**
 * Chart Generation Service
 * 
 * This is a SEPARATE AI service that receives output from the chatbot service
 * and generates chart configurations based on the data and context.
 * 
 * Flow: Chatbot Service → Data + Context → Chart AI Service → Chart Config → Recharts
 */

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'composed'
  title: string
  data: any[]
  xAxis?: {
    dataKey: string
    label?: string
  }
  yAxis?: {
    label?: string
  }
  dataKeys: Array<{
    key: string
    name: string
    color?: string
  }>
  description?: string
}

export interface ChartGenerationRequest {
  query: string // Original user query
  data: any[] // Data from chatbot/database
  context: string // Database context
  sqlQuery?: string // SQL that was executed
}

export class ChartService {
  /**
   * Analyze data and generate chart configurations using AI
   * This is SEPARATE from the chatbot AI service
   */
  static async generateCharts(request: ChartGenerationRequest): Promise<ChartConfig[]> {
    if (!request.data || request.data.length === 0) {
      return []
    }

    // Analyze the data structure
    const dataAnalysis = this.analyzeData(request.data)
    
    // Use AI to determine best chart types and configurations
    const openai = require('openai')
    const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY })

    const prompt = this.buildChartPrompt(request, dataAnalysis)

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a data visualization expert. Analyze data and suggest the best chart types and configurations. Return ONLY valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    })

    const aiResponse = response.choices[0].message.content || '{}'
    
    try {
      const parsed = JSON.parse(aiResponse)
      const charts = parsed.charts || []
      
      // Validate and format chart configs
      return charts.map((chart: any) => this.formatChartConfig(chart, request.data))
    } catch (error) {
      console.error('Failed to parse AI chart response:', error)
      // Fallback: generate a simple chart
      return [this.generateFallbackChart(request.data, dataAnalysis)]
    }
  }

  /**
   * Analyze data structure to understand what can be visualized
   */
  private static analyzeData(data: any[]): any {
    if (data.length === 0) return {}

    const firstRow = data[0]
    const columns = Object.keys(firstRow)
    
    const analysis: any = {
      rowCount: data.length,
      columns: {}
    }

    columns.forEach(col => {
      const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined)
      const sampleValues = values.slice(0, 5)
      
      // Determine column type
      const numericValues = values.filter(v => typeof v === 'number' || !isNaN(Number(v)))
      const dateValues = values.filter(v => !isNaN(Date.parse(String(v))))
      
      let type = 'string'
      if (numericValues.length === values.length) {
        type = 'numeric'
      } else if (dateValues.length === values.length) {
        type = 'date'
      }
      
      analysis.columns[col] = {
        type,
        uniqueCount: new Set(values).size,
        sampleValues,
        hasNulls: values.length < data.length
      }
      
      if (type === 'numeric') {
        const nums = numericValues.map(v => Number(v))
        analysis.columns[col].min = Math.min(...nums)
        analysis.columns[col].max = Math.max(...nums)
        analysis.columns[col].avg = nums.reduce((a, b) => a + b, 0) / nums.length
      }
    })

    return analysis
  }

  /**
   * Build prompt for AI to determine chart types
   */
  private static buildChartPrompt(request: ChartGenerationRequest, analysis: any): string {
    return `
# DATA VISUALIZATION TASK

## User Query
${request.query}

## Database Context
${request.context}

${request.sqlQuery ? `## SQL Query\n${request.sqlQuery}\n` : ''}

## Data Analysis
- Row Count: ${analysis.rowCount}
- Columns: ${Object.keys(analysis.columns).length}

### Column Details:
${Object.entries(analysis.columns).map(([col, info]: [string, any]) => 
  `- **${col}**: ${info.type} (${info.uniqueCount} unique values)${info.type === 'numeric' ? ` [${info.min.toFixed(2)} - ${info.max.toFixed(2)}]` : ''}`
).join('\n')}

## Sample Data (first 3 rows):
\`\`\`json
${JSON.stringify(request.data.slice(0, 3), null, 2)}
\`\`\`

## Task
Analyze this data and suggest 1-3 appropriate chart visualizations. For each chart, specify:

1. **type**: Choose from: line, bar, pie, area, scatter, composed
2. **title**: Descriptive title for the chart
3. **xAxis**: { dataKey: "column_name", label: "X Axis Label" }
4. **yAxis**: { label: "Y Axis Label" }
5. **dataKeys**: Array of { key: "column_name", name: "Display Name", color: "#hex" }
6. **description**: Brief explanation of what the chart shows

## Chart Type Guidelines:
- **Line**: Time series, trends over time
- **Bar**: Comparisons between categories, rankings
- **Pie**: Proportions, percentages (max 7 categories)
- **Area**: Cumulative values over time
- **Scatter**: Correlations between two numeric variables
- **Composed**: Multiple metrics on same chart (line + bar)

## Response Format (JSON only):
\`\`\`json
{
  "charts": [
    {
      "type": "bar",
      "title": "Revenue by Product Category",
      "xAxis": { "dataKey": "category", "label": "Product Category" },
      "yAxis": { "label": "Revenue ($)" },
      "dataKeys": [
        { "key": "revenue", "name": "Revenue", "color": "#8884d8" }
      ],
      "description": "Shows total revenue for each product category"
    }
  ]
}
\`\`\`

Generate chart configurations now:
`
  }

  /**
   * Format and validate chart config
   */
  private static formatChartConfig(aiChart: any, data: any[]): ChartConfig {
    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#ffb347']
    
    return {
      type: aiChart.type || 'bar',
      title: aiChart.title || 'Data Visualization',
      data: data,
      xAxis: aiChart.xAxis,
      yAxis: aiChart.yAxis,
      dataKeys: (aiChart.dataKeys || []).map((dk: any, idx: number) => ({
        key: dk.key,
        name: dk.name || dk.key,
        color: dk.color || colors[idx % colors.length]
      })),
      description: aiChart.description
    }
  }

  /**
   * Generate a simple fallback chart if AI fails
   */
  private static generateFallbackChart(data: any[], analysis: any): ChartConfig {
    const columns = Object.keys(analysis.columns)
    const numericColumns = columns.filter(col => analysis.columns[col].type === 'numeric')
    const categoricalColumns = columns.filter(col => 
      analysis.columns[col].type === 'string' && analysis.columns[col].uniqueCount < 20
    )

    // Simple bar chart with first categorical and first numeric column
    const xKey = categoricalColumns[0] || columns[0]
    const yKey = numericColumns[0] || columns[1] || columns[0]

    return {
      type: 'bar',
      title: 'Data Overview',
      data: data.slice(0, 20), // Limit to 20 rows
      xAxis: {
        dataKey: xKey,
        label: xKey
      },
      yAxis: {
        label: yKey
      },
      dataKeys: [{
        key: yKey,
        name: yKey,
        color: '#8884d8'
      }],
      description: `Showing ${yKey} by ${xKey}`
    }
  }

  /**
   * Generate chart suggestions without full generation (faster)
   */
  static async suggestChartTypes(data: any[]): Promise<string[]> {
    const analysis = this.analyzeData(data)
    const suggestions: string[] = []

    const numericCols = Object.entries(analysis.columns)
      .filter(([_, info]: [string, any]) => info.type === 'numeric')
      .map(([col]) => col)

    const categoricalCols = Object.entries(analysis.columns)
      .filter(([_, info]: [string, any]) => info.type === 'string' && info.uniqueCount < 20)
      .map(([col]) => col)

    const dateCols = Object.entries(analysis.columns)
      .filter(([_, info]: [string, any]) => info.type === 'date')
      .map(([col]) => col)

    if (dateCols.length > 0 && numericCols.length > 0) {
      suggestions.push('line', 'area')
    }

    if (categoricalCols.length > 0 && numericCols.length > 0) {
      suggestions.push('bar')
    }

    if (categoricalCols.length > 0 && numericCols.length === 1 && categoricalCols[0] && analysis.columns[categoricalCols[0]].uniqueCount <= 7) {
      suggestions.push('pie')
    }

    if (numericCols.length >= 2) {
      suggestions.push('scatter')
    }

    return suggestions.length > 0 ? suggestions : ['bar']
  }
}
