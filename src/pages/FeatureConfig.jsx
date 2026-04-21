import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import {
  PieChart, TrendingUp, AlertCircle, Clock, Layout,
  BarChart3, ShieldAlert, CheckCircle2, Plus, Trash2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import ExcelImportPanel from '../components/ExcelImportPanel';
import { downloadFeatureTemplate, parseFeatureExcel } from '../services/excelService';

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

// ────── 新建模块弹窗 ──────
const CreateFeatureModal = ({ isOpen, onClose, onConfirm }) => {
  const [form, setForm] = useState({ name: '', type: 'Core' });
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        style={{ background: 'var(--card-bg)', border: 'var(--glass-border)', borderRadius: '16px', padding: '2rem', width: 380 }}
      >
        <h3 style={{ marginBottom: '1.5rem' }}>创建新模块</h3>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontSize: '0.9rem' }}>模块名称</label>
          <input
            type="text" placeholder="例如：英雄升级、工会系统"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'white', padding: '0.7rem', borderRadius: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontSize: '0.9rem' }}>模块类型</label>
          <select
            value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
            style={{ width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'white', padding: '0.7rem', borderRadius: '8px' }}
          >
            {FEATURE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-primary" style={{ flex: 1 }} onClick={() => { if (form.name) { onConfirm(form); onClose(); setForm({ name: '', type: 'Core' }); } }}>创建</button>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>取消</button>
        </div>
      </motion.div>
    </div>
  );
};

// ────── 主组件 ──────
const FeatureConfig = () => {
  const { state, dispatch } = useGame();
  const [viewMode, setViewMode] = useState('list');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const updateFeature = (id, updates) => {
    dispatch({ type: 'UPDATE_FEATURE', payload: { id, ...updates } });
  };

  const deleteFeature = (id) => {
    dispatch({ type: 'DELETE_FEATURE', payload: id });
  };

  const createFeature = ({ name, type }) => {
    dispatch({
      type: 'ADD_FEATURE',
      payload: {
        id: `feat_${Date.now()}`,
        name,
        type,
        maxLevel: 20,
        unlockCondition: { type: 'time', value: 0 },
        growthModel: 'linear',
        params: { slope: 1 },
        physicalResources: [],
      },
    });
  };

  // Excel 导入处理
  const handleExcelImport = async (file, mode) => {
    const { features, errors } = await parseFeatureExcel(file);
    if (features.length > 0) {
      if (mode === 'replace') {
        dispatch({ type: 'REPLACE_FEATURES', payload: features });
      } else {
        features.forEach(f => dispatch({ type: 'ADD_FEATURE', payload: f }));
      }
    }
    return { count: features.length, errors };
  };

  const getAllocationInfo = (featureId) => {
    const macro = state.macros[0];
    if (!macro) return null;
    const percentage = macro.allocations[featureId] || 0;
    return { stageName: macro.stageName, percentage };
  };

  const formatDuration = (mins) => {
    if (mins >= 10080) return `${(mins / 10080).toFixed(1)} 周`;
    if (mins >= 1440) return `${(mins / 1440).toFixed(1)} 天`;
    return `${mins} 分钟`;
  };

  // ── 节奏分析视图 ──
  const renderAnalysis = () => {
    const stats = FEATURE_TYPES.reduce((acc, type) => {
      const tf = state.features.filter(f => f.type === type);
      acc[type] = { count: tf.length, features: tf };
      return acc;
    }, {});

    return (
      <div className="analysis-view">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {FEATURE_TYPES.map(type => {
            const rule = RULES[type];
            const stat = stats[type];
            const isOk = stat.count >= rule.min && stat.count <= rule.max;
            const color = TYPE_COLORS[type];
            return (
              <motion.div
                key={type}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass-panel"
                style={{ padding: '1.5rem', borderTop: `4px solid ${isOk ? 'var(--accent-success)' : 'var(--accent-warning)'}` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', color }}>{TYPE_LABELS[type]}</h3>
                  {isOk ? <CheckCircle2 color="var(--accent-success)" size={20} /> : <ShieldAlert color="var(--accent-warning)" size={20} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>当前数量:</span>
                    <span style={{ fontWeight: 600, color: isOk ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                      {stat.count} / {rule.min}-{rule.max}
                    </span>
                  </div>
                  {/* 进度条 */}
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3, transition: 'width 0.5s',
                      width: `${Math.min((stat.count / rule.max) * 100, 100)}%`,
                      background: isOk ? 'var(--accent-success)' : 'var(--accent-warning)',
                    }} />
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.6rem', borderRadius: '8px', fontSize: '0.78rem' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 3 }}>建议解锁时机</div>
                    <div style={{ color: 'var(--text-primary)' }}>
                      {formatDuration(rule.unlockMin)} ~ {formatDuration(rule.unlockMax)}
                    </div>
                  </div>
                  {!isOk && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--accent-warning)', display: 'flex', gap: 6 }}>
                      <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{stat.count < rule.min ? '设计不足：建议增加模块以丰富内容' : '冗余风险：模块过多可能导致玩家认知过载'}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* 解锁时间轴 */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={20} color="var(--accent-secondary)" /> 功能解锁时间轴规划
          </h3>
          <div style={{ position: 'relative', paddingLeft: '2rem', borderLeft: '2px dashed var(--border-color)', marginLeft: '1rem' }}>
            {state.features
              .slice()
              .sort((a, b) => (a.unlockCondition?.value || 0) - (b.unlockCondition?.value || 0))
              .map((feat) => {
                const rule = feat.type ? RULES[feat.type] : null;
                const outOfRange = rule && (
                  (feat.unlockCondition?.value || 0) < rule.unlockMin ||
                  (feat.unlockCondition?.value || 0) > rule.unlockMax
                );
                return (
                  <div key={feat.id} style={{ marginBottom: '1.5rem', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: '-2.4rem', top: 3,
                      width: 12, height: 12, borderRadius: '50%',
                      background: TYPE_COLORS[feat.type] || 'var(--text-muted)',
                      boxShadow: `0 0 10px ${TYPE_COLORS[feat.type] || 'transparent'}`,
                    }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{feat.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{TYPE_LABELS[feat.type] || '未设定'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--accent-secondary)' }}>
                          T + {formatDuration(feat.unlockCondition?.value || 0)}
                        </div>
                        {outOfRange && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--accent-danger)' }}>⚠ 时机偏离建议</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  };

  // ── 列表视图 ──
  return (
    <div className="feature-config-container">
      {/* 标题栏 */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="glow-text" style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>模块定义与分析</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>配置游戏核心系统模块及其解锁节奏与资源逻辑</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* 视图切换 */}
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', display: 'flex' }}>
            {[
              { mode: 'list', icon: <Layout size={15} />, label: '模块列表' },
              { mode: 'analysis', icon: <BarChart3 size={15} />, label: '节奏分析' },
            ].map(btn => (
              <button
                key={btn.mode}
                onClick={() => setViewMode(btn.mode)}
                style={{
                  padding: '7px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: viewMode === btn.mode ? 'var(--accent-primary)' : 'transparent',
                  color: 'white', display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '0.85rem', transition: 'all 0.3s',
                }}
              >
                {btn.icon} {btn.label}
              </button>
            ))}
          </div>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> 创建新模块
          </button>
        </div>
      </div>

      {/* 资源警告 */}
      {state.resources.length === 0 && (
        <div style={{ padding: '1rem', background: 'rgba(255,82,82,0.1)', border: '1px solid var(--accent-danger)', borderRadius: '8px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <AlertCircle color="var(--accent-danger)" />
          <span>尚未配置任何基础资源！请先前往"基础字典"步骤添加资源。</span>
        </div>
      )}

      {/* ── Excel 导入面板（仅列表视图显示）── */}
      {viewMode === 'list' && (
        <ExcelImportPanel
          onDownloadTemplate={downloadFeatureTemplate}
          onImport={handleExcelImport}
          templateLabel="下载功能模块模板"
          description="表头：模块名称、类型、最大等级、解锁时间(分钟)、成长模型、系数"
        />
      )}

      {/* 视图内容 */}
      {viewMode === 'list' ? (
        state.features.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Layout size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <p>暂无功能模块，请手动创建或通过 Excel 导入</p>
          </div>
        ) : (
          state.features.map((feat) => {
            const allocInfo = getAllocationInfo(feat.id);
            const typeColor = TYPE_COLORS[feat.type] || 'var(--text-muted)';
            return (
              <motion.div
                key={feat.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass-panel"
                style={{ padding: '2rem', marginBottom: '1.5rem', borderLeft: `3px solid ${typeColor}` }}
              >
                {/* 模块头部 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <h2 className="glow-text" style={{ fontSize: '1.4rem', margin: 0 }}>{feat.name}</h2>
                      <select
                        value={feat.type || ''}
                        onChange={(e) => updateFeature(feat.id, { type: e.target.value })}
                        style={{
                          background: 'rgba(124,77,255,0.1)', border: `1px solid ${typeColor}`,
                          color: typeColor, padding: '4px 10px', borderRadius: '6px',
                          fontSize: '0.8rem', cursor: 'pointer',
                        }}
                      >
                        <option value="" disabled>选择类型</option>
                        {FEATURE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                      </select>
                    </div>
                    {/* 快捷属性行 */}
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1.5rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <TrendingUp size={13} />
                        上限等级:&nbsp;
                        <input
                          type="number" min={1}
                          value={feat.maxLevel}
                          onChange={e => updateFeature(feat.id, { maxLevel: parseInt(e.target.value) || 1 })}
                          style={{ width: 50, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent-success)', color: 'var(--accent-success)', textAlign: 'center' }}
                        />
                      </span>
                      <span style={{ color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={13} />
                        解锁:&nbsp;
                        <input
                          type="number" min={0}
                          value={feat.unlockCondition?.value || 0}
                          onChange={e => updateFeature(feat.id, { unlockCondition: { type: 'time', value: parseInt(e.target.value) || 0 } })}
                          style={{ width: 60, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent-secondary)', color: 'var(--accent-secondary)', textAlign: 'center' }}
                        />
                        &nbsp;分钟
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          ({formatDuration(feat.unlockCondition?.value || 0)})
                        </span>
                      </span>
                      {allocInfo && (
                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <PieChart size={13} />
                          宏观分配: {allocInfo.percentage}% ({allocInfo.stageName})
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 删除按钮 */}
                  <button
                    onClick={() => deleteFeature(feat.id)}
                    title="删除模块"
                    style={{
                      background: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.2)',
                      color: 'var(--accent-danger)', borderRadius: '8px', padding: '6px 10px',
                      cursor: 'pointer', transition: 'all 0.2s', marginLeft: '1rem',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,82,82,0.18)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,82,82,0.08)'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* 资源权重 + 成长模型 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1.5rem' }}>
                  {/* 资源挂钩 */}
                  <div className="config-section">
                    <h3 style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.8rem' }}>
                      资源权重分配
                    </h3>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px' }}>
                      {feat.physicalResources.length > 0 ? feat.physicalResources.map(pr => {
                        const resource = state.resources.find(r => r.id === pr.resourceId);
                        return (
                          <div key={pr.resourceId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.88rem' }}>{resource?.name || '未知资源'}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '55%' }}>
                              <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${pr.weight}%`, height: '100%', background: typeColor }} />
                              </div>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', width: 38, textAlign: 'right' }}>{pr.weight}%</span>
                            </div>
                          </div>
                        );
                      }) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '0.5rem' }}>
                          尚未挂钩任何资源
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 成长模型 */}
                  <div className="config-section">
                    <h3 style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.8rem' }}>
                      成长模型曲线
                    </h3>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>模型类型</label>
                      <select
                        value={feat.growthModel}
                        onChange={(e) => updateFeature(feat.id, { growthModel: e.target.value })}
                        style={{ width: '100%', background: 'var(--card-bg)', border: 'var(--glass-border)', color: 'white', padding: '0.55rem', borderRadius: '6px' }}
                      >
                        <option value="linear">线性增长 (Linear)</option>
                        <option value="exponential">指数增长 (Exponential)</option>
                        <option value="logarithmic">对数增长 (Logarithmic)</option>
                        <option value="power">幂函数 (Power)</option>
                      </select>
                      <div style={{ marginTop: '0.75rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                          系数（{feat.growthModel === 'linear' ? 'slope' : 'base'}）
                        </label>
                        <input
                          type="number" step="0.1"
                          value={feat.params.base || feat.params.slope || 1}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 1;
                            const params = feat.growthModel === 'linear' ? { slope: val } : { base: val };
                            updateFeature(feat.id, { params });
                          }}
                          style={{ width: '100%', background: 'var(--card-bg)', border: 'var(--glass-border)', color: 'white', padding: '0.55rem', borderRadius: '6px' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )
      ) : (
        renderAnalysis()
      )}

      {/* 新建模块弹窗 */}
      <CreateFeatureModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={createFeature}
      />
    </div>
  );
};

export default FeatureConfig;
