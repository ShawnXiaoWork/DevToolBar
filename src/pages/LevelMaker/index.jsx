import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import {
  Users,
  Target,
  BarChart3,
  TrendingUp,
  Sliders,
  Gift
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

// 子模块组件
import UnitLibrary from './components/UnitLibrary';
import BudgetConfig from './components/BudgetConfig';
import RosterPlanning from './components/RosterPlanning';
import DeploymentPlan from './components/DeploymentPlan';
import LevelAnalysis from './components/LevelAnalysis';
import RewardConfig from './components/RewardConfig';

// 自定义 Hooks
import { useLevelPlanning } from './hooks/useLevelPlanning';
import { generateMatrixUnits } from './utils/planningUtils';
import { loadExcelWorkbook } from '../../utils/excelSyncUtils';
import {
  DEFAULT_ROLE_WEIGHTS,
  DEFAULT_ROSTER_TEMPLATES,
  DEFAULT_VALIDATION_CONFIG,
  DEFAULT_DERIVATION_PARAMS,
  DEFAULT_MATRIX_CONFIG
} from '../../config/defaultConfig';

const LevelMaker = () => {
  const { state, dispatch } = useGame();
  const [activeTab, setActiveTab] = useState('units'); 
  
  // 状态下沉管理
  const [previewLevel, setPreviewLevel] = useState(1);
  const [previewRange, setPreviewRange] = useState(200);
  
  const [roleWeights, setRoleWeights] = useState(DEFAULT_ROLE_WEIGHTS);
  const [rosterTemplates, setRosterTemplates] = useState(DEFAULT_ROSTER_TEMPLATES);
  const [activeTemplateId, setActiveTemplateId] = useState('t1');
  const [validationConfig, setValidationConfig] = useState(DEFAULT_VALIDATION_CONFIG);
  const [derivationParams, setDerivationParams] = useState(DEFAULT_DERIVATION_PARAMS);
  const [matrixConfig, setMatrixConfig] = useState(DEFAULT_MATRIX_CONFIG);

  // 动态加载的名字池状态与初始化标志
  const [namesPool, setNamesPool] = useState(null);
  const [namesInitialized, setNamesInitialized] = useState(false);

  // 动态加载 public/names.xlsx 并转换为 namesPool 结构
  React.useEffect(() => {
    async function initNamesPool() {
      try {
        const { fullData } = await loadExcelWorkbook('names.xlsx');
        if (!fullData || fullData.length <= 1) {
          console.warn('names.xlsx is empty or invalid.');
          setNamesInitialized(true);
          return;
        }

        const headers = fullData[0] || [];
        const styleIdx = headers.indexOf('适用兵种');
        const nameIdx = headers.indexOf('中文名');
        const quaIdx = headers.indexOf('品质等级');

        if (styleIdx === -1 || nameIdx === -1 || quaIdx === -1) {
          console.warn('names.xlsx headers mismatch:', headers);
          setNamesInitialized(true);
          return;
        }

        // 品质与兵种类型映射表
        const STYLE_MAP = {
          '步兵': 0, // Infantry
          '远程': 1, // Archer
          '骑兵': 3, // Cavalry
          '枪兵': 4  // Pikeman
        };

        const pool = { 0: {}, 1: {}, 3: {}, 4: {} };

        // 遍历解析数据行 (第一行为表头，从索引 1 开始)
        for (let i = 1; i < fullData.length; i++) {
          const row = fullData[i];
          if (!row || row.length === 0) continue;
          const styleStr = row[styleIdx];
          const name = row[nameIdx];
          const qua = Number(row[quaIdx]);

          if (styleStr && name && !isNaN(qua)) {
            const style = STYLE_MAP[styleStr];
            if (style !== undefined) {
              if (!pool[style][qua]) {
                pool[style][qua] = [];
              }
              pool[style][qua].push(name);
            }
          }
        }

        console.log('Dynamic names pool loaded successfully:', pool);
        setNamesPool(pool);
      } catch (error) {
        console.warn('Failed to load names.xlsx, using default ROLE_NAME_POOLS instead:', error);
      } finally {
        setNamesInitialized(true);
      }
    }

    initNamesPool();
  }, []);

  // 初始启动：如果兵种库为空，待名字池载入完毕后自动生成一版初始数据
  React.useEffect(() => {
    if (namesInitialized && state.units.length === 0) {
      const initialUnits = generateMatrixUnits(matrixConfig, roleWeights, derivationParams, [], namesPool);
      dispatch({ type: 'IMPORT_UNITS', payload: initialUnits, replace: true });
    }
  }, [namesInitialized]);

  // 使用自定义 Hook 进行核心计算
  const { fullLevelPlan, analysisResult } = useLevelPlanning(state, {
    levelConfig: state.levelConfig,
    previewRange,
    activeTemplateId,
    rosterTemplates,
    matrixConfig,
    validationConfig,
    previewLevel
  });

  return (
    <div className="level-maker-container">
      {/* 顶部导航 */}
      <div className="module-tabs">
        <button className={activeTab === 'units' ? 'active' : ''} onClick={() => setActiveTab('units')}>
          <Users size={18} /> 兵种建模库
        </button>
        <button className={activeTab === 'budget' ? 'active' : ''} onClick={() => setActiveTab('budget')}>
          <Target size={18} /> 难度预算配置
        </button>
        <button className={activeTab === 'planning' ? 'active' : ''} onClick={() => setActiveTab('planning')}>
          <Sliders size={18} /> 兵种与阵容规划
        </button>
        <button className={activeTab === 'plan' ? 'active' : ''} onClick={() => setActiveTab('plan')}>
          <TrendingUp size={18} /> 全关卡部署规划
        </button>
        <button className={activeTab === 'analysis' ? 'active' : ''} onClick={() => setActiveTab('analysis')}>
          <BarChart3 size={18} /> 单关模拟分析
        </button>
        <button className={activeTab === 'rewards' ? 'active' : ''} onClick={() => setActiveTab('rewards')}>
          <Gift size={18} /> 关卡资源投放
        </button>
      </div>

      <div className="module-content">
        <AnimatePresence mode="wait">
          {activeTab === 'units' && (
            <UnitLibrary 
              state={state} 
              dispatch={dispatch} 
              roleWeights={roleWeights}
              derivationParams={derivationParams}
            />
          )}
          {activeTab === 'budget' && (
            <BudgetConfig 
              state={state} 
              dispatch={dispatch} 
              previewRange={previewRange} 
              setPreviewRange={setPreviewRange} 
            />
          )}
          {activeTab === 'planning' && (
            <RosterPlanning 
              state={state} 
              dispatch={dispatch}
              roleWeights={roleWeights}
              setRoleWeights={setRoleWeights}
              rosterTemplates={rosterTemplates}
              setRosterTemplates={setRosterTemplates}
              activeTemplateId={activeTemplateId}
              setActiveTemplateId={setActiveTemplateId}
              derivationParams={derivationParams}
              setDerivationParams={setDerivationParams}
              matrixConfig={matrixConfig}
              setMatrixConfig={setMatrixConfig}
              validationConfig={validationConfig}
              setValidationConfig={setValidationConfig}
              namesPool={namesPool}
            />
          )}
          {activeTab === 'plan' && (
            <DeploymentPlan
              fullLevelPlan={fullLevelPlan}
              previewRange={previewRange}
              units={state.units}
              roleWeights={roleWeights}
              derivationParams={derivationParams}
            />
          )}
          {activeTab === 'analysis' && (
            <LevelAnalysis 
              analysisResult={analysisResult} 
              previewLevel={previewLevel} 
              setPreviewLevel={setPreviewLevel} 
            />
          )}
          {activeTab === 'rewards' && (
            <RewardConfig state={state} dispatch={dispatch} />
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .level-maker-container { padding: 2rem; color: var(--text-primary); }
        .module-tabs { display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem; }
        .module-tabs button { background: none; border: none; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; cursor: pointer; transition: all 0.2s; border-radius: 8px; font-weight: 500; }
        .module-tabs button:hover { background: rgba(255,255,255,0.05); color: var(--text-primary); }
        .module-tabs button.active { background: var(--accent-primary); color: white; }
        .action-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        
        /* Plan Row Styles */
        .plan-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .plan-row { display: grid; grid-template-columns: 100px 140px 100px 1fr 100px; align-items: center; padding: 1rem; border-radius: 8px; transition: all 0.2s; }
        .plan-row:hover { background: rgba(255,255,255,0.05); transform: translateX(5px); }
        .plan-row.boss-row { border-left: 4px solid var(--accent-danger); background: rgba(255, 82, 82, 0.05); }
        
        .unit-chip.boss-chip { background: rgba(255, 171, 64, 0.2); border: 1px solid rgba(255, 171, 64, 0.4); color: #FFAB40; }
        .unit-chip.boss-chip .name { font-weight: 800; }
        
        .row-coeffs { display: flex; gap: 1rem; }
        .coeff-item label { display: block; font-size: 0.65rem; color: var(--text-muted); margin-bottom: 2px; }
        .coeff-item span { font-size: 0.85rem; font-weight: bold; color: var(--accent-primary); }
        .row-level .badge { background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; }
        .boss-tag { color: #FF5252; font-weight: bold; font-size: 0.7rem; margin-left: 0.5rem; letter-spacing: 1px; }
        .unit-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .unit-chip { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; display: flex; gap: 0.5rem; }
        .unit-chip .count { color: var(--accent-primary); font-weight: bold; }
        
        /* Modal & Common Glass */
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { width: 100%; max-width: 500px; padding: 2rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2); }
        .input-group { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 0.75rem; border-radius: 8px; color: white; }
        .btn-primary { background: var(--accent-primary); border: none; color: white; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; }
        .btn-outline { background: none; border: 1px solid var(--accent-primary); color: var(--accent-primary); padding: 8px 16px; border-radius: 8px; cursor: pointer; }
        
        /* Dashboard Cards */
        .planning-card { padding: 1.5rem; border-radius: 16px; }
        .analysis-card { padding: 1.5rem; border-radius: 16px; }
        .warning-item { display: flex; gap: 0.75rem; padding: 1rem; border-radius: 10px; font-size: 0.9rem; margin-bottom: 0.5rem; }
        .warning-item.danger { background: rgba(255, 82, 82, 0.1); color: #FF5252; border: 1px solid rgba(255, 82, 82, 0.2); }
        .warning-item.warning { background: rgba(255, 171, 64, 0.1); color: #FFAB40; border: 1px solid rgba(255, 171, 64, 0.2); }
        .warning-item.info { background: rgba(0, 229, 255, 0.1); color: #00E5FF; border: 1px solid rgba(0, 229, 255, 0.2); }
        .warning-item.success { background: rgba(0, 230, 118, 0.1); color: #00E676; border: 1px solid rgba(0, 230, 118, 0.2); }
      `}</style>
    </div>
  );
};

export default LevelMaker;
