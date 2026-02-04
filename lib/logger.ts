/**
 * Comprehensive Logging System
 * Tracks all service interactions and handoffs
 */

export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

export enum ServiceType {
  CHAT_AI = 'CHAT_AI_SERVICE',
  REPORT_AI = 'REPORT_AI_SERVICE',
  CHART_AI = 'CHART_AI_SERVICE',
  SCHEDULER = 'SCHEDULER_SERVICE',
  EMAIL = 'EMAIL_SERVICE',
  DATABASE = 'DATABASE_SERVICE'
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  service: ServiceType
  operation: string
  details: any
  duration?: number
  handoff?: {
    from: ServiceType
    to: ServiceType
    data: string
  }
}

export class Logger {
  private static logs: LogEntry[] = []
  private static maxLogs = 1000 // Keep last 1000 logs in memory

  /**
   * Log an operation
   */
  static log(
    level: LogLevel,
    service: ServiceType,
    operation: string,
    details: any,
    duration?: number
  ) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      operation,
      details,
      duration
    }

    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // Console output with colors
    this.printLog(entry)
  }

  /**
   * Log a service handoff
   */
  static logHandoff(
    from: ServiceType,
    to: ServiceType,
    operation: string,
    data: any
  ) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      service: from,
      operation: `HANDOFF → ${to}`,
      details: data,
      handoff: {
        from,
        to,
        data: typeof data === 'string' ? data : JSON.stringify(data).slice(0, 200)
      }
    }

    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    this.printHandoff(entry)
  }

  /**
   * Start timing an operation
   */
  static startTimer(): number {
    return Date.now()
  }

  /**
   * End timing and log
   */
  static endTimer(
    startTime: number,
    level: LogLevel,
    service: ServiceType,
    operation: string,
    details: any
  ) {
    const duration = Date.now() - startTime
    this.log(level, service, operation, details, duration)
  }

  /**
   * Get recent logs
   */
  static getLogs(limit?: number): LogEntry[] {
    return limit ? this.logs.slice(-limit) : this.logs
  }

  /**
   * Clear logs
   */
  static clear() {
    this.logs = []
  }

  /**
   * Print log to console with formatting
   */
  private static printLog(entry: LogEntry) {
    const emoji = {
      [LogLevel.INFO]: 'ℹ️',
      [LogLevel.SUCCESS]: '✅',
      [LogLevel.WARNING]: '⚠️',
      [LogLevel.ERROR]: '❌',
      [LogLevel.DEBUG]: '🔍'
    }

    const color = {
      [LogLevel.INFO]: '\x1b[36m',
      [LogLevel.SUCCESS]: '\x1b[32m',
      [LogLevel.WARNING]: '\x1b[33m',
      [LogLevel.ERROR]: '\x1b[31m',
      [LogLevel.DEBUG]: '\x1b[90m'
    }

    const reset = '\x1b[0m'
    const bold = '\x1b[1m'

    const durationStr = entry.duration ? ` (${entry.duration}ms)` : ''
    
    console.log(
      `${color[entry.level]}${emoji[entry.level]} [${entry.timestamp}] ${bold}${entry.service}${reset}${color[entry.level]} → ${entry.operation}${durationStr}${reset}`
    )
    
    if (entry.details && Object.keys(entry.details).length > 0) {
      console.log(`   ${JSON.stringify(entry.details, null, 2).split('\n').join('\n   ')}`)
    }
  }

  /**
   * Print handoff with special formatting
   */
  private static printHandoff(entry: LogEntry) {
    const reset = '\x1b[0m'
    const cyan = '\x1b[36m'
    const yellow = '\x1b[33m'
    const bold = '\x1b[1m'

    console.log(
      `${cyan}🔄 [${entry.timestamp}] ${bold}HANDOFF${reset}${cyan} ${entry.handoff?.from} → ${entry.handoff?.to}${reset}`
    )
    console.log(`   ${yellow}Operation: ${entry.operation}${reset}`)
    console.log(`   Data: ${entry.handoff?.data}`)
  }

  /**
   * Export logs as text
   */
  static exportLogs(): string {
    return this.logs.map(entry => {
      const durationStr = entry.duration ? ` (${entry.duration}ms)` : ''
      let output = `[${entry.timestamp}] ${entry.level} ${entry.service} → ${entry.operation}${durationStr}\n`
      
      if (entry.handoff) {
        output += `  HANDOFF: ${entry.handoff.from} → ${entry.handoff.to}\n`
        output += `  Data: ${entry.handoff.data}\n`
      }
      
      if (entry.details) {
        output += `  Details: ${JSON.stringify(entry.details, null, 2)}\n`
      }
      
      return output
    }).join('\n')
  }
}
