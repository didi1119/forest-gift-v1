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
    const partnerData = [
      '', // ID (自動編號)
      data.partner_code || 'UNKNOWN',
      data.name || '',
      data.email || '',
      data.phone || '',
      'LV1_INSIDER', // level - 預設為 LV1
      0, // level_progress - 本年度成功推薦數
      0, // total_successful_referrals - 累積成功推薦數
      'CASH', // commission_preference - 預設現金
      0, // total_commission_earned - 累積佣金總額
      0, // total_commission_paid - 已支付佣金總額
      0, // pending_commission - 未支付佣金總額
      '', // bank_name - 銀行名稱
      '', // bank_branch - 分行
      '', // account_holder - 戶名
      '', // account_number - 帳號
      false, // first_referral_bonus_claimed - 是否已領取首次推薦獎勵
      'active', // status
      data.landing_link || '',
      data.coupon_link || '',
      data.coupon_code || '',
      data.coupon_url || '',
      data.notes || '',
      timestamp, // created_at
      timestamp  // updated_at
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
      '', // ID (自動編號)
      data.partner_code || null, // partner_code
      data.guest_name || '',
      data.guest_phone || '',
      data.guest_email || '',
      data.checkin_date || '',
      data.checkout_date || '',
      parseInt(data.room_price) || 0, // room_price
      data.booking_source || 'MANUAL_ENTRY',
      data.stay_status || 'PENDING', // stay_status
      data.payment_status || 'PENDING', // payment_status
      'NOT_ELIGIBLE', // commission_status - 預設不符合
      0, // commission_amount - 預設0
      'CASH', // commission_type - 預設現金
      false, // is_first_referral_bonus
      0, // first_referral_bonus_amount
      '', // manually_confirmed_by
      '', // manually_confirmed_at
      data.notes || '',
      timestamp, // created_at
      timestamp  // updated_at
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
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const bookingsSheet = spreadsheet.getSheetByName('Bookings');
    const partnersSheet = spreadsheet.getSheetByName('Partners');
    const payoutsSheet = spreadsheet.getSheetByName('Payouts');
    
    if (!bookingsSheet || !partnersSheet || !payoutsSheet) {
      return createJsonResponse({
        success: false,
        error: '找不到必要的工作表'
      });
    }
    
    const bookingId = parseInt(data.booking_id);
    const timestamp = new Date();
    
    // 1. 更新訂房狀態
    const bookingRange = bookingsSheet.getDataRange();
    const bookingValues = bookingRange.getValues();
    let bookingRowIndex = -1;
    let bookingData = null;
    
    for (let i = 1; i < bookingValues.length; i++) {
      if (bookingValues[i][0] === bookingId) { // 假設ID在第一列
        bookingRowIndex = i + 1; // Google Sheets 行數從1開始
        bookingData = bookingValues[i];
        break;
      }
    }
    
    if (bookingRowIndex === -1) {
      return createJsonResponse({
        success: false,
        error: '找不到指定的訂房記錄'
      });
    }
    
    // 更新訂房狀態為已完成
    bookingsSheet.getRange(bookingRowIndex, 10).setValue('COMPLETED'); // stay_status
    bookingsSheet.getRange(bookingRowIndex, 12).setValue('CALCULATED'); // commission_status
    bookingsSheet.getRange(bookingRowIndex, 13).setValue(data.commission_amount || 0); // commission_amount
    bookingsSheet.getRange(bookingRowIndex, 14).setValue(data.commission_type || 'CASH'); // commission_type
    bookingsSheet.getRange(bookingRowIndex, 15).setValue(data.is_first_referral_bonus || false); // is_first_referral_bonus
    bookingsSheet.getRange(bookingRowIndex, 16).setValue(data.first_referral_bonus_amount || 0); // first_referral_bonus_amount
    bookingsSheet.getRange(bookingRowIndex, 17).setValue('admin'); // manually_confirmed_by
    bookingsSheet.getRange(bookingRowIndex, 18).setValue(timestamp); // manually_confirmed_at
    bookingsSheet.getRange(bookingRowIndex, 21).setValue(timestamp); // updated_at
    
    let result = {
      success: true,
      message: '入住確認完成',
      booking_id: bookingId,
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
            bookingId.toString(), // related_booking_ids
            data.commission_type === 'CASH' ? 'BANK_TRANSFER' : 'ACCOMMODATION_VOUCHER', // payout_method
            'PENDING', // payout_status
            '', // bank_transfer_date
            '', // bank_transfer_reference
            '', // accommodation_voucher_code
            `入住確認佣金 - 訂房 #${bookingId}`, // notes
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
          <p>訂房ID：${bookingId}</p>
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

// ===== 輔助函數 =====
function createJsonResponse(data) {
  const jsonString = JSON.stringify(data);
  Logger.log('建立 JSON 回應: ' + jsonString);
  
  return ContentService
    .createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
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
    if (!partnerCode) return null;
    
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    if (!sheet) return null;
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    // 查找對應的夥伴代碼
    for (let i = 1; i < values.length; i++) {
      if (values[i][1] === partnerCode) { // 假設partner_code在第二列
        return values[i][21] || null; // 假設coupon_url在第22列
      }
    }
    
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

// ===== 測試函數 =====
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