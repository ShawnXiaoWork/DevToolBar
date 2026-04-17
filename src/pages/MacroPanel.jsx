import React from 'react';
import { useGame } from '../context/GameContext';
import { AlertCircle } from 'lucide-react';

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
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="glow-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>宏观分配</h1>
          <p style={{ color: 'var(--text-secondary)' }}>定义游戏不同生命周期阶段的资源产出与分配权重</p>
        </div>
        <button className="btn-primary">添加新的生命周期阶段</button>
      </div>

      {state.macros.map(macro => {
        // Calculate total allocation percentage
        const totalAllocation = Object.values(macro.allocations || {}).reduce((sum, val) => sum + Number(val), 0);
        const isOverAllocated = totalAllocation > 100;

        return (
          <div key={macro.id} className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', border: isOverAllocated ? '1px solid var(--accent-danger)' : 'var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="glow-text" style={{ fontSize: '1.5rem' }}>{macro.stageName} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>({macro.startDay} - {macro.endDay} 天)</span></h2>
              <div style={{ color: 'var(--accent-secondary)', fontWeight: 'bold' }}>
                日产出价值: {macro.dailyTimeSpent * state.baseSettings.diamondPerTime} 💎
              </div>
            </div>

            {isOverAllocated && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255, 82, 82, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-danger)', fontSize: '0.9rem' }}>
                <AlertCircle size={16} /> 警告：总分配占比({totalAllocation}%)已超过100%，请调低某些功能的权重以保持经济平衡。
              </div>
            )}

            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>功能资源分配占比</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
                {state.features.map(feat => (
                  <div key={feat.id} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ width: '120px', fontWeight: '500' }}>{feat.name}</div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={macro.allocations[feat.id] || 0}
                        onChange={(e) => handleAllocationChange(macro.id, feat.id, e.target.value)}
                        style={{ flex: 1, accentColor: isOverAllocated ? 'var(--accent-danger)' : 'var(--accent-primary)' }}
                      />
                      <div style={{ width: '50px', textAlign: 'right', fontWeight: 'bold', color: (macro.allocations[feat.id] || 0) > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {macro.allocations[feat.id] || 0}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: '3px solid var(--accent-secondary)' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <strong>阶段总预算:</strong> 当前阶段(共{macro.endDay - macro.startDay + 1}天)总计可分配资源价值为 
                <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold', margin: '0 4px' }}>
                  {(macro.endDay - macro.startDay + 1) * macro.dailyTimeSpent * state.baseSettings.diamondPerTime} 
                </span>
                钻石当量。
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MacroPanel;
