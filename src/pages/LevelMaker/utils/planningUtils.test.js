import test from 'node:test';
import assert from 'node:assert/strict';

import { allocateBudgetedRoster, calculateUnitSpeed, generateMatrixUnits } from './planningUtils.js';

const roleWeights = {
  1: { hp: 1, atk: 1, cc: 0, atkSpeed: 1, atkRange: 100, detRange: 200 }
};

const derivationParams = {
  baseHp: 10,
  baseAtk: 10,
  baseSpd: 75,
  minSpdMultiplier: 0.65,
  maxSpdMultiplier: 1.35
};

test('calculateUnitSpeed keeps default role ranges ordered at both endpoints', () => {
  const speedParams = { baseSpd: 300, minSpdMultiplier: 0.65, maxSpdMultiplier: 1.35 };
  const orderedRanges = [
    { spdMin: 0.68, spdMax: 0.76 }, // 法师
    { spdMin: 0.82, spdMax: 0.88 }, // 弓箭手
    { spdMin: 0.92, spdMax: 0.98 }, // 长枪兵
    { spdMin: 1.02, spdMax: 1.08 }, // 步兵
    { spdMin: 1.20, spdMax: 1.28 }  // 骑兵
  ];

  const ranges = orderedRanges.map(weight => ({
    min: calculateUnitSpeed(speedParams, weight, 0),
    max: calculateUnitSpeed(speedParams, weight, 1)
  }));

  ranges.slice(1).forEach((range, index) => {
    assert.ok(ranges[index].max < range.min);
  });
});

test('calculateUnitSpeed clamps role ranges to global speed limits', () => {
  const speedParams = { baseSpd: 300, minSpdMultiplier: 0.8, maxSpdMultiplier: 1.2 };

  assert.equal(calculateUnitSpeed(speedParams, { spdMin: 0.1, spdMax: 0.2 }, 0), 240);
  assert.equal(calculateUnitSpeed(speedParams, { spdMin: 2, spdMax: 3 }, 1), 360);
});

const namesPool = {
  1: {
    3: Array.from({ length: 10 }, (_, index) => `T1Name${index + 1}`),
    4: Array.from({ length: 10 }, (_, index) => `T2Name${index + 1}`),
    5: Array.from({ length: 10 }, (_, index) => `T3Name${index + 1}`),
    6: Array.from({ length: 10 }, (_, index) => `T4Name${index + 1}`)
  }
};

const makeUnit = (id, role, score, extra = {}) => ({
  id,
  name: `${id}-T1`,
  hp: score * 10,
  atk: 0,
  atkSpeed: 1,
  atkRange: 100,
  spd: 0,
  skillPower: 0,
  roles: [role],
  unlockLevel: 1,
  scaledScore: score,
  ...extra
});

test('allocateBudgetedRoster adds unit types as role budget grows', () => {
  const units = [
    makeUnit('infantry-a', 0, 50),
    makeUnit('infantry-b', 0, 60),
    makeUnit('infantry-c', 0, 70)
  ];

  const lowBudget = allocateBudgetedRoster({
    level: 1,
    budget: 80,
    targetTier: 'T1',
    template: { 0: 1 },
    scaledUnits: units
  });
  const highBudget = allocateBudgetedRoster({
    level: 1,
    budget: 180,
    targetTier: 'T1',
    template: { 0: 1 },
    scaledUnits: units
  });

  assert.equal(lowBudget.length, 1);
  assert.equal(highBudget.length, 3);
  assert.ok(highBudget.every(unit => unit.count >= 1));
});

test('allocateBudgetedRoster preserves previous unit types before adding unlocked units', () => {
  const units = [
    makeUnit('infantry-a', 0, 50),
    makeUnit('infantry-b', 0, 60),
    makeUnit('infantry-c', 0, 70, { unlockLevel: 2 })
  ];

  const firstLevel = allocateBudgetedRoster({
    level: 1,
    budget: 120,
    targetTier: 'T1',
    template: { 0: 1 },
    scaledUnits: units
  });
  const secondLevel = allocateBudgetedRoster({
    level: 2,
    budget: 180,
    targetTier: 'T1',
    template: { 0: 1 },
    scaledUnits: units,
    previousSelected: firstLevel
  });

  assert.deepEqual(firstLevel.map(unit => unit.id), ['infantry-a', 'infantry-b']);
  assert.deepEqual(secondLevel.map(unit => unit.id), ['infantry-a', 'infantry-b', 'infantry-c']);
});

test('allocateBudgetedRoster uses diversity config to reduce recent repeats', () => {
  const units = [
    makeUnit('infantry-a', 0, 50),
    makeUnit('infantry-b', 0, 50),
    makeUnit('infantry-c', 0, 50),
    makeUnit('infantry-d', 0, 50)
  ];

  const selected = allocateBudgetedRoster({
    level: 2,
    budget: 120,
    targetTier: 'T1',
    template: { 0: 1 },
    scaledUnits: units,
    previousSelected: [units[0], units[1]],
    recentSelectedHistory: [[units[0], units[1]]],
    diversityConfig: {
      enabled: true,
      lookbackLevels: 3,
      maxCarryOverRatio: 0,
      recentUsePenalty: [0.1, 0.5, 0.75],
      underusedBonus: 2,
      archetypeBonus: 1,
      randomJitter: 0,
      maxTypesPerRole: 2
    }
  });

  assert.deepEqual(selected.map(unit => unit.id), ['infantry-c', 'infantry-d']);
});

test('generateMatrixUnits avoids duplicate names when name pools have enough entries', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const units = generateMatrixUnits(
      {
        totalUnits: 40,
        randomness: 0,
        roleDistribution: { 1: 1 },
        bossFrequency: 999
      },
      roleWeights,
      derivationParams,
      [],
      namesPool
    );

    const names = units.map(unit => unit.name);
    assert.equal(names.length, 40);
    assert.equal(new Set(names).size, 40);
  } finally {
    Math.random = originalRandom;
  }
});

test('generateMatrixUnits appends a suffix when a name pool is exhausted', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const units = generateMatrixUnits(
      {
        totalUnits: 8,
        randomness: 0,
        roleDistribution: { 1: 1 },
        bossFrequency: 999
      },
      roleWeights,
      derivationParams,
      [],
      {
        1: {
          3: ['OnlyT1'],
          4: ['OnlyT2'],
          5: ['OnlyT3'],
          6: ['OnlyT4']
        }
      }
    );

    const names = units.map(unit => unit.name);
    assert.equal(names.length, 8);
    assert.equal(new Set(names).size, 8);
  } finally {
    Math.random = originalRandom;
  }
});

test('generateMatrixUnits borrows names from the same style before suffixing exhausted quality pools', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const units = generateMatrixUnits(
      {
        totalUnits: 12,
        randomness: 0,
        roleDistribution: { 1: 1 },
        bossFrequency: 999
      },
      roleWeights,
      derivationParams,
      [],
      {
        1: {
          1: ['Reserve1', 'Reserve2', 'Reserve3', 'Reserve4'],
          2: ['Reserve5', 'Reserve6'],
          3: ['T1A', 'T1B', 'T1C'],
          4: ['T2A', 'T2B', 'T2C'],
          5: ['T3A'],
          6: ['T4A']
        }
      }
    );

    const names = units.map(unit => unit.name);
    assert.equal(names.length, 12);
    assert.equal(new Set(names).size, 12);
    assert.ok(names.every(name => !/-\d+-弓箭手 T\d$/.test(name)));

    const reserveUnit = units.find(unit => unit.name.startsWith('Reserve'));
    assert.ok(reserveUnit);
    assert.ok([1, 2].includes(reserveUnit.qua), '跨品质借名后应保留名称库中的来源品质');
  } finally {
    Math.random = originalRandom;
  }
});
