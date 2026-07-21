/**
 * 关卡部署导出工具类
 * 采用数值策划导向的“波次节奏曲线”算法
 */

import * as XLSX from 'xlsx';
import { loadExcelWorkbook, saveExcelWorkbook } from '../../../utils/excelSyncUtils.js';
import { syncArmyTable } from './armySyncUtils.js';



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
const FORMATION_PATTERNS = {
  1: [[4], [3], [5]],
  2: [[3, 4]],
  3: [[3, 4, 10], [3, 4, 11], [4, 10, 11]],
  4: [[3, 4, 10, 11], [2, 3, 4, 10], [3, 4, 5, 11]],
  5: [[3, 4, 10, 11, 17], [3, 4, 5, 10, 11], [2, 3, 4, 10, 11]],
  6: [[3, 4, 10, 11, 17, 18], [2, 3, 4, 10, 11, 17], [3, 4, 5, 10, 11, 18]],
  7: [[3, 4, 10, 11, 17, 18, 12], [2, 3, 4, 10, 11, 17, 18]],
  8: [[3, 4, 10, 11, 17, 18, 12, 5], [2, 3, 4, 5, 10, 11, 17, 18]],
  9: [[3, 4, 10, 11, 17, 18, 12, 5, 19], [2, 3, 4, 5, 10, 11, 12, 17, 18]],
  10: [[3, 4, 10, 11, 17, 18, 12, 5, 19, 2], [2, 3, 4, 5, 10, 11, 12, 17, 18, 19]]
};

const DEFAULT_FORMATION_ORDER = [
  3, 4, 10, 11, 17, 18, 12, 5, 19, 2,
  9, 16, 20, 6, 13, 25, 26, 24, 27, 23,
  31, 32, 30, 33, 29, 1, 7, 8, 14, 15,
  21, 22, 28, 34, 35
];

const getStableFormationIndex = (level, count, patternCount) => {
  const seed = Math.abs(Number(level) || 0) * 31 + count * 17;
  return seed % patternCount;
};

export const getMonsterFormationPositions = (level, monsterCount) => {
  const count = Math.max(0, Number(monsterCount) || 0);
  if (count === 0) return [];

  const patterns = FORMATION_PATTERNS[Math.min(count, 10)];
  if (patterns && count <= 10) {
    const pattern = patterns[getStableFormationIndex(level, count, patterns.length)];
    return pattern.slice(0, count);
  }

  return DEFAULT_FORMATION_ORDER.slice(0, Math.min(count, DEFAULT_FORMATION_ORDER.length));
};

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
    const { level, selected, hpCoeff, atkCoeff } = lp;
    const stageBaseHp = hpCoeff;
    const stageBaseAtk = atkCoeff;

    const isBossLevel = lp.isBossLevel || selected.some(u => u.assignedRole === 'BOSS');
    const monsterConfig = [];
    const formationPositions = getMonsterFormationPositions(level, selected.length);

    selected.forEach((u, index) => {
      const position = formationPositions[index] || DEFAULT_FORMATION_ORDER[index % DEFAULT_FORMATION_ORDER.length];
      monsterConfig.push([parseInt(u.id), position]);
    });

    if (monsterConfig.length === 0 && selected.length > 0) {
      monsterConfig.push([parseInt(selected[0].id), 4]);
    }

    const finalHpCoeff = Number(stageBaseHp.toFixed(2));
    const finalAtkCoeff = Number(stageBaseAtk.toFixed(2));

    rows[currentRowIdx++] = {
      [STEP_COL.ID]: currentStepId++,
      [STEP_COL.LEVEL]: level,
      [STEP_COL.WAVE]: 1, // 一关只有一波
      [STEP_COL.ADVANCE]: 0,
      [STEP_COL.BOSS]: isBossLevel ? 1 : 0,
      [STEP_COL.MONSTER]: JSON.stringify(monsterConfig),
      [STEP_COL.HP]: finalHpCoeff,
      [STEP_COL.ATK]: finalAtkCoeff,
      [STEP_COL.CASTLE]: 1.0
    };
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
