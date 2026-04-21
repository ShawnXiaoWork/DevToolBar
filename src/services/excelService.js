/**
 * excelService.js
 * Excel 导入/导出服务 —— 基于 SheetJS (xlsx)
 * 支持：金本位资源字典 & 功能模块设计
 */
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────
// 通用工具
// ─────────────────────────────────────────────
function downloadWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename);
}

function sheetToJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        resolve(json);
      } catch (err) {
        reject(new Error('文件解析失败，请确认使用正确的模板格式'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

// ─────────────────────────────────────────────
// 金本位 / 资源字典
// ─────────────────────────────────────────────

/** 下载资源字典模板 */
export function downloadDictionaryTemplate() {
  const wb = XLSX.utils.book_new();

  // 示例数据行（含表头）
  const data = [
    { '资源名称': '金币', '对钻石汇率': 0.01, '备注': '基础货币，大量产出' },
    { '资源名称': '钻石', '对钻石汇率': 1, '备注': '本位币，基准单位' },
    { '资源名称': '灵魂石', '对钻石汇率': 5, '备注': '稀有资源' },
  ];

  const ws = XLSX.utils.json_to_sheet(data);

  // 设置列宽
  ws['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 30 }];

  XLSX.utils.book_append_sheet(wb, ws, '资源字典');

  // 说明sheet
  const infoData = [
    { '字段说明': '资源名称', '类型': '文字', '必填': '是', '说明': '资源的显示名称，例如：金币、灵魂石' },
    { '字段说明': '对钻石汇率', '类型': '数字', '必填': '是', '说明': '1单位该资源 = X 钻石，钻石本身填1' },
    { '字段说明': '备注', '类型': '文字', '必填': '否', '说明': '可选的描述信息' },
  ];
  const wsInfo = XLSX.utils.json_to_sheet(infoData);
  wsInfo['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 8 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, '字段说明');

  downloadWorkbook(wb, '资源字典模板.xlsx');
}

/** 解析资源字典 Excel，返回资源数组 */
export async function parseDictionaryExcel(file) {
  const rows = await sheetToJSON(file);
  const errors = [];
  const resources = [];

  rows.forEach((row, idx) => {
    const name = String(row['资源名称'] || '').trim();
    const rate = parseFloat(row['对钻石汇率']);

    if (!name) {
      errors.push(`第 ${idx + 2} 行：资源名称不能为空`);
      return;
    }
    if (isNaN(rate) || rate <= 0) {
      errors.push(`第 ${idx + 2} 行 [${name}]：对钻石汇率必须为正数`);
      return;
    }

    resources.push({
      id: `res_import_${Date.now()}_${idx}`,
      name,
      diamondRate: rate,
    });
  });

  return { resources, errors };
}

// ─────────────────────────────────────────────
// 功能模块设计
// ─────────────────────────────────────────────

const VALID_TYPES = ['Core', 'Meta', 'Eco', 'Content'];
const VALID_MODELS = ['linear', 'exponential', 'logarithmic', 'power'];

/** 下载功能模块模板 */
export function downloadFeatureTemplate() {
  const wb = XLSX.utils.book_new();

  // 示例数据
  const data = [
    {
      '模块名称': '英雄升级',
      '类型': 'Core',
      '最大等级': 50,
      '解锁时间(分钟)': 0,
      '成长模型': 'linear',
      '系数': 10,
    },
    {
      '模块名称': '魔法升级',
      '类型': 'Core',
      '最大等级': 20,
      '解锁时间(分钟)': 2,
      '成长模型': 'exponential',
      '系数': 1.1,
    },
    {
      '模块名称': '公会系统',
      '类型': 'Eco',
      '最大等级': 10,
      '解锁时间(分钟)': 1440,
      '成长模型': 'logarithmic',
      '系数': 2,
    },
    {
      '模块名称': '每日任务',
      '类型': 'Meta',
      '最大等级': 99,
      '解锁时间(分钟)': 30,
      '成长模型': 'power',
      '系数': 1.5,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 20 }, { wch: 12 }, { wch: 12 },
    { wch: 18 }, { wch: 15 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, '功能模块');

  // 类型枚举说明
  const typeInfo = [
    { '类型值': 'Core', '中文': '核心循环', '建议数量': '3-5个', '解锁时机': '0-5 分钟', '说明': '游戏最核心的体验循环，必须最早解锁' },
    { '类型值': 'Meta', '中文': '外部成长', '建议数量': '8-12个', '解锁时机': '15-60 分钟', '说明': '跨局进度、成长系统等' },
    { '类型值': 'Eco', '中文': '商业社交', '建议数量': '5-8个', '解锁时机': '1-2 天', '说明': '社交、交易、公会等留存向功能' },
    { '类型值': 'Content', '中文': '内容扩展', '建议数量': '不限', '解锁时机': 'D7+', '说明': '新地图、新玩法等长期内容' },
  ];
  const wsType = XLSX.utils.json_to_sheet(typeInfo);
  wsType['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsType, '类型说明');

  // 成长模型说明
  const modelInfo = [
    { '模型值': 'linear', '中文': '线性增长', '公式': 'cost = slope × level', '适用场景': '均匀成长，普通资源消耗' },
    { '模型值': 'exponential', '中文': '指数增长', '公式': 'cost = base ^ level', '适用场景': '快速膨胀，高稀缺资源' },
    { '模型值': 'logarithmic', '中文': '对数增长', '公式': 'cost = base × ln(level)', '适用场景': '前期快后期慢，友好型成长' },
    { '模型值': 'power', '中文': '幂函数', '公式': 'cost = level ^ base', '适用场景': '中期加速，可控的成长曲线' },
  ];
  const wsModel = XLSX.utils.json_to_sheet(modelInfo);
  wsModel['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsModel, '成长模型说明');

  downloadWorkbook(wb, '功能模块设计模板.xlsx');
}

/** 解析功能模块 Excel，返回功能数组 */
export async function parseFeatureExcel(file) {
  const rows = await sheetToJSON(file);
  const errors = [];
  const features = [];

  rows.forEach((row, idx) => {
    const name = String(row['模块名称'] || '').trim();
    const type = String(row['类型'] || '').trim();
    const maxLevel = parseInt(row['最大等级']);
    const unlockTime = parseInt(row['解锁时间(分钟)']);
    const growthModel = String(row['成长模型'] || 'linear').trim().toLowerCase();
    const coefficient = parseFloat(row['系数']);

    if (!name) {
      errors.push(`第 ${idx + 2} 行：模块名称不能为空`);
      return;
    }
    if (!VALID_TYPES.includes(type)) {
      errors.push(`第 ${idx + 2} 行 [${name}]：类型"${type}"无效，必须是 Core/Meta/Eco/Content`);
      return;
    }
    if (isNaN(maxLevel) || maxLevel <= 0) {
      errors.push(`第 ${idx + 2} 行 [${name}]：最大等级必须为正整数`);
      return;
    }
    if (isNaN(unlockTime) || unlockTime < 0) {
      errors.push(`第 ${idx + 2} 行 [${name}]：解锁时间必须 >= 0`);
      return;
    }
    if (!VALID_MODELS.includes(growthModel)) {
      errors.push(`第 ${idx + 2} 行 [${name}]：成长模型"${growthModel}"无效，必须是 linear/exponential/logarithmic/power`);
      return;
    }

    const params = growthModel === 'linear'
      ? { slope: isNaN(coefficient) ? 1 : coefficient }
      : { base: isNaN(coefficient) ? 1.1 : coefficient };

    features.push({
      id: `feat_import_${Date.now()}_${idx}`,
      name,
      type,
      maxLevel,
      unlockCondition: { type: 'time', value: unlockTime },
      growthModel,
      params,
      physicalResources: [],
    });
  });

  return { features, errors };
}
