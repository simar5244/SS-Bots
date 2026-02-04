class ExcelParserService {
  constructor() {
    this.openai = null;
  }

  _ensureInit() {
    if (!this.openai && typeof window === 'undefined') {
      const { OpenAI } = require('openai');
      const apiKey = process.env.OPENAI_API_KEY;
      
      // Only initialize OpenAI if API key is available
      // Excel parsing can work without AI analysis
      if (apiKey) {
        this.openai = new OpenAI({ apiKey });
      } else {
        console.warn('OPENAI_API_KEY not found - Excel parsing will work without AI analysis');
      }
    }
  }

  /**
   * Parse degree plan file (Excel or CSV)
   * Routes to appropriate parser based on file type
   */
  async parseDegreePlanFile(filePath) {
    const path = require('path');
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.csv') {
      const CSVParserService = require('./csv_parser_service');
      const csvParser = new CSVParserService();
      return await csvParser.parseDegreePlanCSV(filePath);
    } else {
      return await this.parseDegreePlanExcel(filePath);
    }
  }

  /**
   * Smart AI-powered Excel parsing for degree plans
   * Handles multi-sheet workbooks with various formatting
   */
  async parseDegreePlanExcel(filePath) {
    this._ensureInit();
    const xlsx = require('xlsx');
    const fs = require('fs');
    
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      
      console.log(`Reading Excel file: ${filePath}`);
      console.log(`File size: ${fs.statSync(filePath).size} bytes`);
      
      // Read file as buffer instead of using readFile
      const fileBuffer = fs.readFileSync(filePath);
      console.log(`Read ${fileBuffer.length} bytes from file`);
      
      let workbook;
      try {
        workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        console.log(`Successfully read workbook with ${workbook.SheetNames.length} sheets`);
      } catch (xlsxError) {
        console.error('xlsx.read error details:', {
          message: xlsxError.message,
          name: xlsxError.name,
          stack: xlsxError.stack,
          code: xlsxError.code
        });
        throw xlsxError;
      }
      
      const allSheetsData = [];
      
      // Process each sheet
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Extract basic structure without AI for now
        const basicAnalysis = {
          degrees: this.extractDegreesManually(rawData),
          confidence: 0.6,
          needsReview: true,
          notes: ['Extracted without AI analysis - please review']
        };
        
        console.log(`Sheet ${sheetName}: Found ${basicAnalysis.degrees.length} programs`);
        
        allSheetsData.push({
          sheetName,
          rawData: rawData,
          aiAnalysis: basicAnalysis,
          confidence: 0.6
        });
      }
      
      // Simple consolidation without AI
      const consolidatedAnalysis = {
        degrees: allSheetsData.flatMap(s => s.aiAnalysis.degrees || []),
        requirements: [],
        confidence: 0.6,
        needsReview: true,
        issues: ['Parsed without AI - please verify all programs and requirements']
      };
      
      return {
        success: true,
        sheets: allSheetsData,
        consolidated: consolidatedAnalysis,
        needsReview: consolidatedAnalysis.confidence < 0.9
      };
      
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      return {
        success: false,
        error: error.message,
        needsReview: true
      };
    }
  }

  /**
   * Preprocess sheet data to handle formatting issues
   */
  preprocessSheetData(rawData) {
    const cleanedData = [];
    
    for (let row = 0; row < rawData.length; row++) {
      const currentRow = rawData[row];
      if (!currentRow || currentRow.length === 0) continue;
      
      // Clean each cell but keep structure (don't filter)
      const cleanedRow = currentRow.map(cell => {
        if (cell === null || cell === undefined) return '';
        if (typeof cell === 'string') {
          return cell.trim().replace(/\s+/g, ' ');
        }
        return cell;
      });
      
      // Skip completely empty rows
      if (cleanedRow.length > 0) {
        cleanedData.push({
          rowIndex: row,
          data: cleanedRow,
          isEmpty: cleanedRow.every(cell => !cell || cell === '')
        });
      }
    }
    
    return cleanedData;
  }

  /**
   * Use AI to analyze sheet structure and extract degree information
   */
  async analyzeSheetWithAI(sheetData, sheetName) {
    try {
      // Prepare data for AI analysis
      const dataPreview = sheetData.slice(0, 20).map(row => row.data).join('\n');
      const totalRows = sheetData.length;
      
      const prompt = `
You are an expert academic advisor analyzing Texas Tech University degree plan spreadsheets.

SHEET NAME: ${sheetName}
TOTAL ROWS: ${totalRows}

DATA PREVIEW (first 20 rows):
${dataPreview}

Your task is to analyze this spreadsheet and identify:
1. Degree programs offered
2. Course requirements for each degree
3. Credit requirements
4. Prerequisites
5. Any special notes or conditions

Respond with a JSON structure:
{
  "sheetType": "degree_plans|course_list|requirements|other",
  "degrees": [
    {
      "name": "Bachelor of Science in Computer Science",
      "code": "CS-BS",
      "totalCredits": 120,
      "requirements": [
        {
          "category": "Core Requirements",
          "courses": ["CS 1410", "CS 2413", "MATH 1451"],
          "credits": 12,
          "type": "specific_courses|credit_hours|elective"
        }
      ]
    }
  ],
  "confidence": 0.95,
  "notes": ["Additional notes about formatting or unclear data"],
  "needsReview": false
}

Focus on accuracy. If data is unclear, mark needsReview as true and explain in notes.
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert academic advisor specializing in Texas Tech University degree requirements and transfer credit evaluation."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const aiResult = JSON.parse(response.choices[0].message.content);
      
      // Validate and enhance AI results
      return this.validateAIResults(aiResult, sheetData);
      
    } catch (error) {
      console.error('AI analysis error:', error);
      return {
        sheetType: 'unknown',
        degrees: [],
        confidence: 0.1,
        notes: [`AI analysis failed: ${error.message}`],
        needsReview: true
      };
    }
  }

  /**
   * Validate and enhance AI analysis results
   */
  validateAIResults(aiResult, sheetData) {
    const validated = { ...aiResult };
    
    // Check if AI found any degrees
    if (!validated.degrees || validated.degrees.length === 0) {
      validated.degrees = this.extractDegreesManually(sheetData);
      validated.confidence = Math.min(validated.confidence, 0.6);
      validated.needsReview = true;
      validated.notes.push('No degrees found by AI, attempted manual extraction');
    }
    
    // Validate degree structures
    validated.degrees = validated.degrees.map(degree => {
      const validatedDegree = { ...degree };
      
      // Ensure required fields
      if (!validatedDegree.requirements) {
        validatedDegree.requirements = [];
      }
      
      // Calculate total credits if not provided
      if (!validatedDegree.totalCredits && validatedDegree.requirements.length > 0) {
        validatedDegree.totalCredits = validatedDegree.requirements.reduce(
          (sum, req) => sum + (req.credits || 0), 0
        );
      }
      
      return validatedDegree;
    });
    
    return validated;
  }

  /**
   * Manual degree extraction as fallback
   */
  extractDegreesManually(rawData) {
    console.log('\n=== EXTRACT DEGREES MANUALLY ===');
    console.log('Total rows:', rawData.length);
    
    if (!Array.isArray(rawData) || rawData.length === 0) {
      console.log('ERROR: rawData is empty or not an array');
      return [];
    }
    
    // Strategy: Look for ANY row that has course-like patterns
    // Course codes: MATH 2413, COSC 1436, MATH 2413 - Calculus I (TCCNS), etc.
    const courseCodePattern = /[A-Z]{2,4}\s*\d{4}/;
    const courses = [];
    
    console.log('\nScanning for course data patterns...');
    
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (!Array.isArray(row) || row.length === 0) continue;
      
      // Check each cell for course code pattern
      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const cell = row[colIdx];
        if (!cell) continue;
        
        const cellStr = cell.toString().trim();
        
        // Found a course code!
        const match = cellStr.match(courseCodePattern);
        if (match) {
          const courseCode = match[0].trim();
          console.log(`Found course code "${courseCode}" at row ${i}, col ${colIdx}`);
          
          // Extract course info from this row
          const course = {
            code: courseCode,
            name: '',
            credits: 3, // default
            minGrade: 'C', // default
            category: 'Core'
          };
          
          // Check if course name is in same cell (e.g., "MATH 2413 - Calculus I")
          const afterCode = cellStr.substring(cellStr.indexOf(courseCode) + courseCode.length).trim();
          if (afterCode.length > 3) {
            // Remove leading dash or parentheses
            course.name = afterCode.replace(/^[-–—]\s*/, '').replace(/\(.*?\)/g, '').trim();
          }
          
          // If no name found in same cell, look in nearby columns
          if (!course.name) {
            for (let j = colIdx + 1; j < Math.min(colIdx + 4, row.length); j++) {
              const nextCell = row[j];
              if (nextCell && typeof nextCell === 'string' && nextCell.length > 5 && !courseCodePattern.test(nextCell.toString())) {
                course.name = nextCell.toString().trim();
                break;
              }
            }
          }
          
          // Look for credits (number 1-6)
          for (let j = 0; j < row.length; j++) {
            const val = row[j];
            if (val && !isNaN(val) && val >= 1 && val <= 6) {
              course.credits = parseInt(val);
              break;
            }
          }
          
          // Look for grade (C, C-, C+, B, etc.)
          const gradePattern = /^[A-D][+-]?$/;
          for (let j = 0; j < row.length; j++) {
            const val = row[j];
            if (val && gradePattern.test(val.toString().trim())) {
              course.minGrade = val.toString().trim();
              break;
            }
          }
          
          courses.push(course);
          console.log(`  Extracted: ${JSON.stringify(course)}`);
          break; // Move to next row
        }
      }
    }
    
    console.log(`\nTotal courses found: ${courses.length}`);
    
    if (courses.length === 0) {
      console.log('ERROR: No courses found in data');
      return [];
    }
    
    // Get program name from first few rows
    let programName = 'Degree Program';
    for (let i = 0; i < Math.min(5, rawData.length); i++) {
      const row = rawData[i];
      if (!Array.isArray(row)) continue;
      
      for (const cell of row) {
        if (!cell) continue;
        const cellStr = cell.toString();
        
        // Look for program indicators
        if (cellStr.length > 10 && 
            (cellStr.includes('BS') || cellStr.includes('BA') || 
             cellStr.includes('Bachelor') || cellStr.includes('Transfer') ||
             cellStr.includes('Requirements'))) {
          programName = cellStr.replace(/Transfer Requirements for|Transfer Student Checklist|Pre-Nursing Transfer Requirements/gi, '').trim();
          console.log(`Found program name: "${programName}"`);
          break;
        }
      }
      if (programName !== 'Degree Program') break;
    }
    
    // Calculate total credits
    const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);
    console.log(`Program: ${programName}, Total Credits: ${totalCredits}`);
    
    // Group courses into a single requirement
    const requirement = {
      id: 'req-core',
      category: 'Core Requirements',
      type: 'specific_courses',
      courses: courses.map(c => ({
        code: c.code,
        name: c.name,
        credits: c.credits,
        minGrade: c.minGrade
      })),
      credits: totalCredits,
      description: 'Transfer requirements'
    };
    
    return [{
      name: programName,
      code: programName.replace(/\s+/g, '-').toUpperCase(),
      totalCredits: totalCredits,
      requirements: [requirement],
      confidence: 0.9,
      needsReview: false
    }];
  }

  /**
   * Extract degree code from row data
   */
  extractDegreeCode(rowData) {
    const codePattern = /\b[A-Z]{2,4}-[A-Z]{2,4}\b|\b[A-Z]{2,6}\b/g;
    const text = rowData.join(' ');
    const matches = text.match(codePattern);
    return matches ? matches[0] : '';
  }

  /**
   * Extract credit hours from row data
   */
  extractCredits(rowData) {
    const creditPattern = /(\d+)\s*(?:credits?|hours?|crs?)/gi;
    const text = rowData.join(' ');
    const matches = text.match(creditPattern);
    return matches ? parseInt(matches[0]) : 0;
  }

  /**
   * Consolidate analysis across multiple sheets
   */
  async consolidateSheetAnalysis(allSheetsData) {
    const allDegrees = [];
    const allRequirements = [];
    let overallConfidence = 0;
    const issues = [];
    
    for (const sheet of allSheetsData) {
      allDegrees.push(...(sheet.aiAnalysis.degrees || []));
      overallConfidence += sheet.confidence;
      
      if (sheet.aiAnalysis.needsReview) {
        issues.push(`Sheet "${sheet.sheetName}" needs review: ${sheet.aiAnalysis.notes?.join(', ')}`);
      }
    }
    
    overallConfidence = overallConfidence / allSheetsData.length;
    
    // Remove duplicate degrees
    const uniqueDegrees = this.removeDuplicateDegrees(allDegrees);
    
    // AI consolidation for final review
    const consolidatedAnalysis = await this.consolidateWithAI(uniqueDegrees, allRequirements);
    
    return {
      degrees: uniqueDegrees,
      requirements: allRequirements,
      confidence: overallConfidence,
      needsReview: overallConfidence < 0.8 || issues.length > 0,
      issues,
      aiConsolidation: consolidatedAnalysis
    };
  }

  /**
   * Remove duplicate degree entries
   */
  removeDuplicateDegrees(degrees) {
    const seen = new Set();
    return degrees.filter(degree => {
      const key = `${degree.name}-${degree.code}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Final AI consolidation
   */
  async consolidateWithAI(degrees, requirements) {
    try {
      const prompt = `
You are consolidating degree plan information from multiple sheets for Texas Tech University.

DEGREES FOUND:
${JSON.stringify(degrees, null, 2)}

Please:
1. Standardize degree names and codes
2. Identify any missing information
3. Suggest improvements to structure
4. Flag any inconsistencies

Respond with JSON:
{
  "standardizedDegrees": [...],
  "missingInfo": [...],
  "suggestions": [...],
  "inconsistencies": [...],
  "finalConfidence": 0.9
}
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert academic advisor consolidating degree plan information."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content);
      
    } catch (error) {
      console.error('AI consolidation error:', error);
      return {
        standardizedDegrees: degrees,
        missingInfo: ['AI consolidation failed'],
        suggestions: ['Manual review required'],
        inconsistencies: [],
        finalConfidence: 0.5
      };
    }
  }
}

module.exports = ExcelParserService;
