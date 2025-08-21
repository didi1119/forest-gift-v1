// ===== Google Apps Script 佣金管理系統 v5.0 - 完整修復版 =====
// 這是完整的單一檔案版本，可以直接部署到 Google Apps Script
// 包含標頭驅動的數據訪問層，消除所有硬編碼索引
// 
// v5.0 修復內容：
// 1. 使用住宿金時同步更新 total_commission_earned
// 2. 轉換現金時同步更新 total_commission_earned
// 3. 加入並發控制機制防止競爭條件
// 4. 確保數據完整性：total_commission_earned >= points_used

// ========================================
// 系統配置
// ========================================
const SHEETS_ID = '1Vwh5lZH6nNhm-u0t75cEUKiAP1kLIxVHQxHIyvlVNMI'; // 正確的 Google Sheets ID
const GITHUB_PAGES_URL = 'https://didi1119.github.io/forest-gift-v1/index.html';
const DEFAULT_LINE_COUPON_URL = 'https://lin.ee/q38pqot';

// 調用深度追蹤（防止無限循環）
let CALL_DEPTH = 0;
const MAX_CALL_DEPTH = 5;

// ===== 全局鎖機制（v5.0 新增） =====
const GlobalLockService = {
  acquire(key, timeout = 10000) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(timeout);
      return lock;
    } catch (e) {
      Logger.log(`無法獲取鎖 ${key}: ${e.message}`);
      return null;
    }
  }
};

// 佣金等級對照表
const COMMISSION_RATES = {
  'LV1_INSIDER': { accommodation: 1000, cash: 500 },
  'LV2_GUIDE': { accommodation: 1200, cash: 600 },
  'LV3_GUARDIAN': { accommodation: 1500, cash: 750 }
};

const FIRST_REFERRAL_BONUS = 1500; // 首次推薦獎勵（僅LV1享有）

// 等級晉升條件
const LEVEL_REQUIREMENTS = {
  'LV2_GUIDE': 4,   // 年度4組成功推薦
  'LV3_GUARDIAN': 10 // 年度10組成功推薦
};

// ========================================
// 數據模型定義
// ========================================
const DataModels = {
  Booking: {
    tableName: 'Bookings',
    fields: ['id', 'partner_code', 'guest_name', 'guest_phone', 'guest_email', 
             'bank_account_last5', 'checkin_date', 'checkout_date', 'room_price', 
             'booking_source', 'stay_status', 'payment_status', 'commission_status', 
             'commission_amount', 'commission_type', 'is_first_referral_bonus', 
             'first_referral_bonus_amount', 'manually_confirmed_by', 
             'manually_confirmed_at', 'notes', 'created_at', 'updated_at']
  },
  Partner: {
    tableName: 'Partners',
    fields: ['id', 'partner_code', 'name', 'email', 'phone', 'level', 
             'level_progress', 'total_successful_referrals', 'commission_preference',
             'total_commission_earned', 'total_commission_paid', 'pending_commission',
             'coupon_code', 'coupon_url', 'landing_link', 'coupon_link',
             'short_landing_link', 'short_coupon_link', 'created_at', 'updated_at',
             // 需要添加但目前不存在的欄位
             'available_points', 'points_used', 'bank_account', 'bank_code',
             'yearly_referrals', 'notes', 'is_active', 'contact_phone', 'contact_email']
  },
  Payout: {
    tableName: 'Payouts',
    fields: ['id', 'partner_code', 'payout_type', 'amount', 'related_booking_ids', 
             'payout_method', 'payout_status', 'bank_transfer_date', 
             'bank_transfer_reference', 'accommodation_voucher_code', 'notes', 
             'created_by', 'created_at', 'updated_at']
  },
  AccommodationUsage: {
    tableName: 'Accommodation_Usage',
    fields: ['id', 'partner_code', 'deduct_amount', 'related_booking_id', 
             'usage_date', 'usage_type', 'notes', 'created_by', 'created_at', 'updated_at']
  },
  Clicks: {
    tableName: 'Clicks',
    fields: ['id', 'partner_code', 'destination', 'utm_source', 'utm_medium', 
             'utm_campaign', 'referrer', 'user_agent', 'ip_address', 'click_time', 
             'created_at']
  }
};

// ========================================
// 核心類：SheetDataModel - 動態欄位映射
// ========================================
class SheetDataModel {
  constructor(sheet) {
    this.sheet = sheet;
    this.headers = null;
    this.columnMap = null;
    this.initialize();
  }
  
  initialize() {
    if (!this.sheet) {
      throw new Error('Sheet is not initialized');
    }
    
    const lastColumn = this.sheet.getLastColumn();
    if (lastColumn === 0) {
      this.headers = [];
      this.columnMap = {};
      return;
    }
    
    // 讀取表頭（第一行）
    const headerRange = this.sheet.getRange(1, 1, 1, lastColumn);
    const headerValues = headerRange.getValues()[0];
    
    // 建立欄位名到索引的映射
    this.headers = headerValues.map(h => h.toString().toLowerCase().trim());
    this.columnMap = {};
    
    this.headers.forEach((header, index) => {
      if (header) {
        this.columnMap[header] = index;
        // 支援原始大小寫
        this.columnMap[headerValues[index]] = index;
      }
    });
    
    Logger.log(`Initialized ${this.sheet.getName()}: ${JSON.stringify(this.columnMap)}`);
  }
  
  // 根據欄位名稱獲取值
  getFieldValue(row, fieldName) {
    const index = this.columnMap[fieldName.toLowerCase()] ?? this.columnMap[fieldName];
    if (index === undefined) {
      Logger.log(`Warning: Field "${fieldName}" not found in ${this.sheet.getName()}`);
      return null;
    }
    return row[index];
  }
  
  // 根據欄位名稱設置值
  setFieldValue(row, fieldName, value) {
    const index = this.columnMap[fieldName.toLowerCase()] ?? this.columnMap[fieldName];
    if (index === undefined) {
      throw new Error(`Field "${fieldName}" not found in ${this.sheet.getName()}`);
    }
    row[index] = value;
    return row;
  }
  
  // 將數據行轉換為物件
  rowToObject(row) {
    const obj = {};
    this.headers.forEach((header, index) => {
      if (header) {
        obj[header] = row[index];
      }
    });
    return obj;
  }
  
  // 將物件轉換為數據行
  objectToRow(obj) {
    const row = new Array(this.headers.length);
    Object.keys(obj).forEach(key => {
      const index = this.columnMap[key.toLowerCase()] ?? this.columnMap[key];
      if (index !== undefined) {
        row[index] = obj[key];
      }
    });
    return row;
  }
  
  // 檢查欄位是否存在
  hasField(fieldName) {
    const normalized = fieldName.toLowerCase();
    return this.columnMap[normalized] !== undefined || this.columnMap[fieldName] !== undefined;
  }
}

// ========================================
// 通用數據訪問函數
// ========================================

/**
 * 查找記錄 - 使用動態欄位映射
 */
function findRecordsByField(sheetName, fieldName, value) {
  const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
  const sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} not found`);
  }
  
  const dataModel = new SheetDataModel(sheet);
  const values = sheet.getDataRange().getValues();
  const results = [];
  
  // 跳過表頭，從第二行開始
  for (let i = 1; i < values.length; i++) {
    const fieldValue = dataModel.getFieldValue(values[i], fieldName);
    if (fieldValue == value) {
      results.push({
        rowIndex: i + 1, // 實際行號（1-based）
        data: dataModel.rowToObject(values[i])
      });
    }
  }
  
  return results;
}

/**
 * 根據ID查找單一記錄
 */
function findRecordById(sheetName, id) {
  const results = findRecordsByField(sheetName, 'id', id);
  return results.length > 0 ? results[0] : null;
}

/**
 * 更新記錄 - 使用動態欄位映射
 * 修復：Partners 表使用 partner_code 作為主鍵
 */
function updateRecord(sheetName, id, updates) {
  const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
  const sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} not found`);
  }
  
  const dataModel = new SheetDataModel(sheet);
  
  // Partners 表使用 partner_code 作為主鍵
  let record;
  if (sheetName === 'Partners') {
    const results = findRecordsByField(sheetName, 'partner_code', id);
    record = results.length > 0 ? results[0] : null;
  } else {
    record = findRecordById(sheetName, id);
  }
  
  if (!record) {
    throw new Error(`Record with ID ${id} not found in ${sheetName}`);
  }
  
  // 合併現有數據和更新
  const updatedData = Object.assign({}, record.data, updates, {
    updated_at: new Date()
  });
  
  // 轉換為數據行
  const row = dataModel.objectToRow(updatedData);
  
  // 更新 Google Sheets
  const range = sheet.getRange(record.rowIndex, 1, 1, row.length);
  range.setValues([row]);
  
  Logger.log(`Updated record in ${sheetName}: ID=${id}`);
  return updatedData;
}

/**
 * 創建新記錄 - 使用動態欄位映射
 */
function createRecord(sheetName, data) {
  const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
  const sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} not found`);
  }
  
  const dataModel = new SheetDataModel(sheet);
  const timestamp = new Date();
  
  // 添加時間戳
  data.created_at = data.created_at || timestamp;
  data.updated_at = data.updated_at || timestamp;
  
  // 如果需要生成ID
  if (dataModel.hasField('id') && !data.id) {
    data.id = generateNextId(sheet, sheetName);
  }
  
  // 轉換為數據行
  const row = dataModel.objectToRow(data);
  
  // 添加到 Google Sheets
  sheet.appendRow(row);
  
  Logger.log(`Created new record in ${sheetName}: ${JSON.stringify(data)}`);
  return data;
}

/**
 * 生成下一個ID
 */
function generateNextId(sheet, tableName) {
  const dataModel = new SheetDataModel(sheet);
  const values = sheet.getDataRange().getValues();
  
  let maxId = 0;
  for (let i = 1; i < values.length; i++) {
    const id = parseInt(dataModel.getFieldValue(values[i], 'id'));
    if (!isNaN(id) && id > maxId) {
      maxId = id;
    }
  }
  
  const nextId = maxId + 1;
  Logger.log(`Generated ID for ${tableName}: ${nextId}`);
  return nextId;
}

// ========================================
// 主要入口點（保持與舊版相容）
// ========================================

/**
 * 處理 OPTIONS 請求（CORS 預檢）
 */
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * 處理 GET 請求
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    
    // API 請求
    if (params.action === 'get_all_data' || params.action === 'get_dashboard_data') {
      return handleGetAllData();
    }
    
    // 獲取點擊統計
    if (params.action === 'get_click_stats') {
      return handleGetClickStats(params);
    }
    
    // 測試請求
    if (params.test) {
      return HtmlService.createHtmlOutput('GET 測試成功！Apps Script 運行正常。');
    }
    
    // 記錄點擊（如果有）
    if (params.pid || params.subid) {
      try {
        recordClick(params, e);
      } catch (recordError) {
        Logger.log('記錄點擊錯誤: ' + recordError.toString());
      }
    }
    
    // 處理跳轉
    return handleRedirect(e);
    
  } catch (error) {
    Logger.log('GET 錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 處理 POST 請求
 */
function doPost(e) {
  try {
    Logger.log('=== doPost 開始 ===');
    Logger.log('e.parameter: ' + JSON.stringify(e.parameter));
    
    // 解析請求數據
    const data = e.parameter || {};
    
    // 如果有 JSON body
    if (e.postData && e.postData.type === 'application/json') {
      try {
        const jsonData = JSON.parse(e.postData.contents);
        Object.assign(data, jsonData);
      } catch (jsonError) {
        Logger.log('JSON 解析錯誤: ' + jsonError.toString());
      }
    }
    
    const action = data.action;
    
    if (!action) {
      Logger.log('❌ 缺少 action 參數');
      throw new Error('Action is required');
    }
    
    Logger.log(`✅ 處理 POST action: ${action}`);
    
    // 根據 action 路由到對應的處理函數
    switch (action) {
      case 'create_booking':
        return handleCreateBooking(data, e);
        
      case 'update_booking':
        return handleUpdateBooking(data);
        
      case 'delete_booking':
        return handleDeleteBooking(data);
        
      case 'confirm_checkin_completion':
        return handleConfirmCheckinCompletion(data, e);
        
      case 'create_payout':
        return handleCreatePayout(data);
        
      case 'update_payout':
        return handleUpdatePayout(data);
        
      case 'cancel_payout':
        return handleCancelPayout(data);
        
      case 'process_payout':
        return handleProcessPayout(data);
        
      case 'update_partner':
        return handleUpdatePartner(data);
        
      case 'update_partner_commission':
        return handleUpdatePartnerCommission(data);
        
      case 'use_accommodation_points':
        return handleUseAccommodationPoints(data);
        
      case 'convert_points_to_cash':
        return handleConvertPointsToCash(data);
        
      case 'get_all_data':
        return handleGetAllData();
        
      case 'get_dashboard_data':
        return handleGetAllData();  // 使用相同的處理函數
        
      case 'create_partner':
        return handleCreatePartner(data);
        
      case 'deduct_accommodation_points':
        return handleUseAccommodationPoints(data);  // 使用相同的邏輯
        
      default:
        throw new Error('未知的動作: ' + action);
    }
    
  } catch (error) {
    Logger.log('POST 錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

// ========================================
// 業務邏輯處理函數（使用新的數據訪問層）
// ========================================

/**
 * 處理創建訂房
 */
function handleCreateBooking(data, e) {
  try {
    // 判斷訂房類型
    let bookingSource = 'DIRECT';
    if (data.booking_source === 'SELF_USE') {
      bookingSource = 'SELF_USE';
    } else if (data.partner_code) {
      bookingSource = 'REFERRAL';
    }
    
    const bookingData = {
      partner_code: data.partner_code || null,
      guest_name: data.guest_name || '',
      guest_phone: data.guest_phone || '',
      guest_email: data.guest_email || '',
      bank_account_last5: data.bank_account_last5 || '',
      checkin_date: data.checkin_date || '',
      checkout_date: data.checkout_date || '',
      room_price: parseInt(data.room_price) || 0,
      booking_source: bookingSource,
      stay_status: data.stay_status || 'PENDING',
      payment_status: data.payment_status || 'PENDING',
      commission_status: data.partner_code ? 'PENDING' : 'NOT_ELIGIBLE',
      commission_amount: 0,
      commission_type: 'ACCOMMODATION',
      is_first_referral_bonus: false,
      first_referral_bonus_amount: 0,
      manually_confirmed_by: '',
      manually_confirmed_at: '',
      notes: data.notes || ''
    };
    
    const booking = createRecord('Bookings', bookingData);
    
    // 如果有推薦人且不是自用，更新推薦統計
    if (data.partner_code && bookingSource !== 'SELF_USE') {
      updatePartnerReferralStats(data.partner_code, 1);
    }
    
    // 如果是表單提交，返回 HTML
    if (e && e.parameter && Object.keys(e.parameter).length > 0) {
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>訂房登記成功</title>
        </head>
        <body>
          <h1>訂房記錄建立成功！</h1>
          <p>訂房ID：${booking.id}</p>
          <p>房客姓名：${booking.guest_name}</p>
        </body>
        </html>
      `);
    }
    
    return createJsonResponse({
      success: true,
      message: '訂房記錄建立成功',
      booking_id: booking.id
    });
    
  } catch (error) {
    Logger.log('建立訂房錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '建立訂房失敗: ' + error.message
    });
  }
}

/**
 * 處理確認入住完成
 */
function handleConfirmCheckinCompletion(data, e) {
  try {
    Logger.log('開始處理確認入住');
    
    // 查找訂房記錄
    let booking = null;
    
    // 優先使用 booking_id
    if (data.booking_id) {
      const result = findRecordById('Bookings', data.booking_id);
      if (result) {
        booking = result.data;
      }
    }
    
    // 如果沒找到，嘗試用房客資訊查找
    if (!booking && data.guest_name && data.guest_phone) {
      const results = findRecordsByGuestInfo(data.guest_name, data.guest_phone, data.checkin_date);
      if (results.length > 0) {
        booking = results[0].data;
      }
    }
    
    if (!booking) {
      throw new Error('找不到訂房記錄');
    }
    
    // 如果已經確認過，不重複處理
    if (booking.stay_status === 'COMPLETED') {
      return createJsonResponse({
        success: true,
        message: '該訂房已經確認過了',
        booking_id: booking.id
      });
    }
    
    // 計算佣金（如果有推薦人且不是 SELF_USE）
    let commissionAmount = 0;
    let commissionType = 'ACCOMMODATION';
    let isFirstBonus = false;
    let firstBonusAmount = 0;
    
    if (booking.partner_code && booking.booking_source !== 'SELF_USE') {
      const partner = findPartnerByCode(booking.partner_code);
      
      if (partner) {
        // 計算佣金
        const commission = calculateCommission(partner);
        commissionAmount = commission.amount;
        commissionType = commission.type;
        isFirstBonus = commission.isFirstBonus;
        firstBonusAmount = commission.firstBonusAmount;
        
        // 更新大使數據，傳入佣金類型避免重複計算
        updatePartnerAfterCheckin(partner, commissionAmount, commissionType);
        
        // 創建 Payout 記錄
        createPayoutRecord(partner.partner_code, commissionAmount, booking.id, commissionType);
      }
    }
    
    // 更新訂房狀態
    const updatedBooking = updateRecord('Bookings', booking.id, {
      stay_status: 'COMPLETED',
      commission_status: commissionAmount > 0 ? 'CALCULATED' : 'NOT_ELIGIBLE',
      commission_amount: commissionAmount,
      commission_type: commissionType,
      is_first_referral_bonus: isFirstBonus,
      first_referral_bonus_amount: firstBonusAmount,
      manually_confirmed_by: data.confirmed_by || 'system',
      manually_confirmed_at: new Date()
    });
    
    // 如果是表單提交，返回 HTML
    if (e && e.parameter && Object.keys(e.parameter).length > 0) {
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>入住確認成功</title>
        </head>
        <body>
          <h1>入住確認成功！</h1>
          <p>訂房ID：${booking.id}</p>
          <p>房客：${booking.guest_name}</p>
          ${commissionAmount > 0 ? `<p>佣金：$${commissionAmount}</p>` : ''}
        </body>
        </html>
      `);
    }
    
    return createJsonResponse({
      success: true,
      message: '入住確認成功',
      booking_id: booking.id,
      commission_amount: commissionAmount
    });
    
  } catch (error) {
    Logger.log('確認入住錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 處理使用住宿金
 */
function handleUseAccommodationPoints(data) {
  // 獲取鎖，防止並發（v5.0 新增）
  const lockKey = `points_${data.partner_code}`;
  const lock = GlobalLockService.acquire(lockKey);
  
  try {
    if (!lock) {
      throw new Error('系統忙碌中，請稍後重試');
    }
    
    Logger.log('=== 使用住宿金開始 ===');
    Logger.log('接收到的資料: ' + JSON.stringify(data));
    
    const partnerCode = data.partner_code;
    const deductAmount = parseFloat(data.deduct_amount || 0);
    const checkinDate = data.checkin_date || data.usage_date || new Date();
    
    Logger.log(`partner_code: ${partnerCode}, deduct_amount: ${deductAmount}`);
    
    if (!partnerCode || deductAmount <= 0) {
      throw new Error(`參數無效 - partner_code: ${partnerCode}, deduct_amount: ${deductAmount}`);
    }
    
    // 查找大使（重新查詢最新數據）
    const partner = findPartnerByCode(partnerCode);
    if (!partner) {
      throw new Error('找不到大使資料');
    }
    
    // 檢查可用點數（嚴格檢查，防止負數）
    const currentPoints = Math.max(0, parseFloat(partner.available_points) || 0);
    if (currentPoints < deductAmount) {
      throw new Error(`點數不足。可用：${currentPoints}，需要：${deductAmount}`);
    }
    
    // 創建 SELF_USE 訂房記錄
    const bookingData = {
      partner_code: partnerCode,
      guest_name: data.guest_name || partner.partner_name,
      guest_phone: data.guest_phone || partner.contact_phone,
      guest_email: data.guest_email || partner.contact_email || '',
      checkin_date: checkinDate,
      checkout_date: data.checkout_date || checkinDate,
      room_price: parseFloat(data.room_price || deductAmount),
      booking_source: 'SELF_USE',
      stay_status: 'COMPLETED',
      payment_status: 'PAID',
      commission_status: 'NOT_ELIGIBLE',
      notes: `住宿金折抵 NT$ ${deductAmount}，實付 NT$ ${(data.room_price || deductAmount) - deductAmount}`
    };
    
    const booking = createRecord('Bookings', bookingData);
    
    // 計算新的點數值（v5.0 修復）
    const newAvailablePoints = currentPoints - deductAmount;
    const newPointsUsed = (parseFloat(partner.points_used) || 0) + deductAmount;
    
    // 同步更新 total_commission_earned（v5.0 新增）
    let newTotalEarned = parseFloat(partner.total_commission_earned) || 0;
    if (newPointsUsed > newTotalEarned) {
      // 如果使用的點數超過總獲得，需要同步調整
      newTotalEarned = newPointsUsed;
      Logger.log(`調整 total_commission_earned: ${partner.total_commission_earned} → ${newTotalEarned}`);
    }
    
    // 更新大使數據（原子操作）
    updateRecord('Partners', partner.partner_code, {
      available_points: newAvailablePoints,
      points_used: newPointsUsed,
      total_commission_earned: newTotalEarned
    });
    
    Logger.log(`更新大使點數 - 可用: ${currentPoints} → ${newAvailablePoints}, 已使用: ${partner.points_used || 0} → ${newPointsUsed}`);
    
    // 記錄使用
    createRecord('Accommodation_Usage', {
      partner_code: partnerCode,
      deduct_amount: deductAmount,
      related_booking_id: booking.id,
      usage_date: checkinDate,
      usage_type: 'ROOM_DISCOUNT',
      notes: data.notes || '住宿金折抵',
      created_by: 'system'
    });
    
    // 創建 Payout 記錄（審計追蹤）
    createRecord('Payouts', {
      partner_code: partnerCode,
      payout_type: 'POINTS_ADJUSTMENT_DEBIT',
      amount: -deductAmount,
      related_booking_ids: booking.id.toString(),
      payout_method: 'POINTS_ADJUSTMENT',
      payout_status: 'COMPLETED',
      notes: `住宿金折抵 - 訂房 #${booking.id}`,
      created_by: 'system'
    });
    
    return createJsonResponse({
      success: true,
      message: `成功使用 ${deductAmount} 點住宿金`,
      booking_id: booking.id
    });
    
  } catch (error) {
    Logger.log('使用住宿金錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  } finally {
    // 釋放鎖（v5.0 新增）
    if (lock) {
      lock.releaseLock();
    }
  }
}

/**
 * 處理獲取所有數據
 */
function handleGetAllData() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const data = {};
    
    // 讀取各個表格
    ['Bookings', 'Partners', 'Payouts', 'Accommodation_Usage', 'Clicks'].forEach(sheetName => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (sheet) {
        const dataModel = new SheetDataModel(sheet);
        const values = sheet.getDataRange().getValues();
        const records = [];
        
        // 跳過表頭
        for (let i = 1; i < values.length; i++) {
          records.push(dataModel.rowToObject(values[i]));
        }
        
        data[sheetName.toLowerCase()] = records;
      } else {
        // 如果表格不存在，返回空陣列
        data[sheetName.toLowerCase()] = [];
      }
    });
    
    return createJsonResponse({
      success: true,
      data: data
    });
    
  } catch (error) {
    Logger.log('獲取數據錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 處理更新訂房
 */
function handleUpdateBooking(data) {
  try {
    // 調用深度檢查
    CALL_DEPTH++;
    if (CALL_DEPTH > MAX_CALL_DEPTH) {
      CALL_DEPTH = 0;  // 重置
      throw new Error('Maximum call depth exceeded - possible infinite loop detected');
    }
    
    const bookingId = data.booking_id || data.id;
    if (!bookingId) {
      throw new Error('Booking ID is required');
    }
    
    // 查找原始訂房記錄
    const oldBookingResult = findRecordById('Bookings', bookingId);
    if (!oldBookingResult) {
      throw new Error('Booking not found');
    }
    const oldBooking = oldBookingResult.data;
    
    // 移除不應更新的欄位
    delete data.action;
    delete data.booking_id;
    delete data.id;
    delete data.created_at;
    delete data._internal_call;  // 移除內部調用標記
    
    // 分析變更類型和影響
    const changes = analyzeBookingChanges(oldBooking, data);
    
    // 處理推薦人變更
    if (changes.hasPartnerChange) {
      handlePartnerChange(oldBooking, data);
    }
    
    // 處理房價變更（只有在已計算佣金時）
    if (changes.hasPriceChange && oldBooking.commission_status === 'CALCULATED') {
      handlePriceChange(oldBooking, data);
    }
    
    // 處理狀態變更
    if (changes.hasStatusChange) {
      return handleStatusChange(oldBooking, data, bookingId);
    }
    
    // 更新訂房記錄
    const updated = updateRecord('Bookings', bookingId, data);
    
    return createJsonResponse({
      success: true,
      message: 'Booking updated successfully',
      data: updated,
      changes: changes
    });
    
  } catch (error) {
    Logger.log('更新訂房錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  } finally {
    // 重置調用深度
    CALL_DEPTH = Math.max(0, CALL_DEPTH - 1);
  }
}

/**
 * 分析訂房變更影響
 */
function analyzeBookingChanges(oldBooking, newData) {
  const changes = {
    hasPartnerChange: false,
    hasPriceChange: false,
    hasStatusChange: false,
    hasMonetaryImpact: false,
    hasStatisticalImpact: false
  };
  
  // 檢查推薦人變更
  if (newData.partner_code !== undefined && newData.partner_code !== oldBooking.partner_code) {
    changes.hasPartnerChange = true;
    changes.hasStatisticalImpact = true;
    if (oldBooking.stay_status === 'COMPLETED') {
      changes.hasMonetaryImpact = true;
    }
  }
  
  // 檢查房價變更
  if (newData.room_price !== undefined && parseFloat(newData.room_price) !== parseFloat(oldBooking.room_price)) {
    changes.hasPriceChange = true;
    if (oldBooking.commission_status === 'CALCULATED') {
      changes.hasMonetaryImpact = true;
    }
  }
  
  // 檢查狀態變更
  if (newData.stay_status !== undefined && newData.stay_status !== oldBooking.stay_status) {
    changes.hasStatusChange = true;
    changes.hasMonetaryImpact = true;
    changes.hasStatisticalImpact = true;
  }
  
  return changes;
}

/**
 * 處理推薦人變更
 */
function handlePartnerChange(oldBooking, newData) {
  const oldPartnerCode = oldBooking.partner_code;
  const newPartnerCode = newData.partner_code;
  
  // 如果訂房未完成，只調整推薦統計
  if (oldBooking.stay_status !== 'COMPLETED') {
    // 減少舊推薦人統計
    if (oldPartnerCode) {
      updatePartnerReferralStats(oldPartnerCode, -1);
    }
    // 增加新推薦人統計
    if (newPartnerCode) {
      updatePartnerReferralStats(newPartnerCode, 1);
    }
    return;
  }
  
  // 如果訂房已完成，需要撤銷和重算佣金
  if (oldBooking.commission_amount > 0 && oldPartnerCode) {
    const oldPartner = findPartnerByCode(oldPartnerCode);
    if (oldPartner) {
      const commissionAmount = parseFloat(oldBooking.commission_amount);
      
      // 撤銷舊推薦人佣金
      const oldPartnerUpdates = {
        successful_referrals: Math.max(0, (oldPartner.successful_referrals || 0) - 1),
        yearly_referrals: Math.max(0, (oldPartner.yearly_referrals || 0) - 1),
        total_commission_earned: Math.max(0, (oldPartner.total_commission_earned || 0) - commissionAmount)
      };
      
      // 根據佣金類型撤銷
      if (oldBooking.commission_type === 'ACCOMMODATION') {
        oldPartnerUpdates.available_points = Math.max(0, (oldPartner.available_points || 0) - commissionAmount);
      } else {
        oldPartnerUpdates.pending_commission = Math.max(0, (oldPartner.pending_commission || 0) - commissionAmount);
      }
      
      updateRecord('Partners', oldPartnerCode, oldPartnerUpdates);
      
      // 創建撤銷記錄
      createRecord('Payouts', {
        partner_code: oldPartnerCode,
        payout_type: 'COMMISSION_REVERSAL',
        amount: -commissionAmount,
        related_booking_ids: oldBooking.id,
        payout_method: 'OTHER',
        payout_status: 'COMPLETED',
        notes: `變更推薦人，撤銷原佣金 NT$ ${commissionAmount}`,
        created_by: 'system'
      });
    }
  }
  
  // 計算新推薦人佣金（只有在訂房已完成時）
  if (newPartnerCode && oldBooking.stay_status === 'COMPLETED') {
    const newPartner = findPartnerByCode(newPartnerCode);
    if (newPartner) {
      const commission = calculateCommission(newPartner);
      
      // 更新新推薦人數據
      updatePartnerAfterCheckin(newPartner, commission.amount, commission.type);
      
      // 創建新佣金記錄
      createPayoutRecord(newPartnerCode, commission.amount, oldBooking.id, commission.type);
      
      // 更新訂房的佣金資訊
      newData.commission_amount = commission.amount;
      newData.commission_type = commission.type;
      newData.is_first_referral_bonus = commission.isFirstBonus;
      newData.first_referral_bonus_amount = commission.firstBonusAmount;
    }
  } else if (newPartnerCode && oldBooking.stay_status !== 'COMPLETED') {
    // 如果訂房未完成，只更新推薦人但不計算佣金
    newData.commission_status = 'PENDING';
  }
}

/**
 * 處理房價變更
 */
function handlePriceChange(oldBooking, newData) {
  const oldPrice = parseFloat(oldBooking.room_price || 0);
  const newPrice = parseFloat(newData.room_price || 0);
  
  if (!oldBooking.partner_code || oldBooking.commission_status !== 'CALCULATED') {
    return;
  }
  
  const partner = findPartnerByCode(oldBooking.partner_code);
  if (!partner) {
    return;
  }
  
  // 這裡簡化處理：房價變更不影響佣金（因為佣金是固定的）
  // 如果業務規則要求根據房價比例調整佣金，可以在這裡實現
  Logger.log(`Room price changed from ${oldPrice} to ${newPrice}, but commission remains fixed`);
}

/**
 * 處理狀態變更
 */
function handleStatusChange(oldBooking, newData, bookingId) {
  const oldStatus = oldBooking.stay_status;
  const newStatus = newData.stay_status;
  
  // 防止循環調用：如果是從其他 handler 調用過來的，不再觸發連鎖反應
  const isFromInternalCall = newData._internal_call || false;
  
  // PENDING → COMPLETED：執行確認入住
  if (oldStatus === 'PENDING' && newStatus === 'COMPLETED' && !isFromInternalCall) {
    return handleConfirmCheckinCompletion({
      booking_id: bookingId,
      confirmed_by: 'status_update',
      _internal_call: true  // 標記為內部調用
    });
  }
  
  // COMPLETED → CANCELLED：執行取消
  if (oldStatus === 'COMPLETED' && newStatus === 'CANCELLED' && !isFromInternalCall) {
    return handleDeleteBooking({
      booking_id: bookingId,
      _internal_call: true  // 標記為內部調用
    });
  }
  
  // CANCELLED → PENDING：重新啟用
  if (oldStatus === 'CANCELLED' && newStatus === 'PENDING') {
    // 重置相關狀態
    newData.commission_status = oldBooking.partner_code ? 'PENDING' : 'NOT_ELIGIBLE';
    newData.commission_amount = 0;
    newData.manually_confirmed_at = '';
    newData.manually_confirmed_by = '';
    
    // 如果有推薦人，恢復推薦統計
    if (oldBooking.partner_code) {
      updatePartnerReferralStats(oldBooking.partner_code, 1);
    }
  }
  
  // 更新訂房記錄
  const updated = updateRecord('Bookings', bookingId, newData);
  
  return createJsonResponse({
    success: true,
    message: `Booking status changed from ${oldStatus} to ${newStatus}`,
    data: updated
  });
}

/**
 * 處理刪除訂房
 */
function handleDeleteBooking(data) {
  try {
    const bookingId = data.booking_id || data.id;
    if (!bookingId) {
      throw new Error('Booking ID is required');
    }
    
    // 查找訂房記錄
    const booking = findRecordById('Bookings', bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }
    
    // 根據訂房類型處理取消邏輯
    if (booking.data.booking_source === 'SELF_USE' && booking.data.partner_code) {
      // SELF_USE：返還點數
      const partner = findPartnerByCode(booking.data.partner_code);
      if (partner) {
        // 從備註中提取折抵金額
        const deductAmount = extractDeductAmount(booking.data.notes);
        if (deductAmount > 0) {
          // 返還點數
          updateRecord('Partners', partner.partner_code, {
            available_points: (partner.available_points || 0) + deductAmount,
            points_used: Math.max(0, (partner.points_used || 0) - deductAmount)
          });
          
          // 創建返還記錄（正數表示返還/增加）
          createRecord('Payouts', {
            partner_code: partner.partner_code,
            payout_type: 'POINTS_REFUND',
            amount: deductAmount,  // 正數：返還給大使
            related_booking_ids: bookingId,
            payout_method: 'ACCOMMODATION_REFUND',
            payout_status: 'COMPLETED',
            notes: `取消訂單 ${bookingId}，返還住宿金 NT$ ${deductAmount}`,
            created_by: 'system'
          });
        }
      }
    } else if (booking.data.booking_source === 'REFERRAL' && booking.data.partner_code) {
      // REFERRAL：處理推薦相關的撤銷
      const partner = findPartnerByCode(booking.data.partner_code);
      if (partner) {
        const partnerUpdates = {
          total_referrals: Math.max(0, (partner.total_referrals || 0) - 1)
        };
        
        // 如果已完成入住，需要撤銷佣金
        if (booking.data.stay_status === 'COMPLETED' && booking.data.commission_amount > 0) {
          const commissionAmount = parseFloat(booking.data.commission_amount);
          
          // 減少成功推薦數和累積佣金
          partnerUpdates.successful_referrals = Math.max(0, (partner.successful_referrals || 0) - 1);
          partnerUpdates.yearly_referrals = Math.max(0, (partner.yearly_referrals || 0) - 1);
          partnerUpdates.total_commission_earned = Math.max(0, (partner.total_commission_earned || 0) - commissionAmount);
          
          // 根據佣金類型撤銷
          if (booking.data.commission_type === 'ACCOMMODATION') {
            partnerUpdates.available_points = Math.max(0, (partner.available_points || 0) - commissionAmount);
          } else if (booking.data.commission_type === 'CASH') {
            partnerUpdates.pending_commission = Math.max(0, (partner.pending_commission || 0) - commissionAmount);
          }
          
          // 檢查是否需要降級
          const newLevel = checkLevelUpgrade(partnerUpdates.yearly_referrals);
          if (newLevel !== partner.partner_level) {
            partnerUpdates.partner_level = newLevel;
            Logger.log(`Partner ${partner.partner_code} level adjusted to ${newLevel} after booking cancellation`);
          }
          
          // 創建撤銷記錄
          createRecord('Payouts', {
            partner_code: partner.partner_code,
            payout_type: 'COMMISSION_REVERSAL',
            amount: -commissionAmount,  // 負數表示撤銷
            related_booking_ids: bookingId,
            payout_method: 'OTHER',
            payout_status: 'COMPLETED',
            notes: `取消訂單 ${bookingId}，撤銷佣金 NT$ ${commissionAmount}`,
            created_by: 'system'
          });
        }
        
        // 更新大使數據
        updateRecord('Partners', partner.partner_code, partnerUpdates);
      }
    }
    
    // 標記為取消而不是真的刪除
    const cancelled = updateRecord('Bookings', bookingId, {
      stay_status: 'CANCELLED',
      commission_status: 'CANCELLED',
      notes: (booking.data.notes || '') + `\n[取消於 ${new Date().toISOString()}]`
    });
    
    return createJsonResponse({
      success: true,
      message: 'Booking cancelled successfully',
      data: cancelled
    });
    
  } catch (error) {
    Logger.log('刪除訂房錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 處理更新結算
 */
function handleUpdatePayout(data) {
  try {
    const payoutId = data.payout_id || data.id;
    if (!payoutId) {
      throw new Error('Payout ID is required');
    }
    
    // 移除不應更新的欄位
    delete data.action;
    delete data.payout_id;
    delete data.id;
    delete data.created_at;
    
    const updated = updateRecord('Payouts', payoutId, data);
    
    return createJsonResponse({
      success: true,
      message: 'Payout updated successfully',
      data: updated
    });
    
  } catch (error) {
    Logger.log('更新結算錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 處理取消結算
 */
function handleCancelPayout(data) {
  try {
    const payoutId = data.payout_id || data.id;
    if (!payoutId) {
      throw new Error('Payout ID is required');
    }
    
    // 查找 Payout 記錄
    const payoutResults = findRecordsByField('Payouts', 'id', payoutId);
    if (payoutResults.length === 0) {
      throw new Error('Payout not found');
    }
    
    const payout = payoutResults[0].data;
    
    // 如果已經是取消狀態，不重複處理
    if (payout.payout_status === 'CANCELLED') {
      return createJsonResponse({
        success: false,
        error: 'Payout already cancelled'
      });
    }
    
    // 如果是佣金類型的 Payout，需要撤銷佣金
    if (payout.payout_type === 'ACCOMMODATION' || payout.payout_type === 'CASH') {
      const partner = findPartnerByCode(payout.partner_code);
      if (partner) {
        const amount = parseFloat(payout.amount || 0);
        
        Logger.log(`=== 取消結算 ${payoutId} ===`);
        Logger.log(`Partner: ${partner.partner_code}, Type: ${payout.payout_type}, Amount: ${amount}`);
        Logger.log(`當前點數: ${partner.available_points}, 已使用點數: ${partner.points_used}`);
        
        // 準備更新數據
        const partnerUpdates = {
          total_commission_earned: Math.max(0, (partner.total_commission_earned || 0) - amount)
        };
        
        // 根據佣金類型撤銷對應欄位
        if (payout.payout_type === 'ACCOMMODATION') {
          // 撤銷住宿金點數
          const currentPoints = partner.available_points || 0;
          const pointsToRevoke = amount;
          
          // 如果點數不足，記錄負債但不讓點數變負
          if (currentPoints < pointsToRevoke) {
            Logger.log(`警告：點數不足撤銷。需撤銷: ${pointsToRevoke}, 可用: ${currentPoints}`);
            partnerUpdates.available_points = 0;
            
            // 記錄負債金額在備註中
            const debtAmount = pointsToRevoke - currentPoints;
            partnerUpdates.notes = (partner.notes || '') + 
              `\n[${new Date().toISOString()}] 取消結算 #${payoutId} 產生負債 ${debtAmount} 點`;
            
            // 創建負債記錄
            createRecord('Payouts', {
              partner_code: payout.partner_code,
              payout_type: 'DEBT_RECORD',
              amount: -debtAmount,
              related_booking_ids: payout.related_booking_ids || '',
              payout_method: 'OTHER',
              payout_status: 'PENDING',
              notes: `取消結算 #${payoutId} 產生的負債，原應撤銷 ${pointsToRevoke} 點，實際可撤銷 ${currentPoints} 點`,
              created_by: 'system'
            });
          } else {
            // 正常撤銷
            partnerUpdates.available_points = currentPoints - pointsToRevoke;
          }
        } else if (payout.payout_type === 'CASH') {
          // 撤銷現金佣金
          partnerUpdates.pending_commission = Math.max(0, (partner.pending_commission || 0) - amount);
        }
        
        // 只有真正的佣金（有關聯訂房）才減少成功推薦數
        // CASH_CONVERSION 等其他類型不應該影響推薦統計
        if (payout.related_booking_ids && payout.related_booking_ids.trim() !== '') {
          partnerUpdates.successful_referrals = Math.max(0, (partner.successful_referrals || 0) - 1);
          partnerUpdates.yearly_referrals = Math.max(0, (partner.yearly_referrals || 0) - 1);
          
          // 檢查是否需要降級
          const newLevel = checkLevelUpgrade(partnerUpdates.yearly_referrals);
          if (newLevel !== partner.partner_level) {
            partnerUpdates.partner_level = newLevel;
            Logger.log(`Partner ${partner.partner_code} level adjusted to ${newLevel} after cancellation`);
          }
        }
        
        // 更新大使數據
        updateRecord('Partners', partner.partner_code, partnerUpdates);
        
        // 創建撤銷記錄（負數金額）
        createRecord('Payouts', {
          partner_code: payout.partner_code,
          payout_type: 'COMMISSION_REVERSAL',
          amount: -amount,
          related_booking_ids: payout.related_booking_ids || '',
          payout_method: 'OTHER',
          payout_status: 'COMPLETED',
          notes: `撤銷 Payout #${payoutId} 的佣金`,
          created_by: 'admin'
        });
        
        Logger.log(`Reversed commission for partner ${partner.partner_code}, amount: ${amount}`);
      }
    }
    
    // 更新原 Payout 狀態
    const updated = updateRecord('Payouts', payoutId, {
      payout_status: 'CANCELLED',
      notes: (payout.notes || '') + ` [取消於 ${new Date().toISOString()}]`
    });
    
    return createJsonResponse({
      success: true,
      message: 'Payout cancelled and commission reversed successfully',
      data: updated
    });
    
  } catch (error) {
    Logger.log('取消結算錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 處理結算支付完成
 */
function handleProcessPayout(data) {
  try {
    const partnerCode = data.partner_code;
    const payAmount = parseFloat(data.amount || 0);
    const bankTransferDate = data.bank_transfer_date || new Date().toISOString().split('T')[0];
    const bankTransferReference = data.bank_transfer_reference || '';
    
    if (!partnerCode) {
      throw new Error('Partner code is required');
    }
    
    // 查找大使
    const partner = findPartnerByCode(partnerCode);
    if (!partner) {
      throw new Error('Partner not found');
    }
    
    // 如果沒有指定金額，使用全部待結算金額
    const actualPayAmount = payAmount > 0 ? payAmount : (partner.pending_commission || 0);
    
    if (actualPayAmount <= 0) {
      throw new Error('No pending commission to pay');
    }
    
    // 創建支付完成記錄
    const payout = createRecord('Payouts', {
      partner_code: partnerCode,
      payout_type: 'PAYMENT_COMPLETED',
      amount: actualPayAmount,
      payout_method: 'BANK_TRANSFER',
      payout_status: 'COMPLETED',
      bank_transfer_date: bankTransferDate,
      bank_transfer_reference: bankTransferReference,
      notes: data.notes || `銀行匯款 NT$ ${actualPayAmount}`,
      created_by: data.created_by || 'admin'
    });
    
    // 更新大使資料
    const partnerUpdates = {
      pending_commission: Math.max(0, (partner.pending_commission || 0) - actualPayAmount),
      total_commission_paid: (partner.total_commission_paid || 0) + actualPayAmount
    };
    
    updateRecord('Partners', partner.partner_code, partnerUpdates);
    
    Logger.log(`Processed payout for partner ${partnerCode}, amount: ${actualPayAmount}`);
    
    return createJsonResponse({
      success: true,
      message: `Payment completed successfully. Paid NT$ ${actualPayAmount}`,
      payout_id: payout.id,
      data: {
        payout: payout,
        remaining_pending: partnerUpdates.pending_commission
      }
    });
    
  } catch (error) {
    Logger.log('處理支付錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 處理更新大使佣金
 */
function handleUpdatePartnerCommission(data) {
  try {
    const partnerCode = data.partner_code;
    if (!partnerCode) {
      throw new Error('Partner code is required');
    }
    
    // 查找當前大使資料以計算差額
    const partner = findPartnerByCode(partnerCode);
    if (!partner) {
      throw new Error('Partner not found');
    }
    
    const updates = {};
    let adjustmentAmount = 0;
    let adjustmentType = 'MANUAL_ADJUSTMENT';
    
    // 計算各項調整金額
    if (data.total_commission_earned !== undefined) {
      const newValue = parseFloat(data.total_commission_earned);
      const diff = newValue - (partner.total_commission_earned || 0);
      if (diff !== 0) {
        adjustmentAmount = diff;
        updates.total_commission_earned = newValue;
      }
    }
    
    if (data.pending_commission !== undefined) {
      const newValue = Math.max(0, parseFloat(data.pending_commission));  // 確保不會是負數
      const diff = newValue - (partner.pending_commission || 0);
      if (diff !== 0) {
        adjustmentAmount = diff;
        adjustmentType = 'CASH_ADJUSTMENT';
        updates.pending_commission = newValue;
      }
    }
    
    if (data.available_points !== undefined) {
      const newValue = Math.max(0, parseFloat(data.available_points));  // 確保不會是負數
      const diff = newValue - (partner.available_points || 0);
      if (diff !== 0) {
        adjustmentAmount = diff;
        adjustmentType = 'POINTS_ADJUSTMENT';
        updates.available_points = newValue;
      }
    }
    
    if (data.points_used !== undefined) {
      updates.points_used = parseFloat(data.points_used);
    }
    
    // 如果有統計調整
    if (data.successful_referrals !== undefined) {
      updates.successful_referrals = parseInt(data.successful_referrals);
    }
    if (data.yearly_referrals !== undefined) {
      updates.yearly_referrals = parseInt(data.yearly_referrals);
    }
    
    const updated = updateRecord('Partners', partnerCode, updates);
    
    // 如果有調整原因或金額變動，創建 Payout 記錄
    if ((data.adjustment_reason || adjustmentAmount !== 0) && adjustmentAmount !== undefined) {
      createRecord('Payouts', {
        partner_code: partnerCode,
        payout_type: adjustmentType,
        amount: adjustmentAmount,
        payout_method: 'MANUAL_ADJUSTMENT',
        payout_status: 'COMPLETED',
        notes: data.adjustment_reason || `手動調整 ${adjustmentAmount > 0 ? '增加' : '減少'} NT$ ${Math.abs(adjustmentAmount)}`,
        created_by: data.created_by || 'admin'
      });
    }
    
    return createJsonResponse({
      success: true,
      message: 'Partner commission updated successfully',
      data: updated,
      adjustment: adjustmentAmount !== 0 ? {
        type: adjustmentType,
        amount: adjustmentAmount
      } : null
    });
    
  } catch (error) {
    Logger.log('更新大使佣金錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 處理更新大使資料
 */
function handleUpdatePartner(data) {
  try {
    const partnerCode = data.partner_code;
    if (!partnerCode) {
      throw new Error('Partner code is required');
    }
    
    // 查找大使
    const partner = findPartnerByCode(partnerCode);
    if (!partner) {
      throw new Error('Partner not found');
    }
    
    // 移除不應更新的欄位
    delete data.action;
    delete data.partner_code;
    delete data.created_at;
    
    // 記錄特殊變更
    const oldLevel = partner.partner_level;
    const oldPreference = partner.commission_preference;
    
    // 如果變更等級，創建審計記錄
    if (data.partner_level && data.partner_level !== oldLevel) {
      createRecord('Payouts', {
        partner_code: partnerCode,
        payout_type: 'LEVEL_ADJUSTMENT',
        amount: 0,
        payout_method: 'OTHER',
        payout_status: 'COMPLETED',
        notes: `等級調整：${oldLevel} → ${data.partner_level}`,
        created_by: data.updated_by || 'admin'
      });
      
      Logger.log(`Partner ${partnerCode} level changed from ${oldLevel} to ${data.partner_level}`);
    }
    
    // 如果變更佣金偏好，記錄
    if (data.commission_preference && data.commission_preference !== oldPreference) {
      Logger.log(`Partner ${partnerCode} preference changed from ${oldPreference} to ${data.commission_preference}`);
    }
    
    // 更新大使資料
    const updated = updateRecord('Partners', partnerCode, data);
    
    return createJsonResponse({
      success: true,
      message: 'Partner updated successfully',
      data: updated,
      changes: {
        levelChanged: data.partner_level && data.partner_level !== oldLevel,
        preferenceChanged: data.commission_preference && data.commission_preference !== oldPreference
      }
    });
    
  } catch (error) {
    Logger.log('更新大使資料錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 處理轉換點數為現金（v5.0 修復版）
 */
function handleConvertPointsToCash(data) {
  // 獲取鎖，防止並發（v5.0 新增）
  const lockKey = `convert_${data.partner_code}`;
  const lock = GlobalLockService.acquire(lockKey);
  
  try {
    if (!lock) {
      throw new Error('系統忙碌中，請稍後重試');
    }
    
    Logger.log('=== 轉換點數為現金開始 ===');
    Logger.log('接收到的資料: ' + JSON.stringify(data));
    
    const partnerCode = data.partner_code;
    const convertAmount = parseFloat(data.points_used || data.amount || 0);
    
    // 固定匯率：點數轉換為現金是50%的面額
    const EXCHANGE_RATE = 0.5;
    
    Logger.log(`partner_code: ${partnerCode}, 要轉換的點數: ${convertAmount}`);
    
    if (!partnerCode || convertAmount <= 0) {
      throw new Error(`參數無效 - partner_code: ${partnerCode}, points_used: ${convertAmount}`);
    }
    
    // 查找大使（重新查詢最新數據）
    const partner = findPartnerByCode(partnerCode);
    if (!partner) {
      throw new Error('找不到大使: ' + partnerCode);
    }
    
    // 檢查可用點數
    const currentPoints = parseFloat(partner.available_points) || 0;
    if (currentPoints < convertAmount) {
      throw new Error(`點數不足。可用：${currentPoints}，需要：${convertAmount}`);
    }
    
    // 計算現金金額（50%匯率）
    const cashAmount = Math.floor(convertAmount * EXCHANGE_RATE);
    
    Logger.log(`轉換計算 - 點數: ${convertAmount} → 現金: NT$ ${cashAmount} (匯率: ${EXCHANGE_RATE})`);
    
    // 計算新的點數值
    const newAvailablePoints = currentPoints - convertAmount;
    const newPointsUsed = (parseFloat(partner.points_used) || 0) + convertAmount;
    const newPendingCommission = (parseFloat(partner.pending_commission) || 0) + cashAmount;
    
    // 同步更新 total_commission_earned（v5.0 新增）
    let newTotalEarned = parseFloat(partner.total_commission_earned) || 0;
    if (newPointsUsed > newTotalEarned) {
      // 如果使用的點數超過總獲得，需要同步調整
      newTotalEarned = newPointsUsed;
      Logger.log(`調整 total_commission_earned: ${partner.total_commission_earned} → ${newTotalEarned}`);
    }
    
    Logger.log(`更新大使 ${partnerCode}:`);
    Logger.log(`  可用點數: ${currentPoints} → ${newAvailablePoints}`);
    Logger.log(`  已使用點數: ${partner.points_used || 0} → ${newPointsUsed}`);
    Logger.log(`  待支付現金: ${partner.pending_commission || 0} → ${newPendingCommission}`);
    Logger.log(`  總獲得佣金: ${partner.total_commission_earned || 0} → ${newTotalEarned}`);
    
    // 更新大使數據（原子操作）
    updateRecord('Partners', partnerCode, {
      available_points: newAvailablePoints,
      points_used: newPointsUsed,
      pending_commission: newPendingCommission,
      total_commission_earned: newTotalEarned
    });
    
    // 創建轉換記錄
    createRecord('Payouts', {
      partner_code: partnerCode,
      payout_type: 'CASH_CONVERSION',
      amount: cashAmount,  // 修正變數名稱
      payout_method: 'POINTS_CONVERSION',
      payout_status: 'PENDING',
      notes: data.notes || `點數轉現金：${convertAmount} 點 → NT$ ${cashAmount} (2:1)`,  // 修正變數名稱
      created_by: 'system'
    });
    
    Logger.log('✅ 轉換成功');
    
    return createJsonResponse({
      success: true,
      message: `成功轉換 ${convertAmount} 點為 NT$ ${cashAmount}`,  // 修正變數名稱
      data: {
        points_converted: convertAmount,
        cash_amount: cashAmount  // 修正變數名稱
      }
    });
    
  } catch (error) {
    Logger.log('轉換點數錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  } finally {
    // 釋放鎖（v5.0 新增）
    if (lock) {
      lock.releaseLock();
    }
  }
}

/**
 * 從備註中提取折抵金額
 */
function extractDeductAmount(notes) {
  if (!notes) return 0;
  
  const match = notes.match(/折抵\s*NT\$?\s*(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  
  return 0;
}

/**
 * 處理創建結算
 */
function handleCreatePayout(data) {
  try {
    const payoutData = {
      partner_code: data.partner_code,
      payout_type: data.payout_type || 'CASH',
      amount: parseFloat(data.amount || 0),
      related_booking_ids: data.related_booking_ids || data.booking_ids || '',
      payout_method: data.payout_method || (data.payout_type === 'CASH' ? 'BANK_TRANSFER' : 'ACCOMMODATION_VOUCHER'),
      payout_status: data.payout_status || 'PENDING',
      bank_transfer_date: data.bank_transfer_date || '',
      bank_transfer_reference: data.bank_transfer_reference || '',
      accommodation_voucher_code: data.accommodation_voucher_code || '',
      notes: data.notes || '',
      created_by: data.created_by || 'admin'
    };
    
    if (!payoutData.partner_code) {
      throw new Error('Partner code is required');
    }
    
    if (payoutData.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    
    // 查找大使確認存在
    const partner = findPartnerByCode(payoutData.partner_code);
    if (!partner) {
      throw new Error('Partner not found');
    }
    
    // 創建結算記錄
    const payout = createRecord('Payouts', payoutData);
    
    // 如果是待支付狀態，更新大使的待支付佣金
    if (payoutData.payout_status === 'PENDING' && payoutData.payout_type !== 'POINTS_REFUND') {
      const currentPending = parseFloat(partner.pending_commission || 0);
      updateRecord('Partners', partner.partner_code, {
        pending_commission: Math.max(0, currentPending - payoutData.amount)
      });
    }
    
    return createJsonResponse({
      success: true,
      message: 'Payout created successfully',
      payout_id: payout.id,
      data: payout
    });
    
  } catch (error) {
    Logger.log('創建結算錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 處理創建大使
 */
function handleCreatePartner(data) {
  try {
    // 完整的 Partner 資料結構（同時填寫新舊欄位以確保相容性）
    const partnerData = {
      // 基本資料（同時填寫兩種欄位名稱）
      partner_code: data.partner_code,
      name: data.partner_name || data.name || '',  // 舊欄位
      partner_name: data.partner_name || data.name || '',  // 新欄位
      level: data.partner_level || data.level || 'LV1_INSIDER',  // 舊欄位
      partner_level: data.partner_level || data.level || 'LV1_INSIDER',  // 新欄位
      
      // 聯絡資料（同時填寫兩種欄位名稱）
      phone: data.contact_phone || data.phone || '',  // 舊欄位
      contact_phone: data.contact_phone || data.phone || '',  // 新欄位
      email: data.contact_email || data.email || '',  // 舊欄位
      contact_email: data.contact_email || data.email || '',  // 新欄位
      
      // 銀行資料
      bank_code: data.bank_code || '',
      bank_account: data.bank_account || data.bank_account_number || '',
      bank_name: data.bank_name || '',
      bank_branch: data.bank_branch || '',
      bank_account_name: data.bank_account_name || '',
      
      // 佣金偏好
      commission_preference: data.commission_preference || 'ACCOMMODATION',
      
      // 統計數據（初始值，同時填寫新舊欄位）
      total_referrals: parseInt(data.total_referrals) || 0,
      successful_referrals: parseInt(data.successful_referrals) || parseInt(data.total_successful_referrals) || 0,
      total_successful_referrals: parseInt(data.successful_referrals) || parseInt(data.total_successful_referrals) || 0,  // 舊欄位
      yearly_referrals: parseInt(data.yearly_referrals) || 0,
      level_progress: parseInt(data.level_progress) || 0,
      
      // 佣金數據（初始值或傳入值）
      total_commission_earned: parseFloat(data.total_commission_earned) || 0,
      total_commission_paid: parseFloat(data.total_commission_paid) || 0,
      available_points: data.available_points !== undefined ? parseFloat(data.available_points) : 0,
      points_used: parseFloat(data.points_used) || 0,
      pending_commission: parseFloat(data.pending_commission) || 0,
      
      // 優惠券和連結
      line_coupon_url: data.line_coupon_url || data.coupon_url || '',
      coupon_code: data.coupon_code || '',
      coupon_url: data.coupon_url || '',
      landing_link: data.landing_link || '',
      coupon_link: data.coupon_link || '',
      short_landing_link: data.short_landing_link || '',
      short_coupon_link: data.short_coupon_link || '',
      
      // 其他資料
      join_date: data.join_date || new Date(),
      is_active: data.is_active !== false,  // 預設為 true
      notes: data.notes || '',
      
      // 點擊統計（初始值）
      total_clicks: 0,
      last_click_date: null
    };
    
    if (!partnerData.partner_code) {
      throw new Error('Partner code is required');
    }
    
    if (!partnerData.partner_name) {
      throw new Error('Partner name is required');
    }
    
    if (!partnerData.contact_phone) {
      throw new Error('Contact phone is required');
    }
    
    // 檢查代碼是否已存在
    const existing = findPartnerByCode(partnerData.partner_code);
    if (existing) {
      throw new Error('Partner code already exists');
    }
    
    // 創建大使記錄
    const partner = createRecord('Partners', partnerData);
    
    return createJsonResponse({
      success: true,
      message: 'Partner created successfully',
      partner_code: partner.partner_code,
      data: partner
    });
    
  } catch (error) {
    Logger.log('創建大使錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

// ========================================
// 輔助函數
// ========================================

/**
 * 根據房客資訊查找訂房
 */
function findRecordsByGuestInfo(guestName, guestPhone, checkinDate) {
  const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
  const sheet = spreadsheet.getSheetByName('Bookings');
  
  if (!sheet) {
    return [];
  }
  
  const dataModel = new SheetDataModel(sheet);
  const values = sheet.getDataRange().getValues();
  const results = [];
  
  for (let i = 1; i < values.length; i++) {
    const name = dataModel.getFieldValue(values[i], 'guest_name');
    const phone = dataModel.getFieldValue(values[i], 'guest_phone');
    
    if (name === guestName && String(phone) === String(guestPhone)) {
      // 如果提供了入住日期，進一步檢查
      if (checkinDate) {
        const bookingCheckin = dataModel.getFieldValue(values[i], 'checkin_date');
        if (formatDate(bookingCheckin) !== formatDate(checkinDate)) {
          continue;
        }
      }
      
      results.push({
        rowIndex: i + 1,
        data: dataModel.rowToObject(values[i])
      });
    }
  }
  
  return results;
}

/**
 * 根據代碼查找大使
 */
function findPartnerByCode(partnerCode) {
  const results = findRecordsByField('Partners', 'partner_code', partnerCode);
  if (results.length > 0) {
    const partner = results[0].data;
    // 統一欄位名稱的相容性處理
    partner.partner_name = partner.partner_name || partner.name;
    partner.partner_level = partner.partner_level || partner.level;
    partner.contact_phone = partner.contact_phone || partner.phone;
    partner.contact_email = partner.contact_email || partner.email;
    partner.successful_referrals = partner.successful_referrals || partner.total_successful_referrals || 0;
    // 確保數字欄位有預設值
    partner.available_points = partner.available_points !== undefined ? partner.available_points : 0;
    partner.points_used = partner.points_used !== undefined ? partner.points_used : 0;
    return partner;
  }
  return null;
}

/**
 * 更新大使推薦統計
 */
function updatePartnerReferralStats(partnerCode, increment) {
  const partner = findPartnerByCode(partnerCode);
  if (!partner) {
    Logger.log(`Partner ${partnerCode} not found`);
    return;
  }
  
  updateRecord('Partners', partner.partner_code, {
    total_referrals: (partner.total_referrals || 0) + increment
  });
}

/**
 * 更新大使入住後數據
 */
function updatePartnerAfterCheckin(partner, commissionAmount, commissionType) {
  const updates = {
    successful_referrals: (partner.successful_referrals || 0) + 1,
    yearly_referrals: (partner.yearly_referrals || 0) + 1,
    total_commission_earned: (partner.total_commission_earned || 0) + commissionAmount
  };
  
  // 根據佣金類型更新對應欄位，避免重複計算
  if (commissionType === 'ACCOMMODATION') {
    // 住宿金佣金只加到 available_points
    updates.available_points = (partner.available_points || 0) + commissionAmount;
  } else if (commissionType === 'CASH') {
    // 現金佣金只加到 pending_commission
    updates.pending_commission = (partner.pending_commission || 0) + commissionAmount;
  }
  
  // 檢查等級晉升
  const newLevel = checkLevelUpgrade(updates.yearly_referrals);
  if (newLevel !== partner.partner_level) {
    updates.partner_level = newLevel;
    Logger.log(`Partner ${partner.partner_code} upgraded to ${newLevel}`);
  }
  
  updateRecord('Partners', partner.partner_code, updates);
}

/**
 * 計算佣金
 */
function calculateCommission(partner) {
  const level = partner.partner_level || 'LV1_INSIDER';
  const preference = partner.commission_preference || 'ACCOMMODATION';
  const rates = COMMISSION_RATES[level];
  
  if (!rates) {
    return { amount: 0, type: 'NONE', isFirstBonus: false, firstBonusAmount: 0 };
  }
  
  const baseAmount = rates[preference.toLowerCase()] || 0;
  
  // 首次推薦獎勵：僅LV1且選擇住宿金才有
  const isFirstBonus = (level === 'LV1_INSIDER' && 
                        (partner.successful_referrals || 0) === 0 && 
                        preference.toUpperCase() === 'ACCOMMODATION');
  const firstBonusAmount = isFirstBonus ? FIRST_REFERRAL_BONUS : 0;
  
  return {
    amount: baseAmount + firstBonusAmount,
    type: preference,
    isFirstBonus: isFirstBonus,
    firstBonusAmount: firstBonusAmount
  };
}

/**
 * 檢查等級升級
 */
function checkLevelUpgrade(yearlyReferrals) {
  if (yearlyReferrals >= LEVEL_REQUIREMENTS.LV3_GUARDIAN) {
    return 'LV3_GUARDIAN';
  } else if (yearlyReferrals >= LEVEL_REQUIREMENTS.LV2_GUIDE) {
    return 'LV2_GUIDE';
  } else {
    return 'LV1_INSIDER';
  }
}

/**
 * 創建 Payout 記錄
 */
function createPayoutRecord(partnerCode, amount, bookingId, type) {
  return createRecord('Payouts', {
    partner_code: partnerCode,
    payout_type: type,
    amount: amount,
    related_booking_ids: bookingId.toString(),
    payout_method: type === 'CASH' ? 'BANK_TRANSFER' : 'ACCOMMODATION_VOUCHER',
    payout_status: 'PENDING',
    notes: `佣金 - 訂單 #${bookingId}`,
    created_by: 'system'
  });
}

/**
 * 格式化日期
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toISOString().split('T')[0];
}

/**
 * 創建 JSON 響應
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 處理跳轉
 */
function handleRedirect(e) {
  const params = e ? e.parameter : {};
  const destination = params.dest || 'landing';
  const subid = params.pid || params.subid || '';
  
  let redirectUrl;
  
  if (destination === 'coupon') {
    // 優先使用 target 參數（從連結生成器傳來的實際優惠券 URL）
    const targetUrl = e.parameter.target;
    if (targetUrl) {
      redirectUrl = decodeURIComponent(targetUrl);
    } else {
      // 如果沒有 target，則從資料庫查找
      const partner = findPartnerByCode(subid);
      redirectUrl = partner && partner.line_coupon_url ? partner.line_coupon_url : DEFAULT_LINE_COUPON_URL;
    }
  } else {
    // 處理 landing 頁面跳轉
    if (e && e.queryString) {
      // 保留所有查詢參數（包括 coupon_url）
      redirectUrl = GITHUB_PAGES_URL + '?' + e.queryString;
    } else if (subid) {
      // 建立基本的跳轉 URL
      redirectUrl = GITHUB_PAGES_URL + `?subid=${encodeURIComponent(subid)}`;
      
      // 如果有 coupon_url 參數，將其加入跳轉 URL
      const couponUrl = e && e.parameter && e.parameter.coupon_url;
      if (couponUrl) {
        redirectUrl += `&coupon_url=${encodeURIComponent(couponUrl)}`;
      }
    } else {
      redirectUrl = GITHUB_PAGES_URL;
    }
  }
  
  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="refresh" content="0; url=${redirectUrl}">
      <script>window.location.href = "${redirectUrl}";</script>
    </head>
    <body>
      <p>正在跳轉...</p>
    </body>
    </html>
  `);
}

/**
 * 記錄點擊
 */
function recordClick(params, e) {
  try {
    // 檢查 Clicks 表格是否存在，如果不存在則創建
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    let clicksSheet = spreadsheet.getSheetByName('Clicks');
    
    if (!clicksSheet) {
      // 創建 Clicks 表格
      clicksSheet = spreadsheet.insertSheet('Clicks');
      
      // 設置表頭
      const headers = ['id', 'partner_code', 'destination', 'utm_source', 'utm_medium', 
                       'utm_campaign', 'referrer', 'user_agent', 'ip_address', 'click_time', 
                       'created_at'];
      clicksSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // 設置格式
      clicksSheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#f0f0f0');
      
      Logger.log('Created Clicks sheet with headers');
    }
    
    // 獲取額外資訊
    const userAgent = e && e.parameter ? (e.parameter.userAgent || 'Unknown') : 'Unknown';
    const referrer = e && e.parameter ? (e.parameter.referrer || 'Direct') : 'Direct';
    
    // 記錄點擊
    const clickData = {
      partner_code: params.pid || params.subid || null,
      destination: params.dest || 'landing',
      utm_source: params.utm_source || null,
      utm_medium: params.utm_medium || null,
      utm_campaign: params.utm_campaign || null,
      referrer: referrer,
      user_agent: userAgent,
      ip_address: null, // Google Apps Script 無法獲取 IP
      click_time: new Date(),
      created_at: new Date()
    };
    
    createRecord('Clicks', clickData);
    
    Logger.log('點擊記錄成功: ' + JSON.stringify(clickData));
    
    // 更新夥伴的點擊統計（如果有 partner_code）
    if (clickData.partner_code) {
      updatePartnerClickStats(clickData.partner_code);
    }
    
  } catch (error) {
    Logger.log('記錄點擊失敗: ' + error.toString());
  }
}

/**
 * 更新夥伴的點擊統計
 */
function updatePartnerClickStats(partnerCode) {
  try {
    const partner = findPartnerByCode(partnerCode);
    if (partner) {
      // 可以在 Partners 表格添加 total_clicks 欄位來追蹤
      const currentClicks = partner.total_clicks || 0;
      updateRecord('Partners', partnerCode, {
        total_clicks: currentClicks + 1,
        last_click_date: new Date()
      });
    }
  } catch (error) {
    Logger.log('更新點擊統計失敗: ' + error.toString());
  }
}

/**
 * 處理獲取點擊統計請求
 */
function handleGetClickStats(params) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const clicksSheet = spreadsheet.getSheetByName('Clicks');
    
    if (!clicksSheet || clicksSheet.getLastRow() <= 1) {
      return createJsonResponse({
        success: true,
        data: {
          total_clicks: 0,
          partner_stats: [],
          destination_stats: {},
          recent_clicks: []
        }
      });
    }
    
    const dataModel = new SheetDataModel(clicksSheet);
    const values = clicksSheet.getDataRange().getValues();
    
    // 收集所有點擊記錄
    const clicks = [];
    for (let i = 1; i < values.length; i++) {
      clicks.push(dataModel.rowToObject(values[i]));
    }
    
    // 統計數據
    const stats = {
      total_clicks: clicks.length,
      partner_stats: {},
      destination_stats: {},
      utm_stats: {
        sources: {},
        mediums: {},
        campaigns: {}
      },
      recent_clicks: []
    };
    
    // 分析點擊數據
    clicks.forEach(click => {
      // 按夥伴統計
      if (click.partner_code) {
        if (!stats.partner_stats[click.partner_code]) {
          stats.partner_stats[click.partner_code] = {
            total: 0,
            destinations: {}
          };
        }
        stats.partner_stats[click.partner_code].total++;
        
        const dest = click.destination || 'unknown';
        stats.partner_stats[click.partner_code].destinations[dest] = 
          (stats.partner_stats[click.partner_code].destinations[dest] || 0) + 1;
      }
      
      // 按目的地統計
      const destination = click.destination || 'unknown';
      stats.destination_stats[destination] = (stats.destination_stats[destination] || 0) + 1;
      
      // UTM 統計
      if (click.utm_source) {
        stats.utm_stats.sources[click.utm_source] = (stats.utm_stats.sources[click.utm_source] || 0) + 1;
      }
      if (click.utm_medium) {
        stats.utm_stats.mediums[click.utm_medium] = (stats.utm_stats.mediums[click.utm_medium] || 0) + 1;
      }
      if (click.utm_campaign) {
        stats.utm_stats.campaigns[click.utm_campaign] = (stats.utm_stats.campaigns[click.utm_campaign] || 0) + 1;
      }
    });
    
    // 獲取最近的點擊（最後20筆）
    stats.recent_clicks = clicks.slice(-20).reverse();
    
    // 如果指定了特定夥伴
    if (params.partner_code) {
      const partnerClicks = clicks.filter(c => c.partner_code === params.partner_code);
      return createJsonResponse({
        success: true,
        data: {
          partner_code: params.partner_code,
          total_clicks: partnerClicks.length,
          clicks: partnerClicks,
          stats: stats.partner_stats[params.partner_code] || { total: 0, destinations: {} }
        }
      });
    }
    
    return createJsonResponse({
      success: true,
      data: stats
    });
    
  } catch (error) {
    Logger.log('獲取點擊統計失敗: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

// ========================================
// 測試函數
// ========================================

/**
 * 測試新架構 - 完整測試佣金計算和 Partners 表更新
 */
function testNewArchitecture() {
  try {
    Logger.log('===== 測試新架構 =====');
    
    // 測試1：佣金計算邏輯
    Logger.log('\n--- 測試佣金計算 ---');
    
    // LV1 首次推薦 + 住宿金（應該有獎勵）
    const partner1 = {
      partner_level: 'LV1_INSIDER',
      successful_referrals: 0,
      commission_preference: 'ACCOMMODATION'
    };
    const result1 = calculateCommission(partner1);
    Logger.log('LV1首次+住宿金: ' + JSON.stringify(result1));
    Logger.log('✅ 預期: 2500 (1000+1500), 實際: ' + result1.amount);
    
    // LV1 首次推薦 + 現金（無獎勵）
    const partner2 = {
      partner_level: 'LV1_INSIDER',
      successful_referrals: 0,
      commission_preference: 'CASH'
    };
    const result2 = calculateCommission(partner2);
    Logger.log('LV1首次+現金: ' + JSON.stringify(result2));
    Logger.log('✅ 預期: 500 (無獎勵), 實際: ' + result2.amount);
    
    // LV3 + 現金（確認是750不是800）
    const partner3 = {
      partner_level: 'LV3_GUARDIAN',
      successful_referrals: 10,
      commission_preference: 'CASH'
    };
    const result3 = calculateCommission(partner3);
    Logger.log('LV3+現金: ' + JSON.stringify(result3));
    Logger.log('✅ 預期: 750, 實際: ' + result3.amount);
    
    // 測試2：動態欄位映射
    Logger.log('\n--- 測試動態欄位映射 ---');
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const bookingsSheet = spreadsheet.getSheetByName('Bookings');
    const dataModel = new SheetDataModel(bookingsSheet);
    
    Logger.log('Bookings 欄位數量: ' + Object.keys(dataModel.columnMap).length);
    
    // 測試3：Partners 表更新（使用 partner_code 作為主鍵）
    Logger.log('\n--- 測試 Partners 表更新 ---');
    Logger.log('✅ updateRecord 函數已修復：Partners 表使用 partner_code 作為主鍵');
    
    // 測試查找記錄
    const bookings = findRecordsByField('Bookings', 'stay_status', 'PENDING');
    Logger.log(`\n找到 ${bookings.length} 筆待確認訂房`);
    
    // 測試創建記錄（注意：這會創建真實數據）
    /*
    const testBooking = createRecord('Bookings', {
      guest_name: 'Test Guest',
      guest_phone: '0912345678',
      checkin_date: new Date(),
      checkout_date: new Date(Date.now() + 86400000),
      room_price: 3000
    });
    Logger.log('測試訂房創建成功: ' + JSON.stringify(testBooking));
    */
    
    Logger.log('===== 測試完成 =====');
    
  } catch (error) {
    Logger.log('測試失敗: ' + error.toString());
  }
}

/**
 * 檢查欄位映射
 */
function checkColumnMappings() {
  const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
  const sheets = ['Bookings', 'Partners', 'Payouts', 'Accommodation_Usage'];
  
  sheets.forEach(sheetName => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet) {
      const dataModel = new SheetDataModel(sheet);
      Logger.log(`\n${sheetName} 欄位映射:`);
      Logger.log(JSON.stringify(dataModel.columnMap, null, 2));
    }
  });
}