import test from 'node:test'
import assert from 'node:assert/strict'

import {
  allocateIntegerWeights,
  applyRewardsToTargets,
  buildPoolRewards,
  filterItems,
  parseRangeText
} from './luckyDrawUtils.js'

const items = [
  { id: 20301, note: 'A', type: 1, subType: 8, quality: 3 },
  { id: 20302, note: 'B', type: 1, subType: 8, quality: 3 },
  { id: 20401, note: 'C', type: 1, subType: 8, quality: 4 },
  { id: 20501, note: 'D', type: 1, subType: 8, quality: 5 },
  { id: 21301, note: '碎片', type: 1, subType: 9, quality: 3 }
]

test('组合筛选支持 SubType、品质、ID 范围和排除范围', () => {
  const result = filterItems(items, {
    subTypes: [8],
    qualities: [3, 4],
    idRanges: '20301-20499',
    excludedRanges: '20302'
  })
  assert.deepEqual(result.map(item => item.id), [20301, 20401])
  assert.deepEqual(parseRangeText('10-20，30；40~35'), [
    { min: 10, max: 20 },
    { min: 30, max: 30 },
    { min: 35, max: 40 }
  ])
})

test('整数权重分配严格补齐目标总权重', () => {
  const weights = allocateIntegerWeights(items.slice(0, 3), 10000, () => 1)
  assert.equal([...weights.values()].reduce((sum, weight) => sum + weight, 0), 10000)
  assert.deepEqual([...weights.values()], [3334, 3333, 3333])
})

test('按品质分配组权重并在组内均分', () => {
  const rewards = buildPoolRewards({
    items,
    selectedIds: new Set([20301, 20302, 20401, 20501]),
    mode: 'quality',
    totalWeight: 10000,
    qualityWeights: { 3: 4800, 4: 4200, 5: 1000 },
    defaultQuantity: 1
  })
  assert.deepEqual(rewards.map(item => [item.id, item.weight]), [
    [20301, 2400], [20302, 2400], [20401, 4200], [20501, 1000]
  ])
})

test('ID 范围规则采用靠后的规则覆盖，并归一化到总权重', () => {
  const rewards = buildPoolRewards({
    items,
    selectedIds: new Set([20301, 20302, 20401]),
    mode: 'range',
    totalWeight: 10000,
    rangeRules: [
      { min: 20300, max: 20499, mode: 'perItem', weight: 1 },
      { min: 20400, max: 20499, mode: 'perItem', weight: 2 }
    ]
  })
  assert.equal(rewards.reduce((sum, item) => sum + item.weight, 0), 10000)
  assert.equal(rewards.find(item => item.id === 20401).weight, 5000)
})

test('可以将生成结果批量覆盖多个目标奖池', () => {
  const draw = {
    normalRewards: [[1, 1, 10000]],
    fixedPools: [{ time: 1, rewards: [[2, 1, 10000]] }],
    specialPools: [{ time: 10, rewards: [[3, 1, 10000]] }]
  }
  const rewards = [{ id: 20301, quantity: 1, weight: 10000 }]
  const next = applyRewardsToTargets(draw, ['normal', 'fixed:0', 'special:0'], rewards)
  assert.deepEqual(next.normalRewards, [[20301, 1, 10000]])
  assert.deepEqual(next.fixedPools[0].rewards, [[20301, 1, 10000]])
  assert.deepEqual(next.specialPools[0].rewards, [[20301, 1, 10000]])
})
