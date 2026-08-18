const JSON_FIELDS = [
  'FixedTimes',
  'FixedRewards',
  'SpecialTimes',
  'NormalRewards',
  'SpecialRewards',
  'TotalTimes',
  'TotalRewards',
  'Prize1',
  'Prize10'
]

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseJsonField = (value, fallback = []) => {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null || value === '') return fallback
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

export const parseItemTable = (fullData, headers = fullData?.[1] || []) => {
  const normalizedHeaders = headers.map(header => String(header || '').toLowerCase())
  const indexOf = name => normalizedHeaders.indexOf(name.toLowerCase())
  const idIndex = indexOf('id')
  const noteIndex = indexOf('note')
  const typeIndex = indexOf('type')
  const subTypeIndex = indexOf('subtype')
  const qualityIndex = indexOf('quality')
  const iconIndex = indexOf('icon')
  const nameIndex = indexOf('name')

  if (idIndex < 0) throw new Error('ItemTable.xlsx 缺少 id 列')

  return (fullData || []).slice(4).map(row => {
    if (row[idIndex] === undefined || row[idIndex] === null || row[idIndex] === '') return null
    const id = Number(row[idIndex])
    if (!Number.isInteger(id)) return null
    return {
      id,
      note: row[noteIndex] || row[nameIndex] || `未命名_${id}`,
      name: row[nameIndex] || '',
      icon: row[iconIndex] || '',
      type: toNumber(row[typeIndex]),
      subType: toNumber(row[subTypeIndex]),
      quality: toNumber(row[qualityIndex])
    }
  }).filter(Boolean).sort((a, b) => a.id - b.id)
}

export const parseArmyTable = (fullData, headers = fullData?.[1] || []) => {
  const normalizedHeaders = headers.map(header => String(header || '').toLowerCase())
  const indexOf = name => normalizedHeaders.indexOf(name.toLowerCase())
  const idIndex = indexOf('id')
  const noteIndex = indexOf('note')
  const rolesIndex = indexOf('roles')
  const armyTagIndex = indexOf('armytag')
  const qualityIndex = indexOf('qua')
  const iconIndex = indexOf('icon')
  const nameIndex = indexOf('name')

  if (idIndex < 0) throw new Error('ArmyTable.xlsx 缺少 Id 列')

  return (fullData || []).slice(4).map(row => {
    if (row[idIndex] === undefined || row[idIndex] === null || row[idIndex] === '') return null
    const id = Number(row[idIndex])
    if (!Number.isInteger(id)) return null
    return {
      id,
      note: row[noteIndex] || row[nameIndex] || `未命名_${id}`,
      name: row[nameIndex] || '',
      icon: row[iconIndex] || '',
      type: toNumber(row[rolesIndex]),
      subType: toNumber(row[armyTagIndex]),
      quality: toNumber(row[qualityIndex])
    }
  }).filter(Boolean).sort((a, b) => a.id - b.id)
}

export const parseLuckyDrawTable = (fullData, headers = fullData?.[1] || []) => {
  const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]))
  if (headerIndex.Id === undefined) throw new Error('LuckyDrawTable.xlsx 缺少 Id 列')

  return (fullData || []).slice(4).map((row, offset) => {
    if (row[headerIndex.Id] === undefined || row[headerIndex.Id] === null || row[headerIndex.Id] === '') return null
    const fixedTimes = parseJsonField(row[headerIndex.FixedTimes])
    const fixedRewards = parseJsonField(row[headerIndex.FixedRewards])
    const specialTimes = parseJsonField(row[headerIndex.SpecialTimes])
    const specialRewards = parseJsonField(row[headerIndex.SpecialRewards])
    const totalTimes = parseJsonField(row[headerIndex.TotalTimes])
    const totalRewards = parseJsonField(row[headerIndex.TotalRewards])

    return {
      rowIndex: offset + 4,
      id: toNumber(row[headerIndex.Id]),
      remarks: row[headerIndex.Remarks] || '',
      origin: toNumber(row[headerIndex.Origin]),
      normalRewards: parseJsonField(row[headerIndex.NormalRewards]),
      fixedPools: fixedTimes.map((time, index) => ({ time: toNumber(time), rewards: fixedRewards[index] || [] })),
      specialPools: specialTimes.map((time, index) => ({ time: toNumber(time), rewards: specialRewards[index] || [] })),
      totalRewards: totalTimes.map((time, index) => ({ time: toNumber(time), reward: totalRewards[index] || [] })),
      prize1: parseJsonField(row[headerIndex.Prize1]),
      prize10: parseJsonField(row[headerIndex.Prize10])
    }
  }).filter(Boolean)
}

export const parseRangeText = text => String(text || '')
  .split(/[，,;；\n]+/)
  .map(part => part.trim())
  .filter(Boolean)
  .map(part => {
    const match = part.match(/^(\d+)\s*(?:-|~|～)\s*(\d+)$/)
    if (match) return { min: Number(match[1]), max: Number(match[2]) }
    if (/^\d+$/.test(part)) return { min: Number(part), max: Number(part) }
    return null
  })
  .filter(Boolean)
  .map(range => range.min <= range.max ? range : { min: range.max, max: range.min })

const inRanges = (id, ranges) => ranges.some(range => id >= range.min && id <= range.max)

export const filterItems = (items, filters = {}) => {
  const idRanges = Array.isArray(filters.idRanges) ? filters.idRanges : parseRangeText(filters.idRanges)
  const excludedRanges = Array.isArray(filters.excludedRanges) ? filters.excludedRanges : parseRangeText(filters.excludedRanges)
  const search = String(filters.search || '').trim().toLowerCase()
  const subTypes = new Set((filters.subTypes || []).map(Number))
  const qualities = new Set((filters.qualities || []).map(Number))
  const types = new Set((filters.types || []).map(Number))

  return items.filter(item => {
    if (types.size && !types.has(item.type)) return false
    if (subTypes.size && !subTypes.has(item.subType)) return false
    if (qualities.size && !qualities.has(item.quality)) return false
    if (idRanges.length && !inRanges(item.id, idRanges)) return false
    if (excludedRanges.length && inRanges(item.id, excludedRanges)) return false
    if (search && !`${item.id} ${item.note} ${item.name}`.toLowerCase().includes(search)) return false
    return true
  })
}

export const allocateIntegerWeights = (entries, totalWeight, scoreOf) => {
  const total = Math.max(0, Math.round(toNumber(totalWeight)))
  if (!entries.length || total === 0) return new Map(entries.map(entry => [entry.id, 0]))
  const scores = entries.map(entry => Math.max(0, toNumber(scoreOf(entry))))
  const scoreTotal = scores.reduce((sum, value) => sum + value, 0)
  if (scoreTotal <= 0) return new Map(entries.map(entry => [entry.id, 0]))

  const allocations = entries.map((entry, index) => {
    const exact = total * scores[index] / scoreTotal
    return { id: entry.id, weight: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  let remaining = total - allocations.reduce((sum, entry) => sum + entry.weight, 0)
  allocations.sort((a, b) => b.remainder - a.remainder || a.id - b.id)
  for (let index = 0; index < remaining; index += 1) allocations[index % allocations.length].weight += 1
  return new Map(allocations.map(entry => [entry.id, entry.weight]))
}

const LUCKY_DRAW_QUALITY_DECAY = 2.5

export const buildInitialWeightConfig = (items, selectedIds, totalWeight = 10000) => {
  const selectedSet = new Set([...selectedIds].map(Number))
  const selected = items.filter(item => selectedSet.has(item.id))
  const qualities = [...new Set(selected.map(item => item.quality))].sort((a, b) => a - b)
  const highestQuality = qualities.at(-1) ?? 0
  const qualityAllocations = allocateIntegerWeights(
    qualities.map(quality => ({ id: quality })),
    totalWeight,
    entry => LUCKY_DRAW_QUALITY_DECAY ** (highestQuality - entry.id)
  )
  const qualityWeights = Object.fromEntries(qualities.map(quality => [quality, qualityAllocations.get(quality)]))

  const ids = [...new Set(selected.map(item => item.id))].sort((a, b) => a - b)
  const ranges = ids.reduce((result, id) => {
    const last = result[result.length - 1]
    if (last && id === last.max + 1) last.max = id
    else result.push({ min: id, max: id })
    return result
  }, [])
  const rangeAllocations = allocateIntegerWeights(ranges.map((range, index) => ({ ...range, id: index })), totalWeight, () => 1)
  const rangeRules = ranges.map((range, index) => ({ ...range, mode: 'group', weight: rangeAllocations.get(index) }))

  return { qualityWeights, rangeRules }
}

const matchingRangeRule = (item, rules) => [...(rules || [])]
  .reverse()
  .find(rule => item.id >= toNumber(rule.min) && item.id <= toNumber(rule.max))

export const buildPoolRewards = ({
  items,
  selectedIds,
  totalWeight = 10000,
  mode = 'equal',
  qualityWeights = {},
  rangeRules = [],
  defaultQuantity = 1,
  qualityQuantities = {},
  manualOverrides = {}
}) => {
  const selectedSet = new Set([...selectedIds].map(Number))
  const selected = items.filter(item => selectedSet.has(item.id))
  let weights = new Map()

  if (mode === 'quality') {
    const qualities = [...new Set(selected.map(item => item.quality))]
    const groupTotals = new Map(qualities.map(quality => [quality, Math.max(0, toNumber(qualityWeights[quality]))]))
    const requestedTotal = [...groupTotals.values()].reduce((sum, value) => sum + value, 0)
    const normalizedGroups = allocateIntegerWeights(
      qualities.map(quality => ({ id: quality })),
      totalWeight,
      entry => requestedTotal > 0 ? groupTotals.get(entry.id) : 1
    )
    qualities.forEach(quality => {
      const groupItems = selected.filter(item => item.quality === quality)
      const groupWeights = allocateIntegerWeights(groupItems, normalizedGroups.get(quality), () => 1)
      groupWeights.forEach((weight, id) => weights.set(id, weight))
    })
  } else if (mode === 'range') {
    const scores = new Map(selected.map(item => {
      const rule = matchingRangeRule(item, rangeRules)
      if (!rule) return [item.id, 1]
      if (rule.mode === 'group') {
        const count = selected.filter(candidate => candidate.id >= toNumber(rule.min) && candidate.id <= toNumber(rule.max)).length
        return [item.id, count ? toNumber(rule.weight) / count : 0]
      }
      return [item.id, toNumber(rule.weight)]
    }))
    weights = allocateIntegerWeights(selected, totalWeight, item => scores.get(item.id))
  } else {
    weights = allocateIntegerWeights(selected, totalWeight, () => 1)
  }

  return selected.map(item => {
    const override = manualOverrides[item.id] || {}
    const rangeRule = matchingRangeRule(item, rangeRules)
    const quantity = Math.max(1, Math.round(toNumber(
      override.quantity,
      qualityQuantities[item.quality] ?? defaultQuantity
    )))
    const weight = Math.max(0, Math.round(toNumber(override.weight, weights.get(item.id) || 0)))
    let source = mode === 'quality' ? `品质 ${item.quality}` : mode === 'range' && rangeRule ? `ID ${rangeRule.min}-${rangeRule.max}` : '等权分配'
    if (override.weight !== undefined) source = '手动覆盖'
    return { ...item, quantity, weight, source }
  }).filter(item => item.weight > 0)
}

export const serializeRewards = rewards => rewards.map(item => [item.id, item.quantity, item.weight])

export const applyRewardsToTargets = (draw, targetKeys, rewards, merge = false) => {
  const next = structuredClone(draw)
  const serialized = serializeRewards(rewards)
  const mergeRewards = current => {
    if (!merge) return serialized
    const byId = new Map((current || []).map(entry => [Number(entry[0]), entry]))
    serialized.forEach(entry => byId.set(Number(entry[0]), entry))
    return [...byId.values()].sort((a, b) => Number(a[0]) - Number(b[0]))
  }

  targetKeys.forEach(key => {
    if (key === 'normal') next.normalRewards = mergeRewards(next.normalRewards)
    if (key.startsWith('fixed:')) {
      const index = Number(key.split(':')[1])
      next.fixedPools[index].rewards = mergeRewards(next.fixedPools[index].rewards)
    }
    if (key.startsWith('special:')) {
      const index = Number(key.split(':')[1])
      next.specialPools[index].rewards = mergeRewards(next.specialPools[index].rewards)
    }
  })
  return next
}

export const drawToExcelRecord = draw => ({
  Id: draw.id,
  Remarks: draw.remarks,
  Origin: draw.origin,
  FixedTimes: JSON.stringify(draw.fixedPools.map(pool => pool.time)),
  FixedRewards: JSON.stringify(draw.fixedPools.map(pool => pool.rewards)),
  SpecialTimes: JSON.stringify(draw.specialPools.map(pool => pool.time)),
  NormalRewards: JSON.stringify(draw.normalRewards),
  SpecialRewards: JSON.stringify(draw.specialPools.map(pool => pool.rewards)),
  TotalTimes: JSON.stringify(draw.totalRewards.map(entry => entry.time)),
  TotalRewards: JSON.stringify(draw.totalRewards.map(entry => entry.reward)),
  Prize1: JSON.stringify(draw.prize1),
  Prize10: JSON.stringify(draw.prize10)
})

export const validateDraw = draw => {
  const errors = []
  const warnings = []
  if (!Number.isInteger(Number(draw.id))) errors.push('奖池 Id 必须是整数')
  if (!draw.normalRewards.length) errors.push('普通奖池不能为空')
  const inspectPool = (label, rewards) => {
    const rewardKeys = new Set()
    rewards.forEach((entry, index) => {
      const [id, quantity, weight] = entry
      if (!Number.isInteger(Number(id))) errors.push(`${label} 第 ${index + 1} 项 ID 非法`)
      if (toNumber(quantity) <= 0) errors.push(`${label} 第 ${index + 1} 项数量必须大于 0`)
      if (toNumber(weight) <= 0) errors.push(`${label} 第 ${index + 1} 项权重必须大于 0`)
      const rewardKey = `${Number(id)}:${Number(quantity)}`
      if (rewardKeys.has(rewardKey)) errors.push(`${label} 存在重复奖项 ID ${id}、数量 ${quantity}`)
      rewardKeys.add(rewardKey)
    })
    const total = rewards.reduce((sum, entry) => sum + toNumber(entry[2]), 0)
    if (rewards.length && total !== 10000) warnings.push(`${label} 权重合计为 ${total}，不是约定值 10000`)
  }
  inspectPool('普通奖池', draw.normalRewards)
  draw.fixedPools.forEach(pool => inspectPool(`固定第 ${pool.time} 抽`, pool.rewards))
  draw.specialPools.forEach(pool => inspectPool(`特殊周期 ${pool.time}`, pool.rewards))
  if (draw.fixedPools.some(pool => !Number.isInteger(Number(pool.time)) || Number(pool.time) <= 0)) errors.push('固定奖励次数必须是大于 0 的整数')
  if (draw.specialPools.some(pool => !Number.isInteger(Number(pool.time)) || Number(pool.time) <= 0)) errors.push('特殊奖励次数必须是大于 0 的整数')
  if (new Set(draw.fixedPools.map(pool => pool.time)).size !== draw.fixedPools.length) errors.push('固定次数存在重复值')
  if (new Set(draw.specialPools.map(pool => pool.time)).size !== draw.specialPools.length) errors.push('特殊周期存在重复值')
  if (draw.totalRewards.length) warnings.push('累计奖励已配置，但当前服务端通用抽奖逻辑未消费该字段')
  return { errors, warnings }
}

export const updateLuckyDrawSheet = ({ sheet, headers, draws }) => {
  const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]))
  draws.forEach(draw => {
    const record = drawToExcelRecord(draw)
    Object.entries(record).forEach(([field, value]) => {
      if (headerIndex[field] === undefined) return
      const address = XLSX.utils.encode_cell({ r: draw.rowIndex, c: headerIndex[field] })
      const cell = sheet[address] || {}
      cell.v = value
      cell.t = typeof value === 'number' ? 'n' : 's'
      sheet[address] = cell
    })
  })
  return sheet
}

export { JSON_FIELDS }
import * as XLSX from 'xlsx'
