import React, { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';

const Validation = () => {
  const { state, calculateBudget } = useGame();
  const [targetFeatureId, setTargetFeatureId] = useState(state.features[0]?.id || '');
  const [targetLevel, setTargetLevel] = useState(20);
  const [targetDays, setTargetDays] = useState(7);

  // 计算该时间段内的宏观预算
  const macroBudget = useMemo(() => {
    return calculateBudget(targetFeatureId, { start: 1, end: targetDays });
  }, [targetFeatureId, targetDays, calculateBudget]);

  // 模拟计算每级消耗 (简单平摊，实际会根据模型计算)
  const costPerLevel = targetLevel > 0 ? (macroBudget / targetLevel).toFixed(2) : 0;

  const targetFeature = state.features.find(f => f.id === targetFeatureId);

  return (
    <div className="validation-container">
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h2 className="glow-text">微观目标推演</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginTop: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>选择目标系统</label>
            <select 
              value={targetFeatureId}
              onChange={(e) => setTargetFeatureId(e.target.value)}
              style={{ width: '100%', background: 'var(--card-bg)', border: 'var(--glass-border)', color: 'white', padding: '0.6rem', borderRadius: '4px' }}
            >
              {state.features.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>目标等级</label>
            <input 
              type="number" 
              value={targetLevel}
              onChange={(e) => setTargetLevel(Number(e.target.value))}
              style={{ width: '100%', background: 'var(--card-bg)', border: 'var(--glass-border)', color: 'white', padding: '0.6rem', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>达成天数 (1 - X)</label>
            <input 
              type="number" 
              value={targetDays}
              onChange={(e) => setTargetDays(Number(e.target.value))}
              style={{ width: '100%', background: 'var(--card-bg)', border: 'var(--glass-border)', color: 'white', padding: '0.6rem', borderRadius: '4px' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3>宏观预算验证</h3>
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-secondary)' }}>
              {macroBudget} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>钻石</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>这是在前 {targetDays} 天分配给该功能的总价值。</p>
          </div>
          
          <div style={{ marginTop: '2rem', padding: '1rem', borderLeft: '4px solid var(--accent-primary)', background: 'rgba(124, 77, 255, 0.05)' }}>
            <strong>平均每级价值: {costPerLevel} 钻石</strong>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3>物理资源落地推演</h3>
          <div style={{ marginTop: '1.5rem' }}>
            {targetFeature?.physicalResources.map(pr => {
              const res = state.resources.find(r => r.id === pr.resourceId);
              const physicalAmount = res ? ((macroBudget * (pr.weight / 100)) / res.diamondRate).toFixed(0) : 0;
              return (
                <div key={pr.resourceId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div style={{ fontWeight: '500' }}>{res?.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>权重: {pr.weight}%</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--accent-success)', fontSize: '1.2rem', fontWeight: 'bold' }}>{physicalAmount}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>总需求量</div>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>生成详细数值表 (Excel 导出)</button>
        </div>
      </div>
    </div>
  );
};

export default Validation;
