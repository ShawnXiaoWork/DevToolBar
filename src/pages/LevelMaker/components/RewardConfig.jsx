import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Save, 
  Layers, 
  TrendingUp, 
  Info,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { syncStageRewardsTable, calculateRewardQuantity, parseRewardString } from '../utils/exportUtils';
import { loadExcelWorkbook } from '../../../utils/excelSyncUtils';
import * as XLSX from 'xlsx';

const SearchableSelect = ({ value, onChange, options }) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = React.useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedOption = options.find(opt => String(opt.value) === String(value));
  const displayText = selectedOption ? selectedOption.label : '选择道具...';

  const filteredOptions = options.filter(opt =>
    String(opt.value).toLowerCase().startsWith(search.toLowerCase()) ||
    String(opt.label).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="searchable-select-wrapper" ref={triggerRef} style={{ position: 'relative' }}>
      <div
        className="select-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'white',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: '30px',
          boxSizing: 'border-box'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText}</span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: '8px' }}>▼</span>
      </div>

      {isOpen && (
        <div
          className="select-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#1e1e24',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '6px',
            marginTop: '4px',
            zIndex: 1000,
            maxHeight: '220px',
            overflowY: 'auto',
            padding: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <input
            type="text"
            placeholder="输入ID或名称搜索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              padding: '6px 8px',
              color: 'white',
              fontSize: '0.75rem',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '150px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>未找到匹配项</div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  style={{
                    padding: '6px 8px',
                    fontSize: '0.78rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: String(value) === String(opt.value) ? 'var(--accent-primary)' : 'transparent',
                    color: 'white',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => {
                    if (String(value) !== String(opt.value)) e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={e => {
                    if (String(value) !== String(opt.value)) e.target.style.background = 'transparent';
                  }}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const REWARD_FIELDS = [
  { key: 'StageReward', label: '普通玩法胜利奖励', desc: '成功通关奖励' },
  { key: 'StageRewardFail', label: '普通玩法失败奖励', desc: '失败通关奖励' },
  { key: 'StageRewardHard', label: '困难玩法胜利奖励', desc: '困难模式成功通关奖励' },
  { key: 'StageRewardFailHard', label: '困难玩法失败奖励', desc: '困难模式失败通关奖励' },
  { key: 'StageRewardFirstTimetHard', label: '困难玩法首通奖励', desc: '困难模式首次通关奖励' },
  { key: 'IdleReward1', label: '巡逻固定奖励', desc: '巡逻固定奖励（每分钟）' }
];

const FORMULA_OPTIONS = [
  { value: 'power', label: '幂函数模型' },
  { value: 'linear', label: '阶梯线性模型' },
  { value: 'exponential', label: '指数爆发模型' }
];

const DEFAULT_RULES = {
  StageReward: [
    { id: 'r1', itemId: '1', range: [1, 9999], prob: 100, formula: 'power', params: { base: 1000, power: 1.1 } },
    { id: 'r2', itemId: '3', range: [1, 9999], prob: 100, formula: 'power', params: { base: 800, power: 1.05 } }
  ],
  StageRewardFail: [
    { id: 'r3', itemId: '1', range: [1, 9999], prob: 100, formula: 'power', params: { base: 800, power: 1.05 } }
  ],
  StageRewardHard: [
    { id: 'r4', itemId: '1', range: [1, 9999], prob: 100, formula: 'power', params: { base: 4000, power: 1.15 } }
  ],
  StageRewardFailHard: [
    { id: 'r5', itemId: '1', range: [1, 9999], prob: 100, formula: 'power', params: { base: 3000, power: 1.1 } }
  ],
  StageRewardFirstTimetHard: [
    { id: 'r6', itemId: '2', range: [1, 9999], prob: 100, formula: 'linear', params: { base: 1, coeff: 0.05 } }
  ],
  IdleReward1: [
    { id: 'r7', itemId: '1', range: [1, 9999], prob: 100, formula: 'linear', params: { base: 10, coeff: 0.02 } }
  ]
};

const RewardConfig = ({ state, dispatch }) => {
  const [activeField, setActiveField] = useState('StageReward');
  const [rewardsConfig, setRewardsConfig] = useState(DEFAULT_RULES);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingExcel, setIsLoadingExcel] = useState(true);
  const [previewPage, setPreviewPage] = useState(1);
  const [onlyShowActiveField, setOnlyShowActiveField] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRuleData, setNewRuleData] = useState({
    itemId: '',
    range: [1, 9999],
    prob: 100,
    formula: 'power',
    params: { base: 100, power: 1.1 }
  });
  const pageSize = 15;
  const maxPreviewLevel = 100;

  // 1. 初始化：从 StageTable.xlsx 加载已有奖励，并基于前3个数据点推算成长模型及参数
  useEffect(() => {
    // 拟合算法：输入前3个数据点，返回基于 0-indexed 相对关卡拟合出的公式及参数
    const estimateFormulaAndParams = (q1, q2, q3) => {
      // 只有1个或无变化的数据点，直接设为常数
      if (q2 === undefined || q3 === undefined || (q1 === q2 && q2 === q3)) {
        return { formula: 'power', params: { base: q1, power: 0 } };
      }
      if (q1 <= 0 || q2 <= 0 || q3 <= 0) {
        return { formula: 'power', params: { base: q1, power: 0 } };
      }

      const base = q1; // 相对步长为0时，Q1 = Base

      // 1. 检查是否为阶梯线性模型 (Linear)
      // Q1 = Base, Q2 = Base * (1 + coeff), Q3 = Base * (1 + 2 * coeff)
      // d1 = Q2 - Q1 = Base * coeff, d2 = Q3 - Q2 = Base * coeff
      const d1 = q2 - q1;
      const d2 = q3 - q2;
      if (Math.abs(d1 - d2) <= 1.1) {
        const coeff = d1 / base;
        return {
          formula: 'linear',
          params: { base, coeff: Number(coeff.toFixed(4)) }
        };
      }

      // 2. 检查是否为指数模型 (Exponential)
      // Q1 = Base, Q2 = Base * growthRate, Q3 = Base * growthRate^2
      const r1 = q2 / q1;
      const r2 = q3 / q2;
      if (Math.abs(r1 - r2) < 0.01) {
        return {
          formula: 'exponential',
          params: { base, growthRate: Number(r1.toFixed(3)) }
        };
      }

      // 3. 检查是否为幂函数模型 (Power Law)
      // Q1 = Base, Q2 = Base * 2^power, Q3 = Base * 3^power
      const power = Math.log(q2 / q1) / Math.log(2);
      const expectedQ3 = q1 * Math.pow(3, power);
      if (Math.abs(q3 - expectedQ3) / q3 < 0.05) {
        return {
          formula: 'power',
          params: { base, power: Number(power.toFixed(3)) }
        };
      }

      // 兜底至幂模型拟合前2点
      return {
        formula: 'power',
        params: { base, power: Number(power.toFixed(3)) }
      };
    };

    const loadInitialFromExcel = async () => {
      setIsLoadingExcel(true);
      try {
        // 自动加载 ItemTable.xlsx 以保证道具列表最新
        try {
          const { fullData: itemData, headers: itemHeaders } = await loadExcelWorkbook('ItemTable.xlsx');
          const idIdx = itemHeaders.findIndex(h => h && h.toLowerCase() === 'id');
          const noteIdx = itemHeaders.findIndex(h => h && h.toLowerCase() === 'note');
          const nameIdx = itemHeaders.findIndex(h => h && h.toLowerCase() === 'name');
          const rateIdx = itemHeaders.findIndex(h => h && /standard|rate|price|率|价/i.test(h));
          
          const resources = itemData.slice(4).map(row => {
            if (!row[idIdx]) return null;
            return {
              id: String(row[idIdx]),
              name: row[noteIdx] || row[nameIdx] || `未命名_${row[idIdx]}`,
              langKey: row[nameIdx],
              diamondRate: Number(row[rateIdx] || 1)
            };
          }).filter(Boolean);
          if (resources.length > 0) {
            dispatch({ type: 'REPLACE_RESOURCES', payload: resources });
          }
        } catch (itemErr) {
          console.warn('Failed to load ItemTable.xlsx inside RewardConfig mount:', itemErr);
        }

        const { sheet, headers, range } = await loadExcelWorkbook('StageTable.xlsx');
        
        const idIdx = headers.indexOf('Id');
        const stageRewardIdx = headers.indexOf('StageReward');
        const stageRewardFailIdx = headers.indexOf('StageRewardFail');
        const stageRewardHardIdx = headers.indexOf('StageRewardHard');
        const stageRewardFailHardIdx = headers.indexOf('StageRewardFailHard');
        const stageRewardFirstTimetHardIdx = headers.indexOf('StageRewardFirstTimetHard');
        const idleReward1Idx = headers.indexOf('IdleReward1');

        if (idIdx !== -1) {
          const fieldsMapping = {
            'StageReward': stageRewardIdx,
            'StageRewardFail': stageRewardFailIdx,
            'StageRewardHard': stageRewardHardIdx,
            'StageRewardFailHard': stageRewardFailHardIdx,
            'StageRewardFirstTimetHard': stageRewardFirstTimetHardIdx,
            'IdleReward1': idleReward1Idx
          };

          const initialRules = {
            StageReward: [],
            StageRewardFail: [],
            StageRewardHard: [],
            StageRewardFailHard: [],
            StageRewardFirstTimetHard: [],
            IdleReward1: []
          };

          // 临时容器用于记录每个字段下每个道具 ID 首次出现的关卡，以及前3个样本数据
          // 格式: { fieldKey: { itemId: { firstLevel, q1, q2, q3 } } }
          const itemAppearances = {};

          const dataStartRowIdx = 4;
          
          for (let r = dataStartRowIdx; r <= range.e.r; r++) {
            const idCell = sheet[XLSX.utils.encode_cell({ c: idIdx, r })];
            if (!idCell || idCell.v === undefined) continue;
            
            const level = parseInt(idCell.v);
            if (isNaN(level)) continue;

            Object.entries(fieldsMapping).forEach(([fieldKey, colIdx]) => {
              if (colIdx === -1) return;
              const cell = sheet[XLSX.utils.encode_cell({ c: colIdx, r })];
              const cellValue = cell ? String(cell.v || '').trim() : '';
              if (!cellValue) return;

              const parsed = parseRewardString(cellValue);
              parsed.forEach(item => {
                if (!itemAppearances[fieldKey]) {
                  itemAppearances[fieldKey] = {};
                }

                if (!itemAppearances[fieldKey][item.itemId]) {
                  itemAppearances[fieldKey][item.itemId] = {
                    firstLevel: level,
                    q1: item.count,
                    q2: undefined,
                    q3: undefined,
                    prob: item.prob
                  };
                } else {
                  const entry = itemAppearances[fieldKey][item.itemId];
                  if (level === entry.firstLevel + 1) {
                    entry.q2 = item.count;
                  } else if (level === entry.firstLevel + 2) {
                    entry.q3 = item.count;
                  }
                }
              });
            });
          }

          // 通过前 3 个样本推断公式并初始化规则列表
          Object.entries(itemAppearances).forEach(([fieldKey, itemsObj]) => {
            Object.entries(itemsObj).forEach(([itemId, data]) => {
              const { formula, params } = estimateFormulaAndParams(data.q1, data.q2, data.q3);
              initialRules[fieldKey].push({
                id: `r_${fieldKey}_${itemId}_${data.firstLevel}`,
                itemId: String(itemId),
                range: [data.firstLevel, 9999],
                prob: data.prob || 100,
                formula,
                params
              });
            });
          });

          const hasRules = Object.values(initialRules).some(arr => arr.length > 0);
          if (hasRules) {
            setRewardsConfig(initialRules);
            localStorage.setItem('dev_toolbar_rewards_config', JSON.stringify(initialRules));
          } else {
            const saved = localStorage.getItem('dev_toolbar_rewards_config');
            if (saved) setRewardsConfig(JSON.parse(saved));
          }
        }
      } catch (e) {
        console.warn('读取 StageTable.xlsx 生成初始配置并拟合曲线失败，正在加载本地缓存:', e);
        const saved = localStorage.getItem('dev_toolbar_rewards_config');
        if (saved) {
          try {
            setRewardsConfig(JSON.parse(saved));
          } catch (err) {}
        }
      } finally {
        setIsLoadingExcel(false);
      }
    };

    loadInitialFromExcel();
  }, []);

  // 2. 保存配置到缓存
  const saveToLocal = (newConfig) => {
    setRewardsConfig(newConfig);
    localStorage.setItem('dev_toolbar_rewards_config', JSON.stringify(newConfig));
  };

  // 添加新规则 - 触发打开弹窗
  const handleAddRule = () => {
    setNewRuleData({
      itemId: state.resources?.[0]?.id || '1',
      range: [1, 9999],
      prob: 100,
      formula: 'power',
      params: { base: 100, power: 1.1 }
    });
    setIsAddModalOpen(true);
  };

  // 确认添加规则
  const handleConfirmAddRule = () => {
    const newRule = {
      id: `r_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      ...newRuleData
    };
    const newFieldRules = [...(rewardsConfig[activeField] || []), newRule];
    saveToLocal({ ...rewardsConfig, [activeField]: newFieldRules });
    setIsAddModalOpen(false);
  };

  // 删除规则
  const handleDeleteRule = (id) => {
    const newFieldRules = (rewardsConfig[activeField] || []).filter(r => r.id !== id);
    saveToLocal({ ...rewardsConfig, [activeField]: newFieldRules });
  };

  // 修改规则属性
  const handleUpdateRule = (id, key, value) => {
    const newFieldRules = (rewardsConfig[activeField] || []).map(r => {
      if (r.id === id) {
        return { ...r, [key]: value };
      }
      return r;
    });
    saveToLocal({ ...rewardsConfig, [activeField]: newFieldRules });
  };

  // 修改公式参数
  const handleUpdateParams = (id, paramKey, val) => {
    const newFieldRules = (rewardsConfig[activeField] || []).map(r => {
      if (r.id === id) {
        return {
          ...r,
          params: { ...r.params, [paramKey]: Number(val) }
        };
      }
      return r;
    });
    saveToLocal({ ...rewardsConfig, [activeField]: newFieldRules });
  };

  // 当公式类型改变时重置其对应参数
  const handleFormulaChange = (id, formula) => {
    const defaultParams = {
      power: { base: 100, power: 1.1 },
      linear: { base: 100, coeff: 0.05 },
      exponential: { base: 100, growthRate: 1.05 }
    };
    const newFieldRules = (rewardsConfig[activeField] || []).map(r => {
      if (r.id === id) {
        return {
          ...r,
          formula,
          params: defaultParams[formula] || { base: 100 }
        };
      }
      return r;
    });
    saveToLocal({ ...rewardsConfig, [activeField]: newFieldRules });
  };

  // 计算某字段在特定关卡产出的列表
  const getLevelRewards = (level, fieldKey) => {
    const rules = rewardsConfig[fieldKey] || [];
    const rewards = [];
    rules.forEach(rule => {
      const start = Number(rule.range?.[0] ?? 1);
      const end = Number(rule.range?.[1] ?? 9999);
      if (level >= start && level <= end) {
        const qty = calculateRewardQuantity(level, rule.formula, rule.params, start);
        if (qty > 0) {
          rewards.push([Number(rule.itemId), qty, Number(rule.prob || 100)]);
        }
      }
    });
    return rewards;
  };

  // 获得道具名称
  const getItemName = (itemId) => {
    const res = state.resources?.find(r => r.id === String(itemId));
    return res ? res.name : `道具 ${itemId}`;
  };

  // 同步到 Excel 表
  const handleSyncExcel = async () => {
    setIsSyncing(true);
    try {
      const result = await syncStageRewardsTable(rewardsConfig);
      alert(result.message);
    } catch (e) {
      alert('同步失败，请检查控制台及 EXTERNAL_SYNC_PATH 路径配置！');
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. 计算图表展示数据 (针对当前选中类型的第 1-50 关成长曲线)
  const chartData = useMemo(() => {
    const activeRules = rewardsConfig[activeField] || [];
    return Array.from({ length: 50 }, (_, idx) => {
      const level = idx + 1;
      const row = { level };
      activeRules.forEach(rule => {
        const start = Number(rule.range?.[0] ?? 1);
        const end = Number(rule.range?.[1] ?? 9999);
        if (level >= start && level <= end) {
          const qty = calculateRewardQuantity(level, rule.formula, rule.params, start);
          row[`${getItemName(rule.itemId)}`] = qty;
        } else {
          row[`${getItemName(rule.itemId)}`] = 0;
        }
      });
      return row;
    });
  }, [rewardsConfig, activeField, state.resources]);

  // 生成预览表格的行数据
  const tableRows = useMemo(() => {
    const rows = [];
    for (let level = 1; level <= maxPreviewLevel; level++) {
      const row = { level };
      REWARD_FIELDS.forEach(f => {
        row[f.key] = getLevelRewards(level, f.key);
      });
      rows.push(row);
    }
    return rows;
  }, [rewardsConfig]);

  // 分页列表
  const paginatedRows = useMemo(() => {
    const startIdx = (previewPage - 1) * pageSize;
    return tableRows.slice(startIdx, startIdx + pageSize);
  }, [tableRows, previewPage]);

  const totalPages = Math.ceil(tableRows.length / pageSize);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="reward-config-container"
    >
      {/* 顶部标题与同步操作 */}
      <div className="reward-header">
        <div>
          <h2><Sparkles size={22} className="glow-icon" /> 关卡资源投放工作台</h2>
          <p>基于数学曲线与关卡加成系数一键覆写 StageTable 核心奖励字段</p>
        </div>
        <button 
          className="btn-primary sync-btn" 
          disabled={isSyncing} 
          onClick={handleSyncExcel}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#00E676' }}
        >
          {isSyncing ? <RefreshCw className="spinner" size={18} /> : <Save size={18} />}
          {isSyncing ? '正在同步 Excel...' : '同步到 StageTable.xlsx'}
        </button>
      </div>

      {/* 核心工作区分栏 */}
      {isLoadingExcel ? (
        <div className="empty-rules glass" style={{ padding: '6rem 2rem', gap: '1.5rem' }}>
          <RefreshCw className="spinner" size={32} style={{ color: 'var(--accent-primary)' }} />
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>正在从 StageTable.xlsx 读取并初始化关卡奖励投放规则...</p>
        </div>
      ) : (
        <div className="reward-grid">
        
        {/* 左侧配置面板 */}
        <div className="config-card glass">
          {/* 6 大奖励类型选择 */}
          <div className="reward-tabs">
            {REWARD_FIELDS.map(f => (
              <button
                key={f.key}
                className={activeField === f.key ? 'active' : ''}
                onClick={() => setActiveField(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="rules-section">
            <div className="section-title">
              <span className="desc">{REWARD_FIELDS.find(f => f.key === activeField)?.desc} 配置链条</span>
              <button className="btn-outline add-rule-btn" onClick={handleAddRule}>
                <Plus size={16} /> 添加配置项
              </button>
            </div>

            {(!rewardsConfig[activeField] || rewardsConfig[activeField].length === 0) ? (
              <div className="empty-rules">
                <Info size={24} />
                <p>暂无投放规则，请点击“添加配置项”开始投放</p>
              </div>
            ) : (
              <div className="rules-list">
                {rewardsConfig[activeField].map((rule, idx) => (
                  <div key={rule.id} className="rule-item-card">
                    <div className="rule-header">
                      <span className="badge">规则 #{idx + 1}</span>
                      <button className="delete-btn" onClick={() => handleDeleteRule(rule.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="rule-body">
                      {/* 第一行：道具、概率、生效区间 */}
                      <div className="form-row">
                        <div className="form-group">
                          <SearchableSelect
                            value={rule.itemId}
                            onChange={(val) => handleUpdateRule(rule.id, 'itemId', val)}
                            options={state.resources?.map(res => ({
                              value: res.id,
                              label: `${res.name} (ID: ${res.id})`
                            })) || []}
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>获得概率 (%)</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={rule.prob}
                            onChange={(e) => handleUpdateRule(rule.id, 'prob', Number(e.target.value))}
                          />
                        </div>

                        <div className="form-group">
                          <label>生效关卡区间 (起 / 止)</label>
                          <div className="range-inputs">
                            <input
                              type="number"
                              placeholder="起"
                              value={rule.range?.[0] || 1}
                              onChange={(e) => handleUpdateRule(rule.id, 'range', [Number(e.target.value), rule.range?.[1] || 9999])}
                            />
                            <span className="separator">-</span>
                            <input
                              type="number"
                              placeholder="止"
                              value={rule.range?.[1] || 9999}
                              onChange={(e) => handleUpdateRule(rule.id, 'range', [rule.range?.[0] || 1, Number(e.target.value)])}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 第二行：成长模型与参数 */}
                      <div className="form-row math-row">
                        <div className="form-group">
                          <label>成长曲线模型</label>
                          <select
                            value={rule.formula}
                            onChange={(e) => handleFormulaChange(rule.id, e.target.value)}
                          >
                            {FORMULA_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {rule.formula === 'power' && (
                          <>
                            <div className="form-group">
                              <label>起始基数 (BaseValue)</label>
                              <input
                                type="number"
                                value={rule.params.base}
                                onChange={(e) => handleUpdateParams(rule.id, 'base', e.target.value)}
                              />
                            </div>
                            <div className="form-group">
                              <label>幂成长指数 (Power)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={rule.params.power}
                                onChange={(e) => handleUpdateParams(rule.id, 'power', e.target.value)}
                              />
                            </div>
                          </>
                        )}

                        {rule.formula === 'linear' && (
                          <>
                            <div className="form-group">
                              <label>起始基数 (BaseValue)</label>
                              <input
                                type="number"
                                value={rule.params.base}
                                onChange={(e) => handleUpdateParams(rule.id, 'base', e.target.value)}
                              />
                            </div>
                            <div className="form-group">
                              <label>线性加成率 (Coeff)</label>
                              <input
                                type="number"
                                step="0.001"
                                value={rule.params.coeff}
                                onChange={(e) => handleUpdateParams(rule.id, 'coeff', e.target.value)}
                              />
                            </div>
                          </>
                        )}

                        {rule.formula === 'exponential' && (
                          <>
                            <div className="form-group">
                              <label>起始基数 (BaseValue)</label>
                              <input
                                type="number"
                                value={rule.params.base}
                                onChange={(e) => handleUpdateParams(rule.id, 'base', e.target.value)}
                              />
                            </div>
                            <div className="form-group">
                              <label>单关增长率 (GrowthRate)</label>
                              <input
                                type="number"
                                step="0.001"
                                value={rule.params.growthRate}
                                onChange={(e) => handleUpdateParams(rule.id, 'growthRate', e.target.value)}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧曲线与表格数据大底预览 */}
        <div className="preview-card glass">
          <div className="tab-header">
            <h3><TrendingUp size={18} /> 成长走势与产出大底透视</h3>
          </div>

          {/* 折线走势图 */}
          <div className="chart-wrapper">
            <h4 className="chart-title">关卡第 1-50 关数量成长曲线 (当前页签)</h4>
            <div style={{ width: '100%', height: 180 }}>
              {chartData.length > 0 && Object.keys(chartData[0]).length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="level" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#1e1e24', border: '1px solid rgba(255,255,255,0.1)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {Object.keys(chartData[0]).filter(k => k !== 'level').map((key, idx) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={['#00E5FF', '#7C4DFF', '#FFAB40', '#FF5252'][idx % 4]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-chart">未添加有效的奖励项或配置</div>
              )}
            </div>
          </div>

          {/* 大底透视表 */}
          <div className="preview-table-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 className="chart-title" style={{ margin: 0 }}>关卡产出大底预览 (Id 1 至 {maxPreviewLevel})</h4>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={onlyShowActiveField} 
                  onChange={(e) => setOnlyShowActiveField(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                仅展示当前选中类型
              </label>
            </div>
            <div className="table-responsive">
              <table>
                <thead>
                  {onlyShowActiveField ? (
                    <tr>
                      <th style={{ width: '80px' }}>关卡</th>
                      <th style={{ width: '220px' }}>{REWARD_FIELDS.find(f => f.key === activeField)?.label} (JSON)</th>
                      <th>包含道具列表明细</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>关卡</th>
                      <th>普通胜利</th>
                      <th>普通失败</th>
                      <th>困难胜利</th>
                      <th>困难首通</th>
                      <th>巡逻固定</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {paginatedRows.map(row => {
                    const activeRewards = row[activeField] || [];
                    return (
                      <tr key={row.level}>
                        <td><span className="lvl-badge">关卡 {row.level}</span></td>
                        {onlyShowActiveField ? (
                          <>
                            <td className="reward-string" style={{ maxWidth: '220px', textOverflow: 'clip', whiteSpace: 'normal', fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>
                              {JSON.stringify(activeRewards)}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {activeRewards.length === 0 ? (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>无奖励投放</span>
                                ) : (
                                  activeRewards.map(([itemId, count, prob], i) => (
                                    <span 
                                      key={i} 
                                      className="reward-item-badge"
                                      style={{ 
                                        background: 'rgba(0, 229, 255, 0.1)', 
                                        border: '1px solid rgba(0, 229, 255, 0.2)',
                                        color: '#00E5FF',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '0.72rem'
                                      }}
                                    >
                                      {getItemName(itemId)} x{count} ({prob}%)
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="reward-string">{JSON.stringify(row.StageReward)}</td>
                            <td className="reward-string">{JSON.stringify(row.StageRewardFail)}</td>
                            <td className="reward-string">{JSON.stringify(row.StageRewardHard)}</td>
                            <td className="reward-string">{JSON.stringify(row.StageRewardFirstTimetHard)}</td>
                            <td className="reward-string">{JSON.stringify(row.IdleReward1)}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 分页组件 */}
            <div className="pagination">
              <button 
                disabled={previewPage === 1} 
                onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span>{previewPage} / {totalPages} 页</span>
              <button 
                disabled={previewPage === totalPages} 
                onClick={() => setPreviewPage(p => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

        </div>

        </div>
      )}

      {/* 添加规则的弹窗 */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
              <Plus size={20} /> 添加投放项配置
            </h3>
            
            <div className="rule-body" style={{ marginTop: '0.5rem' }}>
              <div className="form-row" style={{ gridTemplateColumns: '1.2fr 0.8fr' }}>
                <div className="form-group">
                  <label>投放道具</label>
                  <SearchableSelect
                    value={newRuleData.itemId}
                    onChange={(val) => setNewRuleData({ ...newRuleData, itemId: val })}
                    options={state.resources?.map(res => ({
                      value: res.id,
                      label: `${res.name} (ID: ${res.id})`
                    })) || []}
                  />
                </div>
                <div className="form-group">
                  <label>获得概率 (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newRuleData.prob}
                    onChange={(e) => setNewRuleData({ ...newRuleData, prob: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>生效关卡区间 (起 / 止)</label>
                <div className="range-inputs">
                  <input
                    type="number"
                    placeholder="起"
                    value={newRuleData.range[0]}
                    onChange={(e) => setNewRuleData({ ...newRuleData, range: [Number(e.target.value), newRuleData.range[1]] })}
                  />
                  <span className="separator">-</span>
                  <input
                    type="number"
                    placeholder="止"
                    value={newRuleData.range[1]}
                    onChange={(e) => setNewRuleData({ ...newRuleData, range: [newRuleData.range[0], Number(e.target.value)] })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>成长曲线模型</label>
                <select
                  value={newRuleData.formula}
                  onChange={(e) => {
                    const formula = e.target.value;
                    const defaultParams = {
                      power: { base: 100, power: 1.1 },
                      linear: { base: 100, coeff: 0.05 },
                      exponential: { base: 100, growthRate: 1.05 }
                    };
                    setNewRuleData({
                      ...newRuleData,
                      formula,
                      params: defaultParams[formula] || { base: 100 }
                    });
                  }}
                >
                  {FORMULA_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row math-row" style={{ gridTemplateColumns: '1fr 1fr', background: 'rgba(0,0,0,0.2)', margin: 0 }}>
                {newRuleData.formula === 'power' && (
                  <>
                    <div className="form-group">
                      <label>起始基数</label>
                      <input
                        type="number"
                        value={newRuleData.params.base}
                        onChange={(e) => setNewRuleData({
                          ...newRuleData,
                          params: { ...newRuleData.params, base: Number(e.target.value) }
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label>幂成长指数</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newRuleData.params.power}
                        onChange={(e) => setNewRuleData({
                          ...newRuleData,
                          params: { ...newRuleData.params, power: Number(e.target.value) }
                        })}
                      />
                    </div>
                  </>
                )}

                {newRuleData.formula === 'linear' && (
                  <>
                    <div className="form-group">
                      <label>起始基数</label>
                      <input
                        type="number"
                        value={newRuleData.params.base}
                        onChange={(e) => setNewRuleData({
                          ...newRuleData,
                          params: { ...newRuleData.params, base: Number(e.target.value) }
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label>线性加成率</label>
                      <input
                        type="number"
                        step="0.001"
                        value={newRuleData.params.coeff}
                        onChange={(e) => setNewRuleData({
                          ...newRuleData,
                          params: { ...newRuleData.params, coeff: Number(e.target.value) }
                        })}
                      />
                    </div>
                  </>
                )}

                {newRuleData.formula === 'exponential' && (
                  <>
                    <div className="form-group">
                      <label>起始基数</label>
                      <input
                        type="number"
                        value={newRuleData.params.base}
                        onChange={(e) => setNewRuleData({
                          ...newRuleData,
                          params: { ...newRuleData.params, base: Number(e.target.value) }
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label>单关增长率</label>
                      <input
                        type="number"
                        step="0.001"
                        value={newRuleData.params.growthRate}
                        onChange={(e) => setNewRuleData({
                          ...newRuleData,
                          params: { ...newRuleData.params, growthRate: Number(e.target.value) }
                        })}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button className="btn-outline" style={{ flex: 1 }} onClick={() => setIsAddModalOpen(false)}>取消</button>
              <button className="btn-primary" style={{ flex: 1, background: 'var(--accent-primary)' }} onClick={handleConfirmAddRule}>确认添加</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .reward-config-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          color: var(--text-primary);
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
        }
        .modal-content {
          width: 90%;
          max-width: 500px;
          background: #141419;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .reward-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(20, 20, 25, 0.4);
          padding: 1.2rem 2rem;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .reward-header h2 {
          font-size: 1.3rem;
          margin: 0 0 4px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .reward-header p {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin: 0;
        }
        .glow-icon {
          color: #FFAB40;
          filter: drop-shadow(0 0 8px rgba(255, 171, 64, 0.5));
        }
        .reward-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 1.5rem;
        }
        .config-card, .preview-card {
          padding: 1.5rem;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.01);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .reward-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .reward-tabs button {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          color: var(--text-secondary);
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.2s;
        }
        .reward-tabs button:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
        }
        .reward-tabs button.active {
          background: var(--accent-primary);
          color: white;
          border-color: var(--accent-primary);
        }
        .rules-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .section-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .section-title .desc {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--accent-secondary);
        }
        .add-rule-btn {
          font-size: 0.75rem;
          padding: 4px 10px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .rules-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-height: 480px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .rule-item-card {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 10px;
          padding: 1rem;
        }
        .rule-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.8rem;
        }
        .rule-header .badge {
          background: rgba(124, 77, 255, 0.15);
          color: var(--accent-primary);
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: bold;
        }
        .delete-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: color 0.2s;
        }
        .delete-btn:hover {
          color: #FF5252;
        }
        .rule-body {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 0.8fr 1.2fr;
          gap: 1rem;
        }
        .form-row.math-row {
          grid-template-columns: 1fr 1fr 1fr;
          background: rgba(255, 255, 255, 0.02);
          padding: 8px;
          border-radius: 8px;
          border: 1px dashed rgba(255, 255, 255, 0.05);
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .form-group label {
          font-size: 0.7rem;
          color: var(--text-muted);
        }
        .form-group input, .form-group select {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 0.8rem;
        }
        .form-group select option {
          background-color: #1e1e24;
          color: #ffffff;
        }
        .range-inputs {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .range-inputs input {
          width: 50%;
        }
        .range-inputs .separator {
          color: var(--text-muted);
        }
        .empty-rules {
          padding: 3rem 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 0.8rem;
          text-align: center;
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
          gap: 8px;
        }
        
        /* 右侧面板 */
        .chart-wrapper {
          background: rgba(0,0,0,0.2);
          padding: 1rem;
          border-radius: 12px;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(255,255,255,0.03);
        }
        .chart-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin: 0 0 12px 0;
        }
        .empty-chart {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 0.8rem;
        }
        .preview-table-section {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }
        .table-responsive {
          max-height: 380px;
          overflow-y: auto;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px;
          background: rgba(0,0,0,0.15);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.78rem;
        }
        th, td {
          padding: 8px 12px;
          text-align: left;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        th {
          color: var(--text-muted);
          font-weight: 500;
          background: rgba(0,0,0,0.3);
          position: sticky;
          top: 0;
        }
        tr:hover {
          background: rgba(255,255,255,0.02);
        }
        .lvl-badge {
          background: rgba(255,255,255,0.08);
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: bold;
        }
        .reward-string {
          font-family: monospace;
          color: var(--accent-secondary);
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 1rem;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 4px;
        }
        .pagination button {
          background: rgba(255,255,255,0.05);
          border: none;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
        }
        .pagination button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
};

export default RewardConfig;
