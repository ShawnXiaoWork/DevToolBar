import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { 
  Book, 
  Settings, 
  PieChart, 
  ShieldCheck,
  Zap,
  TrendingUp,
  UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

import Dictionary from './Dictionary';
import PlayerModel from './PlayerModel';
import FeatureConfig from './FeatureConfig';
import MacroPanel from './MacroPanel';
import Validation from './Validation';

const steps = [
  { id: 'dictionary', title: '1. 资源基石', desc: '资源与价值锚点', icon: Book },
  { id: 'playerModel', title: '2. 玩家模型', desc: '时长与进度设定', icon: UserCircle },
  { id: 'feature', title: '3. 产耗配置', desc: '功能与推演卡片', icon: Settings },
  { id: 'validation', title: '4. 全局审计', desc: '红绿灯预警分析', icon: ShieldCheck },
];

const COLORS = ['#7C4DFF', '#00E5FF', '#00E676', '#FFAB40', '#FF5252'];

const Workbench = () => {
  const { state } = useGame();
  const [activeStep, setActiveStep] = useState('dictionary');

  const renderContent = () => {
    switch(activeStep) {
      case 'dictionary': return <Dictionary />;
      case 'playerModel': return <PlayerModel />;
      case 'feature': return <FeatureConfig />;
      case 'validation': return <Validation />;
      default: return <Dictionary />;
    }
  };

  // 准备宏观分配数据用于图表 (取第一个阶段的数据作为演示)
  const chartData = state.macros[0]?.allocations ? 
    Object.entries(state.macros[0].allocations).map(([id, value]) => ({
      name: state.features.find(f => f.id === id)?.name || id,
      value
    })) : [];

  return (
    <div className="workbench-container">
      {/* 左侧工作流导航 */}
      <div className="workbench-sidebar">
        <div style={{ padding: '0 1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>工作流向导</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>顺序配置以保证数值严密性</p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            return (
              <div 
                key={step.id} 
                className={`workflow-step ${isActive ? 'active' : ''}`}
                onClick={() => setActiveStep(step.id)}
              >
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '8px', 
                  background: isActive ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Icon size={18} color={isActive ? '#fff' : 'var(--text-secondary)'} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 中间主要操作区 */}
      <div className="workbench-main">
        <div className="workbench-content">
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

        {/* 右侧全局监控面板 */}
        <div className="global-monitor">
          <div className="monitor-card">
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} color="var(--accent-primary)" />
              全局经济锚点
            </h3>
            <div className="indicator-grid">
              <div className="indicator-item">
                <div className="indicator-label">基础时间单位</div>
                <div className="indicator-value">{state.baseSettings.timeUnit}</div>
              </div>
              <div className="indicator-item">
                <div className="indicator-label">等价钻石价值</div>
                <div className="indicator-value" style={{ color: 'var(--accent-secondary)' }}>
                  {state.baseSettings.diamondPerTime}
                </div>
              </div>
            </div>
            <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px' }}>
              提示：所有资源产出与消耗，最终都会折算为以钻石衡量的绝对价值。
            </div>
          </div>

          <div className="monitor-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} color="var(--accent-success)" />
              当前阶段宏观分配
            </h3>
            
            <div style={{ flex: 1, minHeight: '150px', marginTop: '1rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
            
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
               {chartData.map((d, i) => (
                 <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                   <span style={{ color: 'var(--text-secondary)'}}>{d.name}: {d.value}%</span>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Workbench;
