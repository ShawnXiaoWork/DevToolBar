import React from 'react';
import { useGame } from '../context/GameContext';

const MacroPanel = () => {
  const { state, dispatch } = useGame();

  const handleAllocationChange = (macroId, featureId, value) => {
    dispatch({ 
      type: 'UPDATE_ALLOCATION', 
      payload: { macroId, featureId, percentage: Number(value) } 
    });
  };

  return (
    <div className="macro-container">
      {state.macros.map(macro => (
        <div key={macro.id} className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="glow-text">{macro.stageName} ({macro.startDay} - {macro.endDay} 天)</h2>
            <div style={{ color: 'var(--accent-secondary)' }}>
              日产出价值: {macro.dailyTimeSpent * state.baseSettings.diamondPerTime} 钻石
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h3>资源分配占比</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {state.features.map(feat => (
                <div key={feat.id} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ width: '120px' }}>{feat.name}</div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={macro.allocations[feat.id] || 0}
                    onChange={(e) => handleAllocationChange(macro.id, feat.id, e.target.value)}
                    style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
                  />
                  <div style={{ width: '50px', textAlign: 'right' }}>{macro.allocations[feat.id] || 0}%</div>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              提示: 当前阶段总计可分配资源价值为 {(macro.endDay - macro.startDay + 1) * macro.dailyTimeSpent * state.baseSettings.diamondPerTime} 钻石。
            </p>
          </div>
        </div>
      ))}
      <button className="btn-primary">添加新的生命周期阶段</button>
    </div>
  );
};

export default MacroPanel;
