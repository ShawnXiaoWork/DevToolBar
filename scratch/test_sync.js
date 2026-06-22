import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock dynamic import or require
const origPath = path.resolve(__dirname, './orig_StageStepTable.xlsx');
const destPath = path.resolve(__dirname, './test_synced_output.xlsx');

// 1. Copy original file to test_synced_output.xlsx first to simulate load and save on same
fs.copyFileSync(origPath, destPath);

// Define STEP_COL
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

const WAVE_WEIGHT_CURVE = [
  0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.12,
  0.04,
  0.06, 0.08, 0.10, 0.12, 0.14, 0.18,
  0.03
];

const getUnlockCount = (wave, totalTypes) => {
  if (wave <= 2) return Math.max(1, Math.ceil(totalTypes * 0.3));
  if (wave <= 5) return Math.max(1, Math.ceil(totalTypes * 0.5));
  if (wave <= 7) return Math.max(1, Math.ceil(totalTypes * 0.8));
  return totalTypes;
};

// Generate StageStepTable mock plan
const mockFullLevelPlan = [
  {
    level: 1,
    hpCoeff: 1.0,
    atkCoeff: 1.0,
    selected: [
      { id: '10001', count: 50, assignedRole: 'NORMAL', maxRow: 15, spawnRates: 0.4 },
      { id: '20001', count: 30, assignedRole: 'NORMAL', maxRow: 15, spawnRates: 0.4 },
      { id: '90001', count: 1, assignedRole: 'BOSS', maxRow: 15, spawnRates: 0.4 }
    ]
  },
  {
    level: 2,
    hpCoeff: 1.2,
    atkCoeff: 1.2,
    selected: [
      { id: '10002', count: 60, assignedRole: 'NORMAL', maxRow: 15, spawnRates: 0.4 },
      { id: '20002', count: 40, assignedRole: 'NORMAL', maxRow: 15, spawnRates: 0.4 },
      { id: '90002', count: 1, assignedRole: 'BOSS', maxRow: 15, spawnRates: 0.4 }
    ]
  }
];

export const generateStageStepData = (fullLevelPlan) => {
  const rows = {};
  let currentStepId = 1;
  let currentRowIdx = 0;

  fullLevelPlan.forEach((lp) => {
    const { level, selected, hpCoeff, atkCoeff } = lp;
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
      let cumulativeDelay = 0;

      unitsInWave.forEach(({ unit, count }) => {
        const maxRow = unit.maxRow || 15;
        const spawnRates = unit.spawnRates || 0.4;
        monsterConfig.push([parseInt(unit.id), count, parseFloat(cumulativeDelay.toFixed(2))]);
        const duration = Math.ceil(count / maxRow) * spawnRates;
        cumulativeDelay += duration + (1.2 + Math.random() * 0.8);
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

const runTest = async () => {
  try {
    const buffer = fs.readFileSync(destPath);
    const workbook = XLSX.read(new Uint8Array(buffer), {
      type: 'array',
      cellStyles: true,
      cellNF: true,
      cellComments: true
    });
    
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const rowsToUpdate = generateStageStepData(mockFullLevelPlan);
    const dataStartRowIdx = 4;

    Object.entries(rowsToUpdate).forEach(([relativeRowIdx, colData]) => {
      const targetRowIdx = dataStartRowIdx + parseInt(relativeRowIdx);
      Object.entries(colData).forEach(([c, val]) => {
        const addr = XLSX.utils.encode_cell({ c: parseInt(c), r: targetRowIdx });
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

    // Delete workbook.Themes to prevent corruption
    delete workbook.Themes;

    const outBase64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const outBuffer = Buffer.from(outBase64, 'base64');
    fs.writeFileSync(destPath, outBuffer);
    
    console.log('Original size:', buffer.length);
    console.log('Synced size:', outBuffer.length);
    
    // Check themes size
    const workbookCheck = XLSX.read(new Uint8Array(outBuffer), {
      type: 'array',
      cellStyles: true,
      cellNF: true,
      cellComments: true
    });
    console.log('Themes stringified size:', JSON.stringify(workbookCheck.Themes || {}).length);
    
  } catch (err) {
    console.error('Error running test:', err);
  }
};

runTest();
