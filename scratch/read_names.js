import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.resolve(__dirname, '../public/ArmyTable.xlsx');
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
    type: 'array'
  });
  
  console.log('SheetNames:', workbook.SheetNames);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const headers = jsonData[1] || [];
  const styleIdx = headers.indexOf('Style');
  const quaIdx = headers.indexOf('Qua');
  const idIdx = headers.indexOf('Id');
  const nameIdx = headers.indexOf('Note') !== -1 ? headers.indexOf('Note') : headers.indexOf('Name');

  console.log('Headers:', headers);
  console.log(`Indices - Style: ${styleIdx}, Qua: ${quaIdx}, Id: ${idIdx}, Name: ${nameIdx}`);

  const styles = new Set();
  const quas = new Set();
  const sampleRows = [];

  // 从第 4 行 (数据行从索引 4 开始) 开始解析
  for (let i = 4; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;
    const styleVal = row[styleIdx];
    const quaVal = row[quaIdx];
    const idVal = row[idIdx];
    const nameVal = row[nameIdx];

    if (styleVal !== undefined) styles.add(styleVal);
    if (quaVal !== undefined) quas.add(quaVal);

    if (sampleRows.length < 10) {
      sampleRows.push({
        Id: idVal,
        Name: nameVal,
        Style: styleVal,
        Qua: quaVal
      });
    }
  }

  console.log('Unique Styles:', Array.from(styles));
  console.log('Unique Quas:', Array.from(quas));
  console.log('Sample rows (first 10):');
  console.log(sampleRows);

} catch (err) {
  console.error('Error reading excel file:', err);
}
