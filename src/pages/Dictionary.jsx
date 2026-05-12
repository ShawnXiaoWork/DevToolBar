import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import Modal from './Modal';
import ExcelImportPanel from '../components/ExcelImportPanel';
import { downloadDictionaryTemplate, parseDictionaryExcel } from '../services/excelService';
import { Package, Palette, RefreshCw, Save } from 'lucide-react';
import { loadExcelWorkbook, syncDataToSheet, saveExcelWorkbook } from '../utils/excelSyncUtils';

const Dictionary = () => {
  const { state, dispatch } = useGame();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('add');
  const [editingResId, setEditingResId] = useState(null);
  const [formData, setFormData] = useState({ name: '', diamondRate: 0 });

  useEffect(() => {
    loadFromLocal(true); // 静默加载
  }, []);

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

  /** 基于金本位的自动定价算法 */
  const calculateDefaultRate = (item) => {
    const { economyRules } = state;
    
    // 1. 基础价值匹配 (按类型/子类型)
    let baseValue = 1;
    const itemTypeStr = String(item.type || '').toLowerCase();
    const itemSubTypeStr = String(item.subType || '').toLowerCase();
    
    const typeRule = economyRules.itemTypes.find(t => 
      itemTypeStr === t.id.toLowerCase() || 
      itemTypeStr.includes(t.name) ||
      itemSubTypeStr === t.id.toLowerCase() ||
      itemSubTypeStr.includes(t.name)
    );

    if (typeRule) {
      baseValue = typeRule.baseValue;
    } else {
      // 深度模糊匹配 (含常见英文名)
      const str = `${item.name}|${itemTypeStr}|${itemSubTypeStr}`;
      if (/装备|equip|weapon|armor/i.test(str)) baseValue = 100;
      else if (/材料|material|item/i.test(str)) baseValue = 10;
      else if (/碎片|chip|fragment/i.test(str)) baseValue = 5;
      else if (/消耗|consumable/i.test(str)) baseValue = 2;
    }

    // 2. 品质系数匹配
    let multiplier = 1;
    const qStr = String(item.quality || '').toLowerCase();
    
    // 支持数字映射: 1=白色, 2=绿色, 3=蓝色, 4=紫色, 5=橙色
    const qualityMap = { '1': 'white', '2': 'green', '3': 'blue', '4': 'purple', '5': 'orange' };
    const mappedQuality = qualityMap[qStr] || qStr;

    const qualityRule = economyRules.qualities.find(q => 
      mappedQuality === q.id.toLowerCase() || 
      mappedQuality.includes(q.name) ||
      (item.name && item.name.includes(q.name))
    );

    if (qualityRule) {
      multiplier = qualityRule.multiplier;
    } else {
      // 英文品质名兜底
      if (/orange|legend|神话|传说|橙/i.test(qStr) || /橙/.test(item.name)) multiplier = 30;
      else if (/purple|epic|史诗|紫/i.test(qStr) || /紫/.test(item.name)) multiplier = 10;
      else if (/blue|rare|稀有|蓝/i.test(qStr) || /蓝/.test(item.name)) multiplier = 4;
      else if (/green|common|优秀|绿/i.test(qStr) || /绿/.test(item.name)) multiplier = 2;
    }

    // 3. 特殊逻辑修正
    let factor = 1.0;
    const fullStr = `${item.name}|${itemTypeStr}|${itemSubTypeStr}`;
    if (/资源|货币|金币|resource|gold|coin/i.test(fullStr)) {
      factor = 0.1;
    }

    return Number((baseValue * multiplier * factor).toFixed(4));
  };

  const handleSubmit = () => {
    if (!formData.name) return;
    
    // 如果是新增且汇率为0，尝试自动定价
    let finalData = { ...formData };
    if (modalType === 'add' && finalData.diamondRate === 0) {
      finalData.diamondRate = calculateDefaultRate({
        name: finalData.name,
        type: finalData.type || 'material',
        quality: finalData.quality || 'white'
      });
    }

    if (modalType === 'add') {
      dispatch({
        type: 'ADD_RESOURCE',
        payload: { id: `res_${Date.now()}`, ...finalData },
      });
    } else {
      dispatch({
        type: 'UPDATE_RESOURCE',
        payload: { id: editingResId, ...finalData },
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

  const syncToLocal = async () => {
    try {
      const { workbook, sheet, headers, range } = await loadExcelWorkbook('ItemTable.xlsx');
      
      // 动态映射：尝试匹配表头
      const mapping = {};
      const idHeader = headers.find(h => h && h.toLowerCase() === 'id') || headers[0];
      const nameHeader = headers.find(h => h && h.toLowerCase() === 'name') || headers.find(h => h && h.includes('名'));
      const noteHeader = headers.find(h => h && h.toLowerCase() === 'note');
      const standardHeader = headers.find(h => h && (h.toLowerCase() === 'standard' || h.includes('率')));
      const typeHeader = headers.find(h => h && h.toLowerCase() === 'type');
      const subTypeHeader = headers.find(h => h && h.toLowerCase() === 'subtype');
      const qualityHeader = headers.find(h => h && h.toLowerCase() === 'quality');

      if (idHeader) mapping[idHeader] = 'id';
      if (noteHeader) mapping[noteHeader] = 'name'; // Note 列作为资源名称
      if (nameHeader) mapping[nameHeader] = 'langKey'; // Name 列作为多语言 Key
      if (standardHeader) mapping[standardHeader] = 'diamondRate';
      if (typeHeader) mapping[typeHeader] = 'type';
      if (subTypeHeader) mapping[subTypeHeader] = 'subType';
      if (qualityHeader) mapping[qualityHeader] = 'quality';

      syncDataToSheet({
        sheet,
        headers,
        dataToSync: state.resources,
        range,
        config: {
          idField: 'id',
          mapping: mapping,
          templateId: state.resources[0]?.id || 1001 // 随便找一个作为模板，或者约定好的
        }
      });

      const result = await saveExcelWorkbook(workbook, 'ItemTable.xlsx');
      alert(result.message || '同步到 ItemTable.xlsx 成功！');
    } catch (error) {
      console.error('Sync failed:', error);
      alert('同步失败：' + (error.message || '请检查 EXTERNAL_SYNC_PATH 或文件是否存在'));
    }
  };

  const loadFromLocal = async (isAuto = false) => {
    try {
      const { fullData, headers } = await loadExcelWorkbook('ItemTable.xlsx');
      const idIdx = headers.findIndex(h => h && h.toLowerCase() === 'id');
      const nameIdx = headers.findIndex(h => h && h.toLowerCase() === 'name');
      const noteIdx = headers.findIndex(h => h && h.toLowerCase() === 'note');
      const rateIdx = headers.findIndex(h => h && (h.toLowerCase() === 'standard' || h.includes('率') || h.includes('价')));
      const typeIdx = headers.findIndex(h => h && h.toLowerCase() === 'type');
      const subTypeIdx = headers.findIndex(h => h && h.toLowerCase() === 'subtype');
      const qualityIdx = headers.findIndex(h => h && h.toLowerCase() === 'quality');

      const resources = fullData.slice(4).map((row, idx) => {
        const id = row[idIdx];
        if (id === undefined || id === null || id === '') return null;
        
        let rate = Number(row[rateIdx] || 0);
        const item = {
          id: String(id),
          name: row[noteIdx] || row[nameIdx] || `未命名_${id}`, // 优先使用 Note 作为名称
          langKey: row[nameIdx], // 保存 Name 列为 langKey
          type: row[typeIdx],
          subType: row[subTypeIdx],
          quality: row[qualityIdx],
          note: row[noteIdx]
        };

        // 如果比率为 0，执行自动定价算法
        if (rate === 0) {
          rate = calculateDefaultRate(item);
        }

        return {
          ...item,
          diamondRate: rate
        };
      }).filter(Boolean);

      if (resources.length > 0) {
        dispatch({ type: 'REPLACE_RESOURCES', payload: resources });
        if (!isAuto) alert(`成功从本地加载 ${resources.length} 个资源项`);
      } else {
        if (!isAuto) alert('ItemTable.xlsx 中未找到有效数据（从第 5 行起开始解析）');
      }
    } catch (error) {
      console.warn('Load from local failed (ItemTable.xlsx):', error);
      if (!isAuto) {
        alert('无法加载 ItemTable.xlsx。\n\n原因可能是：\n1. .env 中的 EXTERNAL_SYNC_PATH 路径不正确（当前可能指向了不存在的目录）。\n2. 该路径下缺少 ItemTable.xlsx 文件。\n3. 项目 public 目录下也缺少该文件作为兜底。');
      }
    }
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
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => loadFromLocal(false)}>
              <RefreshCw size={16} /> 从本地加载
            </button>
            <button className="btn-primary" style={{ background: '#4CAF50', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={syncToLocal}>
              <Save size={16} /> 同步到本地
            </button>
            <button className="btn-primary" onClick={openAddModal}>+ 添加新资源</button>
          </div>
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
