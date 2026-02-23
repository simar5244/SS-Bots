import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    const vpatBot = await dbService.findVPATBotById(params.id)

    if (!vpatBot) {
      return NextResponse.json({ error: 'VPAT bot not found' }, { status: 404 })
    }

    if (vpatBot.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const submissions = await dbService.findVPATSubmissionsByBotId(params.id)

    // Expand submissions with multiple platforms into separate entries
    const expandedSubmissions: any[] = []
    
    for (const submission of submissions) {
      if ((submission as any).platformReports && (submission as any).platformReports.length > 1) {
        // Create separate submission entry for each platform
        for (const platformReport of (submission as any).platformReports) {
          expandedSubmissions.push({
            ...submission,
            id: `${submission.id}_${platformReport.platform}`,
            originalId: submission.id,
            platform: platformReport.platform,
            platformSpecific: true,
            extractedData: {
              ...submission.extractedData,
              productName: `${submission.extractedData?.productName || 'Product'} (${platformReport.platform})`
            },
            generatedScorecard: {
              ...submission.generatedScorecard,
              fileName: platformReport.fileName,
              analysis: platformReport.analysis
            }
          })
        }
      } else {
        // Single platform or no platform reports - keep as is
        expandedSubmissions.push(submission)
      }
    }

    return NextResponse.json(expandedSubmissions)
  } catch (error) {
    console.error('Get submissions error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    )
  }
}
