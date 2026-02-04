import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { createTranscriptBotService } from '@/lib/transcript-bot-loader'

const UPLOAD_DIR = join(homedir(), 'Desktop', 'db', 'transcript-submissions')

export async function GET(
  req: NextRequest,
  { params }: { params: { link: string } }
) {
  try {
    const bot = await dbService.findTranscriptBotByShareableLink(params.link)

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: bot.id,
      name: bot.name,
      isActive: bot.isActive,
      programs: bot.degreePlans.parsedData?.programs?.map(p => ({
        name: p.name,
        code: p.code
      })) || []
    })
  } catch (error) {
    console.error('Get bot info error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bot info' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { link: string } }
) {
  try {
    const bot = await dbService.findTranscriptBotByShareableLink(params.link)

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    const formData = await req.formData()
    const programName = formData.get('programName') as string
    const transcriptFiles = formData.getAll('transcripts') as File[]

    if (!programName || transcriptFiles.length === 0) {
      return NextResponse.json(
        { error: 'Program name and at least one transcript required' },
        { status: 400 }
      )
    }

    await mkdir(UPLOAD_DIR, { recursive: true })

    // Handle batch submission for multiple transcripts
    if (transcriptFiles.length > 1) {
      const studentTranscriptsList = []
      const filePaths: string[] = []
      
      for (const file of transcriptFiles) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const fileName = `${Date.now()}-${file.name}`
        const filePath = join(UPLOAD_DIR, fileName)
        await writeFile(filePath, buffer)

        studentTranscriptsList.push([{
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploadedAt: Date.now()
        }])
        
        filePaths.push(filePath)
      }

      const { batchId, evaluations } = await dbService.createTranscriptEvaluationBatch(
        bot.id,
        programName,
        studentTranscriptsList
      )

      await dbService.updateTranscriptBot(bot.id, {
        evaluationCount: bot.evaluationCount + transcriptFiles.length
      })

      // Process each evaluation in the batch
      const botService = createTranscriptBotService()
      
      for (let i = 0; i < evaluations.length; i++) {
        const evaluation = evaluations[i]
        const transcript = studentTranscriptsList[i][0]
        const filePath = filePaths[i]
        
        try {
          await dbService.updateTranscriptEvaluation(evaluation.id, {
            status: 'parsing'
          })
          
          const result = await botService.processTranscriptEvaluation(
            [{ name: transcript.fileName, path: filePath, type: transcript.fileType }],
            programName,
            bot.degreePlans
          )
          
          if (result.success) {
            await dbService.updateTranscriptEvaluation(evaluation.id, {
              status: 'completed',
              parsedTranscripts: result.parsedTranscripts,
              tccnsMatching: result.tccnsMatching,
              requirementEvaluation: result.requirementEvaluation,
              finalReport: result.finalReport,
              processingLog: result.processingLog,
              completedAt: Date.now()
            })
          } else {
            await dbService.updateTranscriptEvaluation(evaluation.id, {
              status: 'failed',
              processingLog: result.processingLog
            })
          }
        } catch (error) {
          console.error(`Processing error for evaluation ${evaluation.id}:`, error)
          await dbService.updateTranscriptEvaluation(evaluation.id, {
            status: 'failed',
            processingLog: [{
              timestamp: Date.now(),
              step: 'processing',
              status: 'failed',
              details: error instanceof Error ? error.message : 'Unknown error'
            }]
          })
        }
      }

      // Fetch complete evaluation data
      const evaluationResults = await Promise.all(
        evaluations.map(async (e) => {
          return await dbService.findTranscriptEvaluationById(e.id)
        })
      )

      return NextResponse.json({
        isBatch: true,
        batchId,
        evaluations: evaluations.map(e => e.id),
        evaluationResults,
        count: evaluations.length,
        status: 'completed',
        message: `Processed ${evaluations.length} transcripts`
      })
    }

    // Single transcript submission
    const studentTranscripts = []
    const savedFiles = []

    for (const file of transcriptFiles) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const fileName = `${Date.now()}-${file.name}`
      const filePath = join(UPLOAD_DIR, fileName)
      await writeFile(filePath, buffer)

      studentTranscripts.push({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadedAt: Date.now()
      })

      savedFiles.push({
        name: file.name,
        path: filePath,
        type: file.type
      })
    }

    const evaluation = await dbService.createTranscriptEvaluation(
      bot.id,
      programName,
      studentTranscripts
    )

    await dbService.updateTranscriptBot(bot.id, {
      evaluationCount: bot.evaluationCount + 1
    })

    try {
      const botService = createTranscriptBotService()
      
      await dbService.updateTranscriptEvaluation(evaluation.id, {
        status: 'parsing'
      })
      
      const result = await botService.processTranscriptEvaluation(
        savedFiles,
        programName,
        bot.degreePlans
      )
      
      if (result.success) {
        await dbService.updateTranscriptEvaluation(evaluation.id, {
          status: 'completed',
          parsedTranscripts: result.parsedTranscripts,
          tccnsMatching: result.tccnsMatching,
          requirementEvaluation: result.requirementEvaluation,
          finalReport: result.finalReport,
          processingLog: result.processingLog,
          completedAt: Date.now()
        })
      } else {
        await dbService.updateTranscriptEvaluation(evaluation.id, {
          status: 'failed',
          processingLog: result.processingLog
        })
      }
    } catch (error) {
      console.error('Processing error:', error)
      await dbService.updateTranscriptEvaluation(evaluation.id, {
        status: 'failed',
        processingLog: [{
          timestamp: Date.now(),
          step: 'processing',
          status: 'failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }]
      })
    }

    return NextResponse.json({
      evaluationId: evaluation.id,
      status: 'completed',
      message: 'Transcript evaluation complete.'
    })
  } catch (error) {
    console.error('Submit transcripts error:', error)
    return NextResponse.json(
      { error: 'Failed to submit transcripts' },
      { status: 500 }
    )
  }
}

async function processEvaluationInBackground(
  evaluationId: string,
  bot: any,
  transcriptFiles: any[],
  programName: string
) {
  try {
    console.log(`[BG] Starting background processing for evaluation ${evaluationId}`);
    const botService = createTranscriptBotService()

    await dbService.updateTranscriptEvaluation(evaluationId, {
      status: 'parsing'
    })
    console.log(`[BG] Status updated to parsing`);

    console.log(`[BG] Calling processTranscriptEvaluation with ${transcriptFiles.length} files`);
    const result = await botService.processTranscriptEvaluation(
      transcriptFiles,
      programName,
      bot.degreePlans
    )
    console.log(`[BG] Processing complete, success: ${result.success}`);

    if (result.success) {
      await dbService.updateTranscriptEvaluation(evaluationId, {
        status: 'completed',
        parsedTranscripts: result.parsedTranscripts,
        tccnsMatching: result.tccnsMatching,
        requirementEvaluation: result.requirementEvaluation,
        finalReport: result.finalReport,
        processingLog: result.processingLog,
        completedAt: Date.now()
      })
    } else {
      await dbService.updateTranscriptEvaluation(evaluationId, {
        status: 'failed',
        processingLog: result.processingLog
      })
    }
  } catch (error) {
    console.error('Background processing error:', error)
    await dbService.updateTranscriptEvaluation(evaluationId, {
      status: 'failed',
      processingLog: [{
        timestamp: Date.now(),
        step: 'background_processing',
        status: 'failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }]
    })
  }
}
