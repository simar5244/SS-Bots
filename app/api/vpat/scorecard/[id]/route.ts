import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import { readFile } from 'fs/promises'
import { join } from 'path'

const SCORECARD_DIR = join(process.env.HOME || '', 'Desktop', 'db', 'vpat-scorecards')

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if this is a platform-specific ID (format: submissionId_platformName)
    let actualId = params.id
    let platformFromId: string | null = null
    
    if (params.id.includes('_')) {
      const parts = params.id.split('_')
      const lastPart = parts[parts.length - 1]
      if (!/^[0-9a-f]+$/i.test(lastPart)) {
        platformFromId = lastPart
        actualId = parts.slice(0, -1).join('_')
      }
    }
    
    const submission = await dbService.findVPATSubmissionById(actualId)

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // Check if requesting a specific platform report (from query param or ID)
    const { searchParams } = new URL(req.url)
    const platformName = platformFromId || searchParams.get('platform')

    if (platformName && (submission as any).platformReports) {
      // Find the specific platform report
      const platformReport = (submission as any).platformReports.find(
        (r: any) => r.platform === platformName
      )

      if (!platformReport) {
        return NextResponse.json({ error: `Platform report '${platformName}' not found` }, { status: 404 })
      }

      const scorecardPath = join(SCORECARD_DIR, platformReport.fileName)
      const fileBuffer = await readFile(scorecardPath)

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${platformReport.fileName}"`,
        },
      })
    }

    // Default: return primary scorecard
    if (!submission.generatedScorecard) {
      return NextResponse.json({ error: 'Scorecard not found' }, { status: 404 })
    }

    const scorecardPath = join(SCORECARD_DIR, submission.generatedScorecard.fileName)
    const fileBuffer = await readFile(scorecardPath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${submission.generatedScorecard.fileName}"`,
      },
    })
  } catch (error) {
    console.error('Download scorecard error:', error)
    return NextResponse.json(
      { error: 'Failed to download scorecard' },
      { status: 500 }
    )
  }
}
