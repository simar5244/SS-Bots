import cron from 'node-cron'
import { dbService } from './db'
import { ReportService } from './report-service'
import { EmailService } from './email-service'

interface ScheduledReport {
  id: string
  botId: string
  userId: string
  config: any
  schedule: any
  cronExpression: string
  isActive: boolean
}

export class ReportScheduler {
  private static tasks: Map<string, cron.ScheduledTask> = new Map()
  private static initialized = false

  /**
   * Initialize the report scheduler
   * This should be called once when the application starts
   */
  static async initialize() {
    if (this.initialized) {
      console.log('Report scheduler already initialized')
      return
    }

    console.log('Initializing report scheduler...')

    try {
      // Load all active scheduled reports from database
      const scheduledReports = await this.loadScheduledReports()
      
      // Schedule each report
      for (const report of scheduledReports) {
        this.scheduleReport(report)
      }

      this.initialized = true
      console.log(`Report scheduler initialized with ${scheduledReports.length} scheduled reports`)
    } catch (error) {
      console.error('Failed to initialize report scheduler:', error)
    }
  }

  /**
   * Load all active scheduled reports from database
   */
  private static async loadScheduledReports(): Promise<ScheduledReport[]> {
    // TODO: Implement dbService.getScheduledReports() method
    // This would query your database for scheduled reports
    try {
      // const reports = await dbService.getScheduledReports()
      // return reports.filter((r: any) => r.isActive)
      return [] // Stub for now
    } catch (error) {
      console.error('Failed to load scheduled reports:', error)
      return []
    }
  }

  /**
   * Schedule a report using cron
   */
  static scheduleReport(report: ScheduledReport) {
    if (!cron.validate(report.cronExpression)) {
      console.error(`Invalid cron expression for report ${report.id}: ${report.cronExpression}`)
      return
    }

    // Cancel existing task if it exists
    if (this.tasks.has(report.id)) {
      this.tasks.get(report.id)?.stop()
      this.tasks.delete(report.id)
    }

    // Create new cron task
    const task = cron.schedule(report.cronExpression, async () => {
      console.log(`Executing scheduled report: ${report.id}`)
      await this.executeScheduledReport(report)
    })

    this.tasks.set(report.id, task)
    console.log(`Scheduled report ${report.id} with cron: ${report.cronExpression}`)
  }

  /**
   * Execute a scheduled report
   */
  private static async executeScheduledReport(report: ScheduledReport) {
    try {
      // Get bot details
      const bot = await dbService.findBotById(report.botId)
      if (!bot) {
        console.error(`Bot not found for scheduled report ${report.id}`)
        return
      }

      // Generate the report
      const context = (bot as any).dbContext || `Database: ${bot.dbType}`
      
      // Import AIService dynamically to avoid circular dependencies
      const { AIService } = await import('./ai-service')
      
      const result = await ReportService.generateReport(
        report.config,
        bot.dbType,
        bot.dbConfig,
        context,
        bot.schema || {},
        bot.vectorData || [],
        (bot as any).dbIntelligence || '',
        (bot as any).dbHandbook || {},
        AIService
      )

      // Convert to HTML for email
      const reportHtml = ReportService.markdownToHtml(result.report)

      // Send via email
      if (report.schedule.recipients && report.schedule.recipients.length > 0) {
        await EmailService.sendReport(
          report.schedule.recipients,
          report.config.title,
          reportHtml,
          result.report
        )
        console.log(`Scheduled report ${report.id} sent successfully`)
      }

      // TODO: Log execution - implement dbService.logReportExecution()
      console.log(`Report ${report.id} executed successfully`)
    } catch (error) {
      console.error(`Failed to execute scheduled report ${report.id}:`, error)
      // TODO: Log failure - implement dbService.logReportExecution()
    }
  }

  /**
   * Add a new scheduled report
   */
  static async addScheduledReport(report: ScheduledReport) {
    this.scheduleReport(report)
  }

  /**
   * Remove a scheduled report
   */
  static removeScheduledReport(reportId: string) {
    const task = this.tasks.get(reportId)
    if (task) {
      task.stop()
      this.tasks.delete(reportId)
      console.log(`Removed scheduled report: ${reportId}`)
    }
  }

  /**
   * Update a scheduled report
   */
  static async updateScheduledReport(report: ScheduledReport) {
    this.removeScheduledReport(report.id)
    if (report.isActive) {
      this.scheduleReport(report)
    }
  }

  /**
   * Stop all scheduled tasks
   */
  static stopAll() {
    for (const [id, task] of this.tasks.entries()) {
      task.stop()
      console.log(`Stopped scheduled report: ${id}`)
    }
    this.tasks.clear()
    this.initialized = false
  }
}

// Auto-initialize when module is loaded (for server startup)
if (typeof window === 'undefined') {
  // Only run on server side
  ReportScheduler.initialize().catch(console.error)
}
