import * as XLSX from 'xlsx';
import { loadExcelWorkbook, syncDataToSheet, saveExcelWorkbook } from '../../../utils/excelSyncUtils.js';
import { calculatePowerScore } from './planningUtils.js';

const inferRoleFromName = (name) => {
  const noteVal = name || '';
  if (noteVal.match(/盾|甲|巨|熊|象|肉|防/)) return 0;
  if (noteVal.match(/弓|法|炮|巫|箭|弩|魔|狙|精/)) return 2;
  if (noteVal.match(/刺|医|疗|牧|毒|影|隐|辅/)) return 3;
  return 1;
};

const cleanUnitForArmyTable = (unit, roleWeights, derivationParams) => {
  if (!unit.roles || unit.roles[0] !== -1) return unit;

  const bestRole = inferRoleFromName(unit.name);
  const roleHpMulti = roleWeights[bestRole]?.hp || 1.0;
  const roleAtkMulti = roleWeights[bestRole]?.atk || 1.0;
  const baseHp = derivationParams.baseHp || 1;
  const baseAtk = derivationParams.baseAtk || 1;
  const tier = Math.max(1, Math.round(unit.hp / (baseHp * roleHpMulti)));

  return {
    ...unit,
    roles: [bestRole],
    hp: Math.round(tier * baseHp * roleHpMulti),
    atk: Math.round(tier * baseAtk * roleAtkMulti)
  };
};

const cleanLegacyArmyRows = ({ sheet, headers, range, roleWeights, derivationParams }) => {
  const rolesColIdx = headers.indexOf('Roles');
  const hpColIdx = headers.indexOf('Hp');
  const atkColIdx = headers.indexOf('Attack');
  const hpFakeColIdx = headers.indexOf('HpFake');
  const atkFakeColIdx = headers.indexOf('AttackFake');
  const idColIdx = headers.indexOf('Id');
  const noteColIdx = headers.indexOf('Note');

  if (idColIdx === -1) throw new Error('ArmyTable.xlsx 缺少 Id 列');
  if (rolesColIdx === -1) throw new Error('ArmyTable.xlsx 缺少 Roles 列');
  if (hpColIdx === -1) throw new Error('ArmyTable.xlsx 缺少 Hp 列');
  if (atkColIdx === -1) throw new Error('ArmyTable.xlsx 缺少 Attack 列');

  for (let r = 4; r <= range.e.r; r++) {
    const idAddr = XLSX.utils.encode_cell({ c: idColIdx, r });
    const idVal = sheet[idAddr] ? String(sheet[idAddr].v) : '';
    if (!idVal || idVal === '1001') continue;

    const rolesAddr = XLSX.utils.encode_cell({ c: rolesColIdx, r });
    const rolesVal = sheet[rolesAddr] ? Number(sheet[rolesAddr].v) : undefined;
    if (rolesVal !== -1) continue;

    const noteAddr = XLSX.utils.encode_cell({ c: noteColIdx, r });
    const noteVal = noteColIdx !== -1 && sheet[noteAddr] ? String(sheet[noteAddr].v) : '';
    const bestRole = inferRoleFromName(noteVal);
    const roleHpMulti = roleWeights[bestRole]?.hp || 1.0;
    const roleAtkMulti = roleWeights[bestRole]?.atk || 1.0;
    const baseHp = derivationParams.baseHp || 1;
    const baseAtk = derivationParams.baseAtk || 1;
    const currHp = sheet[XLSX.utils.encode_cell({ c: hpColIdx, r })]?.v || baseHp;
    const tier = Math.max(1, Math.round(currHp / (baseHp * roleHpMulti)));
    const finalHp = Math.round(tier * baseHp * roleHpMulti);
    const finalAtk = Math.round(tier * baseAtk * roleAtkMulti);

    sheet[rolesAddr] = { v: bestRole, t: 'n' };
    sheet[XLSX.utils.encode_cell({ c: hpColIdx, r })] = { v: finalHp, t: 'n' };
    sheet[XLSX.utils.encode_cell({ c: atkColIdx, r })] = { v: finalAtk, t: 'n' };
    if (hpFakeColIdx !== -1) sheet[XLSX.utils.encode_cell({ c: hpFakeColIdx, r })] = { v: finalHp, t: 'n' };
    if (atkFakeColIdx !== -1) sheet[XLSX.utils.encode_cell({ c: atkFakeColIdx, r })] = { v: finalAtk, t: 'n' };
  }
};

export const syncArmyTable = async ({
  units,
  roleWeights = {},
  derivationParams = {},
  loader = loadExcelWorkbook,
  saver = saveExcelWorkbook
}) => {
  if (!Array.isArray(units) || units.length === 0) {
    throw new Error('没有可同步的兵种数据，ArmyTable.xlsx 未更新');
  }

  const { workbook, sheet, headers, range } = await loader('ArmyTable.xlsx');

  if (headers.indexOf('Qua') === -1) {
    headers.push('Qua');
    const newColIdx = headers.length - 1;
    sheet[XLSX.utils.encode_cell({ c: newColIdx, r: 0 })] = { v: '品质', t: 's' };
    sheet[XLSX.utils.encode_cell({ c: newColIdx, r: 1 })] = { v: 'Qua', t: 's' };
    sheet[XLSX.utils.encode_cell({ c: newColIdx, r: 2 })] = { v: 'int', t: 's' };
    sheet[XLSX.utils.encode_cell({ c: newColIdx, r: 3 })] = { v: '品质等级', t: 's' };
    range.e.c = Math.max(range.e.c, newColIdx);
  }

  cleanLegacyArmyRows({ sheet, headers, range, roleWeights, derivationParams });

  const cleanedUnits = units.map(unit => cleanUnitForArmyTable(unit, roleWeights, derivationParams));
  const mapping = {
    'Id': 'id',
    'Note': 'name',
    'Name': (unit) => `armyName.${unit.id}`,
    'Description': (unit) => `armyDescription.${unit.id}`,
    'ArmyTag': (unit) => (unit.armyTag >= 20) ? 20 : 1,
    'Hp': 'hp',
    'HpFake': 'hp',
    'Attack': 'atk',
    'AttackFake': 'atk',
    'AttackFreq': (unit) => unit.atkSpeed || 1.0,
    'Speed': (unit) => unit.spd || 75,
    'AttackRange': (unit) => unit.atkRange || 100,
    'FindRange': (unit) => (unit.detRange || 200) * 6,
    'Race': (unit) => Array.isArray(unit.roles) ? unit.roles.join('|') : unit.roles,
    'Roles': (unit) => (unit.roles && unit.roles.length > 0) ? Number(unit.roles[0]) : 0,
    'Style': (unit) => unit.style !== undefined ? Number(unit.style) : 0,
    'Qua': (unit) => unit.qua !== undefined ? Number(unit.qua) : 1,
    'Icon': (unit) => `m${unit.id}`,
    'Prefab': (unit) => unit.prefab || 10001,
    'SkillIds': (unit) => `[${unit.commonSkill || 10010}]`,
    'Cost': (unit) => calculatePowerScore(unit)
  };

  syncDataToSheet({
    sheet,
    headers,
    dataToSync: cleanedUnits,
    range,
    config: {
      idField: 'Id',
      dataIdField: 'id',
      mapping,
      templateId: 1001
    }
  });

  const saveResult = await saver(workbook, 'ArmyTable.xlsx');
  return {
    workbook,
    sheet,
    cleanedUnits,
    saveResult
  };
};
