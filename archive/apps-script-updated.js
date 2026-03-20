/**
 * 靜謐森林知音計畫 - Apps Script Web App (更新版)
 * 支援動態優惠券連結和修正跳轉問題
 */

// 設定您的 Google Sheets ID
const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
const GITHUB_PAGES_URL = 'https://didi1119.github.io/forest-gift-v1';
const DEFAULT_LINE_COUPON_URL = 'https://lin.ee/q38pqot'; // 預設優惠券

/**
 * Web App 主要處理函數 (修正版)
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    
    // 記錄點擊事件
    if (params.pid || params.subid) {
      recordClick(params);
    }
    
    // 根據 dest 參數決定跳轉目標
    const destination = params.dest || 'landing';
    let redirectUrl;
    
    switch (destination) {
      case 'coupon':
        // 支援動態優惠券連結
        redirectUrl = params.target || DEFAULT_LINE_COUPON_URL;
        break;
      case 'landing':
      default:
        // 建構帶有推薦參數的主頁連結
        const subid = params.pid || params.subid || '';
        redirectUrl = subid ? 
          `${GITHUB_PAGES_URL}?subid=${encodeURIComponent(subid)}` : 
          GITHUB_PAGES_URL;
        break;
    }
    
    // 修正跳轉方式 - 使用多種方法確保跳轉成功
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="refresh" content="0; url=${redirectUrl}">
          <title>跳轉中...</title>
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>🌲 靜謐森林</h2>
          <p>跳轉中，請稍候...</p>
          <p><a href="${redirectUrl}" style="color: #2E4B36; text-decoration: none;">如果沒有自動跳轉，請點擊這裡</a></p>
          <script>
            // 多種跳轉方式確保成功
            setTimeout(function() {
              try {
                window.top.location.href = "${redirectUrl}";
              } catch(e) {
                try {
                  window.location.replace("${redirectUrl}");
                } catch(e2) {
                  window.location.href = "${redirectUrl}";
                }
              }
            }, 100);
          </script>
        </body>
      </html>
    `).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
  } catch (error) {
    Logger.log('doGet Error: ' + error.toString());
    
    // 錯誤時重新導向到主頁
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0; url=${GITHUB_PAGES_URL}">
        </head>
        <body>
          <script>window.location.replace("${GITHUB_PAGES_URL}");</script>
        </body>
      </html>
    `);
  }
}

/**
 * 處理 POST 請求（用於儲存夥伴資料等）
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    switch (data.action) {
      case 'create_partner':
        return createPartner(data);
      case 'get_stats':
        return getPartnerStats(data);
      default:
        throw new Error('Unknown action: ' + data.action);
    }
    
  } catch (error) {
    Logger.log('doPost Error: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 記錄點擊事件 (更新版)
 */
function recordClick(params) {
  try {
    const sheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Clicks');
    
    const timestamp = new Date();
    const partnerCode = params.pid || params.subid || 'UNKNOWN';
    const destination = params.dest || 'landing';
    
    // 記錄目標 URL（如果是優惠券點擊）
    const targetUrl = params.target || '';
    
    const clickData = [
      '', // click_id - 由 Sheets 自動編號
      partnerCode,
      timestamp,
      '', // ip_address - Apps Script 無法取得
      '', // user_agent - Apps Script 無法取得  
      params.referrer || '',
      destination,
      params.utm_source || '',
      params.utm_medium || '',
      params.utm_campaign || '',
      Utilities.getUuid(), // session_id
      '', // country
      '', // city
      '', // device_type
      'pending', // conversion_status
      timestamp,
      targetUrl // 新增：記錄實際目標 URL
    ];
    
    sheet.appendRow(clickData);
    Logger.log('Click recorded: ' + JSON.stringify({
      partner: partnerCode,
      dest: destination,
      target: targetUrl
    }));
    
  } catch (error) {
    Logger.log('recordClick Error: ' + error.toString());
  }
}

/**
 * 建立新的夥伴資料 (更新版)
 */
function createPartner(data) {
  try {
    const sheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Partners');
    
    const timestamp = new Date();
    const partnerData = [
      '', // partner_id - 由 Sheets 自動編號
      data.partner_code,
      data.name,
      data.email || '',
      data.phone || '',
      timestamp, // join_date
      'LV1_INSIDER', // level
      'active', // status
      0, // total_referrals
      0, // successful_referrals
      0, // current_year_referrals
      data.landing_link || '',
      data.coupon_link || '',
      data.coupon_code || '',
      data.coupon_url || '', // 新增：專屬優惠券 URL
      data.notes || '',
      timestamp, // created_at
      timestamp  // updated_at
    ];
    
    sheet.appendRow(partnerData);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: '夥伴資料建立成功',
        partner_code: data.partner_code
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('createPartner Error: ' + error.toString());
    throw error;
  }
}

/**
 * 取得夥伴統計資料
 */
function getPartnerStats(data) {
  try {
    const clicksSheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Clicks');
    const partnersSheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Partners');
    
    const allClicks = clicksSheet.getDataRange().getValues();
    const partnerClicks = allClicks.filter(row => row[1] === data.partner_code);
    
    const stats = {
      total_clicks: partnerClicks.length,
      today_clicks: partnerClicks.filter(row => {
        const clickDate = new Date(row[2]);
        const today = new Date();
        return clickDate.toDateString() === today.toDateString();
      }).length,
      conversions: partnerClicks.filter(row => row[14] === 'converted').length,
      coupon_clicks: partnerClicks.filter(row => row[6] === 'coupon').length
    };
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        stats: stats
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('getPartnerStats Error: ' + error.toString());
    throw error;
  }
}

/**
 * 測試函數 - 用於初始化和測試
 */
function testFunction() {
  console.log('🌲 Apps Script 測試開始');
  console.log('SHEETS_ID: ' + SHEETS_ID);
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    console.log('✅ Sheets 連線成功：' + spreadsheet.getName());
    
    const sheets = ['Partners', 'Clicks', 'Bookings', 'Payouts'];
    sheets.forEach(sheetName => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (sheet) {
        console.log(`✅ ${sheetName} 工作表存在，行數：${sheet.getLastRow()}`);
      } else {
        console.log(`❌ 警告：${sheetName} 工作表不存在`);
      }
    });
    
    console.log('✅ 所有測試完成');
    
  } catch (error) {
    console.log('❌ Sheets 連線失敗：' + error.toString());
  }
  
  return '測試完成，請查看執行記錄';
}