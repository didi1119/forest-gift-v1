// ========================================
// 知音計畫後端商業邏輯 — Vercel Serverless 版
// 從 Google Apps Script 轉換而來
// ========================================

const sheets = require('./sheets');
const {
  SHEETS_ID, GITHUB_PAGES_URL, DEFAULT_LINE_COUPON_URL,
  COMMISSION_RATES, FIRST_REFERRAL_BONUS, LEVEL_REQUIREMENTS, DataModels
} = require('./config');

// 調用深度追蹤
let CALL_DEPTH = 0;
const MAX_CALL_DEPTH = 5;

// ========================================
// SheetDataModel — 動態欄位映射（async 版）
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
// 通用數據訪問函數（async）
// ========================================

async function getDataModel(sheetName) {
  const headers = await sheets.getHeaders(sheetName);
  if (!headers || headers.length === 0) {
    throw new Error(`Sheet ${sheetName} not found or empty`);
  }
  return new SheetDataModel(headers);
}

async function findRecordsByField(sheetName, fieldName, value) {
  const values = await sheets.getSheetData(sheetName);
  if (!values || values.length < 2) return [];

  const dataModel = new SheetDataModel(values[0]);
  const results = [];

  for (let i = 1; i < values.length; i++) {
    const fieldValue = dataModel.getFieldValue(values[i], fieldName);
    if (fieldValue == value) {
      results.push({
        rowIndex: i + 1,
        data: dataModel.rowToObject(values[i])
      });
    }
  }
  return results;
}

async function findRecordById(sheetName, id) {
  const results = await findRecordsByField(sheetName, 'id', id);
  return results.length > 0 ? results[0] : null;
}

async function updateRecord(sheetName, id, updates) {
  console.log(`--- updateRecord: ${sheetName}, ID=${id} ---`);

  const values = await sheets.getSheetData(sheetName);
  if (!values || values.length < 2) throw new Error(`Sheet ${sheetName} not found or empty`);

  const dataModel = new SheetDataModel(values[0]);

  // Partners 表使用 partner_code 作為主鍵
  let record;
  if (sheetName === 'Partners') {
    const results = await findRecordsByField(sheetName, 'partner_code', id);
    record = results.length > 0 ? results[0] : null;
  } else {
    record = await findRecordById(sheetName, id);
    if (!record && sheetName === 'Payouts') {
      const results = await findRecordsByField(sheetName, 'ID', id);
      record = results.length > 0 ? results[0] : null;
    }
  }

  if (!record) {
    throw new Error(`Record with ID ${id} not found in ${sheetName}`);
  }

  const updatedData = Object.assign({}, record.data, updates, {
    updated_at: new Date().toISOString()
  });

  const row = dataModel.objectToRow(updatedData);
  await sheets.updateRow(sheetName, record.rowIndex, row);

  console.log(`Updated record in ${sheetName}: ID=${id}`);
  return updatedData;
}

async function createRecord(sheetName, data) {
  const values = await sheets.getSheetData(sheetName);
  if (!values || values.length === 0) throw new Error(`Sheet ${sheetName} not found or empty`);

  const dataModel = new SheetDataModel(values[0]);
  const timestamp = new Date().toISOString();

  data.created_at = data.created_at || timestamp;
  data.updated_at = data.updated_at || timestamp;

  if ((dataModel.hasField('id') || dataModel.hasField('ID')) && !data.id && !data.ID) {
    const newId = generateNextIdFromValues(values, dataModel);
    if (dataModel.hasField('ID')) {
      data.ID = newId;
    } else {
      data.id = newId;
    }
  }

  const row = dataModel.objectToRow(data);
  await sheets.appendRow(sheetName, row);

  console.log(`Created new record in ${sheetName}: id=${data.id || data.ID}`);
  return data;
}

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
// 輔助函數
// ========================================

async function findPartnerByCode(partnerCode) {
  const results = await findRecordsByField('Partners', 'partner_code', partnerCode);
  if (results.length > 0) {
    const partner = results[0].data;
    partner.partner_name = partner.partner_name || partner.name;
    partner.partner_level = partner.partner_level || partner.level;
    partner.contact_phone = partner.contact_phone || partner.phone;
    partner.contact_email = partner.contact_email || partner.email;
    partner.successful_referrals = partner.successful_referrals || partner.total_successful_referrals || 0;
    partner.available_points = partner.available_points !== undefined ? partner.available_points : 0;
    partner.points_used = partner.points_used !== undefined ? partner.points_used : 0;
    return partner;
  }
  return null;
}

async function findPartnerByCodeCaseInsensitive(code) {
  let partner = await findPartnerByCode(code);
  if (!partner) partner = await findPartnerByCode(code.toLowerCase());
  if (!partner) partner = await findPartnerByCode(code.toUpperCase());
  return partner;
}

async function findRecordsByGuestInfo(guestName, guestPhone, checkinDate) {
  const values = await sheets.getSheetData('Bookings');
  if (!values || values.length < 2) return [];

  const dataModel = new SheetDataModel(values[0]);
  const results = [];

  for (let i = 1; i < values.length; i++) {
    const name = dataModel.getFieldValue(values[i], 'guest_name');
    const phone = dataModel.getFieldValue(values[i], 'guest_phone');

    if (name === guestName && String(phone) === String(guestPhone)) {
      if (checkinDate) {
        const bookingCheckin = dataModel.getFieldValue(values[i], 'checkin_date');
        if (formatDate(bookingCheckin) !== formatDate(checkinDate)) continue;
      }
      results.push({
        rowIndex: i + 1,
        data: dataModel.rowToObject(values[i])
      });
    }
  }
  return results;
}

async function updatePartnerReferralStats(partnerCode, increment) {
  const partner = await findPartnerByCode(partnerCode);
  if (!partner) {
    console.log(`Partner ${partnerCode} not found`);
    return;
  }
  await updateRecord('Partners', partner.partner_code, {
    total_referrals: (partner.total_referrals || 0) + increment
  });
}

async function updatePartnerAfterCheckin(partner, commissionAmount, commissionType) {
  const updates = {
    successful_referrals: (partner.successful_referrals || 0) + 1,
    yearly_referrals: (partner.yearly_referrals || 0) + 1,
    total_commission_earned: (partner.total_commission_earned || 0) + commissionAmount
  };

  if (commissionType === 'ACCOMMODATION') {
    updates.available_points = (partner.available_points || 0) + commissionAmount;
  } else if (commissionType === 'CASH') {
    updates.pending_commission = (partner.pending_commission || 0) + commissionAmount;
  }

  const newLevel = checkLevelUpgrade(updates.yearly_referrals);
  if (newLevel !== partner.partner_level) {
    updates.partner_level = newLevel;
    console.log(`Partner ${partner.partner_code} upgraded to ${newLevel}`);
  }

  await updateRecord('Partners', partner.partner_code, updates);
}

function calculateCommission(partner) {
  const level = partner.partner_level || 'LV1_INSIDER';
  const preference = partner.commission_preference || 'ACCOMMODATION';
  const rates = COMMISSION_RATES[level];

  if (!rates) return { amount: 0, type: 'NONE', isFirstBonus: false, firstBonusAmount: 0 };

  const baseAmount = rates[preference.toLowerCase()] || 0;
  const isFirstBonus = (level === 'LV1_INSIDER' &&
    (partner.successful_referrals || 0) === 0 &&
    preference.toUpperCase() === 'ACCOMMODATION');
  const firstBonusAmount = isFirstBonus ? FIRST_REFERRAL_BONUS : 0;

  return {
    amount: baseAmount + firstBonusAmount,
    type: preference,
    isFirstBonus,
    firstBonusAmount
  };
}

function checkLevelUpgrade(yearlyReferrals) {
  if (yearlyReferrals >= LEVEL_REQUIREMENTS.LV3_GUARDIAN) return 'LV3_GUARDIAN';
  if (yearlyReferrals >= LEVEL_REQUIREMENTS.LV2_GUIDE) return 'LV2_GUIDE';
  return 'LV1_INSIDER';
}

async function createPayoutRecord(partnerCode, amount, bookingId, type) {
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

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toISOString().split('T')[0];
}

function maskName(name) {
  if (!name || typeof name !== 'string') return '***';
  if (name.length <= 1) return name + '**';
  return name.charAt(0) + '**';
}

function extractDeductAmount(notes) {
  if (!notes) return 0;
  const match = notes.match(/折抵\s*NT\$?\s*(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function analyzeBookingChanges(oldBooking, newData) {
  const changes = {
    hasPartnerChange: false,
    hasPriceChange: false,
    hasStatusChange: false,
    hasMonetaryImpact: false,
    hasStatisticalImpact: false
  };

  if (newData.partner_code !== undefined && newData.partner_code !== oldBooking.partner_code) {
    changes.hasPartnerChange = true;
    changes.hasStatisticalImpact = true;
    if (oldBooking.stay_status === 'COMPLETED') changes.hasMonetaryImpact = true;
  }

  if (newData.room_price !== undefined && parseFloat(newData.room_price) !== parseFloat(oldBooking.room_price)) {
    changes.hasPriceChange = true;
    if (oldBooking.commission_status === 'CALCULATED') changes.hasMonetaryImpact = true;
  }

  if (newData.stay_status !== undefined && newData.stay_status !== oldBooking.stay_status) {
    changes.hasStatusChange = true;
    changes.hasMonetaryImpact = true;
    changes.hasStatisticalImpact = true;
  }

  return changes;
}

function calculateCommissionForLevel(level, commissionType, roomPrice, includeFirstReferral) {
  const rates = {
    'LV1_INSIDER': { ACCOMMODATION: 1000, CASH: 500 },
    'LV2_GUIDE': { ACCOMMODATION: 1200, CASH: 600 },
    'LV3_GUARDIAN': { ACCOMMODATION: 1500, CASH: 750 }
  };
  let commission = rates[level][commissionType] || 0;
  if (includeFirstReferral && commissionType === 'ACCOMMODATION') commission += 1500;
  return commission;
}

// ========================================
// 業務邏輯處理函數
// ========================================

async function handleCreateBooking(data) {
  let bookingSource = 'DIRECT';
  if (data.booking_source === 'SELF_USE') bookingSource = 'SELF_USE';
  else if (data.partner_code) bookingSource = 'REFERRAL';

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

  const booking = await createRecord('Bookings', bookingData);

  if (data.partner_code && bookingSource !== 'SELF_USE') {
    await updatePartnerReferralStats(data.partner_code, 1);
  }

  return { success: true, message: '訂房記錄建立成功', booking_id: booking.id };
}

async function handleConfirmCheckinCompletion(data) {
  let booking = null;

  if (data.booking_id) {
    const result = await findRecordById('Bookings', data.booking_id);
    if (result) booking = result.data;
  }

  if (!booking && data.guest_name && data.guest_phone) {
    const results = await findRecordsByGuestInfo(data.guest_name, data.guest_phone, data.checkin_date);
    if (results.length > 0) booking = results[0].data;
  }

  if (!booking) throw new Error('找不到訂房記錄');
  if (booking.stay_status === 'CANCELLED') throw new Error('此訂單已取消，無法確認入住。');
  if (booking.stay_status === 'COMPLETED') {
    return { success: true, message: '該訂房已經確認過了', booking_id: booking.id };
  }

  let commissionAmount = 0, commissionType = 'ACCOMMODATION', isFirstBonus = false, firstBonusAmount = 0;

  if (booking.partner_code && booking.booking_source !== 'SELF_USE') {
    const partner = await findPartnerByCode(booking.partner_code);
    if (partner) {
      const commission = calculateCommission(partner);
      commissionAmount = commission.amount;
      commissionType = commission.type;
      isFirstBonus = commission.isFirstBonus;
      firstBonusAmount = commission.firstBonusAmount;
      await updatePartnerAfterCheckin(partner, commissionAmount, commissionType);
      await createPayoutRecord(partner.partner_code, commissionAmount, booking.id, commissionType);
    }
  }

  await updateRecord('Bookings', booking.id, {
    stay_status: 'COMPLETED',
    commission_status: commissionAmount > 0 ? 'CALCULATED' : 'NOT_ELIGIBLE',
    commission_amount: commissionAmount,
    commission_type: commissionType,
    is_first_referral_bonus: isFirstBonus,
    first_referral_bonus_amount: firstBonusAmount,
    manually_confirmed_by: data.confirmed_by || 'system',
    manually_confirmed_at: new Date().toISOString()
  });

  return { success: true, message: '入住確認成功', booking_id: booking.id, commission_amount: commissionAmount };
}

async function handleUseAccommodationPoints(data) {
  const partnerCode = data.partner_code;
  const deductAmount = parseFloat(data.deduct_amount || 0);
  const checkinDate = data.checkin_date || data.usage_date || new Date().toISOString();

  if (!partnerCode || deductAmount <= 0) throw new Error('參數無效');

  const partner = await findPartnerByCode(partnerCode);
  if (!partner) throw new Error('找不到大使資料');

  const currentPoints = Math.max(0, parseFloat(partner.available_points) || 0);
  if (currentPoints < deductAmount) throw new Error(`點數不足。可用：${currentPoints}，需要：${deductAmount}`);

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

  const booking = await createRecord('Bookings', bookingData);

  const newAvailablePoints = currentPoints - deductAmount;
  const newPointsUsed = (parseFloat(partner.points_used) || 0) + deductAmount;

  await updateRecord('Partners', partner.partner_code, {
    available_points: newAvailablePoints,
    points_used: newPointsUsed
  });

  await createRecord('Accommodation_Usage', {
    partner_code: partnerCode,
    deduct_amount: deductAmount,
    related_booking_id: booking.id,
    usage_date: checkinDate,
    usage_type: 'ROOM_DISCOUNT',
    notes: data.notes || '住宿金折抵',
    created_by: 'system'
  });

  await createRecord('Payouts', {
    partner_code: partnerCode,
    payout_type: 'POINTS_ADJUSTMENT_DEBIT',
    amount: -deductAmount,
    related_booking_ids: booking.id.toString(),
    payout_method: 'POINTS_ADJUSTMENT',
    payout_status: 'COMPLETED',
    notes: `住宿金折抵 - 訂房 #${booking.id}`,
    created_by: 'system'
  });

  return { success: true, message: `成功使用 ${deductAmount} 點住宿金`, booking_id: booking.id };
}

async function handleGetAllData() {
  const data = {};
  const sheetNames = ['Bookings', 'Partners', 'Payouts', 'Accommodation_Usage', 'Clicks'];

  for (const sheetName of sheetNames) {
    try {
      const values = await sheets.getSheetData(sheetName);
      if (values && values.length > 1) {
        const dataModel = new SheetDataModel(values[0]);
        const records = [];
        for (let i = 1; i < values.length; i++) {
          records.push(dataModel.rowToObject(values[i]));
        }
        data[sheetName.toLowerCase()] = records;
      } else {
        data[sheetName.toLowerCase()] = [];
      }
    } catch (err) {
      console.error(`[handleGetAllData] Error reading ${sheetName}:`, err.message);
      data[sheetName.toLowerCase()] = [];
    }
  }

  return { success: true, data };
}

async function handleUpdateBooking(data) {
  CALL_DEPTH++;
  if (CALL_DEPTH > MAX_CALL_DEPTH) {
    CALL_DEPTH = 0;
    throw new Error('Maximum call depth exceeded');
  }

  try {
    const bookingId = data.booking_id || data.id;
    if (!bookingId) throw new Error('Booking ID is required');

    const oldBookingResult = await findRecordById('Bookings', bookingId);
    if (!oldBookingResult) throw new Error('Booking not found');
    const oldBooking = oldBookingResult.data;

    delete data.action; delete data.booking_id; delete data.id;
    delete data.created_at; delete data._internal_call;

    const changes = analyzeBookingChanges(oldBooking, data);

    if (changes.hasPartnerChange) await handlePartnerChange(oldBooking, data);
    if (changes.hasPriceChange && oldBooking.commission_status === 'CALCULATED') {
      handlePriceChange(oldBooking, data);
    }
    if (changes.hasStatusChange) return await handleStatusChange(oldBooking, data, bookingId);

    const updated = await updateRecord('Bookings', bookingId, data);
    return { success: true, message: 'Booking updated successfully', data: updated, changes };
  } finally {
    CALL_DEPTH = Math.max(0, CALL_DEPTH - 1);
  }
}

async function handlePartnerChange(oldBooking, newData) {
  const oldPartnerCode = oldBooking.partner_code;
  const newPartnerCode = newData.partner_code;

  if (oldBooking.stay_status !== 'COMPLETED') {
    if (oldPartnerCode) await updatePartnerReferralStats(oldPartnerCode, -1);
    if (newPartnerCode) await updatePartnerReferralStats(newPartnerCode, 1);
    return;
  }

  if (oldBooking.commission_amount > 0 && oldPartnerCode) {
    const oldPartner = await findPartnerByCode(oldPartnerCode);
    if (oldPartner) {
      const commissionAmount = parseFloat(oldBooking.commission_amount);
      const oldPartnerUpdates = {
        successful_referrals: Math.max(0, (oldPartner.successful_referrals || 0) - 1),
        yearly_referrals: Math.max(0, (oldPartner.yearly_referrals || 0) - 1),
        total_commission_earned: Math.max(0, (oldPartner.total_commission_earned || 0) - commissionAmount)
      };

      if (oldBooking.commission_type === 'ACCOMMODATION') {
        oldPartnerUpdates.available_points = Math.max(0, (oldPartner.available_points || 0) - commissionAmount);
      } else {
        oldPartnerUpdates.pending_commission = Math.max(0, (oldPartner.pending_commission || 0) - commissionAmount);
      }

      await updateRecord('Partners', oldPartnerCode, oldPartnerUpdates);
      await createRecord('Payouts', {
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

  if (newPartnerCode && oldBooking.stay_status === 'COMPLETED') {
    const newPartner = await findPartnerByCode(newPartnerCode);
    if (newPartner) {
      const commission = calculateCommission(newPartner);
      await updatePartnerAfterCheckin(newPartner, commission.amount, commission.type);
      await createPayoutRecord(newPartnerCode, commission.amount, oldBooking.id, commission.type);
      newData.commission_amount = commission.amount;
      newData.commission_type = commission.type;
      newData.is_first_referral_bonus = commission.isFirstBonus;
      newData.first_referral_bonus_amount = commission.firstBonusAmount;
    }
  } else if (newPartnerCode) {
    newData.commission_status = 'PENDING';
  }
}

function handlePriceChange(oldBooking, newData) {
  console.log(`Room price changed, but commission remains fixed`);
}

async function handleStatusChange(oldBooking, newData, bookingId) {
  const oldStatus = oldBooking.stay_status;
  const newStatus = newData.stay_status;
  const isFromInternalCall = newData._internal_call || false;

  if (oldStatus === 'PENDING' && newStatus === 'COMPLETED' && !isFromInternalCall) {
    return await handleConfirmCheckinCompletion({
      booking_id: bookingId, confirmed_by: 'status_update', _internal_call: true
    });
  }

  if (oldStatus === 'COMPLETED' && newStatus === 'CANCELLED' && !isFromInternalCall) {
    return await handleDeleteBooking({
      booking_id: bookingId, _internal_call: true
    });
  }

  if (oldStatus === 'CANCELLED' && newStatus === 'PENDING') {
    newData.commission_status = oldBooking.partner_code ? 'PENDING' : 'NOT_ELIGIBLE';
    newData.commission_amount = 0;
    newData.manually_confirmed_at = '';
    newData.manually_confirmed_by = '';
    if (oldBooking.partner_code) await updatePartnerReferralStats(oldBooking.partner_code, 1);
  }

  const updated = await updateRecord('Bookings', bookingId, newData);
  return { success: true, message: `Booking status changed from ${oldStatus} to ${newStatus}`, data: updated };
}

async function handleDeleteBooking(data) {
  const bookingId = data.booking_id || data.id;
  if (!bookingId) throw new Error('Booking ID is required');

  const booking = await findRecordById('Bookings', bookingId);
  if (!booking) throw new Error('Booking not found');

  if (booking.data.booking_source === 'SELF_USE' && booking.data.partner_code) {
    const partner = await findPartnerByCode(booking.data.partner_code);
    if (partner) {
      const deductAmount = extractDeductAmount(booking.data.notes);
      if (deductAmount > 0) {
        await updateRecord('Partners', partner.partner_code, {
          available_points: (partner.available_points || 0) + deductAmount,
          points_used: Math.max(0, (partner.points_used || 0) - deductAmount)
        });
        await createRecord('Payouts', {
          partner_code: partner.partner_code,
          payout_type: 'POINTS_REFUND',
          amount: deductAmount,
          related_booking_ids: bookingId,
          payout_method: 'ACCOMMODATION_REFUND',
          payout_status: 'COMPLETED',
          notes: `取消訂單 ${bookingId}，返還住宿金 NT$ ${deductAmount}`,
          created_by: 'system'
        });
      }
    }
  } else if (booking.data.booking_source === 'REFERRAL' && booking.data.partner_code) {
    const partner = await findPartnerByCode(booking.data.partner_code);
    if (partner) {
      const partnerUpdates = {
        total_referrals: Math.max(0, (partner.total_referrals || 0) - 1)
      };

      if (booking.data.stay_status === 'COMPLETED' && booking.data.commission_amount > 0) {
        const commissionAmount = parseFloat(booking.data.commission_amount);
        partnerUpdates.successful_referrals = Math.max(0, (partner.successful_referrals || 0) - 1);
        partnerUpdates.yearly_referrals = Math.max(0, (partner.yearly_referrals || 0) - 1);
        partnerUpdates.total_commission_earned = Math.max(0, (partner.total_commission_earned || 0) - commissionAmount);

        if (booking.data.commission_type === 'ACCOMMODATION') {
          partnerUpdates.available_points = Math.max(0, (partner.available_points || 0) - commissionAmount);
        } else if (booking.data.commission_type === 'CASH') {
          partnerUpdates.pending_commission = Math.max(0, (partner.pending_commission || 0) - commissionAmount);
        }

        const newLevel = checkLevelUpgrade(partnerUpdates.yearly_referrals);
        if (newLevel !== partner.partner_level) partnerUpdates.partner_level = newLevel;

        await createRecord('Payouts', {
          partner_code: partner.partner_code,
          payout_type: 'COMMISSION_REVERSAL',
          amount: -commissionAmount,
          related_booking_ids: bookingId,
          payout_method: 'OTHER',
          payout_status: 'COMPLETED',
          notes: `取消訂單 ${bookingId}，撤銷佣金 NT$ ${commissionAmount}`,
          created_by: 'system'
        });
      }

      await updateRecord('Partners', partner.partner_code, partnerUpdates);
    }
  }

  const cancelData = {
    stay_status: 'CANCELLED',
    commission_status: 'CANCELLED',
    notes: (booking.data.notes || '') + `\n[取消於 ${new Date().toISOString()}] ${data.reason || ''}`
  };

  const cancelled = await updateRecord('Bookings', bookingId, cancelData);
  return { success: true, message: 'Booking cancelled successfully', data: cancelled };
}

async function handleUpdatePayout(data) {
  const payoutId = data.payout_id || data.id;
  if (!payoutId) throw new Error('Payout ID is required');

  delete data.action; delete data.payout_id; delete data.id; delete data.created_at;
  const updated = await updateRecord('Payouts', payoutId, data);
  return { success: true, message: 'Payout updated successfully', data: updated };
}

async function handleCancelPayout(data) {
  const payoutId = data.payout_id || data.id;
  if (!payoutId) throw new Error('Payout ID is required');

  let payoutResults = await findRecordsByField('Payouts', 'id', payoutId);
  if (payoutResults.length === 0) payoutResults = await findRecordsByField('Payouts', 'ID', payoutId);
  if (payoutResults.length === 0) throw new Error(`Payout not found: ${payoutId}`);

  const payout = payoutResults[0].data;
  if (payout.payout_status === 'CANCELLED') {
    return { success: false, error: 'Payout already cancelled' };
  }

  if (['ACCOMMODATION', 'CASH', 'FIRST_REFERRAL_BONUS'].includes(payout.payout_type)) {
    const partner = await findPartnerByCode(payout.partner_code);
    if (partner) {
      const currentSuccessful = parseInt(partner.successful_referrals || 0);
      const currentYearly = parseInt(partner.yearly_referrals || 0);
      const currentAvailablePoints = parseInt(partner.available_points || 0);
      const currentPendingCommission = parseFloat(partner.pending_commission || 0);

      const tempSuccessful = Math.max(0, currentSuccessful - 1);
      const tempYearly = Math.max(0, currentYearly - 1);
      let tempLevel = 'LV1_INSIDER';
      if (tempYearly >= 10) tempLevel = 'LV3_GUARDIAN';
      else if (tempYearly >= 4) tempLevel = 'LV2_GUIDE';

      const ACCOMMODATION_RATES = { 'LV1_INSIDER': 1000, 'LV2_GUIDE': 1200, 'LV3_GUARDIAN': 1500 };
      let commissionToDeduct = ACCOMMODATION_RATES[tempLevel] || 1000;
      if (tempLevel === 'LV1_INSIDER' && tempSuccessful === 0) commissionToDeduct += 1500;

      const partnerUpdates = {
        successful_referrals: tempSuccessful,
        yearly_referrals: tempYearly,
        partner_level: tempLevel,
        total_commission_earned: Math.max(0, (partner.total_commission_earned || 0) - commissionToDeduct)
      };

      let remaining = commissionToDeduct;
      let pointsDeducted = 0;

      if (currentAvailablePoints > 0) {
        if (currentAvailablePoints >= remaining) {
          pointsDeducted = remaining;
          partnerUpdates.available_points = currentAvailablePoints - remaining;
          remaining = 0;
        } else {
          pointsDeducted = currentAvailablePoints;
          partnerUpdates.available_points = 0;
          remaining = commissionToDeduct - currentAvailablePoints;
        }
      }

      if (remaining > 0 && currentPendingCommission > 0) {
        const cashNeeded = remaining * 0.5;
        if (currentPendingCommission >= cashNeeded) {
          partnerUpdates.pending_commission = currentPendingCommission - cashNeeded;
          remaining = 0;
        } else {
          partnerUpdates.pending_commission = 0;
          remaining = (cashNeeded - currentPendingCommission) * 2;
        }
      }

      if (remaining > 0) {
        partnerUpdates.notes = (partner.notes || '') +
          `\n[${new Date().toISOString()}] 取消結算 #${payoutId} 產生負債 ${remaining} 點`;
        await createRecord('Payouts', {
          partner_code: payout.partner_code,
          payout_type: 'DEBT_RECORD',
          amount: -remaining,
          related_booking_ids: payout.related_booking_ids || '',
          payout_method: 'OTHER',
          payout_status: 'PENDING',
          notes: `取消結算 #${payoutId} 產生的負債`,
          created_by: 'SYSTEM'
        });
      }

      await updateRecord('Partners', partner.partner_code, partnerUpdates);
      await createRecord('Payouts', {
        partner_code: payout.partner_code,
        payout_type: 'COMMISSION_REVERSAL',
        amount: -commissionToDeduct,
        related_booking_ids: payout.related_booking_ids || '',
        payout_method: 'OTHER',
        payout_status: 'COMPLETED',
        notes: `智慧撤銷 Payout #${payoutId}`,
        created_by: 'SYSTEM'
      });
    }
  }

  const updated = await updateRecord('Payouts', payoutId, {
    payout_status: 'CANCELLED',
    notes: (payout.notes || '') + ` [取消於 ${new Date().toISOString()}] ${data.reason || ''}`
  });

  return { success: true, message: 'Smart payout cancellation completed', data: updated };
}

async function handleProcessPayout(data) {
  const partnerCode = data.partner_code;
  const payAmount = parseFloat(data.amount || 0);
  if (!partnerCode) throw new Error('Partner code is required');

  const partner = await findPartnerByCode(partnerCode);
  if (!partner) throw new Error('Partner not found');

  const actualPayAmount = payAmount > 0 ? payAmount : (partner.pending_commission || 0);
  if (actualPayAmount <= 0) throw new Error('No pending commission to pay');

  const payout = await createRecord('Payouts', {
    partner_code: partnerCode,
    payout_type: 'PAYMENT_COMPLETED',
    amount: actualPayAmount,
    payout_method: 'BANK_TRANSFER',
    payout_status: 'COMPLETED',
    bank_transfer_date: data.bank_transfer_date || new Date().toISOString().split('T')[0],
    bank_transfer_reference: data.bank_transfer_reference || '',
    notes: data.notes || `銀行匯款 NT$ ${actualPayAmount}`,
    created_by: data.created_by || 'admin'
  });

  const partnerUpdates = {
    pending_commission: Math.max(0, (partner.pending_commission || 0) - actualPayAmount),
    total_commission_paid: (partner.total_commission_paid || 0) + actualPayAmount
  };
  await updateRecord('Partners', partner.partner_code, partnerUpdates);

  return {
    success: true,
    message: `Payment completed. Paid NT$ ${actualPayAmount}`,
    payout_id: payout.id,
    data: { payout, remaining_pending: partnerUpdates.pending_commission }
  };
}

async function handleUpdatePartnerCommission(data) {
  const partnerCode = data.partner_code;
  if (!partnerCode) throw new Error('Partner code is required');

  const partner = await findPartnerByCode(partnerCode);
  if (!partner) throw new Error('Partner not found');

  const updates = {};
  let adjustmentAmount = 0;
  let adjustmentType = 'MANUAL_ADJUSTMENT';

  if (data.total_commission_earned !== undefined) {
    const newValue = parseFloat(data.total_commission_earned);
    const diff = newValue - (partner.total_commission_earned || 0);
    if (diff !== 0) { adjustmentAmount = diff; updates.total_commission_earned = newValue; }
  }
  if (data.pending_commission !== undefined) {
    const newValue = Math.max(0, parseFloat(data.pending_commission));
    const diff = newValue - (partner.pending_commission || 0);
    if (diff !== 0) { adjustmentAmount = diff; adjustmentType = 'CASH_ADJUSTMENT'; updates.pending_commission = newValue; }
  }
  if (data.available_points !== undefined) {
    const newValue = Math.max(0, parseFloat(data.available_points));
    const diff = newValue - (partner.available_points || 0);
    if (diff !== 0) { adjustmentAmount = diff; adjustmentType = 'POINTS_ADJUSTMENT'; updates.available_points = newValue; }
  }
  if (data.points_used !== undefined) updates.points_used = parseFloat(data.points_used);
  if (data.successful_referrals !== undefined) updates.successful_referrals = parseInt(data.successful_referrals);
  if (data.yearly_referrals !== undefined) updates.yearly_referrals = parseInt(data.yearly_referrals);

  const updated = await updateRecord('Partners', partnerCode, updates);

  if ((data.adjustment_reason || adjustmentAmount !== 0) && adjustmentAmount !== undefined) {
    await createRecord('Payouts', {
      partner_code: partnerCode,
      payout_type: adjustmentType,
      amount: adjustmentAmount,
      payout_method: 'MANUAL_ADJUSTMENT',
      payout_status: 'COMPLETED',
      notes: data.adjustment_reason || `手動調整 ${adjustmentAmount > 0 ? '增加' : '減少'} NT$ ${Math.abs(adjustmentAmount)}`,
      created_by: data.created_by || 'admin'
    });
  }

  return {
    success: true, message: 'Partner commission updated successfully', data: updated,
    adjustment: adjustmentAmount !== 0 ? { type: adjustmentType, amount: adjustmentAmount } : null
  };
}

async function handleUpdatePartner(data) {
  const partnerCode = data.partner_code;
  if (!partnerCode) throw new Error('Partner code is required');

  const partner = await findPartnerByCode(partnerCode);
  if (!partner) throw new Error('Partner not found');

  delete data.action; delete data.partner_code; delete data.created_at;

  const oldLevel = partner.partner_level;
  const oldPreference = partner.commission_preference;

  if (data.partner_level && data.partner_level !== oldLevel) {
    await createRecord('Payouts', {
      partner_code: partnerCode,
      payout_type: 'LEVEL_ADJUSTMENT',
      amount: 0,
      payout_method: 'OTHER',
      payout_status: 'COMPLETED',
      notes: `等級調整：${oldLevel} → ${data.partner_level}`,
      created_by: data.updated_by || 'admin'
    });
  }

  const updated = await updateRecord('Partners', partnerCode, data);

  return {
    success: true, message: 'Partner updated successfully', data: updated,
    changes: {
      levelChanged: data.partner_level && data.partner_level !== oldLevel,
      preferenceChanged: data.commission_preference && data.commission_preference !== oldPreference
    }
  };
}

async function handleConvertPointsToCash(data) {
  const partnerCode = data.partner_code;
  const convertAmount = parseFloat(data.points_used || data.amount || 0);
  const EXCHANGE_RATE = 0.5;

  if (!partnerCode || convertAmount <= 0) throw new Error('參數無效');

  const partner = await findPartnerByCode(partnerCode);
  if (!partner) throw new Error('找不到大使: ' + partnerCode);

  const currentPoints = parseFloat(partner.available_points) || 0;
  if (currentPoints < convertAmount) throw new Error(`點數不足。可用：${currentPoints}，需要：${convertAmount}`);

  const cashAmount = Math.floor(convertAmount * EXCHANGE_RATE);
  const newAvailablePoints = currentPoints - convertAmount;
  const newPointsUsed = (parseFloat(partner.points_used) || 0) + convertAmount;
  const newPendingCommission = (parseFloat(partner.pending_commission) || 0) + cashAmount;

  await updateRecord('Partners', partnerCode, {
    available_points: newAvailablePoints,
    points_used: newPointsUsed,
    pending_commission: newPendingCommission
  });

  await createRecord('Payouts', {
    partner_code: partnerCode,
    payout_type: 'CASH_CONVERSION',
    amount: cashAmount,
    payout_method: 'POINTS_CONVERSION',
    payout_status: 'PENDING',
    notes: data.notes || `點數轉現金：${convertAmount} 點 → NT$ ${cashAmount} (2:1)`,
    created_by: 'system'
  });

  return {
    success: true, message: `成功轉換 ${convertAmount} 點為 NT$ ${cashAmount}`,
    data: { points_converted: convertAmount, cash_amount: cashAmount }
  };
}

async function handleCreatePayout(data) {
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

  if (!payoutData.partner_code) throw new Error('Partner code is required');
  if (payoutData.amount <= 0) throw new Error('Amount must be greater than 0');

  const partner = await findPartnerByCode(payoutData.partner_code);
  if (!partner) throw new Error('Partner not found');

  const payout = await createRecord('Payouts', payoutData);

  if (payoutData.payout_status === 'PENDING' && payoutData.payout_type !== 'POINTS_REFUND') {
    const currentPending = parseFloat(partner.pending_commission || 0);
    await updateRecord('Partners', partner.partner_code, {
      pending_commission: Math.max(0, currentPending - payoutData.amount)
    });
  }

  return { success: true, message: 'Payout created successfully', payout_id: payout.id, data: payout };
}

async function handleCreatePartner(data) {
  const partnerData = {
    partner_code: data.partner_code,
    name: data.partner_name || data.name || '',
    partner_name: data.partner_name || data.name || '',
    level: data.partner_level || data.level || 'LV1_INSIDER',
    partner_level: data.partner_level || data.level || 'LV1_INSIDER',
    phone: data.contact_phone || data.phone || '',
    contact_phone: data.contact_phone || data.phone || '',
    email: data.contact_email || data.email || '',
    contact_email: data.contact_email || data.email || '',
    bank_code: data.bank_code || '',
    bank_account: data.bank_account || data.bank_account_number || '',
    bank_name: data.bank_name || '',
    bank_branch: data.bank_branch || '',
    bank_account_name: data.bank_account_name || '',
    commission_preference: data.commission_preference || 'ACCOMMODATION',
    total_referrals: parseInt(data.total_referrals) || 0,
    successful_referrals: parseInt(data.successful_referrals) || parseInt(data.total_successful_referrals) || 0,
    total_successful_referrals: parseInt(data.successful_referrals) || parseInt(data.total_successful_referrals) || 0,
    yearly_referrals: parseInt(data.yearly_referrals) || 0,
    level_progress: parseInt(data.level_progress) || 0,
    total_commission_earned: parseFloat(data.total_commission_earned) || 0,
    total_commission_paid: parseFloat(data.total_commission_paid) || 0,
    available_points: data.available_points !== undefined ? parseFloat(data.available_points) : 0,
    points_used: parseFloat(data.points_used) || 0,
    pending_commission: parseFloat(data.pending_commission) || 0,
    line_coupon_url: data.line_coupon_url || data.coupon_url || '',
    coupon_code: data.coupon_code || '',
    coupon_url: data.coupon_url || '',
    landing_link: data.landing_link || '',
    coupon_link: data.coupon_link || '',
    short_landing_link: data.short_landing_link || '',
    short_coupon_link: data.short_coupon_link || '',
    join_date: data.join_date || new Date().toISOString(),
    is_active: data.is_active !== false,
    notes: data.notes || '',
    total_clicks: 0,
    last_click_date: null
  };

  if (!partnerData.partner_code) throw new Error('Partner code is required');
  if (!partnerData.partner_name) throw new Error('Partner name is required');
  if (!partnerData.contact_phone) throw new Error('Contact phone is required');

  const existing = await findPartnerByCode(partnerData.partner_code);
  if (existing) throw new Error('Partner code already exists');

  const partner = await createRecord('Partners', partnerData);
  return { success: true, message: 'Partner created successfully', partner_code: partner.partner_code, data: partner };
}

// ========================================
// 點擊追蹤與重導向
// ========================================

async function handleRedirect(req, res) {
  const params = req.query || {};
  const destination = params.dest || 'landing';
  const subid = params.pid || params.subid || '';

  // 非同步記錄點擊（不等待完成）
  recordClick(params).catch(err => console.error('recordClick error:', err));

  let redirectUrl;
  if (destination === 'coupon') {
    const targetUrl = params.target;
    if (targetUrl) {
      redirectUrl = decodeURIComponent(targetUrl);
    } else {
      const partner = subid ? await findPartnerByCode(subid) : null;
      redirectUrl = (partner && partner.line_coupon_url) ? partner.line_coupon_url : DEFAULT_LINE_COUPON_URL;
    }
  } else {
    if (req.url && req.url.includes('?')) {
      const queryString = req.url.split('?')[1];
      redirectUrl = GITHUB_PAGES_URL + '?' + queryString;
    } else if (subid) {
      redirectUrl = GITHUB_PAGES_URL + `?subid=${encodeURIComponent(subid)}`;
      if (params.coupon_url) redirectUrl += `&coupon_url=${encodeURIComponent(params.coupon_url)}`;
    } else {
      redirectUrl = GITHUB_PAGES_URL;
    }
  }

  return res.redirect(302, redirectUrl);
}

async function recordClick(params) {
  const clicksExists = await sheets.sheetExists('Clicks');
  if (!clicksExists) {
    const clickHeaders = ['id', 'partner_code', 'destination', 'utm_source', 'utm_medium',
      'utm_campaign', 'referrer', 'user_agent', 'ip_address', 'click_time', 'created_at'];
    await sheets.createSheet('Clicks', clickHeaders);
  }

  const clickData = {
    partner_code: params.pid || params.subid || null,
    destination: params.dest || 'landing',
    utm_source: params.utm_source || null,
    utm_medium: params.utm_medium || null,
    utm_campaign: params.utm_campaign || null,
    referrer: params.referrer || 'Direct',
    user_agent: params.userAgent || 'Unknown',
    ip_address: null,
    click_time: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  await createRecord('Clicks', clickData);

  if (clickData.partner_code) {
    await updatePartnerClickStats(clickData.partner_code);
  }
}

async function updatePartnerClickStats(partnerCode) {
  try {
    const partner = await findPartnerByCode(partnerCode);
    if (partner) {
      await updateRecord('Partners', partnerCode, {
        total_clicks: (partner.total_clicks || 0) + 1,
        last_click_date: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('updatePartnerClickStats error:', err);
  }
}

async function handleGetClickStats(params) {
  try {
    const values = await sheets.getSheetData('Clicks');
    if (!values || values.length <= 1) {
      return { success: true, data: { total_clicks: 0, partner_stats: [], destination_stats: {}, recent_clicks: [] } };
    }

    const dataModel = new SheetDataModel(values[0]);
    const clicks = [];
    for (let i = 1; i < values.length; i++) clicks.push(dataModel.rowToObject(values[i]));

    const stats = {
      total_clicks: clicks.length,
      partner_stats: {},
      destination_stats: {},
      utm_stats: { sources: {}, mediums: {}, campaigns: {} },
      recent_clicks: []
    };

    clicks.forEach(click => {
      if (click.partner_code) {
        if (!stats.partner_stats[click.partner_code]) stats.partner_stats[click.partner_code] = { total: 0, destinations: {} };
        stats.partner_stats[click.partner_code].total++;
        const dest = click.destination || 'unknown';
        stats.partner_stats[click.partner_code].destinations[dest] = (stats.partner_stats[click.partner_code].destinations[dest] || 0) + 1;
      }
      const destination = click.destination || 'unknown';
      stats.destination_stats[destination] = (stats.destination_stats[destination] || 0) + 1;
      if (click.utm_source) stats.utm_stats.sources[click.utm_source] = (stats.utm_stats.sources[click.utm_source] || 0) + 1;
      if (click.utm_medium) stats.utm_stats.mediums[click.utm_medium] = (stats.utm_stats.mediums[click.utm_medium] || 0) + 1;
      if (click.utm_campaign) stats.utm_stats.campaigns[click.utm_campaign] = (stats.utm_stats.campaigns[click.utm_campaign] || 0) + 1;
    });

    stats.recent_clicks = clicks.slice(-20).reverse();

    if (params.partner_code) {
      const partnerClicks = clicks.filter(c => c.partner_code === params.partner_code);
      return {
        success: true, data: {
          partner_code: params.partner_code, total_clicks: partnerClicks.length,
          clicks: partnerClicks, stats: stats.partner_stats[params.partner_code] || { total: 0, destinations: {} }
        }
      };
    }
    return { success: true, data: stats };
  } catch (err) {
    return { success: true, data: { total_clicks: 0, partner_stats: [], destination_stats: {}, recent_clicks: [] } };
  }
}

// ========================================
// 新增功能（2025-08-24）
// ========================================

async function handleCancelAccommodationUsage(data) {
  const { usage_id, partner_code, refund_amount, reason } = data;
  if (!usage_id && !partner_code) throw new Error('需要 usage_id 或 partner_code');

  let usageRecord = null;
  if (usage_id) usageRecord = await findRecordById('Accommodation_Usage', usage_id);

  const partnerResults = await findRecordsByField('Partners', 'partner_code', partner_code);
  if (partnerResults.length === 0) throw new Error(`找不到夥伴: ${partner_code}`);
  const partner = partnerResults[0];

  const currentAvailable = parseInt(partner.data.available_points || 0);
  const currentUsed = parseInt(partner.data.points_used || 0);
  const refundPoints = parseInt(refund_amount || 0);

  const updates = {
    available_points: currentAvailable + refundPoints,
    points_used: Math.max(0, currentUsed - refundPoints)
  };

  await updateRecord('Partners', partner_code, updates);

  if (usageRecord) {
    await updateRecord('Accommodation_Usage', usage_id, {
      usage_type: 'REFUNDED',
      notes: (usageRecord.data.notes || '') + `\n[退款於 ${new Date().toISOString()}] ${reason || ''}`
    });
  }

  await createRecord('Payouts', {
    partner_code: partner_code,
    payout_type: 'POINTS_REFUND',
    amount: refundPoints,
    payout_status: 'COMPLETED',
    notes: `住宿金退款: ${reason || ''}`,
    created_by: 'SYSTEM'
  });

  return {
    success: true, message: `成功退回 ${refundPoints} 點`,
    data: { refunded_points: refundPoints, new_available: updates.available_points, new_used: updates.points_used }
  };
}

async function handleRestoreBooking(data) {
  const bookingId = data.booking_id || data.id;
  if (!bookingId) throw new Error('缺少 booking_id');

  const booking = await findRecordById('Bookings', bookingId);
  if (!booking) throw new Error(`找不到訂房: ${bookingId}`);
  if (booking.data.stay_status !== 'CANCELLED') throw new Error(`訂房不是取消狀態: ${booking.data.stay_status}`);

  const restoreData = {
    stay_status: data.new_status || 'PENDING',
    commission_status: 'PENDING',
    notes: (booking.data.notes || '') + `\n[恢復於 ${new Date().toISOString()}] ${data.reason || ''}`
  };

  await updateRecord('Bookings', bookingId, restoreData);

  if (data.new_status === 'COMPLETED' || data.confirm_immediately) {
    return await handleConfirmCheckinCompletion({
      booking_id: bookingId, confirmed_by: data.restored_by || 'SYSTEM', _restored: true
    });
  }

  await createRecord('Payouts', {
    partner_code: booking.data.partner_code,
    payout_type: 'BOOKING_RESTORED',
    amount: 0,
    related_booking_ids: bookingId,
    payout_status: 'INFO',
    notes: `訂房恢復: ${data.reason || ''}`,
    created_by: data.restored_by || 'SYSTEM'
  });

  return { success: true, message: '訂房已恢復' };
}

async function handlePartialRefund(data) {
  const { booking_id, new_room_price, reason } = data;
  if (!booking_id || !new_room_price) throw new Error('需要 booking_id 和 new_room_price');

  const booking = await findRecordById('Bookings', booking_id);
  if (!booking) throw new Error(`找不到訂房: ${booking_id}`);

  const oldPrice = parseFloat(booking.data.room_price || 0);
  const newPrice = parseFloat(new_room_price);
  const priceDiff = oldPrice - newPrice;
  if (priceDiff <= 0) throw new Error('新價格必須低於原價格');

  const partnerResults = await findRecordsByField('Partners', 'partner_code', booking.data.partner_code);
  if (partnerResults.length === 0) throw new Error(`找不到夥伴: ${booking.data.partner_code}`);
  const partner = partnerResults[0];

  const oldCommission = parseInt(booking.data.commission_amount || 0);
  const commissionRate = oldCommission / oldPrice;
  const newCommission = Math.floor(newPrice * commissionRate);
  const commissionDiff = oldCommission - newCommission;

  await updateRecord('Bookings', booking_id, {
    room_price: newPrice,
    commission_amount: newCommission,
    notes: (booking.data.notes || '') + `\n[部分退款 ${priceDiff} 於 ${new Date().toISOString()}] ${reason || ''}`
  });

  if (booking.data.commission_status === 'CALCULATED') {
    const partnerUpdates = {};
    const currentTotal = parseInt(partner.data.total_commission_earned || 0);
    partnerUpdates.total_commission_earned = Math.max(0, currentTotal - commissionDiff);
    if (booking.data.commission_type === 'ACCOMMODATION') {
      partnerUpdates.available_points = Math.max(0, parseInt(partner.data.available_points || 0) - commissionDiff);
    }
    if (booking.data.commission_type === 'CASH') {
      partnerUpdates.pending_commission = Math.max(0, parseInt(partner.data.pending_commission || 0) - commissionDiff);
    }
    await updateRecord('Partners', booking.data.partner_code, partnerUpdates);
  }

  await createRecord('Payouts', {
    partner_code: booking.data.partner_code,
    payout_type: 'PARTIAL_REFUND',
    amount: -commissionDiff,
    related_booking_ids: booking_id,
    payout_status: 'COMPLETED',
    notes: `部分退款調整 - 房價: ${oldPrice}->${newPrice}, 佣金: ${oldCommission}->${newCommission}`,
    created_by: data.adjusted_by || 'SYSTEM'
  });

  return {
    success: true, message: '部分退款處理成功',
    data: { old_price: oldPrice, new_price: newPrice, price_diff: priceDiff, old_commission: oldCommission, new_commission: newCommission, commission_diff: commissionDiff }
  };
}

async function handleBatchCancel(data) {
  const { booking_ids, reason } = data;
  if (!booking_ids || !Array.isArray(booking_ids)) throw new Error('需要 booking_ids 陣列');

  const results = { success: [], failed: [] };

  for (const bookingId of booking_ids) {
    try {
      const result = await handleDeleteBooking({ booking_id: bookingId, _batch: true });
      if (result.success) results.success.push(bookingId);
      else results.failed.push({ id: bookingId, error: result.error });
    } catch (err) {
      results.failed.push({ id: bookingId, error: err.message });
    }
  }

  return {
    success: results.failed.length === 0,
    message: `成功取消 ${results.success.length} 筆訂房`,
    data: results
  };
}

// ========================================
// 大使登入 & 儀表板
// ========================================

async function handleVerifyPartnerLogin(data) {
  const partnerCodeInput = (data.partner_code || '').trim();
  const phoneLast4 = (data.phone_last4 || '').trim();

  if (!partnerCodeInput || !phoneLast4) return { success: false, error: '請提供大使代碼和手機末4碼' };
  if (!/^\d{4}$/.test(phoneLast4)) return { success: false, error: '手機末4碼必須是4位數字' };

  const partner = await findPartnerByCodeCaseInsensitive(partnerCodeInput);
  if (!partner) return { success: false, error: '大使代碼或手機號碼不正確' };

  const contactPhone = String(partner.contact_phone || partner.phone || '');
  if (!contactPhone || contactPhone.length < 4) return { success: false, error: '此帳號尚未設定手機號碼' };

  const actualLast4 = contactPhone.slice(-4);
  if (actualLast4 !== phoneLast4) return { success: false, error: '大使代碼或手機號碼不正確' };

  return {
    success: true,
    partner: {
      partner_code: partner.partner_code,
      name: partner.name || partner.partner_name || '',
      level: partner.level || partner.partner_level || 'LV1_INSIDER',
      total_commission_earned: parseFloat(partner.total_commission_earned) || 0,
      total_commission_paid: parseFloat(partner.total_commission_paid) || 0,
      pending_commission: parseFloat(partner.pending_commission) || 0,
      available_points: parseFloat(partner.available_points) || 0,
      points_used: parseFloat(partner.points_used) || 0,
      commission_preference: partner.commission_preference || 'ACCOMMODATION',
      total_successful_referrals: parseInt(partner.successful_referrals || partner.total_successful_referrals) || 0,
      yearly_referrals: parseInt(partner.yearly_referrals) || 0,
      short_landing_link: partner.short_landing_link || '',
      short_coupon_link: partner.short_coupon_link || ''
    }
  };
}

async function handleGetPartnerDashboardData(data) {
  const partnerCodeInput = (data.partner_code || '').trim();
  if (!partnerCodeInput) return { success: false, error: 'partner_code is required' };

  const partner = await findPartnerByCodeCaseInsensitive(partnerCodeInput);
  if (!partner) return { success: false, error: 'Partner not found' };

  const partnerCode = partner.partner_code;

  // 1. 訂房記錄
  const bookings = [];
  try {
    const bValues = await sheets.getSheetData('Bookings');
    if (bValues && bValues.length > 1) {
      const bModel = new SheetDataModel(bValues[0]);
      for (let i = 1; i < bValues.length; i++) {
        const row = bModel.rowToObject(bValues[i]);
        if (row.partner_code === partnerCode) {
          bookings.push({
            id: row.id, guest_name: maskName(row.guest_name),
            checkin_date: row.checkin_date, checkout_date: row.checkout_date,
            room_price: row.room_price, booking_source: row.booking_source,
            stay_status: row.stay_status, payment_status: row.payment_status,
            commission_status: row.commission_status, commission_amount: row.commission_amount,
            commission_type: row.commission_type, is_first_referral_bonus: row.is_first_referral_bonus,
            first_referral_bonus_amount: row.first_referral_bonus_amount,
            notes: row.notes, created_at: row.created_at
          });
        }
      }
    }
  } catch (e) { console.error('Error loading bookings:', e); }

  // 2. 結算記錄
  const payouts = [];
  try {
    const pValues = await sheets.getSheetData('Payouts');
    if (pValues && pValues.length > 1) {
      const pModel = new SheetDataModel(pValues[0]);
      for (let i = 1; i < pValues.length; i++) {
        const row = pModel.rowToObject(pValues[i]);
        if (row.partner_code === partnerCode) {
          payouts.push({
            id: row.id, payout_type: row.payout_type, amount: row.amount,
            payout_method: row.payout_method, payout_status: row.payout_status,
            notes: row.notes, created_at: row.created_at
          });
        }
      }
    }
  } catch (e) { console.error('Error loading payouts:', e); }

  // 3. 住宿金使用記錄
  const accommodationUsage = [];
  try {
    const uValues = await sheets.getSheetData('Accommodation_Usage');
    if (uValues && uValues.length > 1) {
      const uModel = new SheetDataModel(uValues[0]);
      for (let i = 1; i < uValues.length; i++) {
        const row = uModel.rowToObject(uValues[i]);
        if (row.partner_code === partnerCode) {
          accommodationUsage.push({
            id: row.id, deduct_amount: row.deduct_amount, usage_date: row.usage_date,
            usage_type: row.usage_type, notes: row.notes, created_at: row.created_at
          });
        }
      }
    }
  } catch (e) { console.error('Error loading accommodation usage:', e); }

  // 4. 點擊統計
  let totalClicks = 0;
  try {
    const cValues = await sheets.getSheetData('Clicks');
    if (cValues && cValues.length > 1) {
      const cModel = new SheetDataModel(cValues[0]);
      for (let i = 1; i < cValues.length; i++) {
        const row = cModel.rowToObject(cValues[i]);
        if (row.partner_code === partnerCode) totalClicks++;
      }
    }
  } catch (e) { console.error('Error loading clicks:', e); }

  return {
    success: true,
    partner: {
      partner_code: partner.partner_code,
      name: partner.name || partner.partner_name || '',
      level: partner.level || partner.partner_level || 'LV1_INSIDER',
      total_commission_earned: parseFloat(partner.total_commission_earned) || 0,
      total_commission_paid: parseFloat(partner.total_commission_paid) || 0,
      pending_commission: parseFloat(partner.pending_commission) || 0,
      available_points: parseFloat(partner.available_points) || 0,
      points_used: parseFloat(partner.points_used) || 0,
      commission_preference: partner.commission_preference || 'ACCOMMODATION',
      total_successful_referrals: parseInt(partner.successful_referrals || partner.total_successful_referrals) || 0,
      yearly_referrals: parseInt(partner.yearly_referrals) || 0,
      short_landing_link: partner.short_landing_link || '',
      short_coupon_link: partner.short_coupon_link || '',
      total_clicks: totalClicks
    },
    bookings, payouts, accommodation_usage: accommodationUsage
  };
}

// ========================================
// 路由函數
// ========================================

async function route(action, data) {
  const handlers = {
    'create_booking': handleCreateBooking,
    'update_booking': handleUpdateBooking,
    'delete_booking': handleDeleteBooking,
    'confirm_checkin_completion': handleConfirmCheckinCompletion,
    'create_payout': handleCreatePayout,
    'update_payout': handleUpdatePayout,
    'cancel_payout': handleCancelPayout,
    'process_payout': handleProcessPayout,
    'update_partner': handleUpdatePartner,
    'update_partner_commission': handleUpdatePartnerCommission,
    'use_accommodation_points': handleUseAccommodationPoints,
    'deduct_accommodation_points': handleUseAccommodationPoints,
    'convert_points_to_cash': handleConvertPointsToCash,
    'get_all_data': handleGetAllData,
    'get_dashboard_data': handleGetAllData,
    'create_partner': handleCreatePartner,
    'get_click_stats': handleGetClickStats,
    'cancel_accommodation_usage': handleCancelAccommodationUsage,
    'restore_booking': handleRestoreBooking,
    'partial_refund': handlePartialRefund,
    'batch_cancel': handleBatchCancel,
    'verify_partner_login': handleVerifyPartnerLogin,
    'get_partner_dashboard_data': handleGetPartnerDashboardData,
  };

  const handler = handlers[action];
  if (!handler) throw new Error('未知的動作: ' + action);
  return await handler(data);
}

module.exports = { route, handleRedirect };
