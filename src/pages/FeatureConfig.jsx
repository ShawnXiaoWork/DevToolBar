import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import {
  PieChart, TrendingUp, AlertCircle, Clock, Layout,
  BarChart3, ShieldAlert, CheckCircle2, Plus, Trash2, ArrowUpRight, ArrowDownRight, Settings2, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ExcelImportPanel from '../components/ExcelImportPanel';
import { downloadFeatureTemplate, parseFeatureExcel } from '../services/excelService';
import Modal from './Modal';

const FEATURE_TYPES = ['Core', 'Meta', 'Eco', 'Content'];
const TYPE_LABELS = {
  Core: '核心循环 (Core)',
  Meta: '外部成长 (Meta)',
  Eco: '商业社交 (Eco)',
  Content: '内容扩展 (Content)',
};
const TYPE_COLORS = {
  Core: 'var(--accent-primary)',
  Meta: 'var(--accent-secondary)',
  Eco: 'var(--accent-success)',
  Content: '#f0a500',
};

const RULES = {
  Core:    { min: 3,  max: 5,  unlockMin: 0,     unlockMax: 5,      unit: '分钟' },
  Meta:    { min: 8,  max: 12, unlockMin: 15,    unlockMax: 60,     unit: '分钟' },
  Eco:     { min: 5,  max: 8,  unlockMin: 1440,  unlockMax: 2880,   unit: '天 (D1-D2)' },
  Content: { min: 1,  max: 99, unlockMin: 10080, unlockMax: 999999, unit: '天 (D7+)' },
};

// ────── 资源编辑子组件 ──────
const ResourceWeightEditor = ({ title, resources, allResources, onChange, accentColor }) => {
  const [showAdd, setShowAdd] = useState(false);

  const addResource = (resId) => {
    if (resources.find(r => r.resourceId === resId)) return;
    onChange([...resources, { resourceId: resId, weight: 100 }]);
    setShowAdd(false);
  };

  const updateWeight = (resId, weight) => {
    onChange(resources.map(r => r.resourceId === resId ? { ...r, weight } : r));
  };

  const removeResource = (resId) => {
    onChange(resources.filter(r => r.resourceId !== resId));
  };

  return (
    <div className="config-section" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {title === '消耗' ? <ArrowDownRight size={16} color="var(--accent-danger)" /> : <ArrowUpRight size={16} color="var(--accent-success)" />}
          {title}配置
        </h3>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          style={{ background: 'none', border: 'none', color: accentColor, cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.8rem' }}
        >
          <Plus size={14} /> 添加资源
        </button>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px', minHeight: '60px' }}>
        {showAdd && (
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
            {allResources.map(res => (
              <button 
                key={res.id} 
                onClick={() => addResource(res.id)}
                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'white', cursor: 'pointer' }}
              >
                {res.name}
              </button>
            ))}
          </div>
        )}

        {resources.length > 0 ? resources.map(pr => {
          const resource = allResources.find(r => r.id === pr.resourceId);
          return (
            <div key={pr.resourceId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.88rem', flex: 1 }}>{resource?.name || '未知'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '60%' }}>
                <input 
                  type="range" min="1" max="1000" step="10"
                  value={pr.weight}
                  onChange={(e) => updateWeight(pr.resourceId, parseInt(e.target.value))}
                  style={{ flex: 1, accentColor: accentColor }}
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', width: 40, textAlign: 'right' }}>{pr.weight}</span>
                <button onClick={() => removeResource(pr.resourceId)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={14} /></button>
              </div>
            </div>
          );
        }) : <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '0.5rem' }}>未配置资源</div>}
      </div>
    </div>
  );
};

const FeatureConfig = () => {
  const { state, dispatch } = useGame();
  const [viewMode, setViewMode] = useState('list');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFeatName, setNewFeatName] = useState('');
  const [helpers, setHelpers] = useState({});

  const updateHelper = (featId, field, value) => {
    setHelpers(prev => ({
      ...prev,
      [featId]: { 
        typeId: state.economyRules.itemTypes[0]?.id, 
        qualityId: state.economyRules.qualities[2]?.id,
        ...prev[featId], 
        [field]: value 
      }
    }));
  };

  const updateFeature = (id, updates) => {
    dispatch({ type: 'UPDATE_FEATURE', payload: { id, ...updates } });
  };

  const createFeature = () => {
    if (!newFeatName) return;
    dispatch({
      type: 'ADD_FEATURE',
      payload: { id: `feat_${Date.now()}`, name: newFeatName, type: 'Core' }
    });
    setNewFeatName('');
    setShowCreateModal(false);
  };

  const handleExcelImport = async (file, mode) => {
    const { features, errors } = await parseFeatureExcel(file, state.resources);
    if (features.length > 0) {
      if (mode === 'replace') {
        dispatch({ type: 'REPLACE_FEATURES', payload: features });
      } else {
        features.forEach(f => dispatch({ type: 'ADD_FEATURE', payload: f }));
      }
    }
    return { count: features.length, errors };
  };

  const formatDuration = (mins) => {
    if (mins >= 1440) return `${(mins / 1440).toFixed(1)}天`;
    return `${mins}分钟`;
  };

  return (
    <div className="feature-config-container">
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="glow-text" style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>模块定义与产出分析</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>配置功能模块的解锁节奏、资源消耗与产出模型</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', display: 'flex' }}>
            {['list', 'analysis'].map(m => (
              <button key={m} onClick={() => setViewMode(m)} style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: viewMode === m ? 'var(--accent-primary)' : 'transparent', color: 'white', fontSize: '0.85rem' }}>
                {m === 'list' ? '模块列表' : '节奏分析'}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}><Plus size={16} /> 创建新模块</button>
        </div>
      </div>

      {/* Excel Import */}
      <ExcelImportPanel 
        onDownloadTemplate={downloadFeatureTemplate}
        onImport={handleExcelImport}
        templateLabel="下载升级版设计模板"
        description="支持多资源消耗/产出配置，含详细参数说明页"
      />

      {viewMode === 'list' ? (
        state.features.map(feat => {
          const typeColor = TYPE_COLORS[feat.type] || 'var(--text-muted)';
          return (
            <motion.div key={feat.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem', borderLeft: `4px solid ${typeColor}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 className="glow-text" style={{ fontSize: '1.4rem' }}>{feat.name}</h2>
                    <select 
                      value={feat.type} 
                      onChange={(e) => updateFeature(feat.id, { type: e.target.value })}
                      style={{ background: 'rgba(124,77,255,0.1)', border: `1px solid ${typeColor}`, color: typeColor, padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}
                    >
                      {FEATURE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>等级上限: <input type="number" value={feat.maxLevel} onChange={e => updateFeature(feat.id, { maxLevel: parseInt(e.target.value) })} style={{ width: 40, background: 'none', border: 'none', borderBottom: '1px solid #555', color: 'white' }} /></span>
                    <span>解锁: <input type="number" value={feat.unlockCondition.value} onChange={e => updateFeature(feat.id, { unlockCondition: { ...feat.unlockCondition, value: parseInt(e.target.value) } })} style={{ width: 50, background: 'none', border: 'none', borderBottom: '1px solid #555', color: 'white' }} /> min ({formatDuration(feat.unlockCondition.value)})</span>
                  </div>
                </div>
                <button onClick={() => dispatch({ type: 'DELETE_FEATURE', payload: feat.id })} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}><Trash2 size={18} /></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {/* Costs & Outputs */}
                <div>
                  <ResourceWeightEditor 
                    title="消耗" 
                    resources={feat.physicalResources || []} 
                    allResources={state.resources} 
                    onChange={(val) => updateFeature(feat.id, { physicalResources: val })}
                    accentColor="var(--accent-danger)"
                  />
                  <ResourceWeightEditor 
                    title="产出" 
                    resources={feat.outputResources || []} 
                    allResources={state.resources} 
                    onChange={(val) => updateFeature(feat.id, { outputResources: val })}
                    accentColor="var(--accent-success)"
                  />
                </div>

                {/* Math Model & Audit Params */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem' }}>
                    <h3 style={{ fontSize: '0.95rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Settings2 size={16} color="var(--accent-primary)" /> 经济成长模型
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select 
                          value={feat.growthModel} 
                          onChange={e => updateFeature(feat.id, { growthModel: e.target.value })}
                          style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'white', padding: '0.4rem', borderRadius: '4px', fontSize: '0.85rem' }}
                        >
                          <option value="linear">线性 (Linear)</option>
                          <option value="exponential">指数 (Exponential)</option>
                        </select>
                        <input 
                          type="number" step="0.1"
                          value={feat.params.slope || feat.params.base || 1}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            updateFeature(feat.id, { params: feat.growthModel === 'linear' ? { slope: val } : { base: val } });
                          }}
                          style={{ width: '60px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'white', padding: '0.4rem', borderRadius: '4px', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* [NEW] 审计参数配置 */}
                  <div className="glass-panel" style={{ background: 'rgba(124,77,255,0.05)', padding: '1.25rem', border: '1px dashed var(--accent-primary)' }}>
                    <h3 style={{ fontSize: '0.95rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={16} color="var(--accent-secondary)" /> 推演参数 (Audit)
                    </h3>
                    {feat.outputResources?.length > 0 ? (
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>每分钟基础产出 (数量)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="number"
                            value={feat.auditParams?.outputPerMin || 0}
                            onChange={e => updateFeature(feat.id, { auditParams: { ...feat.auditParams, outputPerMin: parseInt(e.target.value) || 0 } })}
                            style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid #444', color: 'white', padding: '0.5rem', borderRadius: '4px' }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/min</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>价值转化系数 (投入:产出价值比)</label>
                        <input 
                          type="number" step="0.1"
                          value={feat.auditParams?.valueCostRatio || 0}
                          onChange={e => updateFeature(feat.id, { auditParams: { ...feat.auditParams, valueCostRatio: parseFloat(e.target.value) || 0 } })}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid #444', color: 'white', padding: '0.5rem', borderRadius: '4px' }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* [NEW] 预期推演结果 (Live Audit Result) */}
                <div className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.05) 0%, rgba(0,230,118,0.05) 100%)', padding: '1.5rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                   <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}>
                      {feat.outputResources?.length > 0 ? <TrendingUp size={80} /> : <ShieldAlert size={80} />}
                   </div>
                   
                   <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={14} /> 预期推演 (金本位价值 - D7)
                   </div>

                   {/* 核心数值展示 */}
                   <div style={{ marginBottom: '1.5rem' }}>
                    {feat.outputResources?.length > 0 ? (
                        (() => {
                          const resId = feat.outputResources[0]?.resourceId;
                          const rate = state.resources.find(r => r.id === resId)?.diamondRate || 0;
                          const totalVal = state.playerModel.dailyTime * state.playerModel.efficiency * (feat.auditParams?.outputPerMin || 0) * rate;
                          return (
                            <>
                              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-success)' }}>
                                {totalVal.toFixed(1)} <span style={{ fontSize: '1rem' }}>💎</span>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>预期第 7 天单日产出价值</div>
                            </>
                          );
                        })()
                    ) : (
                        (() => {
                          const gap = state.playerModel.milestones.day7.targetValueGap || 0;
                          const totalVal = gap * (feat.auditParams?.valueCostRatio || 0);
                          return (
                            <>
                              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-danger)' }}>
                                {totalVal.toFixed(1)} <span style={{ fontSize: '1rem' }}>💎</span>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>达到第 7 天目标所需价值</div>
                            </>
                          );
                        })()
                    )}
                   </div>

                   {/* [NEW] 道具数量助手 */}
                   <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                         <span>数量换算助手 (Quantity Helper)</span>
                         <Settings2 size={12} />
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                         <select 
                            className="feature-input" 
                            style={{ padding: '2px 4px', fontSize: '0.75rem', height: 'auto' }}
                            value={helpers[feat.id]?.typeId || state.economyRules.itemTypes[0]?.id}
                            onChange={(e) => updateHelper(feat.id, 'typeId', e.target.value)}
                         >
                            {state.economyRules.itemTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                         </select>
                         <select 
                            className="feature-input" 
                            style={{ padding: '2px 4px', fontSize: '0.75rem', height: 'auto' }}
                            value={helpers[feat.id]?.qualityId || state.economyRules.qualities[2]?.id}
                            onChange={(e) => updateHelper(feat.id, 'qualityId', e.target.value)}
                         >
                            {state.economyRules.qualities.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                         </select>
                      </div>

                      {(() => {
                         const resId = feat.outputResources[0]?.resourceId;
                         const rate = state.resources.find(r => r.id === resId)?.diamondRate || 0;
                         const totalVal = feat.outputResources?.length > 0 
                            ? (state.playerModel.dailyTime * state.playerModel.efficiency * (feat.auditParams?.outputPerMin || 0) * rate)
                            : (state.playerModel.milestones.day7.targetValueGap * (feat.auditParams?.valueCostRatio || 0));
                         
                         const typeId = helpers[feat.id]?.typeId || state.economyRules.itemTypes[1]?.id; // Default to material
                         const qualityId = helpers[feat.id]?.qualityId || state.economyRules.qualities[2]?.id; // Default to blue
                         
                         const type = state.economyRules.itemTypes.find(t => t.id === typeId);
                         const quality = state.economyRules.qualities.find(q => q.id === qualityId);
                         const itemValue = (type?.baseValue || 0) * (quality?.multiplier || 1);
                         
                         return (
                            <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(124,77,255,0.1)', borderRadius: '4px' }}>
                               <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                                  ≈ {(itemValue > 0 ? totalVal / itemValue : 0).toFixed(1)} <span style={{ fontSize: '0.7rem' }}>个</span>
                                </div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                   折合 [{quality?.name}·{type?.name}] 数量
                                </div>
                            </div>
                         );
                      })()}
                   </div>
                </div>
              </div>
            </motion.div>
          );
        })
      ) : (
        <div className="analysis-placeholder" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <BarChart3 size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3>节奏分析视图 (开发中)</h3>
          <p>将基于产出与消耗权重，计算整体经济的通胀压力与资源平衡曲线</p>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="创建新模块">
        <input 
          type="text" placeholder="输入模块名称..." 
          value={newFeatName} onChange={e => setNewFeatName(e.target.value)}
          style={{ width: '100%', padding: '0.8rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '8px', marginBottom: '1.5rem' }}
        />
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-primary" style={{ flex: 1 }} onClick={createFeature}>确认创建</button>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>取消</button>
        </div>
      </Modal>
    </div>
  );
};

export default FeatureConfig;
