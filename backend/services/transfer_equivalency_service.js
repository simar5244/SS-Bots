const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const xlsx = require('xlsx');
const { OpenAI } = require('openai');

class TransferEquivalencyService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // State transfer equivalency sources (TX only for now)
    this.stateSources = {
      'TX': {
        name: 'Texas Common Course Numbering System',
        url: 'https://tccns.org',
        type: 'tccns'
      }
    };
    
    this.cacheDir = path.join(__dirname, '../../cache/transfer-equivalencies');
    this.initializeCache();
  }

  async initializeCache() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Error creating cache directory:', error);
    }
  }

  /**
   * Import transfer equivalencies for a specific state
   */
  async importStateEquivalencies(stateCode) {
    try {
      const source = this.stateSources[stateCode];
      if (!source) {
        throw new Error(`No transfer equivalency source found for state: ${stateCode}`);
      }

      console.log(`Importing transfer equivalencies for ${stateCode} (${source.name})`);
      
      let equivalencyData;
      
      switch (source.type) {
        case 'tccns':
          equivalencyData = await this.importTCCNSData(stateCode);
          break;
        default:
          throw new Error(`Unsupported source type for state ${stateCode}`);
      }

      // Cache the data
      await this.cacheEquivalencyData(stateCode, equivalencyData);
      
      return {
        success: true,
        stateCode,
        source: source.name,
        totalCourses: Object.keys(equivalencyData).length,
        data: equivalencyData
      };

    } catch (error) {
      console.error(`Error importing equivalencies for ${stateCode}:`, error);
      return {
        success: false,
        stateCode,
        error: error.message
      };
    }
  }

  /**
   * Import Texas Common Course Numbering System (TCCNS) data
   */
  async importTCCNSData(stateCode) {
    try {
      // Download official TCCNS master Excel and parse
      const xlsxPath = path.join(this.cacheDir, `tccns_${Date.now()}.xlsx`);
      await this.downloadFile('https://tccns.org/download/tccns_master.xlsx', xlsxPath);

      // Parse workbook using buffer read
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(xlsxPath);
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      const firstSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheet];
      const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

      // Normalize to a generic courses array the processor expects
      const rawData = {
        courses: rows.map((r) => ({
          courseCode: String(r.TCCNS || r.Code || r[Object.keys(r)[0]] || '').trim(),
          courseName: String(r.Title || r.Name || r[Object.keys(r)[1]] || '').trim(),
          credits: Number(r.Credits || r.Hours || 0) || undefined,
          institutions: ['Texas Institutions'],
        })).filter(c => c.courseCode && c.courseName)
      };

      // Cleanup downloaded file
      try { await fs.unlink(xlsxPath); } catch (_) {}

      return await this.processTCCNSData(rawData);
      
    } catch (error) {
      console.error('Error importing TCCNS data:', error);
      return {};
    }
  }

  /**
   * Process TCCNS data with AI to extract Texas Tech equivalencies
   */
  async processTCCNSDataWithAI(rawData) {
    try {
      const dataSample = rawData.slice(0, 100).map(row => JSON.stringify(row)).join('\n');
      
      const prompt = `
You are processing Texas Common Course Numbering System (TCCNS) data to create transfer equivalencies for Texas Tech University.

RAW DATA SAMPLE:
${dataSample}

Your task is to extract course equivalencies in this exact JSON shape:
{
  "TTU_COURSE_CODE_A": [
    {
      "tccnsCode": "EXTERNAL_COURSE_CODE_A",
      "courseName": "EXTERNAL_COURSE_TITLE_A",
      "credits": 3
    }
  ],
  "TTU_COURSE_CODE_B": [ ... ]
}

Focus on ALL courses that transfer to Texas Tech. Respond with JSON only.
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert in Texas higher education transfer credit evaluation."
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
      console.error('AI processing error:', error);
      return {};
    }
  }

  /**
   * Import California ASSIST System data
   */
  async importASSISTData(stateCode) {
    // Disabled: TX-only operation
    throw new Error('ASSIST import disabled: TX-only mode');
  }

  /**
   * Import Florida Statewide Course Numbering System data
   */
  async importSCNSData(stateCode) {
    // Disabled: TX-only operation
    throw new Error('SCNS import disabled: TX-only mode');
  }

  /**
   * Import Wisconsin Transferology data
   */
  async importTransferologyData(stateCode) {
    // Disabled: TX-only operation
    throw new Error('Transferology import disabled: TX-only mode');
  }

  /**
   * Download transfer data from official sources
   */
  async downloadTransferData(url, filename) {
    try {
      const filePath = path.join(this.cacheDir, filename);
      
      // Check if file already exists and is recent (less than 24 hours old)
      try {
        const stats = await fs.stat(filePath);
        const fileAge = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60); // hours
        if (fileAge < 24) {
          console.log(`Using cached transfer data: ${filename}`);
          return filePath;
        }
      } catch (err) {
        // File doesn't exist, proceed with download
      }
      
      console.log(`Downloading transfer data from: ${url}`);
      
      // Download the file
      await this.downloadFile(url, filePath);
      
      console.log(`Successfully downloaded and cached: ${filename}`);
      return filePath;
      
    } catch (error) {
      console.error(`Failed to download transfer data from ${url}:`, error);
      throw error;
    }
  }

  // processASSISTData disabled: TX-only

  // processSCNSData disabled: TX-only

  // processTransferologyData disabled: TX-only

  /**
   * Process raw TCCNS data into Texas Tech equivalencies - NO HARDCODES
   */
  async processTCCNSData(rawData) {
    const equivalencies = {};
    
    // Process the real TCCNS data structure
    if (rawData.courses && Array.isArray(rawData.courses)) {
      for (const course of rawData.courses) {
        const ttuCourse = await this.mapToTTUCourse(course.courseCode, course.courseName);
        if (ttuCourse) {
          if (!equivalencies[ttuCourse]) {
            equivalencies[ttuCourse] = [];
          }
          equivalencies[ttuCourse].push({
            courseCode: course.courseCode,
            courseName: course.courseName,
            credits: course.credits,
            institutions: course.institutions || ["Texas Institutions"],
            notes: `Transfers as ${ttuCourse} via TCCNS`
          });
        }
      }
    }
    
    return equivalencies;
  }

  /**
   * Map external course codes to Texas Tech course codes using AI only - NO HARDCODES
   */
  async mapToTTUCourse(courseCode, courseName) {
    try {
      const prompt = `
You are a transfer credit evaluator for Texas Tech University. Map this external course to the correct Texas Tech course code.

EXTERNAL COURSE:
Code: ${courseCode}
Name: ${courseName}

Your task:
1. Analyze the course code and name to determine subject area and level
2. Research Texas Tech University's course catalog to find the exact equivalent
3. Consider course content, level (1000, 2000, 3000, 4000), and credit hours
4. Return ONLY the Texas Tech course code if an equivalent exists
5. Return "NO_MATCH" if no equivalent exists

Do NOT assume equivalencies - research the actual Texas Tech course catalog.
Respond with ONLY the Texas Tech course code or "NO_MATCH".
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert in academic course equivalencies. Research actual university course catalogs to find accurate matches. Return only course codes."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 10
      });

      const result = response.choices[0].message.content.trim();
      return result === "NO_MATCH" ? null : result;

    } catch (error) {
      console.error('AI mapping error:', error);
      return null;
    }
  }

  // import/process generic state data disabled: TX-only

  /**
   * Import equivalencies for all 50 states
   */
  async importAllStates() {
    const results = {};
    // TX-only mode
    const allStates = ['TX'];

    console.log('Starting import of transfer equivalencies for all 50 states...');

    for (const stateCode of allStates) {
      try {
        console.log(`Processing ${stateCode}...`);
        const result = await this.importStateEquivalencies(stateCode);
        results[stateCode] = result;
        
        // Small delay to avoid overwhelming servers
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Failed to import ${stateCode}:`, error);
        results[stateCode] = {
          success: false,
          error: error.message
        };
      }
    }

    // Save consolidated results
    await this.saveAllStatesData(results);
    
    return results;
  }

  /**
   * Save all states data to cache
   */
  async saveAllStatesData(results) {
    try {
      const filePath = path.join(this.cacheDir, 'all_states_equivalencies.json');
      await fs.writeFile(filePath, JSON.stringify(results, null, 2));
      console.log(`All states equivalency data saved to ${filePath}`);
    } catch (error) {
      console.error('Error saving all states data:', error);
    }
  }

  /**
   * Load cached equivalency data
   */
  async loadCachedEquivalencyData(stateCode) {
    try {
      const filePath = path.join(this.cacheDir, `${stateCode}_equivalencies.json`);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.log(`No cached data found for ${stateCode}`);
      return null;
    }
  }

  /**
   * Cache equivalency data
   */
  async cacheEquivalencyData(stateCode, data) {
    try {
      const filePath = path.join(this.cacheDir, `${stateCode}_equivalencies.json`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      console.log(`Cached equivalency data for ${stateCode}`);
    } catch (error) {
      console.error(`Error caching data for ${stateCode}:`, error);
    }
  }

  /**
   * Download file from URL
   */
  async downloadFile(url, filePath) {
    return new Promise((resolve, reject) => {
      const file = require('fs').createWriteStream(filePath);
      
      https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (error) => {
        fs.unlink(filePath, () => {}); // Delete the file on error
        reject(error);
      });
    });
  }

  /**
   * Find transfer equivalent for a course
   */
  async findTransferEquivalent(courseCode, courseName, fromState) {
    try {
      // Load cached equivalency data
      let equivalencyData = await this.loadCachedEquivalencyData(fromState);
      
      if (!equivalencyData) {
        // Import if not cached
        const importResult = await this.importStateEquivalencies(fromState);
        if (importResult.success) {
          equivalencyData = importResult.data;
        } else {
          return null;
        }
      }

      // Search for exact match first
      for (const [ttuCourse, equivalents] of Object.entries(equivalencyData)) {
        for (const equivalent of equivalents) {
          if (equivalent.tccnsCode === courseCode || 
              equivalent.courseCode === courseCode) {
            return {
              ttuCourse,
              equivalent,
              matchType: 'exact'
            };
          }
        }
      }

      // Fuzzy matching with AI
      return await this.findFuzzyMatch(courseCode, courseName, equivalencyData);

    } catch (error) {
      console.error('Error finding transfer equivalent:', error);
      return null;
    }
  }

  /**
   * Fuzzy matching using AI
   */
  async findFuzzyMatch(courseCode, courseName, equivalencyData) {
    try {
      const prompt = `
You are matching a transfer course to Texas Tech University equivalencies.

TRANSFER COURSE:
Code: ${courseCode}
Name: ${courseName}

AVAILABLE TEXAS TECH EQUIVALENCIES:
${JSON.stringify(equivalencyData, null, 2)}

Find the best match. Consider:
1. Course code similarity
2. Course name similarity
3. Credit hours
4. Subject area

Respond with JSON like:
{
  "ttuCourse": "TTU_COURSE_CODE",
  "equivalent": { "courseCode": "EXT_CODE", "courseName": "EXT_TITLE", "credits": 3 },
  "matchType": "fuzzy",
  "confidence": 0.85,
  "reasoning": ""
}

If no good match found, return null.
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert in course transfer evaluation."
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
      console.error('Fuzzy matching error:', error);
      return null;
    }
  }
}

module.exports = TransferEquivalencyService;
