import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { DEFAULT_LEVEL_CONFIG } from '../config/defaultConfig';

const GameContext = createContext();

const initialState = {
  projectName: "未命名项目",
  gameType: "roguelike",
  // 1 游戏单位时间 (例如 1小时) = X 钻石
  baseSettings: {
    diamondPerTime: 100,
    timeUnit: "小时"
  },
  // 经济价值规则 (基于类型与品质的定价)
  economyRules: {
    itemTypes: [
      { id: 'equip', name: '装备', baseValue: 100 },
      { id: 'material', name: '材料', baseValue: 10 },
      { id: 'chip', name: '碎片', baseValue: 5 },
      { id: 'consumable', name: '消耗品', baseValue: 2 },
    ],
    qualities: [
      { id: 'white', name: '白色', multiplier: 1, color: '#FFFFFF' },
      { id: 'green', name: '绿色', multiplier: 2, color: '#4CAF50' },
      { id: 'blue', name: '蓝色', multiplier: 4, color: '#2196F3' },
      { id: 'purple', name: '紫色', multiplier: 10, color: '#9C27B0' },
      { id: 'orange', name: '橙色', multiplier: 30, color: '#FF9800' },
    ]
  },
  // 基础玩家模型
  playerModel: {
    dailyTime: 45, // 每天标准在线时长（分钟）
    efficiency: 1.0, // 活跃分层效率 (肝帝 1.2, 标准 1.0, 咸鱼 0.6)
    milestones: {
      day1: { targetLevel: 5, targetValueGap: 20, progressionTargets: [] },
      day3: { targetLevel: 15, targetValueGap: 80, progressionTargets: [] },
      day7: { targetLevel: 30, targetValueGap: 300, progressionTargets: [] },
      day30: { targetLevel: 100, targetValueGap: 2000, progressionTargets: [] }
    }
  },
  // 资源字典
  resources: [
    { id: 'res_gold', name: '金币', diamondRate: 0.01 }, // 1金币 = 0.01钻石
    { id: 'res_soul', name: '灵魂石', diamondRate: 5 },  // 1灵魂石 = 5钻石
    { id: 'res_dust', name: '魔法粉尘', diamondRate: 1 } // 1粉尘 = 1钻石
  ],
  // 宏观阶段规划
  macros: [
    {
      id: 'macro_early',
      stageName: '新手期',
      startDay: 1,
      endDay: 7,
      dailyTimeSpent: 2, // 每天投入 2 小时
      allocations: {
        'feat_magic': 30, // 30% 分配给魔法升级
        'feat_hero': 70   // 70% 分配给英雄升级
      }
    }
  ],
  // 功能模块配置
  features: [
    {
      id: 'feat_magic',
      name: '魔法升级',
      type: 'Core', // Core, Meta, Eco, Content
      unlockCondition: { type: 'time', value: 2 }, // 2分钟解锁
      physicalResources: [
        { resourceId: 'res_dust', weight: 100 } // 100% 消耗粉尘
      ],
      outputResources: [], // 初始产出资源
      growthModel: 'exponential',
      maxLevel: 20,
      params: { base: 1.1, baseCost: 100 },
      auditParams: { valueCostRatio: 1.0 }
    },
    {
      id: 'feat_hero',
      name: '英雄升级',
      type: 'Core',
      unlockCondition: { type: 'time', value: 0 }, // 0分钟解锁
      physicalResources: [
        { resourceId: 'res_gold', weight: 80 },
        { resourceId: 'res_soul', weight: 20 }
      ],
      outputResources: [], // 初始产出资源
      growthModel: 'linear',
      maxLevel: 50,
      params: { slope: 10 },
      auditParams: { valueCostRatio: 1.0 }
    },
    {
      id: 'feat_afk',
      name: '挂机收益',
      type: 'Eco',
      unlockCondition: { type: 'time', value: 0 },
      physicalResources: [],
      outputResources: [
        { resourceId: 'res_gold', weight: 100 }
      ],
      growthModel: 'linear',
      maxLevel: 50,
      params: { slope: 10 },
      auditParams: { outputPerMin: 120 } // 基础每分钟产出 120 金币
    }
  ],
  // 兵种库 (游戏制作辅助)
  units: [],
  // 关卡平衡配置
  levelConfig: DEFAULT_LEVEL_CONFIG
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'IMPORT_STATE':
      return { 
        ...initialState, 
        ...action.payload,
        levelConfig: {
          ...initialState.levelConfig,
          ...(action.payload.levelConfig || {})
        }
      };
    case 'UPDATE_PROJECT_NAME':
      return { ...state, projectName: action.payload };
    case 'UPDATE_BASE_SETTINGS':
      return { ...state, baseSettings: { ...state.baseSettings, ...action.payload } };
    case 'UPDATE_PLAYER_MODEL':
      return { ...state, playerModel: { ...state.playerModel, ...action.payload } };
    case 'UPDATE_MILESTONE':
      return {
        ...state,
        playerModel: {
          ...state.playerModel,
          milestones: {
            ...state.playerModel.milestones,
            [action.payload.day]: { ...state.playerModel.milestones[action.payload.day], ...action.payload.data }
          }
        }
      };
    case 'UPDATE_MILESTONE_TARGETS':
      return {
        ...state,
        playerModel: {
          ...state.playerModel,
          milestones: {
            ...state.playerModel.milestones,
            [action.payload.day]: {
              ...state.playerModel.milestones[action.payload.day],
              progressionTargets: action.payload.targets
            }
          }
        }
      };
    case 'UPDATE_ECONOMY_RULES':
      return { ...state, economyRules: { ...state.economyRules, ...action.payload } };
    case 'ADD_RESOURCE':
      return { ...state, resources: [...state.resources, action.payload] };
    case 'UPDATE_RESOURCE':
      return {
        ...state,
        resources: state.resources.map(r => r.id === action.payload.id ? { ...r, ...action.payload } : r)
      };
    case 'DELETE_RESOURCE':
      return {
        ...state,
        resources: state.resources.filter(r => r.id !== action.payload)
      };
    case 'UPDATE_ALLOCATION':
      const { macroId, featureId, percentage } = action.payload;
      return {
        ...state,
        macros: state.macros.map(m =>
          m.id === macroId ? { ...m, allocations: { ...m.allocations, [featureId]: percentage } } : m
        )
      };
    case 'UPDATE_FEATURE':
      return {
        ...state,
        features: state.features.map(f => f.id === action.payload.id ? { ...f, ...action.payload } : f)
      };
    case 'ADD_FEATURE':
      const newFeature = {
        outputResources: [], // 确保新功能包含该字段
        physicalResources: [],
        ...action.payload
      };
      return { ...state, features: [...state.features, newFeature] };
    case 'DELETE_FEATURE':
      return {
        ...state,
        features: state.features.filter(f => f.id !== action.payload)
      };
    // Excel 批量替换
    case 'REPLACE_RESOURCES':
      return { ...state, resources: action.payload };
    case 'REPLACE_FEATURES':
      return { ...state, features: action.payload };

    // 兵种库管理
    case 'ADD_UNIT':
      return { ...state, units: [...state.units, action.payload] };
    case 'UPDATE_UNIT':
      return {
        ...state,
        units: state.units.map(u => u.id === action.payload.id ? { ...u, ...action.payload } : u)
      };
    case 'DELETE_UNIT':
      return {
        ...state,
        units: state.units.filter(u => u.id !== action.payload)
      };
    case 'IMPORT_UNITS':
      if (action.replace) {
        return { ...state, units: action.payload };
      }
      // 去重逻辑：按 ID 过滤掉已存在的单位
      const existingIds = new Set(state.units.map(u => u.id));
      const newUniqueUnits = action.payload.filter(u => !existingIds.has(u.id));
      return {
        ...state,
        units: [...state.units, ...newUniqueUnits]
      };
    case 'RESET_UNITS':
      return {
        ...state,
        units: initialState.units
      };
    // 关卡配置管理
    case 'UPDATE_LEVEL_CONFIG':
      return {
        ...state,
        levelConfig: { ...state.levelConfig, ...action.payload }
      };
    default:
      return state;
  }
}

export const GameProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // 初始化：从 localStorage 加载
  useEffect(() => {
    const saved = localStorage.getItem('dev_toolbar_cache');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 合并旧数据以保证兼容性
        dispatch({
          type: 'IMPORT_STATE',
          payload: {
            ...initialState,
            ...parsed,
            units: parsed.units || initialState.units,
            levelConfig: {
              ...initialState.levelConfig,
              ...(parsed.levelConfig || {})
            }
          }
        });
      } catch (e) {
        console.error('Failed to parse cached state');
      }
    }
  }, []);

  // 状态变更时自动保存到 localStorage (免登录基础功能)
  useEffect(() => {
    localStorage.setItem('dev_toolbar_cache', JSON.stringify(state));
  }, [state]);

  // 这里可以添加计算逻辑，例如计算某个功能的总分配预算 (以钻石计)
  const calculateBudget = (featureId, dayRange) => {
    // 简化逻辑：遍历 macro，计算在该天数范围内的总产出 * 分配比
    let totalBudget = 0;
    state.macros.forEach(macro => {
      // 简单相交计算
      const start = Math.max(macro.startDay, dayRange.start);
      const end = Math.min(macro.endDay, dayRange.end);
      if (start <= end) {
        const days = end - start + 1;
        const dailyDiamond = macro.dailyTimeSpent * state.baseSettings.diamondPerTime;
        const allocation = (macro.allocations[featureId] || 0) / 100;
        totalBudget += days * dailyDiamond * allocation;
      }
    });
    return totalBudget;
  };

  return (
    <GameContext.Provider value={{ state, dispatch, calculateBudget }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => useContext(GameContext);
