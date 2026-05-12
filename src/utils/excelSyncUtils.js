import * as XLSX from 'xlsx';

/**
 * 通用 Excel 同步工具类
 */

/**
 * 读取 Excel 并获取表头及数据
 * @param {string} filename 
 * @returns {Promise<{workbook: any, sheet: any, headers: string[], range: any}>}
 */
export async function loadExcelWorkbook(filename) {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}api/read-excel?filename=${filename}`);
    if (!response.ok) throw new Error(`Failed to read ${filename}`);
    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), {
      type: 'array',
      cellStyles: true,
      cellNF: true,
      cellComments: true
    });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const headers = jsonData[1] || []; // 假设第二行是表头
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    
    return { workbook, sheet, headers, range, fullData: jsonData };
  } catch (error) {
    console.error('loadExcelWorkbook error:', error);
    throw error;
  }
}

/**
 * 同步数据到工作表（增量更新，保留样式）
 * @param {Object} params
 * @param {any} params.sheet 工作表对象
 * @param {string[]} params.headers 表头数组
 * @param {Array} params.dataToSync 要同步的数据数组 (对象数组)
 * @param {Object} params.config 配置项 { idField, dataStartRow, templateId, mapping }
 */
export function syncDataToSheet({ sheet, headers, dataToSync, config, range }) {
  const { idField = 'Id', dataStartRow = 4, templateId = 1001, mapping = {} } = config;
  
  const idIdx = headers.indexOf(idField);
  if (idIdx === -1) {
    console.warn(`ID field "${idField}" not found in headers:`, headers);
  }

  // 1. 建立 ID 到 行索引 的映射
  const idToRowMap = new Map();
  let templateRowIdx = -1;

  for (let r = dataStartRow; r <= range.e.r; r++) {
    const cell = sheet[XLSX.utils.encode_cell({ c: idIdx === -1 ? 0 : idIdx, r: r })];
    if (cell && cell.v !== undefined) {
      const val = String(cell.v);
      idToRowMap.set(val, r);
      if (val === String(templateId)) {
        templateRowIdx = r;
      }
    }
  }

  let nextAvailableRow = range.e.r + 1;

  // 2. 遍历同步数据
  dataToSync.forEach(item => {
    const itemId = String(item[idField] || '');
    let targetRowIdx = idToRowMap.get(itemId);

    // 如果是新条目，克隆模板行
    if (targetRowIdx === undefined) {
      targetRowIdx = nextAvailableRow++;
      if (templateRowIdx !== -1) {
        for (let c = 0; c <= range.e.c; c++) {
          const fromAddr = XLSX.utils.encode_cell({ c, r: templateRowIdx });
          const toAddr = XLSX.utils.encode_cell({ c, r: targetRowIdx });
          if (sheet[fromAddr]) {
            sheet[toAddr] = { ...sheet[fromAddr] };
          }
        }
      }
    }

    // 3. 根据 mapping 更新单元格值
    // mapping 格式: { 'Excel表头': '数据对象属性名' } 或 { 'Excel表头': (item) => value }
    headers.forEach((h, i) => {
      if (!h) return;
      const mapSource = mapping[h];
      let val = undefined;

      if (typeof mapSource === 'function') {
        val = mapSource(item);
      } else if (mapSource !== undefined) {
        val = item[mapSource];
      } else if (item[h] !== undefined) {
        // 如果没有显式映射，尝试直接匹配表头名
        val = item[h];
      }

      if (val !== undefined) {
        const addr = XLSX.utils.encode_cell({ c: i, r: targetRowIdx });
        if (!sheet[addr]) {
          sheet[addr] = { v: val, t: typeof val === 'number' ? 'n' : 's' };
        } else {
          sheet[addr].v = val;
          sheet[addr].t = typeof val === 'number' ? 'n' : 's';
        }
      }
    });
  });

  // 更新范围
  range.e.r = Math.max(range.e.r, nextAvailableRow - 1);
  sheet['!ref'] = XLSX.utils.encode_range(range);
}

/**
 * 保存工作簿
 * @param {any} workbook 
 * @param {string} filename 
 */
export async function saveExcelWorkbook(workbook, filename) {
  const content = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const response = await fetch(`${import.meta.env.BASE_URL}api/save-excel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, filename })
  });

  if (!response.ok) {
    throw new Error(`Failed to save ${filename}`);
  }
  return await response.json();
}
