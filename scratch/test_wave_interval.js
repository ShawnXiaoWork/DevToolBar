// 测试脚本：测试修改后的 generateStageStepData 核心逻辑
// 确保一关只生成一波敌人且延迟逻辑正确

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
    const { level, selected, hpCoeff, atkCoeff } = lp;
    const stageBaseHp = hpCoeff;
    const stageBaseAtk = atkCoeff;

    const isBossLevel = lp.isBossLevel || selected.some(u => u.assignedRole === 'BOSS');
    const monsterConfig = [];
    let cumulativeDelay = 0; // 单波次敌人的默认开始间隔为 0

    selected.forEach((u) => {
      const maxRow = u.maxRow || 15;
      const spawnRates = u.spawnRates || 0.4;
      const count = u.count || 1;
      monsterConfig.push([parseInt(u.id), count, parseFloat(cumulativeDelay.toFixed(2))]);
      const duration = Math.ceil(count / maxRow) * spawnRates;
      cumulativeDelay += duration + (1.2 + Math.random() * 0.8);
    });

    if (monsterConfig.length === 0 && selected.length > 0) {
      monsterConfig.push([parseInt(selected[0].id), 2, 0]);
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

// 构造测试数据
const mockFullLevelPlan = [
  {
    level: 1,
    budget: 1000,
    hpCoeff: 1.25,
    atkCoeff: 1.35,
    isBossLevel: false,
    targetTier: 'T1',
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
      },
      {
        id: '10002',
        name: '测试Boss',
        hp: 1000,
        atk: 50,
        assignedRole: 'BOSS',
        maxRow: 1,
        spawnRates: 1.0,
        count: 1
      }
    ]
  }
];

function runTest() {
  console.log('开始执行单波次逻辑测试...');

  const resultRows = generateStageStepData(mockFullLevelPlan);
  
  // 检查是否仅生成了 1 个波次
  const totalRows = Object.keys(resultRows).length;
  if (totalRows !== 1) {
    throw new Error(`预期生成 1 行数据，但实际生成了: ${totalRows} 行`);
  }

  const row = resultRows[0];

  // 1. 检查 Wave 恒为 1
  if (row[STEP_COL.WAVE] !== 1) {
    throw new Error(`预期 Wave 值为 1，但实际为: ${row[STEP_COL.WAVE]}`);
  }

  // 2. 检查 Boss 标识应为 1
  if (row[STEP_COL.BOSS] !== 1) {
    throw new Error(`预期 BOSS 标识为 1（因为有 BOSS 角色单位），但实际为: ${row[STEP_COL.BOSS]}`);
  }

  // 3. 检查 HP 和 ATK 系数是否直接使用基准系数
  if (row[STEP_COL.HP] !== 1.25) {
    throw new Error(`预期 HP 值为 1.25，但实际为: ${row[STEP_COL.HP]}`);
  }
  if (row[STEP_COL.ATK] !== 1.35) {
    throw new Error(`预期 ATK 值为 1.35，但实际为: ${row[STEP_COL.ATK]}`);
  }

  // 4. 检查 Monster 配置
  const monsterJson = row[STEP_COL.MONSTER];
  const monsterConfig = JSON.parse(monsterJson);

  console.log('生成的 Monster 配置为:', monsterConfig);

  if (!Array.isArray(monsterConfig) || monsterConfig.length !== 2) {
    throw new Error(`预期包含 2 个怪兽类型，但实际包含: ${monsterConfig.length}`);
  }

  // 5. 第一个怪的延迟应为 0
  const firstEnemyDelay = monsterConfig[0][2];
  console.log(`第一个敌人的生成延迟参数为: ${firstEnemyDelay} 秒`);
  if (firstEnemyDelay !== 0) {
    throw new Error(`预期第一个敌人的生成延迟为 0，实际为: ${firstEnemyDelay}`);
  }

  // 6. 第二个怪的延迟应大于 0
  const secondEnemyDelay = monsterConfig[1][2];
  console.log(`第二个敌人的生成延迟参数为: ${secondEnemyDelay} 秒`);
  if (secondEnemyDelay <= 0) {
    throw new Error(`预期第二个敌人的生成延迟大于 0，实际为: ${secondEnemyDelay}`);
  }

  console.log('测试通过！成功验证单关仅配置一波敌人的逻辑。');
}

try {
  runTest();
} catch (e) {
  console.error('测试失败:', e.message);
  process.exit(1);
}
