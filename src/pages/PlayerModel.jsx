import React from 'react';
import { useGame } from '../context/GameContext';
import { Clock, Target, Activity, Edit3, Plus, Trash2, ChevronRight } from 'lucide-react';
import { calculateCumulativeCost } from '../services/mathUtils';

const PlayerModel = () => {
  const { state, dispatch } = useGame();
  const { playerModel, features } = state;

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

  const addProgressionTarget = (day) => {
    const availableFeature = features.find(f => f.physicalResources.length > 0);
    if (!availableFeature) return;

    const newTarget = {
      id: `target_${Date.now()}`,
      featureId: availableFeature.id,
      targetLevel: 10
    };

    const currentTargets = playerModel.milestones[day].progressionTargets || [];
    dispatch({
      type: 'UPDATE_MILESTONE_TARGETS',
      payload: { day, targets: [...currentTargets, newTarget] }
    });
  };

  const removeProgressionTarget = (day, targetId) => {
    const currentTargets = playerModel.milestones[day].progressionTargets || [];
    dispatch({
      type: 'UPDATE_MILESTONE_TARGETS',
      payload: { day, targets: currentTargets.filter(t => t.id !== targetId) }
    });
  };

  const updateTarget = (day, targetId, updates) => {
    const currentTargets = playerModel.milestones[day].progressionTargets || [];
    dispatch({
      type: 'UPDATE_MILESTONE_TARGETS',
      payload: { 
        day, 
        targets: currentTargets.map(t => t.id === targetId ? { ...t, ...updates } : t) 
      }
    });
  };

  // 计算单个目标的钻石价值
  const getTargetValue = (featureId, targetLevel) => {
    const feat = features.find(f => f.id === featureId);
    if (!feat) return 0;
    
    // 计算累积消耗
    const rawCost = calculateCumulativeCost(feat.growthModel, feat.params, targetLevel);
    // 乘以价值转换比 (auditParams.valueCostRatio)
    return rawCost * (feat.auditParams?.valueCostRatio || 1);
  };

  return (
    <div className="panel-container">
      <div className="panel-header">
        <h2 className="panel-title">标准玩家模型 (Standard User Model)</h2>
        <div className="panel-desc">定义基准玩家的投入时间与养成路径，系统将基于功能等级自动推导“刚性缺口”。</div>
      </div>

      <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* 1. 投入与效率设定 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={20} color="var(--accent-success)" />
              活跃分层 (Efficiency)
            </h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {[
                { label: '咸鱼', value: 0.6, color: '#9e9e9e' },
                { label: '标准', value: 1.0, color: 'var(--accent-primary)' },
                { label: '肝帝', value: 1.2, color: '#ff9800' }
              ].map(opt => (
                <button
                  key={opt.label}
                  onClick={() => handleEfficiencyChange(opt.value)}
                  style={{
                    flex: 1, padding: '0.8rem 0.5rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                    background: playerModel.efficiency === opt.value ? `${opt.color}20` : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${playerModel.efficiency === opt.value ? opt.color : 'transparent'}`,
                    color: playerModel.efficiency === opt.value ? opt.color : 'var(--text-secondary)',
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.75rem' }}>{opt.value}x</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. 养成路径设定 (Progression Path) */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target size={24} color="var(--accent-secondary)" />
            里程碑养成路径 (Progression Milestones)
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {['day1', 'day3', 'day7', 'day30'].map((dayKey, idx) => {
              const data = playerModel.milestones[dayKey];
              const targets = data.progressionTargets || [];
              
              // 计算此里程碑的总计算价值
              const calculatedTotal = targets.reduce((sum, t) => sum + getTargetValue(t.featureId, t.targetLevel), 0);
              
              return (
                <div key={dayKey} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                         <div style={{ padding: '0.5rem 1rem', background: 'var(--accent-secondary)', color: 'black', fontWeight: 'bold', borderRadius: '4px' }}>
                           D{dayKey.replace('day', '')}
                         </div>
                         <div>
                            <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>阶段预期目标</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>定义玩家在此节点应达到的系统进度</div>
                         </div>
                      </div>
                      
                      {/* 自动推演的结果 */}
                      <div style={{ textAlign: 'right' }}>
                         <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>推演刚性价值 (折合)</div>
                         <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-secondary)' }}>
                           {calculatedTotal.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>💎</span>
                         </div>
                      </div>
                   </div>

                   {/* 目标列表 */}
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                      {targets.map(target => {
                         const feat = features.find(f => f.id === target.featureId);
                         const val = getTargetValue(target.featureId, target.targetLevel);
                         return (
                           <div key={target.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                                 <select 
                                    className="feature-input" 
                                    style={{ background: 'none', border: 'none', width: 'auto', fontWeight: 'bold' }}
                                    value={target.featureId}
                                    onChange={(e) => updateTarget(dayKey, target.id, { featureId: e.target.value })}
                                  >
                                    {features.filter(f => f.physicalResources.length > 0).map(f => (
                                      <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                 </select>
                                 <button onClick={() => removeProgressionTarget(dayKey, target.id)} style={{ color: 'var(--accent-danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <Trash2 size={14} />
                                 </button>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                 <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>目标等级</label>
                                    <input 
                                      type="number"
                                      value={target.targetLevel}
                                      onChange={(e) => updateTarget(dayKey, target.id, { targetLevel: parseInt(e.target.value) || 0 })}
                                      className="feature-input"
                                      style={{ padding: '2px 4px', fontSize: '1rem' }}
                                    />
                                 </div>
                                 <ChevronRight size={16} color="var(--text-muted)" />
                                 <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>消耗价值</div>
                                    <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{val.toFixed(0)} 💎</div>
                                 </div>
                              </div>
                           </div>
                         )
                      })}
                      
                      <button 
                         onClick={() => addProgressionTarget(dayKey)}
                         style={{ 
                           border: '2px dashed rgba(255,255,255,0.1)', background: 'none', borderRadius: '8px', 
                           color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                           cursor: 'pointer', transition: 'all 0.2s', minHeight: '80px'
                         }}
                         onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-secondary)'}
                         onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                      >
                         <Plus size={20} /> 添加系统目标
                      </button>
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
