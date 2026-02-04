import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ReportService } from '@/lib/report-service'
import { EmailService } from '@/lib/email-service'
import { AIService } from '@/lib/ai-service'
import { ChartService } from '@/lib/chart-service'

export const maxDuration = 60 // Allow up to 60 seconds for report generation

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

    const { config, schedule } = await request.json()

    if (!config || !config.title || !config.dataRequest) {
      return NextResponse.json(
        { error: 'Report configuration is incomplete. Title and data request are required.' },
        { status: 400 }
      )
    }

    // Generate the report by calling the chat API
    const chatApiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/bots/${params.id}/chat`
    
    // Get auth token from request
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    
    const result = await ReportService.generateReport(
      config,
      params.id,
      chatApiUrl,
      token, // Pass auth token
      ChartService // Pass ChartService for chart generation
    )

    // If scheduling is enabled, save the schedule
    if (schedule && schedule.frequency !== 'once') {
      const cronExpression = ReportService.generateCronExpression(schedule)
      
      // Save scheduled report to database (stub - implement in dbService later)
      console.log('Schedule saved:', {
        botId: bot.id,
        userId: user.id,
        config,
        schedule,
        cronExpression,
        isActive: true
      })
    }

    // If recipients are provided, send the report via email
    if (schedule && schedule.recipients && schedule.recipients.length > 0) {
      const reportHtml = ReportService.markdownToHtml(result.report)
      
      try {
        await EmailService.sendReport(
          schedule.recipients,
          config.title,
          reportHtml,
          result.report
        )
      } catch (emailError) {
        console.error('Failed to send report email:', emailError)
        // Don't fail the whole request if email fails
      }
    }

    return NextResponse.json({
      report: result.report,
      sql: result.sql,
      dataRows: result.data.length,
      charts: result.charts || [],
      scheduled: schedule && schedule.frequency !== 'once'
    })
  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to generate report' },
      { status: 500 }
    )
  }
}
