import openpyxl
import traceback
import sys
import os

file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), './test_synced_output.xlsx'))
print("Diagnosing path:", file_path)

try:
    wb = openpyxl.load_workbook(file_path)
    print("openpyxl loaded workbook successfully!")
    sheet = wb.active
    print("Active sheet name:", sheet.title)
    print("Dimensions:", sheet.dimensions)
    
    # Try reading some cells
    print("First row values:")
    for col in range(1, 11):
        cell_val = sheet.cell(row=1, column=col).value
        print(f"Cell(1, {col}): {cell_val}")
except Exception as e:
    print("openpyxl failed to load workbook!")
    traceback.print_exc()
    sys.exit(1)
