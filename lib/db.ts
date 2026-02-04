import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'

// Use app-local database directory for distribution
const getDbPath = () => {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH
  }
  
  // Default to app directory/data/db/data.json
  const appDir = process.cwd()
  const dbDir = join(appDir, 'data', 'db')
  
  // Ensure directory exists
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }
  
  return join(dbDir, 'data.json')
}

const DB_PATH = getDbPath()

interface User {
  id: string
  email: string
  password: string
  name: string
  role: 'user' | 'admin'
  resetToken?: string
  resetTokenExpiry?: number
  createdAt: number
}

interface Bot {
  id: string
  userId: string
  name: string
  dbType: string
  dbConfig: any
  schema?: any
  vectorData?: any[]
  dbIntelligence?: string
  dbHandbook?: any
  isConnected: boolean
  createdAt: number
  updatedAt: number
}

interface VPATBot {
  id: string
  userId: string
  name: string
  botType: 'vpat'
  referenceScorecard: {
    fileName: string
    fileSize: number
    fileType: string
    uploadedAt: number
    parsedStructure?: any
    sheets?: string[]
  }
  config: {
    emailNotifications: boolean
    notifyOnMissingData: boolean
    notifyOnCompletion: boolean
    notifyOnErrors: boolean
    recipientEmail?: string
    requireVPATVersion?: string
    requireWCAGLevel?: string
    autoApprove?: boolean
    strictMode: boolean
    processingMethod: 'method1' | 'method2' | 'dynamic'
  }
  shareableLink: string
  isActive: boolean
  processedCount: number
  createdAt: number
  updatedAt: number
}

interface VPATSubmission {
  id: string
  vpatBotId: string
  batchId?: string // For grouping multiple VPAT submissions
  batchIndex?: number // Position in batch (0-based)
  submittedDocument: {
    fileName: string
    fileSize: number
    fileType: string
    uploadedAt: number
    rawText?: string
  }
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'needs_review'
  extractedData?: {
    vpatVersion?: string
    productName?: string
    vendorName?: string
    reportDate?: string
    wcagVersion?: string
    wcagLevel?: string
    criteria?: Array<{
      criterionId: string
      criterionName: string
      level: string
      conformanceLevel: string
      scorecardEquivalent: string
      remarks?: string
      pageNumber?: number
      excerpt?: string
      confidence?: number
    }>
  }
  validationResults?: {
    isValid: boolean
    errors: string[]
    warnings: string[]
    missingFields: string[]
    scorecardCompliance?: {
      expectedCriteria: number
      extractedCriteria: number
      matchingCriteria: number
    }
  }
  generatedScorecard?: {
    fileName: string
    generatedAt: number
    downloadUrl?: string
    analysis?: {
      totalCriteria: number
      overallScore: number
      compliancePercentage: number
      levelACompliance?: number
      levelAACompliance?: number
      levelAAACompliance?: number
      supports?: number
      partiallySupports?: number
      doesNotSupport?: number
      criticalIssuesCount?: number
      strengthsCount?: number
      verificationResult?: {
        hasMistakes: boolean
        mistakes: Array<{
          type: 'extraction' | 'scoring' | 'mapping' | 'calculation'
          description: string
          severity: 'low' | 'medium' | 'high'
          suggestedFix?: string
        }>
        confidence: number
        recommendations: string[]
      }
      scorecardAnalysis?: {
        evaluationMethodology: string
        criteriaList: Array<{
          id: string
          name: string
          level: string
          weight?: number
          description?: string
        }>
        scoringSystem: {
          supports: string | number
          partiallySupports: string | number
          doesNotSupport: string | number
          notApplicable?: string | number
          notEvaluated?: string | number
        }
        validationRules: Array<{
          field: string
          requirement: string
          mandatory: boolean
        }>
      }
    }
  }
  detailedScorecard?: {
    rows: any[]
    analysis: any
    verificationResult?: {
      hasMistakes: boolean
      mistakes: Array<{
        type: 'extraction' | 'scoring' | 'mapping' | 'calculation'
        description: string
        severity: 'low' | 'medium' | 'high'
        suggestedFix?: string
      }>
      confidence: number
      recommendations: string[]
    }
    scorecardAnalysis?: {
      evaluationMethodology: string
      criteriaList: Array<{
        id: string
        name: string
        level: string
        weight?: number
        description?: string
      }>
      scoringSystem: {
        supports: string | number
        partiallySupports: string | number
        doesNotSupport: string | number
        notApplicable?: string | number
        notEvaluated?: string | number
      }
      validationRules: Array<{
        field: string
        requirement: string
        mandatory: boolean
      }>
    }
  }
  aiAnalysis?: {
    summary: string
    confidence: number
    flaggedIssues: string[]
    recommendations: string[]
  }
  emailsSent?: {
    type: string
    sentAt: number
    recipient: string
  }[]
  processingLog: {
    timestamp: number
    step: string
    status: string
    details?: string
  }[]
  createdAt: number
  completedAt?: number
}

interface QueryCache {
  id: string
  botId: string
  queryHash: string
  response: string
  metadata?: any
  expiresAt: number
  createdAt: number
}

interface TranscriptBot {
  id: string
  userId: string
  name: string
  botType: 'transcript'
  degreePlans: {
    fileName: string
    fileSize: number
    fileType: string
    uploadedAt: number
    parsedData?: {
      programs: Array<{
        id: string
        name: string
        code: string
        totalCredits: number
        requirements: Array<{
          id: string
          category: string
          type: 'specific_courses' | 'credit_hours' | 'grade_requirement' | 'elective'
          courses?: string[]
          credits?: number
          minGrade?: string
          minCourses?: number
          description?: string
        }>
      }>
    }
    verificationStatus?: 'pending' | 'verified' | 'needs_review'
    verificationNotes?: string[]
  }
  tccnsData?: {
    fileName: string
    uploadedAt: number
    totalEquivalencies: number
  }
  shareableLink: string
  isActive: boolean
  evaluationCount: number
  createdAt: number
  updatedAt: number
}

interface TranscriptEvaluation {
  id: string
  transcriptBotId: string
  batchId?: string
  batchIndex?: number
  programName: string
  studentTranscripts: Array<{
    fileName: string
    fileSize: number
    fileType: string
    uploadedAt: number
  }>
  status: 'pending' | 'parsing' | 'matching' | 'evaluating' | 'completed' | 'failed'
  parsedTranscripts?: Array<{
    fileName: string
    institution: string
    studentName?: string
    courses: Array<{
      courseCode: string
      courseName: string
      credits: number
      grade: string
      term?: string
      year?: number
    }>
    verificationStatus?: 'verified' | 'needs_review'
    verificationNotes?: string[]
  }>
  tccnsMatching?: Array<{
    originalCourse: string
    originalInstitution: string
    ttuEquivalent?: string
    creditGranted: boolean
    credits?: number
    notes?: string
  }>
  requirementEvaluation?: {
    programName: string
    totalRequirements: number
    metRequirements: number
    unmetRequirements: Array<{
      category: string
      requirement: string
      status: 'missing' | 'insufficient_credits' | 'grade_too_low'
      details: string
    }>
    completionPercentage: number
    recommendations: string[]
  }
  finalReport?: {
    summary: string
    eligibility: 'eligible' | 'conditional' | 'not_eligible'
    missingCourses: string[]
    actionItems: string[]
    generatedAt: number
  }
  processingLog: Array<{
    timestamp: number
    step: string
    status: string
    details?: string
  }>
  createdAt: number
  completedAt?: number
}

interface TranscriptFlag {
  id: string
  transcriptBotId: string
  userId: string
  flagType: 'course' | 'requirement' | 'tccns' | 'general'
  itemType: 'degree_plan' | 'tccns_equivalency' | 'scorecard'
  itemId?: string
  description: string
  originalValue?: string
  editedValue?: string
  status: 'pending' | 'reviewed' | 'resolved'
  reviewedBy?: string
  reviewNotes?: string
  createdAt: number
  reviewedAt?: number
}

interface Database {
  users: User[]
  bots: Bot[]
  vpatBots: VPATBot[]
  vpatSubmissions: VPATSubmission[]
  transcriptBots: TranscriptBot[]
  transcriptEvaluations: TranscriptEvaluation[]
  transcriptFlags: TranscriptFlag[]
  queryCache: QueryCache[]
}

class DatabaseService {
  private db: Low<Database> | null = null
  private initPromise: Promise<void> | null = null

  async init() {
    if (this.db) return
    
    if (this.initPromise) {
      await this.initPromise
      return
    }

    this.initPromise = (async () => {
      const adapter = new JSONFile<Database>(DB_PATH)
      this.db = new Low(adapter, { users: [], bots: [], vpatBots: [], vpatSubmissions: [], transcriptBots: [], transcriptEvaluations: [], transcriptFlags: [], queryCache: [] })
      await this.db.read()
      
      if (!this.db.data) {
        this.db.data = { users: [], bots: [], vpatBots: [], vpatSubmissions: [], transcriptBots: [], transcriptEvaluations: [], transcriptFlags: [], queryCache: [] }
        await this.db.write()
      } else {
        // Ensure new arrays exist for backward compatibility
        if (!this.db.data.vpatBots) {
          this.db.data.vpatBots = []
        }
        if (!this.db.data.vpatSubmissions) {
          this.db.data.vpatSubmissions = []
        }
        if (!this.db.data.transcriptBots) {
          this.db.data.transcriptBots = []
        }
        if (!this.db.data.transcriptEvaluations) {
          this.db.data.transcriptEvaluations = []
        }
        if (!this.db.data.transcriptFlags) {
          this.db.data.transcriptFlags = []
        }
        await this.db.write()
      }
    })()

    await this.initPromise
  }

  async getDb() {
    await this.init()
    return this.db!
  }

  // User methods
  async createUser(email: string, password: string, name: string, role: 'user' | 'admin' = 'user'): Promise<User> {
    const db = await this.getDb()
    const user: User = {
      id: uuidv4(),
      email,
      password,
      name,
      role,
      createdAt: Date.now(),
    }
    db.data.users.push(user)
    await db.write()
    return user
  }

  async findUserByEmail(email: string): Promise<User | undefined> {
    const db = await this.getDb()
    return db.data.users.find(u => u.email === email)
  }

  async findUserById(id: string): Promise<User | undefined> {
    const db = await this.getDb()
    return db.data.users.find(u => u.id === id)
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const db = await this.getDb()
    const index = db.data.users.findIndex(u => u.id === id)
    if (index === -1) return null
    
    db.data.users[index] = { ...db.data.users[index], ...updates }
    await db.write()
    return db.data.users[index]
  }

  // Bot methods
  async createBot(userId: string, name: string, dbType: string, dbConfig: any): Promise<Bot> {
    const db = await this.getDb()
    const bot: Bot = {
      id: uuidv4(),
      userId,
      name,
      dbType,
      dbConfig,
      isConnected: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    db.data.bots.push(bot)
    await db.write()
    return bot
  }

  async findBotsByUserId(userId: string): Promise<Bot[]> {
    const db = await this.getDb()
    return db.data.bots.filter(b => b.userId === userId)
  }

  async findBotById(id: string): Promise<Bot | undefined> {
    const db = await this.getDb()
    return db.data.bots.find(b => b.id === id)
  }

  async updateBot(id: string, updates: Partial<Bot>): Promise<Bot | null> {
    const db = await this.getDb()
    const index = db.data.bots.findIndex(b => b.id === id)
    if (index === -1) return null
    
    db.data.bots[index] = { ...db.data.bots[index], ...updates, updatedAt: Date.now() }
    await db.write()
    return db.data.bots[index]
  }

  async deleteBot(id: string): Promise<boolean> {
    const db = await this.getDb()
    const index = db.data.bots.findIndex(b => b.id === id)
    if (index === -1) return false
    
    db.data.bots.splice(index, 1)
    await db.write()
    return true
  }

  // Query cache methods
  async createQueryCache(botId: string, queryHash: string, response: string, metadata?: any, ttl: number = 3600): Promise<QueryCache> {
    const db = await this.getDb()
    const cache: QueryCache = {
      id: uuidv4(),
      botId,
      queryHash,
      response,
      metadata,
      expiresAt: Date.now() + (ttl * 1000),
      createdAt: Date.now(),
    }
    db.data.queryCache.push(cache)
    await db.write()
    return cache
  }

  async findQueryCache(botId: string, queryHash: string): Promise<QueryCache | undefined> {
    const db = await this.getDb()
    const now = Date.now()
    return db.data.queryCache.find(c => c.botId === botId && c.queryHash === queryHash && c.expiresAt > now)
  }

  async cleanExpiredCache(): Promise<void> {
    const db = await this.getDb()
    const now = Date.now()
    db.data.queryCache = db.data.queryCache.filter(c => c.expiresAt > now)
    await db.write()
  }

  // VPAT Bot methods
  async createVPATBot(userId: string, name: string, referenceScorecard: VPATBot['referenceScorecard'], config: VPATBot['config']): Promise<VPATBot> {
    const db = await this.getDb()
    const shareableLink = uuidv4().substring(0, 8)
    const vpatBot: VPATBot = {
      id: uuidv4(),
      userId,
      name,
      botType: 'vpat',
      referenceScorecard,
      config,
      shareableLink,
      isActive: true,
      processedCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    db.data.vpatBots.push(vpatBot)
    await db.write()
    return vpatBot
  }

  async findVPATBotsByUserId(userId: string): Promise<VPATBot[]> {
    const db = await this.getDb()
    return db.data.vpatBots.filter(b => b.userId === userId)
  }

  async findVPATBotById(id: string): Promise<VPATBot | undefined> {
    const db = await this.getDb()
    return db.data.vpatBots.find(b => b.id === id)
  }

  async findVPATBotByShareableLink(link: string): Promise<VPATBot | undefined> {
    const db = await this.getDb()
    return db.data.vpatBots.find(b => b.shareableLink === link && b.isActive)
  }

  async updateVPATBot(id: string, updates: Partial<VPATBot>): Promise<VPATBot | null> {
    const db = await this.getDb()
    const index = db.data.vpatBots.findIndex(b => b.id === id)
    if (index === -1) return null
    
    db.data.vpatBots[index] = { ...db.data.vpatBots[index], ...updates, updatedAt: Date.now() }
    await db.write()
    return db.data.vpatBots[index]
  }

  async deleteVPATBot(id: string): Promise<boolean> {
    const db = await this.getDb()
    const index = db.data.vpatBots.findIndex(b => b.id === id)
    if (index === -1) return false
    
    db.data.vpatBots.splice(index, 1)
    await db.write()
    return true
  }

  // VPAT Submission methods
  async createVPATSubmission(vpatBotId: string, submittedDocument: VPATSubmission['submittedDocument'], batchId?: string, batchIndex?: number): Promise<VPATSubmission> {
    const db = await this.getDb()
    const submission: VPATSubmission = {
      id: uuidv4(),
      vpatBotId,
      batchId,
      batchIndex,
      submittedDocument,
      status: 'pending',
      processingLog: [{
        timestamp: Date.now(),
        step: 'submission_received',
        status: 'success',
        details: 'Document uploaded successfully'
      }],
      createdAt: Date.now(),
    }
    db.data.vpatSubmissions.push(submission)
    await db.write()
    return submission
  }

  async createVPATBatch(vpatBotId: string, submittedDocuments: VPATSubmission['submittedDocument'][]): Promise<{batchId: string, submissions: VPATSubmission[]}> {
    const batchId = uuidv4()
    const submissions: VPATSubmission[] = []
    
    for (let i = 0; i < submittedDocuments.length; i++) {
      const submission = await this.createVPATSubmission(vpatBotId, submittedDocuments[i], batchId, i)
      submissions.push(submission)
    }
    
    return { batchId, submissions }
  }

  async findVPATSubmissionsByBatchId(batchId: string): Promise<VPATSubmission[]> {
    const db = await this.getDb()
    return db.data.vpatSubmissions
      .filter(s => s.batchId === batchId)
      .sort((a, b) => (a.batchIndex || 0) - (b.batchIndex || 0))
  }

  async findVPATSubmissionsByBotId(vpatBotId: string): Promise<VPATSubmission[]> {
    const db = await this.getDb()
    return db.data.vpatSubmissions.filter(s => s.vpatBotId === vpatBotId)
  }

  async findVPATSubmissionById(id: string): Promise<VPATSubmission | undefined> {
    const db = await this.getDb()
    return db.data.vpatSubmissions.find(s => s.id === id)
  }

  async updateVPATSubmission(id: string, updates: Partial<VPATSubmission>): Promise<VPATSubmission | null> {
    const db = await this.getDb()
    const index = db.data.vpatSubmissions.findIndex(s => s.id === id)
    if (index === -1) return null
    
    db.data.vpatSubmissions[index] = { ...db.data.vpatSubmissions[index], ...updates }
    await db.write()
    return db.data.vpatSubmissions[index]
  }

  async addProcessingLog(submissionId: string, step: string, status: string, details?: string): Promise<void> {
    const db = await this.getDb()
    const index = db.data.vpatSubmissions.findIndex(s => s.id === submissionId)
    if (index === -1) return
    
    db.data.vpatSubmissions[index].processingLog.push({
      timestamp: Date.now(),
      step,
      status,
      details
    })
    await db.write()
  }

  // TranscriptBot methods
  async createTranscriptBot(userId: string, name: string, degreePlans: TranscriptBot['degreePlans']): Promise<TranscriptBot> {
    const db = await this.getDb()
    const shareableLink = uuidv4().substring(0, 8)
    const transcriptBot: TranscriptBot = {
      id: uuidv4(),
      userId,
      name,
      botType: 'transcript',
      degreePlans,
      shareableLink,
      isActive: true,
      evaluationCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    db.data.transcriptBots.push(transcriptBot)
    await db.write()
    return transcriptBot
  }

  async findTranscriptBotsByUserId(userId: string): Promise<TranscriptBot[]> {
    const db = await this.getDb()
    return db.data.transcriptBots.filter(b => b.userId === userId)
  }

  async findTranscriptBotById(id: string): Promise<TranscriptBot | undefined> {
    const db = await this.getDb()
    return db.data.transcriptBots.find(b => b.id === id)
  }

  async findTranscriptBotByShareableLink(link: string): Promise<TranscriptBot | undefined> {
    const db = await this.getDb()
    return db.data.transcriptBots.find(b => b.shareableLink === link && b.isActive)
  }

  async updateTranscriptBot(id: string, updates: Partial<TranscriptBot>): Promise<TranscriptBot | null> {
    const db = await this.getDb()
    const index = db.data.transcriptBots.findIndex(b => b.id === id)
    if (index === -1) return null
    
    // Handle updates with programs array (from Step 2 UI edits)
    if (updates.degreePlans && 'programs' in updates.degreePlans) {
      const currentBot = db.data.transcriptBots[index]
      db.data.transcriptBots[index] = {
        ...currentBot,
        degreePlans: {
          ...currentBot.degreePlans,
          parsedData: {
            programs: (updates.degreePlans as any).programs
          }
        },
        updatedAt: Date.now()
      }
    } else {
      db.data.transcriptBots[index] = { 
        ...db.data.transcriptBots[index], 
        ...updates, 
        updatedAt: Date.now() 
      }
    }
    
    await db.write()
    return db.data.transcriptBots[index]
  }

  async deleteTranscriptBot(id: string): Promise<boolean> {
    const db = await this.getDb()
    const index = db.data.transcriptBots.findIndex(b => b.id === id)
    if (index === -1) return false
    
    db.data.transcriptBots.splice(index, 1)
    await db.write()
    return true
  }

  // TranscriptEvaluation methods
  async createTranscriptEvaluation(
    transcriptBotId: string,
    programName: string,
    studentTranscripts: TranscriptEvaluation['studentTranscripts'],
    batchId?: string,
    batchIndex?: number
  ): Promise<TranscriptEvaluation> {
    const db = await this.getDb()
    const evaluation: TranscriptEvaluation = {
      id: uuidv4(),
      transcriptBotId,
      batchId,
      batchIndex,
      programName,
      studentTranscripts,
      status: 'pending',
      processingLog: [{
        timestamp: Date.now(),
        step: 'evaluation_created',
        status: 'success',
        details: 'Transcript evaluation initiated'
      }],
      createdAt: Date.now(),
    }
    db.data.transcriptEvaluations.push(evaluation)
    await db.write()
    return evaluation
  }

  async createTranscriptEvaluationBatch(
    transcriptBotId: string,
    programName: string,
    studentTranscriptsList: TranscriptEvaluation['studentTranscripts'][]
  ): Promise<{batchId: string, evaluations: TranscriptEvaluation[]}> {
    const batchId = uuidv4()
    const evaluations: TranscriptEvaluation[] = []
    
    for (let i = 0; i < studentTranscriptsList.length; i++) {
      const evaluation = await this.createTranscriptEvaluation(
        transcriptBotId,
        programName,
        studentTranscriptsList[i],
        batchId,
        i
      )
      evaluations.push(evaluation)
    }
    
    return { batchId, evaluations }
  }

  async findTranscriptEvaluationsByBatchId(batchId: string): Promise<TranscriptEvaluation[]> {
    const db = await this.getDb()
    return db.data.transcriptEvaluations
      .filter(e => e.batchId === batchId)
      .sort((a, b) => (a.batchIndex || 0) - (b.batchIndex || 0))
  }

  async findTranscriptEvaluationsByBotId(transcriptBotId: string): Promise<TranscriptEvaluation[]> {
    const db = await this.getDb()
    return db.data.transcriptEvaluations.filter(e => e.transcriptBotId === transcriptBotId)
  }

  async findTranscriptEvaluationById(id: string): Promise<TranscriptEvaluation | undefined> {
    const db = await this.getDb()
    return db.data.transcriptEvaluations.find(e => e.id === id)
  }

  async updateTranscriptEvaluation(id: string, updates: Partial<TranscriptEvaluation>): Promise<TranscriptEvaluation | null> {
    const db = await this.getDb()
    const index = db.data.transcriptEvaluations.findIndex(e => e.id === id)
    if (index === -1) return null
    
    db.data.transcriptEvaluations[index] = { ...db.data.transcriptEvaluations[index], ...updates }
    await db.write()
    return db.data.transcriptEvaluations[index]
  }

  async addTranscriptProcessingLog(evaluationId: string, step: string, status: string, details?: string): Promise<void> {
    const db = await this.getDb()
    const index = db.data.transcriptEvaluations.findIndex(e => e.id === evaluationId)
    if (index === -1) return
    
    db.data.transcriptEvaluations[index].processingLog.push({
      timestamp: Date.now(),
      step,
      status,
      details
    })
    await db.write()
  }

  // TranscriptFlag methods
  async createTranscriptFlag(
    transcriptBotId: string,
    userId: string,
    flagType: TranscriptFlag['flagType'],
    itemType: TranscriptFlag['itemType'],
    description: string,
    originalValue?: string,
    editedValue?: string,
    itemId?: string
  ): Promise<TranscriptFlag> {
    const db = await this.getDb()
    const flag: TranscriptFlag = {
      id: uuidv4(),
      transcriptBotId,
      userId,
      flagType,
      itemType,
      itemId,
      description,
      originalValue,
      editedValue,
      status: 'pending',
      createdAt: Date.now(),
    }
    db.data.transcriptFlags.push(flag)
    await db.write()
    return flag
  }

  async findTranscriptFlagsByBotId(transcriptBotId: string): Promise<TranscriptFlag[]> {
    const db = await this.getDb()
    return db.data.transcriptFlags.filter(f => f.transcriptBotId === transcriptBotId)
  }

  async findTranscriptFlagById(id: string): Promise<TranscriptFlag | undefined> {
    const db = await this.getDb()
    return db.data.transcriptFlags.find(f => f.id === id)
  }

  async updateTranscriptFlag(id: string, updates: Partial<TranscriptFlag>): Promise<TranscriptFlag | null> {
    const db = await this.getDb()
    const index = db.data.transcriptFlags.findIndex(f => f.id === id)
    if (index === -1) return null
    
    db.data.transcriptFlags[index] = { ...db.data.transcriptFlags[index], ...updates }
    await db.write()
    return db.data.transcriptFlags[index]
  }

  async deleteTranscriptFlag(id: string): Promise<boolean> {
    const db = await this.getDb()
    const index = db.data.transcriptFlags.findIndex(f => f.id === id)
    if (index === -1) return false
    
    db.data.transcriptFlags.splice(index, 1)
    await db.write()
    return true
  }
}

export const dbService = new DatabaseService()
export type { User, Bot, VPATBot, VPATSubmission, TranscriptBot, TranscriptEvaluation, TranscriptFlag, QueryCache }
