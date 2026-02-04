class RequirementEvaluatorService {
  constructor() {
    this.openai = null;
  }

  _ensureInit() {
    if (!this.openai && typeof window === 'undefined') {
      const { OpenAI } = require('openai');
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  /**
   * Evaluate student's transcript against degree requirements
   */
  async evaluateRequirements(degreePlan, matchedCourses, programName) {
    this._ensureInit();
    try {
      console.log('\n========================================');
      console.log('STEP 3: REQUIREMENT EVALUATION');
      console.log('========================================');
      console.log('Program requested:', programName);
      console.log('Available programs:', degreePlan.programs?.map(p => p.name).join(', '));
      
      // Find the specific program in the degree plan
      const program = degreePlan.programs.find(p => 
        p.name.toLowerCase().includes(programName.toLowerCase()) ||
        p.code.toLowerCase() === programName.toLowerCase()
      );

      if (!program) {
        console.log('ERROR: Program not found!');
        throw new Error(`Program "${programName}" not found in degree plans`);
      }

      console.log('Program found:', program.name);
      console.log('Total requirements:', program.requirements.length);
      console.log('Total matched courses available:', matchedCourses.filter(m => m.creditGranted).length);

      // Evaluate each requirement category
      const evaluationResults = [];

      for (const requirement of program.requirements) {
        console.log(`\n--- Evaluating: ${requirement.category} ---`);
        console.log(`Type: ${requirement.type}`);
        
        const result = await this.evaluateRequirement(requirement, matchedCourses);
        
        console.log(`Result: ${result.met ? '✓ MET' : '✗ NOT MET'}`);
        console.log(`Details: ${result.details}`);
        if (result.matchedCourses?.length > 0) {
          console.log(`Matched courses:`);
          result.matchedCourses.forEach(c => {
            console.log(`  - ${c.ttuEquivalent} (${c.grade})`);
          });
        }
        if (result.missingElements?.length > 0) {
          console.log(`Missing: ${result.missingElements.join(', ')}`);
        }
        
        evaluationResults.push(result);
      }

      // AI-powered comprehensive analysis
      const comprehensiveAnalysis = await this.generateComprehensiveAnalysis(
        program,
        matchedCourses,
        evaluationResults
      );

      // Calculate requirement-level statistics
      const metRequirements = evaluationResults.filter(r => r.met).length;
      const totalRequirements = evaluationResults.length;
      const completionPercentage = (metRequirements / totalRequirements) * 100;

      // Calculate course-level statistics (actual courses matched)
      const totalCoursesRequired = program.requirements.reduce((sum, req) => {
        if (req.type === 'specific_courses' && req.courses) {
          return sum + req.courses.length;
        }
        return sum;
      }, 0);

      const coursesMatched = evaluationResults.reduce((sum, result) => {
        if (result.matchedCourses && result.matchedCourses.length > 0) {
          return sum + result.matchedCourses.length;
        }
        return sum;
      }, 0);

      console.log('\n--- EVALUATION SUMMARY ---');
      console.log(`Requirements Met: ${metRequirements}/${totalRequirements}`);
      console.log(`Courses Matched: ${coursesMatched}/${totalCoursesRequired}`);
      console.log(`Completion: ${completionPercentage.toFixed(1)}%`);
      console.log(`Eligibility: ${this.determineEligibility(completionPercentage, evaluationResults)}`);
      console.log('--- END REQUIREMENT EVALUATION ---\n');

      return {
        programName: program.name,
        programCode: program.code,
        totalRequirements,
        metRequirements,
        totalCoursesRequired,
        coursesMatched,
        unmetRequirements: evaluationResults.filter(r => !r.met),
        completionPercentage,
        evaluationDetails: evaluationResults,
        comprehensiveAnalysis,
        eligibility: this.determineEligibility(completionPercentage, evaluationResults)
      };

    } catch (error) {
      console.error('Requirement evaluation error:', error);
      throw error;
    }
  }

  /**
   * Evaluate a single requirement
   */
  async evaluateRequirement(requirement, matchedCourses) {
    const result = {
      requirementId: requirement.id,
      category: requirement.category,
      type: requirement.type,
      description: requirement.description || '',
      met: false,
      details: '',
      matchedCourses: [],
      missingElements: []
    };

    switch (requirement.type) {
      case 'specific_courses':
        return this.evaluateSpecificCourses(requirement, matchedCourses, result);
      
      case 'credit_hours':
        return this.evaluateCreditHours(requirement, matchedCourses, result);
      
      case 'grade_requirement':
        return this.evaluateGradeRequirement(requirement, matchedCourses, result);
      
      case 'gpa_requirement':
        return this.evaluateGPARequirement(requirement, matchedCourses, result);
      
      case 'elective':
        return this.evaluateElective(requirement, matchedCourses, result);
      
      default:
        result.details = 'Unknown requirement type';
        return result;
    }
  }

  /**
   * Evaluate specific course requirements
   */
  evaluateSpecificCourses(requirement, matchedCourses, result) {
    const requiredCourses = requirement.courses || [];
    const matchedCourseCodes = matchedCourses
      .filter(m => m.creditGranted && m.ttuEquivalent)
      .map(m => m.ttuEquivalent);

    console.log('\n=== EVALUATE SPECIFIC COURSES ===');
    console.log('Required courses:', requiredCourses);
    console.log('Matched course codes:', matchedCourseCodes);

    const foundCourses = [];
    const missingCourses = [];

    for (const requiredCourse of requiredCourses) {
      // Handle both string format and object format {code, name, credits, minGrade}
      const courseCode = typeof requiredCourse === 'string' 
        ? requiredCourse 
        : requiredCourse.code;
      
      const courseName = typeof requiredCourse === 'string'
        ? requiredCourse
        : `${courseCode} (${requiredCourse.name || 'No name'})`;
      
      const minGrade = typeof requiredCourse === 'string' ? 'C' : (requiredCourse.minGrade || 'C');
      
      console.log(`Checking required course: ${courseName} (Min Grade: ${minGrade})`);
      
      const match = matchedCourses.find(m => 
        this.courseCodesMatch(m.ttuEquivalent, courseCode)
      );

      if (match) {
        // Check if grade meets minimum requirement
        const meetsGradeRequirement = this.checkGradeRequirement(match.grade, minGrade);
        
        if (meetsGradeRequirement) {
          console.log(`  ✓ Found match for ${courseCode} with grade ${match.grade} (meets min ${minGrade})`);
          foundCourses.push(courseName);
          result.matchedCourses.push(match);
        } else {
          console.log(`  ✗ Course ${courseCode} found but grade ${match.grade} does not meet minimum ${minGrade}`);
          missingCourses.push(`${courseName} (grade ${match.grade} < required ${minGrade})`);
        }
      } else {
        console.log(`  ✗ No match for ${courseCode}`);
        missingCourses.push(courseName);
      }
    }

    console.log('Found courses:', foundCourses);
    console.log('Missing courses:', missingCourses);

    result.met = missingCourses.length === 0;
    result.details = result.met 
      ? `All required courses completed: ${foundCourses.join(', ')}`
      : `Missing courses: ${missingCourses.join(', ')}`;
    result.missingElements = missingCourses;

    return result;
  }

  /**
   * Evaluate credit hour requirements
   */
  evaluateCreditHours(requirement, matchedCourses, result) {
    const requiredCredits = requirement.credits || 0;
    const category = requirement.category;

    // Filter courses by category if specified
    let relevantCourses = matchedCourses.filter(m => m.creditGranted);
    
    if (requirement.courses && requirement.courses.length > 0) {
      // Specific courses for credit requirement
      relevantCourses = relevantCourses.filter(m =>
        requirement.courses.some(rc => this.courseCodesMatch(m.ttuEquivalent, rc))
      );
    }

    const earnedCredits = relevantCourses.reduce((sum, course) => 
      sum + (course.ttuCredits || course.credits || 0), 0
    );

    result.met = earnedCredits >= requiredCredits;
    result.details = `Earned ${earnedCredits} of ${requiredCredits} required credits`;
    result.matchedCourses = relevantCourses;
    
    if (!result.met) {
      result.missingElements = [`${requiredCredits - earnedCredits} more credits needed`];
    }

    return result;
  }

  /**
   * Evaluate grade requirements
   */
  evaluateGradeRequirement(requirement, matchedCourses, result) {
    const minGrade = requirement.minGrade || 'C';
    const minCourses = requirement.minCourses || 1;
    const requiredCourses = requirement.courses || [];

    const gradeValues = { 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'F': 0 };
    const minGradeValue = gradeValues[minGrade.charAt(0).toUpperCase()] || 2;

    let qualifyingCourses = matchedCourses.filter(m => {
      if (!m.creditGranted || !m.grade) return false;
      
      const courseGrade = m.grade.charAt(0).toUpperCase();
      const gradeValue = gradeValues[courseGrade] || 0;
      
      // Check if course is in required list (if specified)
      const isRequiredCourse = requiredCourses.length === 0 || 
        requiredCourses.some(rc => this.courseCodesMatch(m.ttuEquivalent, rc));
      
      return isRequiredCourse && gradeValue >= minGradeValue;
    });

    result.met = qualifyingCourses.length >= minCourses;
    result.matchedCourses = qualifyingCourses;
    result.details = `${qualifyingCourses.length} of ${minCourses} courses with grade ${minGrade} or better`;
    
    if (!result.met) {
      result.missingElements = [
        `Need ${minCourses - qualifyingCourses.length} more course(s) with grade ${minGrade} or better`
      ];
    }

    return result;
  }

  /**
   * Evaluate GPA requirements
   */
  evaluateGPARequirement(requirement, matchedCourses, result) {
    const minGPA = requirement.minGPA || 2.0;
    const category = requirement.category || 'Overall GPA';

    // Calculate GPA from matched courses
    const relevantCourses = matchedCourses.filter(m => m.creditGranted && m.grade);
    
    if (relevantCourses.length === 0) {
      result.met = false;
      result.details = 'No courses with grades to calculate GPA';
      result.missingElements = [`Minimum GPA of ${minGPA.toFixed(2)} required`];
      return result;
    }

    const gradeValues = {
      'A+': 4.0, 'A': 4.0, 'A-': 3.7,
      'B+': 3.3, 'B': 3.0, 'B-': 2.7,
      'C+': 2.3, 'C': 2.0, 'C-': 1.7,
      'D+': 1.3, 'D': 1.0, 'D-': 0.7,
      'F': 0.0
    };

    let totalPoints = 0;
    let totalCredits = 0;

    for (const course of relevantCourses) {
      const gradeValue = gradeValues[course.grade.toUpperCase().trim()];
      if (gradeValue !== undefined) {
        const credits = course.ttuCredits || course.credits || 3;
        totalPoints += gradeValue * credits;
        totalCredits += credits;
      }
    }

    const calculatedGPA = totalCredits > 0 ? totalPoints / totalCredits : 0;

    result.met = calculatedGPA >= minGPA;
    result.details = `GPA: ${calculatedGPA.toFixed(2)} (minimum required: ${minGPA.toFixed(2)})`;
    result.matchedCourses = relevantCourses;
    
    if (!result.met) {
      result.missingElements = [`GPA ${calculatedGPA.toFixed(2)} is below minimum ${minGPA.toFixed(2)}`];
    }

    console.log(`GPA Evaluation: Calculated ${calculatedGPA.toFixed(2)} vs Required ${minGPA.toFixed(2)} - ${result.met ? 'MET' : 'NOT MET'}`);

    return result;
  }

  /**
   * Evaluate elective requirements
   */
  evaluateElective(requirement, matchedCourses, result) {
    const requiredCredits = requirement.credits || 0;
    const category = requirement.category;

    // Electives are courses that count toward degree but aren't specific requirements
    const electiveCourses = matchedCourses.filter(m => m.creditGranted);
    
    const earnedCredits = electiveCourses.reduce((sum, course) => 
      sum + (course.ttuCredits || course.credits || 0), 0
    );

    result.met = earnedCredits >= requiredCredits;
    result.details = `Earned ${earnedCredits} of ${requiredCredits} elective credits`;
    result.matchedCourses = electiveCourses;
    
    if (!result.met) {
      result.missingElements = [`${requiredCredits - earnedCredits} more elective credits needed`];
    }

    return result;
  }

  /**
   * Check if two course codes match
   */
  courseCodesMatch(code1, code2) {
    if (!code1 || !code2) return false;
    
    const normalize = (code) => code.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');
    return normalize(code1) === normalize(code2);
  }

  /**
   * Check if a grade meets minimum requirement
   */
  checkGradeRequirement(studentGrade, minGrade) {
    if (!studentGrade) return false;
    
    const gradeValues = {
      'A+': 4.0, 'A': 4.0, 'A-': 3.7,
      'B+': 3.3, 'B': 3.0, 'B-': 2.7,
      'C+': 2.3, 'C': 2.0, 'C-': 1.7,
      'D+': 1.3, 'D': 1.0, 'D-': 0.7,
      'F': 0.0
    };
    
    const studentGradeNormalized = studentGrade.toUpperCase().trim();
    const minGradeNormalized = minGrade.toUpperCase().trim();
    
    const studentValue = gradeValues[studentGradeNormalized];
    const minValue = gradeValues[minGradeNormalized];
    
    if (studentValue === undefined || minValue === undefined) {
      console.warn(`Unknown grade: student=${studentGrade}, min=${minGrade}`);
      return true; // Default to passing if grade format unknown
    }
    
    return studentValue >= minValue;
  }

  /**
   * Generate comprehensive analysis using AI
   */
  async generateComprehensiveAnalysis(program, matchedCourses, evaluationResults) {
    try {
      // Extract missing courses ONLY from evaluation results to prevent AI hallucination
      const missingCourses = [];
      for (const result of evaluationResults) {
        if (!result.met && result.missingElements && result.missingElements.length > 0) {
          missingCourses.push(...result.missingElements);
        }
      }

      console.log('Missing courses extracted from evaluation:', missingCourses);

      const prompt = `
You are an academic advisor analyzing a student's eligibility for a degree program.

PROGRAM: ${program.name} (${program.code})
TOTAL CREDITS REQUIRED: ${program.totalCredits}

STUDENT'S COMPLETED COURSES:
${matchedCourses.filter(m => m.creditGranted).map(m => 
  `- ${m.ttuEquivalent || m.originalCourse}: ${m.credits} credits, Grade: ${m.grade}`
).join('\n')}

REQUIREMENT EVALUATION:
${evaluationResults.map(r => 
  `- ${r.category}: ${r.met ? '✓ MET' : '✗ NOT MET'} - ${r.details}`
).join('\n')}

MISSING COURSES (from evaluation above):
${missingCourses.length > 0 ? missingCourses.join(', ') : 'None - all requirements met'}

CRITICAL INSTRUCTION: You must ONLY use the missing courses listed above. DO NOT add any courses that are not explicitly listed in the "MISSING COURSES" section. DO NOT infer or suggest courses from other programs or general knowledge.

Provide a comprehensive analysis:

1. Overall eligibility assessment
2. Recommended course of action
3. Timeline estimate for completion
4. Any concerns or special considerations

Respond with JSON:
{
  "summary": "Brief overall assessment for THIS PROGRAM ONLY",
  "eligibility": "eligible" | "conditional" | "not_eligible",
  "actionItems": [
    {
      "priority": "high" | "medium" | "low",
      "action": "Specific action to take",
      "details": "Additional context"
    }
  ],
  "timelineEstimate": "Estimated time to complete requirements",
  "concerns": ["Any concerns or special notes"],
  "recommendations": ["Specific recommendations for the student"]
}
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert academic advisor specializing in degree requirement evaluation and student guidance. You MUST only use the data provided and never add courses from external knowledge or other programs."
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
      
      // Force the missing courses to be ONLY what we extracted
      aiResult.missingCourses = missingCourses;
      
      return aiResult;

    } catch (error) {
      console.error('AI analysis error:', error);
      return {
        summary: 'Analysis unavailable',
        eligibility: 'conditional',
        missingCourses: [],
        actionItems: [],
        timelineEstimate: 'Unknown',
        concerns: ['AI analysis failed'],
        recommendations: ['Manual review recommended']
      };
    }
  }

  /**
   * Determine eligibility based on completion percentage
   */
  determineEligibility(completionPercentage, evaluationResults) {
    if (completionPercentage === 100) {
      return 'eligible';
    } else if (completionPercentage >= 80) {
      // Check if only minor requirements are missing
      const unmetRequirements = evaluationResults.filter(r => !r.met);
      const hasCriticalMissing = unmetRequirements.some(r => 
        r.type === 'specific_courses' && r.category.toLowerCase().includes('core')
      );
      return hasCriticalMissing ? 'conditional' : 'conditional';
    } else {
      return 'not_eligible';
    }
  }

  /**
   * Generate final report
   */
  async generateFinalReport(evaluation, matchedCourses) {
    const report = {
      summary: evaluation.comprehensiveAnalysis.summary,
      eligibility: evaluation.eligibility,
      programName: evaluation.programName,
      completionPercentage: evaluation.completionPercentage,
      metRequirements: evaluation.metRequirements,
      totalRequirements: evaluation.totalRequirements,
      missingCourses: evaluation.comprehensiveAnalysis.missingCourses,
      actionItems: evaluation.comprehensiveAnalysis.actionItems,
      recommendations: evaluation.comprehensiveAnalysis.recommendations,
      detailedBreakdown: {
        completedCourses: matchedCourses.filter(m => m.creditGranted).map(m => ({
          course: m.ttuEquivalent || m.originalCourse,
          credits: m.ttuCredits || m.credits,
          grade: m.grade
        })),
        unmetRequirements: evaluation.unmetRequirements.map(r => ({
          category: r.category,
          description: r.description,
          missingElements: r.missingElements
        }))
      },
      generatedAt: Date.now()
    };

    return report;
  }
}

module.exports = RequirementEvaluatorService;
