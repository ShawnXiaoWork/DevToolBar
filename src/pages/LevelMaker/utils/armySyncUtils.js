import * as XLSX from 'xlsx';
import { loadExcelWorkbook, syncDataToSheet, saveExcelWorkbook } from '../../../utils/excelSyncUtils.js';
import { calculatePowerScore } from './planningUtils.js';

const hasArmyTableValue = (value) => value !== undefined && value !== null && value !== '';

export const normalizeArmyQuality = (value) => {
  const quality = Math.round(Number(value));
  return Number.isFinite(quality) ? Math.max(1, Math.min(6, quality)) : 1;
};

const getUnitPrimaryRole = (unit) => {
  const role = Array.isArray(unit?.roles) ? Number(unit.roles[0]) : Number(unit?.roles);
  return Number.isFinite(role) ? role : undefined;
};

const getRowPrimaryRole = (row, headerIndexes) => {
  const rolesValue = row[headerIndexes.roles];
  const raceValue = row[headerIndexes.race];
  const role = Number(hasArmyTableValue(rolesValue) ? rolesValue : raceValue);
  return Number.isFinite(role) ? role : undefined;
};

const getArmyTypeFallback = (type) => {
  const normalizedType = String(type || '').trim().toLowerCase();
  if (normalizedType === 'int' || normalizedType === 'float' || normalizedType === 'number') return 0;
  return '[]';
};

/**
 * 为新增行或已有行的空字段收集未显式生成字段的默认值。
 * 优先同职业、同品质且字段最完整的已有行，再逐步回退到其他已有数据。
 */
export const buildArmyTemplateDefaults = ({
  headers,
  rows,
  headerTypes = [],
  unit,
  fallback = {}
}) => {
  const idIndex = headers.indexOf('Id');
  const headerIndexes = {
    roles: headers.indexOf('Roles'),
    race: headers.indexOf('Race'),
    qua: headers.indexOf('Qua'),
    armyTag: headers.indexOf('ArmyTag'),
    style: headers.indexOf('Style')
  };
  const targetRole = getUnitPrimaryRole(unit);
  const targetQua = Number(unit?.qua);
  const targetStyle = Number(unit?.style);
  const targetIsBoss = Number(unit?.armyTag) >= 20;

  const candidates = (rows || [])
    .map((row, index) => {
      const id = idIndex === -1 ? undefined : row[idIndex];
      if (!hasArmyTableValue(id)) return null;

      const role = getRowPrimaryRole(row, headerIndexes);
      const qua = Number(row[headerIndexes.qua]);
      const style = Number(row[headerIndexes.style]);
      const isBoss = Number(row[headerIndexes.armyTag]) >= 20;
      const completeness = headers.reduce(
        (count, header, columnIndex) => count + (header && hasArmyTableValue(row[columnIndex]) ? 1 : 0),
        0
      );

      return {
        row,
        index,
        bossMismatch: isBoss === targetIsBoss ? 0 : 1,
        roleMismatch: role === targetRole ? 0 : 1,
        quaDistance: Number.isFinite(targetQua) && Number.isFinite(qua) ? Math.abs(qua - targetQua) : 999,
        styleMismatch: Number.isFinite(targetStyle) && Number.isFinite(style) && style === targetStyle ? 0 : 1,
        completeness
      };
    })
    .filter(Boolean)
    .sort((a, b) => (
      a.bossMismatch - b.bossMismatch
      || a.roleMismatch - b.roleMismatch
      || a.quaDistance - b.quaDistance
      || a.styleMismatch - b.styleMismatch
      || b.completeness - a.completeness
      || a.index - b.index
    ));

  const defaults = {};
  candidates.forEach(candidate => {
    headers.forEach((header, columnIndex) => {
      if (!header || header === '#' || hasArmyTableValue(defaults[header])) return;
      const value = candidate.row[columnIndex];
      if (hasArmyTableValue(value)) defaults[header] = value;
    });
  });

  headers.forEach((header, columnIndex) => {
    if (!header || header === '#' || hasArmyTableValue(defaults[header])) return;
    if (hasArmyTableValue(fallback?.[header])) {
      defaults[header] = fallback[header];
    } else {
      defaults[header] = getArmyTypeFallback(headerTypes[columnIndex]);
    }
  });

  return defaults;
};

const inferRoleFromName = (name) => {
  const noteVal = name || '';
  if (noteVal.match(/步|盾|勇|士|卫|禁|斯巴达/)) return 0; // 步兵
  if (noteVal.match(/弓|弩|射|飞|羽/)) return 1;          // 弓箭手
  if (noteVal.match(/骑|马|狼|骁|驰|铁骑/)) return 2;      // 骑兵
  if (noteVal.match(/枪|刺|矛|戟/)) return 3;              // 长枪兵
  if (noteVal.match(/法|魔|巫|术|咒|元素|召/)) return 4;   // 法师
  if (noteVal.match(/医|疗|牧|辅|贤|圣|歌|地/)) return 5;   // 辅助
  return 0; // 默认步兵
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

const getSortableIdValue = (cell) => {
  if (!cell || cell.v === undefined || cell.v === null || cell.v === '') return Number.POSITIVE_INFINITY;
  const numericId = Number(cell.v);
  return Number.isFinite(numericId) ? numericId : String(cell.v);
};

const compareSortableIds = (a, b) => {
  if (typeof a.id === 'number' && typeof b.id === 'number') return a.id - b.id;
  if (typeof a.id === 'number') return -1;
  if (typeof b.id === 'number') return 1;
  return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
};

const sortSheetRowsById = ({ sheet, headers, range, idField = 'Id', dataStartRow = 4 }) => {
  const idColIdx = headers.indexOf(idField);
  if (idColIdx === -1) throw new Error(`ArmyTable.xlsx 缺少 ${idField} 列`);
  if (!range || range.e.r < dataStartRow) return;

  const rowCount = range.e.r - dataStartRow + 1;
  const rowSnapshots = [];

  for (let r = dataStartRow; r <= range.e.r; r++) {
    const cells = [];
    for (let c = 0; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ c, r });
      cells[c] = sheet[addr] ? { ...sheet[addr] } : undefined;
    }

    rowSnapshots.push({
      id: getSortableIdValue(cells[idColIdx]),
      originalIndex: r - dataStartRow,
      cells,
      rowMeta: sheet['!rows']?.[r] ? { ...sheet['!rows'][r] } : undefined
    });
  }

  rowSnapshots.sort((a, b) => {
    const idCompare = compareSortableIds(a, b);
    return idCompare === 0 ? a.originalIndex - b.originalIndex : idCompare;
  });

  if (Array.isArray(sheet['!rows'])) {
    sheet['!rows'] = [...sheet['!rows']];
  }

  for (let offset = 0; offset < rowCount; offset++) {
    const targetRow = dataStartRow + offset;
    const snapshot = rowSnapshots[offset];

    for (let c = 0; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ c, r: targetRow });
      if (snapshot.cells[c]) {
        sheet[addr] = { ...snapshot.cells[c] };
      } else {
        delete sheet[addr];
      }
    }

    if (Array.isArray(sheet['!rows'])) {
      if (snapshot.rowMeta) {
        sheet['!rows'][targetRow] = { ...snapshot.rowMeta };
      } else {
        delete sheet['!rows'][targetRow];
      }
    }
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
  const fullTableData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const idColumnIndex = headers.indexOf('Id');
  const existingRowsById = new Map(
    fullTableData
      .slice(4)
      .filter(row => idColumnIndex !== -1 && hasArmyTableValue(row[idColumnIndex]))
      .map(row => [String(row[idColumnIndex]), row])
  );
  const dataToSync = cleanedUnits.map(unit => {
    const templateDefaults = buildArmyTemplateDefaults({
      headers,
      rows: fullTableData.slice(4),
      headerTypes: fullTableData[2] || [],
      unit
    });
    const existingRow = existingRowsById.get(String(unit.id));
    const inheritedDefaults = existingRow
      ? Object.fromEntries(
        Object.entries(templateDefaults).filter(([header]) => {
          const columnIndex = headers.indexOf(header);
          return columnIndex !== -1 && !hasArmyTableValue(existingRow[columnIndex]);
        })
      )
      : templateDefaults;

    return {
      ...inheritedDefaults,
      ...unit
    };
  });
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
    'Race': (unit) => Array.isArray(unit.roles) ? unit.roles.join('|') : unit.roles,
    'Roles': (unit) => (unit.roles && unit.roles.length > 0) ? Number(unit.roles[0]) : 0,
    'Style': (unit) => unit.style !== undefined ? Number(unit.style) : 0,
    'Qua': (unit) => normalizeArmyQuality(unit.qua),
    'Icon': (unit) => `m${unit.id}`,
    'Prefab': (unit) => unit.prefab || 10001,
    'Cost': (unit) => calculatePowerScore(unit)
  };

  syncDataToSheet({
    sheet,
    headers,
    dataToSync,
    range,
    config: {
      idField: 'Id',
      dataIdField: 'id',
      mapping,
      templateId: 1001
    }
  });

  sortSheetRowsById({ sheet, headers, range });

  const saveResult = await saver(workbook, 'ArmyTable.xlsx');
  return {
    workbook,
    sheet,
    cleanedUnits,
    saveResult
  };
};
