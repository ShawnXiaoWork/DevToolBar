import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.resolve(__dirname, '../public/StageStepTable.xlsx');

try {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(new Uint8Array(buffer), {
    type: 'array',
    cellStyles: true,
    cellNF: true,
    cellComments: true
  });
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  let totalCells = 0;
  let totalLength = 0;
  let maxLen = 0;
  let maxCell = '';
  let maxVal = null;
  
  const cellsWithLargeData = [];
  
  Object.keys(sheet).forEach(key => {
    if (key.startsWith('!')) return; // skip metadata
    totalCells++;
    const cell = sheet[key];
    if (cell && cell.v !== undefined) {
      const str = String(cell.v);
      totalLength += str.length;
      if (str.length > maxLen) {
        maxLen = str.length;
        maxCell = key;
        maxVal = str;
      }
      if (str.length > 500) {
        cellsWithLargeData.push({ key, len: str.length, val: str.substring(0, 100) + '...' });
      }
    }
  });
  
  console.log('Total cell count (excluding metadata):', totalCells);
  console.log('Total cell value characters length:', totalLength);
  console.log('Max cell length:', maxLen, 'at', maxCell);
  if (maxLen > 0) {
    console.log('Max cell value sample:', maxVal.substring(0, 300));
  }
  console.log('Cells with data length > 500:', cellsWithLargeData);

  // Let's also check if cells have huge style objects
  let totalStyleKeys = 0;
  Object.keys(sheet).forEach(key => {
    if (key.startsWith('!')) return;
    const cell = sheet[key];
    if (cell && cell.s) {
      totalStyleKeys += JSON.stringify(cell.s).length;
    }
  });
  console.log('Total stringified style size in sheet:', totalStyleKeys);
  
} catch (err) {
  console.error('Error:', err);
}
