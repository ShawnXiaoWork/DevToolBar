import React, { createContext, useContext, useReducer, useEffect } from 'react';

const GameContext = createContext();

const initialState = {
  projectName: "未命名项目",
  gameType: "roguelike",
  // 1 游戏单位时间 (例如 1小时) = X 钻石
  baseSettings: {
    diamondPerTime: 100,
    timeUnit: "小时"
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
      physicalResources: [
        { resourceId: 'res_dust', weight: 100 } // 100% 消耗粉尘
      ],
      growthModel: 'exponential',
      maxLevel: 20,
      params: { base: 1.1 }
    },
    {
      id: 'feat_hero',
      name: '英雄升级',
      physicalResources: [
        { resourceId: 'res_gold', weight: 80 },
        { resourceId: 'res_soul', weight: 20 }
      ],
      growthModel: 'linear',
      maxLevel: 50,
      params: { slope: 10 }
    }
  ],
  // 兵种库 (游戏制作辅助)
  units: [
    { 
      id: 'unit_warrior', 
      name: '近战士兵', 
      hp: 100, atk: 15, spd: 10, skillPower: 0, 
      roles: ['前排坦克'], 
      counters: ['远程输出'],
      spawnWeight: 50 
    },
    { 
      id: 'unit_archer', 
      name: '精英弓箭手', 
      hp: 60, atk: 25, spd: 15, skillPower: 10, 
      roles: ['远程输出'], 
      counters: ['召唤者'],
      spawnWeight: 20 
    }
  ],
  // 关卡平衡配置
  levelConfig: {
    baseScore: 100,
    difficultyFactor: 1.2,
    spikes: [
      { level: 10, hpMultiplier: 1.2, atkMultiplier: 1.3, type: 'peak', note: '小 Boss' },
      { level: 20, hpMultiplier: 1.5, atkMultiplier: 1.5, type: 'peak', note: '大 Boss' }
    ]
  }
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'IMPORT_STATE':
      return { ...initialState, ...action.payload };
    case 'UPDATE_PROJECT_NAME':
      return { ...state, projectName: action.payload };
    case 'UPDATE_BASE_SETTINGS':
      return { ...state, baseSettings: { ...state.baseSettings, ...action.payload } };
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
      return {
        ...state,
        units: [...state.units, ...action.payload]
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
            levelConfig: parsed.levelConfig || initialState.levelConfig
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
