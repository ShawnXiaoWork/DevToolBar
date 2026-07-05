/**
 * 关卡部署导出工具类
 * 采用数值策划导向的“波次节奏曲线”算法
 */

import * as XLSX from 'xlsx';
import { loadExcelWorkbook, saveExcelWorkbook } from '../../../utils/excelSyncUtils.js';
import { syncArmyTable } from './armySyncUtils.js';

/**
 * 设计 15 波次的权重曲线 (数值策划预设)
 * 模拟 Roguelike 节奏：线性增长 -> 呼吸期 -> 指数爆发
 */
const WAVE_WEIGHT_CURVE = [
  0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.12, // 1-7 波：线性递增，第 7 波达到前中期峰值 (0.39)
  0.04,                                     // 8 波：中场 Boss 节点 (压力释放，突出 Boss 个体)
  0.06, 0.08, 0.10, 0.12, 0.14, 0.18,       // 9-14 波：高频爬坡，引入强力组合 (0.68)
  0.03                                      // 15 波：决战时刻 (极致精简小怪，决战 Boss)
];

/**
 * 兵种解锁逻辑：模拟 Roguelike 的引入感
 * @param {number} wave 当前波次 (1-15)
 * @param {number} totalUnits 总兵种类型数
 * @returns {number} 当前波次可使用的兵种类型上限
 */
const getUnlockCount = (wave, totalTypes) => {
  if (wave <= 2) return Math.max(1, Math.ceil(totalTypes * 0.3));
  if (wave <= 5) return Math.max(1, Math.ceil(totalTypes * 0.5));
  if (wave <= 7) return Math.max(1, Math.ceil(totalTypes * 0.8));
  return totalTypes; // 8 波以后全开
};

// 列索引映射常量 (基于模板分析)
const STAGE_COL = {
  ID: 1,
  REMARKS: 2,
  ATK: 21,
  HP: 22
};

const STEP_COL = {
  ID: 1,
  LEVEL: 2,
  WAVE: 3,
  ADVANCE: 4,
  BOSS: 5,
  MONSTER: 6,
  HP: 7,
  ATK: 8,
  CASTLE: 9
};

/**
 * 生成 StageTable 数据 (稀疏映射版)
 * 返回格式: { rowIndex: { colIndex: value } }
 */
export const generateStageTableData = (fullLevelPlan) => {
  const rows = {};
  fullLevelPlan.forEach((lp, i) => {
    const level = lp.level;
    const baseHp = Number(lp.hpCoeff.toFixed(2));
    const baseAtk = Number(lp.atkCoeff.toFixed(2));

    rows[i] = {
      [STAGE_COL.ID]: level,
      [STAGE_COL.REMARKS]: `关卡 ${level}`,
      [STAGE_COL.ATK]: baseAtk,
      [STAGE_COL.HP]: baseHp
    };
  });
  return rows;
};

/**
 * 生成 StageStepTable 数据 (稀疏映射版)
 */
export const generateStageStepData = (fullLevelPlan) => {
  const rows = {};
  let currentStepId = 1;
  let currentRowIdx = 0;

  fullLevelPlan.forEach((lp) => {
    const { level, selected, hpCoeff, atkCoeff, waveInterval = 30 } = lp;
    const stageBaseHp = hpCoeff;
    const stageBaseAtk = atkCoeff;

    const bossUnits = selected.filter(u => u.assignedRole === 'BOSS');
    const regularUnits = selected.filter(u => u.assignedRole !== 'BOSS');
    const totalTypes = regularUnits.length;
    const waveConfigs = Array.from({ length: 15 }, () => []);

    if (bossUnits.length > 0) {
      waveConfigs[7].push({ unit: bossUnits[0], count: 1 });
      const finalBoss = bossUnits.length > 1 ? bossUnits[1] : bossUnits[0];
      waveConfigs[14].push({ unit: finalBoss, count: 1 });
    }

    regularUnits.forEach((u, idx) => {
      let startWave = 1;
      for (let w = 1; w <= 15; w++) {
        if (getUnlockCount(w, totalTypes) > idx) {
          startWave = w;
          break;
        }
      }
      let totalActiveWeight = 0;
      for (let w = startWave; w <= 15; w++) totalActiveWeight += WAVE_WEIGHT_CURVE[w - 1];

      let remainingCount = u.count || 1;
      for (let w = startWave; w <= 15; w++) {
        let waveCount = 0;
        if (w === 15) {
          waveCount = remainingCount;
        } else {
          const proportion = WAVE_WEIGHT_CURVE[w - 1] / totalActiveWeight;
          waveCount = Math.round((u.count || 1) * proportion);
          waveCount = Math.min(waveCount, remainingCount);
        }
        if (waveCount > 0) {
          waveConfigs[w - 1].push({ unit: u, count: waveCount });
          remainingCount -= waveCount;
        }
      }
    });

    for (let wave = 1; wave <= 15; wave++) {
      const isBossWave = (wave === 8 || wave === 15);
      const unitsInWave = waveConfigs[wave - 1];
      const monsterConfig = [];
      // 资深架构师提示：第一波（wave === 1）敌人的默认开始间隔为 0，后续波次（wave > 1）在此延迟基础之上进行顺延
      let cumulativeDelay = wave === 1 ? 0 : waveInterval;

      unitsInWave.forEach(({ unit, count }) => {
        const maxRow = unit.maxRow || 15;
        const spawnRates = unit.spawnRates || 0.4;
        monsterConfig.push([parseInt(unit.id), count, parseFloat(cumulativeDelay.toFixed(2))]);
        const duration = Math.ceil(count / maxRow) * spawnRates;
        cumulativeDelay += duration + (1.2 + Math.random() * 0.8);
      });

      if (monsterConfig.length === 0 && regularUnits.length > 0) {
        monsterConfig.push([parseInt(regularUnits[0].id), 2, wave === 1 ? 0 : waveInterval]);
      }

      const waveMultiplier = 0.8 + (wave - 1) / 14 * 0.4;
      const finalHpCoeff = Number((stageBaseHp * waveMultiplier).toFixed(2));
      const finalAtkCoeff = Number((stageBaseAtk * waveMultiplier).toFixed(2));

      rows[currentRowIdx++] = {
        [STEP_COL.ID]: currentStepId++,
        [STEP_COL.LEVEL]: level,
        [STEP_COL.WAVE]: wave,
        [STEP_COL.ADVANCE]: 0,
        [STEP_COL.BOSS]: isBossWave ? 1 : 0,
        [STEP_COL.MONSTER]: JSON.stringify(monsterConfig),
        [STEP_COL.HP]: finalHpCoeff,
        [STEP_COL.ATK]: finalAtkCoeff,
        [STEP_COL.CASTLE]: 1.0
      };
    }
  });
  return rows;
};

/**
 * 通用 Excel 稀疏更新同步函数
 */
const syncTable = async (filename, generateFn, fullLevelPlan) => {
  try {
    if (!Array.isArray(fullLevelPlan) || fullLevelPlan.length === 0) {
      throw new Error('没有可同步的关卡规划数据');
    }

    const { workbook, sheet } = await loadExcelWorkbook(filename);
    
    const rowsToUpdate = generateFn(fullLevelPlan); // { relativeRowIdx: { colIndex: value } }
    const dataStartRowIdx = 4;

    Object.entries(rowsToUpdate).forEach(([relativeRowIdx, colData]) => {
      const targetRowIdx = dataStartRowIdx + parseInt(relativeRowIdx);
      Object.entries(colData).forEach(([c, val]) => {
        const addr = XLSX.utils.encode_cell({ c: parseInt(c), r: targetRowIdx });
        // 仅修改值，保留原有单元格样式
        if (!sheet[addr]) {
          sheet[addr] = { v: val, t: typeof val === 'number' ? 'n' : 's' };
        } else {
          sheet[addr].v = val;
          sheet[addr].t = typeof val === 'number' ? 'n' : 's';
        }
      });
    });

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z100');
    const maxRowIdx = dataStartRowIdx + Object.keys(rowsToUpdate).length - 1;
    if (range.e.r < maxRowIdx) range.e.r = maxRowIdx;
    sheet['!ref'] = XLSX.utils.encode_range(range);

    const result = await saveExcelWorkbook(workbook, filename);
    if (!result || result.status !== 'OK') {
      throw new Error(result?.message || `${filename} 保存失败`);
    }
  } catch (error) {
    console.error(`同步 ${filename} 失败:`, error);
    throw error;
  }
};

/**
 * 同步 StageTable
 */
export const syncStageTable = (fullLevelPlan) => {
  return syncTable('StageTable.xlsx', generateStageTableData, fullLevelPlan);
};

/**
 * 同步 StageStepTable
 */
export const syncStageStepTable = (fullLevelPlan) => {
  return syncTable('StageStepTable.xlsx', generateStageStepData, fullLevelPlan);
};

/**
 * 一键同步所有规划表
 */
export class LevelTableSyncError extends Error {
  constructor({ failedTables, syncedTables }) {
    super(`同步失败：${failedTables.map(item => `${item.table} (${item.message})`).join('；')}`);
    this.name = 'LevelTableSyncError';
    this.failedTables = failedTables;
    this.syncedTables = syncedTables;
  }
}

export const syncAllLevelTables = async (options) => {
  const {
    fullLevelPlan,
    units,
    roleWeights = {},
    derivationParams = {},
    syncers = {
      syncArmyTable,
      syncStageTable,
      syncStageStepTable
    }
  } = Array.isArray(options) ? { fullLevelPlan: options } : options;

  const tasks = [
    {
      table: 'ArmyTable.xlsx',
      run: () => syncers.syncArmyTable({ units, roleWeights, derivationParams })
    },
    {
      table: 'StageTable.xlsx',
      run: () => syncers.syncStageTable(fullLevelPlan)
    },
    {
      table: 'StageStepTable.xlsx',
      run: () => syncers.syncStageStepTable(fullLevelPlan)
    }
  ];

  const syncedTables = [];
  const failedTables = [];

  for (const task of tasks) {
    try {
      await task.run();
      syncedTables.push(task.table);
    } catch (error) {
      console.error(`同步 ${task.table} 失败:`, error);
      failedTables.push({
        table: task.table,
        message: error?.message || '未知错误'
      });
    }
  }

  if (failedTables.length > 0) {
    throw new LevelTableSyncError({ failedTables, syncedTables });
  }

  return {
    ok: true,
    syncedTables
  };
};

/**
 * 根据曲线公式计算奖励数量
 */
export const calculateRewardQuantity = (level, formula, params, startLevel = 1) => {
  const base = Number(params.base || 0);
  const relLevel = Math.max(1, level - startLevel + 1);
  const relSteps = Math.max(0, level - startLevel);
  switch (formula) {
    case 'power': {
      const power = Number(params.power || 1);
      return Math.round(base * Math.pow(relLevel, power));
    }
    case 'linear': {
      const coeff = Number(params.coeff || 0);
      return Math.round(base * (1 + coeff * relSteps));
    }
    case 'exponential': {
      const growthRate = Number(params.growthRate || 1);
      return Math.round(base * Math.pow(growthRate, relSteps));
    }
    default:
      return base;
  }
};

/**
 * 同步关卡资源投放奖励至 StageTable.xlsx
 */
export const syncStageRewardsTable = async (rewardsConfig) => {
  try {
    const { workbook, sheet, headers, range } = await loadExcelWorkbook('StageTable.xlsx');
    
    const idIdx = headers.indexOf('Id');
    const stageRewardIdx = headers.indexOf('StageReward');
    const stageRewardFailIdx = headers.indexOf('StageRewardFail');
    const stageRewardHardIdx = headers.indexOf('StageRewardHard');
    const stageRewardFailHardIdx = headers.indexOf('StageRewardFailHard');
    const stageRewardFirstTimetHardIdx = headers.indexOf('StageRewardFirstTimetHard');
    const idleReward1Idx = headers.indexOf('IdleReward1');

    if (idIdx === -1) throw new Error('未找到 Id 列，请确认表格结构');

    const fieldsMapping = {
      'StageReward': stageRewardIdx,
      'StageRewardFail': stageRewardFailIdx,
      'StageRewardHard': stageRewardHardIdx,
      'StageRewardFailHard': stageRewardFailHardIdx,
      'StageRewardFirstTimetHard': stageRewardFirstTimetHardIdx,
      'IdleReward1': idleReward1Idx
    };

    const dataStartRowIdx = 4;
    
    for (let r = dataStartRowIdx; r <= range.e.r; r++) {
      const idCell = sheet[XLSX.utils.encode_cell({ c: idIdx, r })];
      if (!idCell || idCell.v === undefined) continue;
      
      const level = parseInt(idCell.v);
      if (isNaN(level)) continue;

      Object.entries(fieldsMapping).forEach(([fieldKey, colIdx]) => {
        if (colIdx === -1) return;

        const rules = rewardsConfig[fieldKey] || [];
        const rewardsList = [];

        rules.forEach(rule => {
          const start = Number(rule.range?.[0] ?? 1);
          const end = Number(rule.range?.[1] ?? 9999);
          if (level >= start && level <= end) {
            const qty = calculateRewardQuantity(level, rule.formula, rule.params, start);
            if (qty > 0) {
              rewardsList.push([Number(rule.itemId), qty, Number(rule.prob || 100)]);
            }
          }
        });

        const formattedStr = JSON.stringify(rewardsList);
        const cellAddr = XLSX.utils.encode_cell({ c: colIdx, r });

        if (!sheet[cellAddr]) {
          sheet[cellAddr] = { v: formattedStr, t: 's' };
        } else {
          sheet[cellAddr].v = formattedStr;
          sheet[cellAddr].t = 's';
        }
      });
    }

    await saveExcelWorkbook(workbook, 'StageTable.xlsx');
    return { status: 'OK', message: '关卡资源奖励成功同步至 StageTable.xlsx！' };
  } catch (error) {
    console.error('syncStageRewardsTable error:', error);
    throw error;
  }
};

/**
 * 解析关卡奖励字符串，兼容双层及三层括号
 * 格式 [[[id, count, prob], ...]] 或 [[id, count, prob], ...]
 */
export const parseRewardString = (str) => {
  if (!str) return [];
  const cleaned = String(str).trim();
  if (cleaned === '[[[]]]' || cleaned === '[[[]]]' || cleaned === '[]' || cleaned === '') {
    return [];
  }
  try {
    let parsed = JSON.parse(cleaned);
    
    // 如果是三层括号形式 [[[1, 1200, 100]]]，转换为双层
    if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) {
      parsed = parsed[0];
    }
    
    if (Array.isArray(parsed)) {
      return parsed.map(item => {
        if (!Array.isArray(item)) return null;
        return {
          itemId: String(item[0]),
          count: Number(item[1] || 1),
          prob: Number(item[2] ?? 100)
        };
      }).filter(Boolean);
    }
  } catch {
    // 降级正则解析
    const result = [];
    const matches = cleaned.match(/\[\d+,\d+(?:,\d+)?\]/g);
    if (matches) {
      matches.forEach(m => {
        const parts = m.replace(/[[\]]/g, '').split(',').map(Number);
        if (parts.length >= 2) {
          result.push({
            itemId: String(parts[0]),
            count: parts[1],
            prob: parts[2] ?? 100
          });
        }
      });
    }
    return result;
  }
  return [];
};
