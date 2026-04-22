import React from 'react';
import { useGame } from '../context/GameContext';
import { Clock, Target, Activity, Edit3 } from 'lucide-react';

const PlayerModel = () => {
  const { state, dispatch } = useGame();
  const { playerModel } = state;

  const handleTimeChange = (e) => {
    dispatch({ type: 'UPDATE_PLAYER_MODEL', payload: { dailyTime: parseInt(e.target.value) || 0 } });
  };

  const handleEfficiencyChange = (val) => {
    dispatch({ type: 'UPDATE_PLAYER_MODEL', payload: { efficiency: val } });
  };

  const handleMilestoneChange = (day, field, value) => {
    dispatch({
      type: 'UPDATE_MILESTONE',
      payload: {
        day,
        data: { ...playerModel.milestones[day], [field]: parseInt(value) || 0 }
      }
    });
  };

  return (
    <div className="panel-container">
      <div className="panel-header">
        <h2 className="panel-title">玩家模型 (Standard User Model)</h2>
        <div className="panel-desc">定义基准玩家的投入时间、进度目标与活跃度，作为全局推演的“环境法则”。</div>
      </div>

      <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* 核心设定区 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          
          {/* 时长设定 */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} color="var(--accent-primary)" />
              预期时长上限 (Time Budget)
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>每日总在线时长 (分钟)</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    value={playerModel.dailyTime} 
                    onChange={handleTimeChange}
                    className="feature-input"
                    style={{ fontSize: '1.5rem', padding: '0.75rem', fontWeight: 'bold' }}
                  />
                  <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>min</span>
                </div>
              </div>
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              此参数将决定所有“随时间产出”类型功能的收益上限。
            </p>
          </div>

          {/* 活跃度设定 */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={20} color="var(--accent-success)" />
              活跃分层 (Efficiency)
            </h3>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              {[
                { label: '咸鱼型', value: 0.6, color: '#9e9e9e' },
                { label: '标准型', value: 1.0, color: 'var(--accent-primary)' },
                { label: '肝帝型', value: 1.2, color: '#ff9800' }
              ].map(opt => (
                <button
                  key={opt.label}
                  onClick={() => handleEfficiencyChange(opt.value)}
                  style={{
                    flex: 1,
                    padding: '1rem 0.5rem',
                    background: playerModel.efficiency === opt.value ? `${opt.color}20` : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${playerModel.efficiency === opt.value ? opt.color : 'transparent'}`,
                    borderRadius: '8px',
                    color: playerModel.efficiency === opt.value ? opt.color : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>{opt.label}</span>
                  <span style={{ fontSize: '0.8rem' }}>产出 {opt.value}x</span>
                </button>
              ))}
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              切换不同模式，可在一键在后续的【全局审计】中查重度/轻度玩家的资源缺口。
            </p>
          </div>
        </div>

        {/* 进度阶梯设定 */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target size={20} color="var(--accent-secondary)" />
            预期进度阶梯 (Progress Milestones)
          </h3>
          <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            为关键天数设定预期达到的“目标关卡”，并预估为达到该阶段所需要的**金本位资源总价值 (钻石)**。
          </p>

          <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
            {['day1', 'day3', 'day7', 'day30'].map((dayKey, index) => {
              const dayNum = dayKey.replace('day', '');
              const data = playerModel.milestones[dayKey];
              return (
                <div key={dayKey} style={{ 
                  flex: 1, 
                  minWidth: '200px', 
                  background: 'rgba(0,0,0,0.2)', 
                  borderRadius: '12px',
                  padding: '1.25rem',
                  borderTop: `4px solid ${['#00E5FF', '#00E676', '#FFAB40', '#FF5252'][index]}`
                }}>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    第 {dayNum} 天
                  </h4>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span>目标关卡</span>
                      <Edit3 size={14} />
                    </label>
                    <input 
                      type="number" 
                      value={data.targetLevel}
                      onChange={(e) => handleMilestoneChange(dayKey, 'targetLevel', e.target.value)}
                      className="feature-input"
                      style={{ padding: '0.5rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span>价值缺口 (钻石)</span>
                      <Edit3 size={14} />
                    </label>
                    <input 
                      type="number" 
                      value={data.targetValueGap}
                      onChange={(e) => handleMilestoneChange(dayKey, 'targetValueGap', e.target.value)}
                      className="feature-input"
                      style={{ padding: '0.5rem', color: 'var(--accent-secondary)' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PlayerModel;
