class TranscriptBotService {
  constructor() {
    this.transcriptParser = null;
    this.tccnsMatcher = null;
    this.requirementEvaluator = null;
    this.excelParser = null;
    this.llmVerifier = null;
  }

  _ensureInit() {
    if (!this.transcriptParser && typeof window === 'undefined') {
      const TranscriptParserService = require('./services/transcript_parser_service');
      const TCCNSMatcherService = require('./services/tccns_matcher_service');
      const RequirementEvaluatorService = require('./services/requirement_evaluator_service');
      const ExcelParserService = require('./services/excel_parser_service');
      const LLMVerificationService = require('./services/llm_verification_service');
      
      this.transcriptParser = new TranscriptParserService();
      this.tccnsMatcher = new TCCNSMatcherService();
      this.requirementEvaluator = new RequirementEvaluatorService();
      this.excelParser = new ExcelParserService();
      this.llmVerifier = new LLMVerificationService();
    }
  }

  /**
   * STEP 1 & 2: Parse degree plan file (Excel or CSV) and verify with LLM
   */
  async parseAndVerifyDegreePlan(filePath) {
    this._ensureInit();
    try {
      console.log('Step 1: Parsing degree plan file...');
      const parseResult = await this.excelParser.parseDegreePlanFile(filePath);

      if (!parseResult.success) {
        throw new Error(`Degree plan parsing failed: ${parseResult.error}`);
      }

      console.log('Step 2: LLM verification of degree plan...');
      const verificationResult = await this.verifyDegreePlanWithLLM(parseResult);

      // Convert degrees/programs to unified format
      // CSV parser returns parsedData.programs directly
      // Excel parser returns consolidated.degrees
      let programs = [];
      if (parseResult.parsedData?.programs) {
        // CSV format - already in correct structure
        programs = parseResult.parsedData.programs;
      } else if (parseResult.consolidated?.degrees) {
        // Excel format - convert degrees to programs
        programs = parseResult.consolidated.degrees.map(degree => ({
          id: degree.code || `prog-${Date.now()}`,
          name: degree.name,
          code: degree.code || '',
          totalCredits: degree.totalCredits || 120,
          requirements: degree.requirements || []
        }));
      }

      return {
        success: true,
        parsedData: { programs },
        verificationStatus: verificationResult.status,
        verificationNotes: verificationResult.notes,
        needsReview: parseResult.needsReview || verificationResult.needsReview
      };

    } catch (error) {
      console.error('Degree plan processing error:', error);
      
      // Return a basic structure so bot can still be created
      return {
        success: true,
        parsedData: {
          programs: [{
            id: 'default-program',
            name: 'Default Program (Parsing Failed - Please Edit)',
            code: 'DEFAULT',
            totalCredits: 120,
            requirements: [{
              id: 'req-1',
              category: 'Core Requirements',
              type: 'credit_hours',
              credits: 120,
              description: 'Please edit this requirement'
            }]
          }]
        },
        verificationStatus: 'needs_review',
        verificationNotes: [`Parsing failed: ${error.message}. Please manually edit the requirements.`],
        needsReview: true
      };
    }
  }

  /**
   * LLM verification of parsed degree plan
   */
  async verifyDegreePlanWithLLM(parseResult) {
    try {
      const { OpenAI } = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const prompt = `
You are verifying a parsed degree plan for completeness and accuracy.

PARSED DEGREE PLAN:
${JSON.stringify(parseResult.consolidated, null, 2)}

Your task:
1. Check if all degree programs are properly identified
2. Verify all requirements are captured for each program
3. Look for any missed courses or requirements
4. Identify any ambiguous or unclear requirements
5. Flag any data quality issues

Respond with JSON:
{
  "status": "verified" | "needs_review",
  "notes": ["List of findings, concerns, or recommendations"],
  "missedCourses": ["Any courses that might have been missed"],
  "ambiguousRequirements": ["Requirements that need clarification"],
  "needsReview": true/false,
  "confidence": 0.95
}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert at verifying academic degree plans for completeness and accuracy."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      console.error('LLM verification error:', error);
      return {
        status: 'needs_review',
        notes: [`Verification failed: ${error.message}`],
        missedCourses: [],
        ambiguousRequirements: [],
        needsReview: true,
        confidence: 0.5
      };
    }
  }

  /**
   * STEP 5a & 5b: Parse student transcripts and verify with LLM
   */
  async parseAndVerifyTranscripts(transcriptFiles) {
    try {
      console.log('Step 5a: Parsing student transcripts...');
      const parsedTranscripts = await this.transcriptParser.parseMultipleTranscripts(transcriptFiles);

      console.log('Step 5b: LLM verification of parsed transcripts...');
      // Verification is already built into the parser service
      // Each transcript is verified during parsing

      return {
        success: true,
        transcripts: parsedTranscripts,
        totalTranscripts: parsedTranscripts.length,
        successfullyParsed: parsedTranscripts.filter(t => t.success).length,
        needsReview: parsedTranscripts.some(t => t.verificationStatus === 'needs_review')
      };

    } catch (error) {
      console.error('Transcript parsing error:', error);
      return {
        success: false,
        error: error.message,
        needsReview: true
      };
    }
  }

  /**
   * STEP 6 & 7: Match courses using TCCNS data and verify with LLM
   */
  async matchAndVerifyTCCNS(parsedTranscripts) {
    try {
      console.log('Step 6: Matching courses using TCCNS data...');
      const matchingResult = await this.tccnsMatcher.matchCoursesToTTU(parsedTranscripts);

      console.log('Step 7: LLM verification of TCCNS matches...');
      // Verification is already built into the matcher service

      const statistics = this.tccnsMatcher.getMatchingStatistics(matchingResult.matches);

      return {
        success: true,
        matches: matchingResult.matches,
        statistics,
        overallConfidence: matchingResult.overallConfidence,
        needsManualReview: matchingResult.needsManualReview
      };

    } catch (error) {
      console.error('TCCNS matching error:', error);
      return {
        success: false,
        error: error.message,
        needsReview: true
      };
    }
  }

  /**
   * STEP 9: Match against requirements and generate report
   */
  async evaluateAndGenerateReport(degreePlan, matchedCourses, programName) {
    try {
      console.log('Step 9: Evaluating requirements and generating report...');
      
      const evaluation = await this.requirementEvaluator.evaluateRequirements(
        degreePlan,
        matchedCourses,
        programName
      );

      const finalReport = await this.requirementEvaluator.generateFinalReport(
        evaluation,
        matchedCourses
      );

      return {
        success: true,
        evaluation,
        report: finalReport
      };

    } catch (error) {
      console.error('Evaluation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Complete end-to-end processing pipeline
   */
  async processTranscriptEvaluation(transcriptFiles, programName, degreePlan) {
    this._ensureInit();
    const processingLog = [];
    try {
      console.log('\n=== PROCESS TRANSCRIPT EVALUATION ===');
      console.log('Degree plan structure:', JSON.stringify(degreePlan, null, 2));
      
      // Extract programs from correct location
      let programsData = degreePlan;
      if (degreePlan.parsedData?.programs) {
        programsData = { programs: degreePlan.parsedData.programs };
        console.log('Using degreePlan.parsedData.programs');
      } else if (degreePlan.programs) {
        programsData = { programs: degreePlan.programs };
        console.log('Using degreePlan.programs');
      }
      console.log('Programs data for evaluation:', JSON.stringify(programsData, null, 2));
      
      processingLog.push({
        timestamp: Date.now(),
        step: 'parse_transcripts',
        status: 'in_progress'
      });

      const transcriptResult = await this.parseAndVerifyTranscripts(transcriptFiles);
      
      if (!transcriptResult.success) {
        throw new Error('Transcript parsing failed');
      }

      processingLog.push({
        timestamp: Date.now(),
        step: 'parse_transcripts',
        status: 'completed',
        details: `Parsed ${transcriptResult.successfullyParsed}/${transcriptResult.totalTranscripts} transcripts`
      });

      // Step 6-7: TCCNS matching
      processingLog.push({
        timestamp: Date.now(),
        step: 'tccns_matching',
        status: 'in_progress'
      });

      const matchingResult = await this.matchAndVerifyTCCNS(transcriptResult.transcripts);

      if (!matchingResult.success) {
        throw new Error('TCCNS matching failed');
      }

      processingLog.push({
        timestamp: Date.now(),
        step: 'tccns_matching',
        status: 'completed',
        details: `Matched ${matchingResult.statistics.matched}/${matchingResult.statistics.total} courses`
      });

      // Step 8: LLM verification against program requirements
      processingLog.push({
        timestamp: Date.now(),
        step: 'llm_verification',
        status: 'in_progress'
      });

      // Find the selected program to get its requirements
      const selectedProgram = programsData.programs.find(p => 
        p.name.toLowerCase().includes(programName.toLowerCase()) ||
        p.code.toLowerCase() === programName.toLowerCase()
      );

      let llmVerificationResult = null;
      if (selectedProgram && selectedProgram.requirements) {
        console.log('Step 8: LLM verification of courses against program requirements...');
        llmVerificationResult = await this.llmVerifier.verifyCoursesAgainstRequirements(
          matchingResult.matches,
          selectedProgram.requirements,
          selectedProgram.name
        );

        processingLog.push({
          timestamp: Date.now(),
          step: 'llm_verification',
          status: 'completed',
          details: `Verified ${llmVerificationResult.summary.totalRequirements} requirements, ${llmVerificationResult.summary.gradesValid} grades valid`
        });
      } else {
        console.log('Skipping LLM verification - program requirements not found');
        processingLog.push({
          timestamp: Date.now(),
          step: 'llm_verification',
          status: 'skipped',
          details: 'Program requirements not found'
        });
      }

      // Step 9: Requirement evaluation
      processingLog.push({
        timestamp: Date.now(),
        step: 'requirement_evaluation',
        status: 'in_progress'
      });

      const evaluationResult = await this.evaluateAndGenerateReport(
        programsData,
        matchingResult.matches,
        programName
      );

      if (!evaluationResult.success) {
        throw new Error('Requirement evaluation failed');
      }

      processingLog.push({
        timestamp: Date.now(),
        step: 'requirement_evaluation',
        status: 'completed',
        details: `Evaluation complete: ${evaluationResult.evaluation.eligibility}`
      });

      return {
        success: true,
        parsedTranscripts: transcriptResult.transcripts,
        tccnsMatching: matchingResult.matches,
        llmVerification: llmVerificationResult,
        requirementEvaluation: evaluationResult.evaluation,
        finalReport: evaluationResult.report,
        processingLog,
        status: 'completed'
      };

    } catch (error) {
      console.error('Complete evaluation error:', error);
      
      processingLog.push({
        timestamp: Date.now(),
        step: 'error',
        status: 'failed',
        details: error.message
      });

      return {
        success: false,
        error: error.message,
        processingLog,
        status: 'failed'
      };
    }
  }
}

module.exports = TranscriptBotService;
