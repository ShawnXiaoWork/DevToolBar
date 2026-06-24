// 测试脚本：通过复制和隔离来测试被修改的 generateStageStepData 核心逻辑
// 确保第一个敌人的延迟正确对应配置的 waveInterval

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

// 复制自 src/pages/LevelMaker/utils/exportUtils.js 的修改版
const generateStageStepData = (fullLevelPlan) => {
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
      // 资深架构师提示：第一波敌人默认开始间隔为难度预算配置的波次间隔，后续敌人在此延迟基础之上进行顺延
      let cumulativeDelay = waveInterval;

      unitsInWave.forEach(({ unit, count }) => {
        const maxRow = unit.maxRow || 15;
        const spawnRates = unit.spawnRates || 0.4;
        monsterConfig.push([parseInt(unit.id), count, parseFloat(cumulativeDelay.toFixed(2))]);
        const duration = Math.ceil(count / maxRow) * spawnRates;
        cumulativeDelay += duration + (1.2 + Math.random() * 0.8);
      });

      if (monsterConfig.length === 0 && regularUnits.length > 0) {
        monsterConfig.push([parseInt(regularUnits[0].id), 2, waveInterval]);
      }

      const waveMultiplier = 0.8 + (wave - 1) / 14 * 0.4;
      const finalHpCoeff = Number((stageBaseHp * waveMultiplier).toFixed(2));
      const finalAtkCoeff = Number((stageBaseAtk * waveMultiplier).toFixed(2));

      rows[currentRowIdx++] = {
        [STEP_COL.ID]: currentStepId++,
        [STEP_COL.LEVEL]: level,
        [STEP_COL.WAVE]: wave,
        [STEP_COL.ADVANCE]: 0, // 保持 Advance 列为 0
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

// 构造测试数据
const mockFullLevelPlan = [
  {
    level: 1,
    budget: 1000,
    hpCoeff: 1.0,
    atkCoeff: 1.0,
    isBossLevel: false,
    targetTier: 'T1',
    waveInterval: 45, // 设定波次间隔为 45 秒
    selected: [
      {
        id: '10001',
        name: '测试战士',
        hp: 100,
        atk: 10,
        assignedRole: 'Warrior',
        maxRow: 10,
        spawnRates: 0.5,
        count: 8
      }
    ]
  }
];

function runTest() {
  console.log('开始执行波次间隔算法逻辑测试...');

  const resultRows = generateStageStepData(mockFullLevelPlan);
  
  // 检查是否生成了 15 个波次
  const totalWaves = Object.keys(resultRows).length;
  if (totalWaves !== 15) {
    throw new Error(`预期生成 15 波数据，但实际生成了: ${totalWaves} 波`);
  }

  // 检查第一波的 Monster 配置
  const firstWaveRow = resultRows[0];
  const monsterJson = firstWaveRow[STEP_COL.MONSTER]; // 6
  const monsterConfig = JSON.parse(monsterJson);

  console.log('第一波 Monster 配置为:', monsterConfig);

  if (!Array.isArray(monsterConfig) || monsterConfig.length === 0) {
    throw new Error('生成的 Monster 配置不能为空');
  }

  const firstEnemy = monsterConfig[0];
  const firstEnemyDelay = firstEnemy[2];

  console.log(`第一个敌人的生成延迟参数为: ${firstEnemyDelay} 秒`);

  if (firstEnemyDelay !== 45) {
    throw new Error(`预期第一个敌人的生成延迟为 45，实际为: ${firstEnemyDelay}`);
  }

  // 同时校验 Advance 列是否保持为 0
  const advanceVal = firstWaveRow[STEP_COL.ADVANCE];
  console.log(`验证 Advance 列配置为: ${advanceVal}`);
  if (advanceVal !== 0) {
    throw new Error(`预期 Advance 列仍为 0，但实际为: ${advanceVal}`);
  }

  console.log('测试通过！成功验证第一个敌人的生成延迟等于 waveInterval 配置且 Advance 保持原样。');
}

try {
  runTest();
} catch (e) {
  console.error('测试失败:', e.message);
  process.exit(1);
}
