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
