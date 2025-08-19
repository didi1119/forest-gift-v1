/**
 * 知音計畫 - 事件處理器架構
 * 
 * 設計原則：
 * 1. 每個事件處理器完全獨立
 * 2. 清晰的輸入輸出定義
 * 3. 完整的錯誤處理
 * 4. 自動審計追蹤
 * 5. 易於測試和維護
 */

// ========================================
// 基礎配置
// ========================================

const CONFIG = {
  SHEETS_ID: '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4',
  
  // 佣金配置
  COMMISSION_RATES: {
    'LV1_INSIDER': { accommodation: 1000, cash: 500 },
    'LV2_GUIDE': { accommodation: 1200, cash: 600 },
    'LV3_GUARDIAN': { accommodation: 1500, cash: 750 }
  },
  
  FIRST_REFERRAL_BONUS: 1500,  // 僅LV1享有
  
  LEVEL_REQUIREMENTS: {
    'LV2_GUIDE': 4,
    'LV3_GUARDIAN': 10
  },
  
  POINTS_TO_CASH_RATE: 0.5  // 2點換1元
};

// ========================================
// 基礎事件處理器類
// ========================================

class BaseEventHandler {
  constructor() {
    this.spreadsheet = null;
    this.changes = [];
    this.payouts = [];
  }
  
  /**
   * 執行事件處理
   */
  async execute(data) {
    try {
      // 1. 初始化
      this.spreadsheet = SpreadsheetApp.openById(CONFIG.SHEETS_ID);
      
      // 2. 驗證輸入
      const validationResult = await this.validate(data);
      if (!validationResult.success) {
        return this.createErrorResponse(validationResult.message);
      }
      
      // 3. 執行業務邏輯
      const result = await this.process(data);
      
      // 4. 創建審計記錄
      await this.createAuditRecords();
      
      // 5. 返回結果
      return this.createSuccessResponse(result);
      
    } catch (error) {
      Logger.log(`Error in ${this.constructor.name}: ${error.toString()}`);
      return this.createErrorResponse(error.message);
    }
  }
  
  /**
   * 驗證輸入（子類實現）
   */
  async validate(data) {
    return { success: true };
  }
  
  /**
   * 處理業務邏輯（子類實現）
   */
  async process(data) {
    throw new Error('process method must be implemented');
  }
  
  /**
   * 創建審計記錄
   */
  async createAuditRecords() {
    if (this.payouts.length > 0) {
      const payoutsSheet = this.spreadsheet.getSheetByName('Payouts');
      for (const payout of this.payouts) {
        this.appendRow(payoutsSheet, payout);
      }
    }
  }
  
  /**
   * 記錄Payout
   */
  recordPayout(data) {
    const payout = {
      id: this.generateId('PO'),
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    };
    this.payouts.push(payout);
    return payout;
  }
  
  /**
   * 生成ID
   */
  generateId(prefix) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}${timestamp}${random}`;
  }
  
  /**
   * 創建成功響應
   */
  createSuccessResponse(data) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        ...data
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  /**
   * 創建錯誤響應
   */
  createErrorResponse(message) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  /**
   * 查找記錄
   */
  findRecord(sheetName, idField, idValue) {
    const sheet = this.spreadsheet.getSheetByName(sheetName);
    if (!sheet) return null;
    
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const idIndex = headers.indexOf(idField);
    
    if (idIndex === -1) return null;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][idIndex] == idValue) {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = values[i][index];
        });
        return {
          data: record,
          rowIndex: i + 1,
          sheet: sheet
        };
      }
    }
    
    return null;
  }
  
  /**
   * 更新記錄
   */
  updateRecord(sheetName, idField, idValue, updates) {
    const record = this.findRecord(sheetName, idField, idValue);
    if (!record) {
      throw new Error(`Record not found: ${idField}=${idValue}`);
    }
    
    const headers = record.sheet.getRange(1, 1, 1, record.sheet.getLastColumn()).getValues()[0];
    const updatedData = { ...record.data, ...updates, updated_at: new Date() };
    const row = headers.map(header => updatedData[header] || '');
    
    record.sheet.getRange(record.rowIndex, 1, 1, row.length).setValues([row]);
    
    this.changes.push({
      table: sheetName,
      id: idValue,
      changes: updates
    });
    
    return updatedData;
  }
  
  /**
   * 新增記錄
   */
  appendRow(sheet, data) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map(header => data[header] || '');
    sheet.appendRow(row);
    return data;
  }
}

// ========================================
// 創建訂房事件處理器
// ========================================

class CreateBookingHandler extends BaseEventHandler {
  async validate(data) {
    // 必填欄位檢查
    const required = ['guest_name', 'guest_phone', 'checkin_date', 'room_price'];
    for (const field of required) {
      if (!data[field]) {
        return { success: false, message: `缺少必填欄位: ${field}` };
      }
    }
    
    // 房價檢查
    if (parseFloat(data.room_price) <= 0) {
      return { success: false, message: '房價必須大於0' };
    }
    
    return { success: true };
  }
  
  async process(data) {
    // 生成訂房ID
    const bookingId = this.generateId('BK');
    
    // 判斷訂房類型
    let bookingSource = 'DIRECT';
    if (data.booking_source === 'SELF_USE') {
      bookingSource = 'SELF_USE';
    } else if (data.partner_code) {
      bookingSource = 'REFERRAL';
    }
    
    // 創建訂房記錄
    const booking = {
      id: bookingId,
      partner_code: data.partner_code || '',
      guest_name: data.guest_name,
      guest_phone: data.guest_phone,
      guest_email: data.guest_email || '',
      bank_account_last5: data.bank_account_last5 || '',
      checkin_date: data.checkin_date,
      checkout_date: data.checkout_date || data.checkin_date,
      room_price: parseFloat(data.room_price),
      booking_source: bookingSource,
      stay_status: 'PENDING',
      payment_status: 'UNPAID',
      commission_status: 'PENDING',
      commission_amount: 0,
      commission_type: '',
      is_first_referral_bonus: false,
      first_referral_bonus_amount: 0,
      manually_confirmed_by: '',
      manually_confirmed_at: '',
      notes: data.notes || '',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // 寫入Bookings表
    const bookingsSheet = this.spreadsheet.getSheetByName('Bookings');
    this.appendRow(bookingsSheet, booking);
    
    // 如果有推薦人，更新推薦統計
    if (data.partner_code && bookingSource === 'REFERRAL') {
      const partner = this.findRecord('Partners', 'partner_code', data.partner_code);
      if (partner) {
        this.updateRecord('Partners', 'partner_code', data.partner_code, {
          total_referrals: (partner.data.total_referrals || 0) + 1
        });
      }
    }
    
    return {
      message: '訂房創建成功',
      booking_id: bookingId,
      booking: booking
    };
  }
}

// ========================================
// 確認入住完成事件處理器
// ========================================

class ConfirmCheckinHandler extends BaseEventHandler {
  async validate(data) {
    if (!data.booking_id && (!data.guest_name || !data.guest_phone)) {
      return { 
        success: false, 
        message: '需要提供 booking_id 或 guest_name + guest_phone' 
      };
    }
    return { success: true };
  }
  
  async process(data) {
    // 查找訂房記錄
    let booking = null;
    if (data.booking_id) {
      booking = this.findRecord('Bookings', 'id', data.booking_id);
    }
    
    if (!booking && data.guest_name && data.guest_phone) {
      // 用複合條件查找
      const bookingsSheet = this.spreadsheet.getSheetByName('Bookings');
      const values = bookingsSheet.getDataRange().getValues();
      const headers = values[0];
      
      for (let i = 1; i < values.length; i++) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[i][index];
        });
        
        if (row.guest_name === data.guest_name && 
            row.guest_phone == data.guest_phone &&
            row.checkin_date === data.checkin_date) {
          booking = {
            data: row,
            rowIndex: i + 1,
            sheet: bookingsSheet
          };
          break;
        }
      }
    }
    
    if (!booking) {
      throw new Error('找不到訂房記錄');
    }
    
    // 檢查狀態
    if (booking.data.stay_status === 'COMPLETED') {
      return {
        message: '該訂房已經確認過了',
        booking_id: booking.data.id
      };
    }
    
    let commissionAmount = 0;
    let commissionType = '';
    let isFirstBonus = false;
    let firstBonusAmount = 0;
    
    // 計算佣金（如果符合資格）
    if (booking.data.partner_code && booking.data.booking_source !== 'SELF_USE') {
      const partner = this.findRecord('Partners', 'partner_code', booking.data.partner_code);
      
      if (partner) {
        // 計算佣金
        const result = this.calculateCommission(
          partner.data.partner_level || 'LV1_INSIDER',
          partner.data.commission_preference || 'ACCOMMODATION',
          partner.data.successful_referrals || 0
        );
        
        commissionAmount = result.amount;
        commissionType = result.type;
        isFirstBonus = result.isFirstBonus;
        firstBonusAmount = result.firstBonusAmount;
        
        // 更新大使統計
        const updates = {
          successful_referrals: (partner.data.successful_referrals || 0) + 1,
          yearly_referrals: (partner.data.yearly_referrals || 0) + 1,
          total_commission_earned: (partner.data.total_commission_earned || 0) + commissionAmount
        };
        
        // 根據佣金類型更新
        if (commissionType === 'ACCOMMODATION') {
          updates.available_points = (partner.data.available_points || 0) + commissionAmount;
        } else {
          updates.pending_commission = (partner.data.pending_commission || 0) + commissionAmount;
        }
        
        // 檢查等級晉升
        const newLevel = this.checkLevelUpgrade(updates.yearly_referrals);
        if (newLevel !== partner.data.partner_level) {
          updates.partner_level = newLevel;
        }
        
        this.updateRecord('Partners', 'partner_code', booking.data.partner_code, updates);
        
        // 創建Payout記錄
        this.recordPayout({
          partner_code: booking.data.partner_code,
          payout_type: commissionType,
          amount: commissionAmount,
          related_booking_ids: booking.data.id,
          payout_method: commissionType === 'CASH' ? 'BANK_TRANSFER' : 'ACCOMMODATION_VOUCHER',
          payout_status: 'PENDING',
          notes: `佣金 - 訂單 #${booking.data.id}`,
          created_by: data.confirmed_by || 'system'
        });
      }
    }
    
    // 更新訂房狀態
    this.updateRecord('Bookings', 'id', booking.data.id, {
      stay_status: 'COMPLETED',
      payment_status: 'PAID',
      commission_status: commissionAmount > 0 ? 'CALCULATED' : 'NOT_ELIGIBLE',
      commission_amount: commissionAmount,
      commission_type: commissionType,
      is_first_referral_bonus: isFirstBonus,
      first_referral_bonus_amount: firstBonusAmount,
      manually_confirmed_by: data.confirmed_by || 'system',
      manually_confirmed_at: new Date()
    });
    
    return {
      message: '入住確認成功',
      booking_id: booking.data.id,
      commission_amount: commissionAmount
    };
  }
  
  /**
   * 計算佣金
   */
  calculateCommission(level, preference, successfulReferrals) {
    const rates = CONFIG.COMMISSION_RATES[level];
    if (!rates) {
      return { amount: 0, type: 'NONE', isFirstBonus: false, firstBonusAmount: 0 };
    }
    
    const preferenceKey = preference.toLowerCase();
    let baseAmount = rates[preferenceKey] || 0;
    let firstBonusAmount = 0;
    let isFirstBonus = false;
    
    // LV1首次推薦獎勵（僅住宿金）
    if (level === 'LV1_INSIDER' && successfulReferrals === 0 && preference === 'ACCOMMODATION') {
      firstBonusAmount = CONFIG.FIRST_REFERRAL_BONUS;
      isFirstBonus = true;
    }
    
    return {
      amount: baseAmount + firstBonusAmount,
      type: preference.toUpperCase(),
      isFirstBonus: isFirstBonus,
      firstBonusAmount: firstBonusAmount
    };
  }
  
  /**
   * 檢查等級晉升
   */
  checkLevelUpgrade(yearlyReferrals) {
    if (yearlyReferrals >= CONFIG.LEVEL_REQUIREMENTS.LV3_GUARDIAN) {
      return 'LV3_GUARDIAN';
    } else if (yearlyReferrals >= CONFIG.LEVEL_REQUIREMENTS.LV2_GUIDE) {
      return 'LV2_GUIDE';
    } else {
      return 'LV1_INSIDER';
    }
  }
}

// ========================================
// 更新訂房事件處理器
// ========================================

class UpdateBookingHandler extends BaseEventHandler {
  async validate(data) {
    if (!data.booking_id) {
      return { success: false, message: '需要提供 booking_id' };
    }
    return { success: true };
  }
  
  async process(data) {
    // 查找訂房記錄
    const booking = this.findRecord('Bookings', 'id', data.booking_id);
    if (!booking) {
      throw new Error('找不到訂房記錄');
    }
    
    const oldData = { ...booking.data };
    const updates = {};
    const impacts = {
      hasMonetaryImpact: false,
      hasStatisticalImpact: false,
      affectedPartners: []
    };
    
    // 分析每個欄位的變更影響
    
    // 1. 基本資訊變更（無金額影響）
    ['guest_name', 'guest_phone', 'guest_email', 'bank_account_last5', 
     'checkin_date', 'checkout_date', 'notes'].forEach(field => {
      if (data[field] !== undefined && data[field] !== oldData[field]) {
        updates[field] = data[field];
      }
    });
    
    // 2. 推薦人變更（複雜處理）
    if (data.partner_code !== undefined && data.partner_code !== oldData.partner_code) {
      impacts.hasStatisticalImpact = true;
      impacts.affectedPartners.push(oldData.partner_code, data.partner_code);
      
      if (oldData.stay_status === 'COMPLETED' && oldData.commission_status === 'CALCULATED') {
        impacts.hasMonetaryImpact = true;
        
        // 撤銷舊推薦人佣金
        if (oldData.partner_code) {
          await this.reverseCommission(oldData);
        }
        
        // 計算新推薦人佣金
        if (data.partner_code) {
          await this.calculateNewCommission(data.partner_code, oldData);
        }
      } else {
        // 只調整統計
        if (oldData.partner_code) {
          const oldPartner = this.findRecord('Partners', 'partner_code', oldData.partner_code);
          if (oldPartner) {
            this.updateRecord('Partners', 'partner_code', oldData.partner_code, {
              total_referrals: Math.max(0, (oldPartner.data.total_referrals || 0) - 1)
            });
          }
        }
        
        if (data.partner_code) {
          const newPartner = this.findRecord('Partners', 'partner_code', data.partner_code);
          if (newPartner) {
            this.updateRecord('Partners', 'partner_code', data.partner_code, {
              total_referrals: (newPartner.data.total_referrals || 0) + 1
            });
          }
        }
      }
      
      updates.partner_code = data.partner_code;
    }
    
    // 3. 房價變更（可能影響佣金）
    if (data.room_price !== undefined && data.room_price != oldData.room_price) {
      updates.room_price = parseFloat(data.room_price);
      
      if (oldData.stay_status === 'COMPLETED' && oldData.commission_status === 'CALCULATED') {
        impacts.hasMonetaryImpact = true;
        
        // 計算佣金差額
        const partner = this.findRecord('Partners', 'partner_code', oldData.partner_code);
        if (partner) {
          // 這裡簡化處理，實際應該重新計算完整佣金
          const oldCommission = oldData.commission_amount || 0;
          const newCommission = this.calculateCommission(
            partner.data.partner_level,
            partner.data.commission_preference,
            partner.data.successful_referrals
          ).amount;
          
          const difference = newCommission - oldCommission;
          if (difference !== 0) {
            // 創建調整記錄
            this.recordPayout({
              partner_code: oldData.partner_code,
              payout_type: 'COMMISSION_ADJUSTMENT',
              amount: difference,
              related_booking_ids: oldData.id,
              payout_status: 'COMPLETED',
              notes: `房價調整：${oldData.room_price} → ${data.room_price}`,
              created_by: 'system'
            });
            
            // 更新大使佣金
            if (partner.data.commission_preference === 'ACCOMMODATION') {
              this.updateRecord('Partners', 'partner_code', oldData.partner_code, {
                available_points: (partner.data.available_points || 0) + difference
              });
            } else {
              this.updateRecord('Partners', 'partner_code', oldData.partner_code, {
                pending_commission: (partner.data.pending_commission || 0) + difference
              });
            }
            
            updates.commission_amount = newCommission;
          }
        }
      }
    }
    
    // 執行更新
    if (Object.keys(updates).length > 0) {
      this.updateRecord('Bookings', 'id', data.booking_id, updates);
    }
    
    return {
      message: '訂房更新成功',
      booking_id: data.booking_id,
      updates: updates,
      impacts: impacts
    };
  }
  
  /**
   * 撤銷佣金
   */
  async reverseCommission(booking) {
    const partner = this.findRecord('Partners', 'partner_code', booking.partner_code);
    if (!partner) return;
    
    const commissionAmount = booking.commission_amount || 0;
    if (commissionAmount === 0) return;
    
    // 創建撤銷記錄
    this.recordPayout({
      partner_code: booking.partner_code,
      payout_type: 'COMMISSION_REVERSAL',
      amount: -commissionAmount,
      related_booking_ids: booking.id,
      payout_status: 'COMPLETED',
      notes: '推薦人變更 - 撤銷原佣金',
      created_by: 'system'
    });
    
    // 更新大使數據
    const updates = {
      successful_referrals: Math.max(0, (partner.data.successful_referrals || 0) - 1),
      yearly_referrals: Math.max(0, (partner.data.yearly_referrals || 0) - 1),
      total_commission_earned: Math.max(0, (partner.data.total_commission_earned || 0) - commissionAmount)
    };
    
    if (booking.commission_type === 'ACCOMMODATION') {
      updates.available_points = Math.max(0, (partner.data.available_points || 0) - commissionAmount);
    } else {
      updates.pending_commission = Math.max(0, (partner.data.pending_commission || 0) - commissionAmount);
    }
    
    this.updateRecord('Partners', 'partner_code', booking.partner_code, updates);
  }
  
  /**
   * 計算新佣金
   */
  async calculateNewCommission(partnerCode, booking) {
    const partner = this.findRecord('Partners', 'partner_code', partnerCode);
    if (!partner) return;
    
    // 計算佣金（邏輯同確認入住）
    const handler = new ConfirmCheckinHandler();
    handler.spreadsheet = this.spreadsheet;
    
    const result = handler.calculateCommission(
      partner.data.partner_level || 'LV1_INSIDER',
      partner.data.commission_preference || 'ACCOMMODATION',
      partner.data.successful_referrals || 0
    );
    
    // 創建新佣金記錄
    this.recordPayout({
      partner_code: partnerCode,
      payout_type: result.type,
      amount: result.amount,
      related_booking_ids: booking.id,
      payout_status: 'PENDING',
      notes: '推薦人變更 - 新佣金',
      created_by: 'system'
    });
    
    // 更新大使數據
    const updates = {
      successful_referrals: (partner.data.successful_referrals || 0) + 1,
      yearly_referrals: (partner.data.yearly_referrals || 0) + 1,
      total_commission_earned: (partner.data.total_commission_earned || 0) + result.amount
    };
    
    if (result.type === 'ACCOMMODATION') {
      updates.available_points = (partner.data.available_points || 0) + result.amount;
    } else {
      updates.pending_commission = (partner.data.pending_commission || 0) + result.amount;
    }
    
    this.updateRecord('Partners', 'partner_code', partnerCode, updates);
  }
}

// ========================================
// 使用住宿金事件處理器
// ========================================

class UseAccommodationPointsHandler extends BaseEventHandler {
  async validate(data) {
    if (!data.partner_code) {
      return { success: false, message: '需要提供 partner_code' };
    }
    
    const deductAmount = parseFloat(data.deduct_amount || 0);
    if (deductAmount <= 0) {
      return { success: false, message: '折抵金額必須大於0' };
    }
    
    // 檢查可用點數
    const partner = this.findRecord('Partners', 'partner_code', data.partner_code);
    if (!partner) {
      return { success: false, message: '找不到大使資料' };
    }
    
    const availablePoints = partner.data.available_points || 0;
    if (availablePoints < deductAmount) {
      return { 
        success: false, 
        message: `點數不足。可用：${availablePoints}，需要：${deductAmount}` 
      };
    }
    
    return { success: true };
  }
  
  async process(data) {
    const partner = this.findRecord('Partners', 'partner_code', data.partner_code);
    const deductAmount = parseFloat(data.deduct_amount);
    const roomPrice = parseFloat(data.room_price || deductAmount);
    
    // 創建 SELF_USE 訂房記錄
    const bookingId = this.generateId('BK');
    const booking = {
      id: bookingId,
      partner_code: data.partner_code,
      guest_name: data.guest_name || partner.data.partner_name,
      guest_phone: data.guest_phone || partner.data.contact_phone,
      guest_email: data.guest_email || partner.data.contact_email || '',
      checkin_date: data.checkin_date || new Date(),
      checkout_date: data.checkout_date || data.checkin_date || new Date(),
      room_price: roomPrice,
      booking_source: 'SELF_USE',
      stay_status: 'COMPLETED',
      payment_status: 'PAID',
      commission_status: 'NOT_ELIGIBLE',
      commission_amount: 0,
      notes: `住宿金折抵 NT$ ${deductAmount}，實付 NT$ ${roomPrice - deductAmount}`,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const bookingsSheet = this.spreadsheet.getSheetByName('Bookings');
    this.appendRow(bookingsSheet, booking);
    
    // 更新大使點數
    this.updateRecord('Partners', 'partner_code', data.partner_code, {
      available_points: (partner.data.available_points || 0) - deductAmount,
      points_used: (partner.data.points_used || 0) + deductAmount
    });
    
    // 創建 Accommodation_Usage 記錄
    const usageSheet = this.spreadsheet.getSheetByName('Accommodation_Usage');
    if (usageSheet) {
      this.appendRow(usageSheet, {
        id: this.generateId('AU'),
        partner_code: data.partner_code,
        deduct_amount: deductAmount,
        related_booking_id: bookingId,
        usage_date: data.checkin_date || new Date(),
        usage_type: 'ROOM_DISCOUNT',
        notes: data.notes || '住宿金折抵',
        created_by: 'system',
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    // 創建 Payout 審計記錄
    this.recordPayout({
      partner_code: data.partner_code,
      payout_type: 'POINTS_ADJUSTMENT_DEBIT',
      amount: -deductAmount,
      related_booking_ids: bookingId,
      payout_status: 'COMPLETED',
      notes: `住宿金折抵 - 訂房 #${bookingId}`,
      created_by: 'system'
    });
    
    return {
      message: `成功使用 ${deductAmount} 點住宿金`,
      booking_id: bookingId
    };
  }
}

// ========================================
// 刪除訂房事件處理器
// ========================================

class DeleteBookingHandler extends BaseEventHandler {
  async validate(data) {
    if (!data.booking_id) {
      return { success: false, message: '需要提供 booking_id' };
    }
    return { success: true };
  }
  
  async process(data) {
    const booking = this.findRecord('Bookings', 'id', data.booking_id);
    if (!booking) {
      throw new Error('找不到訂房記錄');
    }
    
    // 處理 SELF_USE 點數返還
    if (booking.data.booking_source === 'SELF_USE') {
      // 查找相關的 Accommodation_Usage
      const usageSheet = this.spreadsheet.getSheetByName('Accommodation_Usage');
      if (usageSheet) {
        const usageValues = usageSheet.getDataRange().getValues();
        const headers = usageValues[0];
        
        for (let i = 1; i < usageValues.length; i++) {
          const row = {};
          headers.forEach((header, index) => {
            row[header] = usageValues[i][index];
          });
          
          if (row.related_booking_id === booking.data.id) {
            const refundAmount = parseFloat(row.deduct_amount || 0);
            
            if (refundAmount > 0) {
              // 返還點數
              const partner = this.findRecord('Partners', 'partner_code', booking.data.partner_code);
              if (partner) {
                this.updateRecord('Partners', 'partner_code', booking.data.partner_code, {
                  available_points: (partner.data.available_points || 0) + refundAmount,
                  points_used: Math.max(0, (partner.data.points_used || 0) - refundAmount)
                });
                
                // 創建退款記錄
                this.recordPayout({
                  partner_code: booking.data.partner_code,
                  payout_type: 'POINTS_REFUND',
                  amount: refundAmount,
                  related_booking_ids: booking.data.id,
                  payout_status: 'COMPLETED',
                  notes: `取消訂房 - 返還住宿金`,
                  created_by: data.deleted_by || 'system'
                });
              }
            }
            break;
          }
        }
      }
    }
    
    // 處理已計算佣金的撤銷
    if (booking.data.stay_status === 'COMPLETED' && 
        booking.data.commission_status === 'CALCULATED' &&
        booking.data.commission_amount > 0) {
      
      const partner = this.findRecord('Partners', 'partner_code', booking.data.partner_code);
      if (partner) {
        const commissionAmount = booking.data.commission_amount;
        
        // 撤銷佣金
        const updates = {
          successful_referrals: Math.max(0, (partner.data.successful_referrals || 0) - 1),
          yearly_referrals: Math.max(0, (partner.data.yearly_referrals || 0) - 1),
          total_commission_earned: Math.max(0, (partner.data.total_commission_earned || 0) - commissionAmount)
        };
        
        if (booking.data.commission_type === 'ACCOMMODATION') {
          updates.available_points = Math.max(0, (partner.data.available_points || 0) - commissionAmount);
        } else {
          updates.pending_commission = Math.max(0, (partner.data.pending_commission || 0) - commissionAmount);
        }
        
        this.updateRecord('Partners', 'partner_code', booking.data.partner_code, updates);
        
        // 創建撤銷記錄
        this.recordPayout({
          partner_code: booking.data.partner_code,
          payout_type: 'COMMISSION_REVERSAL',
          amount: -commissionAmount,
          related_booking_ids: booking.data.id,
          payout_status: 'COMPLETED',
          notes: `取消訂房 - 撤銷佣金`,
          created_by: data.deleted_by || 'system'
        });
      }
    }
    
    // 更新訂房狀態為取消
    this.updateRecord('Bookings', 'id', data.booking_id, {
      stay_status: 'CANCELLED',
      cancellation_reason: data.reason || '',
      cancelled_at: new Date(),
      cancelled_by: data.deleted_by || 'system'
    });
    
    return {
      message: '訂房已取消',
      booking_id: data.booking_id
    };
  }
}

// ========================================
// 事件處理器註冊表
// ========================================

const EVENT_HANDLERS = {
  'create_booking': CreateBookingHandler,
  'confirm_checkin_completion': ConfirmCheckinHandler,
  'update_booking': UpdateBookingHandler,
  'use_accommodation_points': UseAccommodationPointsHandler,
  'deduct_accommodation_points': UseAccommodationPointsHandler,  // 別名
  'delete_booking': DeleteBookingHandler,
  'cancel_booking': DeleteBookingHandler  // 別名
};

// ========================================
// 主入口函數
// ========================================

/**
 * 處理事件請求
 */
async function handleEvent(action, data) {
  const HandlerClass = EVENT_HANDLERS[action];
  
  if (!HandlerClass) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: `未知的動作: ${action}`
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const handler = new HandlerClass();
  return await handler.execute(data);
}

// ========================================
// Google Apps Script 入口
// ========================================

function doPost(e) {
  try {
    const data = e.parameter || {};
    const action = data.action;
    
    if (!action) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: '缺少 action 參數'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return handleEvent(action, data);
    
  } catch (error) {
    Logger.log('doPost error: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const params = e.parameter || {};
  
  if (params.action === 'get_all_data' || params.action === 'get_dashboard_data') {
    return handleGetAllData();
  }
  
  return HtmlService.createHtmlOutput('知音計畫 API v3');
}

function handleGetAllData() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SHEETS_ID);
    const data = {};
    
    ['Bookings', 'Partners', 'Payouts', 'Accommodation_Usage', 'Clicks'].forEach(sheetName => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (sheet) {
        const values = sheet.getDataRange().getValues();
        const headers = values[0];
        const records = [];
        
        for (let i = 1; i < values.length; i++) {
          const record = {};
          headers.forEach((header, index) => {
            record[header] = values[i][index];
          });
          records.push(record);
        }
        
        data[sheetName.toLowerCase()] = records;
      } else {
        data[sheetName.toLowerCase()] = [];
      }
    });
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        data: data
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('Get all data error: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 導出（如果需要測試）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EVENT_HANDLERS,
    CreateBookingHandler,
    ConfirmCheckinHandler,
    UpdateBookingHandler,
    UseAccommodationPointsHandler,
    DeleteBookingHandler,
    handleEvent
  };
}