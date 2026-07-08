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
 * 核心：矩阵生成算法 (封装版)
 */
export const generateMatrixUnits = (config, roleWeights, derivationParams, existingUnits = [], namesPool = null) => {
  const { totalUnits, randomness, roleDistribution, bossFrequency } = config;
  const totalTypes = totalUnits || 40;
  const newUnits = [];
  const usedNames = new Set(existingUnits.map(unit => unit.name).filter(Boolean));

  // 职能到 Style 的映射 (0: 步兵, 1: 弓箭手, 2: 骑兵, 3: 长枪兵, 4: 法师, 5: 辅助)
  const ROLE_TO_STYLE = {
    0: 0, // 步兵 -> Infantry (0)
    1: 1, // 弓箭手 -> Archer (1)
    2: 3, // 骑兵 -> Cavalry (3)
    3: 4, // 长枪兵 -> Pikeman (4)
    4: 1, // 法师 -> Archer (1)
    5: 1  // 辅助 -> Archer (1)
  };

  const pickName = (pool, buildDisplayName) => {
    const names = pool.length > 0 ? pool : ['未知单位'];
    const startIdx = Math.floor(Math.random() * names.length);

    for (let offset = 0; offset < names.length; offset++) {
      const candidate = names[(startIdx + offset) % names.length];
      const displayName = buildDisplayName(candidate);
      if (!usedNames.has(displayName)) {
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
      const bossPrefix = isBoss ? BOSS_PREFIXES[Math.floor(Math.random() * BOSS_PREFIXES.length)] : '';
      const buildDisplayName = (candidateName) => `${bossPrefix}${candidateName}-${ROLE_LABELS[role]} T${tier}`;
      const baseName = pickName(
        excelNames && excelNames.length > 0 ? excelNames : (ROLE_NAME_POOLS[role] || ['未知单位']),
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
        spd: derivationParams.baseSpd + Math.floor(Math.random() * 5),
        skillPower: Math.round(weights.cc * 100 + (tier - 1) * 20 + (isBoss ? 50 : 0)),
        commonSkill: ROLE_COMMON_SKILLS[role] || 10010,
        roles: [role],
        armyTag: isBoss ? 20 : 11,
        maxRow: isBoss ? 1 : 15,
        spawnRates: isBoss ? 1.0 : 0.4,
        spawnWeight: isBoss ? 10 : 50
      });
      usedNames.add(displayName);
    }
  });

  return newUnits;
};
