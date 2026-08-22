import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { syncArmyTable } from './armySyncUtils.js';

test('syncArmyTable defaults ArmyTag to 1 for normal units and 20 for bosses', async () => {
  // 模拟 Excel 模版数据
  const mockHeaders = ['Id', 'Note', 'ArmyTag', 'Hp', 'Attack', 'Roles', 'Qua'];
  const mockSheet = XLSX.utils.aoa_to_sheet([
    ['#', '#', '#', '#', '#', '#', '#'],
    ['Id', 'Note', 'ArmyTag', 'Hp', 'Attack', 'Roles', 'Qua'],
    ['int', 'string', 'int', 'int', 'int', 'int', 'int'],
    ['id', 'name', 'armyTag', 'hp', 'atk', 'roles', 'qua'],
    [1001, '剑士模板', 11, 100, 10, 0, 1] // 模板行
  ]);
  const mockRange = XLSX.utils.decode_range(mockSheet['!ref']);

  const mockLoader = async (filename) => {
    assert.equal(filename, 'ArmyTable.xlsx');
    return {
      workbook: {},
      sheet: mockSheet,
      headers: mockHeaders,
      range: mockRange
    };
  };

  const mockSaver = async (workbook, filename) => {
    assert.equal(filename, 'ArmyTable.xlsx');
    return { success: true, message: 'Saved successfully' };
  };

  const testUnits = [
    {
      id: 10002,
      name: '普通枪兵 T1',
      hp: 120,
      atk: 12,
      roles: [1],
      armyTag: 11,
      qua: 2
    },
    {
      id: 10003,
      name: '极秘项目·暴君 BOSS T1',
      hp: 500,
      atk: 50,
      roles: [0],
      armyTag: 20,
      qua: 4
    },
    {
      id: 10004,
      name: '普通弓手 T1',
      hp: 90,
      atk: 15,
      roles: [2],
      armyTag: 1, // 已经是 1 了
      qua: 2
    }
  ];

  await syncArmyTable({
    units: testUnits,
    roleWeights: {},
    derivationParams: {},
    loader: mockLoader,
    saver: mockSaver
  });

  // 获取同步后各行数据对应的索引
  const jsonRows = XLSX.utils.sheet_to_json(mockSheet, { range: 3 });

  // 验证普通枪兵 (10002)
  const soldier1 = jsonRows.find(r => r.id === 10002);
  assert.ok(soldier1);
  assert.equal(soldier1.armyTag, 1); // 默认应该变 1

  // 验证 Boss (10003)
  const boss = jsonRows.find(r => r.id === 10003);
  assert.ok(boss);
  assert.equal(boss.armyTag, 20); // Boss 应该为 20

  // 验证普通弓手 (10004)
  const soldier2 = jsonRows.find(r => r.id === 10004);
  assert.ok(soldier2);
  assert.equal(soldier2.armyTag, 1); // 默认为 1
});

test('syncArmyTable saves ArmyTable rows sorted by ascending Id', async () => {
  const mockHeaders = ['Id', 'Note', 'ArmyTag', 'Hp', 'Attack', 'Roles', 'Qua'];
  const mockSheet = XLSX.utils.aoa_to_sheet([
    ['#', '#', '#', '#', '#', '#', '#'],
    ['Id', 'Note', 'ArmyTag', 'Hp', 'Attack', 'Roles', 'Qua'],
    ['int', 'string', 'int', 'int', 'int', 'int', 'int'],
    ['id', 'name', 'armyTag', 'hp', 'atk', 'roles', 'qua'],
    [1001, '剑士模板', 11, 100, 10, 0, 1],
    [1005, '旧枪兵', 1, 110, 11, 3, 1],
    [1003, '旧弓手', 1, 90, 12, 1, 1]
  ]);
  const mockRange = XLSX.utils.decode_range(mockSheet['!ref']);

  const mockLoader = async () => ({
    workbook: {},
    sheet: mockSheet,
    headers: mockHeaders,
    range: mockRange
  });

  const mockSaver = async () => ({ success: true });

  await syncArmyTable({
    units: [
      { id: 1004, name: '新增骑兵', hp: 130, atk: 13, roles: [2], armyTag: 1 },
      { id: 1002, name: '新增步兵', hp: 120, atk: 12, roles: [0], armyTag: 1 }
    ],
    loader: mockLoader,
    saver: mockSaver
  });

  const rows = XLSX.utils.sheet_to_json(mockSheet, { range: 3 });
  assert.deepEqual(rows.map(row => row.id), [1001, 1002, 1003, 1004, 1005]);
});

test('syncArmyTable writes and normalizes the Qua quality field', async () => {
  const mockHeaders = ['Id', 'Note', 'ArmyTag', 'Hp', 'Attack', 'Roles', 'Qua'];
  const mockSheet = XLSX.utils.aoa_to_sheet([
    ['#', '#', '#', '#', '#', '#', '#'],
    mockHeaders,
    ['int', 'string', 'int', 'int', 'int', 'int', 'int'],
    ['id', 'name', 'armyTag', 'hp', 'atk', 'roles', 'qua'],
    [1001, '模板', 11, 100, 10, 0, 1]
  ]);
  const mockRange = XLSX.utils.decode_range(mockSheet['!ref']);

  await syncArmyTable({
    units: [
      { id: 1002, name: '六品质单位', hp: 120, atk: 12, roles: [0], armyTag: 1, qua: 6 },
      { id: 1003, name: '越界品质单位', hp: 120, atk: 12, roles: [0], armyTag: 1, qua: 9 }
    ],
    loader: async () => ({ workbook: {}, sheet: mockSheet, headers: mockHeaders, range: mockRange }),
    saver: async () => ({ success: true })
  });

  const rows = XLSX.utils.sheet_to_json(mockSheet, { range: 3 });
  assert.equal(rows.find(row => row.id === 1002).qua, 6);
  assert.equal(rows.find(row => row.id === 1003).qua, 6);
});

test('syncArmyTable preserves existing SkillIds values', async () => {
  const mockHeaders = ['Id', 'Note', 'Hp', 'Attack', 'Roles', 'Qua', 'SkillIds'];
  const mockSheet = XLSX.utils.aoa_to_sheet([
    ['#', '#', '#', '#', '#', '#', '#'],
    ['Id', 'Note', 'Hp', 'Attack', 'Roles', 'Qua', 'SkillIds'],
    ['int', 'string', 'int', 'int', 'int', 'int', 'string'],
    ['id', 'name', 'hp', 'atk', 'roles', 'qua', 'skillIds'],
    [1001, '剑士模板', 100, 10, 0, 1, '[10010]'],
    [1002, '已有弓手', 90, 12, 1, 1, '[77777]']
  ]);
  const mockRange = XLSX.utils.decode_range(mockSheet['!ref']);

  await syncArmyTable({
    units: [
      { id: 1002, name: '已有弓手', hp: 95, atk: 13, roles: [1], commonSkill: 30010 }
    ],
    loader: async () => ({
      workbook: {},
      sheet: mockSheet,
      headers: mockHeaders,
      range: mockRange
    }),
    saver: async () => ({ success: true })
  });

  const rows = XLSX.utils.sheet_to_json(mockSheet, { range: 3 });
  assert.equal(rows.find(row => row.id === 1002).skillIds, '[77777]');
});

test('syncArmyTable fills new rows from the closest same-role template without blanks', async () => {
  const mockHeaders = ['Id', 'Note', 'Roles', 'ArmyTag', 'Qua', 'Hp', 'Attack', 'HPGrow', 'SkillIds', 'FirstTargetRules', 'Aim'];
  const mockSheet = XLSX.utils.aoa_to_sheet([
    ['#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#'],
    mockHeaders,
    ['int', 'string', 'int', 'int', 'int', 'int', 'int', 'string', 'string', 'string', 'string'],
    ['id', 'name', 'roles', 'armyTag', 'qua', 'hp', 'attack', 'hpGrow', 'skillIds', 'firstTargetRules', 'aim'],
    [10001, '步兵模板', 0, 1, 3, 100, 10, '[[步兵成长]]', '[步兵技能]', '2|1', null],
    [50001, '法师 T1', 4, 1, 3, 80, 20, '[[法师成长]]', '[法师T1技能]', '9|7', null],
    [50002, '法师 T2', 4, 1, 4, 120, 30, null, '[法师T2技能]', null, null]
  ]);
  const mockRange = XLSX.utils.decode_range(mockSheet['!ref']);

  await syncArmyTable({
    units: [
      { id: 50002, name: '法师 T2', hp: 120, atk: 30, roles: [4], armyTag: 1, qua: 4, style: 1 },
      { id: 50003, name: '新法师 T2', hp: 100, atk: 20, roles: [4], armyTag: 1, qua: 4, style: 1 }
    ],
    loader: async () => ({
      workbook: {},
      sheet: mockSheet,
      headers: mockHeaders,
      range: mockRange
    }),
    saver: async () => ({ success: true })
  });

  const rows = XLSX.utils.sheet_to_json(mockSheet, { range: 3 });
  const existingMage = rows.find(row => row.id === 50002);
  const newMage = rows.find(row => row.id === 50003);
  assert.equal(existingMage.skillIds, '[法师T2技能]');
  assert.equal(existingMage.hpGrow, '[[法师成长]]');
  assert.equal(existingMage.firstTargetRules, '9|7');
  assert.equal(existingMage.aim, '[]');
  assert.equal(newMage.skillIds, '[法师T2技能]');
  assert.equal(newMage.hpGrow, '[[法师成长]]');
  assert.equal(newMage.firstTargetRules, '9|7');
  assert.equal(newMage.aim, '[]');
  assert.equal(Object.keys(newMage).length, mockHeaders.length);
  Object.entries(newMage).forEach(([header, value]) => {
    assert.notEqual(value, undefined, `${header} should be populated`);
    assert.notEqual(value, null, `${header} should be populated`);
    assert.notEqual(value, '', `${header} should be populated`);
  });
});
