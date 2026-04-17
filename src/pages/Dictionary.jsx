import React from 'react';
import { useGame } from '../context/GameContext';

const Dictionary = () => {
  const { state, dispatch } = useGame();

  const handleBaseChange = (field, value) => {
    dispatch({ type: 'UPDATE_BASE_SETTINGS', payload: { [field]: value } });
  };

  return (
    <div className="dictionary-container">
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h2 className="glow-text">本位币与时间价值</h2>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '2rem' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>时间单位</label>
            <input 
              type="text" 
              value={state.baseSettings.timeUnit}
              onChange={(e) => handleBaseChange('timeUnit', e.target.value)}
              style={{ background: 'var(--card-bg)', border: 'var(--glass-border)', color: 'white', padding: '0.5rem', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>每单位时间价值 (钻石)</label>
            <input 
              type="number" 
              value={state.baseSettings.diamondPerTime}
              onChange={(e) => handleBaseChange('diamondPerTime', Number(e.target.value))}
              style={{ background: 'var(--card-bg)', border: 'var(--glass-border)', color: 'white', padding: '0.5rem', borderRadius: '4px' }}
            />
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 className="glow-text">资源字典与汇率</h2>
        <table style={{ width: '100%', marginTop: '1.5rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem' }}>资源名称</th>
              <th style={{ padding: '1rem' }}>对钻石汇率 (1 资源 = X 钻石)</th>
              <th style={{ padding: '1rem' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {state.resources.map(res => (
              <tr key={res.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1rem' }}>{res.name}</td>
                <td style={{ padding: '1rem' }}>{res.diamondRate}</td>
                <td style={{ padding: '1rem' }}><button className="btn-secondary" style={{ padding: '4px 12px' }}>编辑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn-primary" style={{ marginTop: '1.5rem' }}>添加新资源</button>
      </div>
    </div>
  );
};

export default Dictionary;
