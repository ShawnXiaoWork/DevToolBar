import React from 'react';
import { Zap, Crosshair } from 'lucide-react';
import { ROLE_LABELS } from '../../utils/constants';
import { calculateUnitSpeed, getNextIdForRole } from '../../utils/planningUtils';

const UnitDerivation = ({ roleWeights, setRoleWeights, derivationParams, setDerivationParams, dispatch, state }) => {
  return (
    <div className="planning-left" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="planning-card glass">
        <h3><Crosshair size={18} color="var(--accent-primary)" /> 职能属性权重 (Role Weights)</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>基于标准单位(100%)，计算不同职能的属性偏移。</p>
        <div className="weights-table" style={{ overflowX: 'auto' }}>
          <div className="weight-header" style={{ display: 'grid', gridTemplateColumns: '60px repeat(8, minmax(58px, 1fr))', minWidth: '620px', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontSize: '0.7rem' }}>
            <span>职能</span><span>HP</span><span>ATK</span><span>CC</span><span>ASP</span><span>ARNG</span><span>DRNG</span><span>SPD下限</span><span>SPD上限</span>
          </div>
          {Object.keys(roleWeights).map(role => (
            <div key={role} className="weight-row" style={{ display: 'grid', gridTemplateColumns: '60px repeat(8, minmax(58px, 1fr))', minWidth: '620px', gap: '0.4rem', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{ROLE_LABELS[role]}</span>
              <input type="number" step="0.1" value={roleWeights[role].hp} onChange={(e) => setRoleWeights({ ...roleWeights, [role]: { ...roleWeights[role], hp: Number(e.target.value) } })} style={{ width: '100%', fontSize: '0.75rem' }} />
              <input type="number" step="0.1" value={roleWeights[role].atk} onChange={(e) => setRoleWeights({ ...roleWeights, [role]: { ...roleWeights[role], atk: Number(e.target.value) } })} style={{ width: '100%', fontSize: '0.75rem' }} />
              <input type="number" step="0.1" value={roleWeights[role].cc} onChange={(e) => setRoleWeights({ ...roleWeights, [role]: { ...roleWeights[role], cc: Number(e.target.value) } })} style={{ width: '100%', fontSize: '0.75rem' }} />
              <input type="number" step="0.1" value={roleWeights[role].atkSpeed} onChange={(e) => setRoleWeights({ ...roleWeights, [role]: { ...roleWeights[role], atkSpeed: Number(e.target.value) } })} style={{ width: '100%', fontSize: '0.75rem' }} />
              <input type="number" step="10" value={roleWeights[role].atkRange} onChange={(e) => setRoleWeights({ ...roleWeights, [role]: { ...roleWeights[role], atkRange: Number(e.target.value) } })} style={{ width: '100%', fontSize: '0.75rem' }} />
              <input type="number" step="10" value={roleWeights[role].detRange} onChange={(e) => setRoleWeights({ ...roleWeights, [role]: { ...roleWeights[role], detRange: Number(e.target.value) } })} style={{ width: '100%', fontSize: '0.75rem' }} />
              <input type="number" step="0.01" min="0" value={roleWeights[role].spdMin ?? 1} onChange={(e) => setRoleWeights({ ...roleWeights, [role]: { ...roleWeights[role], spdMin: Number(e.target.value) } })} style={{ width: '100%', fontSize: '0.75rem' }} />
              <input type="number" step="0.01" min="0" value={roleWeights[role].spdMax ?? 1} onChange={(e) => setRoleWeights({ ...roleWeights, [role]: { ...roleWeights[role], spdMax: Number(e.target.value) } })} style={{ width: '100%', fontSize: '0.75rem' }} />
            </div>
          ))}
        </div>
      </div>

      <div className="planning-card glass">
        <h3><Zap size={18} color="var(--accent-warning)" /> 兵种一键派生 (Unit Derivation)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div className="input-row">
            <div className="input-group">
              <label>基准 HP</label>
              <input type="number" value={derivationParams.baseHp} onChange={e => setDerivationParams({ ...derivationParams, baseHp: Number(e.target.value) })} />
            </div>
            <div className="input-group">
              <label>基准 ATK</label>
              <input type="number" value={derivationParams.baseAtk} onChange={e => setDerivationParams({ ...derivationParams, baseAtk: Number(e.target.value) })} />
            </div>
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>全局最低 SPD 倍率</label>
              <input type="number" step="0.05" min="0" value={derivationParams.minSpdMultiplier} onChange={e => setDerivationParams({ ...derivationParams, minSpdMultiplier: Number(e.target.value) })} />
            </div>
            <div className="input-group">
              <label>全局最高 SPD 倍率</label>
              <input type="number" step="0.05" min="0" value={derivationParams.maxSpdMultiplier} onChange={e => setDerivationParams({ ...derivationParams, maxSpdMultiplier: Number(e.target.value) })} />
            </div>
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>基准 SPD</label>
              <input type="number" value={derivationParams.baseSpd} onChange={e => setDerivationParams({ ...derivationParams, baseSpd: Number(e.target.value) })} />
            </div>
            <div className="input-group">
              <label>目标职能</label>
              <select value={derivationParams.targetRole} onChange={e => setDerivationParams({ ...derivationParams, targetRole: e.target.value })} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px' }}>
                {Object.keys(ROLE_LABELS).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          <div className="input-group">
            <label>生成兵种名称</label>
            <input type="text" value={derivationParams.unitName} onChange={e => setDerivationParams({ ...derivationParams, unitName: e.target.value })} />
          </div>
          <button className="btn-primary" onClick={() => {
            const weights = roleWeights[derivationParams.targetRole];
            const newUnit = {
              id: getNextIdForRole(derivationParams.targetRole, state.units),
              name: derivationParams.unitName,
              hp: Math.round(derivationParams.baseHp * weights.hp),
              atk: Math.round(derivationParams.baseAtk * weights.atk),
              atkSpeed: weights.atkSpeed || 1.0,
              atkRange: weights.atkRange || 100,
              detRange: weights.detRange || 200,
              spd: calculateUnitSpeed(derivationParams, weights),
              skillPower: Math.round(weights.cc * 100),
              roles: [Number(derivationParams.targetRole)],
              armyTag: 1,
              spawnWeight: 50
            };
            dispatch({ type: 'ADD_UNIT', payload: newUnit });
            alert(`已成功派生兵种: ${newUnit.name}`);
          }}>
            生成并加入兵种库
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnitDerivation;
