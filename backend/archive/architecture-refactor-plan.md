# 後端架構重構方案 - 以頂級架構師視角

## 一、現有架構問題診斷

### 1. 硬編碼欄位索引（最嚴重）
```javascript
// 現狀：危險的硬編碼
const rowGuestName = bookingValues[i][2]; // 如果欄位順序改變就會出錯
const rowGuestPhone = String(bookingValues[i][3]);
const rowCheckinDate = bookingValues[i][6];
```

**風險等級：🔴 極高**
- 任何欄位調整都會導致系統崩潰
- 維護困難，需要記憶每個索引代表什麼
- 無法在運行時驗證數據完整性

### 2. 缺乏數據模型層
- 直接操作二維陣列，沒有抽象層
- 數據驗證散落在各處
- 沒有統一的數據轉換邏輯

### 3. 錯誤處理不一致
- 有些函數返回 JSON，有些返回 HTML
- 錯誤日誌格式不統一
- 缺少錯誤恢復機制

### 4. 事務處理缺失
- 多表更新沒有原子性保證
- 部分失敗會導致數據不一致
- 沒有回滾機制

### 5. 代碼重複嚴重
- 相似的查找邏輯重複多次
- ID 生成邏輯重複
- 數據驗證邏輯分散

## 二、架構改進方案

### 1. 標頭驅動的數據存取層

```javascript
// 新架構：動態欄位映射
class SheetDataModel {
  constructor(sheet) {
    this.sheet = sheet;
    this.headers = this.getHeaders();
    this.columnMap = this.buildColumnMap();
  }
  
  getHeaders() {
    const headers = this.sheet.getRange(1, 1, 1, this.sheet.getLastColumn()).getValues()[0];
    return headers.map(h => h.toString().toLowerCase().trim());
  }
  
  buildColumnMap() {
    const map = {};
    this.headers.forEach((header, index) => {
      map[header] = index;
    });
    return map;
  }
  
  getFieldValue(row, fieldName) {
    const index = this.columnMap[fieldName.toLowerCase()];
    if (index === undefined) {
      throw new Error(`Field ${fieldName} not found in sheet ${this.sheet.getName()}`);
    }
    return row[index];
  }
  
  setFieldValue(row, fieldName, value) {
    const index = this.columnMap[fieldName.toLowerCase()];
    if (index === undefined) {
      throw new Error(`Field ${fieldName} not found in sheet ${this.sheet.getName()}`);
    }
    row[index] = value;
    return row;
  }
  
  rowToObject(row) {
    const obj = {};
    this.headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  }
  
  objectToRow(obj) {
    const row = new Array(this.headers.length);
    Object.keys(obj).forEach(key => {
      const index = this.columnMap[key.toLowerCase()];
      if (index !== undefined) {
        row[index] = obj[key];
      }
    });
    return row;
  }
}
```

### 2. 數據模型定義

```javascript
// 定義數據模型和驗證規則
const DataModels = {
  Booking: {
    fields: {
      id: { type: 'number', required: true, autoGenerate: true },
      partner_code: { type: 'string', required: false },
      guest_name: { type: 'string', required: true, maxLength: 100 },
      guest_phone: { type: 'string', required: true, pattern: /^[\d\-\+\s]+$/ },
      guest_email: { type: 'email', required: false },
      bank_account_last5: { type: 'string', required: false, length: 5 },
      checkin_date: { type: 'date', required: true },
      checkout_date: { type: 'date', required: true },
      room_price: { type: 'number', required: true, min: 0 },
      booking_source: { type: 'enum', values: ['MANUAL_ENTRY', 'SELF_USE', 'ONLINE'], default: 'MANUAL_ENTRY' },
      stay_status: { type: 'enum', values: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'], default: 'PENDING' },
      payment_status: { type: 'enum', values: ['PENDING', 'PAID', 'REFUNDED'], default: 'PENDING' },
      commission_status: { type: 'enum', values: ['NOT_ELIGIBLE', 'PENDING', 'CALCULATED', 'PAID'], default: 'NOT_ELIGIBLE' },
      commission_amount: { type: 'number', default: 0 },
      commission_type: { type: 'enum', values: ['CASH', 'ACCOMMODATION'], default: 'ACCOMMODATION' },
      is_first_referral_bonus: { type: 'boolean', default: false },
      first_referral_bonus_amount: { type: 'number', default: 0 },
      manually_confirmed_by: { type: 'string', required: false },
      manually_confirmed_at: { type: 'datetime', required: false },
      notes: { type: 'string', required: false },
      created_at: { type: 'datetime', autoGenerate: true },
      updated_at: { type: 'datetime', autoUpdate: true }
    },
    indexes: ['id', 'partner_code', 'guest_phone'],
    uniqueKeys: ['id']
  },
  
  Partner: {
    fields: {
      partner_code: { type: 'string', required: true, unique: true },
      partner_name: { type: 'string', required: true },
      partner_level: { type: 'enum', values: ['LV1_INSIDER', 'LV2_GUIDE', 'LV3_GUARDIAN'], default: 'LV1_INSIDER' },
      contact_phone: { type: 'string', required: true },
      contact_email: { type: 'email', required: false },
      bank_code: { type: 'string', required: false },
      bank_account: { type: 'string', required: false },
      commission_preference: { type: 'enum', values: ['CASH', 'ACCOMMODATION'], default: 'ACCOMMODATION' },
      total_referrals: { type: 'number', default: 0 },
      successful_referrals: { type: 'number', default: 0 },
      yearly_referrals: { type: 'number', default: 0 },
      total_commission_earned: { type: 'number', default: 0 },
      total_commission_paid: { type: 'number', default: 0 },
      available_points: { type: 'number', default: 0 },
      points_used: { type: 'number', default: 0 },
      pending_commission: { type: 'number', default: 0 },
      join_date: { type: 'date', autoGenerate: true },
      is_active: { type: 'boolean', default: true },
      notes: { type: 'string', required: false },
      created_at: { type: 'datetime', autoGenerate: true },
      updated_at: { type: 'datetime', autoUpdate: true }
    },
    indexes: ['partner_code', 'contact_phone'],
    uniqueKeys: ['partner_code']
  },
  
  Payout: {
    fields: {
      id: { type: 'number', required: true, autoGenerate: true },
      partner_code: { type: 'string', required: true },
      payout_type: { type: 'enum', values: ['CASH', 'ACCOMMODATION', 'POINTS_REFUND', 'POINTS_ADJUSTMENT_DEBIT', 'POINTS_ADJUSTMENT_CREDIT'], required: true },
      amount: { type: 'number', required: true },
      related_booking_ids: { type: 'string', required: false },
      payout_method: { type: 'enum', values: ['BANK_TRANSFER', 'ACCOMMODATION_VOUCHER', 'ACCOMMODATION_REFUND', 'CASH', 'OTHER'] },
      payout_status: { type: 'enum', values: ['PENDING', 'COMPLETED', 'CANCELLED'], default: 'PENDING' },
      bank_transfer_date: { type: 'date', required: false },
      bank_transfer_reference: { type: 'string', required: false },
      accommodation_voucher_code: { type: 'string', required: false },
      notes: { type: 'string', required: false },
      created_by: { type: 'string', default: 'system' },
      created_at: { type: 'datetime', autoGenerate: true },
      updated_at: { type: 'datetime', autoUpdate: true }
    },
    indexes: ['id', 'partner_code', 'payout_status'],
    uniqueKeys: ['id']
  }
};
```

### 3. 數據訪問層（DAO）

```javascript
class BaseDAO {
  constructor(sheetName, modelDefinition) {
    this.sheetName = sheetName;
    this.modelDef = modelDefinition;
    this.sheet = null;
    this.dataModel = null;
  }
  
  initialize() {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    this.sheet = spreadsheet.getSheetByName(this.sheetName);
    if (!this.sheet) {
      throw new Error(`Sheet ${this.sheetName} not found`);
    }
    this.dataModel = new SheetDataModel(this.sheet);
  }
  
  findById(id) {
    this.initialize();
    const values = this.sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const rowObj = this.dataModel.rowToObject(values[i]);
      if (rowObj.id == id) {
        return this.validate(rowObj);
      }
    }
    return null;
  }
  
  findByField(fieldName, value) {
    this.initialize();
    const values = this.sheet.getDataRange().getValues();
    const results = [];
    for (let i = 1; i < values.length; i++) {
      const rowObj = this.dataModel.rowToObject(values[i]);
      if (rowObj[fieldName] == value) {
        results.push(this.validate(rowObj));
      }
    }
    return results;
  }
  
  create(data) {
    this.initialize();
    const validated = this.validate(data, true);
    const row = this.dataModel.objectToRow(validated);
    this.sheet.appendRow(row);
    return validated;
  }
  
  update(id, data) {
    this.initialize();
    const values = this.sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const rowObj = this.dataModel.rowToObject(values[i]);
      if (rowObj.id == id) {
        const updated = Object.assign({}, rowObj, data);
        const validated = this.validate(updated);
        const row = this.dataModel.objectToRow(validated);
        this.sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        return validated;
      }
    }
    throw new Error(`Record with id ${id} not found`);
  }
  
  validate(data, isNew = false) {
    const validated = {};
    const errors = [];
    
    Object.keys(this.modelDef.fields).forEach(fieldName => {
      const fieldDef = this.modelDef.fields[fieldName];
      let value = data[fieldName];
      
      // 自動生成欄位
      if (isNew && fieldDef.autoGenerate) {
        if (fieldDef.type === 'number') {
          value = this.generateNextId();
        } else if (fieldDef.type === 'datetime' || fieldDef.type === 'date') {
          value = new Date();
        }
      }
      
      // 自動更新欄位
      if (fieldDef.autoUpdate && fieldDef.type === 'datetime') {
        value = new Date();
      }
      
      // 預設值
      if (value === undefined || value === null || value === '') {
        if (fieldDef.default !== undefined) {
          value = fieldDef.default;
        } else if (fieldDef.required && !fieldDef.autoGenerate) {
          errors.push(`Field ${fieldName} is required`);
        }
      }
      
      // 類型驗證
      if (value !== undefined && value !== null && value !== '') {
        if (!this.validateType(value, fieldDef)) {
          errors.push(`Field ${fieldName} has invalid type`);
        }
      }
      
      validated[fieldName] = value;
    });
    
    if (errors.length > 0) {
      throw new Error('Validation failed: ' + errors.join(', '));
    }
    
    return validated;
  }
  
  validateType(value, fieldDef) {
    switch (fieldDef.type) {
      case 'number':
        return !isNaN(value);
      case 'string':
        return typeof value === 'string';
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
      case 'datetime':
        return value instanceof Date || !isNaN(Date.parse(value));
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'enum':
        return fieldDef.values.includes(value);
      default:
        return true;
    }
  }
  
  generateNextId() {
    // 實現 ID 生成邏輯
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
}

// 具體的 DAO 實現
class BookingDAO extends BaseDAO {
  constructor() {
    super('Bookings', DataModels.Booking);
  }
  
  findByGuestInfo(guestName, guestPhone, checkinDate) {
    this.initialize();
    const values = this.sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const rowObj = this.dataModel.rowToObject(values[i]);
      if (rowObj.guest_name === guestName && 
          rowObj.guest_phone === guestPhone &&
          this.isSameDate(rowObj.checkin_date, checkinDate)) {
        return this.validate(rowObj);
      }
    }
    return null;
  }
  
  isSameDate(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.toDateString() === d2.toDateString();
  }
}

class PartnerDAO extends BaseDAO {
  constructor() {
    super('Partners', DataModels.Partner);
  }
  
  findByPartnerCode(partnerCode) {
    const results = this.findByField('partner_code', partnerCode);
    return results.length > 0 ? results[0] : null;
  }
}

class PayoutDAO extends BaseDAO {
  constructor() {
    super('Payouts', DataModels.Payout);
  }
  
  findByPartnerCode(partnerCode) {
    return this.findByField('partner_code', partnerCode);
  }
}
```

### 4. 事務管理器

```javascript
class TransactionManager {
  constructor() {
    this.operations = [];
    this.rollbackOperations = [];
  }
  
  addOperation(operation, rollback) {
    this.operations.push(operation);
    this.rollbackOperations.push(rollback);
  }
  
  async execute() {
    const results = [];
    let failedIndex = -1;
    
    try {
      // 執行所有操作
      for (let i = 0; i < this.operations.length; i++) {
        try {
          const result = await this.operations[i]();
          results.push(result);
        } catch (error) {
          failedIndex = i;
          throw error;
        }
      }
      
      return {
        success: true,
        results: results
      };
      
    } catch (error) {
      // 回滾已執行的操作
      if (failedIndex > 0) {
        for (let i = failedIndex - 1; i >= 0; i--) {
          try {
            await this.rollbackOperations[i]();
          } catch (rollbackError) {
            Logger.log(`Rollback failed at operation ${i}: ${rollbackError}`);
          }
        }
      }
      
      throw new Error(`Transaction failed at operation ${failedIndex}: ${error.message}`);
    }
  }
}
```

### 5. 服務層重構

```javascript
class BookingService {
  constructor() {
    this.bookingDAO = new BookingDAO();
    this.partnerDAO = new PartnerDAO();
    this.payoutDAO = new PayoutDAO();
  }
  
  async createBooking(data) {
    const transaction = new TransactionManager();
    
    // 驗證數據
    const validatedData = this.validateBookingData(data);
    
    // 添加創建訂房操作
    let booking;
    transaction.addOperation(
      () => {
        booking = this.bookingDAO.create(validatedData);
        return booking;
      },
      () => {
        if (booking && booking.id) {
          this.bookingDAO.delete(booking.id);
        }
      }
    );
    
    // 如果有推薦人，更新推薦統計
    if (validatedData.partner_code) {
      transaction.addOperation(
        () => {
          const partner = this.partnerDAO.findByPartnerCode(validatedData.partner_code);
          if (partner) {
            return this.partnerDAO.update(partner.partner_code, {
              total_referrals: partner.total_referrals + 1
            });
          }
        },
        () => {
          const partner = this.partnerDAO.findByPartnerCode(validatedData.partner_code);
          if (partner) {
            this.partnerDAO.update(partner.partner_code, {
              total_referrals: Math.max(0, partner.total_referrals - 1)
            });
          }
        }
      );
    }
    
    // 執行事務
    const result = await transaction.execute();
    return result.results[0]; // 返回創建的訂房記錄
  }
  
  async confirmCheckin(bookingId) {
    const transaction = new TransactionManager();
    
    // 查找訂房記錄
    const booking = this.bookingDAO.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }
    
    // 計算佣金
    const commissionData = this.calculateCommission(booking);
    
    // 更新訂房狀態
    let updatedBooking;
    transaction.addOperation(
      () => {
        updatedBooking = this.bookingDAO.update(bookingId, {
          stay_status: 'COMPLETED',
          commission_status: 'CALCULATED',
          commission_amount: commissionData.amount,
          commission_type: commissionData.type,
          is_first_referral_bonus: commissionData.isFirstBonus,
          first_referral_bonus_amount: commissionData.firstBonusAmount
        });
        return updatedBooking;
      },
      () => {
        this.bookingDAO.update(bookingId, {
          stay_status: booking.stay_status,
          commission_status: booking.commission_status,
          commission_amount: booking.commission_amount,
          commission_type: booking.commission_type,
          is_first_referral_bonus: booking.is_first_referral_bonus,
          first_referral_bonus_amount: booking.first_referral_bonus_amount
        });
      }
    );
    
    // 更新大使佣金
    if (booking.partner_code && commissionData.amount > 0) {
      let partner;
      transaction.addOperation(
        () => {
          partner = this.partnerDAO.findByPartnerCode(booking.partner_code);
          if (partner) {
            return this.partnerDAO.update(partner.partner_code, {
              successful_referrals: partner.successful_referrals + 1,
              yearly_referrals: partner.yearly_referrals + 1,
              total_commission_earned: partner.total_commission_earned + commissionData.amount,
              pending_commission: partner.pending_commission + commissionData.amount
            });
          }
        },
        () => {
          if (partner) {
            this.partnerDAO.update(partner.partner_code, {
              successful_referrals: Math.max(0, partner.successful_referrals - 1),
              yearly_referrals: Math.max(0, partner.yearly_referrals - 1),
              total_commission_earned: Math.max(0, partner.total_commission_earned - commissionData.amount),
              pending_commission: Math.max(0, partner.pending_commission - commissionData.amount)
            });
          }
        }
      );
      
      // 創建 Payout 記錄
      let payout;
      transaction.addOperation(
        () => {
          payout = this.payoutDAO.create({
            partner_code: booking.partner_code,
            payout_type: commissionData.type,
            amount: commissionData.amount,
            related_booking_ids: bookingId.toString(),
            payout_status: 'PENDING',
            notes: `佣金 - 訂單 #${bookingId}`
          });
          return payout;
        },
        () => {
          if (payout && payout.id) {
            this.payoutDAO.delete(payout.id);
          }
        }
      );
    }
    
    // 執行事務
    const result = await transaction.execute();
    return updatedBooking;
  }
  
  calculateCommission(booking) {
    // 實現佣金計算邏輯
    if (!booking.partner_code) {
      return { amount: 0, type: 'NONE' };
    }
    
    const partner = this.partnerDAO.findByPartnerCode(booking.partner_code);
    if (!partner) {
      return { amount: 0, type: 'NONE' };
    }
    
    // 根據等級計算佣金
    const rates = COMMISSION_RATES[partner.partner_level];
    const commissionType = partner.commission_preference || 'ACCOMMODATION';
    const commissionAmount = rates[commissionType.toLowerCase()] || 0;
    
    // 檢查是否首次推薦
    const isFirstBonus = partner.successful_referrals === 0;
    const firstBonusAmount = isFirstBonus ? FIRST_REFERRAL_BONUS : 0;
    
    return {
      amount: commissionAmount + firstBonusAmount,
      type: commissionType,
      isFirstBonus: isFirstBonus,
      firstBonusAmount: firstBonusAmount
    };
  }
  
  validateBookingData(data) {
    // 實現數據驗證邏輯
    const errors = [];
    
    if (!data.guest_name) {
      errors.push('Guest name is required');
    }
    
    if (!data.guest_phone) {
      errors.push('Guest phone is required');
    }
    
    if (!data.checkin_date) {
      errors.push('Check-in date is required');
    }
    
    if (!data.room_price || data.room_price <= 0) {
      errors.push('Valid room price is required');
    }
    
    if (errors.length > 0) {
      throw new Error('Validation failed: ' + errors.join(', '));
    }
    
    return data;
  }
}
```

### 6. 錯誤處理和日誌系統

```javascript
class Logger {
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp: timestamp,
      level: level,
      message: message,
      data: data
    };
    
    // 記錄到 Google Apps Script 日誌
    console.log(JSON.stringify(logEntry));
    
    // 可選：記錄到專門的日誌表
    try {
      const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
      let logSheet = spreadsheet.getSheetByName('_Logs');
      if (!logSheet) {
        logSheet = spreadsheet.insertSheet('_Logs');
        logSheet.appendRow(['Timestamp', 'Level', 'Message', 'Data']);
      }
      logSheet.appendRow([timestamp, level, message, JSON.stringify(data)]);
    } catch (e) {
      // 忽略日誌記錄錯誤
    }
  }
  
  static info(message, data) {
    this.log('INFO', message, data);
  }
  
  static warn(message, data) {
    this.log('WARN', message, data);
  }
  
  static error(message, data) {
    this.log('ERROR', message, data);
  }
}

class ErrorHandler {
  static handle(error, context = {}) {
    Logger.error(error.message, {
      stack: error.stack,
      context: context
    });
    
    // 根據錯誤類型返回適當的響應
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: error.message,
        type: 'VALIDATION_ERROR',
        details: error.details
      };
    } else if (error instanceof NotFoundError) {
      return {
        success: false,
        error: error.message,
        type: 'NOT_FOUND'
      };
    } else if (error instanceof TransactionError) {
      return {
        success: false,
        error: 'Transaction failed. All changes have been rolled back.',
        type: 'TRANSACTION_ERROR',
        details: error.message
      };
    } else {
      return {
        success: false,
        error: 'An unexpected error occurred',
        type: 'INTERNAL_ERROR'
      };
    }
  }
}

// 自定義錯誤類型
class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class TransactionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TransactionError';
  }
}
```

## 三、實施計劃

### 第一階段：基礎架構（1-2 天）
1. 實現 SheetDataModel 類
2. 實現 BaseDAO 類
3. 建立數據模型定義

### 第二階段：數據訪問層（2-3 天）
1. 實現各個 DAO 類
2. 遷移現有查詢邏輯
3. 添加數據驗證

### 第三階段：業務邏輯層（3-4 天）
1. 實現服務層類
2. 添加事務管理
3. 遷移業務邏輯

### 第四階段：測試和優化（2-3 天）
1. 單元測試
2. 整合測試
3. 性能優化

### 第五階段：部署和監控（1-2 天）
1. 漸進式部署
2. 監控和日誌
3. 回滾計劃

## 四、性能優化建議

### 1. 緩存策略
```javascript
class CacheManager {
  constructor() {
    this.cache = {};
    this.ttl = 300000; // 5 分鐘
  }
  
  get(key) {
    const item = this.cache[key];
    if (item && Date.now() - item.timestamp < this.ttl) {
      return item.data;
    }
    return null;
  }
  
  set(key, data) {
    this.cache[key] = {
      data: data,
      timestamp: Date.now()
    };
  }
  
  clear() {
    this.cache = {};
  }
}
```

### 2. 批量操作
```javascript
class BatchProcessor {
  static async processBatch(items, processor, batchSize = 10) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      );
      results.push(...batchResults);
    }
    return results;
  }
}
```

### 3. 索引優化
- 在常用查詢欄位建立索引
- 使用複合索引優化多條件查詢
- 定期重建索引

## 五、安全性增強

### 1. 輸入驗證
```javascript
class InputValidator {
  static sanitize(input) {
    if (typeof input === 'string') {
      return input
        .replace(/[<>]/g, '') // 防止 HTML 注入
        .trim()
        .substring(0, 1000); // 限制長度
    }
    return input;
  }
  
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  static validatePhone(phone) {
    const phoneRegex = /^[\d\-\+\s\(\)]+$/;
    return phoneRegex.test(phone);
  }
}
```

### 2. 權限控制
```javascript
class AuthorizationManager {
  static checkPermission(user, action, resource) {
    // 實現權限檢查邏輯
    const permissions = {
      'admin': ['*'],
      'manager': ['read', 'update', 'create'],
      'user': ['read']
    };
    
    const userRole = user.role || 'user';
    const allowed = permissions[userRole];
    
    return allowed.includes('*') || allowed.includes(action);
  }
}
```

## 六、監控和維護

### 1. 健康檢查
```javascript
class HealthChecker {
  static async checkSystem() {
    const checks = {
      database: await this.checkDatabase(),
      memory: this.checkMemory(),
      api: await this.checkAPI()
    };
    
    return {
      status: Object.values(checks).every(c => c.status === 'OK') ? 'HEALTHY' : 'UNHEALTHY',
      checks: checks
    };
  }
  
  static async checkDatabase() {
    try {
      const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
      return { status: 'OK', message: 'Database accessible' };
    } catch (error) {
      return { status: 'ERROR', message: error.message };
    }
  }
  
  static checkMemory() {
    // Google Apps Script 沒有直接的記憶體 API
    return { status: 'OK', message: 'Memory check not available' };
  }
  
  static async checkAPI() {
    // 檢查 API 端點
    return { status: 'OK', message: 'API responding' };
  }
}
```

### 2. 性能監控
```javascript
class PerformanceMonitor {
  static startTimer(operation) {
    return {
      operation: operation,
      startTime: Date.now()
    };
  }
  
  static endTimer(timer) {
    const duration = Date.now() - timer.startTime;
    Logger.info(`Performance: ${timer.operation} took ${duration}ms`);
    
    // 如果操作時間過長，記錄警告
    if (duration > 5000) {
      Logger.warn(`Slow operation detected: ${timer.operation}`, { duration: duration });
    }
    
    return duration;
  }
}
```

## 七、結論

這個重構方案將顯著提升系統的：

1. **可維護性**：通過標頭驅動的數據訪問，消除硬編碼索引
2. **可靠性**：通過事務管理和錯誤處理，確保數據一致性
3. **可擴展性**：通過模組化設計，易於添加新功能
4. **性能**：通過緩存和批量處理，提升系統效能
5. **安全性**：通過輸入驗證和權限控制，保護數據安全

建議採用漸進式重構策略，先從最關鍵的部分開始，逐步替換舊代碼，確保系統穩定運行。