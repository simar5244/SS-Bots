import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: { evaluationId: string } }
) {
  try {
    const evaluation = await dbService.findTranscriptEvaluationById(params.evaluationId)

    if (!evaluation) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 })
    }

    return NextResponse.json(evaluation)
  } catch (error) {
    console.error('Get evaluation error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch evaluation' },
      { status: 500 }
    )
  }
}
