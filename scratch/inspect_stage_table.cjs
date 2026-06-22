const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve(__dirname, '../public/StageTable.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Sheet Name:', sheetName);
console.log('Headers (Row 2):', jsonData[1]);
console.log('Row 3 (Types/Comments):', jsonData[2]);
console.log('Row 4 (Description):', jsonData[3]);
console.log('Row 5 (First Data):', jsonData[4]);
console.log('Total Rows:', jsonData.length);
