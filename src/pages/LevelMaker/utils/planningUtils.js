import { ROLE_ID_RANGES } from './constants';

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
  const { baseScore, difficultyFactor, spikes } = config;
  const interval = 10;

  let budget = baseScore * Math.pow(level, difficultyFactor);

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
