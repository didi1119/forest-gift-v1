// ===== 將這些函數添加到您的 Apps Script 中 =====

// 處理 OPTIONS 請求 (必須添加)
function doOptions(e) {
  const output = ContentService.createTextOutput('');
  output.setMimeType(ContentService.MimeType.TEXT);
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  output.setHeader('Access-Control-Max-Age', '86400');
  return output;
}

// 修正版 doGet 函數
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    
    // 如果是測試請求
    if (params.test) {
      const output = ContentService.createTextOutput('GET 測試成功！');
      output.setMimeType(ContentService.MimeType.TEXT);
      output.setHeader('Access-Control-Allow-Origin', '*');
      return output;
    }
    
    // 處理跳轉邏輯
    if (params.pid || params.subid) {
      try {
        recordClick(params);
      } catch (recordError) {
        // 忽略記錄錯誤
      }
    }

    const destination = params.dest || 'landing';
    const subid = params.pid || params.subid || '';
    let redirectUrl;

    if (destination === 'coupon') {
      let targetUrl = 'https://lin.ee/q38pqot';
      if (params.target) {
        try {
          targetUrl = decodeURIComponent(params.target);
        } catch (e) {
          targetUrl = params.target;
        }
      }
      redirectUrl = targetUrl;
    } else {
      redirectUrl = 'https://didi1119.github.io/forest-gift-v1' + (subid ? `?subid=${encodeURIComponent(subid)}` : '');
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
    const errorHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0;url=https://didi1119.github.io/forest-gift-v1">
    <title></title>
  </head>
  <body>
    <script>location.replace('https://didi1119.github.io/forest-gift-v1');</script>
  </body>
</html>`;
    return HtmlService.createHtmlOutput(errorHtml);
  }
}

// 修正版 doPost 函數
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  // 設置 CORS headers
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    Logger.log('doPost 被呼叫');
    
    if (!e.postData || !e.postData.contents) {
      throw new Error('沒有收到 POST 資料');
    }
    
    Logger.log('原始 POST 資料: ' + e.postData.contents);
    
    const data = JSON.parse(e.postData.contents);
    Logger.log('解析後的資料: ' + JSON.stringify(data));
    
    if (data.action === 'create_partner') {
      // 請確保您已經設置了正確的 SHEETS_ID
      const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4'; // 請確認這個 ID 正確
      
      const sheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Partners');
      if (!sheet) {
        throw new Error('找不到 Partners 工作表');
      }
      
      const timestamp = new Date();
      const partnerData = [
        '', // ID (自動)
        data.partner_code || 'UNKNOWN',
        data.name || '',
        data.email || '',
        data.phone || '',
        timestamp, // 建立時間
        'LV1_INSIDER', // 等級
        'active', // 狀態
        0, 0, 0, // 點擊數, 轉換數, 總收入
        data.landing_link || '',
        data.coupon_link || '',
        data.coupon_code || '',
        data.coupon_url || '',
        data.notes || '',
        timestamp, // 建立時間
        timestamp  // 更新時間
      ];
      
      sheet.appendRow(partnerData);
      Logger.log('夥伴資料已新增: ' + (data.partner_code || 'UNKNOWN'));
      
      const result = {
        success: true,
        message: '夥伴資料建立成功',
        partner_code: data.partner_code
      };
      
      output.setContent(JSON.stringify(result));
      return output;
      
    } else {
      throw new Error('未知的動作: ' + (data.action || 'undefined'));
    }
    
  } catch (error) {
    Logger.log('doPost 錯誤: ' + error.toString());
    
    const errorResult = {
      success: false,
      error: error.toString()
    };
    
    output.setContent(JSON.stringify(errorResult));
    return output;
  }
}

// 輔助函數
function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function recordClick(params) {
  try {
    const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
    const sheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Clicks');
    if (!sheet) return;
    
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
  } catch (error) {
    // 靜默處理錯誤
  }
}

// 測試函數
function testFunction() {
  Logger.log('測試函數執行成功');
  return '測試成功';
}