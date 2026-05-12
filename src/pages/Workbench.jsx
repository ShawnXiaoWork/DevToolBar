import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { 
  Book, 
  Settings, 
  PieChart, 
  ShieldCheck,
  Zap,
  TrendingUp,
  UserCircle,
  Database,
  ArrowRight,
  RefreshCw,
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

import Dictionary from './Dictionary';
import PlayerModel from './PlayerModel';
import FeatureConfig from './FeatureConfig';
import MacroPanel from './MacroPanel';
import Validation from './Validation';

const modules = [
  { id: 'dictionary', title: '资源基石', desc: '价值锚点与汇率字典', icon: Book, color: '#7C4DFF' },
  { id: 'playerModel', title: '玩家模型', desc: '时长、效率与进度目标', icon: UserCircle, color: '#00E5FF' },
  { id: 'feature', title: '模块产耗', desc: '功能定义与成长推演', icon: Settings, color: '#FFAB40' },
  { id: 'validation', title: '全局审计', desc: '产销平衡与红绿灯分析', icon: ShieldCheck, color: '#FF5252' },
];

const COLORS = ['#7C4DFF', '#00E5FF', '#00E676', '#FFAB40', '#FF5252'];

const Workbench = () => {
  const { state, dispatch } = useGame();
  const [activeStep, setActiveStep] = useState('dashboard'); // 默认进入 Dashboard
  const [loading, setLoading] = useState(false);

  // 全局自动加载逻辑
  const autoLoadAll = async () => {
    setLoading(true);
    try {
      // 1. 加载资源字典
      const { loadExcelWorkbook } = await import('../utils/excelSyncUtils');
      
      // 并行加载所有表
      const results = await Promise.allSettled([
        loadExcelWorkbook('ItemTable.xlsx'),
        loadExcelWorkbook('FunctionUnlockTable.xlsx')
      ]);

      // 处理 ItemTable
      if (results[0].status === 'fulfilled') {
        const { fullData, headers } = results[0].value;
        const idIdx = headers.findIndex(h => h && h.toLowerCase() === 'id');
        const noteIdx = headers.findIndex(h => h && h.toLowerCase() === 'note');
        const nameIdx = headers.findIndex(h => h && h.toLowerCase() === 'name');
        const rateIdx = headers.findIndex(h => h && /standard|rate|price|率|价/i.test(h));
        
        const resources = fullData.slice(4).map(row => {
          if (!row[idIdx]) return null;
          return {
            id: String(row[idIdx]),
            name: row[noteIdx] || row[nameIdx] || `未命名_${row[idIdx]}`,
            langKey: row[nameIdx],
            diamondRate: Number(row[rateIdx] || 1)
          };
        }).filter(Boolean);
        if (resources.length > 0) dispatch({ type: 'REPLACE_RESOURCES', payload: resources });
      }

      // 处理 FunctionUnlockTable
      if (results[1].status === 'fulfilled') {
        const { fullData, headers } = results[1].value;
        const idIdx = headers.findIndex(h => h && h.toLowerCase() === 'id');
        const noteIdx = headers.findIndex(h => h && h.toLowerCase() === 'note');
        const stageIdx = headers.findIndex(h => h && /stage|关卡/i.test(h));
        const dayIdx = headers.findIndex(h => h && /day|天/i.test(h));

        const features = fullData.slice(4).map(row => {
          if (!row[idIdx]) return null;
          return {
            id: String(row[idIdx]),
            name: row[noteIdx] || `模块_${row[idIdx]}`,
            type: 'Core',
            unlockCondition: { 
              type: 'stage', 
              stage: parseInt(row[stageIdx]) || 0,
              day: parseInt(row[dayIdx]) || 0,
              value: (parseInt(row[dayIdx]) || 0) * 1440
            },
            physicalResources: [],
            outputResources: [],
            growthModel: 'linear',
            maxLevel: 10,
            params: { slope: 1 },
            auditParams: { valueCostRatio: 1.0 }
          };
        }).filter(Boolean);
        if (features.length > 0) dispatch({ type: 'REPLACE_FEATURES', payload: features });
      }

      console.log('Global auto-load complete');
    } catch (error) {
      console.warn('Global auto-load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    autoLoadAll();
  }, []);

  const renderContent = () => {
    switch(activeStep) {
      case 'dashboard': return <DashboardView onNavigate={setActiveStep} state={state} />;
      case 'dictionary': return <Dictionary />;
      case 'playerModel': return <PlayerModel />;
      case 'feature': return <FeatureConfig />;
      case 'validation': return <Validation />;
      default: return <DashboardView onNavigate={setActiveStep} state={state} />;
    }
  };

  // 准备宏观分配数据用于图表 (取第一个阶段的数据作为演示)
  const chartData = state.macros[0]?.allocations ? 
    Object.entries(state.macros[0].allocations).map(([k, v]) => ({ name: k, value: v })) : [];

  return (
    <div className="workbench-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* 顶部统一导航栏 */}
      <div style={{ 
        height: '64px', 
        background: 'rgba(20,20,25,0.8)', 
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 2rem',
        justifyContent: 'space-between',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => setActiveStep('dashboard')}>
          <div style={{ background: 'var(--accent-primary)', padding: '6px', borderRadius: '8px' }}>
            <LayoutDashboard size={20} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '1rem', margin: 0 }}>数值工作台</h2>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>已连接: EXTERNAL_SYNC_PATH</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '10px' }}>
          <button 
            onClick={() => setActiveStep('dashboard')}
            className={`nav-item ${activeStep === 'dashboard' ? 'active' : ''}`}
            style={{ padding: '6px 16px', borderRadius: '8px', border: 'none', background: activeStep === 'dashboard' ? 'rgba(124,77,255,0.2)' : 'transparent', color: activeStep === 'dashboard' ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
          >
            全盘视图
          </button>
          {modules.map(m => (
            <button 
              key={m.id}
              onClick={() => setActiveStep(m.id)}
              className={`nav-item ${activeStep === m.id ? 'active' : ''}`}
              style={{ padding: '6px 16px', borderRadius: '8px', border: 'none', background: activeStep === m.id ? 'rgba(124,77,255,0.2)' : 'transparent', color: activeStep === m.id ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              {m.title}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {loading && <div className="loading-spinner-small" />}
          <button className="btn-secondary" onClick={autoLoadAll} title="从本地重新加载全部配置">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', background: 'var(--bg-color)' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

/** 全盘视图组件 */
const DashboardView = ({ onNavigate, state }) => {
  const milestones = [1, 3, 7, 30];
  
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="glow-text" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>经济推演大盘</h1>
        <p style={{ color: 'var(--text-secondary)' }}>实时监控系统产销平衡、玩家进度与资源价值流转</p>
      </div>

      {/* 模块快捷入口网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        {modules.map(m => (
          <div 
            key={m.id} 
            className="glass-panel interactive-card" 
            onClick={() => onNavigate(m.id)}
            style={{ padding: '1.5rem', cursor: 'pointer', borderTop: `4px solid ${m.color}`, transition: 'transform 0.2s' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ background: `${m.color}20`, padding: '10px', borderRadius: '12px' }}>
                <m.icon size={24} color={m.color} />
              </div>
              <ArrowRight size={18} color="var(--text-muted)" />
            </div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{m.title}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>{m.desc}</p>
          </div>
        ))}
      </div>

      {/* 核心推演流转图 (Progression Flow) */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem' }}>
        <h3 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TrendingUp size={20} color="var(--accent-primary)" />
          玩家进度与产销价值流 (Milestone Audit)
        </h3>
        
        <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem' }}>
          {milestones.map((day, idx) => {
            const milestoneKey = `day${day}`;
            const target = state.playerModel.milestones[milestoneKey];
            return (
              <React.Fragment key={day}>
                <div style={{ flex: 1, minWidth: '220px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--accent-secondary)' }}>第 {day} 天</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lv.{target?.targetLevel || 0}</span>
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>价值缺口</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{target?.targetValueGap || 0} <span style={{ fontSize: '0.8rem' }}>💎</span></div>
                  </div>

                  <div style={{ fontSize: '0.75rem', background: 'rgba(124,77,255,0.1)', padding: '8px', borderRadius: '6px' }}>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>已配置规划:</div>
                    {target?.progressionTargets?.length || 0} 个模块
                  </div>
                </div>
                {idx < milestones.length - 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.1)' }}>
                    <ArrowRight size={24} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 底部摘要区 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
           <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>全局资源基石</h4>
           <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {state.resources.slice(0, 8).map(res => (
                <div key={res.id} style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {res.name}: {res.diamondRate}
                </div>
              ))}
              {state.resources.length > 8 && <div style={{ fontSize: '0.75rem', padding: '4px' }}>...等 {state.resources.length} 项</div>}
           </div>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
           <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>活跃模块总览</h4>
           <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {state.features.map(f => (
                <div key={f.id} style={{ padding: '4px 10px', background: f.type === 'Core' ? 'rgba(124,77,255,0.1)' : 'rgba(0,229,255,0.1)', borderRadius: '6px', fontSize: '0.75rem', color: f.type === 'Core' ? 'var(--accent-primary)' : 'var(--accent-secondary)' }}>
                  {f.name}
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Workbench;
