import React from 'react';
import { useGame } from '../context/GameContext';
import { PieChart, TrendingUp, AlertCircle } from 'lucide-react';

const FeatureConfig = () => {
  const { state } = useGame();

  // Helper to get allocation info for a feature
  const getAllocationInfo = (featureId) => {
    // Just looking at the first macro stage for simplicity in this demo
    const macro = state.macros[0];
    if (!macro) return null;
    const percentage = macro.allocations[featureId] || 0;
    return { stageName: macro.stageName, percentage };
  };

  return (
    <div className="feature-config-container">
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="glow-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>模块定义</h1>
          <p style={{ color: 'var(--text-secondary)' }}>配置游戏核心系统模块及其资源消耗逻辑</p>
        </div>
        <button className="btn-primary">创建新功能模块</button>
      </div>

      {state.resources.length === 0 && (
        <div style={{ padding: '1rem', background: 'rgba(255, 82, 82, 0.1)', border: '1px solid var(--accent-danger)', borderRadius: '8px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <AlertCircle color="var(--accent-danger)" />
          <span>尚未配置任何基础资源字典！请先返回“基础字典”步骤添加资源。</span>
        </div>
      )}

      {state.features.map(feat => {
        const allocInfo = getAllocationInfo(feat.id);
        
        return (
          <div key={feat.id} className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 className="glow-text" style={{ fontSize: '1.5rem' }}>{feat.name}</h2>
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={14} /> 上限等级: {feat.maxLevel}
                  </span>
                  {allocInfo && (
                    <span style={{ color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <PieChart size={14} /> 宏观分配: {allocInfo.percentage}% ({allocInfo.stageName})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1.5rem' }}>
              {/* 资源挂钩 */}
              <div className="config-section">
                <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>资源权重分配</h3>
                <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                  {feat.physicalResources.length > 0 ? feat.physicalResources.map(pr => {
                    const resource = state.resources.find(r => r.id === pr.resourceId);
                    return (
                      <div key={pr.resourceId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                        <span>{resource?.name || '未知资源'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '60%' }}>
                          <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${pr.weight}%`, height: '100%', background: 'var(--accent-primary)' }} />
                          </div>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', width: '40px', textAlign: 'right' }}>{pr.weight}%</span>
                        </div>
                      </div>
                    );
                  }) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>尚未挂钩任何资源</div>
                  )}
                </div>
                <button className="btn-secondary" style={{ width: '100%', marginTop: '1rem', padding: '8px', fontSize: '0.9rem' }}>调整资源挂钩</button>
              </div>

              {/* 数学模型 */}
              <div className="config-section">
                <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>成长模型曲线</h3>
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)' }}>模型类型</label>
                  <select 
                    value={feat.growthModel}
                    onChange={() => {}}
                    style={{ width: '100%', background: 'var(--card-bg)', border: 'var(--glass-border)', color: 'white', padding: '0.6rem', borderRadius: '4px', marginTop: '0.4rem' }}
                  >
                    <option value="linear">线性增长 (Linear)</option>
                    <option value="exponential">指数增长 (Exponential)</option>
                    <option value="logarithmic">对数增长 (Logarithmic)</option>
                    <option value="power">幂函数 (Power)</option>
                  </select>
                  
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)' }}>平滑/底数系数</label>
                    <input 
                      type="number" 
                      value={feat.params.base || feat.params.slope || 1}
                      onChange={() => {}}
                      style={{ width: '100%', background: 'var(--card-bg)', border: 'var(--glass-border)', color: 'white', padding: '0.6rem', borderRadius: '4px', marginTop: '0.4rem' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FeatureConfig;
