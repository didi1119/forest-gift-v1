// ===== 只需要替換這兩個函數即可 =====

// 修正版 doOptions 函數（重要！）
function doOptions(e) {
  const output = ContentService.createTextOutput('');
  output.setMimeType(ContentService.MimeType.TEXT);
  
  // 設置 CORS headers - 這是關鍵！
  return output
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    .setHeader('Access-Control-Max-Age', '86400');
}

// 修正版 doPost 函數（加強 CORS）
function doPost(e) {
  try {
    Logger.log('=== doPost 開始 ===');
    
    // 檢查是否有 POST 資料
    if (!e || !e.postData || !e.postData.contents) {
      Logger.log('錯誤: 沒有 POST 資料');
      return createJsonResponseWithCors({
        success: false,
        error: '沒有收到 POST 資料'
      });
    }
    
    Logger.log('原始 POST 資料: ' + e.postData.contents);
    
    // 解析 JSON 資料
    let data;
    try {
      data = JSON.parse(e.postData.contents);
      Logger.log('解析成功: ' + JSON.stringify(data));
    } catch (parseError) {
      Logger.log('JSON 解析錯誤: ' + parseError.toString());
      return createJsonResponseWithCors({
        success: false,
        error: '無法解析 JSON 資料: ' + parseError.message
      });
    }
    
    // 處理 create_partner 動作
    if (data.action === 'create_partner') {
      Logger.log('處理 create_partner 動作');
      
      try {
        const spreadsheet = SpreadsheetApp.openById('1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4');
        const sheet = spreadsheet.getSheetByName('Partners');
        
        if (!sheet) {
          Logger.log('錯誤: 找不到 Partners 工作表');
          return createJsonResponseWithCors({
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
        return createJsonResponseWithCors(result);
        
      } catch (sheetError) {
        Logger.log('Google Sheets 錯誤: ' + sheetError.toString());
        return createJsonResponseWithCors({
          success: false,
          error: 'Google Sheets 操作失敗: ' + sheetError.message
        });
      }
      
    } else {
      Logger.log('未知動作: ' + (data.action || 'undefined'));
      return createJsonResponseWithCors({
        success: false,
        error: '未知的動作: ' + (data.action || 'undefined')
      });
    }
    
  } catch (error) {
    Logger.log('=== doPost 總體錯誤 ===');
    Logger.log('錯誤訊息: ' + error.toString());
    
    return createJsonResponseWithCors({
      success: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    });
  }
}

// 新的輔助函數：創建帶 CORS 的 JSON 回應
function createJsonResponseWithCors(data) {
  const jsonString = JSON.stringify(data);
  Logger.log('建立帶 CORS 的 JSON 回應: ' + jsonString);
  
  const output = ContentService.createTextOutput(jsonString);
  output.setMimeType(ContentService.MimeType.JSON);
  
  // 設置 CORS headers
  return output
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}