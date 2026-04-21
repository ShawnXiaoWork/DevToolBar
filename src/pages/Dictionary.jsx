import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import Modal from './Modal';
import ExcelImportPanel from '../components/ExcelImportPanel';
import { downloadDictionaryTemplate, parseDictionaryExcel } from '../services/excelService';

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

  // Excel 导入处理
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
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="glow-text">资源字典与汇率</h2>
          <button className="btn-primary" onClick={openAddModal}>+ 添加新资源</button>
        </div>

        {/* Excel 导入面板 */}
        <ExcelImportPanel
          onDownloadTemplate={downloadDictionaryTemplate}
          onImport={handleExcelImport}
          templateLabel="下载资源字典模板"
          description="表头：资源名称、对钻石汇率、备注（可选）"
        />

        {/* 资源表格 */}
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
                    <span style={{ marginLeft: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      ◆
                    </span>
                  </td>
                  <td style={{ padding: '0.9rem 1rem', display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: '4px 12px', fontSize: '0.82rem' }}
                      onClick={() => openEditModal(res)}
                    >
                      编辑
                    </button>
                    <button
                      style={{
                        padding: '4px 12px', fontSize: '0.82rem',
                        background: 'rgba(255, 82, 82, 0.1)',
                        border: '1px solid rgba(255, 82, 82, 0.3)',
                        color: 'var(--accent-danger)', borderRadius: '6px',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,82,82,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,82,82,0.1)'}
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

      {/* 编辑 / 新增 Modal */}
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
            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              对钻石汇率（1单位 = X钻石）
            </label>
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
