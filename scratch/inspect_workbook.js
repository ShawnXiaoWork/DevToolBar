import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.resolve(__dirname, './orig_StageStepTable.xlsx');

try {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(new Uint8Array(buffer), {
    type: 'array',
    cellStyles: true,
    cellNF: true,
    cellComments: true
  });
  
  console.log('Workbook keys:', Object.keys(workbook));
  
  for (const key of Object.keys(workbook)) {
    try {
      const size = JSON.stringify(workbook[key]).length;
      console.log(`Key "${key}" stringified size:`, size);
    } catch (e) {
      console.log(`Key "${key}" failed to stringify:`, e.message);
    }
  }

} catch (err) {
  console.error('Error:', err);
}
