// ========================================
// Sheets Adapter — 包裝 sheets.js 實作 adapter 介面
// ========================================

const sheets = require('../sheets');

// ========================================
// SheetDataModel — 動態欄位映射
// (從 backend.js 搬過來，只有 Sheets adapter 需要)
// ========================================

class SheetDataModel {
  constructor(headers) {
    this.headers = headers.map(h => String(h).toLowerCase().trim());
    this.rawHeaders = headers;
    this.columnMap = {};

    this.headers.forEach((header, index) => {
      if (header) {
        this.columnMap[header] = index;
        this.columnMap[this.rawHeaders[index]] = index;
      }
    });
  }

  getFieldValue(row, fieldName) {
    const index = this.columnMap[fieldName.toLowerCase()] ?? this.columnMap[fieldName];
    if (index === undefined) return null;
    return row[index];
  }

  setFieldValue(row, fieldName, value) {
    const index = this.columnMap[fieldName.toLowerCase()] ?? this.columnMap[fieldName];
    if (index === undefined) {
      throw new Error(`Field "${fieldName}" not found`);
    }
    row[index] = value;
    return row;
  }

  rowToObject(row) {
    const obj = {};
    this.headers.forEach((header, index) => {
      if (header) obj[header] = row[index];
    });
    return obj;
  }

  objectToRow(obj) {
    const row = new Array(this.headers.length);
    Object.keys(obj).forEach(key => {
      const index = this.columnMap[key.toLowerCase()] ?? this.columnMap[key];
      if (index !== undefined) row[index] = obj[key];
    });
    return row;
  }

  hasField(fieldName) {
    const normalized = fieldName.toLowerCase();
    return this.columnMap[normalized] !== undefined || this.columnMap[fieldName] !== undefined;
  }
}

// ========================================
// ID 生成
// ========================================

function generateNextIdFromValues(values, dataModel) {
  let maxId = 0;
  for (let i = 1; i < values.length; i++) {
    let id = parseInt(dataModel.getFieldValue(values[i], 'id'));
    if (isNaN(id)) id = parseInt(dataModel.getFieldValue(values[i], 'ID'));
    if (!isNaN(id) && id > maxId) maxId = id;
  }
  return maxId + 1;
}

// ========================================
// Adapter 介面實作
// ========================================

/**
 * 取全部記錄 → [{...}, ...]
 */
async function getAllRecords(tableName) {
  const values = await sheets.getSheetData(tableName);
  if (!values || values.length < 2) return [];

  const dataModel = new SheetDataModel(values[0]);
  const records = [];
  for (let i = 1; i < values.length; i++) {
    records.push(dataModel.rowToObject(values[i]));
  }
  return records;
}

/**
 * 依欄位查詢 → [{...}, ...]
 */
async function findByField(tableName, field, value) {
  const values = await sheets.getSheetData(tableName);
  if (!values || values.length < 2) return [];

  const dataModel = new SheetDataModel(values[0]);
  const results = [];

  for (let i = 1; i < values.length; i++) {
    const fieldValue = dataModel.getFieldValue(values[i], field);
    if (fieldValue == value) {
      results.push({
        rowIndex: i + 1,
        data: dataModel.rowToObject(values[i])
      });
    }
  }
  return results;
}

/**
 * 依 ID 查單筆 → { rowIndex, data } | null
 */
async function findById(tableName, id) {
  const results = await findByField(tableName, 'id', id);
  return results.length > 0 ? results[0] : null;
}

/**
 * 新增記錄（自動產生 ID）→ {...}
 */
async function create(tableName, data) {
  const values = await sheets.getSheetData(tableName);
  if (!values || values.length === 0) throw new Error(`Sheet ${tableName} not found or empty`);

  const dataModel = new SheetDataModel(values[0]);
  const timestamp = new Date().toISOString();

  data.created_at = data.created_at || timestamp;
  data.updated_at = data.updated_at || timestamp;

  if ((dataModel.hasField('id') || dataModel.hasField('ID')) && !data.id && !data.ID) {
    const newId = generateNextIdFromValues(values, dataModel);
    data.id = newId;
    data.ID = newId;
  }

  const row = dataModel.objectToRow(data);
  await sheets.appendRow(tableName, row);

  console.log(`Created new record in ${tableName}: id=${data.id || data.ID}`);
  return data;
}

/**
 * 更新記錄 → {...}
 */
async function update(tableName, id, updates) {
  console.log(`--- update: ${tableName}, ID=${id} ---`);

  const values = await sheets.getSheetData(tableName);
  if (!values || values.length < 2) throw new Error(`Sheet ${tableName} not found or empty`);

  const dataModel = new SheetDataModel(values[0]);

  // Partners 表使用 partner_code 作為主鍵
  let record;
  if (tableName === 'Partners') {
    const results = await findByField(tableName, 'partner_code', id);
    record = results.length > 0 ? results[0] : null;
  } else {
    record = await findById(tableName, id);
    if (!record && tableName === 'Payouts') {
      const results = await findByField(tableName, 'ID', id);
      record = results.length > 0 ? results[0] : null;
    }
  }

  if (!record) {
    throw new Error(`Record with ID ${id} not found in ${tableName}`);
  }

  const updatedData = Object.assign({}, record.data, updates, {
    updated_at: new Date().toISOString()
  });

  const row = dataModel.objectToRow(updatedData);
  await sheets.updateRow(tableName, record.rowIndex, row);

  console.log(`Updated record in ${tableName}: ID=${id}`);
  return updatedData;
}

/**
 * 確保表存在（Sheets 特有）
 */
async function ensureTable(tableName, fields) {
  const exists = await sheets.sheetExists(tableName);
  if (!exists) {
    await sheets.createSheet(tableName, fields);
    console.log(`Created sheet: ${tableName}`);
  }
}

/**
 * 取欄位名稱列表
 */
async function getFields(tableName) {
  const headers = await sheets.getHeaders(tableName);
  if (!headers || headers.length === 0) {
    throw new Error(`Sheet ${tableName} not found or empty`);
  }
  return headers;
}

module.exports = {
  getAllRecords,
  findByField,
  findById,
  create,
  update,
  ensureTable,
  getFields
};
