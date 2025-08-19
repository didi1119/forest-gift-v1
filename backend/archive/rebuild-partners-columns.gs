// ===== Google Apps Script - 重建 Partners 表欄位 =====
// 這個腳本會：
// 1. 備份現有資料
// 2. 重建標準欄位結構
// 3. 遷移資料到新欄位
// 4. 清理重複欄位

const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';

// 標準欄位定義
const STANDARD_COLUMNS = [
  // 核心識別
  'id',
  'partner_code',
  'partner_name',
  'partner_level',
  
  // 聯絡資訊
  'contact_phone',
  'contact_email',
  
  // 佣金與點數
  'commission_preference',
  'available_points',
  'points_used',
  'total_commission_earned',
  'total_commission_paid',
  'pending_commission',
  
  // 推薦統計
  'total_referrals',
  'successful_referrals',
  'yearly_referrals',
  'level_progress',
  
  // 銀行資訊
  'bank_code',
  'bank_account',
  'bank_name',
  'bank_branch',
  'bank_account_name',
  
  // 連結資訊
  'line_coupon_url',
  'short_landing_link',
  'short_coupon_link',
  
  // 系統欄位
  'is_active',
  'join_date',
  'notes',
  'created_at',
  'updated_at',
  
  // 點擊統計
  'total_clicks',
  'last_click_date'
];

// 欄位映射規則（舊欄位 -> 新欄位）
const FIELD_MAPPING = {
  'name': 'partner_name',
  'email': 'contact_email',
  'phone': 'contact_phone',
  'level': 'partner_level',
  'total_successful_referrals': 'successful_referrals',
  'coupon_url': 'line_coupon_url'
};

/**
 * 主函數：重建 Partners 表欄位
 */
function rebuildPartnersTable() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    if (!sheet) {
      throw new Error('找不到 Partners 表');
    }
    
    Logger.log('===== 開始重建 Partners 表 =====');
    
    // 步驟 1: 備份現有資料
    Logger.log('步驟 1: 備份現有資料...');
    const backupData = backupExistingData(sheet);
    Logger.log(`備份了 ${backupData.length} 筆資料`);
    
    // 步驟 2: 清空表格並重建欄位
    Logger.log('步驟 2: 重建欄位結構...');
    rebuildColumns(sheet);
    
    // 步驟 3: 遷移資料
    Logger.log('步驟 3: 遷移資料到新欄位...');
    const migratedCount = migrateData(sheet, backupData);
    Logger.log(`成功遷移 ${migratedCount} 筆資料`);
    
    // 步驟 4: 設置格式
    Logger.log('步驟 4: 設置表格格式...');
    formatSheet(sheet);
    
    Logger.log('===== Partners 表重建完成！ =====');
    return '重建成功！遷移了 ' + migratedCount + ' 筆資料';
    
  } catch (error) {
    Logger.log('錯誤: ' + error.toString());
    throw error;
  }
}

/**
 * 備份現有資料
 */
function backupExistingData(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  
  if (lastRow <= 1 || lastColumn === 0) {
    return [];
  }
  
  // 獲取表頭和資料
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const dataRange = sheet.getRange(2, 1, lastRow - 1, lastColumn);
  const dataValues = dataRange.getValues();
  
  // 轉換為物件陣列
  const backupData = [];
  dataValues.forEach(row => {
    const rowData = {};
    headers.forEach((header, index) => {
      if (header && row[index] !== undefined && row[index] !== '') {
        rowData[header] = row[index];
      }
    });
    
    // 只備份有 partner_code 的資料
    if (rowData.partner_code || rowData.id) {
      backupData.push(rowData);
    }
  });
  
  // 創建備份表（可選）
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const backupName = 'Partners_Backup_' + new Date().toISOString().slice(0, 10);
    let backupSheet = spreadsheet.getSheetByName(backupName);
    
    if (!backupSheet) {
      backupSheet = spreadsheet.insertSheet(backupName);
      
      // 複製原始資料到備份表
      const sourceRange = sheet.getRange(1, 1, lastRow, lastColumn);
      const targetRange = backupSheet.getRange(1, 1, lastRow, lastColumn);
      sourceRange.copyTo(targetRange);
      
      Logger.log('創建備份表: ' + backupName);
    }
  } catch (e) {
    Logger.log('備份表創建失敗（但資料已在記憶體中）: ' + e.toString());
  }
  
  return backupData;
}

/**
 * 重建欄位結構
 */
function rebuildColumns(sheet) {
  // 清空表格
  sheet.clear();
  
  // 設置新的表頭
  const headerRange = sheet.getRange(1, 1, 1, STANDARD_COLUMNS.length);
  headerRange.setValues([STANDARD_COLUMNS]);
  
  // 設置表頭格式
  headerRange
    .setFontWeight('bold')
    .setBackground('#2E4B36')
    .setFontColor('#FFFFFF')
    .setBorder(true, true, true, true, true, true);
  
  // 設置欄位寬度
  STANDARD_COLUMNS.forEach((column, index) => {
    let width = 100; // 預設寬度
    
    // 根據欄位類型設置不同寬度
    if (column === 'id') width = 50;
    else if (column === 'partner_code') width = 120;
    else if (column === 'partner_name') width = 120;
    else if (column === 'notes') width = 200;
    else if (column.includes('link') || column.includes('url')) width = 150;
    else if (column.includes('email')) width = 150;
    else if (column.includes('bank')) width = 120;
    
    sheet.setColumnWidth(index + 1, width);
  });
}

/**
 * 遷移資料到新欄位
 */
function migrateData(sheet, backupData) {
  if (backupData.length === 0) {
    Logger.log('沒有資料需要遷移');
    return 0;
  }
  
  const migratedData = [];
  let nextId = 1;
  
  backupData.forEach((oldRow, index) => {
    const newRow = [];
    
    STANDARD_COLUMNS.forEach(column => {
      let value = '';
      
      // 特殊處理 ID
      if (column === 'id') {
        value = oldRow.id || nextId++;
      }
      // 使用映射規則
      else if (oldRow[column] !== undefined) {
        value = oldRow[column];
      }
      // 檢查舊欄位名稱
      else {
        // 反向查找映射
        for (const [oldField, newField] of Object.entries(FIELD_MAPPING)) {
          if (newField === column && oldRow[oldField] !== undefined) {
            value = oldRow[oldField];
            break;
          }
        }
      }
      
      // 設置預設值
      if (value === '' || value === undefined || value === null) {
        switch(column) {
          case 'partner_level':
            value = oldRow.level || 'LV1_INSIDER';
            break;
          case 'commission_preference':
            value = oldRow.commission_preference || 'ACCOMMODATION';
            break;
          case 'available_points':
          case 'points_used':
          case 'total_commission_earned':
          case 'total_commission_paid':
          case 'pending_commission':
          case 'total_referrals':
          case 'successful_referrals':
          case 'yearly_referrals':
          case 'level_progress':
          case 'total_clicks':
            value = parseFloat(oldRow[column]) || 0;
            break;
          case 'is_active':
            value = oldRow.is_active !== false;
            break;
          case 'join_date':
            value = oldRow.join_date || oldRow.created_at || new Date();
            break;
          case 'created_at':
            value = oldRow.created_at || new Date();
            break;
          case 'updated_at':
            value = new Date();
            break;
        }
      }
      
      newRow.push(value);
    });
    
    migratedData.push(newRow);
  });
  
  // 寫入資料
  if (migratedData.length > 0) {
    const dataRange = sheet.getRange(2, 1, migratedData.length, STANDARD_COLUMNS.length);
    dataRange.setValues(migratedData);
  }
  
  return migratedData.length;
}

/**
 * 設置表格格式
 */
function formatSheet(sheet) {
  const lastRow = sheet.getLastRow();
  
  if (lastRow > 1) {
    // 設置資料區域格式
    const dataRange = sheet.getRange(2, 1, lastRow - 1, STANDARD_COLUMNS.length);
    dataRange.setBorder(true, true, true, true, true, true, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID);
    
    // 設置數字欄位格式
    const numberColumns = ['available_points', 'points_used', 'total_commission_earned', 
                          'total_commission_paid', 'pending_commission'];
    
    numberColumns.forEach(column => {
      const columnIndex = STANDARD_COLUMNS.indexOf(column) + 1;
      if (columnIndex > 0 && lastRow > 1) {
        const range = sheet.getRange(2, columnIndex, lastRow - 1);
        range.setNumberFormat('#,##0');
      }
    });
    
    // 設置日期欄位格式
    const dateColumns = ['join_date', 'created_at', 'updated_at', 'last_click_date'];
    
    dateColumns.forEach(column => {
      const columnIndex = STANDARD_COLUMNS.indexOf(column) + 1;
      if (columnIndex > 0 && lastRow > 1) {
        const range = sheet.getRange(2, columnIndex, lastRow - 1);
        range.setNumberFormat('yyyy-mm-dd hh:mm:ss');
      }
    });
  }
  
  // 凍結標題行
  sheet.setFrozenRows(1);
  
  // 凍結 ID 和 partner_code 欄位
  sheet.setFrozenColumns(2);
}

/**
 * 檢查現有欄位（診斷用）
 */
function checkCurrentStructure() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    if (!sheet) {
      return '找不到 Partners 表';
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const lastRow = sheet.getLastRow();
    
    let report = '===== Partners 表現況 =====\n';
    report += `總欄位數: ${headers.length}\n`;
    report += `資料筆數: ${Math.max(0, lastRow - 1)}\n\n`;
    
    report += '現有欄位:\n';
    headers.forEach((header, index) => {
      const isStandard = STANDARD_COLUMNS.includes(header);
      const status = isStandard ? '✅' : '❌';
      report += `${index + 1}. ${status} ${header}\n`;
    });
    
    report += '\n缺少的標準欄位:\n';
    STANDARD_COLUMNS.forEach(column => {
      if (!headers.includes(column)) {
        report += `- ${column}\n`;
      }
    });
    
    report += '\n多餘的欄位（不在標準中）:\n';
    headers.forEach(header => {
      if (header && !STANDARD_COLUMNS.includes(header)) {
        report += `- ${header}\n`;
      }
    });
    
    Logger.log(report);
    return report;
  } catch (error) {
    return '錯誤: ' + error.toString();
  }
}

// ===== 執行函數 =====

/**
 * 執行重建（主要入口）
 */
function runRebuild() {
  try {
    const result = rebuildPartnersTable();
    Logger.log(result);
    return result;
  } catch (error) {
    Logger.log('重建失敗: ' + error.toString());
    return '重建失敗: ' + error.message;
  }
}

/**
 * 只檢查不重建
 */
function runCheck() {
  return checkCurrentStructure();
}