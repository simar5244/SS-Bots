/**
 * VPAT Scorecard Calculator Service
 * Calculates scores, grades, risk levels, and disability impacts from Method 1 output
 * Based on TTU VPAT SCORECARD.xlsx - Score sheet logic
 */

import { getCriterionImpact, getCriteriaByWCAGVersion, IMPACT_CATEGORIES, type CriterionImpact } from './vpat-impact-extractor';

export interface PlatformResult {
  platform: string;
  supports: number;
  partiallySupports: number;
  doesNotSupport: number;
  notApplicable: number;
}

export interface CriterionSupport {
  criterion: string;
  supports: boolean;
  partiallySupports: boolean;
  doesNotSupport: boolean;
  notApplicable: boolean;
}

export interface CriterionDetail {
  criterion: string;
  impactCategory: string;
  supportStatus: 'Supports' | 'Partially Supports' | 'Does Not Support' | 'N/A';
  points: number;
  isExclusive: boolean; // Exclusive to this WCAG version
}

export interface WCAGVersionScore {
  version: string;
  extremelyImportantNotSupported: number;
  extremelyImportantPartiallySupports: number;
  extremelyImportantSupports: number;
  somewhatImportantNotSupported: number;
  somewhatImportantPartiallySupports: number;
  somewhatImportantSupports: number;
  standardNotSupported: number;
  standardPartiallySupports: number;
  standardSupports: number;
  negligibleCount: number;
  totalCriteria: number;
  totalSupports: number;
  totalPartials: number;
  totalNotSupported: number;
  totalNA: number;
  score: number;
  perfectScore: number;
  grade: string;
  gradeRange: string;
  criteriaDetails: CriterionDetail[]; // Detailed list of all criteria
}

export interface DisabilityImpact {
  disability: string;
  totalCriteria: number;
  criteriaSupported: number;
  percentSupported: number;
  status: 'Supported' | 'Not Fully Support';
  affectedPopulationPercent: number;
  notFullySupportedCriteria: string[];
}

export interface ScorecardResult {
  wcag20Score: WCAGVersionScore;
  wcag21Score: WCAGVersionScore;
  wcag22Score: WCAGVersionScore;
  disabilityImpacts: DisabilityImpact[];
  riskLevel: string;
  resourceRequirement: string;
  overallRecommendation: string;
  userInputs: {
    studentCount: number;
    staffCount: number;
    isPublicUse: boolean;
    annualCost: number;
  };
}

// Weights from TTU VPAT SCORECARD.xlsx - Score sheet (Rows 40-43)
// These weights are used in the scoring formula for each impact category
const WEIGHTS = {
  extremelyImportant: {
    notSupported: 0.01,      // Row 41, Column B
    partiallySupports: 30,   // Row 41, Column C
    supports: 100            // Row 41, Column D
  },
  somewhatImportant: {
    notSupported: 0.01,      // Row 42, Column B
    partiallySupports: 40,   // Row 42, Column C
    supports: 100            // Row 42, Column D
  },
  standard: {
    notSupported: 0.01,      // Row 43, Column B
    partiallySupports: 50,   // Row 43, Column C
    supports: 100            // Row 43, Column D
  }
};

// US Adult Population percentages (from List by Impact sheet row 59)
const DISABILITY_POPULATION = {
  blindness: 0.0283,
  lowVision: 0.08,
  colorblindness: 0.049,
  hearingLoss: 0.057,
  cognitiveDisorders: 0.109,
  motorDisabilities: 0.11,
  epilepsy: 0.012
};

/**
 * Calculate WCAG version score based on criteria support levels
 */
function calculateWCAGScore(
  criteriaImpacts: CriterionImpact[],
  platformResults: Map<string, { supports: boolean; partiallySupports: boolean; doesNotSupport: boolean; notApplicable: boolean }>,
  wcagVersion: number,
  userCount: number = 0,
  isPublicUse: boolean = false,
  annualCost: number = 0
): WCAGVersionScore {
  let extremelyImportantNotSupported = 0;
  let extremelyImportantPartiallySupports = 0;
  let extremelyImportantSupports = 0;
  let somewhatImportantNotSupported = 0;
  let somewhatImportantPartiallySupports = 0;
  let somewhatImportantSupports = 0;
  let standardNotSupported = 0;
  let standardPartiallySupports = 0;
  let standardSupports = 0;

  // Filter criteria by WCAG version using flags
  const relevantCriteria = criteriaImpacts.filter(c => {
    if (wcagVersion === 2.0) return c.wcag20;
    if (wcagVersion === 2.1) return c.wcag21;
    if (wcagVersion === 2.2) return c.wcag22;
    return false;
  });
  
  console.log('');
  console.log(`� [WCAG ${wcagVersion}] ═══════════════════════════════════════`);
  console.log(`🔍 [WCAG ${wcagVersion}] FILTERING CRITERIA BY VERSION FLAGS`);
  console.log(`🔍 [WCAG ${wcagVersion}] Total criteria with impact data: ${criteriaImpacts.length}`);
  console.log(`🔍 [WCAG ${wcagVersion}] Criteria matching version ${wcagVersion}: ${relevantCriteria.length}`);
  console.log(`🔍 [WCAG ${wcagVersion}] Expected from Excel:`, 
    wcagVersion === 2.0 ? '38 total' : 
    wcagVersion === 2.1 ? '50 total (48 non-NA: 17 Extreme, 11 Somewhat, 20 Standard)' :
    '56 total (53 non-NA: 18 Extreme, 14 Somewhat, 21 Standard)');
  
  if (relevantCriteria.length > 0) {
    console.log(`� [WCAG ${wcagVersion}] Sample criteria (first 3):`, relevantCriteria.slice(0, 3).map(c => ({ 
      name: c.criterion.substring(0, 50), 
      wcag20: c.wcag20, 
      wcag21: c.wcag21, 
      wcag22: c.wcag22,
      impact: c.impactCategory
    })));
  }

  let processedCount = 0;
  let skippedCount = 0;
  
  console.log(`🔍 [WCAG ${wcagVersion}] Processing ${relevantCriteria.length} criteria...`);
  
  for (const impact of relevantCriteria) {
    const result = platformResults.get(impact.criterion);
    if (!result) {
      console.log(`⚠️ [WCAG ${wcagVersion}] SKIPPED - No result found for:`, impact.criterion);
      skippedCount++;
      continue;
    }

    processedCount++;
    console.log(`✅ [WCAG ${wcagVersion}] Processing: ${impact.criterion} (${impact.impactCategory})`);
    console.log(`   Result: Supports=${result.supports}, Partial=${result.partiallySupports}, NotSupport=${result.doesNotSupport}, N/A=${result.notApplicable}`);

    // NEGLIGIBLE criteria are included in the count but scored as 0
    // They don't contribute to any impact category but are part of the total

    // Determine support status: N/A is treated as Supports
    const isSupports = result.supports || result.notApplicable;
    const isPartial = result.partiallySupports && !result.notApplicable;
    const isNotSupport = result.doesNotSupport && !result.notApplicable;

    console.log(`   Calculated: isSupports=${isSupports}, isPartial=${isPartial}, isNotSupport=${isNotSupport}`);

    if (impact.impactCategory === 'Extremely important') {
      if (isNotSupport) extremelyImportantNotSupported++;
      else if (isPartial) extremelyImportantPartiallySupports++;
      else if (isSupports) extremelyImportantSupports++;
      console.log(`   → Extremely Important: NotSupport=${extremelyImportantNotSupported}, Partial=${extremelyImportantPartiallySupports}, Supports=${extremelyImportantSupports}`);
    } else if (impact.impactCategory === 'Somewhat important') {
      if (isNotSupport) somewhatImportantNotSupported++;
      else if (isPartial) somewhatImportantPartiallySupports++;
      else if (isSupports) somewhatImportantSupports++;
      console.log(`   → Somewhat Important: NotSupport=${somewhatImportantNotSupported}, Partial=${somewhatImportantPartiallySupports}, Supports=${somewhatImportantSupports}`);
    } else if (impact.impactCategory === 'Standard') {
      if (isNotSupport) standardNotSupported++;
      else if (isPartial) standardPartiallySupports++;
      else if (isSupports) standardSupports++;
      console.log(`   → Standard: NotSupport=${standardNotSupported}, Partial=${standardPartiallySupports}, Supports=${standardSupports}`);
    } else if (impact.impactCategory === 'NEGLIGIBLE') {
      console.log(`   → NEGLIGIBLE: Counted in total but not scored`);
    }
  }
  
  console.log(`📊 [WCAG ${wcagVersion}] Processing Summary:`);
  console.log(`   - Total relevant criteria: ${relevantCriteria.length}`);
  console.log(`   - Processed: ${processedCount}`);
  console.log(`   - Skipped (no result): ${skippedCount}`);

  // Count NEGLIGIBLE criteria separately (they're in the denominator but not scored)
  let negligibleCount = 0;
  for (const impact of relevantCriteria) {
    if (impact.impactCategory === 'NEGLIGIBLE') {
      negligibleCount++;
    }
  }

  // FIXED: totalCriteria should ALWAYS be the expected count for the WCAG version
  // Don't calculate it from processed criteria - use the fixed expected count
  let expectedCriteria: number;
  if (wcagVersion === 2.0) {
    expectedCriteria = 38;
  } else if (wcagVersion === 2.1) {
    expectedCriteria = 50;
  } else { // 2.2
    expectedCriteria = 56;
  }
  const totalCriteria = expectedCriteria;
  
  console.log(`📊 [WCAG ${wcagVersion}] COUNT VERIFICATION:`);
  console.log(`   - Expected criteria for WCAG ${wcagVersion}: ${expectedCriteria}`);
  console.log(`   - Calculated from counts: ${extremelyImportantNotSupported + extremelyImportantPartiallySupports + extremelyImportantSupports + somewhatImportantNotSupported + somewhatImportantPartiallySupports + somewhatImportantSupports + standardNotSupported + standardPartiallySupports + standardSupports + negligibleCount}`);
  console.log(`   - Using fixed total: ${totalCriteria}`);
  
  // Display totals must include ALL criteria statuses so totals add up to WCAG expected count.
  // N/A is displayed as Supports per TTU rules.
  let totalSupports = 0;
  let totalPartials = 0;
  let totalNotSupported = 0;
  let naCountedAsSupports = 0;
  let actualSupportsOnly = 0;

  for (const impact of relevantCriteria) {
    const result = platformResults.get(impact.criterion);
    if (!result) continue;

    if (result.notApplicable) {
      // N/A contributes to Supports for display and scoring.
      totalSupports++;
      naCountedAsSupports++;
    } else if (result.supports) {
      totalSupports++;
      actualSupportsOnly++;
    } else if (result.partiallySupports) {
      totalPartials++;
    } else if (result.doesNotSupport) {
      totalNotSupported++;
    } else {
      // Defensive fallback: unclassified criterion should be treated as N/A -> Supports.
      totalSupports++;
      naCountedAsSupports++;
    }
  }

  const totalNA = naCountedAsSupports;

  console.log('');
  console.log(`📊 [WCAG ${wcagVersion}] CRITERIA BREAKDOWN BY IMPACT CATEGORY:`);
  console.log(`   ℹ️  N/A criteria (treated as Supports for scoring): ${naCountedAsSupports}`);
  console.log(`   ℹ️  NEGLIGIBLE criteria (in count, not scored): ${negligibleCount}`);
  console.log(`   Extremely Important: ${extremelyImportantNotSupported + extremelyImportantPartiallySupports + extremelyImportantSupports} total`);
  console.log(`      - Not Support: ${extremelyImportantNotSupported}`);
  console.log(`      - Partial:     ${extremelyImportantPartiallySupports}`);
  console.log(`      - Supports:    ${extremelyImportantSupports} (includes N/A)`);
  console.log(`   Somewhat Important: ${somewhatImportantNotSupported + somewhatImportantPartiallySupports + somewhatImportantSupports} total`);
  console.log(`      - Not Support: ${somewhatImportantNotSupported}`);
  console.log(`      - Partial:     ${somewhatImportantPartiallySupports}`);
  console.log(`      - Supports:    ${somewhatImportantSupports} (includes N/A)`);
  console.log(`   Standard: ${standardNotSupported + standardPartiallySupports + standardSupports} total`);
  console.log(`      - Not Support: ${standardNotSupported}`);
  console.log(`      - Partial:     ${standardPartiallySupports}`);
  console.log(`      - Supports:    ${standardSupports} (includes N/A)`);
  console.log(`   ═══════════════════════════════════════`);
  console.log(`   📊 FRONTEND DISPLAY TOTALS (N/A = Supports per TTU rules):`);
  console.log(`      - Total Supports:     ${totalSupports} (${((totalSupports/totalCriteria)*100).toFixed(1)}%) - INCLUDES N/A`);
  console.log(`      - Actual Supports:    ${actualSupportsOnly} (${((actualSupportsOnly/totalCriteria)*100).toFixed(1)}%)`);
  console.log(`      - N/A (as Supports):  ${totalNA} (${((totalNA/totalCriteria)*100).toFixed(1)}%)`);
  console.log(`      - Total Partials:     ${totalPartials} (${((totalPartials/totalCriteria)*100).toFixed(1)}%)`);
  console.log(`      - Total Not Support:  ${totalNotSupported} (${((totalNotSupported/totalCriteria)*100).toFixed(1)}%)`);
  console.log(`      - Negligible:         ${negligibleCount}`);
  console.log(`   📊 VERIFICATION:`);
  console.log(`      - Total counted:      ${totalSupports} + ${totalPartials} + ${totalNotSupported} = ${totalSupports + totalPartials + totalNotSupported}`);
  console.log(`      - Expected total:     ${totalCriteria}`);
  console.log(`   TOTAL CRITERIA COUNTED: ${totalCriteria}`);

  // Calculate score using weights
  console.log('');
  console.log(`🧮 [WCAG ${wcagVersion}] SCORE CALCULATION (using weights):`);
  
  const extremeScore = 
    (extremelyImportantNotSupported * WEIGHTS.extremelyImportant.notSupported) +
    (extremelyImportantPartiallySupports * WEIGHTS.extremelyImportant.partiallySupports) +
    (extremelyImportantSupports * WEIGHTS.extremelyImportant.supports);
  console.log(`   Extremely Important Score:`);
  console.log(`      (${extremelyImportantNotSupported} × ${WEIGHTS.extremelyImportant.notSupported}) + (${extremelyImportantPartiallySupports} × ${WEIGHTS.extremelyImportant.partiallySupports}) + (${extremelyImportantSupports} × ${WEIGHTS.extremelyImportant.supports})`);
  console.log(`      = ${extremelyImportantNotSupported * WEIGHTS.extremelyImportant.notSupported} + ${extremelyImportantPartiallySupports * WEIGHTS.extremelyImportant.partiallySupports} + ${extremelyImportantSupports * WEIGHTS.extremelyImportant.supports} = ${extremeScore}`);
  
  const somewhatScore = 
    (somewhatImportantNotSupported * WEIGHTS.somewhatImportant.notSupported) +
    (somewhatImportantPartiallySupports * WEIGHTS.somewhatImportant.partiallySupports) +
    (somewhatImportantSupports * WEIGHTS.somewhatImportant.supports);
  console.log(`   Somewhat Important Score:`);
  console.log(`      (${somewhatImportantNotSupported} × ${WEIGHTS.somewhatImportant.notSupported}) + (${somewhatImportantPartiallySupports} × ${WEIGHTS.somewhatImportant.partiallySupports}) + (${somewhatImportantSupports} × ${WEIGHTS.somewhatImportant.supports})`);
  console.log(`      = ${somewhatImportantNotSupported * WEIGHTS.somewhatImportant.notSupported} + ${somewhatImportantPartiallySupports * WEIGHTS.somewhatImportant.partiallySupports} + ${somewhatImportantSupports * WEIGHTS.somewhatImportant.supports} = ${somewhatScore}`);
  
  const standardScore = 
    (standardNotSupported * WEIGHTS.standard.notSupported) +
    (standardPartiallySupports * WEIGHTS.standard.partiallySupports) +
    (standardSupports * WEIGHTS.standard.supports);
  console.log(`   Standard Score:`);
  console.log(`      (${standardNotSupported} × ${WEIGHTS.standard.notSupported}) + (${standardPartiallySupports} × ${WEIGHTS.standard.partiallySupports}) + (${standardSupports} × ${WEIGHTS.standard.supports})`);
  console.log(`      = ${standardNotSupported * WEIGHTS.standard.notSupported} + ${standardPartiallySupports * WEIGHTS.standard.partiallySupports} + ${standardSupports * WEIGHTS.standard.supports} = ${standardScore}`);
  
  const score = extremeScore + somewhatScore + standardScore;
  console.log(`   TOTAL SCORE: ${extremeScore} + ${somewhatScore} + ${standardScore} = ${score}`);

  // Fixed perfect scores based on WCAG version (ALL criteria including N/A)
  // WCAG 2.0: 38 criteria × 100 = 3,800
  // WCAG 2.1: 50 criteria × 100 = 5,000
  // WCAG 2.2: 56 criteria × 100 = 5,600
  let perfectScore: number;
  if (wcagVersion === 2.0) {
    perfectScore = 3800;
  } else if (wcagVersion === 2.1) {
    perfectScore = 5000;
  } else { // 2.2
    perfectScore = 5600;
  }
  
  const percentage = perfectScore > 0 ? score / perfectScore : 0;
  
  console.log(`🧮 [WCAG ${wcagVersion}] DETAILED SCORE BREAKDOWN:`);
  console.log(`   Extremely Important (${extremelyImportantSupports} Supports × 100) + (${extremelyImportantPartiallySupports} × 30) + (${extremelyImportantNotSupported} × 0.01) = ${extremeScore}`);
  console.log(`   Somewhat Important (${somewhatImportantSupports} Supports × 100) + (${somewhatImportantPartiallySupports} × 40) + (${somewhatImportantNotSupported} × 0.01) = ${somewhatScore}`);
  console.log(`   Standard (${standardSupports} Supports × 100) + (${standardPartiallySupports} × 50) + (${standardNotSupported} × 0.01) = ${standardScore}`);
  console.log(`   📊 FINAL SCORE CALCULATION: ${score} / ${perfectScore} = ${(percentage * 100).toFixed(2)}%`);
  console.log(`   Perfect Score: ${expectedCriteria} criteria × 100 = ${perfectScore} (FIXED for WCAG ${wcagVersion})`);
  console.log(`   Actual criteria counted: ${totalCriteria}`);
  if (totalCriteria !== expectedCriteria) {
    console.log(`   ⚠️  WARNING: Expected ${expectedCriteria} criteria but counted ${totalCriteria}!`);
  }
  console.log(`   Percentage: ${score} / ${perfectScore} = ${(percentage * 100).toFixed(2)}%`);

  // Calculate grade based on Score sheet logic (rows 47-51)
  console.log('');
  console.log(`🎓 [WCAG ${wcagVersion}] GRADE DETERMINATION (Excel rows 46-51):`);
  console.log(`   Checking conditions in order...`);
  
  let grade = 'F';
  let gradeRange = 'EIR Accessibility Exception Paperwork Required';

  if (perfectScore === 0) {
    console.log(`   ✓ Perfect score is 0 → Grade: N/A`);
    grade = 'N/A';
    gradeRange = 'No criteria to evaluate';
  } else if (percentage >= 0.95) {
    console.log(`   ✓ Percentage ${(percentage * 100).toFixed(2)}% >= 95% → Grade: A (Accessible)`);
    grade = 'A';
    gradeRange = 'Accessible';
  } else if (percentage >= 0.85 && userCount === 0 && !isPublicUse) {
    console.log(`   ✓ Percentage ${(percentage * 100).toFixed(2)}% >= 85% AND userCount ${userCount} === 0 AND publicUse ${isPublicUse} === false → Grade: B (Conditional)`);
    grade = 'B';
    gradeRange = 'Conditional';
  } else if (percentage <= 0.95 && userCount <= 50 && !isPublicUse && annualCost < 25000) {
    console.log(`   ✓ Percentage ${(percentage * 100).toFixed(2)}% <= 95% AND userCount ${userCount} <= 50 AND publicUse ${isPublicUse} === false AND cost $${annualCost} < $25000 → Grade: C (Blanket EAE)`);
    grade = 'C';
    gradeRange = 'Blanket EAE - Limited use and cost';
  } else if (annualCost < 25000) {
    console.log(`   ✓ Cost $${annualCost} < $25000 → Grade: D (EAE - TAC or DOJ)`);
    grade = 'D';
    gradeRange = 'EAE - TAC or DOJ';
  } else {
    console.log(`   ✗ No conditions met → Grade: F (Enhanced EAE)`);
    console.log(`      - Percentage: ${(percentage * 100).toFixed(2)}%`);
    console.log(`      - User Count: ${userCount}`);
    console.log(`      - Public Use: ${isPublicUse}`);
    console.log(`      - Annual Cost: $${annualCost}`);
  }
  
  console.log(`   FINAL GRADE: ${grade} - ${gradeRange}`);

  // Build detailed criteria list for frontend display
  const criteriaDetails: CriterionDetail[] = [];
  const allCriteriaForVersion = criteriaImpacts.filter(c => {
    if (wcagVersion === 2.0) return c.wcag20;
    if (wcagVersion === 2.1) return c.wcag21;
    if (wcagVersion === 2.2) return c.wcag22;
    return false;
  });

  for (const impact of allCriteriaForVersion) {
    const result = platformResults.get(impact.criterion);
    if (!result) continue;

    let supportStatus: 'Supports' | 'Partially Supports' | 'Does Not Support' | 'N/A';
    let points = 0;

    if (result.notApplicable) {
      supportStatus = 'N/A';
      points = 100; // N/A = Supports = 100 points
    } else if (result.supports) {
      supportStatus = 'Supports';
      points = 100;
    } else if (result.partiallySupports) {
      supportStatus = 'Partially Supports';
      if (impact.impactCategory === 'Extremely important') points = 30;
      else if (impact.impactCategory === 'Somewhat important') points = 40;
      else if (impact.impactCategory === 'Standard') points = 50;
    } else if (result.doesNotSupport) {
      supportStatus = 'Does Not Support';
      points = 0.01;
    } else {
      supportStatus = 'N/A';
      points = 100;
    }

    // Determine if criterion is exclusive to this WCAG version
    let isExclusive = false;
    if (wcagVersion === 2.0) {
      isExclusive = impact.wcag20 && !impact.wcag21 && !impact.wcag22;
    } else if (wcagVersion === 2.1) {
      isExclusive = impact.wcag21 && !impact.wcag20 && !impact.wcag22;
    } else if (wcagVersion === 2.2) {
      isExclusive = impact.wcag22 && !impact.wcag20 && !impact.wcag21;
    }

    criteriaDetails.push({
      criterion: impact.criterion,
      impactCategory: impact.impactCategory,
      supportStatus,
      points,
      isExclusive
    });
  }

  // Sort: exclusive first, then common, within each group sort by impact then criterion name
  criteriaDetails.sort((a, b) => {
    if (a.isExclusive !== b.isExclusive) return a.isExclusive ? -1 : 1;
    
    const impactOrder = { 'Extremely important': 0, 'Somewhat important': 1, 'Standard': 2, 'NEGLIGIBLE': 3 };
    const aOrder = impactOrder[a.impactCategory as keyof typeof impactOrder] ?? 4;
    const bOrder = impactOrder[b.impactCategory as keyof typeof impactOrder] ?? 4;
    if (aOrder !== bOrder) return aOrder - bOrder;
    
    return a.criterion.localeCompare(b.criterion);
  });

  return {
    version: wcagVersion === 2.0 ? 'WCAG 2.0' : wcagVersion === 2.1 ? 'WCAG 2.1' : 'WCAG 2.2',
    extremelyImportantNotSupported,
    extremelyImportantPartiallySupports,
    extremelyImportantSupports,
    somewhatImportantNotSupported,
    somewhatImportantPartiallySupports,
    somewhatImportantSupports,
    standardNotSupported,
    standardPartiallySupports,
    standardSupports,
    negligibleCount,
    totalCriteria,
    totalSupports,
    totalPartials,
    totalNotSupported,
    totalNA,
    score,
    perfectScore,
    grade,
    gradeRange,
    criteriaDetails
  };
}

/**
 * Calculate disability impacts based on supported criteria
 */
function calculateDisabilityImpacts(
  criteriaImpacts: CriterionImpact[],
  platformResults: Map<string, { supports: boolean; partiallySupports: boolean; doesNotSupport: boolean; notApplicable: boolean }>,
  wcagVersion: number = 2.1
): DisabilityImpact[] {
  const disabilityStats = {
    blindness: { total: 0, supported: 0, notFullySupportedCriteria: [] as string[] },
    lowVision: { total: 0, supported: 0, notFullySupportedCriteria: [] as string[] },
    colorblindness: { total: 0, supported: 0, notFullySupportedCriteria: [] as string[] },
    hearingLoss: { total: 0, supported: 0, notFullySupportedCriteria: [] as string[] },
    cognitiveDisorders: { total: 0, supported: 0, notFullySupportedCriteria: [] as string[] },
    motorDisabilities: { total: 0, supported: 0, notFullySupportedCriteria: [] as string[] },
    epilepsy: { total: 0, supported: 0, notFullySupportedCriteria: [] as string[] }
  };

  // Filter criteria by WCAG version using flags
  const relevantCriteria = criteriaImpacts.filter(c => {
    if (wcagVersion === 2.0) return c.wcag20;
    if (wcagVersion === 2.1) return c.wcag21;
    if (wcagVersion === 2.2) return c.wcag22;
    return false;
  });

  console.log(`🔍 [DISABILITIES] Processing ${relevantCriteria.length} criteria for WCAG ${wcagVersion}`);

  for (const impact of relevantCriteria) {
    const result = platformResults.get(impact.criterion);
    if (!result) {
      console.log(`⚠️ [DISABILITIES] No result found for: ${impact.criterion}`);
      continue;
    }

    // Skip NEGLIGIBLE criteria for disability analysis
    if (impact.impactCategory === 'NEGLIGIBLE') {
      continue;
    }

    const disabilities = impact.disabilities;
    
    Object.keys(disabilities).forEach((disability) => {
      const key = disability as keyof typeof disabilities;
      if (disabilities[key]) {
        disabilityStats[key].total++;
        
        // N/A counts as Supports for disability analysis
        const isSupported = result.supports || result.notApplicable;
        if (isSupported) {
          disabilityStats[key].supported++;
        } else {
          // Track criteria that are NOT SUPPORTED or PARTIALLY SUPPORTED
          disabilityStats[key].notFullySupportedCriteria.push(impact.criterion);
        }
      }
    });
  }

  const impacts: DisabilityImpact[] = [];
  
  const disabilityNames = {
    motorDisabilities: 'Motor Disabilities',
    cognitiveDisorders: 'Cognitive Disorders',
    lowVision: 'Low Vision',
    hearingLoss: 'Hearing Loss',
    colorblindness: 'Colorblindness',
    blindness: 'Blindness',
    epilepsy: 'Epilepsy'
  };

  Object.entries(disabilityStats).forEach(([key, stats]) => {
    const percentSupported = stats.total > 0 ? stats.supported / stats.total : 0;
    impacts.push({
      disability: disabilityNames[key as keyof typeof disabilityNames],
      totalCriteria: stats.total,
      criteriaSupported: stats.supported,
      percentSupported,
      status: percentSupported === 1 ? 'Supported' : 'Not Fully Support',
      affectedPopulationPercent: DISABILITY_POPULATION[key as keyof typeof DISABILITY_POPULATION],
      notFullySupportedCriteria: stats.notFullySupportedCriteria
    });
    
    console.log(`   ${disabilityNames[key as keyof typeof disabilityNames]}: ${stats.supported}/${stats.total} supported (${(percentSupported * 100).toFixed(1)}%) - ${stats.notFullySupportedCriteria.length} not fully supported criteria`);
  });

  return impacts;
}

/**
 * Calculate risk level based on grade and user count
 * From Score sheet Risk Logic Table (Rows 53-58)
 */
function calculateRiskLevel(grade: string, userCount: number, isPublicUse: boolean): string {
  // Row 54: If accessibility score is an A → Low Risk
  if (grade === 'A') {
    return 'Low Risk';
  }
  
  const totalUsers = userCount;
  
  // Row 58: Not an A, used by public or 5k users → Very High Risk
  if (isPublicUse || totalUsers >= 5000) {
    return 'Very High Risk';
  } 
  // Row 57: Not an A, >500 but <5000 users → High Risk
  else if (totalUsers >= 500 && totalUsers < 5000) {
    return 'High Risk';
  } 
  // Row 56: Not an A, >50 but <500 users → Moderate Risk
  else if (totalUsers > 50 && totalUsers < 500) {
    return 'Moderate Risk';
  } 
  // Row 55: Not an A, 50 or fewer users → Low Risk, also
  else {
    return 'Low Risk, also';
  }
}

/**
 * Normalize criterion name for matching (remove extra spaces, normalize punctuation)
 */
function normalizeCriterionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s*\)\s*/g, ') ')
    .trim();
}

/**
 * Find matching criterion impact by fuzzy matching the name
 * Method 1 provides: { criterionId: "1.1.1", criterionName: "Non-text Content", level: "A" }
 * Impact extractor expects: "1.1.1 Non-text Content (Level A)"
 */
function findCriterionImpact(criterionName: string, criterionId?: string, level?: string): CriterionImpact | null {
  const allImpacts = Object.values(IMPACT_CATEGORIES);
  
  // Extract ID from criterion name if not provided
  const idMatch = criterionName.match(/(\d+\.\d+\.\d+)/);
  const extractedId = idMatch ? idMatch[1] : criterionId;
  
  // Strategy 1: Match by ID only (most reliable)
  if (extractedId) {
    for (const imp of allImpacts) {
      const impIdMatch = imp.criterion.match(/(\d+\.\d+\.\d+)/);
      if (impIdMatch && impIdMatch[1] === extractedId) {
        return imp;
      }
    }
  }
  
  // Strategy 2: Try exact match
  let impact = getCriterionImpact(criterionName);
  if (impact) return impact;
  
  // Strategy 3: Try with full format
  if (extractedId && level) {
    const fullName = `${extractedId} ${criterionName.replace(/^\d+\.\d+\.\d+\s*/, '')} (Level ${level})`;
    impact = getCriterionImpact(fullName);
    if (impact) return impact;
  }
  
  // Strategy 4: Normalized match
  const normalized = normalizeCriterionName(criterionName);
  for (const imp of allImpacts) {
    if (normalizeCriterionName(imp.criterion) === normalized) {
      return imp;
    }
  }
  
  console.log('❌ [MATCHER] No match found for:', criterionName, 'ID:', extractedId, 'Level:', level);
  return null;
}

/**
 * Main function to calculate scorecard from Method 1 output
 * Implements scoring logic from TTU VPAT SCORECARD.xlsx Score sheet
 */
export function calculateScorecard(
  criteriaSupport: CriterionSupport[],
  studentCount: number = 0,
  staffCount: number = 0,
  isPublicUse: boolean = false,
  annualCost: number = 0
): ScorecardResult {
  const userCount = studentCount + staffCount;
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 [SCORECARD CALCULATOR] STARTING COMPREHENSIVE CALCULATION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📥 [INPUT] Total Criteria from Method 1:', criteriaSupport.length);
  console.log('📥 [INPUT] User Metadata:');
  console.log('   - Student Count:', studentCount);
  console.log('   - Staff Count:', staffCount);
  console.log('   - Total Users (Student + Staff):', userCount);
  console.log('   - Public Use:', isPublicUse ? 'YES' : 'NO');
  console.log('   - Annual Cost: $' + annualCost.toLocaleString());
  console.log('');
  console.log('⚙️ [WEIGHTS] Scoring Weights from Excel (Rows 40-43):');
  console.log('   Extremely Important: Not Support=' + WEIGHTS.extremelyImportant.notSupported + ', Partial=' + WEIGHTS.extremelyImportant.partiallySupports + ', Supports=' + WEIGHTS.extremelyImportant.supports);
  console.log('   Somewhat Important:  Not Support=' + WEIGHTS.somewhatImportant.notSupported + ', Partial=' + WEIGHTS.somewhatImportant.partiallySupports + ', Supports=' + WEIGHTS.somewhatImportant.supports);
  console.log('   Standard:            Not Support=' + WEIGHTS.standard.notSupported + ', Partial=' + WEIGHTS.standard.partiallySupports + ', Supports=' + WEIGHTS.standard.supports);
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Extract impact data - we need ALL criteria from IMPACT_CATEGORIES, not just those in the VPAT
  // This ensures all 50 WCAG 2.1 (or 56 WCAG 2.2) criteria are included in scoring
  const allCriteriaImpacts = Object.values(IMPACT_CATEGORIES);
  console.log('📊 [CALCULATOR] Total criteria in IMPACT_CATEGORIES:', allCriteriaImpacts.length);
  
  // Match VPAT criteria to impact data for logging
  let matchedCount = 0;
  let unmatchedCriteria: string[] = [];
  let unmatchedPartials: string[] = [];
  const matchedImpactByInput = new Map<string, CriterionImpact>();
  
  for (const cs of criteriaSupport) {
    // Extract ID and level from criterion string if available
    const idMatch = cs.criterion.match(/^(\d+\.\d+\.\d+)/);
    const levelMatch = cs.criterion.match(/\(Level ([A]{1,3})\)/);
    const criterionId = idMatch ? idMatch[1] : undefined;
    const level = levelMatch ? levelMatch[1] : undefined;
    
    const impact = findCriterionImpact(cs.criterion, criterionId, level);
    if (impact) {
      matchedCount++;
      matchedImpactByInput.set(cs.criterion, impact);
    } else {
      unmatchedCriteria.push(cs.criterion);
      if (cs.partiallySupports) {
        unmatchedPartials.push(cs.criterion);
      }
    }
  }
  
  console.log('📊 [CALCULATOR] Matched', matchedCount, 'out of', criteriaSupport.length, 'criteria from VPAT')
  if (unmatchedCriteria.length > 0) {
    console.log('⚠️ [CALCULATOR] Unmatched criteria (first 10):', unmatchedCriteria.slice(0, 10))
    console.log('⚠️ [CALCULATOR] Unmatched PARTIALS:', unmatchedPartials.length, 'criteria')
    if (unmatchedPartials.length > 0) {
      console.log('⚠️ [CALCULATOR] Unmatched Partial criteria:', unmatchedPartials)
    }
  }

  // Build platform results map from the actual criteria support data
  // CRITICAL: Must include ALL WCAG criteria, even those not in the VPAT
  // Missing criteria are treated as N/A = Supports = 100 points
  const resultsMap = new Map<string, { supports: boolean; partiallySupports: boolean; doesNotSupport: boolean; notApplicable: boolean }>();
  let canonicalMappedCount = 0;
  
  // First, add all criteria from the VPAT
  for (const cs of criteriaSupport) {
    const matchedImpact = matchedImpactByInput.get(cs.criterion);
    const mapKey = matchedImpact?.criterion ?? cs.criterion;
    if (matchedImpact) canonicalMappedCount++;

    resultsMap.set(mapKey, {
      supports: cs.supports,
      partiallySupports: cs.partiallySupports,
      doesNotSupport: cs.doesNotSupport,
      notApplicable: cs.notApplicable
    });
  }
  console.log(`📊 [CALCULATOR] Canonical-mapped criteria: ${canonicalMappedCount}/${criteriaSupport.length}`);
  
  // Then, ensure ALL criteria with impact data are in the map
  // Any missing criteria are treated as N/A (Supports)
  let missingCount = 0;
  for (const impact of allCriteriaImpacts) {
    if (!resultsMap.has(impact.criterion)) {
      missingCount++;
      resultsMap.set(impact.criterion, {
        supports: false,
        partiallySupports: false,
        doesNotSupport: false,
        notApplicable: true  // Missing = N/A = Supports
      });
    }
  }
  console.log(`ℹ️  [CALCULATOR] Added ${missingCount} missing criteria as N/A (will count as Supports)`);
  
  const supportCount = criteriaSupport.filter(c => c.supports).length;
  const partialCount = criteriaSupport.filter(c => c.partiallySupports).length;
  const notSupportCount = criteriaSupport.filter(c => c.doesNotSupport).length;
  const naCount = criteriaSupport.filter(c => c.notApplicable).length;
  console.log('📊 [CALCULATOR] Support breakdown:', { 
    total: criteriaSupport.length,
    supports: supportCount, 
    partial: partialCount, 
    notSupport: notSupportCount,
    notApplicable: naCount
  })

  // Calculate scores for each WCAG version
  console.log('');
  console.log('🔄 [MAIN] CALCULATING SCORES FOR ALL WCAG VERSIONS...');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const wcag20Score = calculateWCAGScore(allCriteriaImpacts, resultsMap, 2.0, userCount, isPublicUse, annualCost);
  console.log('═══════════════════════════════════════════════════════════════');
  
  const wcag21Score = calculateWCAGScore(allCriteriaImpacts, resultsMap, 2.1, userCount, isPublicUse, annualCost);
  console.log('═══════════════════════════════════════════════════════════════');
  
  const wcag22Score = calculateWCAGScore(allCriteriaImpacts, resultsMap, 2.2, userCount, isPublicUse, annualCost);
  console.log('═══════════════════════════════════════════════════════════════');

  // Calculate disability impacts (using WCAG 2.1 as default)
  console.log('');
  console.log('♿ [DISABILITIES] CALCULATING DISABILITY IMPACTS (WCAG 2.1)...');
  const disabilityImpacts = calculateDisabilityImpacts(allCriteriaImpacts, resultsMap, 2.1);
  console.log('♿ [DISABILITIES] Impact Summary:');
  disabilityImpacts.forEach(impact => {
    console.log(`   ${impact.disability}: ${impact.criteriaSupported}/${impact.totalCriteria} supported (${(impact.percentSupported * 100).toFixed(1)}%) - ${impact.status}`);
  });

  console.log('');
  console.log('⚠️ [RISK] CALCULATING RISK LEVEL...');
  console.log(`   Grade: ${wcag21Score.grade}`);
  console.log(`   Total Users: ${userCount}`);
  console.log(`   Public Use: ${isPublicUse}`);
  const riskLevel = calculateRiskLevel(wcag21Score.grade, userCount, isPublicUse);
  console.log(`   RISK LEVEL: ${riskLevel}`);

  // Determine resource requirement
  let resourceRequirement = 'Standard';
  if (wcag21Score.grade === 'A') {
    resourceRequirement = 'Minimal - Maintenance only';
  } else if (wcag21Score.grade === 'B') {
    resourceRequirement = 'Low - Minor improvements needed';
  } else if (wcag21Score.grade === 'C') {
    resourceRequirement = 'Moderate - Targeted improvements required';
  } else {
    resourceRequirement = 'High - Significant accessibility work required';
  }

  // Overall recommendation
  let overallRecommendation = '';
  if (wcag21Score.grade === 'A') {
    overallRecommendation = 'Product meets accessibility standards. Approved for 2 years.';
  } else if (wcag21Score.grade === 'B') {
    overallRecommendation = 'Conditional approval for non-student/public use. 2 year approval.';
  } else if (wcag21Score.grade === 'C') {
    overallRecommendation = 'Blanket EAE approved for limited use (<50 users, <$25k). 2 year approval.';
  } else if (wcag21Score.grade === 'D') {
    overallRecommendation = 'EAE required - TAC or DOJ review needed. Timeline set by EIRAC.';
  } else {
    overallRecommendation = 'Enhanced EAE required - Additional defense documentation needed.';
  }

  console.log('');
  console.log('✅ [FINAL RESULTS] SCORECARD CALCULATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 WCAG 2.0: Grade ' + wcag20Score.grade + ' - ' + wcag20Score.score.toFixed(0) + '/' + wcag20Score.perfectScore.toFixed(0) + ' (' + ((wcag20Score.score / wcag20Score.perfectScore) * 100).toFixed(1) + '%)');
  console.log('📊 WCAG 2.1: Grade ' + wcag21Score.grade + ' - ' + wcag21Score.score.toFixed(0) + '/' + wcag21Score.perfectScore.toFixed(0) + ' (' + ((wcag21Score.score / wcag21Score.perfectScore) * 100).toFixed(1) + '%)');
  console.log('📊 WCAG 2.2: Grade ' + wcag22Score.grade + ' - ' + wcag22Score.score.toFixed(0) + '/' + wcag22Score.perfectScore.toFixed(0) + ' (' + ((wcag22Score.score / wcag22Score.perfectScore) * 100).toFixed(1) + '%)');
  console.log('⚠️  Risk Level: ' + riskLevel);
  console.log('💡 Recommendation: ' + overallRecommendation);
  console.log('═══════════════════════════════════════════════════════════════');

  return {
    wcag20Score,
    wcag21Score,
    wcag22Score,
    disabilityImpacts,
    riskLevel,
    resourceRequirement,
    overallRecommendation,
    userInputs: {
      studentCount,
      staffCount,
      isPublicUse,
      annualCost
    }
  };
}

/**
 * Helper function to convert Method 1 output format to CriterionSupport format
 */
export function convertMethod1OutputToCriterionSupport(
  method1Output: Record<string, { supported: string[]; partiallySupported: string[]; notSupported: string[]; notApplicable: string[] }>
): CriterionSupport[] {
  const allCriteria = new Set<string>();
  const supportMap = new Map<string, { supports: boolean; partiallySupports: boolean; doesNotSupport: boolean; notApplicable: boolean }>();
  
  // Collect all unique criteria
  for (const results of Object.values(method1Output)) {
    results.supported?.forEach(c => allCriteria.add(c));
    results.partiallySupported?.forEach(c => allCriteria.add(c));
    results.notSupported?.forEach(c => allCriteria.add(c));
    results.notApplicable?.forEach(c => allCriteria.add(c));
  }
  
  // Map each criterion to its support status
  for (const criterion of allCriteria) {
    let supports = false;
    let partiallySupports = false;
    let doesNotSupport = false;
    let notApplicable = false;
    
    for (const results of Object.values(method1Output)) {
      if (results.supported?.includes(criterion)) supports = true;
      if (results.partiallySupported?.includes(criterion)) partiallySupports = true;
      if (results.notSupported?.includes(criterion)) doesNotSupport = true;
      if (results.notApplicable?.includes(criterion)) notApplicable = true;
    }
    
    supportMap.set(criterion, { supports, partiallySupports, doesNotSupport, notApplicable });
  }
  
  return Array.from(allCriteria).map(criterion => ({
    criterion,
    ...supportMap.get(criterion)!
  }));
}
