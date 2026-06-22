import openpyxl
import os

orig_path = os.path.abspath(os.path.join(os.path.dirname(__file__), './orig_StageStepTable.xlsx'))
synced_path = os.path.abspath(os.path.join(os.path.dirname(__file__), './test_synced_output.xlsx'))

wb_orig = openpyxl.load_workbook(orig_path)
wb_sync = openpyxl.load_workbook(synced_path)

sheet_orig = wb_orig.active
sheet_sync = wb_sync.active

cells_to_check = ['A1', 'B2', 'B4', 'B5']

for addr in cells_to_check:
    c_orig = sheet_orig[addr]
    c_sync = sheet_sync[addr]
    
    print(f"--- Cell {addr} ---")
    print(f"Value - Orig: {c_orig.value}, Sync: {c_sync.value}")
    
    # Check font color
    font_orig = c_orig.font
    font_sync = c_sync.font
    print(f"Font Name - Orig: {font_orig.name}, Sync: {font_sync.name}")
    print(f"Font Color - Orig: {font_orig.color.value if font_orig and font_orig.color else None}, Sync: {font_sync.color.value if font_sync and font_sync.color else None}")
    
    # Check fill (background color)
    fill_orig = c_orig.fill
    fill_sync = c_sync.fill
    print(f"Fill Type - Orig: {fill_orig.fill_type}, Sync: {fill_sync.fill_type}")
    print(f"Fill Color - Orig: {fill_orig.start_color.value if fill_orig and fill_orig.start_color else None}, Sync: {fill_sync.start_color.value if fill_sync and fill_sync.start_color else None}")
