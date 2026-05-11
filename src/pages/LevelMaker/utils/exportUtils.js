/**
 * 关卡部署导出工具类
 * 采用数值策划导向的“波次节奏曲线”算法
 */

import * as XLSX from 'xlsx';

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
    const baseHp = Number(Math.pow(1.08, level - 1).toFixed(2));
    const baseAtk = Number(Math.pow(1.06, level - 1).toFixed(2));

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
    const { level, selected } = lp;
    const stageBaseHp = Math.pow(1.08, level - 1);
    const stageBaseAtk = Math.pow(1.06, level - 1);

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
      let cumulativeDelay = 0;

      unitsInWave.forEach(({ unit, count }) => {
        const maxRow = unit.maxRow || 15;
        const spawnRates = unit.spawnRates || 0.4;
        monsterConfig.push([parseInt(unit.id), count, parseFloat(cumulativeDelay.toFixed(2))]);
        const duration = (count / maxRow) * spawnRates;
        cumulativeDelay += duration + (0.1 + Math.random() * 0.4);
      });

      if (monsterConfig.length === 0 && regularUnits.length > 0) {
        monsterConfig.push([parseInt(regularUnits[0].id), 2, 0]);
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
    let workbook;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/read-excel?filename=${filename}`);
      if (!response.ok) throw new Error();
      const arrayBuffer = await response.arrayBuffer();
      workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellStyles: true, cellNF: true, cellComments: true });
    } catch (e) {
      workbook = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['#'], ['#'], ['#'], ['#']]);
      XLSX.utils.book_append_sheet(workbook, ws, "Sheet1");
    }
    
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rowsToUpdate = generateFn(fullLevelPlan); // { rowIndex: { colIndex: value } }
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

    const content = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const saveResponse = await fetch(`${import.meta.env.BASE_URL}api/save-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, filename })
    });

    if (!saveResponse.ok) throw new Error(`${filename} sync failed`);
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
export const syncAllLevelTables = async (fullLevelPlan) => {
  try {
    await syncStageTable(fullLevelPlan);
    await syncStageStepTable(fullLevelPlan);
    alert('表格精准同步成功 (Stage & StageStep)！其他非目标列配置已保留。');
  } catch (e) {
    alert('同步过程出现错误，请检查控制台。');
  }
};
