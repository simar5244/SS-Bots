export const dynamic = 'force-dynamic'
export const revalidate = 0

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
    
    // Check if this is a platform-specific ID (format: submissionId_platformName)
    let actualId = params.id
    let platformName: string | null = null
    
    if (params.id.includes('_')) {
      const parts = params.id.split('_')
      // Check if the last part is a platform name (not a UUID part)
      const lastPart = parts[parts.length - 1]
      // Platform names won't be hex strings, UUIDs will be
      if (!/^[0-9a-f]+$/i.test(lastPart)) {
        platformName = lastPart
        actualId = parts.slice(0, -1).join('_')
      }
    }
    
    let submission = await dbService.findVPATSubmissionById(actualId)

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // Auto-heal stale status if processing finished but status not updated
    if (
      submission.status === 'processing' &&
      (submission.generatedScorecard || submission.completedAt)
    ) {
      submission = await dbService.updateVPATSubmission(actualId, {
        status: 'completed',
        completedAt: submission.completedAt || Date.now()
      }) || submission
    }

    // Verify user owns the bot that this submission belongs to
    const vpatBot = await dbService.findVPATBotById(submission.vpatBotId)
    if (!vpatBot || vpatBot.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // If platform-specific, customize the response
    let responseData: any = { ...submission }
    
    if (platformName && (submission as any).platformReports) {
      const platformReport = (submission as any).platformReports.find(
        (r: any) => r.platform === platformName
      )
      
      if (platformReport) {
        responseData = {
          ...submission,
          id: params.id,
          originalId: actualId,
          platform: platformName,
          platformSpecific: true,
          extractedData: {
            ...submission.extractedData,
            productName: `${submission.extractedData?.productName || 'Product'} (${platformName})`,
            criteria: platformReport.criteria || submission.extractedData?.criteria
          },
          generatedScorecard: {
            ...submission.generatedScorecard,
            fileName: platformReport.fileName,
            analysis: platformReport.analysis
          }
        }
      }
    }

    return NextResponse.json({
      ...responseData,
      _timestamp: Date.now() // Add timestamp for cache busting
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('Get submission error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submission' },
      { status: 500 }
    )
  }
}
