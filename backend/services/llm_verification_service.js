const { OpenAI } = require('openai');

class LLMVerificationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Verify courses against program requirements including grade validation
   */
  async verifyCoursesAgainstRequirements(matchedCourses, programRequirements, programName) {
    try {
      console.log('\n=== LLM VERIFICATION AGAINST PROGRAM REQUIREMENTS ===');
      console.log(`Program: ${programName}`);
      console.log(`Total matched courses: ${matchedCourses.length}`);
      console.log(`Program requirements: ${programRequirements.length}`);

      const verifications = [];
      
      for (const requirement of programRequirements) {
        if (requirement.type === 'specific_courses' && requirement.courses) {
          for (const requiredCourse of requirement.courses) {
            const courseCode = typeof requiredCourse === 'string' ? requiredCourse : requiredCourse.code;
            const minGrade = typeof requiredCourse === 'string' ? 'C' : (requiredCourse.minGrade || 'C');
            const courseName = typeof requiredCourse === 'string' ? requiredCourse : requiredCourse.name;

            // Find matching course in student's transcript
            const matchedCourse = matchedCourses.find(m => 
              m.ttuEquivalent && this.courseCodesMatch(m.ttuEquivalent, courseCode)
            );

            const verification = await this.verifyRequirementMatch(
              requiredCourse,
              matchedCourse,
              minGrade,
              programName
            );

            verifications.push(verification);
          }
        }
      }

      console.log(`Completed ${verifications.length} verifications`);
      console.log('=== END LLM VERIFICATION ===\n');

      return {
        success: true,
        verifications,
        summary: this.generateRequirementVerificationSummary(verifications)
      };

    } catch (error) {
      console.error('Error in LLM requirement verification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify a single requirement match including grade validation
   */
  async verifyRequirementMatch(requiredCourse, matchedCourse, minGrade, programName) {
    try {
      const courseCode = typeof requiredCourse === 'string' ? requiredCourse : requiredCourse.code;
      const courseName = typeof requiredCourse === 'string' ? requiredCourse : requiredCourse.name;

      if (!matchedCourse) {
        return {
          requirementCourse: courseCode,
          matched: false,
          reason: 'Course not found in transcript',
          gradeValid: false,
          details: `${courseCode} is required but not completed`
        };
      }

      // Check grade requirement
      const gradeValid = this.checkGradeRequirement(matchedCourse.grade, minGrade);

      const prompt = `
You are verifying if a student's course meets the requirements for ${programName}.

REQUIRED COURSE:
- Code: ${courseCode}
- Name: ${courseName || 'N/A'}
- Minimum Grade Required: ${minGrade}

STUDENT'S COURSE:
- Original Course: ${matchedCourse.originalCourse}
- TTU Equivalent: ${matchedCourse.ttuEquivalent}
- Grade Earned: ${matchedCourse.grade}
- Credits: ${matchedCourse.credits}

GRADE VALIDATION:
- Grade meets minimum requirement: ${gradeValid ? 'YES' : 'NO'}
- Student grade: ${matchedCourse.grade}
- Required minimum: ${minGrade}

TASK:
Verify if this course match is valid and if the grade meets requirements.

RESPOND WITH JSON:
{
  "isValid": true/false,
  "gradeAcceptable": true/false,
  "reasoning": "Explain why this course does or does not meet requirements",
  "concerns": ["List any concerns about the match or grade"],
  "recommendation": "approve" | "reject" | "manual_review"
}
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert academic advisor verifying course requirements. You must strictly enforce grade requirements and course equivalencies."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const verification = JSON.parse(response.choices[0].message.content);

      return {
        requirementCourse: courseCode,
        matchedCourse: matchedCourse.ttuEquivalent,
        studentGrade: matchedCourse.grade,
        minGradeRequired: minGrade,
        gradeValid,
        matched: true,
        verification,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error verifying requirement match:', error);
      return {
        requirementCourse: typeof requiredCourse === 'string' ? requiredCourse : requiredCourse.code,
        matched: false,
        gradeValid: false,
        error: error.message
      };
    }
  }

  /**
   * Check if grade meets minimum requirement
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
    
    const studentValue = gradeValues[studentGrade.toUpperCase().trim()];
    const minValue = gradeValues[minGrade.toUpperCase().trim()];
    
    if (studentValue === undefined || minValue === undefined) {
      return true; // Default to passing if grade format unknown
    }
    
    return studentValue >= minValue;
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
   * Generate summary for requirement verifications
   */
  generateRequirementVerificationSummary(verifications) {
    const total = verifications.length;
    const matched = verifications.filter(v => v.matched).length;
    const gradeValid = verifications.filter(v => v.gradeValid).length;
    const approved = verifications.filter(v => 
      v.verification?.recommendation === 'approve'
    ).length;
    const rejected = verifications.filter(v => 
      v.verification?.recommendation === 'reject'
    ).length;
    const needsReview = verifications.filter(v => 
      v.verification?.recommendation === 'manual_review'
    ).length;

    return {
      totalRequirements: total,
      coursesMatched: matched,
      gradesValid: gradeValid,
      approved,
      rejected,
      needsManualReview: needsReview,
      completionRate: total > 0 ? (approved / total * 100).toFixed(1) : 0
    };
  }

  /**
   * Review and verify course matches that need LLM intervention
   */
  async reviewCourseMatches(scorecard, coursesNeedingReview) {
    try {
      const verifications = [];
      
      for (const courseReview of coursesNeedingReview) {
        const verification = await this.verifyIndividualCourse(scorecard, courseReview);
        verifications.push(verification);
      }
      
      return {
        success: true,
        verifications,
        summary: this.generateVerificationSummary(verifications)
      };

    } catch (error) {
      console.error('Error in LLM course verification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify individual course matching
   */
  async verifyIndividualCourse(scorecard, courseReview) {
    try {
      const prompt = `
You are an expert academic advisor at Texas Tech University reviewing transfer credit evaluations.

STUDENT INFORMATION:
- Name: ${scorecard.studentInfo.name}
- From State: ${scorecard.studentInfo.fromState}

COURSE TO VERIFY:
- Original Course: ${courseReview.courseCode} - ${courseReview.courseName}
- Original Credits: ${courseReview.credits}
- Original Grade: ${courseReview.grade}
- Current Transfer Status: ${courseReview.transferStatus}


TASK:
Analyze the original course and determine if it should transfer to a specific Texas Tech course. Consider:

1. Course code similarity and numbering system
2. Course title and content description
3. Credit hour alignment
4. Grade requirements (must be C or better for transfer)
5. Common transfer patterns from ${scorecard.studentInfo.fromState}

RESPOND WITH JSON:
{
  "shouldTransfer": true,
  "texasTechCourse": "COURSE CODE",
  "confidence": 0.95,
  "reasoning": "Explain why this course should transfer based on course content, numbering, and credit alignment.",
  "alternativeMatches": [
    {
      "course": "ALTERNATIVE COURSE CODE",
      "confidence": 0.85,
      "reason": "Brief explanation"
    }
  ],
  "notes": "Additional context about the transfer decision"
}

If the course should NOT transfer, set shouldTransfer to false and explain why.
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert academic advisor specializing in Texas Tech University transfer credit evaluation. You have deep knowledge of course equivalencies across all 50 states and understand the nuances of course numbering systems and content alignment."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const verification = JSON.parse(response.choices[0].message.content);
      
      return {
        originalCourse: courseReview,
        verification,
        verificationId: this.generateVerificationId(),
        timestamp: new Date().toISOString(),
        status: 'pending_advisor_approval'
      };

    } catch (error) {
      console.error('Error verifying individual course:', error);
      return {
        originalCourse: courseReview,
        verification: {
          shouldTransfer: false,
          confidence: 0.1,
          reasoning: `LLM verification failed: ${error.message}`,
          notes: "Manual review required due to system error"
        },
        verificationId: this.generateVerificationId(),
        timestamp: new Date().toISOString(),
        status: 'error'
      };
    }
  }

  /**
   * Generate verification summary
   */
  generateVerificationSummary(verifications) {
    const total = verifications.length;
    const approved = verifications.filter(v => v.verification.shouldTransfer).length;
    const rejected = verifications.filter(v => !v.verification.shouldTransfer).length;
    const highConfidence = verifications.filter(v => v.verification.confidence >= 0.8).length;
    
    return {
      totalCourses: total,
      recommendedForTransfer: approved,
      recommendedForRejection: rejected,
      highConfidenceMatches: highConfidence,
      averageConfidence: verifications.reduce((sum, v) => sum + v.verification.confidence, 0) / total
    };
  }

  /**
   * Apply approved LLM verification to scorecard
   */
  async applyVerificationToScorecard(scorecard, verification) {
    try {
      const updatedScorecard = { ...scorecard };
      
      // Find the degree evaluation that contains this course
      for (const evaluation of updatedScorecard.degreeEvaluations) {
        
        // Search through all requirement categories
        for (const [category, categoryData] of Object.entries(evaluation.detailedAnalysis)) {
          if (categoryData.matchedCourses) {
            
            // Find the course to update
            const courseIndex = categoryData.matchedCourses.findIndex(
              c => c.course.courseCode === verification.originalCourse.courseCode
            );
            
            if (courseIndex !== -1) {
              const course = categoryData.matchedCourses[courseIndex];
              
              // Apply the LLM verification
              if (verification.verification.shouldTransfer) {
                course.transferStatus = 'llm_verified_approved';
                course.texasTechCourse = verification.verification.texasTechCourse;
                course.transferCredits = this.getCreditsForCourse(verification.verification.texasTechCourse);
                course.llmVerification = {
                  verificationId: verification.verificationId,
                  originalMatch: course.transferStatus,
                  proposedMatch: verification.verification.texasTechCourse,
                  confidence: verification.verification.confidence,
                  reasoning: verification.verification.reasoning,
                  approvedAt: new Date().toISOString()
                };
              } else {
                course.transferStatus = 'llm_verified_rejected';
                course.llmVerification = {
                  verificationId: verification.verificationId,
                  originalMatch: course.transferStatus,
                  proposedMatch: null,
                  confidence: verification.verification.confidence,
                  reasoning: verification.verification.reasoning,
                  rejectedAt: new Date().toISOString()
                };
              }
              
              // Update the evaluation metrics
              this.updateEvaluationMetrics(evaluation);
              break;
            }
          }
        }
      }
      
      return {
        success: true,
        updatedScorecard,
        appliedVerification: verification
      };

    } catch (error) {
      console.error('Error applying verification to scorecard:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get credits for a Texas Tech course
   */
  getCreditsForCourse(ttuCourse) {
    const courseCredits = {
      'ENGL 1301': 3, 'ENGL 1302': 3,
      'MATH 1451': 4, 'MATH 1452': 4,
      'HIST 2300': 3, 'HIST 2301': 3,
      'GOVT 2305': 3, 'GOVT 2306': 3,
      'BIOL 1403': 4, 'BIOL 1404': 4,
      'CHEM 1307': 3, 'CHEM 1107': 1,
      'PHYS 1308': 3, 'PHYS 1108': 1,
      'COMM 2300': 3,
      'PSYC 2301': 3,
      'SOCI 1301': 3
    };
    
    return courseCredits[ttuCourse] || 3; // Default to 3 credits
  }

  /**
   * Update evaluation metrics after applying verification
   */
  updateEvaluationMetrics(evaluation) {
    let totalTransferableCredits = 0;
    let requirementsMet = [];
    let requirementsNotMet = [];
    
    // Recalculate credits and requirements
    for (const [category, categoryData] of Object.entries(evaluation.detailedAnalysis)) {
      if (categoryData.matchedCourses) {
        const categoryCredits = categoryData.matchedCourses.reduce((sum, course) => {
          if (course.transferStatus === 'transferred' || course.transferStatus === 'llm_verified_approved') {
            return sum + (course.transferCredits || course.credits);
          }
          return sum;
        }, 0);
        
        categoryData.creditsCompleted = categoryCredits;
        categoryData.isMet = categoryCredits >= categoryData.creditsRequired;
        
        totalTransferableCredits += categoryCredits;
        
        if (categoryData.isMet) {
          requirementsMet.push({
            category,
            credits: categoryCredits,
            courses: categoryData.matchedCourses.filter(c => 
              c.transferStatus === 'transferred' || c.transferStatus === 'llm_verified_approved'
            )
          });
        } else {
          requirementsNotMet.push({
            category,
            creditsRequired: categoryData.creditsRequired,
            creditsCompleted: categoryCredits,
            creditsNeeded: categoryData.creditsRequired - categoryCredits
          });
        }
      }
    }
    
    evaluation.totalTransferableCredits = totalTransferableCredits;
    evaluation.requirementsMet = requirementsMet;
    evaluation.requirementsNotMet = requirementsNotMet;
    
    // Update admission status
    evaluation.admissionStatus = this.determineAdmissionStatus(evaluation);
  }

  /**
   * Determine admission status after updates
   */
  determineAdmissionStatus(evaluation) {
    const totalCreditsRequired = 120; // Standard assumption
    const creditsCompleted = evaluation.totalTransferableCredits;
    
    if (evaluation.requirementsNotMet.length === 0 && creditsCompleted >= totalCreditsRequired) {
      return 'eligible';
    } else if (evaluation.requirementsNotMet.length <= 2 && evaluation.additionalCreditsNeeded <= 12) {
      return 'conditionally_eligible';
    } else if (creditsCompleted >= 60) {
      return 'needs_review';
    } else {
      return 'not_eligible';
    }
  }

  /**
   * Generate verification ID
   */
  generateVerificationId() {
    return `llm_ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Batch verify multiple courses
   */
  async batchVerifyCourses(scorecard, courseReviews) {
    try {
      const results = [];
      
      // Process courses in batches to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < courseReviews.length; i += batchSize) {
        const batch = courseReviews.slice(i, i + batchSize);
        const batchPromises = batch.map(course => this.verifyIndividualCourse(scorecard, course));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches
        if (i + batchSize < courseReviews.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      return {
        success: true,
        verifications: results,
        summary: this.generateVerificationSummary(results)
      };

    } catch (error) {
      console.error('Error in batch verification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get verification statistics
   */
  getVerificationStatistics(verifications) {
    const stats = {
      total: verifications.length,
      approved: 0,
      rejected: 0,
      pending: 0,
      highConfidence: 0,
      averageConfidence: 0,
      byState: {},
      bySubject: {}
    };
    
    for (const verification of verifications) {
      // Status counts
      if (verification.status === 'approved') stats.approved++;
      else if (verification.status === 'rejected') stats.rejected++;
      else stats.pending++;
      
      // Confidence
      if (verification.verification.confidence >= 0.8) stats.highConfidence++;
      stats.averageConfidence += verification.verification.confidence;
      
      // Group by state (would need state info in verification)
      // Group by subject (would need subject extraction)
    }
    
    stats.averageConfidence = stats.total > 0 ? stats.averageConfidence / stats.total : 0;
    
    return stats;
  }
}

module.exports = LLMVerificationService;
