/**
 * 游戏数值预设与默认配置 (Game Default Configs)
 * 集中管理各模块的初始数值，方便后续策划进行统一调整
 */

// ----------------------------------------------------
// 1. 全局关卡难度预算配置 (Level Budget Config)
// ----------------------------------------------------
export const DEFAULT_LEVEL_CONFIG = {
  baseScore: 50000,           // 关卡基准分数
  initialMultiplier: 1,       // 起始难度倍率
  difficultyFactor: 0.2,      // 后期难度膨胀因子
  waveInterval: 30,           // 关卡中每波敌人的默认开始间隔 (秒)
  spikes: Array.from({ length: 20 }, (_, i) => {
    const level = (i + 1) * 10;
    const chapter = i + 1;
    const isMajorChapter = chapter % 5 === 0;
    return {
      level,
      hpMultiplier: isMajorChapter ? 1.4 : 1.2,
      atkMultiplier: isMajorChapter ? 1.6 : 1.3,
      type: 'peak',
      note: isMajorChapter ? `第 ${chapter / 5} 章节终极 Boss` : `第 ${chapter} 阶段精英战`
    };
  }).concat(Array.from({ length: 20 }, (_, i) => ({
    level: (i + 1) * 10,
    hpMultiplier: 1.1,
    atkMultiplier: 1.1,
    type: 'step',
    note: `第 ${i + 1} 章节难度台阶`
  })))
};

// ----------------------------------------------------
// 2. 兵种属性生成基准参数 (Derivation Params)
// ----------------------------------------------------
export const DEFAULT_DERIVATION_PARAMS = {
  baseHp: 30,                 // 基础生命
  baseAtk: 15,                // 基础攻击
  baseSpd: 75,                // 基础移动速度
  baseSkillPower: 0,          // 基础技能强度
  targetRole: 0,              // 默认职能 (Tank)
  unitName: '衍生单位'          // 默认前缀名称
};

// ----------------------------------------------------
// 3. 兵种职能系数权重 (Role Weights)
// ----------------------------------------------------
export const DEFAULT_ROLE_WEIGHTS = {
  0: { hp: 1.6, atk: 0.4, cc: 0, atkSpeed: 0.8, atkRange: 100, detRange: 200 }, // 坦克
  1: { hp: 1.0, atk: 1.0, cc: 0, atkSpeed: 1.2, atkRange: 100, detRange: 200 }, // 战士
  2: { hp: 0.5, atk: 1.5, cc: 0, atkSpeed: 2.0, atkRange: 600, detRange: 700 }, // 射手
  3: { hp: 0.7, atk: 0.6, cc: 0.7, atkSpeed: 1.5, atkRange: 400, detRange: 500 }  // 法师/辅助
};

// ----------------------------------------------------
// 4. 兵种矩阵生成与部署配置 (Matrix Config)
// ----------------------------------------------------
export const DEFAULT_MATRIX_CONFIG = {
  totalLevels: 200,           // 规划总关卡数
  updateFrequency: 5,         // 兵种更新频率 (每x关引入新兵种)
  randomness: 0.2,            // 属性随机波动范围 (0.2=上下浮动20%)
  roleDistribution: { 0: 0.2, 1: 0.25, 2: 0.4, 3: 0.15 }, // 生成时的各职能总体占比
  bossFrequency: 5,           // 每x个兵种中包含一个Boss
  minBossPerLevel: 2          // Boss关卡的最小同类Boss数量
};

// ----------------------------------------------------
// 5. 关卡阵容配比模板 (Roster Templates)
// ----------------------------------------------------
export const DEFAULT_ROSTER_TEMPLATES = [
  { id: 't1', name: '均衡阵型', 0: 0.2, 1: 0.3, 2: 0.4, 3: 0.1 },
  { id: 't2', name: '高压阵型', 0: 0.1, 1: 0.0, 2: 0.8, 3: 0.1 },
  { id: 't3', name: '绞肉机阵型', 0: 0.0, 1: 0.7, 2: 0.0, 3: 0.3 }
];

// ----------------------------------------------------
// 6. 验证与预警阈值配置 (Validation Config)
// ----------------------------------------------------
export const DEFAULT_VALIDATION_CONFIG = {
  expectedDPS: 100,           // 玩家预期DPS基准
  targetDuration: 240,         // 预期通关时长上限(s)
  maxDensity: 1000,             // 场景内最大容许敌人数量
  minDensity: 10              // 场景内最小容许敌人数量
};
