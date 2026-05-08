const XLSX = require('xlsx');
const workbook = XLSX.readFile('/Users/shawn/Work/DevToolBar/public/ArmyTable.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const json = XLSX.utils.sheet_to_json(worksheet);
console.log('Headers:', Object.keys(json[0]));
console.log('First Row:', json[0]);
