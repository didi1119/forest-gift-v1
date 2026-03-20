/**
 * 靜謐森林知音計畫 - Apps Script Web App (最終修正版)
 * 修正 URL 轉義問題和跳轉邏輯
 */

// 設定您的 Google Sheets ID
const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
const GITHUB_PAGES_URL = 'https://didi1119.github.io/forest-gift-v1';
const DEFAULT_LINE_COUPON_URL = 'https://lin.ee/q38pqot';

/**
 * Web App 主要處理函數 - 修正版
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    
    // 非阻塞式記錄點擊
    if (params.pid || params.subid) {
      try {
        recordClick(params);
      } catch (recordError) {
        Logger.log('Record click failed: ' + recordError);
        // 不要讓記錄失敗影響跳轉
      }
    }

    const destination = params.dest || 'landing';
    const subid = params.pid || params.subid || '';
    let redirectUrl;

    if (destination === 'coupon') {
      // 允許的目標域名白名單
      const allowedHosts = ['lin.ee', 'line.me', 'didi1119.github.io', 'github.io'];
      
      // 正確解碼 target 參數
      let targetUrl = DEFAULT_LINE_COUPON_URL;
      if (params.target) {
        try {
          // 嘗試解碼（可能已經被編碼）
          targetUrl = decodeURIComponent(params.target);
        } catch (e) {
          // 如果解碼失敗，使用原始值
          targetUrl = params.target;
        }
      }
      
      // 驗證 URL
      const parsedUrl = safeParseUrl(targetUrl);
      if (parsedUrl && allowedHosts.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h))) {
        redirectUrl = targetUrl;
      } else {
        Logger.log('Invalid target URL: ' + targetUrl + ' (hostname: ' + (parsedUrl ? parsedUrl.hostname : 'null') + ')');
        redirectUrl = DEFAULT_LINE_COUPON_URL;
      }
    } else {
      // 主頁連結
      redirectUrl = GITHUB_PAGES_URL + (subid ? `?subid=${encodeURIComponent(subid)}` : '');
    }

    // 記錄實際要跳轉的 URL
    Logger.log('Redirecting to: ' + redirectUrl);

    // 生成安全的 HTML
    const html = renderRedirectPage(redirectUrl);
    return HtmlService.createHtmlOutput(html)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    Logger.log('doGet Error: ' + err.toString());
    // 發生錯誤時跳轉到主頁
    return HtmlService.createHtmlOutput(renderRedirectPage(GITHUB_PAGES_URL));
  }
}

/**
 * HTML 屬性轉義
 */
function htmlEscapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * JavaScript 字串轉義
 */
function jsStringLiteral(s) {
  // 使用 JSON.stringify 確保 JS 字串安全
  return JSON.stringify(String(s));
}

/**
 * 安全解析 URL
 */
function safeParseUrl(s) {
  try { 
    return new URL(s); 
  } catch(e) { 
    return null; 
  }
}

/**
 * 生成跳轉頁面 HTML
 */
function renderRedirectPage(url) {
  const urlAttr = htmlEscapeAttr(url);     // 用在 HTML 屬性
  const urlJs = jsStringLiteral(url);      // 用在 JavaScript

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0; url=${urlAttr}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>跳轉中...</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        display: flex;
        min-height: 100vh;
        align-items: center;
        justify-content: center;
        background: #f6f7f6;
        color: #1f2d24;
        margin: 0;
        padding: 20px;
      }
      .card {
        background: #fff;
        padding: 40px 30px;
        border-radius: 16px;
        box-shadow: 0 6px 24px rgba(0,0,0,.08);
        text-align: center;
        max-width: 520px;
        width: 100%;
      }
      h2 {
        margin: 0 0 20px;
        color: #2E4B36;
      }
      p {
        margin: 10px 0;
        color: #666;
      }
      .btn {
        display: inline-block;
        margin-top: 20px;
        padding: 12px 24px;
        border-radius: 10px;
        border: 2px solid #2E4B36;
        color: #2E4B36;
        text-decoration: none;
        font-weight: 500;
        transition: all 0.3s ease;
      }
      .btn:hover {
        background: #2E4B36;
        color: white;
      }
      .spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #2E4B36;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: 10px;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🌲 靜謐森林</h2>
      <p><span class="spinner"></span>正在為您開啟頁面...</p>
      <p>請稍候片刻</p>
      <a class="btn" href="${urlAttr}">如果沒有自動跳轉，請點擊這裡</a>
    </div>
    <script>
      (function() {
        // 偵測 in-app browser
        var ua = navigator.userAgent || "";
        var inApp = /FBAN|FBAV|Instagram|Line|MicroMessenger|WhatsApp/i.test(ua);
        
        // 目標 URL
        var targetUrl = ${urlJs};
        
        // 記錄嘗試
        console.log('Attempting redirect to:', targetUrl);
        console.log('In-app browser detected:', inApp);
        
        // 策略1: 立即嘗試 location.replace
        try {
          window.location.replace(targetUrl);
        } catch(e) {
          console.log('Replace failed:', e);
        }
        
        // 策略2: 100ms 後嘗試 top.location
        setTimeout(function() {
          try {
            if (window.top && window.top.location) {
              window.top.location.href = targetUrl;
            }
          } catch(e) {
            console.log('Top location failed:', e);
          }
        }, 100);
        
        // 策略3: 300ms 後嘗試 location.href
        setTimeout(function() {
          try {
            if (document.visibilityState !== 'hidden') {
              window.location.href = targetUrl;
            }
          } catch(e) {
            console.log('Location.href failed:', e);
          }
        }, 300);
        
        // 策略4: 如果是 in-app browser，再多試一次
        if (inApp) {
          setTimeout(function() {
            if (document.visibilityState !== 'hidden') {
              // 嘗試開新視窗
              try {
                window.open(targetUrl, '_blank');
              } catch(e) {
                console.log('Window.open failed:', e);
              }
            }
          }, 700);
        }
      })();
    </script>
  </body>
</html>`;
}

/**
 * 記錄點擊事件（非阻塞）
 */
function recordClick(params) {
  try {
    const sheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Clicks');
    if (!sheet) {
      Logger.log('Clicks sheet not found');
      return;
    }
    
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
      targetUrl
    ];
    
    sheet.appendRow(clickData);
    Logger.log('Click recorded successfully');
    
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
    if (!sheet) {
      throw new Error('Partners sheet not found');
    }
    
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
      data.coupon_url || '',
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
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 取得夥伴統計資料
 */
function getPartnerStats(data) {
  try {
    const clicksSheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Clicks');
    if (!clicksSheet) {
      throw new Error('Clicks sheet not found');
    }
    
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
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
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
    
    console.log('\n✅ 所有測試完成');
    
  } catch (error) {
    console.log('❌ 測試失敗：' + error.toString());
  }
  
  return '測試完成，請查看執行記錄';
}

/**
 * 測試跳轉邏輯
 */
function testRedirect() {
  // 測試案例1: 普通跳轉
  const test1 = {
    parameter: {
      pid: 'TEST001',
      dest: 'landing'
    }
  };
  
  // 測試案例2: 優惠券跳轉
  const test2 = {
    parameter: {
      pid: 'TEST002',
      dest: 'coupon',
      target: 'https://lin.ee/q38pqot'
    }
  };
  
  // 測試案例3: 編碼的 URL
  const test3 = {
    parameter: {
      pid: 'TEST003',
      dest: 'coupon',
      target: encodeURIComponent('https://lin.ee/q38pqot')
    }
  };
  
  console.log('Test 1 (Landing):');
  doGet(test1);
  
  console.log('\nTest 2 (Coupon):');
  doGet(test2);
  
  console.log('\nTest 3 (Encoded URL):');
  doGet(test3);
  
  return '測試完成，請查看執行記錄';
}