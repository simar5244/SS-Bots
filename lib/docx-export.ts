/**
 * DOCX Export Service
 * Converts markdown reports to DOCX format
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import { ChartConfig } from './chart-service'

export class DocxExportService {
  /**
   * Convert markdown report to DOCX
   */
  static async generateDocx(
    reportMarkdown: string,
    title: string,
    charts?: ChartConfig[]
  ): Promise<Buffer> {
    const paragraphs: Paragraph[] = []

    // Parse markdown and convert to paragraphs
    const lines = reportMarkdown.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // Skip empty lines
      if (!line.trim()) {
        paragraphs.push(new Paragraph({ text: '' }))
        continue
      }

      // H1 Heading
      if (line.startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^# /, ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          })
        )
      }
      // H2 Heading
      else if (line.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^## /, ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 }
          })
        )
      }
      // H3 Heading
      else if (line.startsWith('### ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^### /, ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 }
          })
        )
      }
      // Bold text
      else if (line.includes('**')) {
        const parts = line.split('**')
        const runs: TextRun[] = []
        
        parts.forEach((part, idx) => {
          if (idx % 2 === 1) {
            runs.push(new TextRun({ text: part, bold: true }))
          } else if (part) {
            runs.push(new TextRun({ text: part }))
          }
        })
        
        paragraphs.push(new Paragraph({ children: runs }))
      }
      // Bullet points
      else if (line.startsWith('- ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^- /, ''),
            bullet: { level: 0 }
          })
        )
      }
      // Horizontal rule
      else if (line.startsWith('---')) {
        paragraphs.push(
          new Paragraph({
            text: '_______________________________________________________________________________',
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 }
          })
        )
      }
      // Code blocks (skip for now)
      else if (line.startsWith('```')) {
        // Skip code blocks
        while (i < lines.length && !lines[++i]?.startsWith('```')) {
          // Skip content
        }
      }
      // Regular paragraph
      else {
        paragraphs.push(
          new Paragraph({
            text: line,
            spacing: { after: 120 }
          })
        )
      }
    }

    // Add chart information section
    if (charts && charts.length > 0) {
      paragraphs.push(
        new Paragraph({
          text: '',
          spacing: { before: 400 }
        })
      )
      
      paragraphs.push(
        new Paragraph({
          text: 'Visualizations',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        })
      )

      paragraphs.push(
        new Paragraph({
          text: `This report includes ${charts.length} chart${charts.length > 1 ? 's' : ''}. Charts are displayed in the web interface and can be viewed there for interactive exploration.`,
          spacing: { after: 200 }
        })
      )

      charts.forEach((chart, idx) => {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Chart ${idx + 1}: `, bold: true }),
              new TextRun({ text: chart.title })
            ],
            spacing: { before: 200 }
          })
        )
        
        paragraphs.push(
          new Paragraph({
            text: `Type: ${chart.type.toUpperCase()}`,
            bullet: { level: 0 }
          })
        )
        
        if (chart.description) {
          paragraphs.push(
            new Paragraph({
              text: chart.description,
              bullet: { level: 0 }
            })
          )
        }
        
        // Add data summary
        if (chart.data && chart.data.length > 0) {
          const dataKeys = Object.keys(chart.data[0])
          paragraphs.push(
            new Paragraph({
              text: `Data points: ${chart.data.length} rows with fields: ${dataKeys.join(', ')}`,
              bullet: { level: 0 }
            })
          )
        }
        
        paragraphs.push(new Paragraph({ text: '' }))
      })
      
      paragraphs.push(
        new Paragraph({
          text: 'Note: For full interactive charts with hover details and zoom capabilities, please view this report in the web interface.',
          spacing: { before: 200, after: 200 }
        })
      )
    }

    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs
        }
      ]
    })

    // Generate buffer
    return await Packer.toBuffer(doc)
  }

  /**
   * Generate filename for DOCX
   */
  static generateFilename(title: string): string {
    const sanitized = title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const timestamp = new Date().toISOString().split('T')[0]
    return `${sanitized}_${timestamp}.docx`
  }
}
