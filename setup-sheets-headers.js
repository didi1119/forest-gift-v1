// 設定 Google Sheets 標題行的腳本
// 請複製到 Apps Script 中執行一次

function setupSheetsHeaders() {
  const SHEETS_ID = '1K7jx5HtHCd9-rTgxPf5YNhRAaGp6cNxVfLz9P0rBgmQ'; // 替換為實際的 Sheet ID
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    
    // 設定 Partners 表格標題
    setupPartnersHeaders(spreadsheet);
    
    // 設定 Bookings 表格標題  
    setupBookingsHeaders(spreadsheet);
    
    // 設定 Payouts 表格標題
    setupPayoutsHeaders(spreadsheet);
    
    // 設定 Clicks 表格標題
    setupClicksHeaders(spreadsheet);
    
    // 設定 Applicants 表格標題
    setupApplicantsHeaders(spreadsheet);
    
    Logger.log('✅ 所有表格標題設定完成！');
    
  } catch (error) {
    Logger.log('❌ 設定失敗: ' + error.toString());
  }
}

function setupPartnersHeaders(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('Partners');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Partners');
    Logger.log('✅ 創建 Partners 工作表');
  }
  
  // Partners 表格的標題行
  const headers = [
    'id',                           // A: 夥伴ID (自動編號)
    'partner_code',                 // B: 夥伴代碼
    'name',                        // C: 姓名
    'email',                       // D: 電子郵件
    'phone',                       // E: 電話
    'level',                       // F: 等級 (LV1_INSIDER, LV2_GUIDE, LV3_GUARDIAN)
    'level_progress',              // G: 本年度成功推薦數
    'total_successful_referrals',  // H: 累積成功推薦數
    'commission_preference',       // I: 佣金偏好 (CASH, ACCOMMODATION)
    'total_commission_earned',     // J: 累積佣金總額
    'total_commission_paid',       // K: 已支付佣金總額
    'pending_commission',          // L: 未支付佣金總額
    'coupon_code',                 // M: 優惠券代碼
    'coupon_url',                  // N: 專屬優惠券連結
    'landing_link',                // O: 主頁追蹤連結
    'coupon_link',                 // P: 優惠券追蹤連結
    'short_landing_link',          // Q: 主頁短網址
    'short_coupon_link',           // R: 優惠券短網址
    'created_at',                  // S: 創建時間
    'updated_at'                   // T: 更新時間
  ];
  
  // 檢查是否已有標題行
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    Logger.log('✅ Partners 標題行已設定');
  } else {
    // 更新第一行為標題行
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    Logger.log('✅ Partners 標題行已更新');
  }
  
  // 格式化標題行
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#E8F5E8');
  headerRange.setHorizontalAlignment('center');
}

function setupBookingsHeaders(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('Bookings');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Bookings');
    Logger.log('✅ 創建 Bookings 工作表');
  }
  
  const headers = [
    'id',                    // A: 訂單ID
    'partner_code',          // B: 推薦夥伴代碼
    'guest_name',           // C: 房客姓名
    'guest_phone',          // D: 房客電話
    'guest_email',          // E: 房客信箱
    'checkin_date',         // F: 入住日期
    'checkout_date',        // G: 退房日期
    'room_price',           // H: 房價
    'commission_amount',    // I: 佣金金額
    'stay_status',          // J: 住宿狀態 (PENDING, CONFIRMED, COMPLETED, CANCELLED)
    'payment_status',       // K: 付款狀態 (PENDING, PAID, REFUNDED)
    'created_at',           // L: 創建時間
    'updated_at'            // M: 更新時間
  ];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    Logger.log('✅ Bookings 標題行已設定');
  } else {
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    Logger.log('✅ Bookings 標題行已更新');
  }
  
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#E8F5E8');
  headerRange.setHorizontalAlignment('center');
}

function setupPayoutsHeaders(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('Payouts');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Payouts');
    Logger.log('✅ 創建 Payouts 工作表');
  }
  
  const headers = [
    'id',                    // A: 結算ID
    'partner_code',          // B: 夥伴代碼
    'payout_type',          // C: 結算類型 (CASH, ACCOMMODATION)
    'amount',               // D: 結算金額
    'payout_status',        // E: 結算狀態 (PENDING, COMPLETED)
    'payout_date',          // F: 結算日期
    'booking_ids',          // G: 相關訂單ID (逗號分隔)
    'notes',                // H: 備註
    'created_at',           // I: 創建時間
    'updated_at'            // J: 更新時間
  ];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    Logger.log('✅ Payouts 標題行已設定');
  } else {
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    Logger.log('✅ Payouts 標題行已更新');
  }
  
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#E8F5E8');
  headerRange.setHorizontalAlignment('center');
}

function setupClicksHeaders(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('Clicks');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Clicks');
    Logger.log('✅ 創建 Clicks 工作表');
  }
  
  const headers = [
    'id',                    // A: 點擊ID
    'partner_code',          // B: 夥伴代碼
    'dest',                  // C: 目標類型 (landing, coupon)
    'ip_address',           // D: IP位址
    'user_agent',           // E: 用戶代理
    'referrer',             // F: 來源頁面
    'timestamp',            // G: 點擊時間
    'converted'             // H: 是否轉換 (TRUE/FALSE)
  ];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    Logger.log('✅ Clicks 標題行已設定');
  } else {
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    Logger.log('✅ Clicks 標題行已更新');
  }
  
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#E8F5E8');
  headerRange.setHorizontalAlignment('center');
}

function setupApplicantsHeaders(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('Applicants');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Applicants');
    Logger.log('✅ 創建 Applicants 工作表');
  }
  
  const headers = [
    'id',                    // A: 申請ID
    'name',                 // B: 姓名
    'phone',                // C: 電話
    'email',                // D: 電子郵件
    'line_id',              // E: LINE ID
    'preferred_code',       // F: 希望的代碼
    'motivation',           // G: 申請動機
    'status',               // H: 狀態 (PENDING, APPROVED, REJECTED)
    'created_at',           // I: 申請時間
    'reviewed_at',          // J: 審核時間
    'notes'                 // K: 審核備註
  ];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    Logger.log('✅ Applicants 標題行已設定');
  } else {
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    Logger.log('✅ Applicants 標題行已更新');
  }
  
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#E8F5E8');
  headerRange.setHorizontalAlignment('center');
}