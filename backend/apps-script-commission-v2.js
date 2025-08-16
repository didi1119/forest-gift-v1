// ===== Apps Script 佣金管理系統 v2.0 =====
// 支援：手動訂房登記、入住確認、佣金計算、等級晉升

const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
const GITHUB_PAGES_URL = 'https://didi1119.github.io/forest-gift-v1';
const DEFAULT_LINE_COUPON_URL = 'https://lin.ee/q38pqot';

// 佣金等級對照表
const COMMISSION_RATES = {
  'LV1_INSIDER': { accommodation: 1000, cash: 500 },
  'LV2_GUIDE': { accommodation: 1200, cash: 600 },
  'LV3_GUARDIAN': { accommodation: 1500, cash: 800 }
};

const FIRST_REFERRAL_BONUS = 1500; // 首次推薦獎勵

// 等級晉升條件
const LEVEL_REQUIREMENTS = {
  'LV2_GUIDE': 4,   // 年度4組成功推薦
  'LV3_GUARDIAN': 10 // 年度10組成功推薦
};

// ===== 處理 OPTIONS 請求（CORS 預檢）=====
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ===== GET 請求處理（跳轉功能）=====
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    
    // 測試請求
    if (params.test) {
      return HtmlService.createHtmlOutput('GET 測試成功！Apps Script 運行正常。');
    }
    
    // 記錄點擊
    if (params.pid || params.subid) {
      try {
        recordClick(params);
      } catch (recordError) {
        Logger.log('記錄點擊錯誤: ' + recordError.toString());
      }
    }

    // 處理跳轉
    const destination = params.dest || 'landing';
    const subid = params.pid || params.subid || '';
    let redirectUrl;

    if (destination === 'coupon') {
      // 從 Partners 表查詢大使的專屬優惠券 URL
      redirectUrl = getPartnerCouponUrl(subid) || DEFAULT_LINE_COUPON_URL;
    } else {
      redirectUrl = GITHUB_PAGES_URL + (subid ? `?subid=${encodeURIComponent(subid)}` : '');
    }

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0;url=${htmlEscape(redirectUrl)}">
    <title></title>
  </head>
  <body>
    <script>location.replace(${JSON.stringify(redirectUrl)});</script>
  </body>
</html>`;

    return HtmlService.createHtmlOutput(html);

  } catch (err) {
    Logger.log('doGet 錯誤: ' + err.toString());
    return HtmlService.createHtmlOutput(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0;url=${GITHUB_PAGES_URL}">
  </head>
  <body>
    <script>location.replace('${GITHUB_PAGES_URL}');</script>
  </body>
</html>`);
  }
}

// ===== POST 請求處理（支持表單和 JSON）=====
function doPost(e) {
  try {
    Logger.log('=== doPost 開始 ===');
    Logger.log('事件物件: ' + JSON.stringify(e));
    
    let data;
    
    // 檢查事件物件是否存在
    if (!e) {
      Logger.log('⚠️ 事件物件為空，可能是測試執行');
      return createJsonResponse({
        success: false,
        error: '無效的請求：缺少事件物件'
      });
    }
    
    // 檢查是否是表單提交 (form data)
    if (e.parameter && Object.keys(e.parameter).length > 0) {
      Logger.log('表單提交資料: ' + JSON.stringify(e.parameter));
      data = e.parameter;
    }
    // 檢查是否是 JSON 提交
    else if (e.postData && e.postData.contents) {
      Logger.log('原始 POST 資料: ' + e.postData.contents);
      try {
        data = JSON.parse(e.postData.contents);
        Logger.log('JSON 解析成功: ' + JSON.stringify(data));
      } catch (parseError) {
        Logger.log('JSON 解析錯誤: ' + parseError.toString());
        return createJsonResponse({
          success: false,
          error: '無法解析 JSON 資料: ' + parseError.message
        });
      }
    } else {
      Logger.log('錯誤: 沒有 POST 資料');
      return createJsonResponse({
        success: false,
        error: '沒有收到 POST 資料'
      });
    }
    
    // 根據動作分發處理
    switch (data.action) {
      case 'create_partner':
        return handleCreatePartner(data, e);
      
      case 'create_booking':
        return handleCreateBooking(data, e);
      
      case 'confirm_checkin_completion':
        return handleConfirmCheckinCompletion(data, e);
        
      case 'get_dashboard_data':
        return handleGetDashboardData(data, e);

      case 'update_booking':
        return handleUpdateBooking(data, e);

      case 'delete_booking':
        return handleDeleteBooking(data, e);

      case 'diagnose_bookings':
        diagnoseBookingsStructure();
        return createJsonResponse({
          success: true,
          message: '診斷完成，請檢查 Apps Script 日誌'
        });

      case 'fix_bookings_structure':
        fixBookingsStructure();
        return createJsonResponse({
          success: true,
          message: 'Bookings 表格結構已修復，現有資料已清空'
        });
      
      case 'cancel_payout':
        return handleCancelPayout(data, e);
      
      case 'update_payout':
        return handleUpdatePayout(data, e);
      
      case 'update_partner_commission':
        return handleUpdatePartnerCommission(data, e);
      
      case 'create_payout':
        return handleCreatePayout(data, e);
      
      case 'deduct_accommodation_points':
        return handleDeductAccommodationPoints(data, e);
      
      case 'diagnose_payouts':
        return handleDiagnosePayouts(data, e);
      
      case 'repair_payouts':
        return handleRepairPayouts(data, e);
      
      case 'audit_commissions':
        return handleAuditCommissions(data, e);
      
      case 'fix_commission_discrepancies':
        return handleFixCommissionDiscrepancies(data, e);
      
      case 'rebuild_payouts':
        return handleRebuildPayouts(data, e);
        
      default:
        Logger.log('未知動作: ' + (data.action || 'undefined'));
        return createJsonResponse({
          success: false,
          error: '未知的動作: ' + (data.action || 'undefined')
        });
    }
    
  } catch (error) {
    Logger.log('=== doPost 總體錯誤 ===');
    Logger.log('錯誤訊息: ' + error.toString());
    Logger.log('錯誤堆疊: ' + (error.stack || '無堆疊資訊'));
    
    return createJsonResponse({
      success: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    });
  }
}

// ===== 處理建立夥伴 =====
function handleCreatePartner(data, e) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    if (!sheet) {
      Logger.log('錯誤: 找不到 Partners 工作表');
      return createJsonResponse({
        success: false,
        error: '找不到 Partners 工作表'
      });
    }
    
    const timestamp = new Date();
    // 按照標題行順序建立資料陣列
    // id, partner_code, name, email, phone, level, level_progress, total_successful_referrals, 
    // commission_preference, total_commission_earned, total_commission_paid, pending_commission, 
    // coupon_code, coupon_url, landing_link, coupon_link, short_landing_link, short_coupon_link,
    // bank_name, bank_code, bank_branch, bank_account_name, bank_account_number, 
    // created_at, updated_at
    const partnerData = [
      '', // A: id (自動編號)
      data.partner_code || 'UNKNOWN', // B: partner_code
      data.name || '', // C: name
      data.email || '', // D: email
      data.phone || '', // E: phone
      'LV1_INSIDER', // F: level - 預設為 LV1
      0, // G: level_progress - 本年度成功推薦數
      0, // H: total_successful_referrals - 累積成功推薦數
      'ACCOMMODATION', // I: commission_preference - 預設住宿金
      0, // J: total_commission_earned - 累積佣金總額
      0, // K: total_commission_paid - 已支付佣金總額
      0, // L: pending_commission - 未支付佣金總額
      data.coupon_code || '', // M: coupon_code
      data.coupon_url || '', // N: coupon_url
      data.landing_link || '', // O: landing_link
      data.coupon_link || '', // P: coupon_link
      data.short_landing_link || '', // Q: short_landing_link
      data.short_coupon_link || '', // R: short_coupon_link
      data.bank_name || '', // S: bank_name - 銀行名稱
      data.bank_code || '', // T: bank_code - 銀行代碼
      data.bank_branch || '', // U: bank_branch - 分行名稱
      data.bank_account_name || '', // V: bank_account_name - 戶名
      data.bank_account_number || '', // W: bank_account_number - 帳號
      timestamp, // X: created_at
      timestamp  // Y: updated_at
    ];
    
    Logger.log('準備插入資料到 Partners 工作表');
    sheet.appendRow(partnerData);
    Logger.log('Partners 資料插入成功');
    
    const result = {
      success: true,
      message: '夥伴資料建立成功',
      partner_code: data.partner_code,
      timestamp: timestamp.toISOString()
    };
    
    Logger.log('回傳結果: ' + JSON.stringify(result));
    
    // 如果是表單提交，返回 HTML 頁面
    if (e.parameter && Object.keys(e.parameter).length > 0) {
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>儲存成功</title>
        </head>
        <body>
          <h1>✅ 夥伴資料建立成功！</h1>
          <p>夥伴代碼：${data.partner_code}</p>
          <p>姓名：${data.name}</p>
        </body>
        </html>
      `);
    } else {
      return createJsonResponse(result);
    }
    
  } catch (sheetError) {
    Logger.log('Google Sheets 錯誤: ' + sheetError.toString());
    return createJsonResponse({
      success: false,
      error: 'Google Sheets 操作失敗: ' + sheetError.message
    });
  }
}

// ===== 處理建立訂房 =====
function handleCreateBooking(data, e) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Bookings');
    
    if (!sheet) {
      return createJsonResponse({
        success: false,
        error: '找不到 Bookings 工作表'
      });
    }
    
    const timestamp = new Date();
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
    
    Logger.log('準備插入資料到 Bookings 工作表');
    sheet.appendRow(bookingData);
    Logger.log('Bookings 資料插入成功');
    
    const result = {
      success: true,
      message: '訂房記錄建立成功',
      guest_name: data.guest_name,
      partner_code: data.partner_code,
      timestamp: timestamp.toISOString()
    };
    
    // 如果是表單提交，返回 HTML 頁面
    if (e.parameter && Object.keys(e.parameter).length > 0) {
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>訂房登記成功</title>
        </head>
        <body>
          <h1>✅ 訂房記錄建立成功！</h1>
          <p>房客姓名：${data.guest_name}</p>
          ${data.partner_code ? `<p>推薦大使：${data.partner_code}</p>` : ''}
        </body>
        </html>
      `);
    } else {
      return createJsonResponse(result);
    }
    
  } catch (error) {
    Logger.log('建立訂房錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '建立訂房失敗: ' + error.message
    });
  }
}

// ===== 處理確認入住完成 =====
function handleConfirmCheckinCompletion(data, e) {
  try {
    Logger.log('=== 開始處理確認入住 ===');
    Logger.log('接收到的資料: ' + JSON.stringify(data));
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const bookingsSheet = spreadsheet.getSheetByName('Bookings');
    const partnersSheet = spreadsheet.getSheetByName('Partners');
    const payoutsSheet = spreadsheet.getSheetByName('Payouts');
    
    if (!bookingsSheet || !partnersSheet || !payoutsSheet) {
      Logger.log('❌ 找不到必要的工作表');
      return createJsonResponse({
        success: false,
        error: '找不到必要的工作表'
      });
    }
    
    const timestamp = new Date();
    
    // 1. 更新訂房狀態
    const bookingRange = bookingsSheet.getDataRange();
    const bookingValues = bookingRange.getValues();
    let bookingRowIndex = -1;
    let bookingData = null;
    
    Logger.log('📊 Bookings 表格資料行數: ' + bookingValues.length);
    if (bookingValues.length > 0) {
      Logger.log('📋 標題行: ' + JSON.stringify(bookingValues[0]));
    }
    if (bookingValues.length > 1) {
      Logger.log('📋 第一筆資料: ' + JSON.stringify(bookingValues[1]));
    }
    
    // 如果有 booking_id 且不為空，嘗試用 ID 查找
    if (data.booking_id && data.booking_id !== '') {
      const bookingId = parseInt(data.booking_id);
      if (!isNaN(bookingId)) {
        for (let i = 1; i < bookingValues.length; i++) {
          if (bookingValues[i][0] === bookingId) {
            bookingRowIndex = i + 1;
            bookingData = bookingValues[i];
            break;
          }
        }
      }
    }
    
    // 如果用 ID 找不到，嘗試用複合條件查找（房客姓名+電話+入住日期）
    if (bookingRowIndex === -1 && data.guest_name && data.guest_phone && data.checkin_date) {
      Logger.log('🔍 開始用複合條件查找...');
      Logger.log('查找條件 - 姓名: ' + data.guest_name + ', 電話: ' + data.guest_phone + ', 入住日期: ' + data.checkin_date);
      
      for (let i = 1; i < bookingValues.length; i++) {
        const rowGuestName = bookingValues[i][2]; // guest_name 在第3列 (索引2) - C列
        const rowGuestPhone = String(bookingValues[i][3]); // guest_phone 在第4列 (索引3) - D列
        const rowCheckinDate = bookingValues[i][6]; // checkin_date 在第7列 (索引6) - G列 ⭐ 修復位置
        
        Logger.log(`🔍 第${i+1}行資料 - 姓名: ${rowGuestName}, 電話: ${rowGuestPhone}, 入住: ${formatDate(rowCheckinDate)}`);
        
        if (rowGuestName === data.guest_name && 
            rowGuestPhone === String(data.guest_phone) && 
            formatDate(rowCheckinDate) === formatDate(data.checkin_date)) {
          Logger.log('✅ 找到匹配的記錄！行號: ' + (i + 1));
          bookingRowIndex = i + 1;
          bookingData = bookingValues[i];
          break;
        }
      }
      
      if (bookingRowIndex === -1) {
        Logger.log('❌ 複合條件查找失敗，嘗試只用姓名+電話查找...');
        
        // 備用方案：只用姓名+電話查找（不考慮日期）
        for (let i = 1; i < bookingValues.length; i++) {
          const rowGuestName = bookingValues[i][2];
          const rowGuestPhone = String(bookingValues[i][3]);
          
          if (rowGuestName === data.guest_name && rowGuestPhone === String(data.guest_phone)) {
            Logger.log('✅ 備用查找成功！行號: ' + (i + 1));
            bookingRowIndex = i + 1;
            bookingData = bookingValues[i];
            break;
          }
        }
      }
    }
    
    if (bookingRowIndex === -1) {
      return createJsonResponse({
        success: false,
        error: '找不到指定的訂房記錄'
      });
    }
    
    
    // 更新訂房狀態為已完成 - 按照正確的欄位順序
    bookingsSheet.getRange(bookingRowIndex, 11).setValue('COMPLETED'); // stay_status - K列 ⭐ 修復位置
    bookingsSheet.getRange(bookingRowIndex, 13).setValue('CALCULATED'); // commission_status - M列 ⭐ 修復位置  
    bookingsSheet.getRange(bookingRowIndex, 14).setValue(data.commission_amount || 0); // commission_amount - N列 ⭐ 修復位置
    bookingsSheet.getRange(bookingRowIndex, 15).setValue(data.commission_type || 'CASH'); // commission_type - O列 ⭐ 修復位置
    bookingsSheet.getRange(bookingRowIndex, 16).setValue(data.is_first_referral_bonus || false); // is_first_referral_bonus - P列 ⭐ 修復位置
    bookingsSheet.getRange(bookingRowIndex, 17).setValue(data.first_referral_bonus_amount || 0); // first_referral_bonus_amount - Q列 ⭐ 修復位置
    bookingsSheet.getRange(bookingRowIndex, 18).setValue('admin'); // manually_confirmed_by - R列 ⭐ 修復位置
    bookingsSheet.getRange(bookingRowIndex, 19).setValue(timestamp); // manually_confirmed_at - S列 ⭐ 修復位置
    bookingsSheet.getRange(bookingRowIndex, 22).setValue(timestamp); // updated_at - V列 ⭐ 修復位置
    
    // 取得實際的 booking ID (如果有的話)
    const actualBookingId = bookingData[0] || 'N/A';
    
    let result = {
      success: true,
      message: '入住確認完成',
      booking_id: actualBookingId,
      commission_calculated: false,
      level_upgraded: false
    };
    
    // 2. 如果有推薦大使，計算佣金並更新大使資料
    if (data.partner_code) {
      const partnerRange = partnersSheet.getDataRange();
      const partnerValues = partnerRange.getValues();
      let partnerRowIndex = -1;
      let partnerData = null;
      
      for (let i = 1; i < partnerValues.length; i++) {
        if (partnerValues[i][1] === data.partner_code) { // 假設partner_code在第二列
          partnerRowIndex = i + 1;
          partnerData = partnerValues[i];
          break;
        }
      }
      
      if (partnerRowIndex !== -1) {
        // 更新大使統計
        const currentProgress = partnerData[6] || 0; // level_progress
        const currentTotal = partnerData[7] || 0; // total_successful_referrals
        const currentCommissionEarned = partnerData[9] || 0; // total_commission_earned
        const currentPendingCommission = partnerData[11] || 0; // pending_commission
        
        const newProgress = currentProgress + 1;
        const newTotal = currentTotal + 1;
        const commissionAmount = parseFloat(data.commission_amount) || 0;
        const newCommissionEarned = currentCommissionEarned + commissionAmount;
        const newPendingCommission = currentPendingCommission + commissionAmount;
        
        // 更新大使資料
        partnersSheet.getRange(partnerRowIndex, 7).setValue(newProgress); // level_progress
        partnersSheet.getRange(partnerRowIndex, 8).setValue(newTotal); // total_successful_referrals
        partnersSheet.getRange(partnerRowIndex, 10).setValue(newCommissionEarned); // total_commission_earned
        partnersSheet.getRange(partnerRowIndex, 12).setValue(newPendingCommission); // pending_commission
        
        // 標記已領取首次推薦獎勵
        if (data.is_first_referral_bonus) {
          partnersSheet.getRange(partnerRowIndex, 17).setValue(true); // first_referral_bonus_claimed
        }
        
        partnersSheet.getRange(partnerRowIndex, 25).setValue(timestamp); // updated_at
        
        // 檢查等級晉升
        const currentLevel = partnerData[5] || 'LV1_INSIDER'; // level
        let newLevel = currentLevel;
        
        if (currentLevel === 'LV1_INSIDER' && newProgress >= LEVEL_REQUIREMENTS.LV2_GUIDE) {
          newLevel = 'LV2_GUIDE';
        } else if (currentLevel === 'LV2_GUIDE' && newProgress >= LEVEL_REQUIREMENTS.LV3_GUARDIAN) {
          newLevel = 'LV3_GUARDIAN';
        }
        
        if (newLevel !== currentLevel) {
          partnersSheet.getRange(partnerRowIndex, 6).setValue(newLevel); // level
          result.level_upgraded = true;
          result.new_level = newLevel;
        }
        
        // 3. 記錄佣金發放記錄
        if (commissionAmount > 0) {
          const payoutData = [
            '', // ID (自動編號)
            data.partner_code,
            data.commission_type || 'CASH', // payout_type
            commissionAmount, // amount
            actualBookingId.toString(), // related_booking_ids
            data.commission_type === 'CASH' ? 'BANK_TRANSFER' : 'ACCOMMODATION_VOUCHER', // payout_method
            'PENDING', // payout_status
            '', // bank_transfer_date
            '', // bank_transfer_reference
            '', // accommodation_voucher_code
            `入住確認佣金 - 訂房 #${actualBookingId}`, // notes
            'admin', // created_by
            timestamp, // created_at
            timestamp  // updated_at
          ];
          
          payoutsSheet.appendRow(payoutData);
          result.commission_calculated = true;
          result.commission_amount = commissionAmount;
        }
      }
    }
    
    Logger.log('入住確認處理完成: ' + JSON.stringify(result));
    
    // 如果是表單提交，返回 HTML 頁面
    if (e.parameter && Object.keys(e.parameter).length > 0) {
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>入住確認完成</title>
        </head>
        <body>
          <h1>✅ 入住確認完成！</h1>
          <p>訂房ID：${actualBookingId}</p>
          ${result.commission_calculated ? `<p>佣金：$${result.commission_amount}</p>` : ''}
          ${result.level_upgraded ? `<p>🎉 大使等級晉升：${result.new_level}</p>` : ''}
        </body>
        </html>
      `);
    } else {
      return createJsonResponse(result);
    }
    
  } catch (error) {
    Logger.log('確認入住完成錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '確認入住完成失敗: ' + error.message
    });
  }
}

// ===== 處理後台數據請求 =====
function handleGetDashboardData(data, e) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    
    // 讀取各工作表數據
    const partnersData = getSheetData(spreadsheet, 'Partners');
    const bookingsData = getSheetData(spreadsheet, 'Bookings');
    const payoutsData = getSheetData(spreadsheet, 'Payouts');
    const clicksData = getSheetData(spreadsheet, 'Clicks');
    
    const result = {
      success: true,
      data: {
        partners: partnersData,
        bookings: bookingsData,
        payouts: payoutsData,
        clicks: clicksData
      },
      timestamp: new Date().toISOString()
    };
    
    return createJsonResponse(result);
    
  } catch (error) {
    Logger.log('載入後台數據錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '載入後台數據失敗: ' + error.message
    });
  }
}

// ===== 處理更新訂房 =====
function handleUpdateBooking(data, e) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const bookingsSheet = spreadsheet.getSheetByName('Bookings');
    
    if (!bookingsSheet) {
      return createJsonResponse({
        success: false,
        error: '找不到 Bookings 工作表'
      });
    }
    
    const bookingId = parseInt(data.booking_id);
    const timestamp = new Date();
    
    // 1. 找到要更新的訂房記錄
    const bookingRange = bookingsSheet.getDataRange();
    const bookingValues = bookingRange.getValues();
    let bookingRowIndex = -1;
    
    for (let i = 1; i < bookingValues.length; i++) {
      if (bookingValues[i][0] === bookingId) { // 假設ID在第一列
        bookingRowIndex = i + 1; // Google Sheets 行數從1開始
        break;
      }
    }
    
    if (bookingRowIndex === -1) {
      return createJsonResponse({
        success: false,
        error: '找不到指定的訂房記錄'
      });
    }
    
    // 2. 更新訂房資料
    // 按照正確的欄位順序更新
    bookingsSheet.getRange(bookingRowIndex, 2).setValue(data.partner_code || null); // partner_code - B列
    bookingsSheet.getRange(bookingRowIndex, 3).setValue(data.guest_name || ''); // guest_name - C列
    bookingsSheet.getRange(bookingRowIndex, 4).setValue(data.guest_phone || ''); // guest_phone - D列
    bookingsSheet.getRange(bookingRowIndex, 5).setValue(data.guest_email || ''); // guest_email - E列
    bookingsSheet.getRange(bookingRowIndex, 6).setValue(data.bank_account_last5 || ''); // bank_account_last5 - F列 ⭐ 修復位置
    bookingsSheet.getRange(bookingRowIndex, 7).setValue(data.checkin_date || ''); // checkin_date - G列
    bookingsSheet.getRange(bookingRowIndex, 8).setValue(data.checkout_date || ''); // checkout_date - H列
    bookingsSheet.getRange(bookingRowIndex, 9).setValue(parseInt(data.room_price) || 0); // room_price - I列
    bookingsSheet.getRange(bookingRowIndex, 11).setValue(data.stay_status || 'PENDING'); // stay_status - K列
    bookingsSheet.getRange(bookingRowIndex, 12).setValue(data.payment_status || 'PENDING'); // payment_status - L列
    bookingsSheet.getRange(bookingRowIndex, 20).setValue(data.notes || ''); // notes - T列
    bookingsSheet.getRange(bookingRowIndex, 22).setValue(timestamp); // updated_at - V列
    
    Logger.log('訂房更新處理完成: 訂房ID ' + bookingId);
    
    const result = {
      success: true,
      message: '訂房資料更新成功',
      booking_id: bookingId,
      updated_at: timestamp.toISOString()
    };
    
    // 如果是表單提交，返回 HTML 頁面
    if (e.parameter && Object.keys(e.parameter).length > 0) {
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>更新成功</title>
        </head>
        <body>
          <h1>✅ 訂房更新成功！</h1>
          <p>訂房ID：${bookingId}</p>
        </body>
        </html>
      `);
    } else {
      return createJsonResponse(result);
    }
    
  } catch (error) {
    Logger.log('更新訂房錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '更新訂房失敗: ' + error.message
    });
  }
}

// ===== 處理刪除訂房 =====
function handleDeleteBooking(data, e) {
  try {
    Logger.log('🗑️ 開始處理刪除訂房請求');
    Logger.log('請求數據: ' + JSON.stringify(data));
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const bookingsSheet = spreadsheet.getSheetByName('Bookings');
    
    if (!bookingsSheet) {
      return createJsonResponse({
        success: false,
        error: '找不到 Bookings 工作表'
      });
    }
    
    // 獲取所有訂房數據
    const bookingRange = bookingsSheet.getDataRange();
    const bookingValues = bookingRange.getValues();
    let bookingRowIndex = -1;
    let bookingData = null;
    
    // 首先嘗試用 ID 查找（如果有的話）
    if (data.booking_id && data.booking_id !== '') {
      Logger.log('🔍 嘗試用ID查找: ' + data.booking_id);
      const bookingId = parseInt(data.booking_id);
      
      for (let i = 1; i < bookingValues.length; i++) {
        if (bookingValues[i][0] === bookingId) {
          Logger.log('✅ ID查找成功！行號: ' + (i + 1));
          bookingRowIndex = i + 1;
          bookingData = bookingValues[i];
          break;
        }
      }
    }
    
    // 如果ID查找失敗，使用複合條件查找
    if (bookingRowIndex === -1) {
      Logger.log('🔍 ID查找失敗，開始用複合條件查找...');
      Logger.log('查找條件 - 姓名: ' + data.guest_name + ', 電話: ' + data.guest_phone + ', 入住日期: ' + data.checkin_date);
      
      for (let i = 1; i < bookingValues.length; i++) {
        const rowGuestName = bookingValues[i][2]; // guest_name 在第3列 (索引2) - C列
        const rowGuestPhone = String(bookingValues[i][3]); // guest_phone 在第4列 (索引3) - D列
        const rowCheckinDate = bookingValues[i][6]; // checkin_date 在第7列 (索引6) - G列 ⭐ 修復位置
        
        Logger.log(`🔍 第${i+1}行資料 - 姓名: ${rowGuestName}, 電話: ${rowGuestPhone}, 入住: ${formatDate(rowCheckinDate)}`);
        
        if (rowGuestName === data.guest_name && 
            rowGuestPhone === String(data.guest_phone) && 
            formatDate(rowCheckinDate) === formatDate(data.checkin_date)) {
          Logger.log('✅ 複合條件查找成功！行號: ' + (i + 1));
          bookingRowIndex = i + 1;
          bookingData = bookingValues[i];
          break;
        }
      }
    }
    
    if (bookingRowIndex === -1) {
      Logger.log('❌ 找不到要刪除的訂房記錄');
      return createJsonResponse({
        success: false,
        error: '找不到指定的訂房記錄'
      });
    }
    
    // 2. 刪除訂房記錄（刪除整行）
    Logger.log('🗑️ 準備刪除第 ' + bookingRowIndex + ' 行的記錄');
    Logger.log('被刪除的記錄: ' + JSON.stringify(bookingData));
    
    bookingsSheet.deleteRow(bookingRowIndex);
    
    Logger.log('✅ 訂房刪除處理完成: 房客 ' + data.guest_name + ', 電話 ' + data.guest_phone);
    
    const result = {
      success: true,
      message: '訂房記錄已成功刪除',
      guest_name: data.guest_name,
      guest_phone: data.guest_phone,
      deleted_at: new Date().toISOString()
    };
    
    // 如果是表單提交，返回 HTML 頁面
    if (e.parameter && Object.keys(e.parameter).length > 0) {
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>刪除成功</title>
        </head>
        <body>
          <h1>✅ 訂房刪除成功！</h1>
          <p>房客：${data.guest_name}</p>
          <p>電話：${data.guest_phone}</p>
          <p>刪除時間：${result.deleted_at}</p>
        </body>
        </html>
      `);
    } else {
      return createJsonResponse(result);
    }
    
  } catch (error) {
    Logger.log('刪除訂房錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '刪除訂房失敗: ' + error.message
    });
  }
}

// ===== 輔助函數 =====
function createJsonResponse(data) {
  const jsonString = JSON.stringify(data);
  Logger.log('建立 JSON 回應: ' + jsonString);
  
  return ContentService
    .createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}

// 格式化日期以便比較
function formatDate(date) {
  if (!date) return '';
  
  // 如果已經是 YYYY-MM-DD 格式的字串，直接返回
  if (typeof date === 'string') {
    // 處理 ISO 格式字串 (如 2025-08-10T16:00:00.000Z)
    if (date.includes('T')) {
      return date.split('T')[0];
    }
    return date;
  }
  
  // 如果是 Date 物件
  if (date instanceof Date) {
    return date.getFullYear() + '-' + 
           String(date.getMonth() + 1).padStart(2, '0') + '-' + 
           String(date.getDate()).padStart(2, '0');
  }
  
  return String(date);
}

function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getPartnerCouponUrl(partnerCode) {
  try {
    if (!partnerCode) {
      Logger.log('getPartnerCouponUrl: 沒有提供夥伴代碼');
      return null;
    }
    
    Logger.log('查詢夥伴優惠券URL: ' + partnerCode);
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    if (!sheet) {
      Logger.log('Partners 工作表不存在');
      return null;
    }
    
    const range = sheet.getDataRange();
    if (range.getNumRows() <= 1) {
      Logger.log('Partners 表格沒有資料');
      return null;
    }
    
    const values = range.getValues();
    const headers = values[0];
    
    // 找到 coupon_url 欄位的索引
    const couponUrlIndex = headers.indexOf('coupon_url');
    if (couponUrlIndex === -1) {
      Logger.log('找不到 coupon_url 欄位，可用欄位: ' + headers.join(', '));
      return null;
    }
    
    Logger.log('coupon_url 欄位索引: ' + couponUrlIndex);
    
    // 查找對應的夥伴代碼
    for (let i = 1; i < values.length; i++) {
      if (values[i][1] === partnerCode) { // partner_code 在第B列 (索引1)
        const couponUrl = values[i][couponUrlIndex];
        Logger.log(`找到夥伴 ${partnerCode} 的優惠券連結: ${couponUrl}`);
        return couponUrl || null;
      }
    }
    
    Logger.log(`找不到夥伴代碼: ${partnerCode}，已有的夥伴: ` + values.slice(1).map(row => row[1]).join(', '));
    return null;
  } catch (error) {
    Logger.log('查詢夥伴優惠券URL錯誤: ' + error.toString());
    return null;
  }
}

function getSheetData(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const range = sheet.getDataRange();
  if (range.getNumRows() <= 1) return []; // 只有標題行
  
  const values = range.getValues();
  const headers = values[0];
  
  // 轉換為物件陣列
  const data = [];
  for (let i = 1; i < values.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[i][j];
    }
    data.push(row);
  }
  
  return data;
}

function recordClick(params) {
  try {
    const sheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Clicks');
    if (!sheet) {
      Logger.log('Clicks 工作表不存在');
      return;
    }
    
    const timestamp = new Date();
    const partnerCode = params.pid || params.subid || 'UNKNOWN';
    const destination = params.dest || 'landing';
    const targetUrl = params.target || '';
    
    const clickData = [
      '', partnerCode, timestamp, '', '', 
      params.referrer || '', destination,
      params.utm_source || '', params.utm_medium || '', params.utm_campaign || '',
      Utilities.getUuid(), '', '', '', 'pending', timestamp, targetUrl
    ];
    
    sheet.appendRow(clickData);
    Logger.log('Clicks 記錄成功: ' + partnerCode);
  } catch (error) {
    Logger.log('recordClick 錯誤: ' + error.toString());
  }
}

// ===== 診斷和修復函數 =====
function diagnoseBookingsStructure() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Bookings');
    
    if (!sheet) {
      Logger.log('❌ 找不到 Bookings 工作表');
      return;
    }
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    if (values.length === 0) {
      Logger.log('❌ Bookings 表格為空');
      return;
    }
    
    const headers = values[0];
    Logger.log('📋 當前標題行: ' + JSON.stringify(headers));
    Logger.log('📊 標題行數量: ' + headers.length);
    
    const expectedHeaders = [
      'id', 'partner_code', 'guest_name', 'guest_phone', 'guest_email', 
      'checkin_date', 'checkout_date', 'room_price', 'booking_source', 
      'stay_status', 'payment_status', 'commission_status', 'commission_amount', 
      'commission_type', 'is_first_referral_bonus', 'first_referral_bonus_amount',
      'manually_confirmed_by', 'manually_confirmed_at', 'notes', 'created_at', 'updated_at'
    ];
    
    Logger.log('📋 預期標題行: ' + JSON.stringify(expectedHeaders));
    Logger.log('📊 預期標題數量: ' + expectedHeaders.length);
    
    // 檢查差異
    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
    const extraHeaders = headers.filter(h => h && !expectedHeaders.includes(h));
    
    Logger.log('❌ 缺少的標題: ' + JSON.stringify(missingHeaders));
    Logger.log('➕ 多餘的標題: ' + JSON.stringify(extraHeaders));
    
    // 檢查第一筆資料
    if (values.length > 1) {
      const firstRow = values[1];
      Logger.log('📋 第一筆資料: ' + JSON.stringify(firstRow));
      
      // 檢查各欄位的對應
      headers.forEach((header, index) => {
        if (header) {
          Logger.log(`🔍 ${header} (索引${index}): ${firstRow[index]}`);
        }
      });
    }
    
  } catch (error) {
    Logger.log('❌ 診斷錯誤: ' + error.toString());
  }
}

function fixBookingsStructure() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Bookings');
    
    if (!sheet) {
      Logger.log('❌ 找不到 Bookings 工作表');
      return;
    }
    
    const correctHeaders = [
      'id', 'partner_code', 'guest_name', 'guest_phone', 'guest_email', 
      'checkin_date', 'checkout_date', 'room_price', 'booking_source', 
      'stay_status', 'payment_status', 'commission_status', 'commission_amount', 
      'commission_type', 'is_first_referral_bonus', 'first_referral_bonus_amount',
      'manually_confirmed_by', 'manually_confirmed_at', 'notes', 'created_at', 'updated_at'
    ];
    
    // 清空工作表並重設標題
    sheet.clear();
    sheet.getRange(1, 1, 1, correctHeaders.length).setValues([correctHeaders]);
    
    Logger.log('✅ Bookings 工作表結構已修復');
    Logger.log('📋 新標題行: ' + JSON.stringify(correctHeaders));
    
  } catch (error) {
    Logger.log('❌ 修復錯誤: ' + error.toString());
  }
}

// ===== 處理取消結算 =====
function handleCancelPayout(data, e) {
  try {
    Logger.log('🚫 開始處理取消結算請求');
    Logger.log('請求數據: ' + JSON.stringify(data));
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const payoutsSheet = spreadsheet.getSheetByName('Payouts');
    const partnersSheet = spreadsheet.getSheetByName('Partners');
    
    if (!payoutsSheet || !partnersSheet) {
      return createJsonResponse({
        success: false,
        error: '找不到必要的工作表'
      });
    }
    
    const payoutId = data.payout_id;
    if (!payoutId) {
      return createJsonResponse({
        success: false,
        error: '缺少結算ID'
      });
    }
    
    // 1. 查找要取消的結算記錄
    const payoutRange = payoutsSheet.getDataRange();
    const payoutValues = payoutRange.getValues();
    let payoutRowIndex = -1;
    let payoutData = null;
    
    for (let i = 1; i < payoutValues.length; i++) {
      if (String(payoutValues[i][0]) === String(payoutId)) {
        payoutRowIndex = i + 1;
        payoutData = payoutValues[i];
        break;
      }
    }
    
    if (payoutRowIndex === -1) {
      return createJsonResponse({
        success: false,
        error: '找不到指定的結算記錄'
      });
    }
    
    const partnerCode = payoutData[1]; // partner_code
    const payoutType = payoutData[2]; // payout_type
    const payoutAmount = parseFloat(payoutData[3]) || 0; // amount
    const payoutMethod = payoutData[5]; // payout_method
    const payoutStatus = payoutData[6]; // payout_status
    
    Logger.log('📋 結算記錄詳情:');
    Logger.log('  大使: ' + partnerCode + ', 類型: ' + payoutType + ', 金額: $' + payoutAmount);
    Logger.log('  方法: ' + payoutMethod + ', 狀態: ' + payoutStatus);
    
    // 2. 刪除結算記錄
    payoutsSheet.deleteRow(payoutRowIndex);
    Logger.log('✅ 結算記錄已刪除: ID ' + payoutId);
    
    // 3. 根據結算類型更新大使的佣金（反向操作）
    const partnerRange = partnersSheet.getDataRange();
    const partnerValues = partnerRange.getValues();
    let partnerRowIndex = -1;
    
    for (let i = 1; i < partnerValues.length; i++) {
      if (partnerValues[i][1] === partnerCode) { // partner_code 在第2列
        partnerRowIndex = i + 1;
        break;
      }
    }
    
    if (partnerRowIndex === -1) {
      Logger.log('⚠️ 找不到對應的大使記錄: ' + partnerCode);
    } else {
      const currentTotalEarned = parseFloat(partnerValues[partnerRowIndex-1][9]) || 0; // total_commission_earned
      const currentPendingCommission = parseFloat(partnerValues[partnerRowIndex-1][11]) || 0; // pending_commission
      
      let adjustmentMade = false;
      
      // 根據不同的結算類型決定如何調整佣金
      if (payoutMethod === 'MANUAL_ADJUSTMENT') {
        // 手動調整記錄的取消 - 需要反向調整
        if (payoutType === 'ACCOMMODATION' || payoutType === 'ADJUSTMENT_REVERSAL') {
          // 這是對累積佣金的調整，需要反向操作
          const adjustmentDirection = payoutStatus === 'COMPLETED' ? -1 : 1; // COMPLETED 表示增加，取消時要減少
          const newTotalEarned = Math.max(0, currentTotalEarned + (adjustmentDirection * payoutAmount));
          
          partnersSheet.getRange(partnerRowIndex, 10).setValue(newTotalEarned); // total_commission_earned
          Logger.log('🔄 反向調整累積佣金: ' + currentTotalEarned + ' → ' + newTotalEarned);
          adjustmentMade = true;
        }
        
        if (payoutType === 'CASH' || payoutType === 'ADJUSTMENT_REVERSAL') {
          // 這是對待支付佣金的調整，需要反向操作
          const adjustmentDirection = payoutStatus === 'PENDING' ? -1 : 1; // PENDING 表示增加，取消時要減少
          const newPendingCommission = Math.max(0, currentPendingCommission + (adjustmentDirection * payoutAmount));
          
          partnersSheet.getRange(partnerRowIndex, 12).setValue(newPendingCommission); // pending_commission
          Logger.log('🔄 反向調整待支付佣金: ' + currentPendingCommission + ' → ' + newPendingCommission);
          adjustmentMade = true;
        }
      } else {
        // 普通結算記錄的取消 - 將金額加回待支付佣金
        const newPendingCommission = currentPendingCommission + payoutAmount;
        partnersSheet.getRange(partnerRowIndex, 12).setValue(newPendingCommission); // pending_commission
        Logger.log('💰 結算取消，金額歸還待支付佣金: ' + currentPendingCommission + ' → ' + newPendingCommission);
        adjustmentMade = true;
      }
      
      if (adjustmentMade) {
        partnersSheet.getRange(partnerRowIndex, 25).setValue(new Date()); // updated_at
        Logger.log('✅ 大使 ' + partnerCode + ' 佣金已調整');
      }
    }
    
    const result = {
      success: true,
      message: '結算已成功取消',
      payout_id: payoutId,
      partner_code: partnerCode,
      cancelled_amount: payoutAmount,
      cancelled_at: new Date().toISOString()
    };
    
    // 如果是表單提交，返回 HTML 頁面
    if (e.parameter && Object.keys(e.parameter).length > 0) {
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>取消結算成功</title>
        </head>
        <body>
          <h1>✅ 結算取消成功！</h1>
          <p>結算ID：${payoutId}</p>
          <p>大使：${partnerCode}</p>
          <p>取消金額：$${payoutAmount.toLocaleString()}</p>
        </body>
        </html>
      `);
    } else {
      return createJsonResponse(result);
    }
    
  } catch (error) {
    Logger.log('取消結算錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '取消結算失敗: ' + error.message
    });
  }
}

// ===== 處理更新結算 =====
function handleUpdatePayout(data, e) {
  try {
    Logger.log('✏️ 開始處理更新結算請求');
    Logger.log('請求數據: ' + JSON.stringify(data));
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const payoutsSheet = spreadsheet.getSheetByName('Payouts');
    
    if (!payoutsSheet) {
      return createJsonResponse({
        success: false,
        error: '找不到 Payouts 工作表'
      });
    }
    
    const payoutId = data.payout_id;
    if (!payoutId) {
      return createJsonResponse({
        success: false,
        error: '缺少結算ID'
      });
    }
    
    // 驗證金額
    const newAmount = parseFloat(data.amount) || 0;
    if (newAmount <= 0) {
      return createJsonResponse({
        success: false,
        error: '金額必須大於0'
      });
    }
    
    // 1. 查找要更新的結算記錄
    const payoutRange = payoutsSheet.getDataRange();
    const payoutValues = payoutRange.getValues();
    let payoutRowIndex = -1;
    let oldAmount = 0;
    
    for (let i = 1; i < payoutValues.length; i++) {
      if (String(payoutValues[i][0]) === String(payoutId)) {
        payoutRowIndex = i + 1;
        oldAmount = parseFloat(payoutValues[i][3]) || 0; // 舊的金額
        break;
      }
    }
    
    if (payoutRowIndex === -1) {
      return createJsonResponse({
        success: false,
        error: '找不到指定的結算記錄'
      });
    }
    
    const timestamp = new Date();
    
    // 2. 更新結算記錄
    payoutsSheet.getRange(payoutRowIndex, 3).setValue(data.payout_type || 'CASH'); // payout_type
    payoutsSheet.getRange(payoutRowIndex, 4).setValue(newAmount); // amount
    payoutsSheet.getRange(payoutRowIndex, 7).setValue(data.payout_status || 'PENDING'); // payout_status
    payoutsSheet.getRange(payoutRowIndex, 11).setValue(data.notes || ''); // notes
    payoutsSheet.getRange(payoutRowIndex, 14).setValue(timestamp); // updated_at
    
    Logger.log('✅ 結算記錄已更新: ID ' + payoutId + ', 金額: $' + oldAmount + ' -> $' + newAmount);
    
    // 3. 如果金額有變化，根據結算類型更新大使的佣金
    if (oldAmount !== newAmount) {
      // 重新獲取最新的 payout 數據，因為可能剛更新過
      const updatedPayoutRange = payoutsSheet.getDataRange();
      const updatedPayoutValues = updatedPayoutRange.getValues();
      const updatedPayoutData = updatedPayoutValues[payoutRowIndex - 1];
      
      const partnerCode = updatedPayoutData[1]; // partner_code
      const payoutType = updatedPayoutData[2]; // payout_type
      const payoutMethod = updatedPayoutData[5]; // payout_method
      const payoutStatus = updatedPayoutData[6]; // payout_status
      const partnersSheet = spreadsheet.getSheetByName('Partners');
      
      Logger.log('📊 結算記錄修改: 類型=' + payoutType + ', 方法=' + payoutMethod + ', 狀態=' + payoutStatus);
      Logger.log('📊 金額變化: $' + oldAmount + ' → $' + newAmount + ' (差額: ' + (newAmount - oldAmount) + ')');
      
      if (partnersSheet) {
        const partnerRange = partnersSheet.getDataRange();
        const partnerValues = partnerRange.getValues();
        
        for (let i = 1; i < partnerValues.length; i++) {
          if (partnerValues[i][1] === partnerCode) { // partner_code 在第2列
            const currentTotalEarned = parseFloat(partnerValues[i][9]) || 0; // total_commission_earned
            const currentPendingCommission = parseFloat(partnerValues[i][11]) || 0; // pending_commission
            const amountDifference = newAmount - oldAmount;
            
            if (payoutMethod === 'MANUAL_ADJUSTMENT') {
              // 手動調整記錄的修改
              if (payoutType === 'ACCOMMODATION' && payoutStatus === 'COMPLETED') {
                // 累積佣金調整
                const newTotalEarned = Math.max(0, currentTotalEarned + amountDifference);
                partnersSheet.getRange(i + 1, 10).setValue(newTotalEarned); // total_commission_earned
                Logger.log('🔄 修改手動調整 - 累積佣金: ' + currentTotalEarned + ' → ' + newTotalEarned);
              } else if (payoutType === 'CASH' && payoutStatus === 'PENDING') {
                // 待支付佣金調整
                const newPendingCommission = Math.max(0, currentPendingCommission + amountDifference);
                partnersSheet.getRange(i + 1, 12).setValue(newPendingCommission); // pending_commission
                Logger.log('🔄 修改手動調整 - 待支付佣金: ' + currentPendingCommission + ' → ' + newPendingCommission);
              } else if (payoutType === 'ADJUSTMENT_REVERSAL') {
                // 調整撤銷記錄的修改（反向操作）
                if (payoutStatus === 'REVERSED') {
                  const newTotalEarned = Math.max(0, currentTotalEarned - amountDifference);
                  partnersSheet.getRange(i + 1, 10).setValue(newTotalEarned); // total_commission_earned
                  Logger.log('🔄 修改調整撤銷 - 累積佣金: ' + currentTotalEarned + ' → ' + newTotalEarned);
                }
              }
            } else {
              // 普通結算記錄的修改 - 影響待支付佣金
              const newPendingCommission = Math.max(0, currentPendingCommission + amountDifference);
              partnersSheet.getRange(i + 1, 12).setValue(newPendingCommission); // pending_commission
              Logger.log('💰 修改普通結算 - 待支付佣金: ' + currentPendingCommission + ' → ' + newPendingCommission);
            }
            
            partnersSheet.getRange(i + 1, 25).setValue(timestamp); // updated_at
            Logger.log('✅ 大使 ' + partnerCode + ' 佣金已根據結算修改調整');
            break;
          }
        }
      }
    }
    
    const result = {
      success: true,
      message: '結算記錄更新成功',
      payout_id: payoutId,
      old_amount: oldAmount,
      new_amount: newAmount,
      updated_at: timestamp.toISOString()
    };
    
    // 如果是表單提交，返回 HTML 頁面
    if (e.parameter && Object.keys(e.parameter).length > 0) {
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>更新結算成功</title>
        </head>
        <body>
          <h1>✅ 結算更新成功！</h1>
          <p>結算ID：${payoutId}</p>
          <p>原金額：$${oldAmount.toLocaleString()}</p>
          <p>新金額：$${newAmount.toLocaleString()}</p>
          <p>狀態：${data.payout_status || 'PENDING'}</p>
        </body>
        </html>
      `);
    } else {
      return createJsonResponse(result);
    }
    
  } catch (error) {
    Logger.log('更新結算錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '更新結算失敗: ' + error.message
    });
  }
}

// ===== 處理更新夥伴佣金 =====
function handleUpdatePartnerCommission(data, e) {
  try {
    Logger.log('💰 開始處理更新夥伴佣金請求');
    Logger.log('請求數據: ' + JSON.stringify(data));
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const partnersSheet = spreadsheet.getSheetByName('Partners');
    
    if (!partnersSheet) {
      return createJsonResponse({
        success: false,
        error: '找不到 Partners 工作表'
      });
    }
    
    const partnerCode = data.partner_code;
    if (!partnerCode) {
      return createJsonResponse({
        success: false,
        error: '缺少夥伴代碼'
      });
    }
    
    // 1. 查找夥伴記錄
    const partnerRange = partnersSheet.getDataRange();
    const partnerValues = partnerRange.getValues();
    let partnerRowIndex = -1;
    
    for (let i = 1; i < partnerValues.length; i++) {
      if (partnerValues[i][1] === partnerCode) { // partner_code 在第2列
        partnerRowIndex = i + 1;
        break;
      }
    }
    
    if (partnerRowIndex === -1) {
      return createJsonResponse({
        success: false,
        error: '找不到指定的夥伴記錄'
      });
    }
    
    const timestamp = new Date();
    
    // 2. 獲取當前佣金值
    const currentTotalEarned = parseFloat(partnerValues[partnerRowIndex-1][9]) || 0; // total_commission_earned
    const currentPendingCommission = parseFloat(partnerValues[partnerRowIndex-1][11]) || 0; // pending_commission
    
    const newTotalEarned = parseFloat(data.total_commission_earned) || 0;
    const newPendingCommission = parseFloat(data.pending_commission) || 0;
    
    // 計算調整差額
    const totalEarnedAdjustment = newTotalEarned - currentTotalEarned;
    const pendingCommissionAdjustment = newPendingCommission - currentPendingCommission;
    
    Logger.log('📊 佣金調整計算:');
    Logger.log('  累積佣金: ' + currentTotalEarned + ' → ' + newTotalEarned + ' (差額: ' + totalEarnedAdjustment + ')');
    Logger.log('  待支付佣金: ' + currentPendingCommission + ' → ' + newPendingCommission + ' (差額: ' + pendingCommissionAdjustment + ')');
    
    // 3. 更新夥伴佣金資料
    partnersSheet.getRange(partnerRowIndex, 10).setValue(newTotalEarned); // total_commission_earned
    partnersSheet.getRange(partnerRowIndex, 12).setValue(newPendingCommission); // pending_commission
    partnersSheet.getRange(partnerRowIndex, 25).setValue(timestamp); // updated_at
    
    Logger.log('✅ 夥伴佣金已更新: ' + partnerCode + ', 累積: $' + newTotalEarned + ', 待付: $' + newPendingCommission);
    
    // 4. 如果有顯著的調整，創建結算記錄
    const payoutsSheet = spreadsheet.getSheetByName('Payouts');
    let payoutRecordsCreated = [];
    
    if (payoutsSheet && (Math.abs(totalEarnedAdjustment) > 0 || Math.abs(pendingCommissionAdjustment) > 0)) {
      // 確保 Payouts 表格結構正確
      try {
        const payoutsHeaders = payoutsSheet.getRange(1, 1, 1, payoutsSheet.getLastColumn()).getValues()[0];
        const expectedHeaders = [
          'ID', 'partner_code', 'payout_type', 'amount', 'related_booking_ids',
          'payout_method', 'payout_status', 'bank_transfer_date', 'bank_transfer_reference',
          'accommodation_voucher_code', 'notes', 'created_by', 'created_at', 'updated_at'
        ];
        
        const headersMatch = JSON.stringify(payoutsHeaders) === JSON.stringify(expectedHeaders);
        Logger.log('📋 Payouts 表格標題檢查: ' + (headersMatch ? '✅ 正確' : '❌ 錯誤'));
        
        if (!headersMatch) {
          Logger.log('⚠️ Payouts 表格結構不正確，嘗試修復...');
          payoutsSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
          Logger.log('✅ Payouts 表格標題已修復');
        }
      } catch (headerCheckError) {
        Logger.log('⚠️ 無法檢查 Payouts 表格標題: ' + headerCheckError.toString());
      }
      // 為累積佣金的調整創建記錄（如果調整金額不為零）
      if (Math.abs(totalEarnedAdjustment) > 0) {
        const totalAdjustmentRecord = [
          '', // ID (自動編號)
          partnerCode,
          totalEarnedAdjustment > 0 ? 'ACCOMMODATION' : 'ADJUSTMENT_REVERSAL', // payout_type
          Math.abs(totalEarnedAdjustment), // amount (使用絕對值)
          '', // related_booking_ids (手動調整沒有相關訂房)
          'MANUAL_ADJUSTMENT', // payout_method
          totalEarnedAdjustment > 0 ? 'COMPLETED' : 'REVERSED', // payout_status
          '', // bank_transfer_date
          '', // bank_transfer_reference
          '', // accommodation_voucher_code
          `手動調整累積佣金 ${totalEarnedAdjustment > 0 ? '+' : ''}${totalEarnedAdjustment}` + (data.adjustment_reason ? ': ' + data.adjustment_reason : ''), // notes
          'admin', // created_by
          timestamp, // created_at
          timestamp  // updated_at
        ];
        try {
          payoutsSheet.appendRow(totalAdjustmentRecord);
          payoutRecordsCreated.push('累積佣金調整: ' + totalEarnedAdjustment);
          Logger.log('📝 創建累積佣金調整記錄: ' + totalEarnedAdjustment);
        } catch (appendError) {
          Logger.log('❌ 創建累積佣金調整記錄失敗: ' + appendError.toString());
          Logger.log('📋 Payouts 表格標題: ' + JSON.stringify(payoutsSheet.getRange(1, 1, 1, payoutsSheet.getLastColumn()).getValues()[0]));
        }
      }
      
      // 為待支付佣金的調整創建記錄（如果調整金額不為零）
      if (Math.abs(pendingCommissionAdjustment) > 0) {
        const pendingAdjustmentRecord = [
          '', // ID (自動編號)
          partnerCode,
          pendingCommissionAdjustment > 0 ? 'CASH' : 'ADJUSTMENT_REVERSAL', // payout_type
          Math.abs(pendingCommissionAdjustment), // amount
          '', // related_booking_ids
          'MANUAL_ADJUSTMENT', // payout_method
          'PENDING', // payout_status (待支付調整都是 PENDING)
          '', // bank_transfer_date
          '', // bank_transfer_reference
          '', // accommodation_voucher_code
          `手動調整待支付佣金 ${pendingCommissionAdjustment > 0 ? '+' : ''}${pendingCommissionAdjustment}` + (data.adjustment_reason ? ': ' + data.adjustment_reason : ''), // notes
          'admin', // created_by
          timestamp, // created_at
          timestamp  // updated_at
        ];
        try {
          payoutsSheet.appendRow(pendingAdjustmentRecord);
          payoutRecordsCreated.push('待支付佣金調整: ' + pendingCommissionAdjustment);
          Logger.log('📝 創建待支付佣金調整記錄: ' + pendingCommissionAdjustment);
        } catch (appendError) {
          Logger.log('❌ 創建待支付佣金調整記錄失敗: ' + appendError.toString());
          Logger.log('📋 Payouts 表格標題: ' + JSON.stringify(payoutsSheet.getRange(1, 1, 1, payoutsSheet.getLastColumn()).getValues()[0]));
        }
      }
    }
    
    // 5. 記錄到調整日誌表（保持現有功能）
    if (data.adjustment_reason) {
      try {
        const logsSheet = spreadsheet.getSheetByName('Commission_Adjustment_Logs');
        if (logsSheet) {
          const logData = [
            '', // ID
            partnerCode,
            newTotalEarned,
            newPendingCommission,
            data.adjustment_reason,
            'admin',
            timestamp,
            timestamp
          ];
          logsSheet.appendRow(logData);
        }
      } catch (logError) {
        Logger.log('記錄調整日誌失敗: ' + logError.toString());
      }
    }
    
    const result = {
      success: true,
      message: '夥伴佣金資料更新成功',
      partner_code: partnerCode,
      total_commission_earned: newTotalEarned,
      pending_commission: newPendingCommission,
      adjustments: {
        total_earned_adjustment: totalEarnedAdjustment,
        pending_commission_adjustment: pendingCommissionAdjustment,
        payout_records_created: payoutRecordsCreated
      },
      updated_at: timestamp.toISOString()
    };
    
    // 如果是表單提交，返回 HTML 頁面
    if (e.parameter && Object.keys(e.parameter).length > 0) {
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>佣金更新成功</title>
        </head>
        <body>
          <h1>✅ 佣金資料更新成功！</h1>
          <p>夥伴代碼：${partnerCode}</p>
          <p>累積佣金：$${newTotalEarned.toLocaleString()}</p>
          <p>待支付佣金：$${newPendingCommission.toLocaleString()}</p>
        </body>
        </html>
      `);
    } else {
      return createJsonResponse(result);
    }
    
  } catch (error) {
    Logger.log('更新夥伴佣金錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '更新夥伴佣金失敗: ' + error.message
    });
  }
}

// ===== 處理創建結算 =====
function handleCreatePayout(data, e) {
  try {
    Logger.log('💳 開始處理創建結算請求');
    Logger.log('請求數據: ' + JSON.stringify(data));
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const payoutsSheet = spreadsheet.getSheetByName('Payouts');
    const partnersSheet = spreadsheet.getSheetByName('Partners');
    
    if (!payoutsSheet || !partnersSheet) {
      return createJsonResponse({
        success: false,
        error: '找不到必要的工作表'
      });
    }
    
    const partnerCode = data.partner_code;
    const payoutType = data.payout_type || 'ACCOMMODATION';
    const amount = parseFloat(data.amount) || 0;
    const notes = data.notes || '';
    
    if (!partnerCode || amount <= 0) {
      return createJsonResponse({
        success: false,
        error: '缺少必要參數或金額無效'
      });
    }
    
    const timestamp = new Date();
    
    // 1. 創建結算記錄
    const payoutData = [
      '', // ID (自動編號)
      partnerCode,
      payoutType, // payout_type
      amount, // amount
      '', // related_booking_ids
      payoutType === 'CASH' ? 'BANK_TRANSFER' : 'ACCOMMODATION_VOUCHER', // payout_method
      'PENDING', // payout_status
      '', // bank_transfer_date
      '', // bank_transfer_reference
      '', // accommodation_voucher_code
      notes, // notes
      'admin', // created_by
      timestamp, // created_at
      timestamp  // updated_at
    ];
    
    payoutsSheet.appendRow(payoutData);
    Logger.log('✅ 結算記錄已創建');
    
    // 2. 更新夥伴的待支付佣金（減少金額）
    const partnerRange = partnersSheet.getDataRange();
    const partnerValues = partnerRange.getValues();
    
    for (let i = 1; i < partnerValues.length; i++) {
      if (partnerValues[i][1] === partnerCode) { // partner_code 在第2列
        const currentPendingCommission = parseFloat(partnerValues[i][11]) || 0; // pending_commission
        const newPendingCommission = Math.max(0, currentPendingCommission - amount);
        
        partnersSheet.getRange(i + 1, 12).setValue(newPendingCommission); // pending_commission
        partnersSheet.getRange(i + 1, 25).setValue(timestamp); // updated_at
        
        Logger.log('✅ 夥伴 ' + partnerCode + ' 待支付佣金已調整: $' + currentPendingCommission + ' -> $' + newPendingCommission);
        break;
      }
    }
    
    const result = {
      success: true,
      message: '結算創建成功',
      partner_code: partnerCode,
      payout_type: payoutType,
      amount: amount,
      created_at: timestamp.toISOString()
    };
    
    // 如果是表單提交，返回 HTML 頁面
    if (e.parameter && Object.keys(e.parameter).length > 0) {
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>結算創建成功</title>
        </head>
        <body>
          <h1>✅ 結算創建成功！</h1>
          <p>夥伴代碼：${partnerCode}</p>
          <p>類型：${payoutType === 'CASH' ? '現金' : '住宿金'}</p>
          <p>金額：$${amount.toLocaleString()}</p>
        </body>
        </html>
      `);
    } else {
      return createJsonResponse(result);
    }
    
  } catch (error) {
    Logger.log('創建結算錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '創建結算失敗: ' + error.message
    });
  }
}

// ===== 診斷和修復 Payouts 表格結構 =====
function handleDiagnosePayouts(data, e) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const payoutsSheet = spreadsheet.getSheetByName('Payouts');
    
    if (!payoutsSheet) {
      return createJsonResponse({
        success: false,
        error: '找不到 Payouts 工作表'
      });
    }

    const expectedHeaders = [
      'ID', 'partner_code', 'payout_type', 'amount', 'related_booking_ids',
      'payout_method', 'payout_status', 'bank_transfer_date', 'bank_transfer_reference',
      'accommodation_voucher_code', 'notes', 'created_by', 'created_at', 'updated_at'
    ];

    const range = payoutsSheet.getDataRange();
    const values = range.getValues();
    
    if (values.length === 0) {
      // 空工作表，創建標題行
      payoutsSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      return createJsonResponse({
        success: true,
        message: '已創建 Payouts 表格標題行',
        action: 'created_headers',
        headers: expectedHeaders
      });
    }

    const currentHeaders = values[0];
    const diagnosis = {
      current_headers: currentHeaders,
      expected_headers: expectedHeaders,
      headers_match: JSON.stringify(currentHeaders) === JSON.stringify(expectedHeaders),
      current_data_count: values.length - 1,
      issues: []
    };

    // 檢查標題行是否正確
    if (!diagnosis.headers_match) {
      diagnosis.issues.push('標題行不匹配');
      
      // 修復標題行
      payoutsSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      diagnosis.issues.push('已修復標題行');
    }

    // 檢查現有資料的結構
    if (values.length > 1) {
      const sampleData = values.slice(1, Math.min(6, values.length)); // 取前5筆資料作為樣本
      diagnosis.sample_data = sampleData.map((row, index) => {
        const rowData = {};
        expectedHeaders.forEach((header, colIndex) => {
          rowData[header] = row[colIndex] || '';
        });
        return { row_number: index + 2, data: rowData };
      });

      // 檢查是否有空的 ID
      const missingIds = [];
      for (let i = 1; i < values.length; i++) {
        if (!values[i][0] || values[i][0] === '') {
          missingIds.push(i + 1); // 行號
        }
      }
      
      if (missingIds.length > 0) {
        diagnosis.issues.push(`發現 ${missingIds.length} 筆記錄缺少 ID`);
        diagnosis.missing_id_rows = missingIds;
      }
    }

    return createJsonResponse({
      success: true,
      diagnosis: diagnosis,
      repair_needed: diagnosis.issues.length > 0
    });

  } catch (error) {
    Logger.log('診斷 Payouts 表格錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '診斷失敗: ' + error.message
    });
  }
}

// ===== 修復 Payouts 表格資料 =====
function handleRepairPayouts(data, e) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const payoutsSheet = spreadsheet.getSheetByName('Payouts');
    
    if (!payoutsSheet) {
      return createJsonResponse({
        success: false,
        error: '找不到 Payouts 工作表'
      });
    }

    const expectedHeaders = [
      'ID', 'partner_code', 'payout_type', 'amount', 'related_booking_ids',
      'payout_method', 'payout_status', 'bank_transfer_date', 'bank_transfer_reference',
      'accommodation_voucher_code', 'notes', 'created_by', 'created_at', 'updated_at'
    ];

    const range = payoutsSheet.getDataRange();
    const values = range.getValues();
    const repairActions = [];

    // 1. 確保標題行正確
    if (values.length === 0 || JSON.stringify(values[0]) !== JSON.stringify(expectedHeaders)) {
      // 清空現有內容並重新建立正確結構
      payoutsSheet.clear();
      payoutsSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      repairActions.push('清空並重建標題行');
      
      // 如果原本有數據但結構錯誤，警告用戶
      if (values.length > 1) {
        Logger.log('⚠️ 警告：Payouts 表格結構錯誤，已清空重建。原有 ' + (values.length - 1) + ' 筆記錄已遺失。');
        repairActions.push('警告：原有 ' + (values.length - 1) + ' 筆錯誤記錄已清空');
      }
      
      // 重新讀取空白表格
      values = [expectedHeaders];
    }

    // 2. 為缺少 ID 的記錄補充 ID
    if (values.length > 1) {
      let maxId = 0;
      const updatedRows = [];
      
      // 找出現有的最大 ID
      for (let i = 1; i < values.length; i++) {
        const currentId = parseInt(values[i][0]) || 0;
        if (currentId > maxId) {
          maxId = currentId;
        }
      }
      
      // 為缺少 ID 的行分配新 ID
      for (let i = 1; i < values.length; i++) {
        if (!values[i][0] || values[i][0] === '') {
          maxId++;
          values[i][0] = maxId;
          updatedRows.push(i + 1);
        }
      }
      
      if (updatedRows.length > 0) {
        // 更新整個資料範圍
        payoutsSheet.getRange(1, 1, values.length, Math.max(values[0].length, expectedHeaders.length)).setValues(values);
        repairActions.push(`為 ${updatedRows.length} 筆記錄分配了新的 ID`);
      }
    }

    // 3. 確保所有列都有足夠的列數
    const currentCols = payoutsSheet.getLastColumn();
    if (currentCols < expectedHeaders.length) {
      repairActions.push(`擴展表格列數從 ${currentCols} 到 ${expectedHeaders.length}`);
    }

    return createJsonResponse({
      success: true,
      message: '修復完成',
      actions: repairActions,
      headers: expectedHeaders
    });

  } catch (error) {
    Logger.log('修復 Payouts 表格錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '修復失敗: ' + error.message
    });
  }
}

// ===== 佣金一致性審計功能 =====
function handleAuditCommissions(data, e) {
  try {
    Logger.log('🔍 開始佣金一致性審計');
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const partnersSheet = spreadsheet.getSheetByName('Partners');
    const payoutsSheet = spreadsheet.getSheetByName('Payouts');
    const bookingsSheet = spreadsheet.getSheetByName('Bookings');
    
    if (!partnersSheet || !payoutsSheet || !bookingsSheet) {
      return createJsonResponse({
        success: false,
        error: '找不到必要的工作表'
      });
    }
    
    const partnersData = getSheetData(spreadsheet, 'Partners');
    const payoutsData = getSheetData(spreadsheet, 'Payouts');
    const bookingsData = getSheetData(spreadsheet, 'Bookings');
    
    const auditResults = [];
    const discrepancies = [];
    
    // 對每個大使進行審計
    for (const partner of partnersData) {
      const partnerCode = partner.partner_code;
      if (!partnerCode) continue;
      
      // 從訂房記錄計算應得佣金
      const partnerBookings = bookingsData.filter(booking => 
        booking.partner_code === partnerCode && booking.stay_status === 'COMPLETED'
      );
      
      let calculatedTotalEarned = 0;
      const bookingCommissions = [];
      
      for (const booking of partnerBookings) {
        const commissionRate = COMMISSION_RATES[partner.level];
        if (commissionRate) {
          const commission = commissionRate.accommodation; // 使用住宿金作為基準
          calculatedTotalEarned += commission;
          bookingCommissions.push({
            booking_id: booking.ID,
            guest_name: booking.guest_name,
            commission: commission,
            checkin_date: booking.checkin_date
          });
        }
      }
      
      // 從結算記錄計算總結算金額
      const partnerPayouts = payoutsData.filter(payout => payout.partner_code === partnerCode);
      let calculatedTotalPayouts = 0;
      let manualAdjustments = 0;
      const payoutSummary = [];
      
      for (const payout of partnerPayouts) {
        const amount = parseFloat(payout.amount) || 0;
        
        if (payout.payout_method === 'MANUAL_ADJUSTMENT') {
          if (payout.payout_type === 'ACCOMMODATION' && payout.payout_status === 'COMPLETED') {
            manualAdjustments += amount; // 正向調整
          } else if (payout.payout_type === 'ADJUSTMENT_REVERSAL' && payout.payout_status === 'REVERSED') {
            manualAdjustments -= amount; // 反向調整
          }
        } else {
          calculatedTotalPayouts += amount;
        }
        
        payoutSummary.push({
          payout_id: payout.ID,
          type: payout.payout_type,
          method: payout.payout_method,
          status: payout.payout_status,
          amount: amount,
          notes: payout.notes
        });
      }
      
      // 計算預期值
      const expectedTotalEarned = calculatedTotalEarned + manualAdjustments;
      const expectedPendingCommission = expectedTotalEarned - calculatedTotalPayouts;
      
      // 實際值
      const actualTotalEarned = parseFloat(partner.total_commission_earned) || 0;
      const actualPendingCommission = parseFloat(partner.pending_commission) || 0;
      
      // 檢查是否有差異
      const totalEarnedDiff = Math.abs(expectedTotalEarned - actualTotalEarned);
      const pendingCommissionDiff = Math.abs(expectedPendingCommission - actualPendingCommission);
      const tolerance = 0.01; // 容許誤差
      
      const auditResult = {
        partner_code: partnerCode,
        partner_name: partner.name,
        bookings_count: partnerBookings.length,
        payouts_count: partnerPayouts.length,
        expected: {
          total_earned: expectedTotalEarned,
          pending_commission: Math.max(0, expectedPendingCommission)
        },
        actual: {
          total_earned: actualTotalEarned,
          pending_commission: actualPendingCommission
        },
        differences: {
          total_earned: expectedTotalEarned - actualTotalEarned,
          pending_commission: expectedPendingCommission - actualPendingCommission
        },
        has_discrepancy: totalEarnedDiff > tolerance || pendingCommissionDiff > tolerance,
        manual_adjustments: manualAdjustments,
        booking_commissions: bookingCommissions,
        payout_summary: payoutSummary
      };
      
      auditResults.push(auditResult);
      
      if (auditResult.has_discrepancy) {
        discrepancies.push(auditResult);
      }
    }
    
    const summaryStats = {
      total_partners_audited: auditResults.length,
      partners_with_discrepancies: discrepancies.length,
      accuracy_rate: auditResults.length > 0 ? 
        ((auditResults.length - discrepancies.length) / auditResults.length * 100).toFixed(1) + '%' : 
        '100%'
    };
    
    Logger.log('✅ 佣金審計完成: ' + auditResults.length + ' 個大使，' + discrepancies.length + ' 個差異');
    
    return createJsonResponse({
      success: true,
      message: '佣金一致性審計完成',
      summary: summaryStats,
      audit_results: auditResults,
      discrepancies: discrepancies,
      audit_timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    Logger.log('佣金審計錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '審計失敗: ' + error.message
    });
  }
}

// ===== 自動修復佣金差異 =====
function handleFixCommissionDiscrepancies(data, e) {
  try {
    Logger.log('🔧 開始自動修復佣金差異');
    
    // 先執行審計獲取差異
    const auditResponse = handleAuditCommissions(data, e);
    const auditData = JSON.parse(auditResponse.getContent());
    
    if (!auditData.success || auditData.discrepancies.length === 0) {
      return createJsonResponse({
        success: true,
        message: '沒有發現需要修復的佣金差異',
        discrepancies_found: 0
      });
    }
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const partnersSheet = spreadsheet.getSheetByName('Partners');
    const payoutsSheet = spreadsheet.getSheetByName('Payouts');
    
    const fixedDiscrepancies = [];
    const timestamp = new Date();
    
    for (const discrepancy of auditData.discrepancies) {
      const partnerCode = discrepancy.partner_code;
      
      // 找到夥伴記錄
      const partnerRange = partnersSheet.getDataRange();
      const partnerValues = partnerRange.getValues();
      let partnerRowIndex = -1;
      
      for (let i = 1; i < partnerValues.length; i++) {
        if (partnerValues[i][1] === partnerCode) {
          partnerRowIndex = i + 1;
          break;
        }
      }
      
      if (partnerRowIndex === -1) {
        Logger.log('⚠️ 找不到大使記錄: ' + partnerCode);
        continue;
      }
      
      // 修復累積佣金
      if (Math.abs(discrepancy.differences.total_earned) > 0.01) {
        const correctedTotalEarned = discrepancy.expected.total_earned;
        partnersSheet.getRange(partnerRowIndex, 10).setValue(correctedTotalEarned);
        
        // 創建修復記錄
        const adjustmentRecord = [
          '', // ID (自動編號)
          partnerCode,
          'SYSTEM_CORRECTION', // payout_type
          Math.abs(discrepancy.differences.total_earned), // amount
          '', // related_booking_ids
          'SYSTEM_AUDIT', // payout_method
          'COMPLETED', // payout_status
          '', '', '', // bank info
          `系統審計自動修復累積佣金差異: ${discrepancy.differences.total_earned > 0 ? '+' : ''}${discrepancy.differences.total_earned}`, // notes
          'system', // created_by
          timestamp, // created_at
          timestamp  // updated_at
        ];
        payoutsSheet.appendRow(adjustmentRecord);
      }
      
      // 修復待支付佣金
      if (Math.abs(discrepancy.differences.pending_commission) > 0.01) {
        const correctedPendingCommission = Math.max(0, discrepancy.expected.pending_commission);
        partnersSheet.getRange(partnerRowIndex, 12).setValue(correctedPendingCommission);
      }
      
      // 更新時間戳
      partnersSheet.getRange(partnerRowIndex, 25).setValue(timestamp);
      
      fixedDiscrepancies.push({
        partner_code: partnerCode,
        corrections: {
          total_earned: discrepancy.differences.total_earned,
          pending_commission: discrepancy.differences.pending_commission
        }
      });
      
      Logger.log('✅ 已修復大使 ' + partnerCode + ' 的佣金差異');
    }
    
    return createJsonResponse({
      success: true,
      message: '佣金差異修復完成',
      discrepancies_found: auditData.discrepancies.length,
      discrepancies_fixed: fixedDiscrepancies.length,
      fixed_partners: fixedDiscrepancies,
      fixed_at: timestamp.toISOString()
    });
    
  } catch (error) {
    Logger.log('修復佣金差異錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '修復失敗: ' + error.message
    });
  }
}

// ===== 重建 Payouts 表格數據 =====
function handleRebuildPayouts(data, e) {
  try {
    Logger.log('🔄 開始重建 Payouts 表格');
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const payoutsSheet = spreadsheet.getSheetByName('Payouts');
    const bookingsSheet = spreadsheet.getSheetByName('Bookings');
    const partnersSheet = spreadsheet.getSheetByName('Partners');
    
    if (!payoutsSheet || !bookingsSheet || !partnersSheet) {
      return createJsonResponse({
        success: false,
        error: '找不到必要的工作表'
      });
    }
    
    // 1. 清空並重建 Payouts 表格結構
    const expectedHeaders = [
      'ID', 'partner_code', 'payout_type', 'amount', 'related_booking_ids',
      'payout_method', 'payout_status', 'bank_transfer_date', 'bank_transfer_reference',
      'accommodation_voucher_code', 'notes', 'created_by', 'created_at', 'updated_at'
    ];
    
    payoutsSheet.clear();
    payoutsSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    Logger.log('✅ Payouts 表格結構已重建');
    
    // 2. 從已完成的訂房記錄重建結算記錄
    const bookingsData = getSheetData(spreadsheet, 'Bookings');
    const partnersData = getSheetData(spreadsheet, 'Partners');
    const timestamp = new Date();
    
    let rebuildCount = 0;
    let payoutId = 1;
    
    for (const booking of bookingsData) {
      if (booking.stay_status === 'COMPLETED' && booking.partner_code && booking.commission_amount > 0) {
        // 找到對應的大使
        const partner = partnersData.find(p => p.partner_code === booking.partner_code);
        if (!partner) continue;
        
        // 創建結算記錄
        const payoutData = [
          payoutId++, // ID
          booking.partner_code, // partner_code
          booking.commission_type || 'ACCOMMODATION', // payout_type
          booking.commission_amount, // amount
          booking.ID || '', // related_booking_ids
          booking.commission_type === 'CASH' ? 'BANK_TRANSFER' : 'ACCOMMODATION_VOUCHER', // payout_method
          'PENDING', // payout_status
          '', // bank_transfer_date
          '', // bank_transfer_reference
          '', // accommodation_voucher_code
          `入住確認佣金 - 訂房 #${booking.ID} (${booking.guest_name})`, // notes
          booking.manually_confirmed_by || 'admin', // created_by
          booking.manually_confirmed_at || timestamp, // created_at
          timestamp // updated_at
        ];
        
        payoutsSheet.appendRow(payoutData);
        rebuildCount++;
        
        Logger.log('📝 重建結算記錄: ' + booking.partner_code + ', $' + booking.commission_amount);
      }
    }
    
    Logger.log('✅ Payouts 重建完成: ' + rebuildCount + ' 筆記錄');
    
    return createJsonResponse({
      success: true,
      message: 'Payouts 表格重建完成',
      records_rebuilt: rebuildCount,
      headers_set: expectedHeaders.length,
      rebuilt_at: timestamp.toISOString()
    });
    
  } catch (error) {
    Logger.log('重建 Payouts 錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '重建失敗: ' + error.message
    });
  }
}

// ===== 處理住宿金點數抵扣 =====
function handleDeductAccommodationPoints(data, e) {
  try {
    Logger.log('🏨 開始處理住宿金點數抵扣請求');
    Logger.log('請求數據: ' + JSON.stringify(data));
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const partnersSheet = spreadsheet.getSheetByName('Partners');
    
    // 創建或獲取住宿金使用記錄表
    let accommodationUsageSheet = spreadsheet.getSheetByName('Accommodation_Usage');
    if (!accommodationUsageSheet) {
      accommodationUsageSheet = spreadsheet.insertSheet('Accommodation_Usage');
      Logger.log('✅ 創建新的 Accommodation_Usage 工作表');
    }
    
    // ✅ 檢查並更新表格標題行結構
    const expectedHeaders = [
      'id', 'partner_code', 'deduct_amount', 'related_booking_id', 
      'usage_date', 'usage_type', 'notes', 'created_by', 'created_at', 'updated_at'
    ];
    
    const currentHeaders = accommodationUsageSheet.getLastRow() > 0 ? 
      accommodationUsageSheet.getRange(1, 1, 1, accommodationUsageSheet.getLastColumn()).getValues()[0] : [];
    
    const headersMatch = JSON.stringify(currentHeaders.slice(0, expectedHeaders.length)) === JSON.stringify(expectedHeaders);
    
    if (!headersMatch) {
      Logger.log('⚠️ Accommodation_Usage 表格結構需要更新');
      Logger.log('當前標題: ' + JSON.stringify(currentHeaders));
      Logger.log('預期標題: ' + JSON.stringify(expectedHeaders));
      
      // 備份現有數據（如果有的話）
      const existingData = accommodationUsageSheet.getLastRow() > 1 ? 
        accommodationUsageSheet.getRange(2, 1, accommodationUsageSheet.getLastRow() - 1, accommodationUsageSheet.getLastColumn()).getValues() : [];
      
      // 清除並重建表格結構
      accommodationUsageSheet.clear();
      accommodationUsageSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      
      // 恢復現有數據（如果有的話且結構兼容）
      if (existingData.length > 0) {
        Logger.log(`🔄 恢復 ${existingData.length} 筆現有數據`);
        // 根據舊結構調整數據到新結構
        accommodationUsageSheet.getRange(2, 1, existingData.length, existingData[0].length).setValues(existingData);
      }
      
      Logger.log('✅ Accommodation_Usage 表格結構已更新');
    }
    
    if (!partnersSheet || !accommodationUsageSheet) {
      return createJsonResponse({
        success: false,
        error: '找不到必要的工作表'
      });
    }
    
    const partnerCode = data.partner_code;
    const deductAmount = parseFloat(data.deduct_amount) || 0;
    const relatedBookingId = data.related_booking_id || '';
    const usageDate = data.usage_date || '';
    const notes = data.notes || '';
    
    if (!partnerCode || deductAmount <= 0) {
      return createJsonResponse({
        success: false,
        error: '缺少必要參數或金額無效'
      });
    }
    
    // ✅ 查找夥伴記錄並驗證餘額
    const partnerRange = partnersSheet.getDataRange();
    const partnerValues = partnerRange.getValues();
    let partnerRowIndex = -1;
    let currentEarned = 0;
    let currentPaid = 0;
    
    for (let i = 1; i < partnerValues.length; i++) {
      if (partnerValues[i][1] === partnerCode) { // B欄位是 partner_code
        partnerRowIndex = i + 1; // 轉換為 1-based 索引
        currentEarned = parseFloat(partnerValues[i][9]) || 0; // J欄位 total_commission_earned
        currentPaid = parseFloat(partnerValues[i][10]) || 0;  // K欄位 total_commission_paid
        break;
      }
    }
    
    if (partnerRowIndex === -1) {
      return createJsonResponse({
        success: false,
        error: '找不到指定的夥伴代碼: ' + partnerCode
      });
    }
    
    // ✅ 檢查餘額是否足夠
    const availableBalance = currentEarned - currentPaid;
    if (deductAmount > availableBalance) {
      return createJsonResponse({
        success: false,
        error: `餘額不足。可用：$${availableBalance.toLocaleString()}，要扣除：$${deductAmount.toLocaleString()}`
      });
    }
    
    const timestamp = new Date();
    
    // 1. 記錄住宿金使用 - 添加住宿日期
    const usageData = [
      '', // ID (自動編號)
      partnerCode,
      deductAmount,
      relatedBookingId,
      usageDate, // ✅ 住宿日期
      'DEDUCTION', // usage_type
      notes,
      'admin', // created_by
      timestamp, // created_at
      timestamp  // updated_at
    ];
    
    accommodationUsageSheet.appendRow(usageData);
    Logger.log('✅ 住宿金使用記錄已創建');
    
    // ✅ 2. 更新夥伴的 total_commission_paid 統計
    const newPaid = currentPaid + deductAmount;
    partnersSheet.getRange(partnerRowIndex, 11).setValue(newPaid); // K欄位
    
    Logger.log(`✅ 更新 ${partnerCode} 的 total_commission_paid: ${currentPaid} → ${newPaid}`);
    Logger.log(`💰 住宿金餘額: ${availableBalance} → ${availableBalance - deductAmount}`);
    
    const result = {
      success: true,
      message: '住宿金點數抵扣記錄成功',
      partner_code: partnerCode,
      deduct_amount: deductAmount,
      usage_date: usageDate,
      before_balance: availableBalance,
      after_balance: availableBalance - deductAmount,
      created_at: timestamp.toISOString()
    };
    
    // ✅ 修復：統一返回 JSON 回應，避免 HTML 頁面跳出
    return createJsonResponse(result);
    
  } catch (error) {
    Logger.log('住宿金點數抵扣錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '住宿金點數抵扣失敗: ' + error.message
    });
  }
}

// ===== 測試函數 =====

function testDeleteWithCorrectDate() {
  // 根據執行記錄，che min chiu 電話３３３的記錄入住日期是2025-08-12
  const testData = {
    action: 'delete_booking',
    guest_name: 'che min chiu',
    guest_phone: '３３３',
    checkin_date: '2025-08-12'  // 使用正確的日期
  };
  
  Logger.log('=== 使用正確日期測試刪除 ===');
  try {
    const result = handleDeleteBooking(testData, { parameter: testData });
    Logger.log('刪除測試結果: ' + result.getContent());
  } catch (error) {
    Logger.log('刪除測試失敗: ' + error.toString());
  }
}
function testCommissionSystem() {
  Logger.log('=== 測試佣金系統 ===');
  
  // 測試建立訂房
  const bookingData = {
    action: 'create_booking',
    partner_code: 'TEST001',
    guest_name: '測試房客',
    guest_phone: '0912345678',
    checkin_date: '2024-03-01',
    checkout_date: '2024-03-03',
    room_price: 5000,
    booking_source: 'MANUAL_ENTRY'
  };
  
  try {
    const result = handleCreateBooking(bookingData, { parameter: bookingData });
    Logger.log('測試建立訂房結果: ' + result.getContent());
  } catch (error) {
    Logger.log('測試建立訂房失敗: ' + error.toString());
  }
}