import React from 'react';
import { ROLE_LABELS } from '../../utils/constants';

const UnitFilters = ({ unitFilter, setUnitFilter, allRoles }) => {
  return (
    <div className="filter-toolbar glass" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', marginBottom: '1.5rem', borderRadius: '12px' }}>
      <div style={{ display: 'flex', gap: '1rem', width: '100%', alignItems: 'center' }}>
        <div style={{ flex: 3 }}>
          <input
            type="text"
            placeholder="搜索兵种名称..."
            value={unitFilter.name}
            onChange={(e) => setUnitFilter({ ...unitFilter, name: e.target.value })}
            style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <select
            value={unitFilter.sortBy}
            onChange={(e) => setUnitFilter({ ...unitFilter, sortBy: e.target.value })}
            style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
          >
            <option value="score">按战力评分排序</option>
            <option value="hp">按血量排序</option>
            <option value="atk">按攻击排序</option>
          </select>
        </div>
      </div>

      <div className="role-tags-filter" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            筛选 ArmyTag: {unitFilter.roles.length > 0 ? `(已选 ${unitFilter.roles.length} 个)` : '(全选)'}
          </span>
          {unitFilter.roles.length > 0 && (
            <button
              onClick={() => setUnitFilter({ ...unitFilter, roles: [] })}
              style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              全选 / 重置
            </button>
          )}
        </div>

        <div className="excel-filter-box glass" style={{
          maxHeight: '120px',
          overflowY: 'auto',
          padding: '8px',
          borderRadius: '8px',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '4px'
        }}>
          {allRoles.length === 0 && <p style={{ fontSize: '0.8rem', color: '#666', gridColumn: '1/-1', textAlign: 'center' }}>等待导入 Army 表...</p>}
          {allRoles.map(role => (
            <label key={role} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              color: unitFilter.roles.includes(role) ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: '4px',
              background: unitFilter.roles.includes(role) ? 'rgba(124, 77, 255, 0.1)' : 'transparent'
            }}>
              <input
                type="checkbox"
                checked={unitFilter.roles.includes(role)}
                onChange={() => {
                  const newRoles = unitFilter.roles.includes(role)
                    ? unitFilter.roles.filter(r => r !== role)
                    : [...unitFilter.roles, role];
                  setUnitFilter({ ...unitFilter, roles: newRoles });
                }}
                style={{ accentColor: 'var(--accent-primary)' }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ROLE_LABELS[role] ? `${role} (${ROLE_LABELS[role]})` : role}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UnitFilters;
