import { dbService, VPATBot } from './db'
import { processVPATSubmissionDynamic } from './vpat-processor-dynamic'

interface MultiVPATRequest {
  vpatBot: VPATBot
  documents: Array<{
    buffer: Buffer
    fileName: string
    fileType: string
    impactFactors?: {
      peopleImpacted?: number
      cost?: number
    }
  }>
}

interface MultiVPATResult {
  batchId: string
  submissions: Array<{
    id: string
    fileName: string
    status: string
  }>
  totalProcessed: number
  successful: number
  failed: number
}

export async function processMultipleVPATs(request: MultiVPATRequest): Promise<MultiVPATResult> {
  console.log('🚀 [MULTI VPAT] Starting batch processing for', request.documents.length, 'documents')
  
  // Limit to 10 documents as requested
  const documentsToProcess = request.documents.slice(0, 10)
  
  // Check if these documents were already processed recently
  const recentSubmissions = await dbService.findVPATSubmissionsByBotId(request.vpatBot.id)
  const recentFileNames = recentSubmissions
    .filter(s => s.createdAt > Date.now() - 60000) // Last 1 minute
    .map(s => s.submittedDocument.fileName)
  
  const duplicateFiles = documentsToProcess.filter(doc => 
    recentFileNames.includes(doc.fileName)
  )
  
  if (duplicateFiles.length > 0) {
    console.log(`⚠️ [MULTI VPAT] Found ${duplicateFiles.length} recently processed files, checking for duplicates`)
    // Find existing batch with these files
    const existingBatch = recentSubmissions.find(s => s.batchId && 
      recentFileNames.includes(s.submittedDocument.fileName)
    )
    
    if (existingBatch?.batchId) {
      const batchSubmissions = await dbService.findVPATSubmissionsByBatchId(existingBatch.batchId)
      console.log(`📋 [MULTI VPAT] Found existing batch: ${existingBatch.batchId}`)
      
      return {
        batchId: existingBatch.batchId,
        submissions: batchSubmissions.map(sub => ({
          id: sub.id,
          fileName: sub.submittedDocument.fileName,
          status: sub.status
        })),
        totalProcessed: batchSubmissions.length,
        successful: batchSubmissions.filter(s => s.status === 'completed').length,
        failed: batchSubmissions.filter(s => s.status === 'failed').length
      }
    }
  }
  
  // Create batch in database
  const submittedDocuments = documentsToProcess.map(doc => ({
    fileName: doc.fileName,
    fileSize: doc.buffer.length,
    fileType: doc.fileType,
    uploadedAt: Date.now()
  }))
  
  const impactFactorsArray = documentsToProcess.map(doc => doc.impactFactors)
  
  const { batchId, submissions } = await dbService.createVPATBatch(
    request.vpatBot.id,
    submittedDocuments,
    impactFactorsArray
  )
  
  console.log('📋 [MULTI VPAT] Created batch:', batchId, 'with', submissions.length, 'submissions')
  
  // Process all documents simultaneously (start in background)
  const processingPromises = documentsToProcess.map(async (doc, index) => {
    const submission = submissions[index]
    
    // Check if already processed
    if (submission.status === 'completed' || submission.status === 'failed') {
      console.log(`⏭️ [MULTI VPAT] Skipping already processed document: ${doc.fileName} (${submission.status})`)
      return { id: submission.id, fileName: doc.fileName, status: submission.status }
    }
    
    console.log(`🔄 [MULTI VPAT] Processing document ${index + 1}/${documentsToProcess.length}: ${doc.fileName}`)
    
    // Update status to processing
    await dbService.updateVPATSubmission(submission.id, { status: 'processing' })
    
    try {
      // Use dynamic processor for all submissions
      console.log(`🎯 [MULTI VPAT] Using Dynamic Method for ${doc.fileName}`)
      await processVPATSubmissionDynamic(
        submission.id,
        request.vpatBot,
        doc.buffer,
        doc.fileType
      )
      
      console.log(`✅ [MULTI VPAT] Completed processing for ${doc.fileName}`)
      return { id: submission.id, fileName: doc.fileName, status: 'completed' }
    } catch (error) {
      console.error(`❌ [MULTI VPAT] Failed processing for ${doc.fileName}:`, error)
      
      // Update submission status to failed
      await dbService.updateVPATSubmission(submission.id, {
        status: 'failed'
      })
      
      return { id: submission.id, fileName: doc.fileName, status: 'failed' }
    }
  })
  
  // Start processing in background (don't await)
  Promise.allSettled(processingPromises).then((results) => {
    let successful = 0
    let failed = 0
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.status === 'completed') {
          successful++
        } else {
          failed++
        }
      } else {
        failed++
        console.error(`❌ [MULTI VPAT] Promise ${index} rejected:`, result.reason)
      }
    })
    
    console.log(`🎉 [MULTI VPAT] Batch processing completed: ${successful} successful, ${failed} failed`)
  })
  
  console.log(`🚀 [MULTI VPAT] Batch processing started for ${documentsToProcess.length} documents`)
  
  return {
    batchId,
    submissions: submissions.map(sub => ({
      id: sub.id,
      fileName: sub.submittedDocument.fileName,
      status: sub.status
    })),
    totalProcessed: documentsToProcess.length,
    successful: 0, // Will be updated as processing completes
    failed: 0 // Will be updated as processing completes
  }
}

export async function getBatchResults(batchId: string): Promise<{
  batchId: string
  submissions: any[]
  totalProcessed: number
  completed: number
  processing: number
  failed: number
}> {
  const submissions = await dbService.findVPATSubmissionsByBatchId(batchId)
  
  const completed = submissions.filter(s => s.status === 'completed').length
  const processing = submissions.filter(s => s.status === 'processing').length
  const failed = submissions.filter(s => s.status === 'failed').length
  
  return {
    batchId,
    submissions,
    totalProcessed: submissions.length,
    completed,
    processing,
    failed
  }
}
