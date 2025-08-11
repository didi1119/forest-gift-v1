// ===== Apps Script 完整修正版本 =====
// 請將您的整個 Apps Script 替換為以下內容

const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
const GITHUB_PAGES_URL = 'https://didi1119.github.io/forest-gift-v1';
const DEFAULT_LINE_COUPON_URL = 'https://lin.ee/q38pqot';

// ===== 重要：處理 OPTIONS 請求 =====
function doOptions(e) {
  return createCorsResponse('');
}

// ===== GET 請求處理（跳轉功能）=====
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    
    // 測試請求
    if (params.test) {
      return createCorsResponse('GET 測試成功！');
    }
    
    // 記錄點擊
    if (params.pid || params.subid) {
      try {
        recordClick(params);
      } catch (recordError) {
        // 忽略記錄錯誤
      }
    }

    // 處理跳轉
    const destination = params.dest || 'landing';
    const subid = params.pid || params.subid || '';
    let redirectUrl;

    if (destination === 'coupon') {
      let targetUrl = DEFAULT_LINE_COUPON_URL;
      if (params.target) {
        try {
          targetUrl = decodeURIComponent(params.target);
        } catch (e) {
          targetUrl = params.target;
        }
      }
      redirectUrl = targetUrl;
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

// ===== POST 請求處理（儲存功能）=====
function doPost(e) {
  // 立即創建帶 CORS headers 的輸出
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  // 設置所有必要的 CORS headers
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  output.setHeader('Access-Control-Allow-Credentials', 'false');

  try {
    Logger.log('=== doPost 開始 ===');
    
    // 檢查是否有 POST 資料
    if (!e.postData) {
      Logger.log('錯誤: 沒有 postData');
      throw new Error('沒有收到 POST 資料');
    }
    
    if (!e.postData.contents) {
      Logger.log('錯誤: postData.contents 為空');
      throw new Error('POST 資料內容為空');
    }
    
    Logger.log('原始 POST 資料: ' + e.postData.contents);
    
    // 解析 JSON 資料
    let data;
    try {
      data = JSON.parse(e.postData.contents);
      Logger.log('解析成功: ' + JSON.stringify(data));
    } catch (parseError) {
      Logger.log('JSON 解析錯誤: ' + parseError.toString());
      throw new Error('無法解析 JSON 資料: ' + parseError.message);
    }
    
    // 處理 create_partner 動作
    if (data.action === 'create_partner') {
      Logger.log('處理 create_partner 動作');
      
      try {
        const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
        const sheet = spreadsheet.getSheetByName('Partners');
        
        if (!sheet) {
          Logger.log('錯誤: 找不到 Partners 工作表');
          throw new Error('找不到 Partners 工作表');
        }
        
        const timestamp = new Date();
        const partnerData = [
          '', // ID (自動編號)
          data.partner_code || 'UNKNOWN',
          data.name || '',
          data.email || '',
          data.phone || '',
          timestamp, // created_at
          'LV1_INSIDER', // level
          'active', // status
          0, 0, 0, // clicks, conversions, total_earnings
          data.landing_link || '',
          data.coupon_link || '',
          data.coupon_code || '',
          data.coupon_url || '',
          data.notes || '',
          timestamp, // created_at
          timestamp  // updated_at
        ];
        
        Logger.log('準備插入資料: ' + JSON.stringify(partnerData));
        sheet.appendRow(partnerData);
        Logger.log('資料插入成功');
        
        const result = {
          success: true,
          message: '夥伴資料建立成功',
          partner_code: data.partner_code,
          timestamp: timestamp.toISOString()
        };
        
        Logger.log('回傳結果: ' + JSON.stringify(result));
        output.setContent(JSON.stringify(result));
        return output;
        
      } catch (sheetError) {
        Logger.log('Google Sheets 錯誤: ' + sheetError.toString());
        throw new Error('Google Sheets 操作失敗: ' + sheetError.message);
      }
      
    } else {
      Logger.log('未知動作: ' + (data.action || 'undefined'));
      throw new Error('未知的動作: ' + (data.action || 'undefined'));
    }
    
  } catch (error) {
    Logger.log('=== doPost 錯誤 ===');
    Logger.log('錯誤訊息: ' + error.toString());
    Logger.log('錯誤堆疊: ' + error.stack);
    
    const errorResult = {
      success: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
    
    output.setContent(JSON.stringify(errorResult));
    return output;
  }
}

// ===== 輔助函數 =====
function createCorsResponse(content) {
  const output = ContentService.createTextOutput(content);
  output.setMimeType(ContentService.MimeType.TEXT);
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  output.setHeader('Access-Control-Max-Age', '86400');
  return output;
}

function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function recordClick(params) {
  try {
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
    Logger.log('recordClick 錯誤: ' + error.toString());
  }
}

// ===== 測試函數 =====
function testPost() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        action: 'create_partner',
        partner_code: 'TEST999',
        name: '測試夥伴',
        email: 'test@example.com',
        coupon_url: 'https://lin.ee/test'
      })
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log('測試結果: ' + result.getContent());
  return result.getContent();
}