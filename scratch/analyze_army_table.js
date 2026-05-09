import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '../public/ArmyTable.xlsx');

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const headers = jsonData[1];
console.log('Headers:', JSON.stringify(headers));

// Search for 1001 in Id column (index 1)
const allIds = jsonData.map(row => row[1]);
const index1001 = allIds.indexOf(1001);
console.log('Index of 1001:', index1001);

if (index1001 !== -1) {
    console.log('Row 1001:', JSON.stringify(jsonData[index1001]));
} else {
    // Try string comparison
    const index1001Str = allIds.indexOf('1001');
    console.log('Index of "1001":', index1001Str);
    if (index1001Str !== -1) {
        console.log('Row "1001":', JSON.stringify(jsonData[index1001Str]));
    }
}
