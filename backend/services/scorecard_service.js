const { OpenAI } = require('openai');

class ScorecardService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate comprehensive scorecard for student transcript evaluation
   */
  async generateScorecard(transcriptData, degreePlans, transferEquivalencies) {
    try {
      const scorecard = {
        studentInfo: {
          name: transcriptData.studentName || 'Unknown Student',
          id: transcriptData.studentId || 'Unknown ID',
          fromState: transcriptData.fromState,
          evaluationDate: new Date().toISOString()
        },
        transcriptSummary: transcriptData.standardizedData.summary,
        degreeEvaluations: [],
        overallRecommendations: [],
        needsLLMReview: false,
        llmReviewSections: []
      };

      // Evaluate each degree plan
      for (const degreePlan of degreePlans) {
        const evaluation = await this.evaluateDegreeRequirements(
          transcriptData.standardizedData,
          degreePlan.analyzedData,
          transferEquivalencies
        );
        
        scorecard.degreeEvaluations.push({
          degreeId: degreePlan.id,
          degreeName: degreePlan.analyzedData.degrees?.[0]?.name || degreePlan.fileName,
          degreeCode: degreePlan.analyzedData.degrees?.[0]?.code || '',
          ...evaluation
        });
      }

      // Generate overall recommendations
      scorecard.overallRecommendations = await this.generateOverallRecommendations(scorecard);
      
      // Identify sections needing LLM review
      scorecard.needsLLMReview = scorecard.degreeEvaluations.some(e => e.needsLLMReview);
      
      if (scorecard.needsLLMReview) {
        scorecard.llmReviewSections = await this.identifyLLMReviewSections(scorecard);
      }

      return {
        success: true,
        scorecard
      };

    } catch (error) {
      console.error('Error generating scorecard:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Evaluate student against specific degree requirements
   */
  async evaluateDegreeRequirements(transcriptData, degreeData, transferEquivalencies) {
    try {
      const courses = transcriptData.courses;
      const degree = degreeData.degrees?.[0] || {};
      const requirements = degree.requirements || [];
      
      const evaluation = {
        totalTransferableCredits: transcriptData.summary.totalCredits,
        requirementsMet: [],
        requirementsNotMet: [],
        additionalCreditsNeeded: 0,
        admissionStatus: 'pending',
        needsLLMReview: false,
        detailedAnalysis: {}
      };

      // Evaluate each requirement category
      for (const requirement of requirements) {
        const requirementEvaluation = await this.evaluateRequirement(
          courses,
          requirement,
          transferEquivalencies
        );
        
        evaluation.detailedAnalysis[requirement.category] = requirementEvaluation;
        
        if (requirementEvaluation.isMet) {
          evaluation.requirementsMet.push({
            category: requirement.category,
            credits: requirementEvaluation.creditsCompleted,
            courses: requirementEvaluation.matchedCourses,
            type: requirement.type
          });
        } else {
          evaluation.requirementsNotMet.push({
            category: requirement.category,
            creditsRequired: requirement.credits,
            creditsCompleted: requirementEvaluation.creditsCompleted,
            creditsNeeded: requirement.credits - requirementEvaluation.creditsCompleted,
            missingCourses: requirementEvaluation.missingCourses,
            type: requirement.type
          });
          
          evaluation.additionalCreditsNeeded += requirement.credits - requirementEvaluation.creditsCompleted;
        }
      }

      // Determine admission status
      evaluation.admissionStatus = this.determineAdmissionStatus(evaluation, degree);
      
      // Check if LLM review is needed
      evaluation.needsLLMReview = this.needsLLMReview(evaluation, courses);

      return evaluation;

    } catch (error) {
      console.error('Error evaluating degree requirements:', error);
      return {
        totalTransferableCredits: 0,
        requirementsMet: [],
        requirementsNotMet: [],
        additionalCreditsNeeded: 999,
        admissionStatus: 'error',
        needsLLMReview: true,
        error: error.message
      };
    }
  }

  /**
   * Evaluate a specific requirement category
   */
  async evaluateRequirement(courses, requirement, transferEquivalencies) {
    try {
      let evaluation = {
        category: requirement.category,
        type: requirement.type,
        creditsRequired: requirement.credits || 0,
        creditsCompleted: 0,
        isMet: false,
        matchedCourses: [],
        missingCourses: [],
        confidence: 0.8
      };

      if (requirement.type === 'specific_courses') {
        // Check for specific required courses
        evaluation = await this.evaluateSpecificCourses(courses, requirement, transferEquivalencies);
      } else if (requirement.type === 'credit_hours') {
        // Check for total credit hours in category
        evaluation = await this.evaluateCreditHours(courses, requirement, transferEquivalencies);
      } else if (requirement.type === 'elective') {
        // Check for elective requirements
        evaluation = await this.evaluateElectives(courses, requirement, transferEquivalencies);
      }

      return evaluation;

    } catch (error) {
      console.error('Error evaluating requirement:', error);
      return {
        category: requirement.category,
        creditsCompleted: 0,
        isMet: false,
        error: error.message
      };
    }
  }

  /**
   * Evaluate specific course requirements
   */
  async evaluateSpecificCourses(courses, requirement, transferEquivalencies) {
    const requiredCourses = requirement.courses || [];
    const matchedCourses = [];
    const missingCourses = [];
    let creditsCompleted = 0;

    for (const requiredCourse of requiredCourses) {
      const match = this.findCourseMatch(requiredCourse, courses);
      
      if (match) {
        matchedCourses.push({
          requiredCourse,
          matchedCourse: match.course,
          transferStatus: match.transferStatus,
          credits: match.transferCredits || match.credits
        });
        creditsCompleted += match.transferCredits || match.credits;
      } else {
        missingCourses.push(requiredCourse);
      }
    }

    return {
      category: requirement.category,
      type: 'specific_courses',
      creditsRequired: requirement.credits || 0,
      creditsCompleted,
      isMet: missingCourses.length === 0,
      matchedCourses,
      missingCourses,
      confidence: matchedCourses.length > 0 ? 0.9 : 0.5
    };
  }

  /**
   * Evaluate credit hour requirements
   */
  async evaluateCreditHours(courses, requirement, transferEquivalencies) {
    const subjectArea = requirement.subjectArea || '';
    let creditsCompleted = 0;
    const matchedCourses = [];

    for (const course of courses) {
      if (this.courseMatchesSubjectArea(course, subjectArea)) {
        creditsCompleted += course.transferCredits || course.credits;
        matchedCourses.push({
          course,
          transferStatus: course.transferStatus,
          credits: course.transferCredits || course.credits
        });
      }
    }

    return {
      category: requirement.category,
      type: 'credit_hours',
      creditsRequired: requirement.credits || 0,
      creditsCompleted,
      isMet: creditsCompleted >= (requirement.credits || 0),
      matchedCourses,
      confidence: 0.8
    };
  }

  /**
   * Evaluate elective requirements
   */
  async evaluateElectives(courses, requirement, transferEquivalencies) {
    const electiveArea = requirement.electiveArea || '';
    let creditsCompleted = 0;
    const matchedCourses = [];

    for (const course of courses) {
      if (this.courseMatchesElectiveArea(course, electiveArea)) {
        creditsCompleted += course.transferCredits || course.credits;
        matchedCourses.push({
          course,
          transferStatus: course.transferStatus,
          credits: course.transferCredits || course.credits
        });
      }
    }

    return {
      category: requirement.category,
      type: 'elective',
      creditsRequired: requirement.credits || 0,
      creditsCompleted,
      isMet: creditsCompleted >= (requirement.credits || 0),
      matchedCourses,
      confidence: 0.7
    };
  }

  /**
   * Find matching course for specific requirement
   */
  findCourseMatch(requiredCourse, courses) {
    // First try exact match with Texas Tech course
    const exactMatch = courses.find(course => 
      course.texasTechCourse === requiredCourse ||
      course.courseCode === requiredCourse
    );
    
    if (exactMatch) {
      return exactMatch;
    }

    // Try fuzzy matching
    const fuzzyMatch = courses.find(course => {
      const courseCode = course.courseCode.toLowerCase();
      const required = requiredCourse.toLowerCase();
      
      return courseCode.includes(required) || required.includes(courseCode);
    });
    
    return fuzzyMatch || null;
  }

  /**
   * Check if course matches subject area
   */
  courseMatchesSubjectArea(course, subjectArea) {
    if (!subjectArea) return true;
    
    const courseCode = course.courseCode.toUpperCase();
    const courseName = course.courseName.toUpperCase();
    const area = subjectArea.toUpperCase();
    
    // Check course code prefix
    const codePrefix = courseCode.split(' ')[0];
    if (codePrefix === area) return true;
    
    // Check course name keywords
    const areaKeywords = {
      'MATH': ['MATHEMATICS', 'CALCULUS', 'ALGEBRA', 'STATISTICS'],
      'ENGL': ['ENGLISH', 'COMPOSITION', 'WRITING', 'LITERATURE'],
      'HIST': ['HISTORY'],
      'GOVT': ['GOVERNMENT', 'POLITICAL'],
      'BIOL': ['BIOLOGY'],
      'CHEM': ['CHEMISTRY'],
      'PHYS': ['PHYSICS'],
      'PSYC': ['PSYCHOLOGY'],
      'SOCI': ['SOCIOLOGY']
    };
    
    const keywords = areaKeywords[area] || [area];
    return keywords.some(keyword => courseName.includes(keyword));
  }

  /**
   * Check if course matches elective area
   */
  courseMatchesElectiveArea(course, electiveArea) {
    if (!electiveArea) return true;
    
    // Similar logic to subject area matching but more flexible for electives
    return this.courseMatchesSubjectArea(course, electiveArea);
  }

  /**
   * Determine admission status
   */
  determineAdmissionStatus(evaluation, degree) {
    const totalCreditsRequired = degree.totalCredits || 120;
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
   * Check if LLM review is needed
   */
  needsLLMReview(evaluation, courses) {
    // Flag for LLM review if:
    // 1. Many courses have pending review status
    const pendingReviewCount = courses.filter(c => c.transferStatus === 'pending_review').length;
    if (pendingReviewCount > 3) return true;
    
    // 2. Low confidence in course matching
    const lowConfidenceCourses = courses.filter(c => c.confidence < 0.7).length;
    if (lowConfidenceCourses > 2) return true;
    
    // 3. Unusual credit patterns
    if (evaluation.totalTransferableCredits < 30 || evaluation.totalTransferableCredits > 150) {
      return true;
    }
    
    return false;
  }

  /**
   * Generate overall recommendations
   */
  async generateOverallRecommendations(scorecard) {
    try {
      const recommendations = [];
      const evaluations = scorecard.degreeEvaluations;
      
      // Find best matching degree
      const bestMatch = evaluations.reduce((best, current) => {
        const bestScore = this.calculateEligibilityScore(best);
        const currentScore = this.calculateEligibilityScore(current);
        return currentScore > bestScore ? current : best;
      });
      
      recommendations.push({
        type: 'best_match',
        degree: bestMatch.degreeName,
        reason: `Highest eligibility score with ${bestMatch.totalTransferableCredits} transferable credits`,
        action: 'recommend'
      });
      
      // Credit recommendations
      if (bestMatch.additionalCreditsNeeded > 0) {
        recommendations.push({
          type: 'credit_deficit',
          creditsNeeded: bestMatch.additionalCreditsNeeded,
          reason: `Additional ${bestMatch.additionalCreditsNeeded} credits needed for full eligibility`,
          action: 'complete_courses'
        });
      }
      
      // Course-specific recommendations
      for (const evaluation of evaluations) {
        for (const unmetReq of evaluation.requirementsNotMet) {
          if (unmetReq.missingCourses.length > 0) {
            recommendations.push({
              type: 'missing_courses',
              degree: evaluation.degreeName,
              category: unmetReq.category,
              courses: unmetReq.missingCourses,
              reason: `Specific courses required for ${unmetReq.category}`,
              action: 'complete_specific_courses'
            });
          }
        }
      }
      
      return recommendations;

    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [{
        type: 'error',
        reason: 'Unable to generate recommendations',
        action: 'manual_review'
      }];
    }
  }

  /**
   * Calculate eligibility score for a degree evaluation
   */
  calculateEligibilityScore(evaluation) {
    let score = 0;
    
    // Credits factor (40%)
    const creditScore = Math.min(evaluation.totalTransferableCredits / 120, 1) * 40;
    score += creditScore;
    
    // Requirements met factor (40%)
    const totalReqs = evaluation.requirementsMet.length + evaluation.requirementsNotMet.length;
    const metReqs = totalReqs > 0 ? evaluation.requirementsMet.length / totalReqs : 0;
    score += metReqs * 40;
    
    // Admission status factor (20%)
    const statusScores = {
      'eligible': 20,
      'conditionally_eligible': 15,
      'needs_review': 10,
      'not_eligible': 0
    };
    score += statusScores[evaluation.admissionStatus] || 0;
    
    return score;
  }

  /**
   * Identify sections that need LLM review
   */
  async identifyLLMReviewSections(scorecard) {
    const reviewSections = [];
    
    for (const evaluation of scorecard.degreeEvaluations) {
      if (evaluation.needsLLMReview) {
        reviewSections.push({
          degreeId: evaluation.degreeId,
          degreeName: evaluation.degreeName,
          section: 'course_matching',
          reason: 'Some courses could not be automatically matched',
          courses: this.getCoursesNeedingReview(evaluation)
        });
      }
    }
    
    return reviewSections;
  }

  /**
   * Get courses that need LLM review
   */
  getCoursesNeedingReview(evaluation) {
    const coursesNeedingReview = [];
    
    // Collect courses with pending review status
    for (const reqMet of evaluation.requirementsMet) {
      for (const course of reqMet.courses) {
        if (course.transferStatus === 'pending_review') {
          coursesNeedingReview.push(course);
        }
      }
    }
    
    return coursesNeedingReview;
  }

  /**
   * Apply LLM verification to scorecard section
   */
  async applyLLMVerification(scorecard, section, llmProposedChanges) {
    try {
      let updatedScorecard = { ...scorecard };
      
      // Apply the proposed changes to the specific section
      if (section.includes('course_matching')) {
        updatedScorecard = await this.applyCourseMatchingChanges(
          updatedScorecard, 
          llmProposedChanges
        );
      }
      
      return {
        success: true,
        updatedScorecard,
        appliedChanges: llmProposedChanges
      };

    } catch (error) {
      console.error('Error applying LLM verification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Apply course matching changes from LLM
   */
  async applyCourseMatchingChanges(scorecard, proposedChanges) {
    const updatedScorecard = { ...scorecard };
    
    // Find the degree evaluation to update
    for (const evaluation of updatedScorecard.degreeEvaluations) {
      if (evaluation.degreeId === proposedChanges.degreeId) {
        
        // Update the specific course matching
        for (const change of proposedChanges.changes) {
          const courseIndex = evaluation.detailedAnalysis[change.category]?.matchedCourses?.findIndex(
            c => c.course.courseCode === change.originalCourseCode
          );
          
          if (courseIndex !== -1) {
            // Update the course with LLM's proposed change
            evaluation.detailedAnalysis[change.category].matchedCourses[courseIndex] = {
              ...evaluation.detailedAnalysis[change.category].matchedCourses[courseIndex],
              transferStatus: 'llm_verified',
              texasTechCourse: change.proposedTexasTechCourse,
              transferCredits: change.proposedCredits,
              llmVerification: {
                originalMatch: change.originalMatch,
                proposedMatch: change.proposedMatch,
                confidence: change.confidence,
                reasoning: change.reasoning
              }
            };
          }
        }
        
        break;
      }
    }
    
    return updatedScorecard;
  }
}

module.exports = ScorecardService;
