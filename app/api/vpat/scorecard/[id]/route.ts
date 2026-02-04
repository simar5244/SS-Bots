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
    const submission = await dbService.findVPATSubmissionById(params.id)

    if (!submission || !submission.generatedScorecard) {
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
