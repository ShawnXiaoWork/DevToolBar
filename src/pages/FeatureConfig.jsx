import React from 'react';
import { useGame } from '../context/GameContext';

const FeatureConfig = () => {
  const { state } = useGame();

  return (
    <div className="feature-config-container">
      {state.features.map(feat => (
        <div key={feat.id} className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="glow-text">{feat.name}</h2>
            <div style={{ fontSize: '0.9rem', color: 'var(--accent-success)' }}>
              上限等级: {feat.maxLevel}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1.5rem' }}>
            {/* 资源挂钩 */}
            <div className="config-section">
              <h3>资源权重分配</h3>
              <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px' }}>
                {feat.physicalResources.map(pr => {
                  const resource = state.resources.find(r => r.id === pr.resourceId);
                  return (
                    <div key={pr.resourceId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span>{resource?.name || '未知资源'}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{pr.weight}%</span>
                    </div>
                  );
                })}
              </div>
              <button className="btn-secondary" style={{ width: '100%', marginTop: '1rem', padding: '8px' }}>调整资源挂钩</button>
            </div>

            {/* 数学模型 */}
            <div className="config-section">
              <h3>成长模型曲线</h3>
              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)' }}>模型类型</label>
                <select 
                  value={feat.growthModel}
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
                    style={{ width: '100%', background: 'var(--card-bg)', border: 'var(--glass-border)', color: 'white', padding: '0.6rem', borderRadius: '4px', marginTop: '0.4rem' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      <button className="btn-primary">创建新功能模块</button>
    </div>
  );
};

export default FeatureConfig;
