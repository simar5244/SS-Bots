/**
 * VPAT Impact Extractor Service
 * Extracts impact categories and disability impacts for each WCAG criterion
 * Based on TTU VPAT SCORECARD.xlsx - ACR and "List by Impact" sheets
 */

export interface CriterionImpact {
  criterion: string;
  impactCategory: 'Extremely important' | 'Somewhat important' | 'Standard' | 'NEGLIGIBLE' | 'NA' | 'N/A';
  // WCAG version flags - criteria can be in multiple versions (incremental)
  wcag20: boolean; // In WCAG 2.0
  wcag21: boolean; // In WCAG 2.1
  wcag22: boolean; // In WCAG 2.2
  disabilities: {
    blindness: boolean;
    lowVision: boolean;
    colorblindness: boolean;
    hearingLoss: boolean;
    cognitiveDisorders: boolean;
    motorDisabilities: boolean;
    epilepsy: boolean;
  };
}

// Impact mapping based on ACR sheet (Column B - Impact Category)
export const IMPACT_CATEGORIES: Record<string, CriterionImpact> = {
  '1.1.1 Non-text Content (Level A)': {
    criterion: '1.1.1 Non-text Content (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: true, hearingLoss: false, cognitiveDisorders: false, motorDisabilities: false, epilepsy: false }
  },
  '1.2.1 Audio-only and Video-only (Prerecorded) (Level A)': {
    criterion: '1.2.1 Audio-only and Video-only (Prerecorded) (Level A)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: true, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '1.2.2 Captions (Prerecorded) (Level A)': {
    criterion: '1.2.2 Captions (Prerecorded) (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: true, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '1.2.3 Audio Description or Media Alternative (Prerecorded) (Level A)': {
    criterion: '1.2.3 Audio Description or Media Alternative (Prerecorded) (Level A)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: true, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '1.3.1 Info and Relationships (Level A)': {
    criterion: '1.3.1 Info and Relationships (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: false, colorblindness: false, hearingLoss: false, cognitiveDisorders: false, motorDisabilities: false, epilepsy: false }
  },
  '1.3.2 Meaningful Sequence (Level A)': {
    criterion: '1.3.2 Meaningful Sequence (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: false, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '1.3.3 Sensory Characteristics  (Level A)': {
    criterion: '1.3.3 Sensory Characteristics  (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: true, hearingLoss: true, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '1.4.1 Use of Color (Level A)': {
    criterion: '1.4.1 Use of Color (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: false, lowVision: true, colorblindness: true, hearingLoss: false, cognitiveDisorders: false, motorDisabilities: false, epilepsy: false }
  },
  '1.4.2 Audio Control (Level A)': {
    criterion: '1.4.2 Audio Control (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: true, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '2.1.1 Keyboard (Level A)': {
    criterion: '2.1.1 Keyboard (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '2.1.2 No Keyboard Trap (Level A)': {
    criterion: '2.1.2 No Keyboard Trap (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '2.1.4 Character Key Shortcuts (Level A 2.1 and 2.2)': {
    criterion: '2.1.4 Character Key Shortcuts (Level A 2.1 and 2.2)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.1,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '2.2.1 Timing Adjustable (Level A)': {
    criterion: '2.2.1 Timing Adjustable (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: true }
  },
  '2.2.2 Pause, Stop, Hide (Level A)': {
    criterion: '2.2.2 Pause, Stop, Hide (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: true }
  },
  '2.3.1 Three Flashes or Below Threshold (Level A)': {
    criterion: '2.3.1 Three Flashes or Below Threshold (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: false, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: true }
  },
  '2.4.1 Bypass Blocks (Level A)': {
    criterion: '2.4.1 Bypass Blocks (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '2.4.2 Page Titled (Level A)': {
    criterion: '2.4.2 Page Titled (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: false, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '2.4.3 Focus Order (Level A)': {
    criterion: '2.4.3 Focus Order (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '2.4.4 Link Purpose (In Context) (Level A)': {
    criterion: '2.4.4 Link Purpose (In Context) (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '2.5.1 Pointer Gestures (Level A 2.1 and 2.2)': {
    criterion: '2.5.1 Pointer Gestures (Level A 2.1 and 2.2)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.1,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '2.5.2 Pointer Cancellation (Level A 2.1 and 2.2)': {
    criterion: '2.5.2 Pointer Cancellation (Level A 2.1 and 2.2)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.1,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '2.5.3 Label in Name (Level A 2.1 and 2.2)': {
    criterion: '2.5.3 Label in Name (Level A 2.1 and 2.2)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.1,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: true, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '2.5.4 Motion Actuation (Level A 2.1 and 2.2)': {
    criterion: '2.5.4 Motion Actuation (Level A 2.1 and 2.2)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.1,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '3.1.1 Language of Page (Level A)': {
    criterion: '3.1.1 Language of Page (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: false, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '3.2.1 On Focus (Level A)': {
    criterion: '3.2.1 On Focus (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '3.2.2 On Input (Level A)': {
    criterion: '3.2.2 On Input (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '3.2.6 Consistent Help (Level A 2.2)': {
    criterion: '3.2.6 Consistent Help (Level A 2.2)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.2,
    disabilities: { blindness: false, lowVision: false, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '3.3.1 Error Identification (Level A)': {
    criterion: '3.3.1 Error Identification (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: true, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '3.3.2 Labels or Instructions (Level A)': {
    criterion: '3.3.2 Labels or Instructions (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: true, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '3.3.7 Redundent Entry (Level 2.2)': {
    criterion: '3.3.7 Redundent Entry (Level 2.2)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.2,
    disabilities: { blindness: false, lowVision: false, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '4.1.1 Parsing (Level A)': {
    criterion: '4.1.1 Parsing (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: true, hearingLoss: true, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '4.1.2 Name, Role, Value (Level A)': {
    criterion: '4.1.2 Name, Role, Value (Level A)',
    impactCategory: 'Extremely important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '1.2.4 Captions (Live) (Level AA)': {
    criterion: '1.2.4 Captions (Live) (Level AA)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: false, colorblindness: false, hearingLoss: true, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '1.2.5 Audio Description (Prerecorded) (Level AA)': {
    criterion: '1.2.5 Audio Description (Prerecorded) (Level AA)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: false, colorblindness: false, hearingLoss: true, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '1.3.4 Orientation (Level AA 2.1 and 2.2)': {
    criterion: '1.3.4 Orientation (Level AA 2.1 and 2.2)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.1,
    disabilities: { blindness: false, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '1.3.5 Identify Input Purpose (Level AA 2.1 and 2.2)': {
    criterion: '1.3.5 Identify Input Purpose (Level AA 2.1 and 2.2)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.1,
    disabilities: { blindness: false, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '1.4.3 Contrast (Minimum) (Level AA)': {
    criterion: '1.4.3 Contrast (Minimum) (Level AA)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.0,
    disabilities: { blindness: false, lowVision: true, colorblindness: true, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '2.4.11 Focus Not Obscured (Level AA, WCAG 2.2)': {
    criterion: '2.4.11 Focus Not Obscured (Level AA, WCAG 2.2)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.2,
    disabilities: { blindness: false, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '1.4.4 Resize text (Level AA)': {
    criterion: '1.4.4 Resize text (Level AA)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.0,
    disabilities: { blindness: false, lowVision: true, colorblindness: true, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '1.4.5 Images of Text (Level AA)': {
    criterion: '1.4.5 Images of Text (Level AA)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: true, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '1.4.10 Reflow (Level AA 2.1 and 2.2)': {
    criterion: '1.4.10 Reflow (Level AA 2.1 and 2.2)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.1,
    disabilities: { blindness: false, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '1.4.11 Non-text Contrast (Level AA 2.1 and 2.2)': {
    criterion: '1.4.11 Non-text Contrast (Level AA 2.1 and 2.2)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.1,
    disabilities: { blindness: false, lowVision: true, colorblindness: true, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '1.4.12 Text Spacing (Level AA 2.1 and 2.2)': {
    criterion: '1.4.12 Text Spacing (Level AA 2.1 and 2.2)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.1,
    disabilities: { blindness: false, lowVision: true, colorblindness: true, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '1.4.13 Content on Hover or Focus (Level AA 2.1 and 2.2)': {
    criterion: '1.4.13 Content on Hover or Focus (Level AA 2.1 and 2.2)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.1,
    disabilities: { blindness: false, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '2.4.5 Multiple Ways (Level AA)': {
    criterion: '2.4.5 Multiple Ways (Level AA)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '2.4.6 Headings and Labels (Level AA)': {
    criterion: '2.4.6 Headings and Labels (Level AA)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '2.4.7 Focus Visible (Level AA)': {
    criterion: '2.4.7 Focus Visible (Level AA)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.0,
    disabilities: { blindness: false, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  },
  '2.5.7 Dragging Movements (Level AA, 2.2)': {
    criterion: '2.5.7 Dragging Movements (Level AA, 2.2)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.2,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '2.5.8 Target Size (Level AA, 2.2)': {
    criterion: '2.5.8 Target Size (Level AA, 2.2)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.2,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '3.1.2 Language of Parts (Level AA)': {
    criterion: '3.1.2 Language of Parts (Level AA)',
    impactCategory: 'Somewhat important',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '3.2.3 Consistent Navigation (Level AA)': {
    criterion: '3.2.3 Consistent Navigation (Level AA)',
    impactCategory: 'Standard',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: true, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '3.2.4 Consistent Identification (Level AA)': {
    criterion: '3.2.4 Consistent Identification (Level AA)',
    impactCategory: 'Standard',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: true, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '3.3.3 Error Suggestion (Level AA)': {
    criterion: '3.3.3 Error Suggestion (Level AA)',
    impactCategory: 'Standard',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: true, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '3.3.4 Error Prevention (Legal, Financial, Data) (Level AA)': {
    criterion: '3.3.4 Error Prevention (Legal, Financial, Data) (Level AA)',
    impactCategory: 'NA',
    wcagVersion: 2.0,
    disabilities: { blindness: true, lowVision: true, colorblindness: true, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '3.3.8 Accessible Authentication (Level AA 2.2)': {
    criterion: '3.3.8 Accessible Authentication (Level AA 2.2)',
    impactCategory: 'N/A',
    wcagVersion: 2.2,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: true, cognitiveDisorders: true, motorDisabilities: true, epilepsy: false }
  },
  '4.1.3 Status Messages (Level AA 2.1 and 2.2)': {
    criterion: '4.1.3 Status Messages (Level AA 2.1 and 2.2)',
    impactCategory: 'NEGLIGIBLE',
    wcagVersion: 2.1,
    disabilities: { blindness: true, lowVision: true, colorblindness: false, hearingLoss: false, cognitiveDisorders: true, motorDisabilities: false, epilepsy: false }
  }
};

/**
 * Get impact data for a specific criterion
 */
export function getCriterionImpact(criterion: string): CriterionImpact | null {
  return IMPACT_CATEGORIES[criterion] || null;
}

/**
 * Get all criteria for a specific WCAG version
 */
export function getCriteriaByWCAGVersion(version: number): CriterionImpact[] {
  return Object.values(IMPACT_CATEGORIES).filter(c => c.wcagVersion <= version);
}

/**
 * Extract impact data from Method 1 output criteria
 */
export function extractImpactsFromCriteria(criteria: string[]): CriterionImpact[] {
  const impacts: CriterionImpact[] = [];
  
  for (const criterion of criteria) {
    const impact = getCriterionImpact(criterion);
    if (impact) {
      impacts.push(impact);
    }
  }
  
  return impacts;
}
