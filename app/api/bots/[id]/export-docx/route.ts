import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { DocxExportService } from '@/lib/docx-export'


export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { report, title, charts } = await request.json()

    if (!report || !title) {
      return NextResponse.json(
        { error: 'Report and title are required' },
        { status: 400 }
      )
    }

    // Generate DOCX
    const buffer = await DocxExportService.generateDocx(report, title, charts)

    // Return as downloadable file
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${DocxExportService.generateFilename(title)}"`,
      },
    })
  } catch (error) {
    console.error('DOCX export error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to export DOCX' },
      { status: 500 }
    )
  }
}
