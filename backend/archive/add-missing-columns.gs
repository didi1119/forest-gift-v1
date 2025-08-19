// Google Apps Script 代碼
// 用於添加缺少的欄位到 Partners 表

function addMissingColumnsToPartners() {
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
  const sheet = spreadsheet.getSheetByName('Partners');
  
  if (!sheet) {
    throw new Error('找不到 Partners 表');
  }
  
  // 獲取現有的表頭
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  
  Logger.log('現有欄位: ' + headers.join(', '));
  
  // 需要添加的欄位
  const requiredColumns = {
    'available_points': '可用點數',
    'points_used': '已使用點數',
    'bank_account': '銀行帳號',
    'bank_code': '銀行代碼',
    'yearly_referrals': '年度推薦數',
    'successful_referrals': '成功推薦數',
    'total_referrals': '總推薦數',
    'notes': '備註',
    'is_active': '啟用狀態',
    'contact_phone': '聯絡電話',
    'contact_email': '聯絡Email',
    'partner_name': '夥伴姓名',
    'partner_level': '夥伴等級',
    'line_coupon_url': 'LINE優惠券URL',
    'join_date': '加入日期',
    'total_clicks': '總點擊數',
    'last_click_date': '最後點擊日期'
  };
  
  // 檢查哪些欄位缺少
  const missingColumns = [];
  for (const [column, description] of Object.entries(requiredColumns)) {
    if (!headers.includes(column)) {
      missingColumns.push(column);
    }
  }
  
  if (missingColumns.length === 0) {
    Logger.log('所有必要欄位都已存在');
    return;
  }
  
  Logger.log('缺少的欄位: ' + missingColumns.join(', '));
  
  // 添加缺少的欄位
  let currentColumn = lastColumn + 1;
  missingColumns.forEach(column => {
    // 設置表頭
    sheet.getRange(1, currentColumn).setValue(column);
    
    // 設置表頭格式
    sheet.getRange(1, currentColumn)
      .setFontWeight('bold')
      .setBackground('#f0f0f0')
      .setBorder(true, true, true, true, true, true);
    
    // 為特定欄位設置預設值
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const dataRange = sheet.getRange(2, currentColumn, lastRow - 1);
      
      switch(column) {
        case 'available_points':
        case 'points_used':
        case 'yearly_referrals':
        case 'successful_referrals':
        case 'total_referrals':
        case 'total_clicks':
          // 數字欄位預設為 0
          dataRange.setValue(0);
          break;
        case 'is_active':
          // 布林欄位預設為 true
          dataRange.setValue(true);
          break;
        case 'partner_level':
          // 如果有 level 欄位的值，複製過來
          const levelColumnIndex = headers.indexOf('level') + 1;
          if (levelColumnIndex > 0) {
            const levelValues = sheet.getRange(2, levelColumnIndex, lastRow - 1).getValues();
            dataRange.setValues(levelValues);
          } else {
            dataRange.setValue('LV1_INSIDER');
          }
          break;
        case 'partner_name':
          // 如果有 name 欄位的值，複製過來
          const nameColumnIndex = headers.indexOf('name') + 1;
          if (nameColumnIndex > 0) {
            const nameValues = sheet.getRange(2, nameColumnIndex, lastRow - 1).getValues();
            dataRange.setValues(nameValues);
          }
          break;
        case 'contact_phone':
          // 如果有 phone 欄位的值，複製過來
          const phoneColumnIndex = headers.indexOf('phone') + 1;
          if (phoneColumnIndex > 0) {
            const phoneValues = sheet.getRange(2, phoneColumnIndex, lastRow - 1).getValues();
            dataRange.setValues(phoneValues);
          }
          break;
        case 'contact_email':
          // 如果有 email 欄位的值，複製過來
          const emailColumnIndex = headers.indexOf('email') + 1;
          if (emailColumnIndex > 0) {
            const emailValues = sheet.getRange(2, emailColumnIndex, lastRow - 1).getValues();
            dataRange.setValues(emailValues);
          }
          break;
        case 'successful_referrals':
          // 如果有 total_successful_referrals 欄位的值，複製過來
          const successColumnIndex = headers.indexOf('total_successful_referrals') + 1;
          if (successColumnIndex > 0) {
            const successValues = sheet.getRange(2, successColumnIndex, lastRow - 1).getValues();
            dataRange.setValues(successValues);
          } else {
            dataRange.setValue(0);
          }
          break;
      }
    }
    
    currentColumn++;
  });
  
  Logger.log('成功添加 ' + missingColumns.length + ' 個欄位');
  
  // 顯示更新後的欄位
  const newHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('更新後的欄位: ' + newHeaders.join(', '));
}

// 執行函數
function runAddColumns() {
  try {
    addMissingColumnsToPartners();
    return '欄位添加成功';
  } catch (error) {
    Logger.log('錯誤: ' + error.toString());
    return '錯誤: ' + error.message;
  }
}

// 檢查當前欄位
function checkCurrentColumns() {
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
  const sheet = spreadsheet.getSheetByName('Partners');
  
  if (!sheet) {
    return '找不到 Partners 表';
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return '當前欄位:\n' + headers.join('\n');
}