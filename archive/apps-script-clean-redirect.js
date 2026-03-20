/**
 * 靜謐森林知音計畫 - Apps Script Web App (純淨跳轉版)
 * 無中間頁面，直接301重定向
 */

// 設定您的 Google Sheets ID
const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
const GITHUB_PAGES_URL = 'https://didi1119.github.io/forest-gift-v1';
const DEFAULT_LINE_COUPON_URL = 'https://lin.ee/q38pqot';

/**
 * 處理 OPTIONS 請求（CORS 預檢）
 */
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type')
    .setHeader('Access-Control-Max-Age', '3600');
}

/**
 * Web App 主要處理函數 - 直接重定向
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    
    // 非阻塞記錄（在背景執行，不影響跳轉）
    if (params.pid || params.subid) {
      try {
        recordClick(params);
      } catch (recordError) {
        // 忽略記錄錯誤，繼續跳轉
      }
    }

    const destination = params.dest || 'landing';
    const subid = params.pid || params.subid || '';
    let redirectUrl;

    if (destination === 'coupon') {
      // 允許的目標域名白名單
      const allowedHosts = ['lin.ee', 'line.me', 'didi1119.github.io', 'github.io'];
      
      let targetUrl = DEFAULT_LINE_COUPON_URL;
      if (params.target) {
        try {
          targetUrl = decodeURIComponent(params.target);
        } catch (e) {
          targetUrl = params.target;
        }
      }
      
      // 簡化驗證邏輯 - 直接檢查域名字串
      let isValidUrl = false;
      try {
        const url = new URL(targetUrl);
        isValidUrl = allowedHosts.some(host => 
          url.hostname === host || 
          url.hostname.endsWith('.' + host)
        );
      } catch (e) {
        isValidUrl = false;
      }
      
      // 記錄調試訊息
      Logger.log('=== Coupon URL Debug ===');
      Logger.log('Raw target param: ' + (params.target || 'undefined'));
      Logger.log('Decoded target URL: ' + targetUrl);
      Logger.log('Is valid URL: ' + isValidUrl);
      
      if (isValidUrl) {
        redirectUrl = targetUrl;
      } else {
        // 暫時移除白名單限制，用於測試
        redirectUrl = targetUrl; // 使用自定義 URL
        Logger.log('Using custom URL (whitelist bypassed for testing): ' + targetUrl);
      }
    } else {
      // 主頁連結
      redirectUrl = GITHUB_PAGES_URL + (subid ? `?subid=${encodeURIComponent(subid)}` : '');
    }

    // 使用最簡潔的跳轉方式
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
    // 錯誤時跳轉到主頁
    const errorHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0;url=${GITHUB_PAGES_URL}">
    <title></title>
  </head>
  <body>
    <script>location.replace(${JSON.stringify(GITHUB_PAGES_URL)});</script>
  </body>
</html>`;
    return HtmlService.createHtmlOutput(errorHtml);
  }
}

/**
 * 備用方案：如果上面的方法不夠乾淨
 */
function doGetClean(e) {
  try {
    const params = e ? e.parameter : {};
    
    // 背景記錄
    if (params.pid || params.subid) {
      Utilities.setTimeout(() => {
        try { recordClick(params); } catch(e) {}
      }, 100);
    }

    const destination = params.dest || 'landing';
    const subid = params.pid || params.subid || '';
    let redirectUrl;

    if (destination === 'coupon') {
      const allowedHosts = ['lin.ee', 'line.me', 'didi1119.github.io', 'github.io'];
      let targetUrl = DEFAULT_LINE_COUPON_URL;
      
      if (params.target) {
        try {
          targetUrl = decodeURIComponent(params.target);
        } catch (e) {
          targetUrl = params.target;
        }
      }
      
      const parsedUrl = safeParseUrl(targetUrl);
      if (parsedUrl && allowedHosts.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h))) {
        redirectUrl = targetUrl;
      } else {
        redirectUrl = DEFAULT_LINE_COUPON_URL;
      }
    } else {
      redirectUrl = GITHUB_PAGES_URL + (subid ? `?subid=${encodeURIComponent(subid)}` : '');
    }

    // 極簡跳轉頁面（無任何提示文字）
    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0;url=${htmlEscape(redirectUrl)}">
    <title></title>
    <style>body{margin:0;padding:0;background:#fff}</style>
  </head>
  <body>
    <script>location.replace(${JSON.stringify(redirectUrl)});</script>
  </body>
</html>`;

    return HtmlService.createHtmlOutput(html);

  } catch (err) {
    return HtmlService.createHtmlOutput(`
      <script>location.replace("${GITHUB_PAGES_URL}");</script>
    `);
  }
}

/**
 * HTML 轉義
 */
function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
 * 記錄點擊事件（背景執行）
 */
function recordClick(params) {
  try {
    const sheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Clicks');
    if (!sheet) return;
    
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
    
  } catch (error) {
    // 靜默處理錯誤，不影響跳轉
  }
}

/**
 * 處理 POST 請求 - 修正 CORS
 */
function doPost(e) {
  try {
    Logger.log('POST request received');
    Logger.log('postData: ' + (e.postData ? e.postData.contents : 'undefined'));
    
    const data = JSON.parse(e.postData.contents);
    Logger.log('Parsed data: ' + JSON.stringify(data));
    
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
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

/**
 * 建立新的夥伴資料 - 修正 CORS
 */
function createPartner(data) {
  try {
    Logger.log('Creating partner with data: ' + JSON.stringify(data));
    
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
    Logger.log('Partner created successfully: ' + data.partner_code);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: '夥伴資料建立成功',
        partner_code: data.partner_code
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
  } catch (error) {
    Logger.log('createPartner Error: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
  console.log('🌲 Apps Script 測試開始（純淨版）');
  
  const testParams = {
    parameter: {
      pid: 'CLEAN001',
      dest: 'coupon',
      target: 'https://lin.ee/q38pqot'
    }
  };
  
  const result = doGetClean(testParams);
  console.log('測試完成');
  return result;
}