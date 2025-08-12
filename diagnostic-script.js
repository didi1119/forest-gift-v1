// 診斷腳本 - 請複製到 Apps Script 中執行
// 用於檢查系統狀態和數據連動問題

function runDiagnostics() {
  console.log('=== 🔍 系統診斷開始 ===');
  
  try {
    // 1. 檢查 Google Sheets 連接
    checkSheetsConnection();
    
    // 2. 檢查 Partners 表格結構
    checkPartnersTableStructure();
    
    // 3. 檢查現有 Partners 數據
    checkPartnersData();
    
    // 4. 測試 getPartnerCouponUrl 函數
    testGetPartnerCouponUrl();
    
    // 5. 測試 get_dashboard_data 功能
    testGetDashboardData();
    
    console.log('=== ✅ 診斷完成 ===');
    
  } catch (error) {
    console.error('❌ 診斷過程中發生錯誤:', error);
  }
}

function checkSheetsConnection() {
  console.log('\n--- 📊 檢查 Google Sheets 連接 ---');
  
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4'; // 與 Apps Script 一致
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    console.log('✅ 成功連接到 Google Sheets');
    console.log('📄 試算表名稱:', spreadsheet.getName());
    
    const sheets = spreadsheet.getSheets();
    console.log('📋 工作表清單:', sheets.map(s => s.getName()).join(', '));
    
    return true;
  } catch (error) {
    console.error('❌ Google Sheets 連接失敗:', error);
    return false;
  }
}

function checkPartnersTableStructure() {
  console.log('\n--- 🏗️ 檢查 Partners 表格結構 ---');
  
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    if (!sheet) {
      console.error('❌ Partners 工作表不存在');
      return false;
    }
    
    console.log('✅ Partners 工作表存在');
    console.log('📏 總行數:', sheet.getLastRow());
    console.log('📐 總列數:', sheet.getLastColumn());
    
    if (sheet.getLastRow() === 0) {
      console.warn('⚠️ Partners 表格是空的');
      return false;
    }
    
    // 檢查標題行
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    console.log('📋 標題行:', headers);
    
    // 檢查必要欄位
    const requiredFields = ['partner_code', 'name', 'coupon_url'];
    const missingFields = requiredFields.filter(field => !headers.includes(field));
    
    if (missingFields.length > 0) {
      console.error('❌ 缺少必要欄位:', missingFields);
    } else {
      console.log('✅ 所有必要欄位都存在');
    }
    
    return true;
  } catch (error) {
    console.error('❌ 檢查 Partners 表格結構失敗:', error);
    return false;
  }
}

function checkPartnersData() {
  console.log('\n--- 📄 檢查 Partners 數據 ---');
  
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    if (!sheet || sheet.getLastRow() <= 1) {
      console.warn('⚠️ Partners 表格沒有數據');
      return false;
    }
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    
    console.log('👥 夥伴總數:', values.length - 1);
    
    // 顯示所有夥伴的基本信息
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const partnerData = {};
      headers.forEach((header, index) => {
        partnerData[header] = row[index];
      });
      
      console.log(`\n夥伴 ${i}:`);
      console.log('  代碼:', partnerData.partner_code || '未設定');
      console.log('  姓名:', partnerData.name || '未設定');
      console.log('  優惠券連結:', partnerData.coupon_url ? '已設定' : '未設定');
      
      if (partnerData.coupon_url) {
        console.log('  優惠券 URL:', partnerData.coupon_url);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ 檢查 Partners 數據失敗:', error);
    return false;
  }
}

function testGetPartnerCouponUrl() {
  console.log('\n--- 🧪 測試 getPartnerCouponUrl 函數 ---');
  
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    if (!sheet || sheet.getLastRow() <= 1) {
      console.warn('⚠️ 沒有 Partners 數據可以測試');
      return;
    }
    
    const values = sheet.getDataRange().getValues();
    
    // 測試每個夥伴的 coupon URL 查詢
    for (let i = 1; i < values.length; i++) {
      const partnerCode = values[i][1]; // partner_code 在第 B 列
      
      console.log(`\n測試夥伴: ${partnerCode}`);
      
      // 這裡需要調用實際的 getPartnerCouponUrl 函數
      // 由於我們在診斷腳本中，直接實現查詢邏輯
      const result = testCouponUrlLookup(partnerCode);
      console.log('查詢結果:', result || '找不到');
    }
    
  } catch (error) {
    console.error('❌ 測試 getPartnerCouponUrl 失敗:', error);
  }
}

function testCouponUrlLookup(partnerCode) {
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    
    const couponUrlIndex = headers.indexOf('coupon_url');
    if (couponUrlIndex === -1) {
      return null;
    }
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][1] === partnerCode) {
        return values[i][couponUrlIndex];
      }
    }
    
    return null;
  } catch (error) {
    console.error('查詢失敗:', error);
    return null;
  }
}

function testGetDashboardData() {
  console.log('\n--- 📊 測試後台數據載入 ---');
  
  try {
    // 模擬 get_dashboard_data 請求
    const mockData = { action: 'get_dashboard_data' };
    const result = handleGetDashboardData(mockData, null);
    
    console.log('後台數據載入結果:', result);
    
    // 檢查返回的數據結構
    const response = JSON.parse(result.getContent());
    
    if (response.success) {
      console.log('✅ 後台數據載入成功');
      console.log('Partners 數量:', response.data.partners?.length || 0);
      console.log('Bookings 數量:', response.data.bookings?.length || 0);
      console.log('Payouts 數量:', response.data.payouts?.length || 0);
      console.log('Clicks 數量:', response.data.clicks?.length || 0);
    } else {
      console.error('❌ 後台數據載入失敗:', response.error);
    }
    
  } catch (error) {
    console.error('❌ 測試後台數據載入失敗:', error);
  }
}

// 額外的測試函數
function testSpecificPartnerCode(partnerCode) {
  console.log(`\n--- 🎯 測試特定夥伴代碼: ${partnerCode} ---`);
  
  const result = testCouponUrlLookup(partnerCode);
  console.log('查詢結果:', result);
  
  if (result) {
    console.log('✅ 找到專屬優惠券連結');
  } else {
    console.log('❌ 找不到專屬優惠券連結');
  }
}

// 手動執行診斷
function manualDiagnosticSteps() {
  console.log('\n=== 📝 手動診斷步驟 ===');
  console.log('1. 執行 runDiagnostics() 查看完整診斷');
  console.log('2. 執行 testSpecificPartnerCode("你的夥伴代碼") 測試特定夥伴');
  console.log('3. 檢查 Apps Script 部署版本是否為最新');
  console.log('4. 確認 SHEETS_ID 是否正確');
}