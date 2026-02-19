import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { dbService } from '@/lib/db'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key'
const UPLOAD_DIR = join(process.env.HOME || '', 'Desktop', 'db', 'vpat-submissions')

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; pageNumber: string } }
) {
  console.log('🔍 [PAGE API] Request received:', {
    id: params.id,
    pageNumber: params.pageNumber,
    url: req.url
  })

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    console.log('🔑 [PAGE API] Token present:', !!token)
    
    if (!token) {
      console.log('❌ [PAGE API] No token provided')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    console.log('👤 [PAGE API] Token decoded for userId:', decoded.userId)
    
    const submission = await dbService.findVPATSubmissionById(params.id)
    console.log('📄 [PAGE API] Submission found:', !!submission)

    if (!submission) {
      console.log('❌ [PAGE API] Submission not found:', params.id)
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // Verify user owns the bot that this submission belongs to
    const vpatBot = await dbService.findVPATBotById(submission.vpatBotId)
    console.log('🤖 [PAGE API] VPAT Bot found:', !!vpatBot, 'userId match:', vpatBot?.userId === decoded.userId)
    
    if (!vpatBot || vpatBot.userId !== decoded.userId) {
      console.log('❌ [PAGE API] Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Find the uploaded document file - match by uploadedAt timestamp
    const files = await readdir(UPLOAD_DIR)
    
    // The file is named with timestamp: `${Date.now()}-${fileName}`
    // We need to find the file that matches the submission's uploadedAt timestamp
    const uploadedAt = submission.submittedDocument?.uploadedAt
    console.log('⏰ [PAGE API] Looking for file with uploadedAt:', uploadedAt)
    
    let submissionFile = null
    if (uploadedAt) {
      submissionFile = files.find((file: string) => file.startsWith(`${uploadedAt}-`))
    }
    
    // Fallback: try to find the most recent file with the same name
    if (!submissionFile && submission.submittedDocument?.fileName) {
      const filesWithSameName = files.filter((file: string) => file.includes(submission.submittedDocument.fileName))
      if (filesWithSameName.length > 0) {
        // Sort by timestamp (descending) and take the most recent
        submissionFile = filesWithSameName.sort((a, b) => {
          const aTimestamp = parseInt(a.split('-')[0])
          const bTimestamp = parseInt(b.split('-')[0])
          return bTimestamp - aTimestamp
        })[0]
      }
    }
    
    if (!submissionFile) {
      console.log('❌ [PAGE API] Document file not found for submission:', submission.id)
      console.log('📋 [PAGE API] Available files:', files.slice(0, 10))
      return NextResponse.json({ error: 'Document file not found' }, { status: 404 })
    }

    console.log('✅ [PAGE API] Found file:', submissionFile)

    const filePath = join(UPLOAD_DIR, submissionFile)
    console.log('📂 [PAGE API] Reading file:', filePath)
    const buffer = await readFile(filePath)
    console.log('📊 [PAGE API] File size:', buffer.length, 'bytes')

    // Extract text from document
    const text = buffer.toString('utf-8')
    const requestedPage = parseInt(params.pageNumber, 10)
    console.log('📖 [PAGE API] Requested page:', requestedPage, 'Text length:', text.length)

    if (isNaN(requestedPage) || requestedPage < 1) {
      console.log('❌ [PAGE API] Invalid page number:', requestedPage)
      return NextResponse.json({ error: 'Invalid page number' }, { status: 400 })
    }

    let pageContent = ''
    let totalPages = 0

    // Check if text has page markers
    const hasPageMarkers = text.includes('--- PAGE')
    console.log('📝 [PAGE API] Has page markers:', hasPageMarkers)
    
    if (hasPageMarkers) {
      const pages = text.split('\n--- PAGE ').filter(Boolean).map((page, i) => {
        const cleanPage = page.replace(/^(\d+) ---\n/, '').trim()
        return cleanPage
      })
      totalPages = pages.length
      console.log('📄 [PAGE API] Total pages with markers:', totalPages)

      if (requestedPage <= pages.length) {
        pageContent = pages[requestedPage - 1]
        console.log('✅ [PAGE API] Page content extracted, length:', pageContent.length)
      } else {
        console.log('❌ [PAGE API] Page number exceeds total pages:', requestedPage, '>', totalPages)
      }
    } else {
      // If no page markers, split by reasonable chunk size
      const chunkSize = 2000
      const pages = []
      for (let i = 0; i < text.length; i += chunkSize) {
        pages.push(text.substring(i, i + chunkSize))
      }
      totalPages = pages.length
      console.log('📄 [PAGE API] Total pages by chunking:', totalPages)

      if (requestedPage <= pages.length) {
        pageContent = pages[requestedPage - 1]
        console.log('✅ [PAGE API] Chunked page content extracted, length:', pageContent.length)
      }
    }

    const response = {
      content: pageContent,
      pageNumber: requestedPage,
      totalPages
    }
    
    console.log('📤 [PAGE API] Returning response:', {
      hasContent: !!pageContent,
      contentLength: pageContent.length,
      pageNumber: requestedPage,
      totalPages
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ [PAGE API] Error:', error)
    console.error('🔍 [PAGE API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
    return NextResponse.json(
      { error: 'Failed to fetch page content' },
      { status: 500 }
    )
  }
}
