/**
 * excelService.js
 * 升级版 Excel 服务：支持备注说明与产出资源配置
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

export function downloadDictionaryTemplate() {
  const wb = XLSX.utils.book_new();

  // 增加备注行说明
  const data = [
    { '资源名称': '【示例】金币', '对钻石汇率': 0.01, '备注': '1金币=0.01钻石' },
    { '资源名称': '钻石', '对钻石汇率': 1, '备注': '基准汇率必须为1' },
    { '资源名称': '灵魂石', '对钻石汇率': 5, '备注': '稀有资源汇率较高' },
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, '资源字典');

  const infoData = [
    { '字段': '资源名称', '说明': '资源的唯一标识名称', '格式': '文本', '范例': '金币' },
    { '字段': '对钻石汇率', '说明': '1单位该资源等价于多少钻石', '格式': '正浮点数', '范例': '0.01' },
    { '字段': '备注', '说明': '仅用于设计者查看，不参与计算', '格式': '文本', '范例': '主要产出资源' },
  ];
  const wsInfo = XLSX.utils.json_to_sheet(infoData);
  XLSX.utils.book_append_sheet(wb, wsInfo, '字段定义说明');

  downloadWorkbook(wb, '1.资源字典模板(含备注).xlsx');
}

export async function parseDictionaryExcel(file) {
  const rows = await sheetToJSON(file);
  const errors = [];
  const resources = [];

  rows.forEach((row, idx) => {
    const name = String(row['资源名称'] || '').replace('【示例】', '').trim();
    const rate = parseFloat(row['对钻石汇率']);

    if (!name) return; // 忽略空行
    if (isNaN(rate) || rate <= 0) {
      errors.push(`第 ${idx + 2} 行 [${name}]：汇率必须为正数`);
      return;
    }

    resources.push({
      id: `res_${Date.now()}_${idx}`,
      name,
      diamondRate: rate,
    });
  });

  return { resources, errors };
}

// ─────────────────────────────────────────────
// 功能模块设计 (升级：支持产出)
// ─────────────────────────────────────────────

const VALID_TYPES = ['Core', 'Meta', 'Eco', 'Content'];
const VALID_MODELS = ['linear', 'exponential', 'logarithmic', 'power'];

export function downloadFeatureTemplate() {
  const wb = XLSX.utils.book_new();

  // 增加消耗资源与产出资源的配置列
  // 采用字符串格式： "资源1:权重1, 资源2:权重2"
  const data = [
    {
      '模块名称': '【示例】英雄升级',
      '类型': 'Core',
      '最大等级': 50,
      '解锁时间(分)': 0,
      '成长模型': 'linear',
      '系数(K)': 10,
      '消耗资源权重': '金币:80, 灵魂石:20',
      '产出资源权重': '',
      '说明': '典型消耗型功能'
    },
    {
      '模块名称': '【示例】炼金室',
      '类型': 'Eco',
      '最大等级': 20,
      '解锁时间(分)': 120,
      '成长模型': 'exponential',
      '系数(K)': 1.2,
      '消耗资源权重': '魔法粉尘:100',
      '产出资源权重': '金币:100',
      '说明': '产出金币的功能'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, 
    { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 25 }, { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, '功能模块配置');

  // 参数类型说明页
  const paramInfo = [
    { '参数项': '类型 (Type)', '说明': 'Core:核心循环 | Meta:外部成长 | Eco:商业社交 | Content:内容扩展', '规则': '必须属于这四类' },
    { '参数项': '成长模型', '说明': 'linear: 线性 | exponential: 指数 | logarithmic: 对数 | power: 幂函数', '规则': '影响升级成本的增长速度' },
    { '参数项': '系数(K)', '说明': '线性模型为斜率，指数模型为底数(建议1.1-1.5)', '规则': '数值越大成长越快' },
    { '参数项': '消耗/产出权重', '说明': '格式： 资源名:权重 (多个用逗号隔开)', '范例': '金币:70, 钻石:30' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paramInfo), '字段详细说明');

  downloadWorkbook(wb, '2.功能模块设计模板(含产出配置).xlsx');
}

/** 辅助函数：解析资源权重字符串 */
function parseResourceString(str, allResources) {
  if (!str) return [];
  return str.split(/[,，]/).map(item => {
    const [name, weightStr] = item.split(/[:：]/);
    const weight = parseInt(weightStr) || 100;
    const res = allResources.find(r => r.name === name.trim());
    return res ? { resourceId: res.id, weight } : null;
  }).filter(item => item !== null);
}

export async function parseFeatureExcel(file, allResources) {
  const rows = await sheetToJSON(file);
  const errors = [];
  const features = [];

  rows.forEach((row, idx) => {
    const name = String(row['模块名称'] || '').replace('【示例】', '').trim();
    const type = String(row['类型'] || '').trim();
    const model = String(row['成长模型'] || 'linear').trim().toLowerCase();
    const k = parseFloat(row['系数(K)']);
    
    if (!name) return;

    if (!VALID_TYPES.includes(type)) {
      errors.push(`第 ${idx + 2} 行 [${name}]：无效的类型 ${type}`);
      return;
    }

    const costs = parseResourceString(row['消耗资源权重'], allResources);
    const outputs = parseResourceString(row['产出资源权重'], allResources);

    features.push({
      id: `feat_${Date.now()}_${idx}`,
      name,
      type,
      maxLevel: parseInt(row['最大等级']) || 10,
      unlockCondition: { type: 'time', value: parseInt(row['解锁时间(分)']) || 0 },
      growthModel: VALID_MODELS.includes(model) ? model : 'linear',
      params: model === 'linear' ? { slope: k || 1 } : { base: k || 1.1 },
      physicalResources: costs, // 消耗
      outputResources: outputs,  // 产出
    });
  });

  return { features, errors };
}
