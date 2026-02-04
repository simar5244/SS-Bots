#!/usr/bin/env python3
"""
VPAT Parser and Validator
Extracts and validates VPAT documents against UTA accessibility requirements
"""

import re
import PyPDF2
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class ConformanceLevel(Enum):
    """WCAG Conformance levels as they appear in VPATs"""
    SUPPORTS = "Supports"
    PARTIALLY_SUPPORTS = "Partially Supports"
    DOES_NOT_SUPPORT = "Does Not Support"
    NOT_APPLICABLE = "Not Applicable"
    NOT_EVALUATED = "Not Evaluated"


class ScorecardMapping(Enum):
    """Mapping to scorecard equivalents"""
    SUPPORTS = "Supports"
    PARTIALLY_SUPPORTS = "Partially Supports"
    DOES_NOT_SUPPORT = "Does Not Support"


@dataclass
class VPATMetadata:
    """Core VPAT metadata"""
    vpat_version: Optional[str] = None
    product_name: Optional[str] = None
    vendor_name: Optional[str] = None
    report_date: Optional[str] = None
    wcag_version: Optional[str] = None
    wcag_level: Optional[str] = None
    product_description: Optional[str] = None
    contact_info: Optional[str] = None


@dataclass
class WCAGCriterion:
    """Individual WCAG success criterion"""
    criterion_id: str
    criterion_name: str
    level: str  # A, AA, AAA
    conformance_level: ConformanceLevel
    scorecard_equivalent: ScorecardMapping
    remarks: Optional[str] = None


@dataclass
class ValidationResult:
    """Validation results for VPAT requirements"""
    is_valid: bool
    vpat_version_valid: bool
    date_valid: bool
    product_name_valid: bool
    wcag_level_valid: bool
    errors: List[str]
    warnings: List[str]
    metadata: VPATMetadata


class VPATParser:
    """Parse and validate VPAT documents"""
    
    # Regex patterns for extracting metadata
    PATTERNS = {
        'vpat_version': r'VPAT[®]?\s+Version\s+(\d+\.\d+)',
        'product_name': r'Name of Product[/\s]*Version:\s*(.+?)(?:\n|Report Date)',
        'report_date': r'Report Date:\s*(.+?)(?:\n|Product Description)',
        'product_description': r'Product Description:\s*(.+?)(?:\n\n|Contact)',
        'contact_info': r'Contact information:\s*(.+?)(?:\n\n|Notes)',
        'wcag_version': r'Web Content Accessibility Guidelines\s+(\d+\.\d+)',
        'wcag_level': r'level\s+(A(?:\s+and\s+AA)?|AA)',
    }
    
    # WCAG 2.1 Level A and AA criteria (comprehensive list)
    WCAG_21_CRITERIA = {
        # Level A
        '1.1.1': ('Non-text Content', 'A'),
        '1.2.1': ('Audio-only and Video-only (Prerecorded)', 'A'),
        '1.2.2': ('Captions (Prerecorded)', 'A'),
        '1.2.3': ('Audio Description or Media Alternative (Prerecorded)', 'A'),
        '1.3.1': ('Info and Relationships', 'A'),
        '1.3.2': ('Meaningful Sequence', 'A'),
        '1.3.3': ('Sensory Characteristics', 'A'),
        '1.4.1': ('Use of Color', 'A'),
        '1.4.2': ('Audio Control', 'A'),
        '2.1.1': ('Keyboard', 'A'),
        '2.1.2': ('No Keyboard Trap', 'A'),
        '2.1.4': ('Character Key Shortcuts', 'A'),
        '2.2.1': ('Timing Adjustable', 'A'),
        '2.2.2': ('Pause, Stop, Hide', 'A'),
        '2.3.1': ('Three Flashes or Below Threshold', 'A'),
        '2.4.1': ('Bypass Blocks', 'A'),
        '2.4.2': ('Page Titled', 'A'),
        '2.4.3': ('Focus Order', 'A'),
        '2.4.4': ('Link Purpose (In Context)', 'A'),
        '2.5.1': ('Pointer Gestures', 'A'),
        '2.5.2': ('Pointer Cancellation', 'A'),
        '2.5.3': ('Label in Name', 'A'),
        '2.5.4': ('Motion Actuation', 'A'),
        '3.1.1': ('Language of Page', 'A'),
        '3.2.1': ('On Focus', 'A'),
        '3.2.2': ('On Input', 'A'),
        '3.3.1': ('Error Identification', 'A'),
        '3.3.2': ('Labels or Instructions', 'A'),
        '4.1.1': ('Parsing', 'A'),
        '4.1.2': ('Name, Role, Value', 'A'),
        
        # Level AA
        '1.2.4': ('Captions (Live)', 'AA'),
        '1.2.5': ('Audio Description (Prerecorded)', 'AA'),
        '1.3.4': ('Orientation', 'AA'),
        '1.3.5': ('Identify Input Purpose', 'AA'),
        '1.4.3': ('Contrast (Minimum)', 'AA'),
        '1.4.4': ('Resize Text', 'AA'),
        '1.4.5': ('Images of Text', 'AA'),
        '1.4.10': ('Reflow', 'AA'),
        '1.4.11': ('Non-text Contrast', 'AA'),
        '1.4.12': ('Text Spacing', 'AA'),
        '1.4.13': ('Content on Hover or Focus', 'AA'),
        '2.4.5': ('Multiple Ways', 'AA'),
        '2.4.6': ('Headings and Labels', 'AA'),
        '2.4.7': ('Focus Visible', 'AA'),
        '3.1.2': ('Language of Parts', 'AA'),
        '3.2.3': ('Consistent Navigation', 'AA'),
        '3.2.4': ('Consistent Identification', 'AA'),
        '3.3.3': ('Error Suggestion', 'AA'),
        '3.3.4': ('Error Prevention (Legal, Financial, Data)', 'AA'),
        '4.1.3': ('Status Messages', 'AA'),
    }
    
    def __init__(self):
        self.metadata = VPATMetadata()
        self.criteria: List[WCAGCriterion] = []
    
    def parse_pdf(self, pdf_path: str) -> Tuple[VPATMetadata, List[WCAGCriterion]]:
        """Extract text from PDF and parse VPAT content"""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                full_text = ""
                
                # Extract text from all pages
                for page in pdf_reader.pages:
                    full_text += page.extract_text() + "\n"
                
                # Parse metadata
                self.metadata = self._extract_metadata(full_text)
                
                # Parse WCAG criteria
                self.criteria = self._extract_wcag_criteria(full_text)
                
                return self.metadata, self.criteria
                
        except Exception as e:
            raise Exception(f"Error parsing PDF: {str(e)}")
    
    def _extract_metadata(self, text: str) -> VPATMetadata:
        """Extract metadata from VPAT text"""
        metadata = VPATMetadata()
        
        # Extract VPAT version
        match = re.search(self.PATTERNS['vpat_version'], text, re.IGNORECASE)
        if match:
            metadata.vpat_version = match.group(1)
        
        # Extract product name
        match = re.search(self.PATTERNS['product_name'], text, re.IGNORECASE | re.DOTALL)
        if match:
            metadata.product_name = match.group(1).strip()
        
        # Extract report date
        match = re.search(self.PATTERNS['report_date'], text, re.IGNORECASE)
        if match:
            metadata.report_date = match.group(1).strip()
        
        # Extract product description
        match = re.search(self.PATTERNS['product_description'], text, re.IGNORECASE | re.DOTALL)
        if match:
            metadata.product_description = match.group(1).strip()
        
        # Extract contact info
        match = re.search(self.PATTERNS['contact_info'], text, re.IGNORECASE | re.DOTALL)
        if match:
            metadata.contact_info = match.group(1).strip()
        
        # Extract WCAG version
        match = re.search(self.PATTERNS['wcag_version'], text, re.IGNORECASE)
        if match:
            metadata.wcag_version = match.group(1)
        
        # Extract WCAG level
        match = re.search(self.PATTERNS['wcag_level'], text, re.IGNORECASE)
        if match:
            level_text = match.group(1)
            if 'AA' in level_text:
                metadata.wcag_level = 'AA'
            elif 'A' in level_text:
                metadata.wcag_level = 'A'
        
        return metadata
    
    def _extract_wcag_criteria(self, text: str) -> List[WCAGCriterion]:
        """Extract WCAG success criteria and their conformance levels"""
        criteria_list = []
        
        # Pattern to match WCAG criteria entries
        # Example: "1.1.1 Non-text Content (Level A) ... Supports ... remarks"
        pattern = r'(\d+\.\d+\.\d+)\s+([^\(]+)\s+\(Level\s+(A{1,3})\).*?(?:Conformance\s+Level|Remarks)\s+(Supports|Partially Supports|Does Not Support|Not Applicable|Not Evaluated)'
        
        matches = re.finditer(pattern, text, re.IGNORECASE | re.DOTALL)
        
        for match in matches:
            criterion_id = match.group(1)
            criterion_name = match.group(2).strip()
            level = match.group(3)
            conformance = match.group(4)
            
            # Map conformance level
            conformance_enum = self._map_conformance_level(conformance)
            scorecard_equiv = self._map_to_scorecard(conformance_enum)
            
            criterion = WCAGCriterion(
                criterion_id=criterion_id,
                criterion_name=criterion_name,
                level=level,
                conformance_level=conformance_enum,
                scorecard_equivalent=scorecard_equiv
            )
            
            criteria_list.append(criterion)
        
        return criteria_list
    
    def _map_conformance_level(self, conformance_text: str) -> ConformanceLevel:
        """Map conformance text to enum"""
        conformance_text = conformance_text.strip()
        
        if 'Partially Supports' in conformance_text:
            return ConformanceLevel.PARTIALLY_SUPPORTS
        elif 'Does Not Support' in conformance_text:
            return ConformanceLevel.DOES_NOT_SUPPORT
        elif 'Not Applicable' in conformance_text:
            return ConformanceLevel.NOT_APPLICABLE
        elif 'Not Evaluated' in conformance_text:
            return ConformanceLevel.NOT_EVALUATED
        elif 'Supports' in conformance_text:
            return ConformanceLevel.SUPPORTS
        else:
            return ConformanceLevel.NOT_EVALUATED
    
    def _map_to_scorecard(self, conformance: ConformanceLevel) -> ScorecardMapping:
        """Map VPAT conformance to scorecard equivalent"""
        # Per requirements:
        # - Not Applicable → Supports
        # - Not Evaluated → Does Not Support
        # - Everything else maps directly
        
        if conformance == ConformanceLevel.NOT_APPLICABLE:
            return ScorecardMapping.SUPPORTS
        elif conformance == ConformanceLevel.NOT_EVALUATED:
            return ScorecardMapping.DOES_NOT_SUPPORT
        elif conformance == ConformanceLevel.SUPPORTS:
            return ScorecardMapping.SUPPORTS
        elif conformance == ConformanceLevel.PARTIALLY_SUPPORTS:
            return ScorecardMapping.PARTIALLY_SUPPORTS
        else:  # DOES_NOT_SUPPORT
            return ScorecardMapping.DOES_NOT_SUPPORT
    
    def validate(self, metadata: VPATMetadata) -> ValidationResult:
        """Validate VPAT against UTA requirements"""
        errors = []
        warnings = []
        
        # 1. Check VPAT version (must be 2.5 or above)
        vpat_version_valid = False
        if metadata.vpat_version:
            try:
                version = float(metadata.vpat_version)
                if version >= 2.5:
                    vpat_version_valid = True
                else:
                    errors.append(f"VPAT version {metadata.vpat_version} is below required 2.5")
            except ValueError:
                errors.append(f"Invalid VPAT version format: {metadata.vpat_version}")
        else:
            errors.append("VPAT version not found in document")
        
        # 2. Check report date (must be from 2025)
        date_valid = False
        if metadata.report_date:
            # Try to parse various date formats
            date_patterns = [
                r'2025',  # Just check if 2025 appears
                r'(\w+)\s+\d+,\s+2025',  # Month DD, 2025
                r'\d+/\d+/2025',  # MM/DD/2025
            ]
            
            for pattern in date_patterns:
                if re.search(pattern, metadata.report_date):
                    date_valid = True
                    break
            
            if not date_valid:
                errors.append(f"Report date '{metadata.report_date}' is not from 2025")
        else:
            errors.append("Report date not found in document")
        
        # 3. Check product name (must have separate product name, not just vendor)
        product_name_valid = False
        if metadata.product_name:
            # Product name should be reasonably long (not just a vendor name)
            if len(metadata.product_name) > 3:
                product_name_valid = True
            else:
                warnings.append(f"Product name seems too short: '{metadata.product_name}'")
        else:
            errors.append("Product name not found in document")
        
        # 4. Check WCAG level (must be at least 2.1 Level AA)
        wcag_level_valid = False
        if metadata.wcag_version and metadata.wcag_level:
            try:
                wcag_ver = float(metadata.wcag_version)
                if wcag_ver >= 2.1 and metadata.wcag_level in ['AA', 'AAA']:
                    wcag_level_valid = True
                elif wcag_ver >= 2.1 and metadata.wcag_level == 'A':
                    errors.append(f"WCAG level is only 'A', but 'AA' is required")
                elif wcag_ver < 2.1:
                    errors.append(f"WCAG version {metadata.wcag_version} is below required 2.1")
            except ValueError:
                errors.append(f"Invalid WCAG version format: {metadata.wcag_version}")
        else:
            if not metadata.wcag_version:
                errors.append("WCAG version not found in document")
            if not metadata.wcag_level:
                errors.append("WCAG level not found in document")
        
        # Overall validation
        is_valid = vpat_version_valid and date_valid and product_name_valid and wcag_level_valid
        
        return ValidationResult(
            is_valid=is_valid,
            vpat_version_valid=vpat_version_valid,
            date_valid=date_valid,
            product_name_valid=product_name_valid,
            wcag_level_valid=wcag_level_valid,
            errors=errors,
            warnings=warnings,
            metadata=metadata
        )
    
    def generate_report(self, validation: ValidationResult, criteria: List[WCAGCriterion]) -> str:
        """Generate human-readable validation report"""
        report = []
        report.append("=" * 80)
        report.append("VPAT VALIDATION REPORT")
        report.append("=" * 80)
        report.append("")
        
        # Validation status
        status = "✅ VALID" if validation.is_valid else "❌ INVALID - REQUIRES MANUAL REVIEW"
        report.append(f"Overall Status: {status}")
        report.append("")
        
        # Metadata
        report.append("METADATA:")
        report.append(f"  Product Name: {validation.metadata.product_name or 'NOT FOUND'}")
        report.append(f"  VPAT Version: {validation.metadata.vpat_version or 'NOT FOUND'} {'✅' if validation.vpat_version_valid else '❌'}")
        report.append(f"  Report Date: {validation.metadata.report_date or 'NOT FOUND'} {'✅' if validation.date_valid else '❌'}")
        report.append(f"  WCAG Version: {validation.metadata.wcag_version or 'NOT FOUND'}")
        report.append(f"  WCAG Level: {validation.metadata.wcag_level or 'NOT FOUND'} {'✅' if validation.wcag_level_valid else '❌'}")
        report.append("")
        
        # Errors
        if validation.errors:
            report.append("ERRORS:")
            for error in validation.errors:
                report.append(f"  ❌ {error}")
            report.append("")
        
        # Warnings
        if validation.warnings:
            report.append("WARNINGS:")
            for warning in validation.warnings:
                report.append(f"  ⚠️  {warning}")
            report.append("")
        
        # WCAG Criteria Summary
        if criteria:
            report.append(f"WCAG CRITERIA EXTRACTED: {len(criteria)} criteria found")
            report.append("")
            
            # Count by conformance level
            conformance_counts = {}
            for criterion in criteria:
                level = criterion.scorecard_equivalent.value
                conformance_counts[level] = conformance_counts.get(level, 0) + 1
            
            report.append("Conformance Summary (Scorecard Mapping):")
            for level, count in sorted(conformance_counts.items()):
                report.append(f"  {level}: {count}")
            report.append("")
            
            # Show criteria that don't support
            non_supporting = [c for c in criteria if c.scorecard_equivalent != ScorecardMapping.SUPPORTS]
            if non_supporting:
                report.append(f"NON-SUPPORTING CRITERIA ({len(non_supporting)}):")
                for criterion in non_supporting[:10]:  # Show first 10
                    report.append(f"  {criterion.criterion_id} {criterion.criterion_name}")
                    report.append(f"    Original: {criterion.conformance_level.value}")
                    report.append(f"    Scorecard: {criterion.scorecard_equivalent.value}")
                
                if len(non_supporting) > 10:
                    report.append(f"  ... and {len(non_supporting) - 10} more")
        else:
            report.append("⚠️  No WCAG criteria could be extracted from the document")
        
        report.append("")
        report.append("=" * 80)
        
        return "\n".join(report)


def main():
    """Example usage"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python vpat_parser.py <path_to_vpat.pdf>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    parser = VPATParser()
    
    print("Parsing VPAT document...")
    metadata, criteria = parser.parse_pdf(pdf_path)
    
    print("Validating against UTA requirements...")
    validation = parser.validate(metadata)
    
    report = parser.generate_report(validation, criteria)
    print(report)
    
    # If invalid, suggest manual review
    if not validation.is_valid:
        print("\n⚠️  This VPAT requires manual review before processing.")
        print("Please verify the following before proceeding:")
        for error in validation.errors:
            print(f"  - {error}")


if __name__ == "__main__":
    main()
