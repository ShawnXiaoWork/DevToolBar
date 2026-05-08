import React from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import { calculatePowerScore } from '../../utils/planningUtils';
import { ROLE_SYMBOLS, ROLE_LABELS } from '../../utils/constants';

const UnitTable = ({ units, unitFilter, toggleSort, onEdit, onDelete }) => {
  return (
    <div className="units-table glass" style={{
      marginTop: '1rem',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(0,0,0,0.2)'
    }}>
      <div className="table-header" style={{
        display: 'grid',
        gridTemplateColumns: '100px 150px 80px 70px 70px 60px 60px 60px 60px 80px 1fr 70px 80px',
        padding: '14px 20px',
        background: 'rgba(255,255,255,0.05)',
        fontWeight: '600',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        <span style={{ cursor: 'pointer' }} onClick={() => toggleSort('id')}>ID {unitFilter.sortBy === 'id' && (unitFilter.sortDir === 'asc' ? '↑' : '↓')}</span>
        <span style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>名称 {unitFilter.sortBy === 'name' && (unitFilter.sortDir === 'asc' ? '↑' : '↓')}</span>
        <span>ArmyTag</span>
        <span style={{ cursor: 'pointer' }} onClick={() => toggleSort('hp')}>HP {unitFilter.sortBy === 'hp' && (unitFilter.sortDir === 'asc' ? '↑' : '↓')}</span>
        <span style={{ cursor: 'pointer' }} onClick={() => toggleSort('atk')}>ATK {unitFilter.sortBy === 'atk' && (unitFilter.sortDir === 'asc' ? '↑' : '↓')}</span>
        <span style={{ cursor: 'pointer' }} onClick={() => toggleSort('atkSpeed')}>ASP {unitFilter.sortBy === 'atkSpeed' && (unitFilter.sortDir === 'asc' ? '↑' : '↓')}</span>
        <span style={{ cursor: 'pointer' }} onClick={() => toggleSort('atkRange')}>ARNG {unitFilter.sortBy === 'atkRange' && (unitFilter.sortDir === 'asc' ? '↑' : '↓')}</span>
        <span style={{ cursor: 'pointer' }} onClick={() => toggleSort('detRange')}>DRNG {unitFilter.sortBy === 'detRange' && (unitFilter.sortDir === 'asc' ? '↑' : '↓')}</span>
        <span style={{ cursor: 'pointer' }} onClick={() => toggleSort('spd')}>SPD {unitFilter.sortBy === 'spd' && (unitFilter.sortDir === 'asc' ? '↑' : '↓')}</span>
        <span style={{ cursor: 'pointer' }} onClick={() => toggleSort('score')}>评分 {unitFilter.sortBy === 'score' && (unitFilter.sortDir === 'asc' ? '↑' : '↓')}</span>
        <span>职能标签</span>
        <span style={{ cursor: 'pointer' }} onClick={() => toggleSort('weight')}>权重 {unitFilter.sortBy === 'weight' && (unitFilter.sortDir === 'asc' ? '↑' : '↓')}</span>
        <span style={{ textAlign: 'right' }}>管理</span>
      </div>
      <div className="table-body" style={{ maxHeight: 'calc(100vh - 450px)', overflowY: 'auto' }}>
        {units.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            没有找到匹配的兵种，请尝试调整筛选条件或导入配置。
          </div>
        )}
        {units.map(unit => (
          <div key={unit.id} className="table-row" style={{
            display: 'grid',
            gridTemplateColumns: '100px 150px 80px 70px 70px 60px 60px 60px 60px 80px 1fr 70px 80px',
            padding: '12px 20px',
            alignItems: 'center',
            fontSize: '0.85rem',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            transition: 'all 0.2s ease'
          }}>
            <span style={{ fontSize: '0.85rem', color: unit.id >= 90000 ? 'var(--accent-warning)' : '#888', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {unit.id}
            </span>
            <span style={{ fontWeight: '600', color: '#fff' }}>{unit.name}</span>
            <span className="badge" style={{
              background: unit.armyTag === 9 ? 'rgba(255, 171, 64, 0.2)' : 'rgba(124, 77, 255, 0.2)',
              color: unit.armyTag === 9 ? '#FFAB40' : '#B39DDB',
              fontSize: '0.7rem'
            }}>
              {unit.armyTag === 9 ? 'Boss' : `Tier ${unit.armyTag || 1}`}
            </span>
            <span style={{ color: '#FF5252' }}>{unit.hp}</span>
            <span style={{ color: '#FFAB40' }}>{unit.atk}</span>
            <span style={{ color: '#F48FB1' }}>{unit.atkSpeed || 1.0}</span>
            <span style={{ color: '#81C784' }}>{unit.atkRange || 100}</span>
            <span style={{ color: '#64B5F6' }}>{unit.detRange || 200}</span>
            <span style={{ color: '#00E5FF' }}>{unit.spd}</span>
            <span style={{ fontWeight: '800', color: 'var(--accent-primary)' }}>{calculatePowerScore(unit)}</span>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {unit.roles.map(role => (
                <span key={role} className="tag" style={{
                  fontSize: '0.6rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: (typeof role === 'string' && role.startsWith('T')) ? 'rgba(0, 229, 255, 0.1)' : 'rgba(255,255,255,0.05)',
                  color: (typeof role === 'string' && role.startsWith('T')) ? '#00E5FF' : 'inherit'
                }}>{typeof role === 'number' ? `${ROLE_SYMBOLS[role]} ${ROLE_LABELS[role]}` : role}</span>
              ))}
            </div>
            <span style={{ color: 'var(--text-muted)' }}>{unit.spawnWeight}</span>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => onEdit(unit)} style={{ padding: '6px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}><Edit3 size={14} /></button>
              <button onClick={() => onDelete(unit.id)} style={{ padding: '6px', background: 'rgba(255,100,100,0.1)', border: 'none', borderRadius: '4px', color: '#FF5252', cursor: 'pointer' }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UnitTable;
