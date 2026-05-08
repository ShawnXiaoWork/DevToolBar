import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import Modal from './Modal';
import ExcelImportPanel from '../components/ExcelImportPanel';
import { downloadDictionaryTemplate, parseDictionaryExcel } from '../services/excelService';
import { Package, Palette } from 'lucide-react';

const Dictionary = () => {
  const { state, dispatch } = useGame();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('add');
  const [editingResId, setEditingResId] = useState(null);
  const [formData, setFormData] = useState({ name: '', diamondRate: 0 });

  const handleBaseChange = (field, value) => {
    dispatch({ type: 'UPDATE_BASE_SETTINGS', payload: { [field]: value } });
  };

  const openAddModal = () => {
    setModalType('add');
    setFormData({ name: '', diamondRate: 0 });
    setIsModalOpen(true);
  };

  const openEditModal = (res) => {
    setModalType('edit');
    setEditingResId(res.id);
    setFormData({ name: res.name, diamondRate: res.diamondRate });
    setIsModalOpen(true);
  };

  const handleDeleteResource = (id) => {
    dispatch({ type: 'DELETE_RESOURCE', payload: id });
  };

  const handleSubmit = () => {
    if (!formData.name) return;
    if (modalType === 'add') {
      dispatch({
        type: 'ADD_RESOURCE',
        payload: { id: `res_${Date.now()}`, ...formData },
      });
    } else {
      dispatch({
        type: 'UPDATE_RESOURCE',
        payload: { id: editingResId, ...formData },
      });
    }
    setIsModalOpen(false);
  };

  const handleExcelImport = async (file, mode) => {
    const { resources, errors } = await parseDictionaryExcel(file);
    if (resources.length > 0) {
      if (mode === 'replace') {
        dispatch({ type: 'REPLACE_RESOURCES', payload: resources });
      } else {
        resources.forEach((res) => dispatch({ type: 'ADD_RESOURCE', payload: res }));
      }
    }
    return { count: resources.length, errors };
  };

  return (
    <div className="dictionary-container">
      {/* ── 本位币设置 ── */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h2 className="glow-text">本位币与时间价值</h2>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              时间单位
            </label>
            <input
              type="text"
              value={state.baseSettings.timeUnit}
              onChange={(e) => handleBaseChange('timeUnit', e.target.value)}
              style={{ background: 'var(--card-bg)', border: 'var(--glass-border)', color: 'white', padding: '0.5rem', borderRadius: '4px', width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              每单位时间价值（钻石）
            </label>
            <input
              type="number"
              value={state.baseSettings.diamondPerTime}
              onChange={(e) => handleBaseChange('diamondPerTime', Number(e.target.value))}
              style={{ background: 'var(--card-bg)', border: 'var(--glass-border)', color: 'white', padding: '0.5rem', borderRadius: '4px', width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* ── 资源字典 ── */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="glow-text">资源字典与汇率</h2>
          <button className="btn-primary" onClick={openAddModal}>+ 添加新资源</button>
        </div>

        <ExcelImportPanel
          onDownloadTemplate={downloadDictionaryTemplate}
          onImport={handleExcelImport}
          templateLabel="下载资源字典模板"
          description="表头：资源名称、对钻石汇率、备注（可选）"
        />

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>资源名称</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>对钻石汇率（1资源 = X钻石）</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {state.resources.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  暂无资源，请手动添加或通过 Excel 导入
                </td>
              </tr>
            ) : (
              state.resources.map((res) => (
                <tr
                  key={res.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '0.9rem 1rem', fontWeight: 500 }}>{res.name}</td>
                  <td style={{ padding: '0.9rem 1rem', color: 'var(--accent-secondary)' }}>
                    {res.diamondRate}
                    <span style={{ marginLeft: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>◆</span>
                  </td>
                  <td style={{ padding: '0.9rem 1rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-secondary" onClick={() => openEditModal(res)}>编辑</button>
                    <button
                      style={{
                        padding: '4px 12px', fontSize: '0.82rem',
                        background: 'rgba(255, 82, 82, 0.1)',
                        border: '1px solid rgba(255, 82, 82, 0.3)',
                        color: 'var(--accent-danger)', borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleDeleteResource(res.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── [NEW] 金本位定价规则 ── */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 className="glow-text" style={{ marginBottom: '1.5rem' }}>金本位定价规则 (Pricing Rules)</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
          通过定义“道具大类基准价值”与“品质系数”，实现对海量道具价值的快速对齐与反向计算。
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px' }}>
             <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} /> 道具大类基准价值
             </h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {state.economyRules.itemTypes.map((type, idx) => (
                  <div key={type.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ flex: 1, fontSize: '0.9rem' }}>{type.name}</span>
                    <div style={{ position: 'relative', width: '120px' }}>
                       <input 
                         type="number"
                         value={type.baseValue}
                         onChange={(e) => {
                           const newTypes = [...state.economyRules.itemTypes];
                           newTypes[idx].baseValue = Number(e.target.value);
                           dispatch({ type: 'UPDATE_ECONOMY_RULES', payload: { itemTypes: newTypes } });
                         }}
                         style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'white', padding: '4px 8px', borderRadius: '4px' }}
                       />
                       <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>💎</span>
                    </div>
                  </div>
                ))}
             </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px' }}>
             <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette size={18} /> 品质价值系数
             </h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {state.economyRules.qualities.map((q, idx) => (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: q.color }} />
                    <span style={{ flex: 1, fontSize: '0.9rem' }}>{q.name}系数</span>
                    <div style={{ position: 'relative', width: '100px' }}>
                       <input 
                         type="number"
                         value={q.multiplier}
                         onChange={(e) => {
                           const newQualities = [...state.economyRules.qualities];
                           newQualities[idx].multiplier = Number(e.target.value);
                           dispatch({ type: 'UPDATE_ECONOMY_RULES', payload: { qualities: newQualities } });
                         }}
                         style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'white', padding: '4px 8px', borderRadius: '4px' }}
                       />
                       <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>x</span>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,229,255,0.05)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--accent-secondary)', border: '1px solid rgba(0,229,255,0.2)' }}>
           <strong>推演公式：</strong> 最终道具价值 = 道具大类基准价值 × 品质系数。 例如：装备 (100) × 橙色品质 (30x) = 3000 💎。
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalType === 'add' ? '添加新资源' : '编辑资源'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>资源名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：金币、灵魂石"
              style={{ background: 'var(--card-bg)', border: 'var(--glass-border)', color: 'white', padding: '0.8rem', borderRadius: '8px', width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>对钻石汇率（1单位 = X钻石）</label>
            <input
              type="number"
              value={formData.diamondRate}
              onChange={(e) => setFormData({ ...formData, diamondRate: Number(e.target.value) })}
              style={{ background: 'var(--card-bg)', border: 'var(--glass-border)', color: 'white', padding: '0.8rem', borderRadius: '8px', width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleSubmit}>保存</button>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>取消</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Dictionary;
