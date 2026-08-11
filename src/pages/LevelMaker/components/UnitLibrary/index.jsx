import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Upload, Download, RotateCcw, Plus, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import UnitFilters from './UnitFilters';
import UnitTable from './UnitTable';
import UnitEditor from './UnitEditor';
import { calculatePowerScore } from '../../utils/planningUtils';
import { buildArmyTemplateDefaults, syncArmyTable } from '../../utils/armySyncUtils';

const UnitLibrary = ({ state, dispatch, roleWeights, derivationParams }) => {
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitFilter, setUnitFilter] = useState({ name: '', roles: [], sortBy: 'id', sortDir: 'asc' });
  const [default1001, setDefault1001] = useState(null);
  const [tableHeaders, setTableHeaders] = useState(null);
  const [templateRows, setTemplateRows] = useState([]);
  const [fullTableData, setFullTableData] = useState([]);
  const [currentWorkbook, setCurrentWorkbook] = useState(null);

  // 加载 1001 参考数据及表头模板
  React.useEffect(() => {
    // 静态兜底数据 (万一 fetch 失败或 ID 找不到)
    const STATIC_FALLBACK_1001 = {
      '#': '', 'Id': 1001, 'Note': '剑士', 'ArmyTag': 11, 'Cost': 0, 'SpawnRates': 0.4, 'ArenaCount': 1,
      'Hp': 1000, 'Attack': 200, 'HpFake': 900, 'AttackFake': 180, 'AttackFreq': 1,
      'HPGrow': "[[2,10],[20,15],[40,20],[60,25],[80,30],[100,35],[120,40],[140,45],[160,50],[180,55],[200,60]]",
      'AttackGrow': "[[2,2],[20,3],[40,4],[60,5],[80,6],[100,7],[120,8],[140,9],[160,10],[180,11],[200,12]]",
      'Speed': 75, 'AttackRange': 84, 'Aim': 1, 'Style': 0, 'Race': 1,
      'FeaturesOther': "[2]", 'MaxRow': 15, 'Bullet': 0, 'Icon': "m1001", 'Prefab': 10001,
      'Name': "armyName.1001", 'Description': "armyDescription.1001",
      'DieSfx': "[101,102,103,104,105,106,107,108,109]", 'RecruitingSfx': "[1002]",
      'Skill0Sfx': "[21,22,23,24,25,26,27,28]", 'Skill1Sfx': "[-1]",
      'Resistance': "[0.1,0.1,0,0,0,0]", 'BuffResistance': "[0,0,0,0]",
      'FatherHpRate': 0, 'FatherAttackRate': 0, 'Stability': 1
    };

    fetch(`${import.meta.env.BASE_URL}api/read-excel?filename=ArmyTable.xlsx`)
      .then(res => {
        if (!res.ok) throw new Error('API Load failed');
        return res.arrayBuffer();
      })
      .catch(() => {
        // Fallback to static public file if API fails
        return fetch(`${import.meta.env.BASE_URL}ArmyTable.xlsx`).then(res => res.arrayBuffer());
      })
      .then(buffer => {
        const workbook = XLSX.read(new Uint8Array(buffer), { 
          type: 'array',
          cellStyles: true,
          cellNF: true,
          cellComments: true
        });
        setCurrentWorkbook(workbook);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        setFullTableData(jsonData);
        
        // 保存前 4 行模板 (注释、表头、类型、描述)
        const templates = jsonData.slice(0, 4);
        setTemplateRows(templates);

        const headers = jsonData[1];
        setTableHeaders(headers);

        const idIdx = headers.indexOf('Id');
        const row1001 = jsonData.find(r => r[idIdx] == 1001 || r[idIdx] === '1001');

        if (row1001) {
          const data = {};
          headers.forEach((h, i) => {
            if (h) data[h] = row1001[i];
          });
          setDefault1001(data);
        } else {
          console.warn('ID 1001 not found in ArmyTable, using fallback.');
          setDefault1001(STATIC_FALLBACK_1001);
        }

        // 如果当前 state 为空，尝试从导入的数据中恢复 state
        if (state.units.length === 0) {
          const objects = XLSX.utils.sheet_to_json(sheet);
          const units = objects.map(row => {
            return {
              id: row.Id || row.id,
              name: row.Name || row.name || row.Note,
              hp: Number(row.Hp || 0),
              atk: Number(row.Attack || 0),
              atkSpeed: Number(row.AttackFreq || 1.0),
              atkRange: Number(row.AttackRange || 100),
              detRange: 200,
              spd: Number(row.Speed || 75),
              roles: row.Race ? String(row.Race).split('|').map(r => isNaN(r) ? r.trim() : Number(r)) : [],
              armyTag: Number(row.ArmyTag || 11),
              maxRow: Number(row.MaxRow || 15),
              spawnRates: Number(row.SpawnRates || 0.4),
              style: row.Style !== undefined ? Number(row.Style) : 0,
              qua: row.Qua !== undefined ? Number(row.Qua) : 1
            };
          }).filter(u => u.id && u.name);
          
          if (units.length > 0) {
            dispatch({ type: 'IMPORT_UNITS', payload: units });
          }
        }
      }).catch(err => {
        console.error('Failed to load ArmyTable for defaults:', err);
        // 如果 fetch 失败，使用静态兜底
        const fallbackHeaders = Object.keys(STATIC_FALLBACK_1001);
        setDefault1001(STATIC_FALLBACK_1001);
        setTableHeaders(fallbackHeaders);
        setTemplateRows([[], fallbackHeaders, [], []]); // 至少保证有表头行
      });
  }, []);

  // --- 兵种过滤逻辑 ---
  const filteredUnits = useMemo(() => {
    return state.units
      .filter(u => {
        const matchName = u.name.toLowerCase().includes(unitFilter.name.toLowerCase());
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
          case 'atkSpeed': valA = a.atkSpeed || 0; valB = b.atkSpeed || 0; break;
          case 'atkRange': valA = a.atkRange || 0; valB = b.atkRange || 0; break;
          case 'detRange': valA = a.detRange || 0; valB = b.detRange || 0; break;
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
      atkSpeed: Number(formData.get('atkSpeed') || 1.0),
      atkRange: Number(formData.get('atkRange') || 100),
      detRange: Number(formData.get('detRange') || 200),
      roles: formData.get('roles').split(',').map(s => {
        const trimmed = s.trim();
        return isNaN(trimmed) ? trimmed : Number(trimmed);
      }),
      armyTag: Number(formData.get('armyTag') || 1),
      commonSkill: Number(formData.get('commonSkill') || 10010),
      spawnWeight: Number(formData.get('spawnWeight'))
    };

    if (editingUnit?.id) {
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
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          importedUnits = jsonData.map(row => {
            return {
              id: row.Id || row.id || `unit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              name: row.Name || row.name || row.Note || '未命名',
              hp: Number(row.Hp || row.hp || row.HP || 0),
              atk: Number(row.Attack || row.atk || row.Attack || 0),
              atkSpeed: Number(row.AttackFreq || row.atkSpeed || row.ASP || 1.0),
              atkRange: Number(row.AttackRange || row.atkRange || row.ARNG || 100),
              detRange: Number(row.detRange || row.DRNG || 200),
              spd: Number(row.Speed || row.spd || row.Speed || 0),
              skillPower: Number(row.skillPower || row.SkillPower || 0),
              roles: row.Race ? String(row.Race).split('|').map(r => isNaN(r) ? r.trim() : Number(r)) : (row.roles ? String(row.roles).split('|').map(r => isNaN(r) ? r.trim() : Number(r)) : []),
              armyTag: Number(row.ArmyTag || row.armyTag || 11),
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
    reader.readAsArrayBuffer(file);
  };

  const exportToExcel = (unitsData) => {
    if (!tableHeaders || !default1001) {
      alert('正在加载 ArmyTable 模板，请稍后再试...');
      return;
    }

    // 构建 AOA (Array of Arrays) 数据，首先放入前 4 行模板
    const aoaData = [...templateRows];

    // 处理兵种数据
    unitsData.forEach((u, idx) => {
      const score = calculatePowerScore(u);
      const inheritedDefaults = buildArmyTemplateDefaults({
        headers: tableHeaders,
        rows: fullTableData.slice(4),
        headerTypes: fullTableData[2] || [],
        unit: u,
        fallback: default1001
      });
      const baseMap = {
        '#': idx + 1,
        'Id': u.id,
        'Note': u.name,
        'Name': `armyName.${u.id}`,
        'Description': `armyDescription.${u.id}`,
        'ArmyTag': u.armyTag >= 20 ? 20 : 1,
        'Hp': u.hp,
        'HpFake': u.hp,
        'Attack': u.atk,
        'AttackFake': u.atk,
        'AttackFreq': u.atkSpeed || 1.0,
        'Speed': u.spd || 75,
        'AttackRange': u.atkRange || 100,
        'Race': Array.isArray(u.roles) ? u.roles.join('|') : u.roles,
        'Icon': `m${u.id}`,
        'Prefab': u.prefab || 10001,
        'Cost': score
      };

      const mergedData = { ...inheritedDefaults, ...baseMap };

      // 按照 tableHeaders 的顺序生成这一行的数据
      const row = tableHeaders.map(h => {
        return mergedData[h] !== undefined ? mergedData[h] : '';
      });

      aoaData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoaData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ArmyTable");
    XLSX.writeFile(wb, 'ArmyTable_Sync_Export.xlsx');
  };

  const syncToLocal = async (roleWeights, derivationParams) => {
    try {
      const { workbook, sheet, cleanedUnits, saveResult } = await syncArmyTable({
        units: filteredUnits,
        roleWeights,
        derivationParams
      });
      alert(saveResult.message || '本地 ArmyTable.xlsx 同步成功！');
      
      // 更新本地状态
      setCurrentWorkbook(workbook);
      setFullTableData(XLSX.utils.sheet_to_json(sheet, { header: 1 }));
      
      // 同时更新到 React 状态中，让 UI 实时刷新
      const updatedUnits = cleanedUnits.filter((cu, idx) => cu !== filteredUnits[idx]);
      if (updatedUnits.length > 0) {
        const newAllUnits = state.units.map(su => {
          const cleaned = updatedUnits.find(uu => uu.id === su.id);
          return cleaned || su;
        });
        dispatch({ type: 'IMPORT_UNITS', payload: newAllUnits, replace: true });
      }
    } catch (err) {
      console.error('Sync failed:', err);
      alert('同步失败：' + (err.message || '请检查网络或文件是否存在'));
    }
  };

  return (
    <motion.div
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
            accept=".xlsx,.xls"
            onChange={handleImport}
          />
          <button className="btn-outline" onClick={() => document.getElementById('unit-import').click()}>
            <Upload size={16} /> 导入配置 (Excel)
          </button>
          <button className="btn-outline" onClick={() => exportToExcel(filteredUnits)}>
            <Download size={16} /> 导出至 Excel
          </button>
          <button className="btn-primary" style={{ background: '#4CAF50' }} onClick={() => syncToLocal(roleWeights, derivationParams)}>
            <Users size={16} /> 同步至本地文件
          </button>
          <button className="btn-outline" style={{ color: '#FF5252', borderColor: 'rgba(255,82,82,0.3)' }} onClick={() => {
            if (confirm('确认重置兵种库到初始状态？')) {
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

      <UnitFilters unitFilter={unitFilter} setUnitFilter={setUnitFilter} allRoles={allRoles} />

      <UnitTable
        units={filteredUnits}
        unitFilter={unitFilter}
        toggleSort={toggleSort}
        onEdit={setEditingUnit}
        onDelete={(id) => dispatch({ type: 'DELETE_UNIT', payload: id })}
      />

      {editingUnit && (
        <UnitEditor
          unit={editingUnit}
          onSave={handleSaveUnit}
          onCancel={() => setEditingUnit(null)}
        />
      )}
    </motion.div>
  );
};

export default UnitLibrary;
