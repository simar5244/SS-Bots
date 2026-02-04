import nodemailer from 'nodemailer'

export interface EmailConfig {
  to: string[]
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    content: string | Buffer
  }>
}

export class EmailService {
  private static transporter: any = null

  /**
   * Initialize email transporter with SMTP credentials from environment
   */
  private static getTransporter() {
    if (this.transporter) {
      return this.transporter
    }

    const smtpHost = process.env.SMTP_HOST
    const smtpPort = parseInt(process.env.SMTP_PORT || '587')
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpFrom = process.env.SMTP_FROM || smtpUser

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error('SMTP credentials not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in environment variables.')
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })

    return this.transporter
  }

  /**
   * Send an email
   */
  static async sendEmail(config: EmailConfig): Promise<void> {
    const transporter = this.getTransporter()
    const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER

    const mailOptions = {
      from: smtpFrom,
      to: config.to.join(', '),
      subject: config.subject,
      html: config.html,
      attachments: config.attachments,
    }

    try {
      const info = await transporter.sendMail(mailOptions)
      console.log('Email sent successfully:', info.messageId)
    } catch (error) {
      console.error('Failed to send email:', error)
      throw new Error(`Email sending failed: ${(error as Error).message}`)
    }
  }

  /**
   * Send a report via email
   */
  static async sendReport(
    recipients: string[],
    reportTitle: string,
    reportHtml: string,
    reportMarkdown?: string
  ): Promise<void> {
    const attachments = []

    // Attach markdown version if provided
    if (reportMarkdown) {
      attachments.push({
        filename: `${reportTitle.replace(/[^a-z0-9]/gi, '_')}.md`,
        content: reportMarkdown,
      })
    }

    await this.sendEmail({
      to: recipients,
      subject: `Report: ${reportTitle}`,
      html: reportHtml,
      attachments,
    })
  }

  /**
   * Test SMTP connection
   */
  static async testConnection(): Promise<boolean> {
    try {
      const transporter = this.getTransporter()
      await transporter.verify()
      console.log('SMTP connection verified successfully')
      return true
    } catch (error) {
      console.error('SMTP connection test failed:', error)
      return false
    }
  }

  /**
   * Send VPAT missing data notification
   */
  static async sendVPATMissingDataEmail(
    recipients: string[],
    productName: string,
    missingFields: string[],
    submissionId: string
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">⚠️ VPAT Submission - Missing Critical Data</h2>
        <p>A VPAT submission for <strong>${productName || 'Unknown Product'}</strong> is missing critical information required for legal compliance.</p>
        
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #991b1b;">Missing Fields:</h3>
          <ul style="margin: 0;">
            ${missingFields.map(field => `<li>${field}</li>`).join('')}
          </ul>
        </div>
        
        <p><strong>Action Required:</strong> Manual review needed to complete the evaluation.</p>
        <p style="color: #666; font-size: 14px;">Submission ID: ${submissionId}</p>
      </div>
    `

    await this.sendEmail({
      to: recipients,
      subject: `⚠️ VPAT Missing Data - ${productName || 'Unknown Product'}`,
      html
    })
  }

  /**
   * Send VPAT completion notification
   */
  static async sendVPATCompletionEmail(
    recipients: string[],
    productName: string,
    isValid: boolean,
    scorecard: { fileName: string; downloadUrl?: string },
    submissionId: string
  ): Promise<void> {
    const statusColor = isValid ? '#16a34a' : '#f59e0b'
    const statusIcon = isValid ? '✅' : '⚠️'
    const statusText = isValid ? 'VALID - Passed All Checks' : 'REQUIRES REVIEW - Issues Found'

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${statusColor};">${statusIcon} VPAT Evaluation Complete</h2>
        <p>The VPAT evaluation for <strong>${productName}</strong> has been completed.</p>
        
        <div style="background: ${isValid ? '#f0fdf4' : '#fffbeb'}; border-left: 4px solid ${statusColor}; padding: 16px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: ${statusColor};">Status: ${statusText}</h3>
        </div>
        
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Generated Scorecard</h3>
          <p><strong>File:</strong> ${scorecard.fileName}</p>
          ${scorecard.downloadUrl ? `<a href="${scorecard.downloadUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Download Scorecard</a>` : ''}
        </div>
        
        <p style="color: #666; font-size: 14px;">Submission ID: ${submissionId}</p>
      </div>
    `

    await this.sendEmail({
      to: recipients,
      subject: `${statusIcon} VPAT Complete - ${productName}`,
      html
    })
  }

  /**
   * Send VPAT error notification
   */
  static async sendVPATErrorEmail(
    recipients: string[],
    productName: string,
    errorMessage: string,
    submissionId: string
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">❌ VPAT Processing Error</h2>
        <p>An error occurred while processing the VPAT for <strong>${productName || 'Unknown Product'}</strong>.</p>
        
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #991b1b;">Error Details:</h3>
          <p style="font-family: monospace; background: #fff; padding: 12px; border-radius: 4px;">${errorMessage}</p>
        </div>
        
        <p><strong>Action Required:</strong> Manual intervention needed. Please review the submission and retry processing.</p>
        <p style="color: #666; font-size: 14px;">Submission ID: ${submissionId}</p>
      </div>
    `

    await this.sendEmail({
      to: recipients,
      subject: `❌ VPAT Error - ${productName || 'Unknown Product'}`,
      html
    })
  }
}
