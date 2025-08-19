// ===== 數據訪問層 (Data Access Layer) =====
// 標頭驅動的動態欄位映射，消除硬編碼索引

/**
 * SheetDataModel - 動態欄位映射類
 * 自動讀取表頭並建立欄位索引映射
 */
class SheetDataModel {
  constructor(sheet) {
    this.sheet = sheet;
    this.headers = null;
    this.columnMap = null;
    this.initialize();
  }
  
  /**
   * 初始化：讀取表頭並建立映射
   */
  initialize() {
    if (!this.sheet) {
      throw new Error('Sheet is not initialized');
    }
    
    // 獲取表頭（第一行）
    const lastColumn = this.sheet.getLastColumn();
    if (lastColumn === 0) {
      this.headers = [];
      this.columnMap = {};
      return;
    }
    
    const headerRange = this.sheet.getRange(1, 1, 1, lastColumn);
    const headerValues = headerRange.getValues()[0];
    
    // 處理表頭：轉小寫並去除空格
    this.headers = headerValues.map(h => this.normalizeHeader(h));
    
    // 建立欄位名到索引的映射
    this.columnMap = {};
    this.headers.forEach((header, index) => {
      if (header) {
        this.columnMap[header] = index;
        // 同時支援原始大小寫
        this.columnMap[headerValues[index]] = index;
      }
    });
    
    Logger.log(`SheetDataModel initialized for ${this.sheet.getName()}: ${JSON.stringify(this.columnMap)}`);
  }
  
  /**
   * 標準化表頭名稱
   */
  normalizeHeader(header) {
    if (!header) return '';
    return header.toString().toLowerCase().trim().replace(/\s+/g, '_');
  }
  
  /**
   * 根據欄位名稱獲取值
   */
  getFieldValue(row, fieldName) {
    const normalizedName = this.normalizeHeader(fieldName);
    const index = this.columnMap[normalizedName] ?? this.columnMap[fieldName];
    
    if (index === undefined) {
      Logger.log(`Warning: Field "${fieldName}" not found in sheet ${this.sheet.getName()}`);
      return null;
    }
    
    return row[index];
  }
  
  /**
   * 根據欄位名稱設置值
   */
  setFieldValue(row, fieldName, value) {
    const normalizedName = this.normalizeHeader(fieldName);
    const index = this.columnMap[normalizedName] ?? this.columnMap[fieldName];
    
    if (index === undefined) {
      throw new Error(`Field "${fieldName}" not found in sheet ${this.sheet.getName()}`);
    }
    
    row[index] = value;
    return row;
  }
  
  /**
   * 將數據行轉換為物件
   */
  rowToObject(row) {
    const obj = {};
    this.headers.forEach((header, index) => {
      if (header) {
        obj[header] = row[index];
      }
    });
    return obj;
  }
  
  /**
   * 將物件轉換為數據行
   */
  objectToRow(obj, existingRow = null) {
    const row = existingRow || new Array(this.headers.length);
    
    Object.keys(obj).forEach(key => {
      const normalizedKey = this.normalizeHeader(key);
      const index = this.columnMap[normalizedKey] ?? this.columnMap[key];
      if (index !== undefined) {
        row[index] = obj[key];
      }
    });
    
    return row;
  }
  
  /**
   * 獲取所有欄位名稱
   */
  getFieldNames() {
    return this.headers.filter(h => h);
  }
  
  /**
   * 檢查欄位是否存在
   */
  hasField(fieldName) {
    const normalizedName = this.normalizeHeader(fieldName);
    return this.columnMap[normalizedName] !== undefined || this.columnMap[fieldName] !== undefined;
  }
  
  /**
   * 獲取欄位索引
   */
  getFieldIndex(fieldName) {
    const normalizedName = this.normalizeHeader(fieldName);
    return this.columnMap[normalizedName] ?? this.columnMap[fieldName];
  }
}

/**
 * DataValidator - 數據驗證類
 */
class DataValidator {
  constructor(modelDefinition) {
    this.modelDef = modelDefinition;
  }
  
  /**
   * 驗證數據
   */
  validate(data, isNew = false) {
    const validated = {};
    const errors = [];
    
    if (!this.modelDef || !this.modelDef.fields) {
      return data;
    }
    
    Object.keys(this.modelDef.fields).forEach(fieldName => {
      const fieldDef = this.modelDef.fields[fieldName];
      let value = data[fieldName];
      
      // 處理自動生成欄位
      if (isNew && fieldDef.autoGenerate) {
        if (fieldDef.type === 'datetime' || fieldDef.type === 'date') {
          value = new Date();
        }
        // ID 生成將在具體的 DAO 中處理
      }
      
      // 處理自動更新欄位
      if (fieldDef.autoUpdate && (fieldDef.type === 'datetime' || fieldDef.type === 'date')) {
        value = new Date();
      }
      
      // 處理預設值
      if ((value === undefined || value === null || value === '') && fieldDef.default !== undefined) {
        value = fieldDef.default;
      }
      
      // 必填欄位檢查
      if (fieldDef.required && !fieldDef.autoGenerate && (value === undefined || value === null || value === '')) {
        errors.push(`Field "${fieldName}" is required`);
      }
      
      // 類型驗證
      if (value !== undefined && value !== null && value !== '') {
        const typeError = this.validateType(value, fieldDef, fieldName);
        if (typeError) {
          errors.push(typeError);
        }
      }
      
      validated[fieldName] = value;
    });
    
    if (errors.length > 0) {
      throw new ValidationError('Validation failed', errors);
    }
    
    return validated;
  }
  
  /**
   * 驗證欄位類型
   */
  validateType(value, fieldDef, fieldName) {
    switch (fieldDef.type) {
      case 'number':
        if (isNaN(value)) {
          return `Field "${fieldName}" must be a number`;
        }
        if (fieldDef.min !== undefined && value < fieldDef.min) {
          return `Field "${fieldName}" must be at least ${fieldDef.min}`;
        }
        if (fieldDef.max !== undefined && value > fieldDef.max) {
          return `Field "${fieldName}" must be at most ${fieldDef.max}`;
        }
        break;
        
      case 'string':
        if (typeof value !== 'string' && !(value instanceof String)) {
          return `Field "${fieldName}" must be a string`;
        }
        if (fieldDef.maxLength && value.length > fieldDef.maxLength) {
          return `Field "${fieldName}" must not exceed ${fieldDef.maxLength} characters`;
        }
        if (fieldDef.minLength && value.length < fieldDef.minLength) {
          return `Field "${fieldName}" must be at least ${fieldDef.minLength} characters`;
        }
        if (fieldDef.pattern && !fieldDef.pattern.test(value)) {
          return `Field "${fieldName}" has invalid format`;
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean') {
          return `Field "${fieldName}" must be a boolean`;
        }
        break;
        
      case 'date':
      case 'datetime':
        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
          return `Field "${fieldName}" must be a valid date`;
        }
        break;
        
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return `Field "${fieldName}" must be a valid email address`;
        }
        break;
        
      case 'enum':
        if (!fieldDef.values || !fieldDef.values.includes(value)) {
          return `Field "${fieldName}" must be one of: ${fieldDef.values.join(', ')}`;
        }
        break;
    }
    
    return null;
  }
  
  /**
   * 清理和標準化數據
   */
  sanitize(data) {
    const sanitized = {};
    
    Object.keys(data).forEach(key => {
      let value = data[key];
      
      if (typeof value === 'string') {
        // 移除危險字符
        value = value.replace(/[<>]/g, '').trim();
        
        // 限制長度
        if (value.length > 1000) {
          value = value.substring(0, 1000);
        }
      }
      
      sanitized[key] = value;
    });
    
    return sanitized;
  }
}

/**
 * BaseDAO - 基礎數據訪問對象
 */
class BaseDAO {
  constructor(sheetName, modelDefinition) {
    this.sheetName = sheetName;
    this.modelDef = modelDefinition;
    this.sheet = null;
    this.dataModel = null;
    this.validator = new DataValidator(modelDefinition);
  }
  
  /**
   * 初始化
   */
  initialize() {
    if (this.sheet && this.dataModel) {
      return;
    }
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    this.sheet = spreadsheet.getSheetByName(this.sheetName);
    
    if (!this.sheet) {
      throw new Error(`Sheet "${this.sheetName}" not found`);
    }
    
    this.dataModel = new SheetDataModel(this.sheet);
  }
  
  /**
   * 根據 ID 查找記錄
   */
  findById(id) {
    this.initialize();
    
    const values = this.sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const rowObj = this.dataModel.rowToObject(values[i]);
      if (rowObj.id == id) {
        return rowObj;
      }
    }
    
    return null;
  }
  
  /**
   * 根據欄位查找記錄
   */
  findByField(fieldName, value) {
    this.initialize();
    
    if (!this.dataModel.hasField(fieldName)) {
      throw new Error(`Field "${fieldName}" does not exist in ${this.sheetName}`);
    }
    
    const values = this.sheet.getDataRange().getValues();
    const results = [];
    
    for (let i = 1; i < values.length; i++) {
      const fieldValue = this.dataModel.getFieldValue(values[i], fieldName);
      if (fieldValue == value) {
        results.push(this.dataModel.rowToObject(values[i]));
      }
    }
    
    return results;
  }
  
  /**
   * 根據多個條件查找記錄
   */
  findByConditions(conditions) {
    this.initialize();
    
    const values = this.sheet.getDataRange().getValues();
    const results = [];
    
    for (let i = 1; i < values.length; i++) {
      const rowObj = this.dataModel.rowToObject(values[i]);
      let match = true;
      
      for (const [field, value] of Object.entries(conditions)) {
        if (rowObj[field] != value) {
          match = false;
          break;
        }
      }
      
      if (match) {
        results.push(rowObj);
      }
    }
    
    return results;
  }
  
  /**
   * 獲取所有記錄
   */
  findAll() {
    this.initialize();
    
    const values = this.sheet.getDataRange().getValues();
    const results = [];
    
    for (let i = 1; i < values.length; i++) {
      results.push(this.dataModel.rowToObject(values[i]));
    }
    
    return results;
  }
  
  /**
   * 創建新記錄
   */
  create(data) {
    this.initialize();
    
    // 清理和驗證數據
    const sanitized = this.validator.sanitize(data);
    const validated = this.validator.validate(sanitized, true);
    
    // 生成 ID（如果需要）
    if (this.modelDef.fields.id && this.modelDef.fields.id.autoGenerate) {
      validated.id = this.generateNextId();
    }
    
    // 轉換為數據行
    const row = this.dataModel.objectToRow(validated);
    
    // 寫入數據
    this.sheet.appendRow(row);
    
    Logger.log(`Created new record in ${this.sheetName}: ${JSON.stringify(validated)}`);
    
    return validated;
  }
  
  /**
   * 更新記錄
   */
  update(id, data) {
    this.initialize();
    
    const values = this.sheet.getDataRange().getValues();
    
    for (let i = 1; i < values.length; i++) {
      const rowObj = this.dataModel.rowToObject(values[i]);
      
      if (rowObj.id == id) {
        // 合併現有數據和更新數據
        const updated = Object.assign({}, rowObj, data);
        
        // 清理和驗證
        const sanitized = this.validator.sanitize(updated);
        const validated = this.validator.validate(sanitized, false);
        
        // 轉換為數據行
        const row = this.dataModel.objectToRow(validated, values[i]);
        
        // 更新數據
        const range = this.sheet.getRange(i + 1, 1, 1, row.length);
        range.setValues([row]);
        
        Logger.log(`Updated record in ${this.sheetName}: ID=${id}`);
        
        return validated;
      }
    }
    
    throw new NotFoundError(`Record with ID ${id} not found in ${this.sheetName}`);
  }
  
  /**
   * 刪除記錄
   */
  delete(id) {
    this.initialize();
    
    const values = this.sheet.getDataRange().getValues();
    
    for (let i = 1; i < values.length; i++) {
      const rowObj = this.dataModel.rowToObject(values[i]);
      
      if (rowObj.id == id) {
        this.sheet.deleteRow(i + 1);
        Logger.log(`Deleted record from ${this.sheetName}: ID=${id}`);
        return true;
      }
    }
    
    throw new NotFoundError(`Record with ID ${id} not found in ${this.sheetName}`);
  }
  
  /**
   * 生成下一個 ID
   */
  generateNextId() {
    const values = this.sheet.getDataRange().getValues();
    let maxId = 0;
    
    for (let i = 1; i < values.length; i++) {
      const id = parseInt(this.dataModel.getFieldValue(values[i], 'id'));
      if (!isNaN(id) && id > maxId) {
        maxId = id;
      }
    }
    
    return maxId + 1;
  }
  
  /**
   * 批量更新
   */
  batchUpdate(updates) {
    this.initialize();
    
    const values = this.sheet.getDataRange().getValues();
    const updatedRows = [];
    
    updates.forEach(({ id, data }) => {
      for (let i = 1; i < values.length; i++) {
        const rowObj = this.dataModel.rowToObject(values[i]);
        
        if (rowObj.id == id) {
          const updated = Object.assign({}, rowObj, data);
          const validated = this.validator.validate(updated, false);
          const row = this.dataModel.objectToRow(validated, values[i]);
          updatedRows.push({ rowIndex: i + 1, data: row });
          break;
        }
      }
    });
    
    // 批量寫入更新
    updatedRows.forEach(({ rowIndex, data }) => {
      const range = this.sheet.getRange(rowIndex, 1, 1, data.length);
      range.setValues([data]);
    });
    
    Logger.log(`Batch updated ${updatedRows.length} records in ${this.sheetName}`);
    
    return updatedRows.length;
  }
}

/**
 * 自定義錯誤類型
 */
class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// 匯出給 Google Apps Script 使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SheetDataModel,
    DataValidator,
    BaseDAO,
    ValidationError,
    NotFoundError
  };
}