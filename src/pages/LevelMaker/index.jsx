import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import {
  Users,
  Target,
  BarChart3,
  TrendingUp,
  Sliders
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

// 子模块组件
import UnitLibrary from './components/UnitLibrary';
import BudgetConfig from './components/BudgetConfig';
import RosterPlanning from './components/RosterPlanning';
import DeploymentPlan from './components/DeploymentPlan';
import LevelAnalysis from './components/LevelAnalysis';

// 自定义 Hooks
import { useLevelPlanning } from './hooks/useLevelPlanning';
import { generateMatrixUnits } from './utils/planningUtils';

const LevelMaker = () => {
  const { state, dispatch } = useGame();
  const [activeTab, setActiveTab] = useState('units'); 
  
  // 状态下沉管理
  const [previewLevel, setPreviewLevel] = useState(1);
  const [previewRange, setPreviewRange] = useState(200);
  
  const [roleWeights, setRoleWeights] = useState({
    0: { hp: 1.6, atk: 0.4, cc: 0, atkSpeed: 0.8, atkRange: 100, detRange: 200 },
    1: { hp: 1.0, atk: 1.0, cc: 0, atkSpeed: 1.2, atkRange: 100, detRange: 200 },
    2: { hp: 0.5, atk: 1.5, cc: 0, atkSpeed: 2.0, atkRange: 600, detRange: 700 },
    3: { hp: 0.7, atk: 0.6, cc: 0.7, atkSpeed: 1.5, atkRange: 400, detRange: 500 }
  });

  const [rosterTemplates, setRosterTemplates] = useState([
    { id: 't1', name: '均衡阵型', 0: 0.2, 1: 0.3, 2: 0.4, 3: 0.1 },
    { id: 't2', name: '高压阵型', 0: 0.1, 1: 0.0, 2: 0.8, 3: 0.1 },
    { id: 't3', name: '绞肉机阵型', 0: 0.0, 1: 0.7, 2: 0.0, 3: 0.3 }
  ]);

  const [activeTemplateId, setActiveTemplateId] = useState('t1');

  const [validationConfig, setValidationConfig] = useState({
    expectedDPS: 100,
    targetDuration: 60,
    maxDensity: 50,
    minDensity: 3
  });

  const [derivationParams, setDerivationParams] = useState({
    baseHp: 50,
    baseAtk: 20,
    baseSpd: 75,
    baseSkillPower: 0,
    targetRole: 0,
    unitName: '衍生单位'
  });

  const [matrixConfig, setMatrixConfig] = useState({
    totalLevels: 200,
    updateFrequency: 5,
    randomness: 0.2,
    roleDistribution: { 0: 0.2, 1: 0.25, 2: 0.4, 3: 0.15 },
    bossFrequency: 5,
    minBossPerLevel: 2
  });

  // 初始启动：如果兵种库为空，自动生成一版数据
  React.useEffect(() => {
    if (state.units.length === 0) {
      const initialUnits = generateMatrixUnits(matrixConfig, roleWeights, derivationParams, []);
      dispatch({ type: 'IMPORT_UNITS', payload: initialUnits, replace: true });
    }
  }, []);

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
            />
          )}
          {activeTab === 'plan' && <DeploymentPlan fullLevelPlan={fullLevelPlan} previewRange={previewRange} />}
          {activeTab === 'analysis' && (
            <LevelAnalysis 
              analysisResult={analysisResult} 
              previewLevel={previewLevel} 
              setPreviewLevel={setPreviewLevel} 
            />
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
