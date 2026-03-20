/**
 * 直接複製貼上的修正版本
 * 請複製以下兩個函數，貼到您的 Apps Script 程式碼中
 * 
 * 步驟：
 * 1. 找到您現有的 doPost 函數，完全替換為下面的版本
 * 2. 在程式碼最前面添加 doOptions 函數
 * 3. 儲存並重新部署
 */

// ====== 添加到程式碼最前面 ======
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type')
    .setHeader('Access-Control-Max-Age', '3600');
}

// ====== 替換您現有的 doPost 函數 ======
function doPost(e) {
  // 設定 CORS headers
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    Logger.log('POST request received');
    Logger.log('postData: ' + (e.postData ? e.postData.contents : 'undefined'));
    
    const data = JSON.parse(e.postData.contents);
    Logger.log('Parsed data: ' + JSON.stringify(data));
    
    switch (data.action) {
      case 'create_partner':
        // 直接處理夥伴建立
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
        
        const result = {
          success: true,
          message: '夥伴資料建立成功',
          partner_code: data.partner_code
        };
        
        output.setContent(JSON.stringify(result));
        return output;
        
      case 'get_stats':
        return getPartnerStats(data);
      default:
        throw new Error('Unknown action: ' + data.action);
    }
    
  } catch (error) {
    Logger.log('doPost Error: ' + error.toString());
    
    const errorResult = {
      success: false,
      error: error.toString()
    };
    
    output.setContent(JSON.stringify(errorResult));
    return output;
  }
}