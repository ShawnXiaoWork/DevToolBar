import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useGame } from '../context/GameContext';
import { 
  Users, 
  Target, 
  BarChart3, 
  ShieldAlert, 
  Plus, 
  Upload,
  Trash2, 
  Edit3,
  TrendingUp,
  Settings,
  PieChart as PieChartIcon,
  Sword,
  Zap,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

/**
 * 计算单个兵种的综合战力评分 (Power Score)
 * 公式: (生命*0.1 + 攻击) * (1 + 攻速/100) * (1 + 技能强度/100)
 */
const calculatePowerScore = (unit) => {
  const base = (unit.hp * 0.1) + unit.atk;
  const multipliers = (1 + (unit.spd || 0) / 100) * (1 + (unit.skillPower || 0) / 100);
  return Math.round(base * multipliers);
};

/**
 * 计算关卡难度预算 (专业数值策划版本)
 * 采用“阶梯式章节模型”：
 * 1. 章节基础成长 (Chapter Growth)
 * 2. 章节内线性/指数压力 (Intra-chapter Tension)
 * 3. 越迁点爆发 (Spike/Boss)
 * 4. 战后释放/心流调节 (Post-Boss Relaxation/Valley)
 */
const getLevelBudget = (level, config) => {
  const { baseScore, difficultyFactor, spikes } = config;
  const interval = 10; // 假设每10关为一个章节循环
  
  // A. 基础曲线 (幂函数基础)
  let budget = baseScore * Math.pow(level, difficultyFactor);
  
  // B. 难度越迁逻辑
  // 1. 累计台阶系数 (Tier Shift / Chapter Shift)
  const steps = (spikes || []).filter(s => s.type === 'step' && level >= s.level);
  let stepHpMultiplier = 1;
  let stepAtkMultiplier = 1;
  steps.forEach(s => {
    stepHpMultiplier *= (s.hpMultiplier || 1);
    stepAtkMultiplier *= (s.atkMultiplier || 1);
  });
  
  // 综合台阶系数 = HP倍率 * ATK倍率
  budget *= (stepHpMultiplier * stepAtkMultiplier);

  // 2. 瞬时峰值系数 (Boss Spike)
  const currentPeak = (spikes || []).find(s => s.level === level && (s.type === 'peak' || !s.type));
  if (currentPeak) {
    budget *= (currentPeak.hpMultiplier || 1) * (currentPeak.atkMultiplier || 1);
  }
  
  // C. 心流调节逻辑 (Flow Control) - 数值策划核心
  // 如果是 Boss 后的第一关 (例如 11, 21...)，给予一定的难度下调，让玩家感受“割草”快感
  if (level > 1 && (level - 1) % interval === 0) {
    budget *= 0.85; // 15% 的难度回落 (Valley)
  }
  
  // 如果是临近 Boss 的关卡 (例如 9, 19...)，提前增加压力感 (Tension)
  if (level % interval === 9) {
    budget *= 1.1; // 10% 的压力上升
  }

  return Math.round(budget);
};

const COLORS = ['#7C4DFF', '#00E5FF', '#00E676', '#FFAB40', '#FF5252', '#F48FB1'];

const LevelMaker = () => {
  const { state, dispatch } = useGame();
  const [activeTab, setActiveTab] = useState('units'); // 'units' | 'budget' | 'analysis'
  const [editingUnit, setEditingUnit] = useState(null);
  const [previewLevel, setPreviewLevel] = useState(1);
  const [previewRange, setPreviewRange] = useState(20);
  const [unitFilter, setUnitFilter] = useState({ name: '', roles: [], sortBy: 'score' });

  // --- 兵种过滤逻辑 ---
  const filteredUnits = useMemo(() => {
    return state.units
      .filter(u => {
        const matchName = u.name.toLowerCase().includes(unitFilter.name.toLowerCase());
        // 多选逻辑：如果没选则匹配全部，如果选了则匹配包含任意一个选中标签的兵种
        const matchRoles = unitFilter.roles.length === 0 || 
                          unitFilter.roles.some(r => u.roles.includes(r));
        return matchName && matchRoles;
      })
      .sort((a, b) => {
        if (unitFilter.sortBy === 'score') return calculatePowerScore(b) - calculatePowerScore(a);
        if (unitFilter.sortBy === 'hp') return b.hp - a.hp;
        if (unitFilter.sortBy === 'atk') return b.atk - a.atk;
        return 0;
      });
  }, [state.units, unitFilter]);

  // 提取所有可用标签
  const allRoles = useMemo(() => {
    const roles = new Set();
    state.units.forEach(u => u.roles.forEach(r => roles.add(r)));
    return Array.from(roles);
  }, [state.units]);
  const handleSaveUnit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const unitData = {
      id: editingUnit?.id || `unit_${Date.now()}`,
      name: formData.get('name'),
      hp: Number(formData.get('hp')),
      atk: Number(formData.get('atk')),
      spd: Number(formData.get('spd')),
      skillPower: Number(formData.get('skillPower')),
      roles: formData.get('roles').split(',').map(s => s.trim()),
      spawnWeight: Number(formData.get('spawnWeight'))
    };

    if (editingUnit) {
      dispatch({ type: 'UPDATE_UNIT', payload: unitData });
    } else {
      dispatch({ type: 'ADD_UNIT', payload: unitData });
    }
    setEditingUnit(null);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let importedUnits = [];

      try {
        if (file.name.endsWith('.json')) {
          const content = event.target.result;
          importedUnits = JSON.parse(content);
        } else if (file.name.endsWith('.csv')) {
          const content = event.target.result;
          // 简单的 CSV 解析 (逗号或制表符)
          const lines = content.split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          
          importedUnits = lines.slice(1).filter(line => line.trim()).map(line => {
            const values = line.split(',');
            const unit = {};
            headers.forEach((header, index) => {
              let val = values[index]?.trim();
              if (['hp', 'atk', 'spd', 'skillPower', 'spawnWeight'].includes(header)) {
                unit[header] = Number(val);
              } else if (header === 'roles') {
                unit[header] = val ? val.split('|').map(r => r.trim()) : [];
              } else {
                unit[header] = val;
              }
            });
            unit.id = `unit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            return unit;
          });
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // 针对 ArmyTable.xlsx 模板的特殊解析
          // 第一行通常是字段名，第二行是中文描述/类型 (取决于具体导出工具)
          // 根据之前分析：Speed 是列0, Hp 是列8, Attack 是列9, Name 是列26, ArmyTag 是列4
          // 注意：jsonData[0] 是原始表头，jsonData[1] 可能也是描述
          
          const startRow = 3; // 根据分析：Row 0 是说明，Row 1 是表头，Row 2 是类型，数据从 Row 3 开始
          
          importedUnits = jsonData.slice(startRow).filter(row => {
            if (!row) return false;
            const name = row[26];
            const hp = Number(row[7] || 0);
            const atk = Number(row[8] || 0);
            return name && (hp > 0 || atk > 0);
          }).map(row => {
            // 根据 ArmyTable.xlsx 实测分析：
            // 26: Name, 7: Hp, 8: Attack, 15: Speed, 3: ArmyTag
            return {
              id: `unit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              name: row[26] || '未命名', 
              hp: Number(row[7] || 0), 
              atk: Number(row[8] || 0), 
              spd: Number(row[15] || 0), 
              skillPower: 0,
              roles: row[3] ? String(row[3]).split('|').map(r => r.trim()) : [], 
              spawnWeight: 50
            };
          });
        }

        if (importedUnits.length > 0) {
          dispatch({ type: 'IMPORT_UNITS', payload: importedUnits });
          alert(`成功导入 ${importedUnits.length} 个兵种！`);
        }
      } catch (error) {
        console.error('Import failed:', error);
        alert('导入失败，请检查文件格式。');
      }
    };

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  // --- 数据分析计算 ---
  const levelConfig = state.levelConfig || { baseScore: 100, difficultyFactor: 1.2 };

  // 1. 难度梯度数据
  const difficultyData = useMemo(() => {
    return Array.from({ length: previewRange }, (_, i) => ({
      level: i + 1,
      budget: getLevelBudget(i + 1, levelConfig)
    }));
  }, [levelConfig, previewRange]);

  // 2. 模拟关卡分析
  const analysisResult = useMemo(() => {
    const budget = getLevelBudget(previewLevel, levelConfig);
    
    // 简单配比算法：
    // a. 筛选所有兵种并计算分值
    const scoredUnits = state.units.map(u => ({ ...u, score: calculatePowerScore(u) }));
    
    // b. 尝试覆盖不同标签 (简单策略: 选3个不同标签的兵种)
    const selected = [];
    let remainingBudget = budget;
    
    // 按权重排序并随机挑选
    const pool = [...scoredUnits].sort((a, b) => b.spawnWeight - a.spawnWeight);
    
    // 填充 3 种兵种
    for (let i = 0; i < Math.min(3, pool.length); i++) {
      const unit = pool[i];
      const count = Math.max(1, Math.floor((budget / pool.length) / unit.score));
      selected.push({ ...unit, count });
      remainingBudget -= count * unit.score;
    }

    // 计算职能分布
    const roleStats = {};
    selected.forEach(s => {
      s.roles.forEach(role => {
        roleStats[role] = (roleStats[role] || 0) + s.count;
      });
    });

    const pieData = Object.entries(roleStats).map(([name, value]) => ({ name, value }));

    // 强度检测报告
    const warnings = [];
    const avgScore = budget / (selected.reduce((sum, s) => sum + s.count, 0) || 1);
    
    if (avgScore > 200) warnings.push({ type: 'danger', text: '当前关卡单位战力过高，可能会造成玩家瞬间死亡，建议增加杂鱼单位比例。' });
    if (!pieData.some(d => d.name.includes('坦克'))) warnings.push({ type: 'warning', text: '关卡缺乏前排抗伤单位，远程玩家可能会轻松风筝全场。' });
    if (previewLevel > 10 && !selected.some(s => s.skillPower > 20)) warnings.push({ type: 'info', text: '高层关卡建议增加带有“词缀”或“高技能强度”的精英单位以增加挑战性。' });

    return { selected, budget, pieData, warnings };
  }, [state.units, levelConfig, previewLevel]);

  // 3. 全关卡自动规划规划算法 (制作人视角 - 属性基数驱动版)
  const fullLevelPlan = useMemo(() => {
    if (state.units.length === 0) return [];
    
    return Array.from({ length: previewRange }, (_, i) => {
      const level = i + 1;
      
      // A. 计算该关卡的属性加成基数 (基于越迁配置)
      const steps = (levelConfig.spikes || []).filter(s => s.type === 'step' && level >= s.level);
      let hpCoeff = 1;
      let atkCoeff = 1;
      steps.forEach(s => {
        hpCoeff *= (s.hpMultiplier || 1);
        atkCoeff *= (s.atkMultiplier || 1);
      });
      
      // 如果是峰值关卡，叠加峰值系数
      const peak = (levelConfig.spikes || []).find(s => s.level === level && s.type === 'peak');
      if (peak) {
        hpCoeff *= (peak.hpMultiplier || 1);
        atkCoeff *= (peak.atkMultiplier || 1);
      }

      // B. 计算该关卡的总预算
      const budget = getLevelBudget(level, levelConfig);
      
      // C. 实时计算在该属性基数下的兵种“实际分值”
      const scaledUnits = state.units.map(u => {
        const scaledUnit = {
          ...u,
          hp: Math.round(u.hp * hpCoeff),
          atk: Math.round(u.atk * atkCoeff)
        };
        return {
          ...scaledUnit,
          scaledScore: calculatePowerScore(scaledUnit)
        };
      });

      // D. 贪婪填充算法 (确保不落空且数量合理)
      const selected = [];
      let remaining = budget;

      // 兵种池分类
      const tanks = scaledUnits.filter(u => u.roles.some(r => r.includes('1') || r.includes('坦克')));
      const dps = scaledUnits.filter(u => u.roles.some(r => r.includes('2') || r.includes('输出')));
      const allPool = [...scaledUnits].sort((a, b) => a.scaledScore - b.scaledScore); // 从便宜的开始保底

      // 1. 优先保底：每个核心职能至少出一个 (如果预算够)
      [tanks, dps].forEach(pool => {
        if (pool.length > 0) {
          const unit = pool[Math.floor(Math.random() * pool.length)];
          if (remaining >= unit.scaledScore) {
            selected.push({ ...unit, count: 1 });
            remaining -= unit.scaledScore;
          }
        }
      });

      // 2. 剩余预算填充：随机挑选并批量填充
      let attempts = 0;
      while (remaining > allPool[0]?.scaledScore && attempts < 10) {
        const unit = allPool[Math.floor(Math.random() * allPool.length)];
        if (remaining >= unit.scaledScore) {
          // 这里的数量计算要克制，避免单一种类过多
          const maxDesired = Math.max(1, Math.floor(budget / 5 / unit.scaledScore)); 
          const count = Math.min(maxDesired, Math.floor(remaining / unit.scaledScore));
          
          if (count > 0) {
            const existing = selected.find(s => s.id === unit.id);
            if (existing) {
              existing.count += count;
            } else {
              selected.push({ ...unit, count });
            }
            remaining -= count * unit.scaledScore;
          }
        }
        attempts++;
      }

      return { level, budget, selected, hpCoeff, atkCoeff, isBossLevel: !!peak };
    });
  }, [state.units, levelConfig, previewRange]);

  return (
    <div className="level-maker-container">
      {/* 顶部导航 */}
      <div className="module-tabs">
        <button className={activeTab === 'units' ? 'active' : ''} onClick={() => setActiveTab('units')}>
          <Users size={18} /> 兵种建模库
        </button>
        <button className={activeTab === 'budget' ? 'active' : ''} onClick={() => setActiveTab('budget')}>
          <Target size={18} /> 难度预算配置
        </button>
        <button className={activeTab === 'plan' ? 'active' : ''} onClick={() => setActiveTab('plan')}>
          <TrendingUp size={18} /> 全关卡部署规划
        </button>
        <button className={activeTab === 'analysis' ? 'active' : ''} onClick={() => setActiveTab('analysis')}>
          <BarChart3 size={18} /> 单关模拟分析
        </button>
      </div>

      <div className="module-content">
        <AnimatePresence mode="wait">
          {/* 1. 兵种建模库 */}
          {activeTab === 'units' && (
            <motion.div 
              key="units"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="units-grid"
            >
              <div className="action-bar">
                <h2 style={{ fontSize: '1.2rem' }}>兵种定义 ({state.units.length})</h2>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input 
                    type="file" 
                    id="unit-import" 
                    style={{ display: 'none' }} 
                    accept=".json,.csv,.xlsx,.xls"
                    onChange={handleImport}
                  />
                  <button className="btn-outline" onClick={() => document.getElementById('unit-import').click()}>
                    <Upload size={16} /> 导入配置 (Excel/CSV/JSON)
                  </button>
                  <button className="btn-primary" onClick={() => setEditingUnit({})}>
                    <Plus size={16} /> 新增兵种
                  </button>
                </div>
              </div>

              {/* 筛选与搜索工具栏 */}
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
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="unit-cards">
                {filteredUnits.map(unit => (
                  <div key={unit.id} className="unit-card glass">
                    <div className="unit-card-header">
                      <h3>{unit.name}</h3>
                      <div className="score-badge">{calculatePowerScore(unit)} pt</div>
                    </div>
                    <div className="unit-stats-grid">
                      <div className="stat-row"><span>HP:</span> <b>{unit.hp}</b></div>
                      <div className="stat-row"><span>ATK:</span> <b>{unit.atk}</b></div>
                      <div className="stat-row"><span>SPD:</span> <b>{unit.spd}</b></div>
                      <div className="stat-row"><span>SKL:</span> <b>{unit.skillPower}</b></div>
                    </div>
                    <div className="unit-tags">
                      {unit.roles.map(role => <span key={role} className="tag">{role}</span>)}
                    </div>
                    <div className="unit-actions">
                      <button onClick={() => setEditingUnit(unit)}><Edit3 size={14} /></button>
                      <button className="delete" onClick={() => dispatch({ type: 'DELETE_UNIT', payload: unit.id })}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 兵种编辑 Modal (内联实现) */}
              {editingUnit && (
                <div className="modal-overlay">
                  <div className="modal-content glass">
                    <h3>{editingUnit.id ? '编辑兵种' : '新增兵种'}</h3>
                    <form onSubmit={handleSaveUnit}>
                      <div className="input-group">
                        <label>名称</label>
                        <input name="name" defaultValue={editingUnit.name} required />
                      </div>
                      <div className="input-row">
                        <div className="input-group">
                          <label>生命值 (HP)</label>
                          <input type="number" name="hp" defaultValue={editingUnit.hp || 100} required />
                        </div>
                        <div className="input-group">
                          <label>攻击力 (ATK)</label>
                          <input type="number" name="atk" defaultValue={editingUnit.atk || 10} required />
                        </div>
                      </div>
                      <div className="input-row">
                        <div className="input-group">
                          <label>速度 (SPD)</label>
                          <input type="number" name="spd" defaultValue={editingUnit.spd || 10} required />
                        </div>
                        <div className="input-group">
                          <label>技能强度</label>
                          <input type="number" name="skillPower" defaultValue={editingUnit.skillPower || 0} required />
                        </div>
                      </div>
                      <div className="input-group">
                        <label>职能标签 (逗号分隔)</label>
                        <input name="roles" defaultValue={editingUnit.roles?.join(', ') || '近战, 物理'} required />
                      </div>
                      <div className="input-group">
                        <label>出现权重 (Spawn Weight)</label>
                        <input type="number" name="spawnWeight" defaultValue={editingUnit.spawnWeight || 50} required />
                      </div>
                      <div className="modal-footer">
                        <button type="button" onClick={() => setEditingUnit(null)}>取消</button>
                        <button type="submit" className="btn-primary">保存</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* 2. 难度预算配置 */}
          {activeTab === 'budget' && (
            <motion.div 
              key="budget"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="budget-config"
            >
              <div className="chart-container glass" style={{ marginBottom: '2rem' }}>
                <h3>全关卡难度梯度预测 (Total Budget Curve)</h3>
                <div style={{ height: '300px', marginTop: '1rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={difficultyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="level" label={{ value: '层数 (Level)', position: 'insideBottom', offset: -5 }} stroke="var(--text-muted)" />
                      <YAxis stroke="var(--text-muted)" />
                      <Tooltip 
                        contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--accent-primary)' }}
                      />
                      <Line type="monotone" dataKey="budget" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="config-panel glass">
                <h3><Settings size={18} /> 难度公式参数</h3>
                <div className="params-grid">
                  <div className="param-item">
                    <label>基础积分 (BaseScore)</label>
                    <input 
                      type="number" 
                      value={levelConfig.baseScore} 
                      onChange={(e) => dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { baseScore: Number(e.target.value) }})}
                    />
                    <p>第1层关卡的起始总战力值</p>
                  </div>
                  <div className="param-item">
                    <label>难度因子 (DifficultyFactor)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={levelConfig.difficultyFactor} 
                      onChange={(e) => dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { difficultyFactor: Number(e.target.value) }})}
                    />
                    <p>数值越高，后期关卡难度飙升越快</p>
                  </div>
                  <div className="param-item">
                    <label>预测关卡总数 (Preview Levels)</label>
                    <input 
                      type="number" 
                      min="1"
                      max="1000"
                      value={previewRange} 
                      onChange={(e) => setPreviewRange(Number(e.target.value))}
                    />
                    <p>设置图表中预览展示的关卡数量</p>
                  </div>
                </div>

                {/* 难度越迁设置 */}
                <div className="spikes-section" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-warning)' }}>
                      <TrendingUp size={16} /> 难度越迁 (Difficulty Spikes)
                    </h4>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button className="btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => {
                        const interval = 10; 
                        const newSpikes = [];
                        for (let i = interval; i <= previewRange; i += interval) {
                          const chapter = Math.floor(i / interval);
                          const isMajorChapter = chapter % 5 === 0;
                          
                          // 1. 添加峰值 (Boss 爆发) - 偏向攻击性增长
                          newSpikes.push({ 
                            level: i, 
                            hpMultiplier: isMajorChapter ? 1.4 : 1.2,
                            atkMultiplier: isMajorChapter ? 1.6 : 1.3,
                            type: 'peak',
                            note: isMajorChapter ? `第 ${chapter/5} 章节终极 Boss` : `第 ${chapter} 阶段精英战` 
                          });
                          
                          // 2. 添加台阶 (难度整体上行) - 稳健的双向增长
                          newSpikes.push({ 
                            level: i, 
                            hpMultiplier: 1.1,
                            atkMultiplier: 1.1,
                            type: 'step',
                            note: `第 ${chapter} 章节难度台阶` 
                          });
                        }
                        dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes }});
                      }}>
                        <Zap size={14} /> 自动生成章节模型
                      </button>
                      <button className="btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => {
                        const newSpike = { level: previewRange / 2, hpMultiplier: 1.2, atkMultiplier: 1.2, type: 'peak', note: '新越迁点' };
                        dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: [...(levelConfig.spikes || []), newSpike] }});
                      }}>
                        <Plus size={14} /> 添加手动点
                      </button>
                    </div>
                  </div>
                  
                  <div className="spikes-list">
                    {(levelConfig.spikes || []).map((spike, idx) => (
                      <div key={idx} className="spike-row glass" style={{ display: 'flex', gap: '1rem', padding: '1rem', borderRadius: '8px', marginBottom: '0.5rem', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>关卡层级</label>
                          <input 
                            type="number" 
                            value={spike.level} 
                            onChange={(e) => {
                              const newSpikes = [...levelConfig.spikes];
                              newSpikes[idx].level = Number(e.target.value);
                              dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes }});
                            }}
                            style={{ width: '100%', padding: '4px', marginTop: '4px' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>血量倍率 (HP)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            value={spike.hpMultiplier || 1} 
                            onChange={(e) => {
                              const newSpikes = [...levelConfig.spikes];
                              newSpikes[idx].hpMultiplier = Number(e.target.value);
                              dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes }});
                            }}
                            style={{ width: '100%', padding: '4px', marginTop: '4px' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>攻击倍率 (ATK)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            value={spike.atkMultiplier || 1} 
                            onChange={(e) => {
                              const newSpikes = [...levelConfig.spikes];
                              newSpikes[idx].atkMultiplier = Number(e.target.value);
                              dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes }});
                            }}
                            style={{ width: '100%', padding: '4px', marginTop: '4px' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>类型</label>
                          <select 
                            value={spike.type || 'peak'} 
                            onChange={(e) => {
                              const newSpikes = [...levelConfig.spikes];
                              newSpikes[idx].type = e.target.value;
                              dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes }});
                            }}
                            style={{ width: '100%', padding: '4px', marginTop: '4px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
                          >
                            <option value="peak">峰值 (Boss)</option>
                            <option value="step">台阶 (Tier)</option>
                          </select>
                        </div>
                        <div style={{ flex: 2 }}>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>备注</label>
                          <input 
                            type="text" 
                            value={spike.note} 
                            onChange={(e) => {
                              const newSpikes = [...levelConfig.spikes];
                              newSpikes[idx].note = e.target.value;
                              dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes }});
                            }}
                            style={{ width: '100%', padding: '4px', marginTop: '4px' }}
                          />
                        </div>
                        <button className="delete" style={{ padding: '8px', background: 'none', border: 'none', color: '#FF5252', cursor: 'pointer' }} onClick={() => {
                          const newSpikes = levelConfig.spikes.filter((_, i) => i !== idx);
                          dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes }});
                        }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {(levelConfig.spikes || []).length === 0 && (
                      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>暂未设置越迁关卡，难度将平滑增长。</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="chart-container glass">
                <h3>全关卡难度梯度预测 (Total Budget Curve)</h3>
                <div style={{ height: '300px', marginTop: '1rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={difficultyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="level" label={{ value: '层数 (Level)', position: 'insideBottom', offset: -5 }} stroke="var(--text-muted)" />
                      <YAxis stroke="var(--text-muted)" />
                      <Tooltip 
                        contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--accent-primary)' }}
                      />
                      <Line type="monotone" dataKey="budget" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {/* 3. 全关卡部署规划 */}
          {activeTab === 'plan' && (
            <motion.div 
              key="plan"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="full-plan-container"
            >
              <div className="plan-header glass">
                <div className="plan-info">
                  <h2>全关卡自动部署规划 (Producer Plan)</h2>
                  <p>基于当前难度曲线与兵种库，系统已自动计算并分配了前 {previewRange} 关的敌军阵容。</p>
                </div>
                <button className="btn-primary" onClick={() => {
                  const content = JSON.stringify(fullLevelPlan, null, 2);
                  const blob = new Blob([content], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `level_plan_${Date.now()}.json`;
                  a.click();
                }}>
                  <Upload size={16} /> 导出配置 (JSON)
                </button>
              </div>

              <div className="plan-list">
                {fullLevelPlan.map((p) => (
                  <div key={p.level} className={`plan-row glass ${p.isBossLevel ? 'boss-row' : ''}`}>
                    <div className="row-level">
                      <span className="badge">Floor {p.level}</span>
                      {p.isBossLevel && <span className="boss-tag">BOSS</span>}
                    </div>
                    <div className="row-coeffs">
                      <div className="coeff-item">
                        <label>HP 基数</label>
                        <span>{p.hpCoeff.toFixed(2)}x</span>
                      </div>
                      <div className="coeff-item">
                        <label>ATK 基数</label>
                        <span>{p.atkCoeff.toFixed(2)}x</span>
                      </div>
                    </div>
                    <div className="row-budget">
                      <label>总预算</label>
                      <span>{p.budget} pt</span>
                    </div>
                    <div className="row-units">
                      <label>兵种配置</label>
                      <div className="unit-chips">
                        {p.selected.map((s, idx) => (
                          <div key={idx} className="unit-chip">
                            <span className="name">{s.name}</span>
                            <span className="count">x{s.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="row-roles">
                      <label>职能配比</label>
                      <div className="role-dots">
                        {p.selected.some(s => s.roles.some(r => r.includes('1') || r.includes('坦克'))) && <div className="dot tank" title="有坦克" />}
                        {p.selected.some(s => s.roles.some(r => r.includes('2') || r.includes('输出'))) && <div className="dot dps" title="有输出" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 4. 单关模拟分析 */}
          {activeTab === 'analysis' && (
            <motion.div 
              key="analysis"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="analysis-dashboard"
            >
              <div className="analysis-header">
                <div className="level-selector">
                  <span>预览层数:</span>
                  <input 
                    type="range" min="1" max="50" 
                    value={previewLevel} 
                    onChange={(e) => setPreviewLevel(Number(e.target.value))} 
                  />
                  <b>Floor {previewLevel}</b>
                </div>
                <div className="budget-badge">
                  当前预算: <span>{analysisResult.budget} pt</span>
                </div>
              </div>

              <div className="analysis-grid">
                {/* 敌人清单 */}
                <div className="analysis-card glass">
                  <h3><Sword size={18} color="var(--accent-danger)" /> 模拟投放清单</h3>
                  <div className="enemy-list">
                    {analysisResult.selected.map((s, i) => (
                      <div key={i} className="enemy-item">
                        <div className="enemy-info">
                          <span className="enemy-name">{s.name}</span>
                          <span className="enemy-count">x {s.count}</span>
                        </div>
                        <div className="enemy-total">{s.count * s.score} pt</div>
                      </div>
                    ))}
                  </div>
                  <button className="btn-outline" style={{ marginTop: '1rem', width: '100%' }}>
                    <Zap size={14} /> 重新随机配比
                  </button>
                </div>

                {/* 职能分布 */}
                <div className="analysis-card glass">
                  <h3><PieChartIcon size={18} color="var(--accent-secondary)" /> 兵种职能分布</h3>
                  <div style={{ height: '200px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analysisResult.pieData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {analysisResult.pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="role-legend">
                    {analysisResult.pieData.map((d, i) => (
                      <div key={i} className="legend-item">
                        <span style={{ background: COLORS[i % COLORS.length] }}></span>
                        {d.name}: {d.value}个
                      </div>
                    ))}
                  </div>
                </div>

                {/* 分析报告 */}
                <div className="analysis-card glass report-card">
                  <h3><ShieldAlert size={18} color="var(--accent-warning)" /> 平台分析报告</h3>
                  <div className="warning-list">
                    {analysisResult.warnings.map((w, i) => (
                      <div key={i} className={`warning-item ${w.type}`}>
                        <Activity size={14} />
                        <p>{w.text}</p>
                      </div>
                    ))}
                    {analysisResult.warnings.length === 0 && (
                      <div className="warning-item success">
                        <Zap size={14} />
                        <p>当前平衡度良好，建议投放。</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .level-maker-container {
          padding: 2rem;
          color: var(--text-primary);
        }
        .module-tabs {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          padding-bottom: 1rem;
        }
        .module-tabs button {
          background: none;
          border: none;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 8px;
          font-weight: 500;
        }
        .module-tabs button:hover {
          background: rgba(255,255,255,0.05);
          color: var(--text-primary);
        }
        .module-tabs button.active {
          background: var(--accent-primary);
          color: white;
        }
        .action-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .unit-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
        }
        .unit-card {
          padding: 1.5rem;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.1);
          position: relative;
        }
        .unit-card-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        .score-badge {
          background: rgba(124, 77, 255, 0.2);
          color: var(--accent-primary);
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .unit-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }
        /* Full Plan Styles */
        .full-plan-container { display: flex; flexDirection: column; gap: 1rem; }
        .plan-header { 
          display: flex; justify-content: space-between; align-items: center; 
          padding: 1.5rem; border-radius: 12px; margin-bottom: 1rem;
        }
        .plan-header h2 { font-size: 1.2rem; color: var(--accent-primary); margin-bottom: 0.25rem; }
        .plan-header p { font-size: 0.85rem; color: var(--text-muted); }
        
        .plan-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .plan-row { 
          display: grid; 
          grid-template-columns: 100px 140px 100px 1fr 100px; 
          align-items: center;
          padding: 1rem;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .plan-row:hover { background: rgba(255,255,255,0.05); transform: translateX(5px); }
        .plan-row.boss-row { border-left: 4px solid var(--accent-danger); background: rgba(255, 82, 82, 0.05); }
        
        .row-coeffs { display: flex; gap: 1rem; }
        .coeff-item label { display: block; font-size: 0.65rem; color: var(--text-muted); margin-bottom: 2px; }
        .coeff-item span { font-size: 0.85rem; font-weight: bold; color: var(--accent-primary); }

        .row-level .badge { 
          background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;
        }
        .boss-tag { 
          color: #FF5252; font-weight: bold; font-size: 0.7rem; margin-left: 0.5rem; letter-spacing: 1px;
        }
        
        .row-budget label, .row-units label, .row-roles label { 
          display: block; font-size: 0.7rem; color: var(--text-muted); margin-bottom: 4px;
        }
        .row-budget span { font-family: monospace; color: var(--accent-secondary); }
        
        .unit-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .unit-chip { 
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
          padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;
          display: flex; gap: 0.5rem;
        }
        .unit-chip .count { color: var(--accent-primary); font-weight: bold; }
        
        .role-dots { display: flex; gap: 4px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; }
        .dot.tank { background: #00E5FF; }
        .dot.dps { background: #FF5252; }
        .stat-row {
          display: flex;
          justify-content: space-between;
          color: var(--text-secondary);
        }
        .stat-row b { color: var(--text-primary); }
        .unit-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }
        .tag {
          background: rgba(255,255,255,0.05);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .unit-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }
        .unit-actions button {
          background: rgba(255,255,255,0.05);
          border: none;
          padding: 6px;
          border-radius: 6px;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .unit-actions button:hover { color: var(--text-primary); background: rgba(255,255,255,0.1); }
        .unit-actions button.delete:hover { color: #FF5252; }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          width: 100%;
          max-width: 500px;
          padding: 2rem;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.2);
        }
        .input-group {
          margin-bottom: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .input-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        input {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 0.75rem;
          border-radius: 8px;
          color: white;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 2rem;
        }

        /* Budget Styles */
        .params-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 2rem;
          padding: 1.5rem;
        }
        .param-item p {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.5rem;
        }

        /* Analysis Styles */
        .analysis-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding: 1rem;
          background: rgba(255,255,255,0.03);
          border-radius: 12px;
        }
        .level-selector {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .budget-badge span {
          color: var(--accent-primary);
          font-weight: 700;
          font-size: 1.2rem;
        }
        .analysis-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 2rem;
        }
        .analysis-card {
          padding: 1.5rem;
          border-radius: 16px;
          height: 100%;
        }
        .enemy-list {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .enemy-item {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .enemy-name { font-weight: 600; }
        .enemy-count { margin-left: 8px; color: var(--text-muted); }
        .enemy-total { color: var(--accent-primary); font-family: monospace; }
        
        .role-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 1rem;
          justify-content: center;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .legend-item span {
          width: 8px; height: 8px; border-radius: 50%;
        }

        .warning-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 1rem;
        }
        .warning-item {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          border-radius: 10px;
          font-size: 0.9rem;
        }
        .warning-item.danger { background: rgba(255, 82, 82, 0.1); color: #FF5252; border: 1px solid rgba(255, 82, 82, 0.2); }
        .warning-item.warning { background: rgba(255, 171, 64, 0.1); color: #FFAB40; border: 1px solid rgba(255, 171, 64, 0.2); }
        .warning-item.info { background: rgba(0, 229, 255, 0.1); color: #00E5FF; border: 1px solid rgba(0, 229, 255, 0.2); }
        .warning-item.success { background: rgba(0, 230, 118, 0.1); color: #00E676; border: 1px solid rgba(0, 230, 118, 0.2); }

        .btn-primary {
          background: var(--accent-primary);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }
        .btn-outline {
          background: none;
          border: 1px solid var(--accent-primary);
          color: var(--accent-primary);
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
        }
        .glass {
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.05);
        }
      `}</style>
    </div>
  );
};

export default LevelMaker;
