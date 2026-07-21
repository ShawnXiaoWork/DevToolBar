import test from 'node:test';
import assert from 'node:assert/strict';

import { generateStageStepData, syncAllLevelTables } from './exportUtils.js';

const samplePlan = [{ level: 1, hpCoeff: 1, atkCoeff: 1, selected: [] }];
const sampleUnits = [{ id: '1002', name: 'Test Unit', hp: 10, atk: 5, roles: [1] }];

test('syncAllLevelTables syncs ArmyTable along with stage tables', async () => {
  const calls = [];

  const result = await syncAllLevelTables({
    fullLevelPlan: samplePlan,
    units: sampleUnits,
    roleWeights: {},
    derivationParams: {},
    syncers: {
      syncArmyTable: async () => calls.push('ArmyTable.xlsx'),
      syncStageTable: async () => calls.push('StageTable.xlsx'),
      syncStageStepTable: async () => calls.push('StageStepTable.xlsx')
    }
  });

  assert.deepEqual(calls, ['ArmyTable.xlsx', 'StageTable.xlsx', 'StageStepTable.xlsx']);
  assert.equal(result.ok, true);
  assert.deepEqual(result.syncedTables, ['ArmyTable.xlsx', 'StageTable.xlsx', 'StageStepTable.xlsx']);
});

test('syncAllLevelTables reports failed table details instead of succeeding silently', async () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await assert.rejects(
      syncAllLevelTables({
        fullLevelPlan: samplePlan,
        units: sampleUnits,
        roleWeights: {},
        derivationParams: {},
        syncers: {
          syncArmyTable: async () => {},
          syncStageTable: async () => {
            throw new Error('disk full');
          },
          syncStageStepTable: async () => {}
        }
      }),
      (error) => {
        assert.equal(error.name, 'LevelTableSyncError');
        assert.deepEqual(error.failedTables, [{ table: 'StageTable.xlsx', message: 'disk full' }]);
        assert.deepEqual(error.syncedTables, ['ArmyTable.xlsx', 'StageStepTable.xlsx']);
        return true;
      }
    );
  } finally {
    console.error = originalConsoleError;
  }
});

test('generateStageStepData writes Monster entries without refresh time', () => {
  const rows = generateStageStepData([
    {
      level: 1,
      hpCoeff: 1,
      atkCoeff: 1,
      selected: [
        { id: '10002', count: 3 },
        { id: '20001', count: 5 }
      ]
    }
  ]);

  assert.deepEqual(JSON.parse(rows[0][6]), [
    [10002, 3],
    [20001, 4]
  ]);
});

test('generateStageStepData assigns centered forward formation positions', () => {
  const rows = generateStageStepData([
    {
      level: 2,
      hpCoeff: 1,
      atkCoeff: 1,
      selected: [
        { id: '10002', count: 40 },
        { id: '20001', count: 35 },
        { id: '30002', count: 30 },
        { id: '40008', count: 20 },
        { id: '50001', count: 10 },
        { id: '60001', count: 5 }
      ]
    }
  ]);

  const positions = JSON.parse(rows[0][6]).map((entry) => entry[1]);
  const rowsInGrid = positions.map((position) => ((position - 1) % 7) + 1);

  assert.equal(new Set(positions).size, positions.length);
  assert.ok(positions.every((position) => position >= 1 && position <= 35));
  assert.ok(positions.every((position) => position <= 21));
  assert.ok(rowsInGrid.every((row) => row >= 2 && row <= 6));
});
