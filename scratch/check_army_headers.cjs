const XLSX = require('xlsx');
const path = require('path');

const filePath = '/Users/shawn/Work/DevToolBar/public/ArmyTable.xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Headers (Row 2):', jsonData[1]);
console.log('Example Row (Row 5):', jsonData[4]);
