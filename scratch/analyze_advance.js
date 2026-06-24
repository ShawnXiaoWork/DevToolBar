import XLSX from 'xlsx';

function analyze(file) {
  console.log('--- Analyze ' + file + ' ---');
  const wb = XLSX.readFile(file);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {header: 1});
  const advanceValues = new Set();
  const advanceMap = {};
  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[4] !== undefined) {
      advanceValues.add(row[4]);
      advanceMap[row[4]] = (advanceMap[row[4]] || 0) + 1;
    }
  }
  console.log('Advance field values distribution:', advanceMap);
}

analyze('public/StageStepTable.xlsx');
analyze('scratch/orig_StageStepTable.xlsx');
