import { useMemo } from 'react';
import { allocateBudgetedRoster, calculatePowerScore, getLevelBudget, getTargetTier, getUnitTier } from '../utils/planningUtils';

/**
 * 核心关卡规划 Hook
 * 负责计算全关卡部署 (fullLevelPlan) 与单关分析 (analysisResult)
 * 采用“体验驱动”算法：侧重于兵种的递进、引入与多样性
 */
export const useLevelPlanning = (state, config) => {
  const units = state.units;
  const { 
    levelConfig, 
    previewRange, 
    activeTemplateId, 
    rosterTemplates, 
    matrixConfig,
    validationConfig,
    previewLevel
  } = config;

  /**
   * 1. 预处理：为每个普通兵种分配其“首次引入/解锁关卡” (unlockLevel)
   * 使得在生成关卡时，新兵种能够随着关卡深度逐步、平滑地解锁，而不是每关都在乱换。
   */
  const unitsWithUnlockLevels = useMemo(() => {
    if (units.length === 0) return [];

    // 筛选出所有普通兵种 (去除了 armyTag >= 20 的 Boss 兵种)
    const normalUnits = units.filter(u => !u.armyTag || u.armyTag < 20);

    // 定义每个 Tier 对应的关卡解锁区间限制
    const TIER_RANGES = {
      1: { start: 1, end: 20 },
      2: { start: 21, end: 50 },
      3: { start: 51, end: 80 },
      4: { start: 81, end: 200 } // T4 区间上限默认到 200 关
    };

    // 按 Tier 分组
    const unitsByTier = { 1: [], 2: [], 3: [], 4: [] };
    normalUnits.forEach(u => {
      const tier = getUnitTier(u);
      unitsByTier[tier].push(u);
    });

    const result = [];

    // 分别计算每个 Tier 下普通兵种的逐步解锁关卡
    Object.keys(unitsByTier).forEach(tierKey => {
      const tier = Number(tierKey);
      const list = unitsByTier[tier];
      if (list.length === 0) return;

      const range = TIER_RANGES[tier] || { start: 81, end: 200 };
      const startLevel = range.start;
      const endLevel = range.end;
      const length = endLevel - startLevel + 1;

      // 稳定排序：为了确保每次重新生成或刷新页面时解锁规则一致，我们按战力评分排序
      // 从而实现低战力兵种优先在前面解锁，高战力兵种后面解锁的“关卡梯度体验”
      const sorted = [...list].sort((a, b) => {
        const scoreA = calculatePowerScore(a);
        const scoreB = calculatePowerScore(b);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return String(a.id).localeCompare(String(b.id)); // ID 稳定降噪排序
      });

      // 解锁分摊算法：
      // - 前 20% (至少 2 个) 作为本阶段初始的“基准可用怪”，直接在 startLevel（第一关）解锁
      // - 其余怪在整个区间的前 70% 关卡区间中均匀平摊解锁，防止堆积到区间末尾解锁导致无法展示
      const numInitial = Math.min(sorted.length, Math.max(2, Math.round(sorted.length * 0.2)));
      
      sorted.forEach((unit, idx) => {
        let unlockLevel = startLevel;
        if (idx >= numInitial) {
          const remainingIdx = idx - numInitial;
          const totalRemaining = sorted.length - numInitial;
          const unlockSpan = Math.round(length * 0.7); // 在前 70% 的关卡内解锁完毕
          const offset = totalRemaining > 1 
            ? Math.round((remainingIdx / (totalRemaining - 1)) * unlockSpan) 
            : 0;
          unlockLevel = startLevel + offset;
        }
        
        result.push({
          ...unit,
          unlockLevel
        });
      });
    });

    // Boss 兵种不做 unlockLevel 限制，它们只会在指定的 Boss 关卡投放
    const bossUnits = units.filter(u => u.armyTag >= 20);
    bossUnits.forEach(u => {
      result.push({
        ...u,
        unlockLevel: 1 // 默认为 1 即可，由 Boss 关逻辑直接提取
      });
    });

    return result;
  }, [units]);

  /**
   * 全关卡部署规划逻辑 (算法升级版)
   */
  const fullLevelPlan = useMemo(() => {
    if (unitsWithUnlockLevels.length === 0) return [];

    const template = rosterTemplates.find(t => t.id === activeTemplateId) || rosterTemplates[0];
    
    let previousSelected = [];

    return Array.from({ length: previewRange }, (_, i) => {
      const level = i + 1;
      const targetTier = getTargetTier(level);

      // 1. 获取基础系数 (用于计算展示战力，虽不作为投放约束)
      const initialMultiplier = levelConfig.initialMultiplier || 1.0;
      const steps = (levelConfig.spikes || []).filter(s => s.type === 'step' && level >= s.level);
      let hpCoeff = initialMultiplier, atkCoeff = initialMultiplier;
      steps.forEach(s => { hpCoeff *= (s.hpMultiplier || 1); atkCoeff *= (s.atkMultiplier || 1); });

      const peak = (levelConfig.spikes || []).find(s => s.level === level && s.type === 'peak');
      if (peak) { hpCoeff *= (peak.hpMultiplier || 1); atkCoeff *= (peak.atkMultiplier || 1); }

      const budget = getLevelBudget(level, levelConfig);
      const isBossLevel = !!peak;

      // 2. 预处理当前 Tier 的可用兵种池 (结合分配好的 unlockLevel 进行攻击与生命缩放)
      const scaledUnits = unitsWithUnlockLevels.map(u => {
        const scaled = { ...u, hp: Math.round(u.hp * hpCoeff), atk: Math.round(u.atk * atkCoeff) };
        return { ...scaled, scaledScore: calculatePowerScore(scaled) };
      });

      const selected = [];

      // 3. 强制投放 Boss (仅在 Boss 关卡进行配置)
      if (isBossLevel) {
        const allBosses = scaledUnits.filter(u => u.armyTag >= 20);
        let tierBossPool = allBosses.filter(u => u.name.includes(targetTier));
        if (tierBossPool.length === 0) tierBossPool = allBosses;

        if (tierBossPool.length > 0) {
          const numBosses = matrixConfig.minBossPerLevel || 2;
          for (let j = 0; j < numBosses; j++) {
            const bossIndex = (i * numBosses + j) % tierBossPool.length;
            const boss = tierBossPool[bossIndex];
            selected.push({ ...boss, count: 1, assignedRole: 'BOSS', isForcedBoss: true });
          }
        }
      }

      selected.push(...allocateBudgetedRoster({
        level,
        budget,
        targetTier,
        template,
        scaledUnits,
        previousSelected
      }));

      previousSelected = selected.filter(unit => !unit.isForcedBoss);

      return {
        level, 
        budget, 
        selected, 
        hpCoeff, 
        atkCoeff, 
        isBossLevel, 
        targetTier
      };
    });
  }, [unitsWithUnlockLevels, levelConfig, previewRange, activeTemplateId, rosterTemplates, matrixConfig]);

  /**
   * 单关模拟分析逻辑
   */
  const analysisResult = useMemo(() => {
    const levelPlan = fullLevelPlan.find(p => p.level === previewLevel);
    if (!levelPlan) return { selected: [], budget: 0, pieData: [], warnings: [] };

    const { selected, budget } = levelPlan;
    
    // 职能分布饼图
    const roleStats = {};
    selected.forEach(s => {
      roleStats[s.assignedRole] = (roleStats[s.assignedRole] || 0) + s.count;
    });
    const pieData = Object.entries(roleStats).map(([name, value]) => ({ name, value }));

    // 预警报告
    const warnings = [];
    const totalCount = selected.reduce((sum, s) => sum + s.count, 0);
    const totalHp = selected.reduce((sum, s) => sum + s.hp * s.count, 0);
    const estimatedDuration = totalHp / (validationConfig.expectedDPS || 1);

    if (totalCount > validationConfig.maxDensity) {
      warnings.push({ type: 'danger', text: `单位密度过高 (${totalCount} > ${validationConfig.maxDensity})，可能影响渲染性能。` });
    }
    if (estimatedDuration > validationConfig.targetDuration * 1.5) {
      warnings.push({ type: 'warning', text: `战斗时长可能过长 (${estimatedDuration.toFixed(1)}s)。` });
    }

    return { selected, budget, pieData, warnings, estimatedDuration, totalCount };
  }, [fullLevelPlan, previewLevel, validationConfig]);

  return { fullLevelPlan, analysisResult };
};
