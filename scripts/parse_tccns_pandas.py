#!/usr/bin/env python3
"""
Parse TCCNS Excel file using pandas
"""
import json
import pandas as pd

def parse_tccns_excel(file_path):
    """Parse TCCNS Excel file and return structured data"""
    try:
        # Try reading as xlsx first
        df = pd.read_excel(file_path, engine='openpyxl')
    except:
        try:
            # Try xlrd for older .xls files
            df = pd.read_excel(file_path, engine='xlrd')
        except:
            # Last resort - try without specifying engine
            df = pd.read_excel(file_path)
    
    print(f"Columns: {df.columns.tolist()}")
    print(f"Total rows: {len(df)}")
    print(f"\nFirst 5 rows:")
    print(df.head())
    
    # Parse data - adjust column names based on actual structure
    tccns_data = {}
    
    for idx, row in df.iterrows():
        try:
            # Get TTU course and TCCNS code from first two columns
            ttu_course = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else None
            tccns_code = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else None
            
            if ttu_course and tccns_code and ttu_course != 'nan' and tccns_code != 'nan':
                if ttu_course not in tccns_data:
                    tccns_data[ttu_course] = []
                
                equiv = {
                    "tccnsCode": tccns_code,
                    "courseName": str(row.iloc[2]).strip() if len(row) > 2 and pd.notna(row.iloc[2]) else "",
                    "credits": int(float(row.iloc[3])) if len(row) > 3 and pd.notna(row.iloc[3]) else 3,
                    "institutions": [str(row.iloc[4]).strip()] if len(row) > 4 and pd.notna(row.iloc[4]) else ["All Texas Community Colleges"],
                    "notes": str(row.iloc[5]).strip() if len(row) > 5 and pd.notna(row.iloc[5]) else ""
                }
                
                tccns_data[ttu_course].append(equiv)
        except Exception as e:
            if idx < 10:  # Only print first few errors
                print(f"Error parsing row {idx}: {e}")
            continue
    
    print(f"\nParsed {len(tccns_data)} TTU courses")
    total_equivalencies = sum(len(v) for v in tccns_data.values())
    print(f"Total equivalencies: {total_equivalencies}")
    
    return tccns_data

if __name__ == "__main__":
    input_file = "test/TCCNS Matrix - Fall 2024 - Summer 2025 (Default).xlsx"
    output_file = "public/data/TX_equivalencies.json"
    
    print(f"Parsing {input_file}...")
    data = parse_tccns_excel(input_file)
    
    print(f"\nWriting to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    print("Done!")
