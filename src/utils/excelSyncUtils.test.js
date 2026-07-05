import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

import { syncDataToSheet } from './excelSyncUtils.js';

test('syncDataToSheet can locate Excel Id column using lowercase data id field', () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['#', '#'],
    ['Id', 'Note'],
    ['int', 'string'],
    ['id', 'name'],
    [1002, 'Old Name']
  ]);
  const headers = ['Id', 'Note'];
  const range = XLSX.utils.decode_range(sheet['!ref']);

  syncDataToSheet({
    sheet,
    headers,
    range,
    dataToSync: [{ id: 1002, name: 'New Name' }],
    config: {
      idField: 'Id',
      dataIdField: 'id',
      mapping: {
        Id: 'id',
        Note: 'name'
      }
    }
  });

  assert.equal(sheet[XLSX.utils.encode_cell({ c: 1, r: 4 })].v, 'New Name');
  assert.equal(range.e.r, 4);
});
