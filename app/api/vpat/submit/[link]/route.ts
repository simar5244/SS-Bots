import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { processVPATSubmission } from '@/lib/vpat-processor'
import { processMultipleVPATs } from '@/lib/vpat-multi-processor'

const UPLOAD_DIR = join(process.env.HOME || '', 'Desktop', 'db', 'vpat-submissions')

export async function GET(
  req: NextRequest,
  { params }: { params: { link: string } }
) {
  try {
    const vpatBot = await dbService.findVPATBotByShareableLink(params.link)

    if (!vpatBot) {
      return NextResponse.json({ error: 'VPAT bot not found or inactive' }, { status: 404 })
    }

    return NextResponse.json({
      id: vpatBot.id,
      name: vpatBot.name,
      isActive: vpatBot.isActive,
    })
  } catch (error) {
    console.error('Get VPAT bot error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch VPAT bot' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { link: string } }
) {
  try {
    const vpatBot = await dbService.findVPATBotByShareableLink(params.link)

    if (!vpatBot) {
      return NextResponse.json({ error: 'VPAT bot not found or inactive' }, { status: 404 })
    }

    const formData = await req.formData()
    
    // Check for multiple files (multi-VPAT upload)
    const files = formData.getAll('documents') as File[]
    const singleFile = formData.get('document') as File
    
    if (files.length > 1) {
      // Multi-VPAT processing
      if (files.length > 10) {
        return NextResponse.json({ error: 'Maximum 10 files allowed per batch' }, { status: 400 })
      }

      await mkdir(UPLOAD_DIR, { recursive: true })

      // Process all files
      const documents = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const buffer = Buffer.from(await file.arrayBuffer())
        const fileName = `${Date.now()}-${i}-${file.name}`
        const filePath = join(UPLOAD_DIR, fileName)
        await writeFile(filePath, buffer)
        
        documents.push({
          buffer,
          fileName: file.name,
          fileType: file.type
        })
      }

      // Start batch processing and get submission IDs
      const batchResult = await processMultipleVPATs({ vpatBot, documents })

      return NextResponse.json({
        message: `${files.length} documents uploaded successfully. Batch processing started.`,
        fileCount: files.length,
        isBatch: true,
        batchId: batchResult.batchId,
        submissions: batchResult.submissions
      })

    } else if (singleFile) {
      // Single VPAT processing (existing logic)
      await mkdir(UPLOAD_DIR, { recursive: true })

      const buffer = Buffer.from(await singleFile.arrayBuffer())
      const fileName = `${Date.now()}-${singleFile.name}`
      const filePath = join(UPLOAD_DIR, fileName)
      await writeFile(filePath, buffer)

      const submittedDocument = {
        fileName: singleFile.name,
        fileSize: singleFile.size,
        fileType: singleFile.type,
        uploadedAt: Date.now(),
      }

      const submission = await dbService.createVPATSubmission(
        vpatBot.id,
        submittedDocument
      )

      processVPATSubmission(submission.id, vpatBot, buffer, singleFile.type).catch((err: Error) => {
        console.error('Background processing error:', err)
      })

      return NextResponse.json({
        submissionId: submission.id,
        message: 'Document uploaded successfully. Processing started.',
        isBatch: false
      })
    } else {
      return NextResponse.json({ error: 'Document file(s) required' }, { status: 400 })
    }
  } catch (error) {
    console.error('Submit VPAT error:', error)
    return NextResponse.json(
      { error: 'Failed to submit document(s)' },
      { status: 500 }
    )
  }
}
