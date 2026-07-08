import React from 'react';
import { Users, Plus } from 'lucide-react';
import { ROLE_LABELS } from '../../utils/constants';

const TemplateEditor = ({ rosterTemplates, setRosterTemplates, activeTemplateId, setActiveTemplateId }) => {
  const activeTemplate = rosterTemplates.find(t => t.id === activeTemplateId) || rosterTemplates[0];

  return (
    <div className="planning-card glass">
      <h3><Users size={18} color="var(--accent-secondary)" /> 阵容模版 (Roster Templates)</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>定义不同关卡的战力分配预算比例。总和应为 1.0 (100%)。</p>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <select value={activeTemplateId} onChange={(e) => setActiveTemplateId(e.target.value)} style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px' }}>
          {rosterTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="btn-outline" onClick={() => {
          const newId = `t${Date.now()}`;
          setRosterTemplates([...rosterTemplates, { id: newId, name: '新模版', 0: 0.3, 1: 0.3, 2: 0.2, 3: 0.2, 4: 0.0, 5: 0.0 }]);
          setActiveTemplateId(newId);
        }}><Plus size={16} /></button>
      </div>

      <div className="template-editor" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
        <div className="input-group">
          <label>模版名称</label>
          <input type="text" value={activeTemplate.name} onChange={(e) => {
            setRosterTemplates(rosterTemplates.map(rt => rt.id === activeTemplate.id ? { ...rt, name: e.target.value } : rt));
          }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {Object.keys(ROLE_LABELS).map(Number).map(role => (
            <div key={role} className="input-group">
              <label>{ROLE_LABELS[role]} 比例</label>
              <input type="number" step="0.05" value={activeTemplate[role] !== undefined ? activeTemplate[role] : 0} onChange={(e) => {
                setRosterTemplates(rosterTemplates.map(rt => rt.id === activeTemplate.id ? { ...rt, [role]: Number(e.target.value) } : rt));
              }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: Object.keys(ROLE_LABELS).reduce((sum, role) => sum + (activeTemplate[role] || 0), 0).toFixed(2) === '1.00' ? '#00E676' : '#FF5252' }}>
          当前比例总和: {Object.keys(ROLE_LABELS).reduce((sum, role) => sum + (activeTemplate[role] || 0), 0).toFixed(2)}
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;
