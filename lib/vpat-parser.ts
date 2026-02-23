import { OpenAI } from 'openai'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface VPATMetadata {
  vpatVersion?: string
  productName?: string
  vendorName?: string
  reportDate?: string
  wcagVersion?: string
  wcagLevel?: string
  productDescription?: string
  contactInfo?: string
}

export interface PlatformVersion {
  platform: string
  conformanceLevel: 'Supports' | 'Partially Supports' | 'Does Not Support' | 'Not Applicable' | 'Not Evaluated'
  scorecardEquivalent: 'Supports' | 'Partially Supports' | 'Does Not Support' | 'Not Applicable'
  remarks?: string
  pageNumber?: number
  excerpt?: string
  confidence?: number
}

export interface WCAGCriterion {
  criterionId: string
  criterionName: string
  level: string
  conformanceLevel: 'Supports' | 'Partially Supports' | 'Does Not Support' | 'Not Applicable' | 'Not Evaluated'
  scorecardEquivalent: 'Supports' | 'Partially Supports' | 'Does Not Support' | 'Not Applicable'
  remarks?: string
  pageNumber?: number
  excerpt?: string
  confidence?: number
  platformVersions?: PlatformVersion[]
  hasPlatformVariations?: boolean
}

export interface ValidationResult {
  isValid: boolean
  vpatVersionValid: boolean
  dateValid: boolean
  productNameValid: boolean
  wcagLevelValid: boolean
  errors: string[]
  warnings: string[]
  missingFields: string[]
}

export class VPATDocumentParser {
  
  async parseDocument(buffer: Buffer, fileType: string): Promise<string> {
    try {
      switch (fileType.toLowerCase()) {
        case 'pdf':
          return await this.parsePDF(buffer)
        case 'doc':
        case 'docx':
          return await this.parseDOCX(buffer)
        case 'xlsx':
        case 'xls':
          return await this.parseExcel(buffer)
        case 'csv':
          return await this.parseCSV(buffer)
        case 'json':
          return await this.parseJSON(buffer)
        case 'txt':
          return buffer.toString('utf-8')
        default:
          throw new Error(`Unsupported file type: ${fileType}`)
      }
    } catch (error) {
      throw new Error(`Failed to parse document: ${(error as Error).message}`)
    }
  }

  private async parsePDF(buffer: Buffer): Promise<string> {
    try {
      const PDFParser = require('pdf2json')
      
      return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser()
        
        pdfParser.on('pdfParser_dataError', (errData: any) => {
          reject(new Error(errData.parserError))
        })
        
        pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
          try {
            let text = ''
            if (pdfData.Pages) {
              pdfData.Pages.forEach((page: any, pageIndex: number) => {
                text += `\n--- PAGE ${pageIndex + 1} ---\n`
                if (page.Texts) {
                  page.Texts.forEach((textItem: any) => {
                    if (textItem.R) {
                      textItem.R.forEach((r: any) => {
                        if (r.T) {
                          try {
                            text += decodeURIComponent(r.T) + ' '
                          } catch (e) {
                            text += r.T + ' '
                          }
                        }
                      })
                    }
                  })
                  text += '\n'
                }
              })
            }
            resolve(text)
          } catch (err) {
            reject(err)
          }
        })
        
        pdfParser.parseBuffer(buffer)
      })
    } catch (error) {
      throw new Error(`PDF parsing failed: ${(error as Error).message}`)
    }
  }

  async parsePDFWithPages(buffer: Buffer): Promise<{ text: string; pages: string[] }> {
    try {
      const PDFParser = require('pdf2json')
      
      return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser()
        
        pdfParser.on('pdfParser_dataError', (errData: any) => {
          reject(new Error(errData.parserError))
        })
        
        pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
          try {
            let fullText = ''
            const pages: string[] = []
            
            if (pdfData.Pages) {
              pdfData.Pages.forEach((page: any, pageIndex: number) => {
                let pageText = ''
                if (page.Texts) {
                  page.Texts.forEach((textItem: any) => {
                    if (textItem.R) {
                      textItem.R.forEach((r: any) => {
                        if (r.T) {
                          try {
                            pageText += decodeURIComponent(r.T) + ' '
                          } catch (e) {
                            pageText += r.T + ' '
                          }
                        }
                      })
                    }
                  })
                }
                pages.push(pageText)
                fullText += `\n--- PAGE ${pageIndex + 1} ---\n${pageText}\n`
              })
            }
            resolve({ text: fullText, pages })
          } catch (err) {
            reject(err)
          }
        })
        
        pdfParser.parseBuffer(buffer)
      })
    } catch (error) {
      throw new Error(`PDF parsing with pages failed: ${(error as Error).message}`)
    }
  }

  private async parseDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    } catch (error) {
      throw new Error(`DOCX parsing failed: ${(error as Error).message}`)
    }
  }

  private async parseExcel(buffer: Buffer): Promise<string> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      let fullText = ''

      workbook.SheetNames.forEach((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        fullText += `\n=== Sheet: ${sheetName} ===\n${csv}\n`
      })

      return fullText
    } catch (error) {
      throw new Error(`Excel parsing failed: ${(error as Error).message}`)
    }
  }

  private async parseCSV(buffer: Buffer): Promise<string> {
    return buffer.toString('utf-8')
  }

  private async parseJSON(buffer: Buffer): Promise<string> {
    try {
      const json = JSON.parse(buffer.toString('utf-8'))
      return JSON.stringify(json, null, 2)
    } catch (error) {
      throw new Error(`JSON parsing failed: ${(error as Error).message}`)
    }
  }

  async extractVPATData(documentText: string, method: 'method1' | 'dynamic' = 'method1', scorecardCriteria?: string[], platformName?: string): Promise<{
    metadata: VPATMetadata
    criteria: WCAGCriterion[]
  }> {
    if (platformName) {
      return this.extractVPATDataForPlatform(documentText, scorecardCriteria || [], platformName)
    }
    if (method === 'dynamic') {
      return this.extractVPATDataMethod2(documentText, scorecardCriteria)
    }
    return this.extractVPATDataMethod1(documentText, scorecardCriteria)
  }

  private async extractVPATDataForPlatform(documentText: string, scorecardCriteria: string[], platformName: string): Promise<{
    metadata: VPATMetadata
    criteria: WCAGCriterion[]
  }> {
    console.log(`🎯 [PLATFORM EXTRACTION] Extracting data ONLY for platform: ${platformName}`)
    
    const prompt = `Extract VPAT data from this document, focusing EXCLUSIVELY on the "${platformName}" platform.

${documentText}

CRITICAL INSTRUCTIONS:
1. This VPAT document contains information for MULTIPLE platforms (Web, Desktop, Mobile, Electronic Docs, Software, Authoring Tool, etc.)
2. You MUST extract conformance levels ONLY for the "${platformName}" platform
3. IGNORE all other platforms - if a criterion shows "Web: Supports, Desktop: Does Not Support", and you're extracting for Desktop, return ONLY "Does Not Support"
4. Look for platform-specific sections, tables, or remarks that distinguish between platforms
5. Extract ALL ${scorecardCriteria.length} criteria listed below

WCAG CRITERIA TO ANALYZE (${scorecardCriteria.length} total):
${scorecardCriteria.map(id => `${id}: Extract conformance for ${platformName} ONLY`).join('\n')}

For EACH criterion, provide:
- criterionId (exact match from list above)
- criterionName (standard WCAG name)
- level (A, AA, or AAA)
- conformanceLevel (for ${platformName} ONLY: "Supports"|"Partially Supports"|"Does Not Support"|"Not Applicable"|"Not Evaluated")
- pageNumber (integer from PAGE markers)
- excerpt (20-50 word verbatim text showing ${platformName} conformance)
- remarks (2-4 sentences explaining ${platformName} conformance level)
- confidence (0-100)

EXAMPLES:
- If document says "Web: Supports, Desktop: Does Not Support" and platform is "Desktop", return conformanceLevel: "Does Not Support"
- If document says "Electronic Docs: Not Applicable" and platform is "Electronic Docs", return conformanceLevel: "Not Applicable"
- If no ${platformName}-specific info found, mark as "Not Evaluated"

Return JSON with ALL ${scorecardCriteria.length} criteria for ${platformName}:
{
  "metadata": {
    "vpatVersion": "...",
    "productName": "... (${platformName})",
    "vendorName": "...",
    "reportDate": "...",
    "wcagVersion": "...",
    "wcagLevel": "...",
    "platformVersion": "${platformName}"
  },
  "criteria": [{"criterionId": "1.1.1", "criterionName": "Non-text Content", "level": "A", "conformanceLevel": "Supports", "pageNumber": 5, "excerpt": "exact text for ${platformName}", "remarks": "reasoning for ${platformName}", "confidence": 95}]
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: `CRITICAL: You are extracting VPAT data for the "${platformName}" platform ONLY. 
          - IGNORE all other platforms completely
          - Return exactly ${scorecardCriteria.length} criteria for ${platformName}
          - If a criterion shows different conformance for different platforms, extract ONLY the ${platformName} value
          - If no ${platformName} info exists, mark as "Not Evaluated"
          Return only valid JSON.` 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    
    console.log(`📊 [PLATFORM EXTRACTION] ${platformName} returned ${result.criteria?.length || 0} criteria, expected ${scorecardCriteria.length}`)
    
    // Validate and add missing criteria
    if (scorecardCriteria && result.criteria) {
      const extractedIds = new Set(result.criteria.map((c: any) => c.criterionId))
      const missingIds = scorecardCriteria.filter(id => !extractedIds.has(id))
      
      if (missingIds.length > 0) {
        console.warn(`⚠️ [PLATFORM EXTRACTION] ${platformName} missing ${missingIds.length} criteria:`, missingIds)
        
        // Add missing criteria as "Not Evaluated"
        missingIds.forEach(id => {
          result.criteria.push({
            criterionId: id,
            criterionName: `WCAG ${id}`,
            level: 'A',
            conformanceLevel: 'Not Evaluated',
            scorecardEquivalent: 'Does Not Support',
            remarks: `No ${platformName}-specific information found in VPAT`,
            confidence: 50
          })
        })
      }
    }
    
    const criteria: WCAGCriterion[] = (result.criteria || []).map((c: any) => ({
      ...c,
      scorecardEquivalent: this.mapToScorecardEquivalent(c.conformanceLevel),
      pageNumber: c.pageNumber || undefined,
      excerpt: c.excerpt || undefined,
      confidence: c.confidence || undefined
    }))

    return {
      metadata: {
        ...result.metadata,
        platformVersion: platformName
      },
      criteria
    }
  }

  private async extractVPATDataMethod1(documentText: string, scorecardCriteria?: string[]): Promise<{
    metadata: VPATMetadata
    criteria: WCAGCriterion[]
  }> {
    const criteriaList = scorecardCriteria && scorecardCriteria.length > 0 
      ? `\n\nWCAG CRITERIA TO EXTRACT (${scorecardCriteria.length} total):\n${scorecardCriteria.join(', ')}\n\nYou MUST extract ALL ${scorecardCriteria.length} criteria listed above.`
      : '\n\nExtract ALL WCAG criteria found in the document.'
    
    const prompt = `Extract VPAT data from this document:

${documentText.substring(0, 30000)}

Extract:
1. Metadata: vpatVersion, productName, vendorName, reportDate, wcagVersion, wcagLevel, productDescription, contactInfo
2. WCAG criteria with: 
   - criterionId
   - criterionName
   - level
   - conformanceLevel ("Supports"|"Partially Supports"|"Does Not Support"|"Not Applicable"|"Not Evaluated")
   - pageNumber (integer, derived from the PAGE markers in the text, e.g. "--- PAGE 5 ---" -> 5)
   - excerpt (20-50 word relevant text snippet copied verbatim from the page that supports your conclusion)
   - remarks (2-4 sentence reasoning that explains exactly WHY you chose that conformanceLevel for this criterion, explicitly referencing the excerpt and pageNumber)
${criteriaList}

Return JSON:
{
  "metadata": {"vpatVersion": "string or null", "productName": "string or null", "vendorName": "string or null", "reportDate": "string or null", "wcagVersion": "string or null", "wcagLevel": "string or null", "productDescription": "string or null", "contactInfo": "string or null"},
  "criteria": [{"criterionId": "1.1.1", "criterionName": "Non-text Content", "level": "A", "conformanceLevel": "Supports", "pageNumber": 5, "excerpt": "exact text from PDF on page 5", "remarks": "2-4 sentence reasoning explaining why the excerpt on page 5 supports this conformance level", "confidence": 95}]
}`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Extract VPAT data precisely. For EACH WCAG criterion, you MUST include: an exact pageNumber derived from PAGE markers, a verbatim excerpt from that page, and a short but concrete reasoning explanation in the remarks field that justifies the chosen conformance level based on that excerpt. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      })

      const result = JSON.parse(response.choices[0].message.content || '{}')
      
      const criteria: WCAGCriterion[] = (result.criteria || []).map((c: any) => ({
        ...c,
        scorecardEquivalent: this.mapToScorecardEquivalent(c.conformanceLevel),
        pageNumber: c.pageNumber || undefined,
        excerpt: c.excerpt || undefined,
        confidence: c.confidence || undefined
      }))

      return {
        metadata: result.metadata || {},
        criteria
      }
    } catch (error) {
      throw new Error(`AI extraction failed: ${(error as Error).message}`)
    }
  }

  private async extractVPATDataMethod2(documentText: string, scorecardCriteria?: string[]): Promise<{
    metadata: VPATMetadata
    criteria: WCAGCriterion[]
  }> {

    const prompt = `Extract VPAT data from this document:

${documentText}

CRITICAL REQUIREMENTS:
1. Extract metadata fields
2. FOR EVERY SINGLE WCAG criterion listed below, you MUST extract data:
   - If criterion is explicitly mentioned: extract its conformance level, page, excerpt, remarks
   - If criterion is NOT mentioned: mark as "Not Evaluated" with explanation
   - DO NOT skip any criteria - you must return data for ALL ${scorecardCriteria?.length || 0} criteria

WCAG CRITERIA TO ANALYZE (${scorecardCriteria?.length || 0} total):
${scorecardCriteria?.map(id => `${id}: MUST BE INCLUDED`).join('\n') || 'Auto-detect from document'}

For each criterion, provide:
- criterionId (exact match from list above)
- criterionName (standard WCAG name)
- level (A, AA, or AAA)
- conformanceLevel ("Supports"|"Partially Supports"|"Does Not Support"|"Not Applicable"|"Not Evaluated")
- pageNumber (integer from PAGE markers like "--- PAGE 5 ---")
- excerpt (20-50 word verbatim text from that page)
- remarks (2-4 sentence reasoning explaining conformance level)
- confidence (0-100)

Return JSON with ALL criteria:
{
  "metadata": {...},
  "criteria": [{"criterionId": "1.1.1", "criterionName": "Non-text Content", "level": "A", "conformanceLevel": "Supports", "pageNumber": 5, "excerpt": "exact text", "remarks": "reasoning", "confidence": 95}]
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: `CRITICAL: You MUST extract data for EVERY SINGLE WCAG criterion provided. 
          - Return exactly ${scorecardCriteria?.length || 0} criteria - no more, no less
          - If a criterion is not mentioned in the document, you MUST still include it as "Not Evaluated"
          - DO NOT skip any criteria under any circumstances
          - Double-check that your response contains ALL criteria before returning
          Return only valid JSON.` 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    
    console.log(`📊 [EXTRACTION] AI returned ${result.criteria?.length || 0} criteria, expected ${scorecardCriteria?.length || 0}`)
    
    // Validate that we got the expected number of criteria
    if (scorecardCriteria && result.criteria) {
      const extractedIds = new Set(result.criteria.map((c: any) => c.criterionId))
      const missingIds = scorecardCriteria.filter(id => !extractedIds.has(id))
      
      if (missingIds.length > 0) {
        console.warn(`⚠️ [EXTRACTION] Missing ${missingIds.length} criteria:`, missingIds)
        console.log(`🔍 [EXTRACTION] Attempting to extract missing criteria in second pass...`)
        
        // Second pass: Extract only the missing criteria with more focused prompt
        const missingPrompt = `From this VPAT document, extract ONLY these specific missing WCAG criteria:

${documentText}

MISSING CRITERIA TO FIND (${missingIds.length} total):
${missingIds.join(', ')}

For EACH criterion above, you MUST return:
- criterionId (exact match from list)
- criterionName
- level (A, AA, or AAA)
- conformanceLevel
- pageNumber
- excerpt
- remarks
- confidence

If a criterion is truly not mentioned, mark it as "Not Evaluated" but you MUST still include it.

Return JSON with exactly ${missingIds.length} criteria:
{
  "criteria": [...]
}`

        try {
          const secondResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { 
                role: 'system', 
                content: `Extract the ${missingIds.length} missing WCAG criteria. Return exactly ${missingIds.length} criteria - one for each ID provided. Return only valid JSON.` 
              },
              { role: 'user', content: missingPrompt }
            ],
            temperature: 0,
            response_format: { type: 'json_object' }
          })
          
          const secondResult = JSON.parse(secondResponse.choices[0].message.content || '{}')
          
          if (secondResult.criteria && secondResult.criteria.length > 0) {
            console.log(`✅ [EXTRACTION] Second pass found ${secondResult.criteria.length} additional criteria`)
            result.criteria = [...result.criteria, ...secondResult.criteria]
          }
        } catch (secondPassError) {
          console.error(`❌ [EXTRACTION] Second pass failed:`, secondPassError)
        }
      }
    }
    
    // Final validation
    const expectedCount = scorecardCriteria?.length || 0
    const actualCount = result.criteria?.length || 0
    
    if (actualCount !== expectedCount) {
      console.warn(`⚠️ Expected ${expectedCount} criteria but got ${actualCount}. AI may have missed some criteria.`)
      
      // If we got fewer than expected, add missing ones as "Not Evaluated"
      if (actualCount < expectedCount && scorecardCriteria) {
        const extractedIds = new Set(result.criteria?.map((c: any) => c.criterionId) || [])
        const missingIds = scorecardCriteria.filter(id => !extractedIds.has(id))
        
        const missingCriteria = missingIds.map(id => ({
          criterionId: id,
          criterionName: `Criterion ${id}`,
          level: 'A',
          conformanceLevel: 'Not Evaluated' as const,
          remarks: 'Criterion not found in document - AI extraction missed this',
          confidence: 0
        }))
        
        result.criteria = [...(result.criteria || []), ...missingCriteria]
        console.log(`🔧 Added ${missingCriteria.length} missing criteria as "Not Evaluated"`)
      }
    }
    
    const criteria: WCAGCriterion[] = (result.criteria || []).map((c: any) => ({
      criterionId: c.criterionId,
      criterionName: c.criterionName,
      level: c.level,
      conformanceLevel: c.conformanceLevel,
      scorecardEquivalent: this.mapToScorecardEquivalent(c.conformanceLevel),
      remarks: c.remarks || '',
      pageNumber: c.pageNumber || undefined,
      excerpt: c.excerpt || undefined,
      confidence: c.confidence || undefined
    }))

    return {
      metadata: result.metadata || {},
      criteria
    }
  }

  private mapToScorecardEquivalent(conformanceLevel: string): 'Supports' | 'Partially Supports' | 'Does Not Support' | 'Not Applicable' {
    if (conformanceLevel === 'Not Applicable') return 'Not Applicable'
    if (conformanceLevel === 'Not Evaluated') return 'Does Not Support'
    if (conformanceLevel === 'Supports') return 'Supports'
    if (conformanceLevel === 'Partially Supports') return 'Partially Supports'
    return 'Does Not Support'
  }

  validateVPAT(metadata: VPATMetadata, requiredVersion?: string, requiredWCAGLevel?: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const missingFields: string[] = []

    let vpatVersionValid = false
    let dateValid = false
    let productNameValid = false
    let wcagLevelValid = false

    if (!metadata.vpatVersion) {
      missingFields.push('VPAT Version')
      errors.push('VPAT version not found in document')
    } else {
      const version = parseFloat(metadata.vpatVersion)
      const required = requiredVersion ? parseFloat(requiredVersion) : 2.5
      if (version >= required) {
        vpatVersionValid = true
      } else {
        errors.push(`VPAT version ${metadata.vpatVersion} is below required ${required}`)
      }
    }

    if (!metadata.reportDate) {
      missingFields.push('Report Date')
      errors.push('Report date not found in document')
    } else {
      if (metadata.reportDate.includes('2025')) {
        dateValid = true
      } else {
        errors.push(`Report date '${metadata.reportDate}' is not from 2025`)
      }
    }

    if (!metadata.productName) {
      missingFields.push('Product Name')
      errors.push('Product name not found in document')
    } else if (metadata.productName.length > 3) {
      productNameValid = true
    } else {
      warnings.push(`Product name seems too short: '${metadata.productName}'`)
    }

    if (!metadata.wcagVersion || !metadata.wcagLevel) {
      if (!metadata.wcagVersion) missingFields.push('WCAG Version')
      if (!metadata.wcagLevel) missingFields.push('WCAG Level')
      errors.push('WCAG version or level not found in document')
    } else {
      const wcagVer = parseFloat(metadata.wcagVersion)
      const requiredLevel = requiredWCAGLevel || 'AA'
      
      // Accept WCAG 2.2 with "A and AA" format
      if (wcagVer >= 2.1 && (metadata.wcagLevel.includes('AA') || metadata.wcagLevel === 'AAA')) {
        wcagLevelValid = true
      } else if (wcagVer >= 2.1 && metadata.wcagLevel === 'A') {
        errors.push(`WCAG level is only 'A', but '${requiredLevel}' is required`)
      } else if (wcagVer < 2.1) {
        errors.push(`WCAG version ${metadata.wcagVersion} is below required 2.1`)
      } else {
        warnings.push(`WCAG level '${metadata.wcagLevel}' format is non-standard but accepted`)
        wcagLevelValid = true
      }
    }

    const isValid = vpatVersionValid && dateValid && productNameValid && wcagLevelValid

    return {
      isValid,
      vpatVersionValid,
      dateValid,
      productNameValid,
      wcagLevelValid,
      errors,
      warnings,
      missingFields
    }
  }

  async generateAIAnalysis(metadata: VPATMetadata, criteria: WCAGCriterion[], validationResult: ValidationResult): Promise<{
    summary: string
    confidence: number
    flaggedIssues: string[]
    recommendations: string[]
  }> {
    const nonSupporting = criteria.filter(c => c.scorecardEquivalent !== 'Supports')
    const prompt = `Analyze VPAT:
Product: ${metadata.productName}
Criteria: ${criteria.length} total, ${nonSupporting.length} issues
Errors: ${validationResult.errors.join(', ') || 'None'}
Top Issues: ${nonSupporting.slice(0, 10).map(c => `${c.criterionId}: ${c.conformanceLevel}`).join(', ')}

Return JSON: {"summary": "2-3 sentences", "confidence": 0-100, "flaggedIssues": ["strings"], "recommendations": ["strings"]}`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'VPAT compliance expert. Concise analysis.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })

      return JSON.parse(response.choices[0].message.content || '{}')
    } catch (error) {
      return {
        summary: 'AI analysis unavailable',
        confidence: 0,
        flaggedIssues: [],
        recommendations: []
      }
    }
  }
}

export const vpatParser = new VPATDocumentParser()
