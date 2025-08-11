/**
 * 靜謐森林知音計畫 - Apps Script Web App (簡化跳轉版)
 * 使用 302 重定向確保跳轉成功
 */

// 設定您的 Google Sheets ID
const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
const GITHUB_PAGES_URL = 'https://didi1119.github.io/forest-gift-v1';
const DEFAULT_LINE_COUPON_URL = 'https://lin.ee/q38pqot';

/**
 * Web App 主要處理函數 - 使用 302 重定向
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
    
    // 使用 302 重定向（最可靠的方式）
    return HtmlService.createHtmlOutput(
      ScriptApp.newRedirectUrl(redirectUrl)
    );
    
  } catch (error) {
    Logger.log('doGet Error: ' + error.toString());
    
    // 錯誤時使用備用跳轉方法
    return ContentService
      .createTextOutput('Redirecting...')
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * 備用方案：如果上面的方法不行，試試這個版本
 */
function doGetAlternative(e) {
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
        redirectUrl = params.target || DEFAULT_LINE_COUPON_URL;
        break;
      case 'landing':
      default:
        const subid = params.pid || params.subid || '';
        redirectUrl = subid ? 
          `${GITHUB_PAGES_URL}?subid=${encodeURIComponent(subid)}` : 
          GITHUB_PAGES_URL;
        break;
    }
    
    // 建立一個簡單的 HTML 頁面來處理跳轉
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>跳轉中...</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 50px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 10px;
              display: inline-block;
            }
            a {
              color: #2E4B36;
              font-size: 18px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>🌲 靜謐森林</h2>
            <p>正在跳轉到目標頁面...</p>
            <p><a href="${redirectUrl}" id="redirectLink">如果沒有自動跳轉，請點擊這裡</a></p>
          </div>
          <script>
            // 立即執行跳轉
            window.location.href = "${redirectUrl}";
          </script>
        </body>
      </html>
    `;
    
    return HtmlService
      .createHtmlOutput(html)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
  } catch (error) {
    Logger.log('doGet Error: ' + error.toString());
    return HtmlService.createHtmlOutput('Error: ' + error.toString());
  }
}

/**
 * 記錄點擊事件
 */
function recordClick(params) {
  try {
    const sheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Clicks');
    
    const timestamp = new Date();
    const partnerCode = params.pid || params.subid || 'UNKNOWN';
    const destination = params.dest || 'landing';
    const targetUrl = params.target || '';
    
    const clickData = [
      '', // click_id
      partnerCode,
      timestamp,
      '', // ip_address
      '', // user_agent
      params.referrer || '',
      destination,
      params.utm_source || '',
      params.utm_medium || '',
      params.utm_campaign || '',
      Utilities.getUuid(),
      '', // country
      '', // city
      '', // device_type
      'pending',
      timestamp,
      targetUrl // 記錄目標 URL
    ];
    
    sheet.appendRow(clickData);
    Logger.log('Click recorded: ' + JSON.stringify({
      partner: partnerCode,
      dest: destination,
      target: targetUrl,
      timestamp: timestamp
    }));
    
  } catch (error) {
    Logger.log('recordClick Error: ' + error.toString());
  }
}

/**
 * 處理 POST 請求
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
 * 建立新的夥伴資料
 */
function createPartner(data) {
  try {
    const sheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Partners');
    
    const timestamp = new Date();
    const partnerData = [
      '', // partner_id
      data.partner_code,
      data.name,
      data.email || '',
      data.phone || '',
      timestamp,
      'LV1_INSIDER',
      'active',
      0,
      0,
      0,
      data.landing_link || '',
      data.coupon_link || '',
      data.coupon_code || '',
      data.coupon_url || '', // 專屬優惠券 URL
      data.notes || '',
      timestamp,
      timestamp
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
 * 測試函數
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
    
    // 測試跳轉 URL 生成
    console.log('\n測試 URL 生成：');
    console.log('Landing: ' + GITHUB_PAGES_URL + '?subid=TEST001');
    console.log('Coupon: ' + DEFAULT_LINE_COUPON_URL);
    
    console.log('\n✅ 所有測試完成');
    
  } catch (error) {
    console.log('❌ 測試失敗：' + error.toString());
  }
  
  return '測試完成，請查看執行記錄';
}

/**
 * 手動測試跳轉
 */
function testRedirect() {
  // 模擬參數
  const testParams = {
    parameter: {
      pid: 'TEST001',
      dest: 'coupon',
      target: 'https://lin.ee/q38pqot'
    }
  };
  
  const result = doGetAlternative(testParams);
  console.log('測試結果：', result.getContent());
  return result;
}