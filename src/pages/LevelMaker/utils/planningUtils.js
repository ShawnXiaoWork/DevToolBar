import { ROLE_ID_RANGES, ROLE_COMMON_SKILLS, ROLE_LABELS, ROLE_SYMBOLS, ROLE_NAME_POOLS, BOSS_PREFIXES } from './constants.js';

/**
 * 计算单个兵种的综合战力评分 (Power Score)
 */
export const calculatePowerScore = (unit) => {
  const base = (unit.hp * 0.1) + (unit.atk * (unit.atkSpeed || 1.0));
  const multipliers = (1 + (unit.spd || 0) / 100) * (1 + (unit.skillPower || 0) / 100);
  let score = Math.round(base * multipliers);
  
  if (unit.atkRange > 400) score = Math.round(score * 1.15); 
  
  if (unit.roles && unit.roles.some(r => r === 3 || (typeof r === 'string' && (r.includes('CC') || r.includes('控制'))))) {
    score = Math.round(score * 1.5);
  }
  return score;
};

/**
 * 计算关卡难度预算
 */
export const getLevelBudget = (level, config) => {
  const { baseScore, initialMultiplier = 1.0, difficultyFactor, spikes } = config;
  const interval = 10;

  let budget = baseScore * initialMultiplier * Math.pow(level, difficultyFactor);

  const steps = (spikes || []).filter(s => s.type === 'step' && level >= s.level);
  let stepHpMultiplier = 1;
  let stepAtkMultiplier = 1;
  steps.forEach(s => {
    stepHpMultiplier *= (s.hpMultiplier || 1);
    stepAtkMultiplier *= (s.atkMultiplier || 1);
  });

  budget *= (stepHpMultiplier * stepAtkMultiplier);

  const currentPeak = (spikes || []).find(s => s.level === level && (s.type === 'peak' || !s.type));
  if (currentPeak) {
    budget *= (currentPeak.hpMultiplier || 1) * (currentPeak.atkMultiplier || 1);
  }

  if (level > 1 && (level - 1) % interval === 0) {
    budget *= 0.85; 
  }

  if (level % interval === 9) {
    budget *= 1.1; 
  }

  return Math.round(budget);
};

/**
 * 获取特定职能的下一个可用 ID
 */
export const getNextIdForRole = (role, existingUnits, newUnits = []) => {
  const rangeStart = ROLE_ID_RANGES[role] || 50000;
  const combinedUnits = [...existingUnits, ...newUnits];
  const existingIds = combinedUnits
    .map(u => parseInt(u.id))
    .filter(id => !isNaN(id) && id >= rangeStart && id < rangeStart + 10000);
  const maxId = existingIds.length > 0 ? Math.max(...existingIds) : rangeStart;
  return (maxId + 1).toString();
};

/**
 * 获取关卡目标 Tier
 */
export const getTargetTier = (level) => {
  if (level <= 20) return 'T1';
  if (level <= 50) return 'T2';
  if (level <= 80) return 'T3';
  return 'T4';
};

/**
 * 根据兵种属性解析其所属的 Tier 级别 (1, 2, 3, 4)
 */
export const getUnitTier = (unit) => {
  if (unit.name && unit.name.includes('T1')) return 1;
  if (unit.name && unit.name.includes('T2')) return 2;
  if (unit.name && unit.name.includes('T3')) return 3;
  if (unit.name && unit.name.includes('T4')) return 4;
  if (unit.qua) return Math.max(1, Math.min(4, unit.qua - 2));
  return 1;
};

const unitMatchesRole = (unit, roleId) => {
  const roles = Array.isArray(unit.roles) ? unit.roles : [];
  return roles.includes(roleId) || roles.includes(String(roleId));
};

const getScore = (unit) => Math.max(1, unit.scaledScore || calculatePowerScore(unit));

/**
 * 根据基础速度和职业速度区间生成移动速度，并限制在全局安全范围内。
 */
export const calculateUnitSpeed = (derivationParams, roleWeight, randomValue = Math.random()) => {
  const baseSpd = Math.max(0, Number(derivationParams?.baseSpd) || 0);
  const configuredGlobalMin = Number(derivationParams?.minSpdMultiplier);
  const configuredGlobalMax = Number(derivationParams?.maxSpdMultiplier);
  const globalMinMultiplier = Number.isFinite(configuredGlobalMin)
    ? Math.max(0, configuredGlobalMin)
    : 0.65;
  const globalMaxMultiplier = Number.isFinite(configuredGlobalMax)
    ? Math.max(globalMinMultiplier, configuredGlobalMax)
    : 1.35;
  const configuredMin = Number(roleWeight?.spdMin);
  const configuredMax = Number(roleWeight?.spdMax);
  const roleMinMultiplier = Number.isFinite(configuredMin) ? configuredMin : 1;
  const roleMaxMultiplier = Number.isFinite(configuredMax) ? configuredMax : roleMinMultiplier;
  const orderedRoleMin = Math.min(roleMinMultiplier, roleMaxMultiplier);
  const orderedRoleMax = Math.max(roleMinMultiplier, roleMaxMultiplier);
  const effectiveMin = Math.min(globalMaxMultiplier, Math.max(globalMinMultiplier, orderedRoleMin));
  const effectiveMax = Math.min(globalMaxMultiplier, Math.max(effectiveMin, orderedRoleMax));
  const safeRandomValue = Math.min(1, Math.max(0, Number(randomValue) || 0));

  return Math.round(baseSpd * (effectiveMin + (effectiveMax - effectiveMin) * safeRandomValue));
};

const sortRosterCandidates = (units, targetTierInt) => [...units].sort((a, b) => {
  const tierDelta = Math.abs(getUnitTier(a) - targetTierInt) - Math.abs(getUnitTier(b) - targetTierInt);
  if (tierDelta !== 0) return tierDelta;

  const scoreDelta = getScore(a) - getScore(b);
  if (scoreDelta !== 0) return scoreDelta;

  return String(a.id).localeCompare(String(b.id));
});

const pickBudgetedTypes = (pool, roleBudget, previousSelected, targetTierInt) => {
  const previousIds = new Set((previousSelected || []).map(unit => String(unit.id)));
  const previousUnits = pool.filter(unit => previousIds.has(String(unit.id)));
  const newUnits = pool.filter(unit => !previousIds.has(String(unit.id)));
  const ordered = [
    ...sortRosterCandidates(previousUnits, targetTierInt),
    ...sortRosterCandidates(newUnits, targetTierInt)
  ];

  const selected = [];
  let spent = 0;

  ordered.forEach(unit => {
    const score = getScore(unit);
    if (selected.length === 0 || spent + score <= roleBudget) {
      selected.push(unit);
      spent += score;
    }
  });

  return selected;
};

/**
 * 按关卡预算分配普通兵种类型与数量。
 * 预算先按阵容模板拆到职能，再在每个职能内优先延续上一关兵种，
 * 新类型只在预算能够承载时逐步加入。
 */
const stableNoise = (level, id) => {
  const text = `${level}:${id}`;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
};

const getRecentDistance = (unit, recentSelectedHistory, lookbackLevels) => {
  const unitId = String(unit.id);
  const history = (recentSelectedHistory || []).slice(0, lookbackLevels);
  for (let index = 0; index < history.length; index++) {
    const appeared = (history[index] || []).some(historyUnit => String(historyUnit.id) === unitId);
    if (appeared) return index + 1;
  }
  return 0;
};

const getDiversityCandidateWeight = ({
  unit,
  level,
  roleBudget,
  targetTierInt,
  roleWeight,
  previousIds,
  carriedCount,
  carryLimit,
  recentSelectedHistory,
  diversityConfig
}) => {
  const score = getScore(unit);
  const tierDistance = Math.abs(getUnitTier(unit) - targetTierInt);
  const budgetFit = Math.max(0.2, 1 - Math.min(0.8, score / Math.max(1, roleBudget * 2)));
  const tierFit = Math.max(0.4, 1 - tierDistance * 0.25);
  const archetype = roleWeight > 0 ? (diversityConfig.archetypeBonus ?? 1) : 1;
  const recentDistance = getRecentDistance(unit, recentSelectedHistory, diversityConfig.lookbackLevels ?? 0);
  const recentPenalty = recentDistance > 0
    ? (diversityConfig.recentUsePenalty?.[recentDistance - 1] ?? 1)
    : (diversityConfig.underusedBonus ?? 1);
  const carryPenalty = previousIds.has(String(unit.id)) && carriedCount >= carryLimit ? 0.05 : 1;
  const jitter = 1 + (stableNoise(level, unit.id) - 0.5) * 2 * (diversityConfig.randomJitter ?? 0);

  return budgetFit * tierFit * archetype * recentPenalty * carryPenalty * jitter;
};

const pickDiverseBudgetedTypes = ({
  pool,
  level,
  roleBudget,
  roleWeight,
  previousSelected,
  recentSelectedHistory,
  targetTierInt,
  diversityConfig
}) => {
  const selected = [];
  let spent = 0;
  let carriedCount = 0;
  const previousIds = new Set((previousSelected || []).map(unit => String(unit.id)));
  const maxTypes = Math.max(1, diversityConfig.maxTypesPerRole || pool.length);
  const carryLimit = Math.max(0, Math.floor(maxTypes * (diversityConfig.maxCarryOverRatio ?? 1)));
  const remaining = [...pool];

  while (remaining.length > 0 && selected.length < maxTypes) {
    const ordered = remaining
      .map(unit => ({
        unit,
        weight: getDiversityCandidateWeight({
          unit,
          level,
          roleBudget,
          targetTierInt,
          roleWeight,
          previousIds,
          carriedCount,
          carryLimit,
          recentSelectedHistory,
          diversityConfig
        })
      }))
      .sort((a, b) => {
        if (b.weight !== a.weight) return b.weight - a.weight;
        return String(a.unit.id).localeCompare(String(b.unit.id));
      });

    const next = ordered[0].unit;
    const score = getScore(next);
    if (selected.length > 0 && spent + score > roleBudget) break;

    selected.push(next);
    spent += score;
    if (previousIds.has(String(next.id))) carriedCount++;
    remaining.splice(remaining.findIndex(unit => String(unit.id) === String(next.id)), 1);
  }

  return selected;
};

export const allocateBudgetedRoster = ({
  level,
  budget,
  targetTier,
  template,
  scaledUnits,
  previousSelected = [],
  recentSelectedHistory = [],
  diversityConfig = null
}) => {
  const targetTierInt = Number(String(targetTier).replace('T', '')) || getUnitTier({ name: targetTier });
  const selected = [];

  Object.keys(ROLE_LABELS).map(Number).forEach(roleId => {
    const roleWeight = template?.[roleId] || 0;
    const roleBudget = budget * roleWeight;
    if (roleWeight <= 0 || roleBudget <= 0) return;

    let pool = scaledUnits.filter(unit => {
      const isBoss = unit.armyTag >= 20;
      const isUnlocked = (unit.unlockLevel || 1) <= level;
      const tier = getUnitTier(unit);
      const isTargetTier = tier === targetTierInt || tier === targetTierInt - 1;
      return !isBoss && isUnlocked && isTargetTier && unitMatchesRole(unit, roleId);
    });

    if (pool.length === 0) {
      pool = scaledUnits.filter(unit => {
        const isBoss = unit.armyTag >= 20;
        const isUnlocked = (unit.unlockLevel || 1) <= level;
        return !isBoss && isUnlocked && unitMatchesRole(unit, roleId);
      });
    }

    if (pool.length === 0) {
      pool = scaledUnits.filter(unit => unit.armyTag < 20 && unitMatchesRole(unit, roleId));
    }

    if (pool.length === 0) return;

    const roleKey = ROLE_LABELS[roleId] || `Role-${roleId}`;
    const previousForRole = previousSelected.filter(unit => (
      unit.assignedRole === roleKey || unitMatchesRole(unit, roleId)
    ));
    const pickedTypes = diversityConfig?.enabled
      ? pickDiverseBudgetedTypes({
        pool,
        level,
        roleBudget,
        roleWeight,
        previousSelected: previousForRole,
        recentSelectedHistory,
        targetTierInt,
        diversityConfig
      })
      : pickBudgetedTypes(pool, roleBudget, previousForRole, targetTierInt);
    const totalTypeScore = pickedTypes.reduce((sum, unit) => sum + getScore(unit), 0);

    pickedTypes.forEach(unit => {
      const count = Math.max(1, Math.floor(roleBudget / totalTypeScore));
      selected.push({ ...unit, count, assignedRole: roleKey });
    });
  });

  return selected;
};

/**
 * 核心：矩阵生成算法 (封装版)
 */
export const generateMatrixUnits = (config, roleWeights, derivationParams, existingUnits = [], namesPool = null) => {
  const { totalUnits, randomness, roleDistribution, bossFrequency } = config;
  const totalTypes = totalUnits || 40;
  const newUnits = [];
  const usedNames = new Set(existingUnits.map(unit => unit.name).filter(Boolean));
  const usedBaseNames = new Set();

  // 职能到 Style 的映射 (0: 步兵, 1: 弓箭手, 2: 骑兵, 3: 长枪兵, 4: 法师, 5: 辅助)
  const ROLE_TO_STYLE = {
    0: 0, // 步兵 -> Infantry (0)
    1: 1, // 弓箭手 -> Archer (1)
    2: 3, // 骑兵 -> Cavalry (3)
    3: 4, // 长枪兵 -> Pikeman (4)
    4: 1, // 法师 -> Archer (1)
    5: 1  // 辅助 -> Archer (1)
  };

  const uniqueNames = (names) => [...new Set((names || []).filter(Boolean))];

  const getNamesByPreference = (preferredPool, fallbackPools = []) => {
    const preferredNames = uniqueNames(preferredPool);
    const fallbackNames = uniqueNames(fallbackPools.flat()).filter(name => !preferredNames.includes(name));
    const names = [...preferredNames, ...fallbackNames];
    return names.length > 0 ? names : ['未知单位'];
  };

  const pickName = (preferredPool, fallbackPools, buildDisplayName) => {
    const names = getNamesByPreference(preferredPool, fallbackPools);
    const startIdx = Math.floor(Math.random() * names.length);

    for (let offset = 0; offset < names.length; offset++) {
      const candidate = names[(startIdx + offset) % names.length];
      const displayName = buildDisplayName(candidate);
      if (!usedBaseNames.has(candidate) && !usedNames.has(displayName)) {
        return candidate;
      }
    }

    const baseName = names[startIdx];
    let suffix = 2;
    while (usedNames.has(buildDisplayName(`${baseName}-${suffix}`))) {
      suffix++;
    }
    return `${baseName}-${suffix}`;
  };

  Object.keys(roleDistribution).forEach(roleId => {
    const role = Number(roleId);
    const count = Math.round(totalTypes * roleDistribution[roleId]);
    const weights = roleWeights[role];

    for (let i = 0; i < count; i++) {
      const tier = Math.min(4, Math.ceil((i + 1) / (count / 4)));
      const tierMultiplier = 1 + (tier - 1) * 0.5;

      const isBoss = (i + 1) % bossFrequency === 0;
      const bossMultiplier = isBoss ? 4.0 : 1.0;
      const bossAtkMultiplier = isBoss ? 1.5 : 1.0;

      const hpMut = 1 + (Math.random() * 2 - 1) * randomness;
      const atkMut = 1 + (Math.random() * 2 - 1) * randomness;

      // 计算 Style 与 Qua (品质 = tier + 2)
      const style = ROLE_TO_STYLE[role] !== undefined ? ROLE_TO_STYLE[role] : 0;
      const qua = tier + 2;

      const excelNames = namesPool && namesPool[style] && namesPool[style][qua];
      const sameStyleFallbackPools = namesPool && namesPool[style]
        ? Object.keys(namesPool[style])
          .filter(candidateQua => Number(candidateQua) !== qua)
          .sort((a, b) => Math.abs(Number(a) - qua) - Math.abs(Number(b) - qua))
          .map(candidateQua => namesPool[style][candidateQua])
        : [];
      const bossPrefix = isBoss ? BOSS_PREFIXES[Math.floor(Math.random() * BOSS_PREFIXES.length)] : '';
      const buildDisplayName = (candidateName) => `${bossPrefix}${candidateName}-${ROLE_LABELS[role]} T${tier}`;
      const baseName = pickName(
        excelNames && excelNames.length > 0 ? excelNames : (ROLE_NAME_POOLS[role] || ['未知单位']),
        excelNames && excelNames.length > 0 ? sameStyleFallbackPools : [],
        buildDisplayName
      );
      const displayName = buildDisplayName(baseName);

      const finalId = getNextIdForRole(isBoss ? 'Boss' : role, existingUnits, newUnits);

      newUnits.push({
        id: finalId,
        name: displayName,
        style: style,
        qua: qua,
        hp: Math.round(derivationParams.baseHp * weights.hp * tierMultiplier * hpMut * bossMultiplier),
        atk: Math.round(derivationParams.baseAtk * weights.atk * tierMultiplier * atkMut * bossAtkMultiplier),
        atkSpeed: Number((weights.atkSpeed * (0.9 + Math.random() * 0.2)).toFixed(2)),
        atkRange: Math.round(weights.atkRange * (0.9 + Math.random() * 0.2)),
        detRange: Math.round(weights.detRange * (0.9 + Math.random() * 0.2)),
        spd: calculateUnitSpeed(derivationParams, weights),
        skillPower: Math.round(weights.cc * 100 + (tier - 1) * 20 + (isBoss ? 50 : 0)),
        commonSkill: ROLE_COMMON_SKILLS[role] || 10010,
        roles: [role],
        armyTag: isBoss ? 20 : 11,
        maxRow: isBoss ? 1 : 15,
        spawnRates: isBoss ? 1.0 : 0.4,
        spawnWeight: isBoss ? 10 : 50
      });
      usedNames.add(displayName);
      usedBaseNames.add(baseName);
    }
  });

  return newUnits;
};
