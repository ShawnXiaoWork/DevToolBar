import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveExcelReadPath, resolveExcelWriteTargets } from './vite.config.js';

test('resolveExcelReadPath fails when configured external file is missing', () => {
  assert.throws(
    () => resolveExcelReadPath({
      projectRoot: '/project',
      filename: 'ArmyTable.xlsx',
      externalPathBase: '/external',
      existsSync: (targetPath) => targetPath === '/external'
    }),
    /EXTERNAL_SYNC_PATH 下缺少 ArmyTable\.xlsx/
  );
});

test('resolveExcelWriteTargets fails before writing when configured external file is missing', () => {
  assert.throws(
    () => resolveExcelWriteTargets({
      projectRoot: '/project',
      filename: 'ArmyTable.xlsx',
      externalPathBase: '/external',
      existsSync: (targetPath) => targetPath === '/external'
    }),
    /EXTERNAL_SYNC_PATH 下缺少 ArmyTable\.xlsx/
  );
});

test('resolveExcelReadPath falls back to public only when external path is not configured', () => {
  const targetPath = resolveExcelReadPath({
    projectRoot: '/project',
    filename: 'ArmyTable.xlsx',
    externalPathBase: '',
    existsSync: () => true
  });

  assert.equal(targetPath, '/project/public/ArmyTable.xlsx');
});

test('resolveExcelReadPath reads names.xlsx from public even when external path is configured', () => {
  const targetPath = resolveExcelReadPath({
    projectRoot: '/project',
    filename: 'names.xlsx',
    externalPathBase: '/external',
    existsSync: (targetPath) => targetPath === '/external'
  });

  assert.equal(targetPath, '/project/public/names.xlsx');
});
