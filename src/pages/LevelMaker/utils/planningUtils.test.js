import test from 'node:test';
import assert from 'node:assert/strict';

import { generateMatrixUnits } from './planningUtils.js';

const roleWeights = {
  1: { hp: 1, atk: 1, cc: 0, atkSpeed: 1, atkRange: 100, detRange: 200 }
};

const derivationParams = {
  baseHp: 10,
  baseAtk: 10,
  baseSpd: 75
};

const namesPool = {
  4: {
    3: Array.from({ length: 10 }, (_, index) => `T1Name${index + 1}`),
    4: Array.from({ length: 10 }, (_, index) => `T2Name${index + 1}`),
    5: Array.from({ length: 10 }, (_, index) => `T3Name${index + 1}`),
    6: Array.from({ length: 10 }, (_, index) => `T4Name${index + 1}`)
  }
};

test('generateMatrixUnits avoids duplicate names when name pools have enough entries', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const units = generateMatrixUnits(
      {
        totalLevels: 200,
        updateFrequency: 5,
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
        totalLevels: 40,
        updateFrequency: 5,
        randomness: 0,
        roleDistribution: { 1: 1 },
        bossFrequency: 999
      },
      roleWeights,
      derivationParams,
      [],
      {
        4: {
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
