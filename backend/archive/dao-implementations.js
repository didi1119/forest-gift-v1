// ===== DAO 實現類 (DAO Implementations) =====
// 各個表格的具體數據訪問對象

// 需要先載入基礎類和模型定義
// 在 Google Apps Script 中，這些會在同一個專案中

/**
 * BookingDAO - 訂房記錄數據訪問對象
 */
class BookingDAO extends BaseDAO {
  constructor() {
    super('Bookings', DataModels.Booking);
  }
  
  /**
   * 根據房客資訊查找訂房記錄
   */
  findByGuestInfo(guestName, guestPhone, checkinDate = null) {
    this.initialize();
    
    const conditions = {
      guest_name: guestName,
      guest_phone: guestPhone
    };
    
    const results = this.findByConditions(conditions);
    
    // 如果提供了入住日期，進一步過濾
    if (checkinDate && results.length > 0) {
      return results.filter(booking => {
        return this.isSameDate(booking.checkin_date, checkinDate);
      });
    }
    
    return results;
  }
  
  /**
   * 根據大使代碼查找訂房記錄
   */
  findByPartnerCode(partnerCode) {
    return this.findByField('partner_code', partnerCode);
  }
  
  /**
   * 查找待確認的訂房記錄
   */
  findPendingBookings() {
    return this.findByField('stay_status', 'PENDING');
  }
  
  /**
   * 查找已完成的訂房記錄
   */
  findCompletedBookings() {
    return this.findByField('stay_status', 'COMPLETED');
  }
  
  /**
   * 查找某個日期範圍內的訂房
   */
  findByDateRange(startDate, endDate) {
    this.initialize();
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const allBookings = this.findAll();
    
    return allBookings.filter(booking => {
      const checkinDate = new Date(booking.checkin_date);
      return checkinDate >= start && checkinDate <= end;
    });
  }
  
  /**
   * 查找自用訂房（SELF_USE）
   */
  findSelfUseBookings(partnerCode = null) {
    const bookings = this.findByField('booking_source', 'SELF_USE');
    
    if (partnerCode) {
      return bookings.filter(b => b.partner_code === partnerCode);
    }
    
    return bookings;
  }
  
  /**
   * 確認入住完成
   */
  confirmCheckin(bookingId, confirmedBy = 'system') {
    const timestamp = new Date();
    
    return this.update(bookingId, {
      stay_status: 'COMPLETED',
      manually_confirmed_by: confirmedBy,
      manually_confirmed_at: timestamp,
      updated_at: timestamp
    });
  }
  
  /**
   * 取消訂房
   */
  cancelBooking(bookingId, reason = '') {
    const timestamp = new Date();
    const booking = this.findById(bookingId);
    
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }
    
    const currentNotes = booking.notes || '';
    const cancelNote = `[取消於 ${timestamp.toISOString()}] ${reason}`;
    
    return this.update(bookingId, {
      stay_status: 'CANCELLED',
      commission_status: 'CANCELLED',
      notes: currentNotes ? `${currentNotes}\n${cancelNote}` : cancelNote,
      updated_at: timestamp
    });
  }
  
  /**
   * 比較日期（忽略時間）
   */
  isSameDate(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.toDateString() === d2.toDateString();
  }
  
  /**
   * 計算總房價
   */
  calculateTotalPrice(bookings) {
    return bookings.reduce((total, booking) => {
      return total + (parseFloat(booking.room_price) || 0);
    }, 0);
  }
  
  /**
   * 計算總佣金
   */
  calculateTotalCommission(bookings) {
    return bookings.reduce((total, booking) => {
      return total + (parseFloat(booking.commission_amount) || 0);
    }, 0);
  }
}

/**
 * PartnerDAO - 大使數據訪問對象
 */
class PartnerDAO extends BaseDAO {
  constructor() {
    super('Partners', DataModels.Partner);
  }
  
  /**
   * 根據大使代碼查找（唯一）
   */
  findByPartnerCode(partnerCode) {
    const results = this.findByField('partner_code', partnerCode);
    return results.length > 0 ? results[0] : null;
  }
  
  /**
   * 根據電話查找大使
   */
  findByPhone(phone) {
    return this.findByField('contact_phone', phone);
  }
  
  /**
   * 查找活躍的大使
   */
  findActivePartners() {
    return this.findByField('is_active', true);
  }
  
  /**
   * 根據等級查找大使
   */
  findByLevel(level) {
    return this.findByField('partner_level', level);
  }
  
  /**
   * 更新推薦統計
   */
  updateReferralStats(partnerCode, increment = true) {
    const partner = this.findByPartnerCode(partnerCode);
    
    if (!partner) {
      throw new NotFoundError(`Partner ${partnerCode} not found`);
    }
    
    const delta = increment ? 1 : -1;
    
    return this.update(partner.partner_code, {
      total_referrals: Math.max(0, (partner.total_referrals || 0) + delta),
      updated_at: new Date()
    });
  }
  
  /**
   * 更新成功推薦統計
   */
  updateSuccessfulReferrals(partnerCode, increment = true) {
    const partner = this.findByPartnerCode(partnerCode);
    
    if (!partner) {
      throw new NotFoundError(`Partner ${partnerCode} not found`);
    }
    
    const delta = increment ? 1 : -1;
    
    return this.update(partner.partner_code, {
      successful_referrals: Math.max(0, (partner.successful_referrals || 0) + delta),
      yearly_referrals: Math.max(0, (partner.yearly_referrals || 0) + delta),
      updated_at: new Date()
    });
  }
  
  /**
   * 更新佣金
   */
  updateCommission(partnerCode, amount, isPending = true) {
    const partner = this.findByPartnerCode(partnerCode);
    
    if (!partner) {
      throw new NotFoundError(`Partner ${partnerCode} not found`);
    }
    
    const updates = {
      total_commission_earned: (partner.total_commission_earned || 0) + amount,
      updated_at: new Date()
    };
    
    if (isPending) {
      updates.pending_commission = (partner.pending_commission || 0) + amount;
    }
    
    // 如果是住宿金類型，更新可用點數
    if (partner.commission_preference === 'ACCOMMODATION' && amount > 0) {
      updates.available_points = (partner.available_points || 0) + amount;
    }
    
    return this.update(partner.partner_code, updates);
  }
  
  /**
   * 使用住宿金點數
   */
  useAccommodationPoints(partnerCode, amount) {
    const partner = this.findByPartnerCode(partnerCode);
    
    if (!partner) {
      throw new NotFoundError(`Partner ${partnerCode} not found`);
    }
    
    if ((partner.available_points || 0) < amount) {
      throw new ValidationError(`Insufficient points. Available: ${partner.available_points}, Required: ${amount}`);
    }
    
    return this.update(partner.partner_code, {
      available_points: (partner.available_points || 0) - amount,
      points_used: (partner.points_used || 0) + amount,
      updated_at: new Date()
    });
  }
  
  /**
   * 返還住宿金點數
   */
  refundAccommodationPoints(partnerCode, amount) {
    const partner = this.findByPartnerCode(partnerCode);
    
    if (!partner) {
      throw new NotFoundError(`Partner ${partnerCode} not found`);
    }
    
    return this.update(partner.partner_code, {
      available_points: (partner.available_points || 0) + amount,
      points_used: Math.max(0, (partner.points_used || 0) - amount),
      updated_at: new Date()
    });
  }
  
  /**
   * 檢查並更新大使等級
   */
  checkAndUpdateLevel(partnerCode) {
    const partner = this.findByPartnerCode(partnerCode);
    
    if (!partner) {
      throw new NotFoundError(`Partner ${partnerCode} not found`);
    }
    
    const yearlyReferrals = partner.yearly_referrals || 0;
    let newLevel = partner.partner_level;
    
    // 根據年度推薦數判斷等級
    if (yearlyReferrals >= CommissionRules.levelRequirements.LV3_GUARDIAN) {
      newLevel = 'LV3_GUARDIAN';
    } else if (yearlyReferrals >= CommissionRules.levelRequirements.LV2_GUIDE) {
      newLevel = 'LV2_GUIDE';
    } else {
      newLevel = 'LV1_INSIDER';
    }
    
    // 如果等級有變化，更新
    if (newLevel !== partner.partner_level) {
      Logger.log(`Updating partner ${partnerCode} level from ${partner.partner_level} to ${newLevel}`);
      
      return this.update(partner.partner_code, {
        partner_level: newLevel,
        updated_at: new Date()
      });
    }
    
    return partner;
  }
  
  /**
   * 重置年度統計（年度結算用）
   */
  resetYearlyStats(partnerCode) {
    return this.update(partnerCode, {
      yearly_referrals: 0,
      updated_at: new Date()
    });
  }
}

/**
 * PayoutDAO - 結算記錄數據訪問對象
 */
class PayoutDAO extends BaseDAO {
  constructor() {
    super('Payouts', DataModels.Payout);
  }
  
  /**
   * 根據大使代碼查找結算記錄
   */
  findByPartnerCode(partnerCode) {
    return this.findByField('partner_code', partnerCode);
  }
  
  /**
   * 查找待處理的結算
   */
  findPendingPayouts() {
    return this.findByField('payout_status', 'PENDING');
  }
  
  /**
   * 查找已完成的結算
   */
  findCompletedPayouts() {
    return this.findByField('payout_status', 'COMPLETED');
  }
  
  /**
   * 根據訂房ID查找相關結算
   */
  findByBookingId(bookingId) {
    this.initialize();
    
    const allPayouts = this.findAll();
    
    return allPayouts.filter(payout => {
      if (!payout.related_booking_ids) return false;
      
      const bookingIds = payout.related_booking_ids.toString().split(',').map(id => id.trim());
      return bookingIds.includes(bookingId.toString());
    });
  }
  
  /**
   * 創建佣金結算
   */
  createCommissionPayout(partnerCode, amount, bookingIds, type = 'ACCOMMODATION') {
    return this.create({
      partner_code: partnerCode,
      payout_type: type,
      amount: amount,
      related_booking_ids: Array.isArray(bookingIds) ? bookingIds.join(',') : bookingIds,
      payout_method: type === 'CASH' ? 'BANK_TRANSFER' : 'ACCOMMODATION_VOUCHER',
      payout_status: 'PENDING',
      notes: `佣金結算 - ${type === 'CASH' ? '現金' : '住宿金'}`,
      created_by: 'system'
    });
  }
  
  /**
   * 創建點數返還記錄
   */
  createPointsRefund(partnerCode, amount, bookingId, reason) {
    return this.create({
      partner_code: partnerCode,
      payout_type: 'POINTS_REFUND',
      amount: -Math.abs(amount), // 確保是負數
      related_booking_ids: bookingId,
      payout_method: 'ACCOMMODATION_REFUND',
      payout_status: 'COMPLETED',
      notes: reason || '點數返還',
      created_by: 'system'
    });
  }
  
  /**
   * 創建點數調整記錄
   */
  createPointsAdjustment(partnerCode, amount, reason, isDebit = true) {
    return this.create({
      partner_code: partnerCode,
      payout_type: isDebit ? 'POINTS_ADJUSTMENT_DEBIT' : 'POINTS_ADJUSTMENT_CREDIT',
      amount: isDebit ? -Math.abs(amount) : Math.abs(amount),
      payout_method: 'POINTS_ADJUSTMENT',
      payout_status: 'COMPLETED',
      notes: reason || '點數調整',
      created_by: 'system'
    });
  }
  
  /**
   * 完成結算
   */
  completePayout(payoutId, transferReference = null) {
    const updates = {
      payout_status: 'COMPLETED',
      updated_at: new Date()
    };
    
    if (transferReference) {
      updates.bank_transfer_reference = transferReference;
      updates.bank_transfer_date = new Date();
    }
    
    return this.update(payoutId, updates);
  }
  
  /**
   * 取消結算
   */
  cancelPayout(payoutId, reason = '') {
    const payout = this.findById(payoutId);
    
    if (!payout) {
      throw new NotFoundError(`Payout ${payoutId} not found`);
    }
    
    if (payout.payout_status === 'COMPLETED') {
      throw new ValidationError('Cannot cancel completed payout');
    }
    
    const currentNotes = payout.notes || '';
    const cancelNote = `[取消於 ${new Date().toISOString()}] ${reason}`;
    
    return this.update(payoutId, {
      payout_status: 'CANCELLED',
      notes: currentNotes ? `${currentNotes}\n${cancelNote}` : cancelNote,
      updated_at: new Date()
    });
  }
  
  /**
   * 計算總結算金額
   */
  calculateTotalAmount(payouts) {
    return payouts.reduce((total, payout) => {
      return total + (parseFloat(payout.amount) || 0);
    }, 0);
  }
  
  /**
   * 根據類型分組統計
   */
  groupByType(payouts) {
    const grouped = {};
    
    payouts.forEach(payout => {
      const type = payout.payout_type;
      if (!grouped[type]) {
        grouped[type] = {
          count: 0,
          total: 0,
          items: []
        };
      }
      
      grouped[type].count++;
      grouped[type].total += parseFloat(payout.amount) || 0;
      grouped[type].items.push(payout);
    });
    
    return grouped;
  }
}

/**
 * AccommodationUsageDAO - 住宿金使用記錄數據訪問對象
 */
class AccommodationUsageDAO extends BaseDAO {
  constructor() {
    super('Accommodation_Usage', DataModels.AccommodationUsage);
  }
  
  /**
   * 根據大使代碼查找使用記錄
   */
  findByPartnerCode(partnerCode) {
    return this.findByField('partner_code', partnerCode);
  }
  
  /**
   * 根據訂房ID查找使用記錄
   */
  findByBookingId(bookingId) {
    return this.findByField('related_booking_id', bookingId);
  }
  
  /**
   * 記錄住宿金使用
   */
  recordUsage(partnerCode, amount, bookingId = null, usageType = 'ROOM_DISCOUNT') {
    return this.create({
      partner_code: partnerCode,
      deduct_amount: amount,
      related_booking_id: bookingId,
      usage_date: new Date(),
      usage_type: usageType,
      created_by: 'system'
    });
  }
  
  /**
   * 計算總使用金額
   */
  calculateTotalUsage(usages) {
    return usages.reduce((total, usage) => {
      return total + (parseFloat(usage.deduct_amount) || 0);
    }, 0);
  }
  
  /**
   * 刪除相關訂房的使用記錄
   */
  deleteByBookingId(bookingId) {
    const usages = this.findByBookingId(bookingId);
    
    usages.forEach(usage => {
      try {
        this.delete(usage.id);
      } catch (error) {
        Logger.log(`Error deleting accommodation usage ${usage.id}: ${error.message}`);
      }
    });
    
    return usages.length;
  }
}

/**
 * ClickDAO - 點擊追蹤數據訪問對象
 */
class ClickDAO extends BaseDAO {
  constructor() {
    super('Clicks', DataModels.Click);
  }
  
  /**
   * 記錄點擊
   */
  recordClick(params) {
    return this.create({
      partner_code: params.pid || params.subid || null,
      destination: params.dest || 'landing',
      utm_source: params.utm_source || null,
      utm_medium: params.utm_medium || null,
      utm_campaign: params.utm_campaign || null,
      ip_address: params.ip || null,
      user_agent: params.user_agent || null,
      click_time: new Date()
    });
  }
  
  /**
   * 根據大使代碼查找點擊記錄
   */
  findByPartnerCode(partnerCode) {
    return this.findByField('partner_code', partnerCode);
  }
  
  /**
   * 查找某個時間範圍內的點擊
   */
  findByDateRange(startDate, endDate) {
    this.initialize();
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const allClicks = this.findAll();
    
    return allClicks.filter(click => {
      const clickTime = new Date(click.click_time);
      return clickTime >= start && clickTime <= end;
    });
  }
  
  /**
   * 統計點擊數
   */
  countClicks(clicks) {
    return clicks.length;
  }
  
  /**
   * 按大使分組統計
   */
  groupByPartner(clicks) {
    const grouped = {};
    
    clicks.forEach(click => {
      const partner = click.partner_code || 'unknown';
      if (!grouped[partner]) {
        grouped[partner] = {
          count: 0,
          items: []
        };
      }
      
      grouped[partner].count++;
      grouped[partner].items.push(click);
    });
    
    return grouped;
  }
}

// 匯出給 Google Apps Script 使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BookingDAO,
    PartnerDAO,
    PayoutDAO,
    AccommodationUsageDAO,
    ClickDAO
  };
}