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
  Activity,
  Download,
  Crosshair,
  Sliders,
  RotateCcw
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
  // 战力基础 = (生命*0.1 + 攻击*攻速) 
  // 攻速对战力有直接线性增益
  const base = (unit.hp * 0.1) + (unit.atk * (unit.atkSpeed || 1.0));
  const multipliers = (1 + (unit.spd || 0) / 100) * (1 + (unit.skillPower || 0) / 100);
  let score = Math.round(base * multipliers);
  
  // 机制加成：攻击范围和索敌范围在特定区间有溢价 (例如手长优势)
  if (unit.atkRange > 400) score = Math.round(score * 1.15); 
  
  if (unit.roles && unit.roles.some(r => r === 3 || (typeof r === 'string' && (r.includes('CC') || r.includes('控制'))))) {
    score = Math.round(score * 1.5); // CC 机制权重附加
  }
  return score;
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
  const [unitFilter, setUnitFilter] = useState({ name: '', roles: [], sortBy: 'score', sortDir: 'desc' });

  // --- 兵种规划状态 ---
  const [roleWeights, setRoleWeights] = useState({
    0: { hp: 1.6, atk: 0.4, cc: 0, atkSpeed: 0.8, atkRange: 100, detRange: 200 },
    1: { hp: 1.0, atk: 1.0, cc: 0, atkSpeed: 1.2, atkRange: 100, detRange: 200 },
    2: { hp: 0.5, atk: 1.5, cc: 0, atkSpeed: 2.0, atkRange: 600, detRange: 700 },
    3: { hp: 0.7, atk: 0.6, cc: 0.7, atkSpeed: 1.5, atkRange: 400, detRange: 500 }
  });
  const [rosterTemplates, setRosterTemplates] = useState([
    { id: 't1', name: '均衡阵型', 0: 0.2, 1: 0.3, 2: 0.4, 3: 0.1 },
    { id: 't2', name: '高压阵型', 0: 0.1, 1: 0.0, 2: 0.8, 3: 0.1 },
    { id: 't3', name: '绞肉机阵型', 0: 0.0, 1: 0.7, 2: 0.0, 3: 0.3 }
  ]);
  const [activeTemplateId, setActiveTemplateId] = useState('t1');
  const [validationConfig, setValidationConfig] = useState({
    expectedDPS: 100, // 玩家预期DPS
    targetDuration: 60, // 期望通关时长(s)
    maxDensity: 50, // 最大同屏数量
    minDensity: 3 // 最小同屏数量
  });
  const [derivationParams, setDerivationParams] = useState({
    baseHp: 100,
    baseAtk: 10,
    baseSpd: 0,
    baseSkillPower: 0,
    targetRole: 0,
    unitName: '衍生肉盾'
  });
  const [matrixConfig, setMatrixConfig] = useState({
    totalLevels: 200,
    updateFrequency: 5,
    randomness: 0.2,
    roleDistribution: {
      0: 0.2,
      1: 0.25,
      2: 0.4,
      3: 0.15
    },
    bossFrequency: 10 // 每 10 个普通单位生成一个 Boss
  });

  const ROLE_NAME_POOLS = {
    0: ['石像鬼', '巨盾兵', '山岭巨人', '圣骑士', '憎恶', '铁甲蛹', '岩石怪', '禁卫', '守望者', '龙龟'],
    1: ['剑士', '狂战士', '恶魔猎手', '骷髅兵', '影舞者', '先遣兵', '处刑人', '狼人', '武士', '角斗士'],
    2: ['希尔瓦娜斯', '寒冰射手', '狙击手', '火枪手', '巫妖', '法术大师', '游侠', '投石车', '暗影牧师', '元素使'],
    3: ['寒冰法师', '术士', '德鲁伊', '蜘蛛女王', '萨满', '催眠者', '粘液怪', '沉默者', '药剂师', '先知']
  };

  const ROLE_LABELS = { 0: 'Tank', 1: 'Warrior', 2: 'DPS', 3: 'CC' };
  const ROLE_SYMBOLS = { 0: '🛡️', 1: '⚔️', 2: '🎯', 3: '🌀' };
  const ROLE_ID_RANGES = { 0: 10000, 1: 20000, 2: 30000, 3: 40000, Boss: 90000 };
  const BOSS_PREFIXES = ['【极秘项目】', '【变异主宰】', '【钢铁暴君】', '【末日先兆】', '【零号病毒】', '【虚空母体】'];

  const getNextIdForRole = (role, currentBatch = []) => {
    const rangeStart = ROLE_ID_RANGES[role] || 50000;
    const combinedUnits = [...state.units, ...currentBatch];
    const existingIds = combinedUnits
      .map(u => parseInt(u.id))
      .filter(id => !isNaN(id) && id >= rangeStart && id < rangeStart + 10000);
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : rangeStart;
    return (maxId + 1).toString();
  };

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
        const dir = unitFilter.sortDir === 'asc' ? 1 : -1;
        let valA, valB;

        switch (unitFilter.sortBy) {
          case 'hp': valA = a.hp; valB = b.hp; break;
          case 'atk': valA = a.atk; valB = b.atk; break;
          case 'spd': valA = a.spd; valB = b.spd; break;
          case 'skillPower': valA = a.skillPower; valB = b.skillPower; break;
          case 'score': valA = calculatePowerScore(a); valB = calculatePowerScore(b); break;
          case 'name': return a.name.localeCompare(b.name) * dir;
          case 'weight': valA = a.spawnWeight; valB = b.spawnWeight; break;
          case 'id':
            valA = parseInt(a.id) || 0;
            valB = parseInt(b.id) || 0;
            break;
          default: valA = calculatePowerScore(a); valB = calculatePowerScore(b);
        }

        return (valA - valB) * dir;
      });
  }, [state.units, unitFilter]);

  const toggleSort = (field) => {
    setUnitFilter(prev => ({
      ...prev,
      sortBy: field,
      sortDir: prev.sortBy === field ? (prev.sortDir === 'asc' ? 'desc' : 'asc') : 'desc'
    }));
  };

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
      roles: formData.get('roles').split(',').map(s => {
        const trimmed = s.trim();
        return isNaN(trimmed) ? trimmed : Number(trimmed);
      }),
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
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          importedUnits = jsonData.map(row => {
            return {
              id: `unit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              name: row.name || row.Name || '未命名',
              hp: Number(row.hp || row.Hp || row.HP || 0),
              atk: Number(row.atk || row.Atk || row.Attack || 0),
              spd: Number(row.spd || row.Spd || row.Speed || 0),
              skillPower: Number(row.skillPower || row.SkillPower || 0),
              roles: row.roles ? String(row.roles).split('|').map(r => r.trim()) : (row.ArmyTag ? String(row.ArmyTag).split('|').map(r => r.trim()) : []),
              spawnWeight: Number(row.spawnWeight || row.SpawnWeight || 50)
            };
          }).filter(u => u.name !== '未命名' && (u.hp > 0 || u.atk > 0));
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

  const exportToExcel = (unitsData, filename = 'units_export.xlsx') => {
    const exportData = unitsData.map(u => ({
      Id: u.id,
      ArmyTag: u.armyTag || 0,
      Power: calculatePowerScore(u),
      Hp: u.hp,
      Attack: u.atk,
      AtkSpeed: u.atkSpeed || 1.0,
      AtkRange: u.atkRange || 100,
      DetRange: u.detRange || 200,
      Race: Array.isArray(u.roles) ? u.roles.join('|') : u.roles,
      Note: u.name
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Units");
    XLSX.writeFile(wb, filename);
  };

  const exportLevelPlanToExcel = () => {
    const data = fullLevelPlan.map(lp => ({
      '关卡': lp.level,
      '目标阶层': lp.targetTier,
      '总预算': lp.budget,
      '是否Boss关': lp.isBossLevel ? '是' : '否',
      'HP系数': lp.hpCoeff.toFixed(2),
      'ATK系数': lp.atkCoeff.toFixed(2),
      '阵容构成': lp.selected.map(s => `${s.name}(ID:${s.Id}) x${s.count}`).join('; '),
      '单位详情': lp.selected.map(s => `[${s.name}: HP:${s.Hp}, ATK:${s.Attack}]`).join(' | ')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LevelPlan");
    XLSX.writeFile(wb, `LevelPlan_${Date.now()}.xlsx`);
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
    const template = rosterTemplates.find(t => t.id === activeTemplateId) || rosterTemplates[0];

    // 简单配比算法：
    // a. 筛选所有兵种并计算分值
    const scoredUnits = state.units.map(u => ({ ...u, score: calculatePowerScore(u) }));

    const selected = [];
    let totalCount = 0;
    let totalHp = 0;

    // 按模版配比填充
    [0, 1, 2, 3].forEach(roleId => {
      const roleBudget = budget * (template[roleId] || 0);
      const roleKey = ROLE_LABELS[roleId];
      if (roleBudget <= 0) return;

      // 找出符合该职能的兵种 (改为匹配整数 ID)
      let roleUnits = scoredUnits.filter(u => {
        const roles = Array.isArray(u.roles) ? u.roles : [];
        if (roleKey === 'Tank') return roles.includes(0) || roles.includes('0');
        if (roleKey === 'Warrior') return roles.includes(1) || roles.includes('1');
        if (roleKey === 'DPS') return roles.includes(2) || roles.includes('2');
        if (roleKey === 'CC') return roles.includes(3) || roles.includes('3');
        return false;
      });

      if (roleUnits.length === 0) roleUnits = scoredUnits; // 保底

      // 随机选一个作为代表
      const unit = roleUnits[Math.floor(Math.random() * roleUnits.length)];
      if (unit && unit.score > 0) {
        let exactCount = roleBudget / unit.score;
        let count = Math.ceil(exactCount); // 智能微调：向上取整
        if (count > 0) {
          selected.push({ ...unit, count, exactCount, assignedRole: roleKey });
          totalCount += count;
          totalHp += unit.hp * count;
        }
      }
    });

    // 计算职能分布
    const roleStats = {};
    selected.forEach(s => {
      roleStats[s.assignedRole] = (roleStats[s.assignedRole] || 0) + s.count;
    });

    const pieData = Object.entries(roleStats).map(([name, value]) => ({ name, value }));

    // 强度检测与闭环验证报告
    const warnings = [];
    const avgScore = budget / (totalCount || 1);
    const estimatedDuration = totalHp / (validationConfig.expectedDPS || 1);

    if (avgScore > 200) warnings.push({ type: 'danger', text: '当前关卡单位战力过高，可能会造成玩家瞬间死亡，建议增加杂鱼单位比例。' });
    if (!pieData.some(d => d.name === 'Tank')) warnings.push({ type: 'warning', text: '关卡缺乏前排抗伤单位，远程玩家可能会轻松风筝全场。' });

    // 密度验证
    if (totalCount > validationConfig.maxDensity) warnings.push({ type: 'danger', text: `同屏怪物数量 (${totalCount}) 超过上限 (${validationConfig.maxDensity})，可能会导致严重的渲染压力！` });
    if (totalCount < validationConfig.minDensity) warnings.push({ type: 'warning', text: `同屏怪物数量过少 (${totalCount})，可能导致关卡空洞。` });

    // 时长验证
    if (estimatedDuration > validationConfig.targetDuration * 1.5) {
      warnings.push({ type: 'danger', text: `预测战斗时长 ${estimatedDuration.toFixed(1)}s 远超预期 ${validationConfig.targetDuration}s，建议下调难度系数或提升玩家期望DPS。` });
    } else if (estimatedDuration < validationConfig.targetDuration * 0.5) {
      warnings.push({ type: 'info', text: `预测战斗时长 ${estimatedDuration.toFixed(1)}s 较短，玩家可能会迅速清场。` });
    }

    return { selected, budget, pieData, warnings, estimatedDuration, totalCount };
  }, [state.units, levelConfig, previewLevel, activeTemplateId, rosterTemplates, validationConfig]);

  // 3. 全关卡自动规划规划算法 (基于阵容模版)
  const fullLevelPlan = useMemo(() => {
    if (state.units.length === 0) return [];

    const template = rosterTemplates.find(t => t.id === activeTemplateId) || rosterTemplates[0];

    // 辅助规则：根据关卡决定当前主打的 Tier
    const getTargetTier = (level) => {
      if (level <= 20) return 'T1';
      if (level <= 50) return 'T2';
      if (level <= 80) return 'T3';
      return 'T4';
    };

    return Array.from({ length: previewRange }, (_, i) => {
      const level = i + 1;
      const targetTier = getTargetTier(level);

      const steps = (levelConfig.spikes || []).filter(s => s.type === 'step' && level >= s.level);
      let hpCoeff = 1;
      let atkCoeff = 1;
      steps.forEach(s => {
        hpCoeff *= (s.hpMultiplier || 1);
        atkCoeff *= (s.atkMultiplier || 1);
      });

      const peak = (levelConfig.spikes || []).find(s => s.level === level && s.type === 'peak');
      if (peak) {
        hpCoeff *= (peak.hpMultiplier || 1);
        atkCoeff *= (peak.atkMultiplier || 1);
      }

      const budget = getLevelBudget(level, levelConfig);

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

      const selected = [];
      const isBossLevel = !!peak;

      [0, 1, 2, 3].forEach(roleId => {
        const roleBudget = budget * (template[roleId] || 0);
        const roleKey = ROLE_LABELS[roleId];
        if (roleBudget <= 0) return;

        // 1. 职能过滤 (匹配整数 ID)
        let roleUnits = scaledUnits.filter(u => {
          const roles = Array.isArray(u.roles) ? u.roles : [];
          if (roleKey === 'Tank') return roles.includes(0) || roles.includes('0');
          if (roleKey === 'Warrior') return roles.includes(1) || roles.includes('1');
          if (roleKey === 'DPS') return roles.includes(2) || roles.includes('2');
          if (roleKey === 'CC') return roles.includes(3) || roles.includes('3');
          return false;
        });

        if (roleUnits.length === 0) roleUnits = scaledUnits;

        // 2. 制作人规则：如果是 Boss 关，优先选 Boss 标签的单位 (ArmyTag 9)
        let pool = roleUnits;
        if (isBossLevel) {
          const bossPool = pool.filter(u => u.armyTag === 9);
          if (bossPool.length > 0) pool = bossPool;
        }

        // 3. 制作人规则：优先选当前 Tier 的单位 (ArmyTag 1-4)
        const targetTierInt = Number(targetTier.replace('T', ''));
        const tierPool = pool.filter(u => u.armyTag === targetTierInt);
        if (tierPool.length > 0) pool = tierPool;

        // 4. 制作人规则：每 5 关引入感 (通过随机种子或偏移量选择，这里简化为随机)
        const unit = pool[Math.floor(Math.random() * pool.length)];

        if (unit && unit.scaledScore > 0) {
          let exactCount = roleBudget / unit.scaledScore;
          let count = Math.ceil(exactCount);
          if (count > 0) {
            selected.push({ ...unit, count, assignedRole: roleKey });
          }
        }
      });

      return { level, budget, selected, hpCoeff, atkCoeff, isBossLevel, targetTier };
    });
  }, [state.units, levelConfig, previewRange, activeTemplateId, rosterTemplates]);

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
        <button className={activeTab === 'planning' ? 'active' : ''} onClick={() => setActiveTab('planning')}>
          <Sliders size={18} /> 兵种与阵容规划
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
                  <button className="btn-outline" onClick={() => exportToExcel(state.units, 'units_export.xlsx')}>
                    <Download size={16} /> 导出至 Excel
                  </button>
                  <button className="btn-outline" style={{ color: '#FF5252', borderColor: 'rgba(255,82,82,0.3)' }} onClick={() => {
                    if (confirm('确认重置兵种库到初始状态？这将清除所有手动生成的兵种和导入的数据，恢复标准数字 ID。')) {
                      dispatch({ type: 'RESET_UNITS' });
                    }
                  }}>
                    <RotateCcw size={16} /> 重置库
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
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ROLE_LABELS[role] ? `${role} (${ROLE_LABELS[role]})` : role}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

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
                  <span>ID</span>
                  <span>兵种名称</span>
                  <span>ArmyTag</span>
                  <span>HP</span>
                  <span>ATK</span>
                  <span>ASP</span>
                  <span>ARNG</span>
                  <span>DRNG</span>
                  <span>SPD</span>
                  <span>战力评分</span>
                  <span>职能标签</span>
                  <span>权重</span>
                  <span style={{ textAlign: 'right' }}>管理</span>
                </div>
                <div className="table-body" style={{ maxHeight: 'calc(100vh - 450px)', overflowY: 'auto' }}>
                  {filteredUnits.length === 0 && (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      没有找到匹配的兵种，请尝试调整筛选条件或导入配置。
                    </div>
                  )}
                  {filteredUnits.map(unit => (
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
                        <button onClick={() => setEditingUnit(unit)} style={{ padding: '6px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}><Edit3 size={14} /></button>
                        <button onClick={() => dispatch({ type: 'DELETE_UNIT', payload: unit.id })} style={{ padding: '6px', background: 'rgba(255,100,100,0.1)', border: 'none', borderRadius: '4px', color: '#FF5252', cursor: 'pointer' }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
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
                      onChange={(e) => dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { baseScore: Number(e.target.value) } })}
                    />
                    <p>第1层关卡的起始总战力值</p>
                  </div>
                  <div className="param-item">
                    <label>难度因子 (DifficultyFactor)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={levelConfig.difficultyFactor}
                      onChange={(e) => dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { difficultyFactor: Number(e.target.value) } })}
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
                            note: isMajorChapter ? `第 ${chapter / 5} 章节终极 Boss` : `第 ${chapter} 阶段精英战`
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
                        dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes } });
                      }}>
                        <Zap size={14} /> 自动生成章节模型
                      </button>
                      <button className="btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => {
                        const newSpike = { level: previewRange / 2, hpMultiplier: 1.2, atkMultiplier: 1.2, type: 'peak', note: '新越迁点' };
                        dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: [...(levelConfig.spikes || []), newSpike] } });
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
                              dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes } });
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
                              dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes } });
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
                              dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes } });
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
                              dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes } });
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
                              dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes } });
                            }}
                            style={{ width: '100%', padding: '4px', marginTop: '4px' }}
                          />
                        </div>
                        <button className="delete" style={{ padding: '8px', background: 'none', border: 'none', color: '#FF5252', cursor: 'pointer' }} onClick={() => {
                          const newSpikes = levelConfig.spikes.filter((_, i) => i !== idx);
                          dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes } });
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

          {/* 2.5 兵种属性与阵容规划 */}
          {activeTab === 'planning' && (
            <motion.div
              key="planning"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="planning-dashboard"
            >
              <div className="planning-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

                {/* 左侧：兵种派生与权重 */}
                <div className="planning-left" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                  {/* 职能权重配置 */}
                  <div className="planning-card glass">
                    <h3><Crosshair size={18} color="var(--accent-primary)" /> 职能属性权重 (Role Weights)</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>基于标准单位(100%)，计算不同职能的属性偏移。</p>
                    <div className="weights-table">
                      <div className="weight-header" style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1.2fr 1fr 1fr', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontSize: '0.7rem' }}>
                        <span>职能</span><span>HP</span><span>ATK</span><span>CC</span><span>ASP</span><span>ARNG</span><span>DRNG</span>
                      </div>
                      {Object.keys(roleWeights).map(role => (
                        <div key={role} className="weight-row" style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1.2fr 1fr 1fr', gap: '0.4rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{ROLE_LABELS[role]}</span>
                          <input type="number" step="0.1" value={roleWeights[role].hp} onChange={(e) => setRoleWeights({ ...roleWeights, [role]: { ...roleWeights[role], hp: Number(e.target.value) } })} style={{ width: '100%', fontSize: '0.75rem' }} />
                          <input type="number" step="0.1" value={roleWeights[role].atk} onChange={(e) => setRoleWeights({ ...roleWeights, [role]: { ...roleWeights[role], atk: Number(e.target.value) } })} style={{ width: '100%', fontSize: '0.75rem' }} />
                          <input type="number" step="0.1" value={roleWeights[role].cc} onChange={(e) => setRoleWeights({ ...roleWeights, [role]: { ...roleWeights[role], cc: Number(e.target.value) } })} style={{ width: '100%', fontSize: '0.75rem' }} />
                          <input type="number" step="0.1" value={roleWeights[role].atkSpeed} onChange={(e) => setRoleWeights({ ...roleWeights, [role]: { ...roleWeights[role], atkSpeed: Number(e.target.value) } })} style={{ width: '100%', fontSize: '0.75rem' }} />
                          <input type="number" step="10" value={roleWeights[role].atkRange} onChange={(e) => setRoleWeights({ ...roleWeights, [role]: { ...roleWeights[role], atkRange: Number(e.target.value) } })} style={{ width: '100%', fontSize: '0.75rem' }} />
                          <input type="number" step="10" value={roleWeights[role].detRange} onChange={(e) => setRoleWeights({ ...roleWeights, [role]: { ...roleWeights[role], detRange: Number(e.target.value) } })} style={{ width: '100%', fontSize: '0.75rem' }} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 一键派生器 */}
                  <div className="planning-card glass">
                    <h3><Zap size={18} color="var(--accent-warning)" /> 兵种一键派生 (Unit Derivation)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                      <div className="input-row">
                        <div className="input-group">
                          <label>基准 HP</label>
                          <input type="number" value={derivationParams.baseHp} onChange={e => setDerivationParams({ ...derivationParams, baseHp: Number(e.target.value) })} />
                        </div>
                        <div className="input-group">
                          <label>基准 ATK</label>
                          <input type="number" value={derivationParams.baseAtk} onChange={e => setDerivationParams({ ...derivationParams, baseAtk: Number(e.target.value) })} />
                        </div>
                      </div>
                      <div className="input-row">
                        <div className="input-group">
                          <label>基准 SPD</label>
                          <input type="number" value={derivationParams.baseSpd} onChange={e => setDerivationParams({ ...derivationParams, baseSpd: Number(e.target.value) })} />
                        </div>
                        <div className="input-group">
                          <label>目标职能</label>
                          <select value={derivationParams.targetRole} onChange={e => setDerivationParams({ ...derivationParams, targetRole: e.target.value })} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px' }}>
                            {Object.keys(roleWeights).map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>生成兵种名称</label>
                        <input type="text" value={derivationParams.unitName} onChange={e => setDerivationParams({ ...derivationParams, unitName: e.target.value })} />
                      </div>
                      <button className="btn-primary" onClick={() => {
                        const weights = roleWeights[derivationParams.targetRole];
                        const newUnit = {
                          id: getNextIdForRole(derivationParams.targetRole),
                          name: derivationParams.unitName,
                          hp: Math.round(derivationParams.baseHp * weights.hp),
                          atk: Math.round(derivationParams.baseAtk * weights.atk),
                          atkSpeed: weights.atkSpeed || 1.0,
                          atkRange: weights.atkRange || 100,
                          detRange: weights.detRange || 200,
                          spd: derivationParams.baseSpd,
                          skillPower: Math.round(weights.cc * 100),
                          roles: [Number(derivationParams.targetRole)],
                          armyTag: 1,
                          spawnWeight: 50
                        };
                        dispatch({ type: 'ADD_UNIT', payload: newUnit });
                        alert(`已成功派生兵种: ${newUnit.name} (ID: ${newUnit.id})\nHP: ${newUnit.hp}, ATK: ${newUnit.atk}`);
                      }}>
                        生成并加入兵种库
                      </button>
                    </div>
                  </div>
                </div>

                {/* 右侧：矩阵生成器与模版 */}
                <div className="planning-right" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                  {/* 矩阵生成器 (Matrix Generator) */}
                  <div className="planning-card glass" style={{ border: '1px solid var(--accent-primary)', boxShadow: '0 0 20px rgba(124, 77, 255, 0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0 }}><BarChart3 size={18} color="var(--accent-primary)" /> 矩阵生成器 (Matrix Generator)</h3>
                      <span className="badge" style={{ background: 'var(--accent-primary)', fontSize: '0.7rem' }}>BETA</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>根据高维度规划自动批量裂变兵种库。</p>

                    <div className="config-matrix" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div className="input-row">
                        <div className="input-group">
                          <label>预期总关卡数</label>
                          <input type="number" value={matrixConfig.totalLevels} onChange={e => setMatrixConfig({ ...matrixConfig, totalLevels: Number(e.target.value) })} />
                        </div>
                        <div className="input-group">
                          <label>兵种迭代密度 (每N关)</label>
                          <input type="number" value={matrixConfig.updateFrequency} onChange={e => setMatrixConfig({ ...matrixConfig, updateFrequency: Number(e.target.value) })} />
                        </div>
                      </div>

                      <div className="input-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <label>随机波动方差 (Randomness)</label>
                          <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>{Math.round(matrixConfig.randomness * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="0.5" step="0.05" value={matrixConfig.randomness} onChange={e => setMatrixConfig({ ...matrixConfig, randomness: Number(e.target.value) })} style={{ width: '100%' }} />
                      </div>

                      <div className="role-proportions glass" style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>职能分布权重 (库级占比)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          {Object.keys(matrixConfig.roleDistribution).map(role => (
                            <div key={role} className="input-group">
                              <label style={{ fontSize: '0.7rem' }}>{ROLE_LABELS[role] || role} %</label>
                              <input type="number" step="0.05" value={matrixConfig.roleDistribution[role]} onChange={e => {
                                const newDist = { ...matrixConfig.roleDistribution, [role]: Number(e.target.value) };
                                setMatrixConfig({ ...matrixConfig, roleDistribution: newDist });
                              }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: Object.values(matrixConfig.roleDistribution).reduce((a, b) => a + b, 0).toFixed(2) === '1.00' ? '#00E676' : '#FF5252' }}>
                          分布系数总和: {Object.values(matrixConfig.roleDistribution).reduce((a, b) => a + b, 0).toFixed(2)} (应为 1.0)
                        </div>
                      </div>

                      <div className="input-group">
                        <label>Boss 产出频率 (每 N 个普通怪)</label>
                        <input type="number" value={matrixConfig.bossFrequency} onChange={e => setMatrixConfig({ ...matrixConfig, bossFrequency: Number(e.target.value) })} />
                      </div>

                      <button className="btn-primary" style={{ height: '50px', fontSize: '1rem' }} onClick={() => {
                        const totalTypes = Math.ceil(matrixConfig.totalLevels / matrixConfig.updateFrequency);
                        const newUnits = [];

                        Object.keys(matrixConfig.roleDistribution).forEach(roleId => {
                          const role = Number(roleId);
                          const count = Math.round(totalTypes * matrixConfig.roleDistribution[roleId]);
                          const weights = roleWeights[role];

                          for (let i = 0; i < count; i++) {
                            // 阶层计算 (Tier 1 to 4)
                            const tier = Math.min(4, Math.ceil((i + 1) / (count / 4)));
                            const tierMultiplier = 1 + (tier - 1) * 0.5;

                            const isBoss = (i + 1) % matrixConfig.bossFrequency === 0;
                            const bossMultiplier = isBoss ? 4.0 : 1.0;
                            const bossAtkMultiplier = isBoss ? 1.5 : 1.0;

                            const hpMut = 1 + (Math.random() * 2 - 1) * matrixConfig.randomness;
                            const atkMut = 1 + (Math.random() * 2 - 1) * matrixConfig.randomness;

                            const pool = ROLE_NAME_POOLS[role] || ['未知单位'];
                            const baseName = pool[Math.floor(Math.random() * pool.length)];
                            const bossPrefix = isBoss ? BOSS_PREFIXES[Math.floor(Math.random() * BOSS_PREFIXES.length)] : '';
                            const symbol = ROLE_SYMBOLS[role] || '';

                            const finalId = getNextIdForRole(isBoss ? 'Boss' : role, newUnits);

                            newUnits.push({
                              id: finalId,
                              name: `${bossPrefix}${baseName}${symbol} T${tier}`,
                              hp: Math.round(derivationParams.baseHp * weights.hp * tierMultiplier * hpMut * bossMultiplier),
                              atk: Math.round(derivationParams.baseAtk * weights.atk * tierMultiplier * atkMut * bossAtkMultiplier),
                              atkSpeed: Number((weights.atkSpeed * (0.9 + Math.random() * 0.2)).toFixed(2)),
                              atkRange: Math.round(weights.atkRange * (0.9 + Math.random() * 0.2)),
                              detRange: Math.round(weights.detRange * (0.9 + Math.random() * 0.2)),
                              spd: derivationParams.baseSpd + Math.floor(Math.random() * 5),
                              skillPower: Math.round(weights.cc * 100 + (tier - 1) * 20 + (isBoss ? 50 : 0)),
                              roles: [role], // 仅存储职能整数
                              armyTag: isBoss ? 9 : tier, // 9 为 Boss, 1-4 为 Tier
                              spawnWeight: isBoss ? 10 : 50
                            });
                          }
                        });

                        if (confirm(`系统即将生成 ${newUnits.length} 个兵种并加入库中，是否继续？`)) {
                          dispatch({ type: 'IMPORT_UNITS', payload: newUnits });
                          alert('矩阵生成完毕！您可以切换回“兵种建模库”查看结果。');
                        }
                      }}>
                        <Zap size={18} /> 一键批量生成兵种矩阵
                      </button>
                    </div>
                  </div>


                  {/* 阵容模版管理 */}
                  <div className="planning-card glass">
                    <h3><Users size={18} color="var(--accent-secondary)" /> 阵容模版 (Roster Templates)</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>定义不同关卡的战力分配预算比例。总和应为 1.0 (100%)。</p>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                      <select value={activeTemplateId} onChange={(e) => setActiveTemplateId(e.target.value)} style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px' }}>
                        {rosterTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <button className="btn-outline" onClick={() => {
                        const newId = `t${Date.now()}`;
                        setRosterTemplates([...rosterTemplates, { id: newId, name: '新模版', Tank: 0.25, Warrior: 0.25, DPS: 0.25, CC: 0.25 }]);
                        setActiveTemplateId(newId);
                      }}><Plus size={16} /></button>
                    </div>

                    {rosterTemplates.map(t => t.id === activeTemplateId && (
                      <div key={t.id} className="template-editor" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                        <div className="input-group">
                          <label>模版名称</label>
                          <input type="text" value={t.name} onChange={(e) => {
                            setRosterTemplates(rosterTemplates.map(rt => rt.id === t.id ? { ...rt, name: e.target.value } : rt));
                          }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          {[0, 1, 2, 3].map(role => (
                            <div key={role} className="input-group">
                              <label>{ROLE_LABELS[role]} 比例</label>
                              <input type="number" step="0.05" value={t[role]} onChange={(e) => {
                                setRosterTemplates(rosterTemplates.map(rt => rt.id === t.id ? { ...rt, [role]: Number(e.target.value) } : rt));
                              }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: (t[0] + t[1] + t[2] + t[3]).toFixed(2) === '1.00' ? '#00E676' : '#FF5252' }}>
                          当前比例总和: {(t[0] + t[1] + t[2] + t[3]).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 闭环验证参数 */}
                  <div className="planning-card glass">
                    <h3><ShieldAlert size={18} color="var(--accent-danger)" /> 闭环验证参数 (Validation)</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>用于模拟关卡的战斗时长和同屏压力预警。</p>
                    <div className="input-row">
                      <div className="input-group">
                        <label>期望玩家 DPS</label>
                        <input type="number" value={validationConfig.expectedDPS} onChange={e => setValidationConfig({ ...validationConfig, expectedDPS: Number(e.target.value) })} />
                      </div>
                      <div className="input-group">
                        <label>期望通关时长(s)</label>
                        <input type="number" value={validationConfig.targetDuration} onChange={e => setValidationConfig({ ...validationConfig, targetDuration: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div className="input-row">
                      <div className="input-group">
                        <label>最大同屏数量</label>
                        <input type="number" value={validationConfig.maxDensity} onChange={e => setValidationConfig({ ...validationConfig, maxDensity: Number(e.target.value) })} />
                      </div>
                      <div className="input-group">
                        <label>最小同屏数量</label>
                        <input type="number" value={validationConfig.minDensity} onChange={e => setValidationConfig({ ...validationConfig, minDensity: Number(e.target.value) })} />
                      </div>
                    </div>
                  </div>

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
                <div className="plan-actions" style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn-outline" onClick={exportLevelPlanToExcel}>
                    <Download size={16} /> 导出全关卡规划 (Excel)
                  </button>
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
                        {p.selected.some(s => s.roles.some(r => r === 0 || r === '0')) && <div className="dot tank" title="有坦克" />}
                        {p.selected.some(s => s.roles.some(r => r === 2 || r === '2')) && <div className="dot dps" title="有输出" />}
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
