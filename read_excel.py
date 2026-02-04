#!/usr/bin/env python3
import sys
import zipfile
import xml.etree.ElementTree as ET

def read_xlsx(filepath):
    """Read XLSX file without pandas/openpyxl"""
    try:
        with zipfile.ZipFile(filepath, 'r') as zip_ref:
            # Read shared strings
            shared_strings = []
            try:
                with zip_ref.open('xl/sharedStrings.xml') as f:
                    tree = ET.parse(f)
                    root = tree.getroot()
                    ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                    for si in root.findall('.//main:si', ns):
                        t = si.find('.//main:t', ns)
                        if t is not None:
                            shared_strings.append(t.text)
            except KeyError:
                pass
            
            # Read worksheet
            with zip_ref.open('xl/worksheets/sheet1.xml') as f:
                tree = ET.parse(f)
                root = tree.getroot()
                ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                
                rows = []
                for row in root.findall('.//main:row', ns):
                    row_data = []
                    for cell in row.findall('.//main:c', ns):
                        cell_type = cell.get('t')
                        v = cell.find('.//main:v', ns)
                        
                        if v is not None:
                            if cell_type == 's':  # Shared string
                                idx = int(v.text)
                                row_data.append(shared_strings[idx] if idx < len(shared_strings) else '')
                            else:
                                row_data.append(v.text)
                        else:
                            row_data.append('')
                    
                    if any(row_data):  # Only add non-empty rows
                        rows.append(row_data)
                
                return rows
    except Exception as e:
        print(f"Error reading file: {e}")
        return None

if __name__ == "__main__":
    filepath = '/Users/sim/Desktop/exp2/components/data/TTU VPAT SCORECARD.xlsx'
    rows = read_xlsx(filepath)
    
    if rows:
        print(f"Total rows: {len(rows)}\n")
        print("First 30 rows:")
        print("=" * 100)
        for i, row in enumerate(rows[:30], 1):
            print(f"Row {i}: {row}")
        
        if len(rows) > 30:
            print(f"\n... ({len(rows) - 30} more rows)")
