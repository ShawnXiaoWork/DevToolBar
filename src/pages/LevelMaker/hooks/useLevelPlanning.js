import { useMemo } from 'react';
import { calculatePowerScore, getLevelBudget, getTargetTier } from '../utils/planningUtils';
import { ROLE_LABELS } from '../utils/constants';

/**
 * 核心关卡规划 Hook
 * 负责计算全关卡部署 (fullLevelPlan) 与单关分析 (analysisResult)
 * 采用“体验驱动”算法：侧重于兵种的递进、引入与多样性
 */
export const useLevelPlanning = (state, config) => {
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
   * 全关卡部署规划逻辑 (算法升级版)
   */
  const fullLevelPlan = useMemo(() => {
    if (state.units.length === 0) return [];

    const template = rosterTemplates.find(t => t.id === activeTemplateId) || rosterTemplates[0];
    
    // 用于追踪每个兵种最后出现的关卡，以保证多样性 (Recency tracking)
    const lastSeen = {}; 

    return Array.from({ length: previewRange }, (_, i) => {
      const level = i + 1;
      const targetTier = getTargetTier(level);
      const targetTierInt = Number(targetTier.replace('T', ''));

      // 1. 获取基础系数 (用于计算展示战力，虽不作为投放约束)
      const initialMultiplier = levelConfig.initialMultiplier || 1.0;
      const steps = (levelConfig.spikes || []).filter(s => s.type === 'step' && level >= s.level);
      let hpCoeff = initialMultiplier, atkCoeff = initialMultiplier;
      steps.forEach(s => { hpCoeff *= (s.hpMultiplier || 1); atkCoeff *= (s.atkMultiplier || 1); });

      const peak = (levelConfig.spikes || []).find(s => s.level === level && s.type === 'peak');
      if (peak) { hpCoeff *= (peak.hpMultiplier || 1); atkCoeff *= (peak.atkMultiplier || 1); }

      const budget = getLevelBudget(level, levelConfig);
      const isBossLevel = !!peak;

      // 2. 预处理当前 Tier 的可用兵种池
      const scaledUnits = state.units.map(u => {
        const scaled = { ...u, hp: Math.round(u.hp * hpCoeff), atk: Math.round(u.atk * atkCoeff) };
        return { ...scaled, scaledScore: calculatePowerScore(scaled) };
      });

      const selected = [];

      // 3. 强制投放 2 个 Boss (体验优先级最高)
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

      // 4. 体验驱动的普通兵种选取 (忽略 Budget 约束数量，侧重多样性)
      // 逻辑：每个职能根据模板权重，选取“最合适”的一个兵种，赋予固定或随机的合理数量
      Object.keys(ROLE_LABELS).map(Number).forEach(roleId => {
        const roleWeight = template[roleId] || 0;
        if (roleWeight <= 0) return;

        const roleKey = ROLE_LABELS[roleId] || `Role-${roleId}`;
        
        // 筛选符合职能且符合当前 Tier 或上一 Tier (作为过渡) 的兵种
        let pool = scaledUnits.filter(u => {
          const roles = Array.isArray(u.roles) ? u.roles : [];
          const matchRole = roles.includes(roleId) || roles.includes(String(roleId));
          const isCurrentTier = u.armyTag === targetTierInt;
          const isTransitionTier = u.armyTag === targetTierInt - 1;
          return matchRole && (isCurrentTier || isTransitionTier);
        });

        if (pool.length === 0) pool = scaledUnits.filter(u => (Array.isArray(u.roles) ? u.roles : []).includes(roleId));
        if (pool.length === 0) return;

        // 多样性排序：优先选择很久没见的兵种
        pool.sort((a, b) => (lastSeen[a.id] || 0) - (lastSeen[b.id] || 0));
        
        // 如果是 Tier 的前 5 关，赋予当前 Tier 兵种更高的选取权重 (引入期)
        const isIntroductionPhase = (level - 1) % 20 < 5; 
        const preferredPool = isIntroductionPhase ? pool.filter(u => u.armyTag === targetTierInt) : pool;
        const candidates = preferredPool.length > 0 ? preferredPool.slice(0, 3) : pool.slice(0, 3);
        
        const unit = candidates[Math.floor(Math.random() * candidates.length)];
        
        if (unit) {
          lastSeen[unit.id] = level;
          // 数量计算：虽然不考虑 Budget 严格限制，但为了视觉合理性，我们使用一个“标准密度”计算
          // 数量 = (Budget * Weight) / Score -> 向上取整，保证最低 1 个
          let count = Math.ceil((budget * roleWeight) / unit.scaledScore);
          if (count > 0) {
            selected.push({ ...unit, count, assignedRole: roleKey });
          }
        }
      });

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
  }, [state.units, levelConfig, previewRange, activeTemplateId, rosterTemplates, matrixConfig]);

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
