import React from 'react';
import { TrendingUp, Zap, Plus, Trash2 } from 'lucide-react';

const SpikeConfig = ({ levelConfig, previewRange, onUpdate, onAutoGenerate, onAddManual }) => {
  return (
    <div className="spikes-section" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-warning)' }}>
          <TrendingUp size={16} /> 难度越迁 (Difficulty Spikes)
        </h4>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={onAutoGenerate}>
            <Zap size={14} /> 自动生成章节模型
          </button>
          <button className="btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={onAddManual}>
            <Plus size={14} /> 添加手动点
          </button>
        </div>
      </div>

      <div className="spikes-list">
        {(levelConfig.spikes || []).map((spike, idx) => (
          <div key={idx} className="spike-row glass" style={{ display: 'flex', gap: '1rem', padding: '1rem', borderRadius: '8px', marginBottom: '0.5rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>关卡层级</label>
              <input
                type="number"
                value={spike.level}
                onChange={(e) => {
                  const newSpikes = [...levelConfig.spikes];
                  newSpikes[idx].level = Number(e.target.value);
                  onUpdate(newSpikes);
                }}
                style={{ width: '100%', padding: '4px', marginTop: '4px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>血量倍率 (HP)</label>
              <input
                type="number"
                step="0.1"
                value={spike.hpMultiplier || 1}
                onChange={(e) => {
                  const newSpikes = [...levelConfig.spikes];
                  newSpikes[idx].hpMultiplier = Number(e.target.value);
                  onUpdate(newSpikes);
                }}
                style={{ width: '100%', padding: '4px', marginTop: '4px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>攻击倍率 (ATK)</label>
              <input
                type="number"
                step="0.1"
                value={spike.atkMultiplier || 1}
                onChange={(e) => {
                  const newSpikes = [...levelConfig.spikes];
                  newSpikes[idx].atkMultiplier = Number(e.target.value);
                  onUpdate(newSpikes);
                }}
                style={{ width: '100%', padding: '4px', marginTop: '4px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>类型</label>
              <select
                value={spike.type || 'peak'}
                onChange={(e) => {
                  const newSpikes = [...levelConfig.spikes];
                  newSpikes[idx].type = e.target.value;
                  onUpdate(newSpikes);
                }}
                style={{ width: '100%', padding: '4px', marginTop: '4px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
              >
                <option value="peak">峰值 (Boss)</option>
                <option value="step">台阶 (Tier)</option>
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>备注</label>
              <input
                type="text"
                value={spike.note}
                onChange={(e) => {
                  const newSpikes = [...levelConfig.spikes];
                  newSpikes[idx].note = e.target.value;
                  onUpdate(newSpikes);
                }}
                style={{ width: '100%', padding: '4px', marginTop: '4px' }}
              />
            </div>
            <button className="delete" style={{ padding: '8px', background: 'none', border: 'none', color: '#FF5252', cursor: 'pointer' }} onClick={() => {
              const newSpikes = levelConfig.spikes.filter((_, i) => i !== idx);
              onUpdate(newSpikes);
            }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {(levelConfig.spikes || []).length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>暂未设置越迁关卡，难度将平滑增长。</p>
        )}
      </div>
    </div>
  );
};

export default SpikeConfig;
