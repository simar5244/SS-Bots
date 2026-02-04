#!/usr/bin/env python3
"""
Parse TCCNS Excel file and convert to JSON
"""
import json
import sys

try:
    import xlrd
except ImportError:
    print("Installing xlrd...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "xlrd"])
    import xlrd

def parse_tccns_excel(file_path):
    """Parse TCCNS Excel file and return structured data"""
    workbook = xlrd.open_workbook(file_path)
    sheet = workbook.sheet_by_index(0)
    
    # Get headers from first row
    headers = [sheet.cell_value(0, col) for col in range(sheet.ncols)]
    print(f"Headers: {headers[:10]}")
    print(f"Total rows: {sheet.nrows}")
    
    # Parse data
    tccns_data = {}
    
    for row_idx in range(1, sheet.nrows):
        try:
            row_data = [sheet.cell_value(row_idx, col) for col in range(sheet.ncols)]
            
            # Assuming columns: TTU Course, TCCNS Code, Course Name, Credits, Institution, Notes
            # Adjust based on actual structure
            if len(row_data) >= 4:
                ttu_course = str(row_data[0]).strip() if row_data[0] else None
                tccns_code = str(row_data[1]).strip() if row_data[1] else None
                course_name = str(row_data[2]).strip() if row_data[2] else ""
                
                if ttu_course and tccns_code:
                    if ttu_course not in tccns_data:
                        tccns_data[ttu_course] = []
                    
                    equiv = {
                        "tccnsCode": tccns_code,
                        "courseName": course_name,
                        "credits": int(float(row_data[3])) if len(row_data) > 3 and row_data[3] else 3,
                        "institutions": [str(row_data[4]).strip()] if len(row_data) > 4 and row_data[4] else ["All Texas Community Colleges"],
                        "notes": str(row_data[5]).strip() if len(row_data) > 5 and row_data[5] else ""
                    }
                    
                    tccns_data[ttu_course].append(equiv)
        except Exception as e:
            print(f"Error parsing row {row_idx}: {e}")
            continue
    
    print(f"Parsed {len(tccns_data)} TTU courses")
    total_equivalencies = sum(len(v) for v in tccns_data.values())
    print(f"Total equivalencies: {total_equivalencies}")
    
    return tccns_data

if __name__ == "__main__":
    input_file = "test/TCCNS Matrix - Fall 2024 - Summer 2025 (Default).xls"
    output_file = "public/data/TX_equivalencies.json"
    
    print(f"Parsing {input_file}...")
    data = parse_tccns_excel(input_file)
    
    print(f"Writing to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    print("Done!")
