// ===== Apps Script 表單提交版本 =====
// 請將您的整個 Apps Script 替換為以下內容

const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
const GITHUB_PAGES_URL = 'https://didi1119.github.io/forest-gift-v1';
const DEFAULT_LINE_COUPON_URL = 'https://lin.ee/q38pqot';

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
    }
    // 沒有任何資料
    else {
      Logger.log('錯誤: 沒有 POST 資料');
      return createJsonResponse({
        success: false,
        error: '沒有收到 POST 資料'
      });
    }
    
    // 處理 create_partner 動作
    if (data.action === 'create_partner') {
      Logger.log('處理 create_partner 動作');
      
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
              <h1>✅ 儲存成功！</h1>
              <p>夥伴代碼：${data.partner_code}</p>
              <p>姓名：${data.name}</p>
              <script>
                // 通知父視窗
                if (window.opener) {
                  window.opener.postMessage(${JSON.stringify(result)}, '*');
                  window.close();
                }
              </script>
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
      
    } else {
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
function testFormSubmission() {
  Logger.log('=== 測試表單提交 ===');
  
  const mockEvent = {
    parameter: {
      action: 'create_partner',
      partner_code: 'FORM_TEST_' + Date.now(),
      name: '表單測試夥伴',
      email: 'form-test@example.com',
      coupon_url: 'https://lin.ee/form-test'
    }
  };
  
  try {
    const result = doPost(mockEvent);
    const content = result.getContent();
    Logger.log('表單測試成功，結果: ' + content);
    return content;
  } catch (error) {
    Logger.log('表單測試失敗: ' + error.toString());
    return JSON.stringify({
      success: false,
      error: error.toString()
    });
  }
}