/**
 * 簡化的 CORS 修正版本 - 複製到您的 Apps Script
 */

// 在您現有的 Apps Script 最前面添加這個函數
function doPost(e) {
  // 添加 CORS headers
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    // 記錄請求
    Logger.log('POST request received');
    Logger.log('Request data: ' + (e.postData ? e.postData.contents : 'No data'));

    // 解析數據
    const data = JSON.parse(e.postData.contents);
    Logger.log('Parsed data: ' + JSON.stringify(data));

    if (data.action === 'create_partner') {
      // 儲存到 Google Sheets
      const sheet = SpreadsheetApp.openById('1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4').getSheetByName('Partners');
      
      const timestamp = new Date();
      const partnerData = [
        '', // partner_id (自動編號)
        data.partner_code || 'UNKNOWN',
        data.name || '',
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
        data.coupon_url || '',
        data.notes || '',
        timestamp, // created_at
        timestamp  // updated_at
      ];

      sheet.appendRow(partnerData);
      Logger.log('Data saved successfully');

      const result = {
        success: true,
        message: '夥伴資料建立成功',
        partner_code: data.partner_code
      };

      output.setContent(JSON.stringify(result));
      return output;

    } else {
      throw new Error('Unknown action: ' + data.action);
    }

  } catch (error) {
    Logger.log('Error: ' + error.toString());
    
    const result = {
      success: false,
      error: error.toString()
    };

    output.setContent(JSON.stringify(result));
    return output;
  }
}

// 處理 OPTIONS 請求（CORS 預檢）
function doOptions(e) {
  const output = ContentService.createTextOutput('');
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  output.setHeader('Access-Control-Max-Age', '3600');
  return output;
}

// 測試函數
function testPostFunction() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        action: 'create_partner',
        partner_code: 'TEST001',
        name: '測試夥伴',
        email: 'test@example.com',
        coupon_url: 'https://line.me/ti/p/test123'
      })
    }
  };

  const result = doPost(mockEvent);
  Logger.log('Test result: ' + result.getContent());
  return result.getContent();
}