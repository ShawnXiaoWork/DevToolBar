import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.resolve(__dirname, './orig_StageStepTable.xlsx');
console.log('Testing file path:', filePath);

try {
  const fileExists = fs.existsSync(filePath);
  console.log('File exists:', fileExists);
  if (!fileExists) {
    process.exit(1);
  }
  const stat = fs.statSync(filePath);
  console.log('File size:', stat.size);

  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(new Uint8Array(buffer), {
    type: 'array',
    cellStyles: true,
    cellNF: true,
    cellComments: true
  });
  
  console.log('SheetNames:', workbook.SheetNames);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  console.log('Sheet ref:', sheet['!ref']);
  
  const range = XLSX.utils.decode_range(sheet['!ref']);
  console.log('Range dimensions:', range);
  
  // Print some rows to see what is inside
  console.log('First 20 rows:');
  for (let r = 0; r < 20; r++) {
    const rowCells = [];
    for (let c = 0; c < 25; c++) {
      const addr = XLSX.utils.encode_cell({ c, r });
      if (sheet[addr]) {
        rowCells.push(`${addr}: ${sheet[addr].v}`);
      }
    }
    if (rowCells.length > 0) {
      console.log(`Row ${r}:`, rowCells.join(', '));
    }
  }

} catch (err) {
  console.error('Error reading excel file:', err);
}
