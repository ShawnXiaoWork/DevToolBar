import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Upload, Download, RotateCcw, Plus, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import UnitFilters from './UnitFilters';
import UnitTable from './UnitTable';
import UnitEditor from './UnitEditor';
import { calculatePowerScore } from '../../utils/planningUtils';

const UnitLibrary = ({ state, dispatch }) => {
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitFilter, setUnitFilter] = useState({ name: '', roles: [], sortBy: 'id', sortDir: 'asc' });

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

          importedUnits = jsonData.map(row => ({
            id: `unit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: row.name || row.Name || '未命名',
            hp: Number(row.hp || row.Hp || row.HP || 0),
            atk: Number(row.atk || row.Atk || row.Attack || 0),
            atkSpeed: Number(row.atkSpeed || row.AtkSpeed || row.ASP || 1.0),
            atkRange: Number(row.atkRange || row.AtkRange || row.ARNG || 100),
            detRange: Number(row.detRange || row.DetRange || row.DRNG || 200),
            spd: Number(row.spd || row.Spd || row.Speed || 0),
            skillPower: Number(row.skillPower || row.SkillPower || 0),
            roles: row.Race ? String(row.Race).split('|').map(r => isNaN(r) ? r.trim() : Number(r)) : (row.roles ? String(row.roles).split('|').map(r => isNaN(r) ? r.trim() : Number(r)) : []),
            armyTag: Number(row.ArmyTag || row.armyTag || 1),
            spawnWeight: Number(row.spawnWeight || row.SpawnWeight || 50)
          })).filter(u => u.name !== '未命名' && (u.hp > 0 || u.atk > 0));
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
    XLSX.writeFile(wb, 'units_export.xlsx');
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
