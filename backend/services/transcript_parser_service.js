class TranscriptParserService {
  constructor() {
    this.openai = null;
  }

  _ensureInit() {
    if (!this.openai && typeof window === 'undefined') {
      const { OpenAI } = require('openai');
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        console.error('CRITICAL: OPENAI_API_KEY not found in environment variables');
        console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('OPENAI')));
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      
      console.log('Initializing OpenAI client with API key:', apiKey.substring(0, 10) + '...');
      this.openai = new OpenAI({
        apiKey: apiKey
      });
    }
  }

  /**
   * Parse student transcript from PDF, Excel, or DOCX
   * Extracts courses, grades, credits, and institution info
   */
  async parseTranscript(filePath, fileType) {
    this._ensureInit();
    try {
      console.log(`Parsing transcript: ${filePath}, type: ${fileType}`);
      let rawText = '';
      let structuredData = null;

      // Step 1: Extract raw data based on file type
      if (fileType === 'application/pdf' || filePath.endsWith('.pdf')) {
        rawText = await this.parsePDF(filePath);
      } else if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType === 'application/octet-stream' || filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
        const excelData = await this.parseExcel(filePath);
        rawText = excelData.text;
        structuredData = excelData.structured;
        console.log(`Extracted ${rawText.length} chars from Excel`);
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filePath.endsWith('.docx')) {
        rawText = await this.parseDOCX(filePath);
        console.log(`Extracted ${rawText.length} chars from DOCX`);
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }

      if (!rawText || rawText.length < 10) {
        throw new Error('No meaningful data extracted from file');
      }

      // Step 2: AI-powered extraction
      console.log('Starting AI extraction...');
      const extractedData = await this.extractTranscriptDataWithAI(rawText, structuredData);
      console.log(`AI extracted ${extractedData.courses?.length || 0} courses`);

      if (!extractedData || !extractedData.courses || extractedData.courses.length === 0) {
        throw new Error('AI extraction returned no courses - check OpenAI API key and model access');
      }

      // Step 3: LLM verification to ensure nothing is missed
      console.log('Starting LLM verification...');
      const verifiedData = await this.verifyExtractionWithAI(extractedData, rawText);

      return {
        success: true,
        institution: verifiedData.institution || extractedData.institution,
        studentName: verifiedData.studentName || extractedData.studentName,
        studentId: verifiedData.studentId || extractedData.studentId,
        courses: verifiedData.courses || extractedData.courses,
        totalCredits: verifiedData.totalCredits || extractedData.totalCredits,
        gpa: verifiedData.gpa || extractedData.gpa,
        verificationStatus: verifiedData.verificationStatus || 'verified',
        verificationNotes: verifiedData.verificationNotes || [],
        confidence: verifiedData.confidence || extractedData.confidence || 0.8
      };

    } catch (error) {
      console.error('Transcript parsing error:', error);
      return {
        success: false,
        error: error.message,
        verificationStatus: 'needs_review',
        courses: []
      };
    }
  }

  /**
   * Parse PDF transcript
   */
  async parsePDF(filePath) {
    const fs = require('fs').promises;
    let pdfParse = require('pdf-parse');
    
    // Handle default export for ES modules
    if (pdfParse.default) {
      pdfParse = pdfParse.default;
    }
    
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      return pdfData.text;
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse DOCX transcript
   */
  async parseDOCX(filePath) {
    const fs = require('fs').promises;
    const mammoth = require('mammoth');
    
    try {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(`DOCX parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse Excel transcript
   */
  async parseExcel(filePath) {
    const xlsx = require('xlsx');
    const fs = require('fs');
    try {
      // Read file as buffer to avoid file access issues
      const fileBuffer = fs.readFileSync(filePath);
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      let allText = '';
      const structuredData = [];

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        
        structuredData.push({
          sheetName,
          data: jsonData
        });

        // Convert to text for AI processing
        const sheetText = jsonData.map(row => row.join('\t')).join('\n');
        allText += `\n--- Sheet: ${sheetName} ---\n${sheetText}\n`;
      }

      return {
        text: allText,
        structured: structuredData
      };
    } catch (error) {
      throw new Error(`Excel parsing failed: ${error.message}`);
    }
  }

  /**
   * AI-powered extraction of transcript data
   */
  async extractTranscriptDataWithAI(rawText, structuredData = null) {
    try {
      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      console.log('Calling OpenAI API for transcript extraction...');
      const prompt = `
You are an expert academic transcript analyzer. Extract all course information from this student transcript.

TRANSCRIPT DATA:
${rawText}

${structuredData ? `\nSTRUCTURED DATA:\n${JSON.stringify(structuredData, null, 2)}` : ''}

Extract the following information with MAXIMUM ACCURACY:

1. Institution name
2. Student name (if available)
3. Student ID (if available)
4. ALL courses taken with:
   - Course code (e.g., "CS 1410", "MATH 2450")
   - Course name/title
   - Credits/credit hours
   - Grade received (letter grade or numeric)
   - Term/semester (if available)
   - Year (if available)

CRITICAL REQUIREMENTS:
- Extract EVERY course, do not skip any
- If a course code is unclear, include it with a note
- Preserve exact course codes and names
- Include transfer courses if present
- Note any courses in progress or incomplete

Respond with JSON:
{
  "institution": "University Name",
  "studentName": "Student Name or null",
  "studentId": "ID or null",
  "courses": [
    {
      "courseCode": "CS 1410",
      "courseName": "Introduction to Computer Science",
      "credits": 3,
      "grade": "A",
      "term": "Fall",
      "year": 2023,
      "notes": "Any special notes"
    }
  ],
  "totalCredits": 120,
  "gpa": 3.5,
  "confidence": 0.95,
  "uncertainties": ["List any unclear or ambiguous data"]
}

Be thorough and precise. If anything is unclear, note it in uncertainties.
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert academic transcript analyzer with perfect attention to detail. Extract ALL course information accurately."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      });

      console.log('OpenAI API call successful');
      const result = JSON.parse(response.choices[0].message.content);
      console.log(`Parsed result: ${result.courses?.length || 0} courses found`);
      return result;

    } catch (error) {
      console.error('AI extraction error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        response: error.response?.data
      });
      throw new Error(`AI extraction failed: ${error.message}`);
    }
  }

  /**
   * LLM verification to ensure nothing is missed
   */
  async verifyExtractionWithAI(extractedData, rawText) {
    try {
      const prompt = `
You are verifying a transcript extraction for completeness and accuracy.

ORIGINAL TRANSCRIPT:
${rawText.substring(0, 5000)}

EXTRACTED DATA:
${JSON.stringify(extractedData, null, 2)}

Your task:
1. Check if ALL courses from the transcript were extracted
2. Verify course codes, names, credits, and grades are correct
3. Identify any missing courses or data
4. Flag any inconsistencies

Respond with JSON:
{
  "isComplete": true/false,
  "missingCourses": ["List any courses found in transcript but not in extracted data"],
  "corrections": [
    {
      "field": "courseCode",
      "original": "CS1410",
      "corrected": "CS 1410",
      "reason": "Missing space"
    }
  ],
  "verificationStatus": "verified" or "needs_review",
  "verificationNotes": ["Any important notes"],
  "confidence": 0.95
}
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a meticulous verification expert. Check for completeness and accuracy."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      });

      const verification = JSON.parse(response.choices[0].message.content);

      // Apply corrections if any
      let finalData = { ...extractedData };
      
      if (verification.corrections && verification.corrections.length > 0) {
        // Apply corrections to courses
        finalData.courses = finalData.courses.map(course => {
          const correction = verification.corrections.find(c => 
            c.original === course[c.field]
          );
          if (correction) {
            return { ...course, [correction.field]: correction.corrected };
          }
          return course;
        });
      }

      // Add missing courses if any
      if (verification.missingCourses && verification.missingCourses.length > 0) {
        finalData.verificationStatus = 'needs_review';
        finalData.verificationNotes = [
          ...(finalData.verificationNotes || []),
          `Missing courses detected: ${verification.missingCourses.join(', ')}`
        ];
      } else {
        finalData.verificationStatus = verification.verificationStatus;
        finalData.verificationNotes = verification.verificationNotes;
      }

      finalData.confidence = Math.min(
        extractedData.confidence || 1,
        verification.confidence || 1
      );

      return finalData;

    } catch (error) {
      console.error('Verification error:', error);
      // Return original data with needs_review status
      return {
        ...extractedData,
        verificationStatus: 'needs_review',
        verificationNotes: [`Verification failed: ${error.message}`],
        confidence: (extractedData.confidence || 1) * 0.7
      };
    }
  }

  /**
   * Parse multiple transcripts in batch
   */
  async parseMultipleTranscripts(transcriptFiles) {
    const results = [];
    
    for (const file of transcriptFiles) {
      try {
        const result = await this.parseTranscript(file.path, file.type);
        results.push({
          fileName: file.name,
          ...result
        });
      } catch (error) {
        results.push({
          fileName: file.name,
          success: false,
          error: error.message,
          verificationStatus: 'needs_review'
        });
      }
    }

    return results;
  }
}

module.exports = TranscriptParserService;
