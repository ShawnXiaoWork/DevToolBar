import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcPath = path.resolve(__dirname, './orig_StageStepTable.xlsx');
const destPath = path.resolve(__dirname, './test_output.xlsx');

try {
  console.log('Reading from:', srcPath);
  const buffer = fs.readFileSync(srcPath);
  const workbook = XLSX.read(new Uint8Array(buffer), {
    type: 'array',
    cellStyles: true,
    cellNF: true,
    cellComments: true
  });
  
  console.log('Writing to:', destPath);
  const outBase64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const outBuffer = Buffer.from(outBase64, 'base64');
  fs.writeFileSync(destPath, outBuffer);
  
  console.log('Original size:', buffer.length);
  console.log('Written size:', outBuffer.length);
  
  // Try reading it back
  const workbook2 = XLSX.read(new Uint8Array(outBuffer), {
    type: 'array',
    cellStyles: true,
    cellNF: true,
    cellComments: true
  });
  console.log('Read back Sheet ref:', workbook2.Sheets[workbook2.SheetNames[0]]['!ref']);
} catch (err) {
  console.error('Error:', err);
}
