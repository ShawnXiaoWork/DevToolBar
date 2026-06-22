import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcPath = path.resolve(__dirname, './orig_StageStepTable.xlsx');
const destPath = path.resolve(__dirname, './test_output_no_styles.xlsx');

try {
  console.log('Reading from:', srcPath);
  const buffer = fs.readFileSync(srcPath);
  
  // Try reading WITHOUT cellStyles, cellNF, cellComments
  const workbook = XLSX.read(new Uint8Array(buffer), {
    type: 'array'
  });
  
  console.log('Workbook keys:', Object.keys(workbook));
  if (workbook.Themes) {
    console.log('Themes stringified size:', JSON.stringify(workbook.Themes).length);
  } else {
    console.log('Themes is undefined!');
  }
  
  console.log('Writing to:', destPath);
  const outBase64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const outBuffer = Buffer.from(outBase64, 'base64');
  fs.writeFileSync(destPath, outBuffer);
  
  console.log('Original size:', buffer.length);
  console.log('Written size (no styles):', outBuffer.length);
  
} catch (err) {
  console.error('Error:', err);
}
