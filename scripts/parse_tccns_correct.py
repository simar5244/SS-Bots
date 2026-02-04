#!/usr/bin/env python3
"""
Correctly parse TCCNS Excel file with institution-specific mappings
Structure: Each institution has its own course codes that map to common TCCNS codes
"""
import json
import pandas as pd
from texas_institutions import FICE_TO_INSTITUTION

def parse_tccns_excel(file_path):
    """Parse TCCNS Excel with correct structure"""
    df = pd.read_excel(file_path, engine='openpyxl', header=None)
    
    # Row 0: FICE codes (institution IDs)
    # Row 1: Institution names and column headers
    # Row 2+: Course data
    
    # Get institution info from headers
    # Row 0: FICE codes
    # Row 1: CEEB codes (not useful for names)
    institutions = {}
    for col_idx in range(3, len(df.columns), 3):  # Every 3 columns starting from column 3
        fice_code = df.iloc[0, col_idx]
        if pd.notna(fice_code):
            fice_str = str(int(fice_code)) if isinstance(fice_code, (int, float)) else str(fice_code)
            # Look up actual institution name from our mapping
            institution_name = FICE_TO_INSTITUTION.get(fice_str, f'Institution {fice_str}')
            institutions[col_idx] = {
                'fice': fice_str,
                'name': institution_name
            }
    
    print(f"Found {len(institutions)} institutions")
    print(f"Sample institutions: {list(institutions.values())[:5]}")
    
    # Parse course mappings
    # Structure: tccns_code -> list of {institution, institutionCode, credits}
    tccns_mappings = {}
    
    for row_idx in range(2, len(df)):  # Start from row 2 (first data row)
        try:
            course_title = df.iloc[row_idx, 0]
            tccns_prefix = df.iloc[row_idx, 1]
            tccns_number = df.iloc[row_idx, 2]
            
            if pd.notna(tccns_prefix) and pd.notna(tccns_number):
                tccns_code = f"{tccns_prefix} {tccns_number}"
                
                if tccns_code not in tccns_mappings:
                    tccns_mappings[tccns_code] = {
                        'courseName': str(course_title) if pd.notna(course_title) else '',
                        'tccnsCode': tccns_code,
                        'institutions': []
                    }
                
                # Parse each institution's mapping
                for col_idx, inst_info in institutions.items():
                    institution_course = df.iloc[row_idx, col_idx]
                    credit_hours = df.iloc[row_idx, col_idx + 1]
                    
                    if pd.notna(institution_course) and str(institution_course).strip():
                        tccns_mappings[tccns_code]['institutions'].append({
                            'fice': inst_info['fice'],
                            'name': inst_info['name'],
                            'courseCode': str(institution_course).strip(),
                            'credits': int(float(credit_hours)) if pd.notna(credit_hours) else 3
                        })
        
        except Exception as e:
            if row_idx < 10:
                print(f"Error parsing row {row_idx}: {e}")
            continue
    
    print(f"\nParsed {len(tccns_mappings)} TCCNS courses")
    total_mappings = sum(len(v['institutions']) for v in tccns_mappings.values())
    print(f"Total institution mappings: {total_mappings}")
    
    return tccns_mappings

def create_reverse_lookup(tccns_mappings):
    """Create reverse lookup: institution course code -> TCCNS code"""
    reverse_lookup = {}
    
    for tccns_code, data in tccns_mappings.items():
        for inst in data['institutions']:
            key = f"{inst['fice']}:{inst['courseCode']}"
            if key not in reverse_lookup:
                reverse_lookup[key] = []
            reverse_lookup[key].append({
                'tccnsCode': tccns_code,
                'courseName': data['courseName'],
                'institutionName': inst['name']
            })
    
    return reverse_lookup

if __name__ == "__main__":
    input_file = "test/TCCNS Matrix - Fall 2024 - Summer 2025 (Default).xlsx"
    output_file = "public/data/TX_equivalencies.json"
    reverse_output = "public/data/TX_equivalencies_reverse.json"
    
    print(f"Parsing {input_file}...")
    tccns_data = parse_tccns_excel(input_file)
    
    print(f"\nCreating reverse lookup...")
    reverse_data = create_reverse_lookup(tccns_data)
    print(f"Reverse lookup entries: {len(reverse_data)}")
    
    print(f"\nWriting to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(tccns_data, f, indent=2)
    
    print(f"Writing reverse lookup to {reverse_output}...")
    with open(reverse_output, 'w') as f:
        json.dump(reverse_data, f, indent=2)
    
    # Test with Collin College (FICE 3580)
    print("\n=== Testing with Collin College courses ===")
    collin_courses = [k for k in reverse_data.keys() if k.startswith('3580:')]
    print(f"Found {len(collin_courses)} Collin College courses")
    print("\nSample mappings:")
    for course_key in list(collin_courses)[:5]:
        print(f"{course_key} -> {reverse_data[course_key]}")
    
    print("\nDone!")
