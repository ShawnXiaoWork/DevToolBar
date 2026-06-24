import XLSX from 'xlsx';
const wb = XLSX.readFile('public/StageStepTable.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, {header: 1});
console.log(rows.slice(0, 5));
