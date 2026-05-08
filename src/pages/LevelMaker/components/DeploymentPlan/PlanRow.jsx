import React from 'react';

const PlanRow = ({ plan }) => {
  return (
    <div className={`plan-row glass ${plan.isBossLevel ? 'boss-row' : ''}`}>
      <div className="row-level">
        <span className="badge">Floor {plan.level}</span>
        {plan.isBossLevel && <span className="boss-tag">BOSS</span>}
      </div>
      <div className="row-coeffs">
        <div className="coeff-item">
          <label>HP 基数</label>
          <span>{plan.hpCoeff.toFixed(2)}x</span>
        </div>
        <div className="coeff-item">
          <label>ATK 基数</label>
          <span>{plan.atkCoeff.toFixed(2)}x</span>
        </div>
      </div>
      <div className="row-budget">
        <label>总预算</label>
        <span>{plan.budget} pt</span>
      </div>
      <div className="row-units">
        <label>兵种配置 (Tier: {plan.targetTier})</label>
        <div className="unit-chips">
          {plan.selected.map((s, idx) => (
            <div key={idx} className={`unit-chip ${s.isForcedBoss ? 'boss-chip' : ''}`}>
              <span className="name">{s.isForcedBoss ? '⭐ ' : ''}{s.name}</span>
              <span className="count">x{s.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="row-roles">
        <label>职能配比</label>
        <div className="role-dots">
          {plan.selected.some(s => s.roles.some(r => r === 0 || r === '0')) && <div className="dot tank" title="有坦克" />}
          {plan.selected.some(s => s.roles.some(r => r === 2 || r === '2')) && <div className="dot dps" title="有输出" />}
        </div>
      </div>
    </div>
  );
};

export default PlanRow;
