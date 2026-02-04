class TCCNSMatcherService {
  constructor() {
    this.openai = null;
    this.tccnsData = null;
    this.tccnsFilePath = null;
  }

  _ensureInit() {
    if (!this.openai && typeof window === 'undefined') {
      const { OpenAI } = require('openai');
      const path = require('path');
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.tccnsFilePath = path.join(process.cwd(), 'cache/transfer-equivalencies/TX_equivalencies.json');
    }
  }

  /**
   * Load TCCNS equivalency data
   */
  async loadTCCNSData() {
    this._ensureInit();
    if (this.tccnsData) return this.tccnsData;

    const fs = require('fs').promises;
    const path = require('path');
    const xlsx = require('xlsx');
    
    try {
      // Try to load from JSON cache first
      console.log('Loading TCCNS data from:', this.tccnsFilePath);
      
      try {
        const jsonData = await fs.readFile(this.tccnsFilePath, 'utf-8');
        this.tccnsData = JSON.parse(jsonData);
        console.log('Successfully loaded TCCNS data from JSON cache');
        return this.tccnsData;
      } catch (jsonError) {
        console.error('Failed to load JSON cache:', jsonError.message);
        
        // Check if JSON file exists but is corrupted
        const fsSync = require('fs');
        if (fsSync.existsSync(this.tccnsFilePath)) {
          console.error('JSON file exists but failed to parse - file may be corrupted');
          throw new Error('TCCNS JSON cache is corrupted. Please regenerate the cache.');
        }
        
        // If JSON doesn't exist, return empty data rather than trying to parse corrupted Excel
        console.warn('No TCCNS cache found - returning empty equivalency data');
        this.tccnsData = {};
        return this.tccnsData;
      }
    } catch (error) {
      console.error('Error loading TCCNS data:', error);
      throw new Error(`Failed to load TCCNS data: ${error.message}`);
    }
  }

  /**
   * Structure raw TCCNS data into usable format
   */
  async structureTCCNSData(rawData) {
    const structured = {
      institutions: {},
      ttuCourses: {},
      lastUpdated: Date.now()
    };

    for (const row of rawData) {
      const institution = row['Institution'] || row['College'] || row['University'];
      const externalCourse = row['External Course'] || row['Course'];
      const ttuEquivalent = row['TTU Equivalent'] || row['Texas Tech Course'];
      const credits = row['Credits'] || row['Credit Hours'] || 3;
      const notes = row['Notes'] || '';

      if (!institution || !externalCourse) continue;

      if (!structured.institutions[institution]) {
        structured.institutions[institution] = [];
      }

      structured.institutions[institution].push({
        externalCourse,
        ttuEquivalent,
        credits: parseFloat(credits) || 3,
        notes,
        creditGranted: !!ttuEquivalent
      });

      // Index by TTU course for reverse lookup
      if (ttuEquivalent) {
        if (!structured.ttuCourses[ttuEquivalent]) {
          structured.ttuCourses[ttuEquivalent] = [];
        }
        structured.ttuCourses[ttuEquivalent].push({
          institution,
          externalCourse,
          credits: parseFloat(credits) || 3
        });
      }
    }

    return structured;
  }

  /**
   * Match individual courses to TTU equivalents
   */
  async matchCourses(courses, institution) {
    this._ensureInit();
    await this.loadTCCNSData();
    
    console.log('\n========================================');
    console.log('STEP 2: TCCNS COURSE MATCHING');
    console.log('========================================');
    console.log('Institution:', institution);
    console.log('Courses to match:', courses.length);
    
    const matchedCourses = [];
    
    for (const course of courses) {
      console.log(`\n--- Matching: ${course.courseCode} ---`);
      const match = await this.findTCCNSMatch(institution, course);
      
      if (match.creditGranted) {
        console.log(`✓ MATCH FOUND`);
        console.log(`  Original: ${course.courseCode} (${course.courseName})`);
        console.log(`  TTU Equivalent: ${match.ttuEquivalent}`);
        console.log(`  Credits: ${match.ttuCredits}`);
        console.log(`  Grade: ${match.grade}`);
      } else {
        console.log(`✗ NO MATCH - Course not found in TCCNS database`);
      }
      
      matchedCourses.push(match);
    }
    
    const matchedCount = matchedCourses.filter(m => m.creditGranted).length;
    console.log(`\n--- TCCNS MATCHING SUMMARY ---`);
    console.log(`Matched: ${matchedCount}/${courses.length} courses`);
    console.log(`Unmatched: ${courses.length - matchedCount} courses`);
    console.log('--- END TCCNS MATCHING ---\n');
    
    return matchedCourses;
  }

  /**
   * Match student courses to TTU equivalents using TCCNS data
   */
  async matchCoursesToTTU(parsedTranscripts) {
    this._ensureInit();
    
    // Handle empty or failed transcripts
    if (!parsedTranscripts || parsedTranscripts.length === 0) {
      return {
        matches: [],
        overallConfidence: 0,
        needsManualReview: true,
        error: 'No transcripts to match'
      };
    }

    await this.loadTCCNSData();

    const matchingResults = [];

    for (const transcript of parsedTranscripts) {
      // Skip failed transcripts
      if (!transcript.success || !transcript.institution || !transcript.courses) {
        continue;
      }

      const institution = transcript.institution;
      const courses = transcript.courses || [];

      const matchedCourses = await this.matchCourses(courses, institution);
      matchingResults.push(...matchedCourses);
    }

    // If no matches found, return early
    if (matchingResults.length === 0) {
      return {
        matches: [],
        overallConfidence: 0,
        needsManualReview: true,
        error: 'No courses found to match'
      };
    }

    // LLM verification of matches
    const verifiedMatches = await this.verifyMatchesWithAI(matchingResults);

    return verifiedMatches;
  }

  /**
   * Find TCCNS match for a single course
   */
  async findTCCNSMatch(institution, course) {
    // Search through all TTU courses to find a match
    let bestMatch = null;
    let matchType = 'no_match';
    
    for (const [ttuCourse, equivalencies] of Object.entries(this.tccnsData)) {
      for (const equiv of equivalencies) {
        // Check if this equivalency matches the student's course
        const normalizedStudentCode = this.normalizeCourseCode(course.courseCode);
        const normalizedTCCNSCode = this.normalizeCourseCode(equiv.tccnsCode);
        
        if (normalizedStudentCode === normalizedTCCNSCode) {
          bestMatch = {
            ttuCourse,
            tccnsCode: equiv.tccnsCode,
            courseName: equiv.courseName,
            credits: equiv.credits,
            notes: equiv.notes
          };
          matchType = 'exact_match';
          break;
        }
      }
      if (bestMatch) break;
    }
    
    // If no exact match, try fuzzy matching
    if (!bestMatch) {
      for (const [ttuCourse, equivalencies] of Object.entries(this.tccnsData)) {
        for (const equiv of equivalencies) {
          if (this.fuzzyMatchCourse(equiv.tccnsCode, course.courseCode, course.courseName)) {
            bestMatch = {
              ttuCourse,
              tccnsCode: equiv.tccnsCode,
              courseName: equiv.courseName,
              credits: equiv.credits,
              notes: equiv.notes
            };
            matchType = 'fuzzy_match';
            break;
          }
        }
        if (bestMatch) break;
      }
    }
    
    const match = bestMatch;

    if (match) {
      return {
        originalCourse: course.courseCode,
        courseName: course.courseName,
        originalInstitution: institution,
        credits: course.credits,
        grade: course.grade,
        ttuEquivalent: match.ttuCourse,
        creditGranted: true,
        ttuCredits: match.credits,
        matchType: matchType,
        notes: match.notes
      };
    }

    // No match found
    return {
      originalCourse: course.courseCode,
      courseName: course.courseName,
      originalInstitution: institution,
      credits: course.credits,
      grade: course.grade,
      ttuEquivalent: null,
      creditGranted: false,
      matchType: 'no_match',
      notes: 'No TCCNS equivalency found - may need manual review'
    };
  }

  /**
   * Normalize course code for matching
   */
  normalizeCourseCode(courseCode) {
    if (!courseCode) return '';
    return courseCode
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9]/g, '');
  }

  /**
   * Fuzzy match for course codes
   */
  fuzzyMatchCourse(externalCourse, studentCourse, courseName) {
    const normalizedExternal = this.normalizeCourseCode(externalCourse);
    const normalizedStudent = this.normalizeCourseCode(studentCourse);

    // Check if codes are similar
    if (normalizedExternal.includes(normalizedStudent) || 
        normalizedStudent.includes(normalizedExternal)) {
      return true;
    }

    // Check if course name is similar
    if (courseName && externalCourse) {
      const nameWords = courseName.toLowerCase().split(' ');
      const externalWords = externalCourse.toLowerCase().split(' ');
      const commonWords = nameWords.filter(word => 
        externalWords.some(ew => ew.includes(word) || word.includes(ew))
      );
      return commonWords.length >= 2;
    }

    return false;
  }

  /**
   * AI verification of TCCNS matches
   */
  async verifyMatchesWithAI(matches) {
    try {
      const matchSummary = matches.map(m => ({
        original: `${m.originalCourse} - ${m.courseName}`,
        ttuEquivalent: m.ttuEquivalent || 'No match',
        matchType: m.matchType
      }));

      const prompt = `
You are verifying transfer credit matches between student courses and Texas Tech University equivalents.

MATCHES TO VERIFY:
${JSON.stringify(matchSummary, null, 2)}

Review each match and identify:
1. Any incorrect matches (course doesn't logically match the equivalent)
2. Missing matches that should exist
3. Courses that need manual review

Respond with JSON:
{
  "verifiedMatches": [
    {
      "originalCourse": "CS 101",
      "isCorrect": true/false,
      "confidence": 0.95,
      "notes": "Any concerns or recommendations"
    }
  ],
  "needsManualReview": ["List of courses requiring human review"],
  "overallConfidence": 0.9
}
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert in transfer credit evaluation and course equivalencies."
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

      // Apply verification results to matches
      const verifiedMatches = matches.map(match => {
        const verificationResult = verification.verifiedMatches.find(v =>
          v.originalCourse === match.originalCourse
        );

        if (verificationResult) {
          return {
            ...match,
            verificationConfidence: verificationResult.confidence,
            verificationNotes: verificationResult.notes,
            needsReview: !verificationResult.isCorrect || verificationResult.confidence < 0.8
          };
        }

        return match;
      });

      return {
        matches: verifiedMatches,
        overallConfidence: verification.overallConfidence,
        needsManualReview: verification.needsManualReview
      };

    } catch (error) {
      console.error('AI verification error:', error);
      return {
        matches: matches.map(m => ({ ...m, needsReview: true })),
        overallConfidence: 0.5,
        needsManualReview: matches.map(m => m.originalCourse)
      };
    }
  }

  /**
   * Get statistics about matching results
   */
  getMatchingStatistics(matches) {
    const total = matches.length;
    const matched = matches.filter(m => m.creditGranted).length;
    const noMatch = matches.filter(m => m.matchType === 'no_match').length;
    const needsReview = matches.filter(m => m.needsReview).length;

    return {
      total,
      matched,
      noMatch,
      needsReview,
      matchRate: total > 0 ? (matched / total) * 100 : 0
    };
  }
}

module.exports = TCCNSMatcherService;
