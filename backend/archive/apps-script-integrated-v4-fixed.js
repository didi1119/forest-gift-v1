// ===== Google Apps Script - 知音計畫後端系統 v4.0 (修復版) =====
// 修復內容：
// 1. 使用住宿金時同步更新 total_commission_earned
// 2. 轉換現金時同步更新 total_commission_earned  
// 3. 加入並發控制機制
// 4. 確保數據完整性：total_commission_earned >= points_used

// ===== 配置 =====
const SHEETS_ID = '1Vwh5lZH6nNhm-u0t75cEUKiAP1kLIxVHQxHIyvlVNMI';
const TRACKING_BASE_URL = 'https://script.google.com/macros/s/AKfycbxWVmkMJUladdBVp56vcISxqCfebXaytT4_SX970OaD7Aq8wg74Kcf_9OxyNEaPA_4W/exec';

// 佣金設定（住宿金）
const COMMISSION_RATES = {
  LV1_INSIDER: {
    accommodation: 1000,
    cash: 500,
    firstReferralBonus: 1500
  },
  LV2_GUIDE: {
    accommodation: 1200,
    cash: 600,
    firstReferralBonus: 1500
  },
  LV3_GUARDIAN: {
    accommodation: 1500,
    cash: 800,
    firstReferralBonus: 1500
  }
};

// 升級門檻
const LEVEL_THRESHOLDS = {
  LV1_INSIDER: 0,
  LV2_GUIDE: 5,
  LV3_GUARDIAN: 15
};

// ===== 全局鎖機制 =====
const LockService = {
  locks: {},
  
  acquire(key, timeout = 10000) {
    const lock = Utilities.newLock();
    try {
      lock.waitLock(timeout);
      this.locks[key] = lock;
      return true;
    } catch (e) {
      Logger.log(`無法獲取鎖 ${key}: ${e.message}`);
      return false;
    }
  },
  
  release(key) {
    if (this.locks[key]) {
      this.locks[key].releaseLock();
      delete this.locks[key];
    }
  }
};

// ===== 資料庫配置 =====
const DB_CONFIG = {
  Partners: {
    sheetName: 'Partners',
    idField: 'partner_code',
    fields: ['id', 'partner_code', 'name', 'email', 'phone', 'level', 
             'level_progress', 'total_successful_referrals', 'commission_preference',
             'total_commission_earned', 'total_commission_paid', 'pending_commission',
             'coupon_code', 'coupon_url', 'landing_link', 'coupon_link',
             'short_landing_link', 'short_coupon_link', 'created_at', 'updated_at',
             'bank_account', 'payment_method', 'payment_info', 'total_click_count',
             'partner_name', 'partner_level', 'contact_phone', 'contact_email',
             'successful_referrals', 'yearly_referrals', 'available_points', 'points_used']
  },
  Bookings: {
    sheetName: 'Bookings',
    idField: 'id',
    fields: ['id', 'partner_code', 'guest_name', 'guest_phone', 'guest_email',
             'bank_account_last5', 'checkin_date', 'checkout_date', 'room_price',
             'booking_source', 'stay_status', 'payment_status', 'commission_status',
             'commission_amount', 'commission_type', 'is_first_referral_bonus',
             'first_referral_bonus_amount', 'manually_confirmed_by', 'manually_confirmed_at',
             'notes', 'created_at', 'updated_at']
  },
  Payouts: {
    sheetName: 'Payouts',
    idField: 'id',
    fields: ['id', 'partner_code', 'payout_type', 'amount', 'related_booking_ids',
             'payout_method', 'payout_status', 'bank_transfer_date', 'bank_transfer_reference',
             'accommodation_voucher_code', 'notes', 'created_by', 'created_at', 'updated_at']
  },
  Click_Tracking: {
    sheetName: 'Click_Tracking',
    idField: 'id',
    fields: ['id', 'partner_code', 'tracking_type', 'ip_address', 'user_agent',
             'referrer', 'created_at']
  },
  Accommodation_Usage: {
    sheetName: 'Accommodation_Usage',
    idField: 'id',
    fields: ['id', 'partner_code', 'deduct_amount', 'related_booking_id',
             'usage_date', 'usage_type', 'notes', 'created_by', 'created_at', 'updated_at']
  }
};

// ===== 主要入口點 =====
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    // 處理追蹤連結
    if (e.parameter.partner) {
      return handleTrackingRedirect(e.parameter.partner, e);
    }
    
    // 處理 API 請求
    switch (action) {
      case 'get_all_data':
        return handleGetAllData();
      case 'track':
        return handleTrackClick(e.parameter.partner_code, e);
      default:
        return createJsonResponse({
          success: false,
          error: 'Invalid action'
        });
    }
  } catch (error) {
    Logger.log('GET 請求錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

function doPost(e) {
  try {
    let data;
    
    // 解析請求數據
    if (e.postData && e.postData.type === 'application/json') {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    } else {
      throw new Error('No data received');
    }
    
    const action = data.action;
    Logger.log(`處理 POST 請求 - Action: ${action}`);
    Logger.log('資料: ' + JSON.stringify(data));
    
    // 路由到對應的處理函數
    switch (action) {
      // 大使管理
      case 'create_partner':
        return handleCreatePartner(data);
      case 'update_partner':
        return handleUpdatePartner(data);
      case 'update_partner_commission':
        return handleUpdatePartnerCommission(data);
        
      // 訂房管理
      case 'create_booking':
        return handleCreateBooking(data);
      case 'update_booking':
        return handleUpdateBooking(data);
      case 'delete_booking':
        return handleDeleteBooking(data);
      case 'confirm_checkin_completion':
        return handleConfirmCheckinCompletion(data);
        
      // 點數管理
      case 'use_accommodation_points':
        return handleUseAccommodationPoints(data);
      case 'convert_points_to_cash':
        return handleConvertPointsToCash(data);
        
      // 結算管理
      case 'create_payout':
        return handleCreatePayout(data);
      case 'update_payout':
        return handleUpdatePayout(data);
      case 'cancel_payout':
        return handleCancelPayout(data);
        
      // 數據查詢
      case 'get_all_data':
        return handleGetAllData();
        
      default:
        throw new Error('未知的動作: ' + action);
    }
  } catch (error) {
    Logger.log('POST 請求錯誤: ' + error.toString());
    Logger.log('錯誤堆疊: ' + error.stack);
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

// ===== 資料庫操作函數（加入並發控制） =====

/**
 * 創建記錄（加入並發控制）
 */
function createRecord(sheetName, data) {
  const lockKey = `create_${sheetName}_lock`;
  
  try {
    // 獲取鎖
    if (!LockService.acquire(lockKey)) {
      throw new Error('無法獲取創建鎖，請稍後重試');
    }
    
    const config = DB_CONFIG[sheetName];
    if (!config) {
      throw new Error(`未知的表格: ${sheetName}`);
    }
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName(config.sheetName);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${config.sheetName}`);
    }
    
    // 生成 ID
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    data.id = data.id || `${timestamp}_${random}`;
    
    // 設置時間戳
    const now = new Date().toISOString();
    data.created_at = data.created_at || now;
    data.updated_at = now;
    
    // 準備行數據
    const rowData = config.fields.map(field => {
      const value = data[field];
      return value !== undefined ? value : '';
    });
    
    // 添加到工作表
    sheet.appendRow(rowData);
    Logger.log(`成功創建 ${sheetName} 記錄: ${data.id}`);
    
    return data;
    
  } finally {
    // 釋放鎖
    LockService.release(lockKey);
  }
}

/**
 * 更新記錄（加入並發控制）
 */
function updateRecord(sheetName, id, updates) {
  const lockKey = `update_${sheetName}_${id}_lock`;
  
  try {
    // 獲取鎖
    if (!LockService.acquire(lockKey)) {
      throw new Error('無法獲取更新鎖，請稍後重試');
    }
    
    const config = DB_CONFIG[sheetName];
    if (!config) {
      throw new Error(`未知的表格: ${sheetName}`);
    }
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName(config.sheetName);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${config.sheetName}`);
    }
    
    // 查找記錄
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf(config.idField);
    
    if (idIndex === -1) {
      throw new Error(`找不到 ID 欄位: ${config.idField}`);
    }
    
    // 找到要更新的行
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] == id) {
        rowIndex = i + 1; // Sheet 的行號從 1 開始
        break;
      }
    }
    
    if (rowIndex === -1) {
      throw new Error(`找不到記錄: ${id}`);
    }
    
    // 更新時間戳
    updates.updated_at = new Date().toISOString();
    
    // 更新每個欄位
    Object.keys(updates).forEach(field => {
      const colIndex = headers.indexOf(field);
      if (colIndex !== -1) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(updates[field]);
      }
    });
    
    Logger.log(`成功更新 ${sheetName} 記錄: ${id}`);
    
    // 返回更新後的完整記錄
    const updatedRow = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
    const result = {};
    headers.forEach((header, index) => {
      result[header] = updatedRow[index];
    });
    
    return result;
    
  } finally {
    // 釋放鎖
    LockService.release(lockKey);
  }
}

/**
 * 查找記錄
 */
function findRecordsByField(sheetName, fieldName, value) {
  const config = DB_CONFIG[sheetName];
  if (!config) {
    throw new Error(`未知的表格: ${sheetName}`);
  }
  
  const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
  const sheet = spreadsheet.getSheetByName(config.sheetName);
  
  if (!sheet) {
    throw new Error(`找不到工作表: ${config.sheetName}`);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const fieldIndex = headers.indexOf(fieldName);
  
  if (fieldIndex === -1) {
    throw new Error(`找不到欄位: ${fieldName}`);
  }
  
  const results = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][fieldIndex] == value) {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = data[i][index];
      });
      results.push(record);
    }
  }
  
  return results;
}

/**
 * 查找大使
 */
function findPartnerByCode(partnerCode) {
  const partners = findRecordsByField('Partners', 'partner_code', partnerCode);
  return partners.length > 0 ? partners[0] : null;
}

// ===== 處理函數 =====

/**
 * 處理使用住宿金（修復版）
 */
function handleUseAccommodationPoints(data) {
  const lockKey = `points_${data.partner_code}_lock`;
  
  try {
    // 獲取鎖，防止並發
    if (!LockService.acquire(lockKey)) {
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
    
    // 檢查可用點數
    const currentPoints = Math.max(0, parseFloat(partner.available_points) || 0);
    if (currentPoints < deductAmount) {
      throw new Error(`點數不足。可用：${currentPoints}，需要：${deductAmount}`);
    }
    
    // 創建 SELF_USE 訂房記錄
    const bookingData = {
      partner_code: partnerCode,
      guest_name: data.guest_name || partner.partner_name,
      guest_phone: data.guest_phone || partner.contact_phone || '',
      checkin_date: checkinDate,
      checkout_date: data.checkout_date || checkinDate,
      room_price: data.room_price || deductAmount,
      booking_source: 'SELF_USE',
      stay_status: 'COMPLETED',
      payment_status: 'PAID',
      commission_status: 'NOT_APPLICABLE',
      commission_amount: 0,
      notes: `住宿金折抵 NT$ ${deductAmount}`
    };
    
    const booking = createRecord('Bookings', bookingData);
    Logger.log('創建訂房記錄: ' + booking.id);
    
    // 計算新的點數值
    const newAvailablePoints = currentPoints - deductAmount;
    const newPointsUsed = (parseFloat(partner.points_used) || 0) + deductAmount;
    
    // 同步更新 total_commission_earned（如果使用超過獲得的）
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
      booking_id: booking.id,
      remaining_points: newAvailablePoints
    });
    
  } catch (error) {
    Logger.log('使用住宿金錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  } finally {
    // 釋放鎖
    LockService.release(lockKey);
  }
}

/**
 * 處理轉換點數為現金（修復版）
 */
function handleConvertPointsToCash(data) {
  const lockKey = `convert_${data.partner_code}_lock`;
  
  try {
    // 獲取鎖，防止並發
    if (!LockService.acquire(lockKey)) {
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
    
    // 同步更新 total_commission_earned（如果使用超過獲得的）
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
    const payoutData = {
      partner_code: partnerCode,
      payout_type: 'POINTS_TO_CASH',
      amount: cashAmount,
      related_booking_ids: '',
      payout_method: 'BANK_TRANSFER',
      payout_status: 'PENDING',
      notes: data.notes || `點數轉現金：${convertAmount} 點 → NT$ ${cashAmount} (2:1)`,
      created_by: 'system'
    };
    
    const payout = createRecord('Payouts', payoutData);
    Logger.log('創建轉換記錄: ' + payout.id);
    
    return createJsonResponse({
      success: true,
      message: `成功轉換 ${convertAmount} 點為 NT$ ${cashAmount}`,
      payout_id: payout.id,
      points_used: convertAmount,
      cash_amount: cashAmount,
      remaining_points: newAvailablePoints
    });
    
  } catch (error) {
    Logger.log('轉換現金錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  } finally {
    // 釋放鎖
    LockService.release(lockKey);
  }
}

/**
 * 處理確認入住完成（包含佣金計算）
 */
function handleConfirmCheckinCompletion(data) {
  try {
    Logger.log('=== 確認入住完成開始 ===');
    Logger.log('接收到的資料: ' + JSON.stringify(data));
    
    const bookingId = data.booking_id || data.id;
    const confirmedBy = data.confirmed_by || 'system';
    
    if (!bookingId) {
      throw new Error('缺少訂房 ID');
    }
    
    // 查找訂房記錄
    const bookingResults = findRecordsByField('Bookings', 'id', bookingId);
    if (bookingResults.length === 0) {
      throw new Error('找不到訂房記錄: ' + bookingId);
    }
    
    const booking = bookingResults[0];
    Logger.log('找到訂房: ' + JSON.stringify(booking));
    
    // 檢查是否已經確認過
    if (booking.stay_status === 'COMPLETED' && booking.commission_status === 'CALCULATED') {
      Logger.log('訂房已經確認過，跳過處理');
      return createJsonResponse({
        success: true,
        message: '訂房已經確認過',
        data: booking
      });
    }
    
    // 更新訂房狀態
    const bookingUpdates = {
      stay_status: 'COMPLETED',
      payment_status: 'PAID',
      manually_confirmed_by: confirmedBy,
      manually_confirmed_at: new Date().toISOString()
    };
    
    // 計算佣金
    if (booking.partner_code && booking.partner_code !== '') {
      const partner = findPartnerByCode(booking.partner_code);
      
      if (partner) {
        // 獲取大使等級和佣金偏好
        const level = partner.partner_level || partner.level || 'LV1_INSIDER';
        const preference = partner.commission_preference || 'ACCOMMODATION';
        const isFirstReferral = (partner.successful_referrals || 0) === 0;
        
        Logger.log(`大使資訊 - 代碼: ${partner.partner_code}, 等級: ${level}, 偏好: ${preference}, 首次推薦: ${isFirstReferral}`);
        
        // 計算佣金
        const commissionRate = COMMISSION_RATES[level] || COMMISSION_RATES.LV1_INSIDER;
        let baseCommission = preference === 'CASH' ? commissionRate.cash : commissionRate.accommodation;
        let firstReferralBonus = 0;
        
        if (isFirstReferral && preference === 'ACCOMMODATION') {
          firstReferralBonus = commissionRate.firstReferralBonus;
        }
        
        const totalCommission = baseCommission + firstReferralBonus;
        
        Logger.log(`佣金計算 - 基礎: ${baseCommission}, 首次獎勵: ${firstReferralBonus}, 總計: ${totalCommission}`);
        
        // 更新訂房佣金資訊
        bookingUpdates.commission_status = 'CALCULATED';
        bookingUpdates.commission_amount = totalCommission;
        bookingUpdates.commission_type = preference;
        bookingUpdates.is_first_referral_bonus = isFirstReferral;
        bookingUpdates.first_referral_bonus_amount = firstReferralBonus;
        
        // 更新大使數據
        const partnerUpdates = calculatePartnerUpdates(partner, totalCommission, preference, isFirstReferral);
        updateRecord('Partners', partner.partner_code, partnerUpdates);
        
        Logger.log('大使數據已更新: ' + JSON.stringify(partnerUpdates));
      }
    }
    
    // 更新訂房記錄
    const updatedBooking = updateRecord('Bookings', bookingId, bookingUpdates);
    
    Logger.log('訂房已確認完成: ' + bookingId);
    
    return createJsonResponse({
      success: true,
      message: '入住已確認完成',
      data: updatedBooking
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
 * 計算大使更新數據
 */
function calculatePartnerUpdates(partner, commissionAmount, commissionType, isFirstReferral) {
  const updates = {
    successful_referrals: (partner.successful_referrals || 0) + 1,
    yearly_referrals: (partner.yearly_referrals || 0) + 1,
    total_commission_earned: (partner.total_commission_earned || 0) + commissionAmount
  };
  
  // 根據佣金類型更新不同欄位
  if (commissionType === 'ACCOMMODATION') {
    updates.available_points = (partner.available_points || 0) + commissionAmount;
  } else if (commissionType === 'CASH') {
    updates.pending_commission = (partner.pending_commission || 0) + commissionAmount;
  }
  
  // 檢查是否需要升級
  const newLevel = checkLevelUpgrade(updates.yearly_referrals);
  if (newLevel !== partner.partner_level) {
    updates.partner_level = newLevel;
    Logger.log(`大使 ${partner.partner_code} 升級到 ${newLevel}`);
  }
  
  return updates;
}

/**
 * 檢查等級升級
 */
function checkLevelUpgrade(yearlyReferrals) {
  if (yearlyReferrals >= LEVEL_THRESHOLDS.LV3_GUARDIAN) {
    return 'LV3_GUARDIAN';
  } else if (yearlyReferrals >= LEVEL_THRESHOLDS.LV2_GUIDE) {
    return 'LV2_GUIDE';
  } else {
    return 'LV1_INSIDER';
  }
}

/**
 * 處理創建大使
 */
function handleCreatePartner(data) {
  try {
    Logger.log('=== 創建大使開始 ===');
    
    // 檢查必要欄位
    if (!data.partner_code) {
      throw new Error('缺少大使代碼');
    }
    
    // 檢查是否已存在
    const existing = findPartnerByCode(data.partner_code);
    if (existing) {
      throw new Error('大使代碼已存在: ' + data.partner_code);
    }
    
    // 準備大使數據
    const partnerData = {
      // 基本資料
      partner_code: data.partner_code,
      partner_name: data.partner_name || data.name || '',
      contact_phone: data.contact_phone || data.phone || '',
      contact_email: data.contact_email || data.email || '',
      
      // 等級資料
      partner_level: data.partner_level || data.level || 'LV1_INSIDER',
      successful_referrals: parseInt(data.successful_referrals) || 0,
      yearly_referrals: parseInt(data.yearly_referrals) || 0,
      
      // 佣金資料
      commission_preference: data.commission_preference || 'ACCOMMODATION',
      total_commission_earned: parseFloat(data.total_commission_earned) || 0,
      total_commission_paid: parseFloat(data.total_commission_paid) || 0,
      available_points: parseFloat(data.available_points) || 0,
      points_used: parseFloat(data.points_used) || 0,
      pending_commission: parseFloat(data.pending_commission) || 0,
      
      // 銀行資料
      bank_account: data.bank_account || ''
    };
    
    // 創建記錄
    const partner = createRecord('Partners', partnerData);
    
    Logger.log('成功創建大使: ' + partner.partner_code);
    
    return createJsonResponse({
      success: true,
      message: '大使創建成功',
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

/**
 * 處理創建訂房
 */
function handleCreateBooking(data) {
  try {
    Logger.log('=== 創建訂房開始 ===');
    
    // 準備訂房數據
    const bookingData = {
      partner_code: data.partner_code || '',
      guest_name: data.guest_name || '',
      guest_phone: data.guest_phone || '',
      guest_email: data.guest_email || '',
      bank_account_last5: data.bank_account_last5 || '',
      checkin_date: data.checkin_date || '',
      checkout_date: data.checkout_date || '',
      room_price: parseFloat(data.room_price) || 0,
      booking_source: data.booking_source || 'REFERRAL',
      stay_status: data.stay_status || 'PENDING',
      payment_status: data.payment_status || 'PENDING',
      commission_status: data.commission_status || 'PENDING',
      commission_amount: parseFloat(data.commission_amount) || 0,
      commission_type: data.commission_type || '',
      notes: data.notes || ''
    };
    
    // 創建記錄
    const booking = createRecord('Bookings', bookingData);
    
    Logger.log('成功創建訂房: ' + booking.id);
    
    return createJsonResponse({
      success: true,
      message: '訂房創建成功',
      data: booking
    });
    
  } catch (error) {
    Logger.log('創建訂房錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 處理獲取所有數據
 */
function handleGetAllData() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const result = {
      partners: [],
      bookings: [],
      payouts: [],
      click_tracking: []
    };
    
    // 讀取各個工作表
    Object.keys(DB_CONFIG).forEach(tableName => {
      const config = DB_CONFIG[tableName];
      const sheet = spreadsheet.getSheetByName(config.sheetName);
      
      if (sheet) {
        const data = sheet.getDataRange().getValues();
        if (data.length > 1) {
          const headers = data[0];
          const records = [];
          
          for (let i = 1; i < data.length; i++) {
            const record = {};
            headers.forEach((header, index) => {
              record[header] = data[i][index];
            });
            records.push(record);
          }
          
          // 映射到結果對象
          const resultKey = tableName.toLowerCase().replace('_', '');
          if (resultKey === 'partners') result.partners = records;
          else if (resultKey === 'bookings') result.bookings = records;
          else if (resultKey === 'payouts') result.payouts = records;
          else if (resultKey === 'clicktracking') result.click_tracking = records;
        }
      }
    });
    
    return createJsonResponse({
      success: true,
      data: result
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
    const bookingId = data.booking_id || data.id;
    if (!bookingId) {
      throw new Error('缺少訂房 ID');
    }
    
    // 移除不應更新的欄位
    delete data.action;
    delete data.booking_id;
    delete data.id;
    delete data.created_at;
    
    const updated = updateRecord('Bookings', bookingId, data);
    
    return createJsonResponse({
      success: true,
      message: '訂房更新成功',
      data: updated
    });
    
  } catch (error) {
    Logger.log('更新訂房錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 處理更新大使
 */
function handleUpdatePartner(data) {
  try {
    const partnerCode = data.partner_code;
    if (!partnerCode) {
      throw new Error('缺少大使代碼');
    }
    
    // 移除不應更新的欄位
    delete data.action;
    delete data.created_at;
    
    const updated = updateRecord('Partners', partnerCode, data);
    
    return createJsonResponse({
      success: true,
      message: '大使更新成功',
      data: updated
    });
    
  } catch (error) {
    Logger.log('更新大使錯誤: ' + error.toString());
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
  const lockKey = `commission_${data.partner_code}_lock`;
  
  try {
    // 獲取鎖
    if (!LockService.acquire(lockKey)) {
      throw new Error('系統忙碌中，請稍後重試');
    }
    
    const partnerCode = data.partner_code;
    if (!partnerCode) {
      throw new Error('缺少大使代碼');
    }
    
    // 查找大使
    const partner = findPartnerByCode(partnerCode);
    if (!partner) {
      throw new Error('找不到大使: ' + partnerCode);
    }
    
    // 準備更新數據
    const updates = {};
    
    // 更新可用點數
    if (data.available_points !== undefined) {
      updates.available_points = parseFloat(data.available_points);
    }
    
    // 更新已使用點數
    if (data.points_used !== undefined) {
      const newPointsUsed = parseFloat(data.points_used);
      updates.points_used = newPointsUsed;
      
      // 同步更新 total_commission_earned
      const totalEarned = parseFloat(partner.total_commission_earned) || 0;
      if (newPointsUsed > totalEarned) {
        updates.total_commission_earned = newPointsUsed;
      }
    }
    
    // 更新總獲得佣金
    if (data.total_commission_earned !== undefined) {
      updates.total_commission_earned = parseFloat(data.total_commission_earned);
    }
    
    // 更新待支付佣金
    if (data.pending_commission !== undefined) {
      updates.pending_commission = parseFloat(data.pending_commission);
    }
    
    const updated = updateRecord('Partners', partnerCode, updates);
    
    return createJsonResponse({
      success: true,
      message: '佣金更新成功',
      data: updated
    });
    
  } catch (error) {
    Logger.log('更新佣金錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  } finally {
    LockService.release(lockKey);
  }
}

/**
 * 處理創建結算
 */
function handleCreatePayout(data) {
  try {
    const payoutData = {
      partner_code: data.partner_code || '',
      payout_type: data.payout_type || 'MANUAL',
      amount: parseFloat(data.amount) || 0,
      related_booking_ids: data.related_booking_ids || '',
      payout_method: data.payout_method || 'BANK_TRANSFER',
      payout_status: data.payout_status || 'PENDING',
      bank_transfer_date: data.bank_transfer_date || '',
      bank_transfer_reference: data.bank_transfer_reference || '',
      accommodation_voucher_code: data.accommodation_voucher_code || '',
      notes: data.notes || '',
      created_by: data.created_by || 'system'
    };
    
    const payout = createRecord('Payouts', payoutData);
    
    return createJsonResponse({
      success: true,
      message: '結算創建成功',
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
 * 處理更新結算
 */
function handleUpdatePayout(data) {
  try {
    const payoutId = data.payout_id || data.id;
    if (!payoutId) {
      throw new Error('缺少結算 ID');
    }
    
    delete data.action;
    delete data.payout_id;
    delete data.id;
    delete data.created_at;
    
    const updated = updateRecord('Payouts', payoutId, data);
    
    return createJsonResponse({
      success: true,
      message: '結算更新成功',
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
 * 處理刪除訂房（標記為取消）
 */
function handleDeleteBooking(data) {
  try {
    const bookingId = data.booking_id || data.id;
    if (!bookingId) {
      throw new Error('缺少訂房 ID');
    }
    
    const updated = updateRecord('Bookings', bookingId, {
      stay_status: 'CANCELLED',
      commission_status: 'CANCELLED',
      notes: (data.notes || '') + `\n[取消於 ${new Date().toISOString()}]`
    });
    
    return createJsonResponse({
      success: true,
      message: '訂房已取消',
      data: updated
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
 * 處理取消結算
 */
function handleCancelPayout(data) {
  try {
    const payoutId = data.payout_id || data.id;
    if (!payoutId) {
      throw new Error('缺少結算 ID');
    }
    
    const updated = updateRecord('Payouts', payoutId, {
      payout_status: 'CANCELLED',
      notes: (data.notes || '') + `\n[取消於 ${new Date().toISOString()}]`
    });
    
    return createJsonResponse({
      success: true,
      message: '結算已取消',
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
 * 處理追蹤連結重定向
 */
function handleTrackingRedirect(partnerCode, e) {
  try {
    // 記錄點擊
    createRecord('Click_Tracking', {
      partner_code: partnerCode,
      tracking_type: 'REFERRAL_LINK',
      ip_address: e.parameter.ip || '',
      user_agent: e.parameter.ua || '',
      referrer: e.parameter.ref || ''
    });
    
    // 重定向到訂房頁面
    const redirectUrl = 'https://example.com/booking?ref=' + partnerCode;
    return HtmlService.createHtmlOutput(
      '<script>window.location.href="' + redirectUrl + '";</script>'
    );
    
  } catch (error) {
    Logger.log('追蹤重定向錯誤: ' + error.toString());
    return HtmlService.createHtmlOutput('錯誤：無法處理請求');
  }
}

/**
 * 處理追蹤點擊
 */
function handleTrackClick(partnerCode, e) {
  try {
    if (!partnerCode) {
      throw new Error('缺少大使代碼');
    }
    
    createRecord('Click_Tracking', {
      partner_code: partnerCode,
      tracking_type: 'CLICK',
      ip_address: e.parameter.ip || '',
      user_agent: e.parameter.ua || '',
      referrer: e.parameter.ref || ''
    });
    
    return createJsonResponse({
      success: true,
      message: '點擊已記錄'
    });
    
  } catch (error) {
    Logger.log('記錄點擊錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 創建 JSON 響應
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== 結束 =====