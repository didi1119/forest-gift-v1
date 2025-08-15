/**
 * 🔧 Apps Script 修復補丁
 * 
 * 只需要替換 handleCreateBooking 函數中的 bookingData 數組順序
 * 
 * 原始問題：bank_account_last5 位置錯誤（在第19位），應該在第6位
 * 
 * 找到你的 Apps Script 中的 handleCreateBooking 函數（約第310行）
 * 將第323-346行的 bookingData 數組替換為以下內容：
 */

// 🎯 正確的 bookingData 數組順序（替換第323-346行）
const bookingData = [
  '', // ID (自動編號) - A列
  data.partner_code || null, // partner_code - B列
  data.guest_name || '', // guest_name - C列
  data.guest_phone || '', // guest_phone - D列
  data.guest_email || '', // guest_email - E列
  data.bank_account_last5 || '', // bank_account_last5 - F列 ⭐ 移到正確位置
  data.checkin_date || '', // checkin_date - G列
  data.checkout_date || '', // checkout_date - H列
  parseInt(data.room_price) || 0, // room_price - I列
  data.booking_source || 'MANUAL_ENTRY', // booking_source - J列
  data.stay_status || 'PENDING', // stay_status - K列
  data.payment_status || 'PENDING', // payment_status - L列
  'NOT_ELIGIBLE', // commission_status - M列
  0, // commission_amount - N列
  'ACCOMMODATION', // commission_type - O列
  false, // is_first_referral_bonus - P列
  0, // first_referral_bonus_amount - Q列
  '', // manually_confirmed_by - R列
  '', // manually_confirmed_at - S列
  data.notes || '', // notes - T列
  timestamp, // created_at - U列
  timestamp  // updated_at - V列
];

/**
 * 🔧 同樣需要修復 handleUpdateBooking 和 handleConfirmCheckinCompletion 函數
 * 
 * 如果你的 Apps Script 中有這些函數，請確保它們也使用相同的欄位順序
 * 
 * 修復步驟：
 * 1. 在你的 Apps Script 中找到 handleCreateBooking 函數
 * 2. 將第323-346行的 bookingData 數組替換為上面的版本
 * 3. 保存並重新部署 Apps Script
 * 4. 測試手動訂房功能
 */

// 📊 正確的 22 欄位順序（供參考）
const CORRECT_FIELD_ORDER = [
  'id',                           // A列
  'partner_code',                 // B列
  'guest_name',                   // C列
  'guest_phone',                  // D列
  'guest_email',                  // E列
  'bank_account_last5',           // F列 ⭐ 關鍵欄位
  'checkin_date',                 // G列
  'checkout_date',                // H列
  'room_price',                   // I列
  'booking_source',               // J列
  'stay_status',                  // K列
  'payment_status',               // L列
  'commission_status',            // M列
  'commission_amount',            // N列
  'commission_type',              // O列
  'is_first_referral_bonus',      // P列
  'first_referral_bonus_amount',  // Q列
  'manually_confirmed_by',        // R列
  'manually_confirmed_at',        // S列
  'notes',                        // T列
  'created_at',                   // U列
  'updated_at'                    // V列
];