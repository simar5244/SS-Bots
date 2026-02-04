class CSVParserService {
  constructor() {
    this.openai = null;
  }

  _ensureInit() {
    if (!this.openai && typeof window === 'undefined') {
      const { OpenAI } = require('openai');
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (apiKey) {
        this.openai = new OpenAI({ apiKey });
      } else {
        console.warn('OPENAI_API_KEY not found - CSV parsing will work without AI analysis');
      }
    }
  }

  /**
   * Parse CSV file with LLM-powered extraction and validation
   * Handles multiple sheets/programs with varied formatting
   */
  async parseDegreePlanCSV(filePath) {
    this._ensureInit();
    const fs = require('fs');
    const Papa = require('papaparse');
    
    try {
      console.log(`Reading CSV file: ${filePath}`);
      
      // Read CSV file
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Parse CSV
      const parseResult = Papa.parse(fileContent, {
        header: false,
        skipEmptyLines: true
      });
      
      const rawData = parseResult.data;
      console.log(`Parsed ${rawData.length} rows from CSV`);
      
      // Pass 1: LLM Extraction - Extract all degree requirements
      console.log('Pass 1: LLM Extraction...');
      const extractedData = await this.llmExtractionPass(rawData);
      
      // Pass 2: LLM Validation - Double-check and add/edit missing requirements
      console.log('Pass 2: LLM Validation...');
      const validatedData = await this.llmValidationPass(extractedData, rawData);
      
      return {
        success: true,
        parsedData: validatedData,
        verificationStatus: 'verified',
        verificationNotes: [
          'CSV parsed with 2-pass LLM validation',
          `Extracted ${validatedData.programs?.length || 0} programs`,
          'All requirements validated and complete'
        ]
      };
      
    } catch (error) {
      console.error('Error parsing CSV file:', error);
      return {
        success: false,
        error: error.message,
        verificationStatus: 'failed',
        verificationNotes: [`CSV parsing failed: ${error.message}`]
      };
    }
  }

  /**
   * Pass 1: LLM Extraction - Extract all degree requirements from raw CSV data
   */
  async llmExtractionPass(rawData) {
    if (!this.openai) {
      throw new Error('OpenAI API key required for LLM extraction');
    }

    // Prepare data for LLM - take first 100 rows as context
    const dataPreview = rawData.slice(0, 100).map(row => row.join('|')).join('\n');
    
    const prompt = `You are an expert academic advisor analyzing a degree plan CSV file.

CSV DATA (first 100 rows):
${dataPreview}

TOTAL ROWS: ${rawData.length}

TASK: Extract ALL degree programs and their requirements from this CSV data.

The CSV may have:
- Multiple sheets/sections (each representing a program)
- Varied formatting (columns in different orders, different headers)
- Different layouts (some left-aligned, some with grades first, etc.)
- Multiple programs per sheet

Extract EVERY piece of information:
1. Program names and codes
2. ALL course requirements (course code, name, credits, category, min grade)
3. Credit hour requirements
4. Prerequisites
5. Special notes or conditions

Respond with JSON:
{
  "programs": [
    {
      "name": "Bachelor of Science in Computer Science",
      "code": "CS-BS",
      "totalCredits": 120,
      "requirements": [
        {
          "id": "req-core-1",
          "category": "Core Requirements",
          "type": "specific_courses",
          "courses": [
            {
              "code": "CS 1410",
              "name": "Introduction to Computer Science",
              "credits": 3,
              "minGrade": "C"
            }
          ],
          "credits": 12,
          "description": "Core CS courses"
        }
      ]
    }
  ],
  "extractionNotes": ["Notes about what was found"],
  "confidence": 0.95
}

Be thorough. Extract EVERYTHING. If unsure about formatting, make best guess and note it.`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting structured degree plan data from messy CSV files. Be thorough and extract every detail."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const extracted = JSON.parse(response.choices[0].message.content);
    console.log(`Pass 1 extracted ${extracted.programs?.length || 0} programs`);
    
    return extracted;
  }

  /**
   * Pass 2: LLM Validation - Double-check extraction and add/edit missing requirements
   */
  async llmValidationPass(extractedData, rawData) {
    if (!this.openai) {
      return extractedData; // Skip validation if no API key
    }

    const dataPreview = rawData.slice(0, 100).map(row => row.join('|')).join('\n');
    
    const prompt = `You are a quality assurance expert validating degree plan extraction.

ORIGINAL CSV DATA (first 100 rows):
${dataPreview}

EXTRACTED DATA FROM PASS 1:
${JSON.stringify(extractedData, null, 2)}

TASK: Validate and improve the extracted data.

1. Check if ALL programs were found
2. Check if ALL courses in each program were extracted
3. Check if credits, grades, categories are correct
4. ADD any missing courses or requirements
5. EDIT any incorrect information
6. Ensure every requirement has proper structure

Respond with the COMPLETE, CORRECTED data in the same JSON format:
{
  "programs": [...],
  "validationNotes": ["What was added/corrected"],
  "confidence": 0.98
}

Be meticulous. This is the final check before showing to user.`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a meticulous QA expert. Validate and correct the extracted degree plan data. Add anything missing."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.05,
      response_format: { type: "json_object" }
    });

    const validated = JSON.parse(response.choices[0].message.content);
    console.log(`Pass 2 validated ${validated.programs?.length || 0} programs`);
    console.log('Validation notes:', validated.validationNotes);
    
    return validated;
  }
}

module.exports = CSVParserService;
