import test from 'node:test';
import assert from 'node:assert/strict';

import { syncAllLevelTables } from './exportUtils.js';

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
