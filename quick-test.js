// 快速測試腳本 - 請在 Apps Script 中執行

function quickTest() {
  console.log('=== 🚀 快速測試開始 ===');
  
  // 1. 測試 Google Sheets 連接
  testSheetsConnection();
  
  // 2. 測試 Partners 數據
  testPartnersData();
  
  // 3. 測試優惠券 URL 查詢
  testCouponUrlQuery();
  
  console.log('=== ✅ 快速測試完成 ===');
}

function testSheetsConnection() {
  console.log('\n--- 📊 測試 Google Sheets 連接 ---');
  
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    console.log('✅ Google Sheets 連接成功');
    console.log('📄 試算表名稱:', spreadsheet.getName());
    
    const sheets = spreadsheet.getSheets();
    console.log('📋 工作表:', sheets.map(s => s.getName()).join(', '));
    
  } catch (error) {
    console.error('❌ Google Sheets 連接失敗:', error.toString());
  }
}

function testPartnersData() {
  console.log('\n--- 👥 測試 Partners 數據 ---');
  
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    if (!sheet) {
      console.error('❌ Partners 工作表不存在');
      console.log('💡 請先執行 setupSheetsHeaders() 創建表格');
      return;
    }
    
    console.log('✅ Partners 工作表存在');
    console.log('📏 行數:', sheet.getLastRow());
    console.log('📐 列數:', sheet.getLastColumn());
    
    if (sheet.getLastRow() === 0) {
      console.warn('⚠️ Partners 表格是空的');
      return;
    }
    
    // 檢查標題行
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    console.log('📋 標題行:', headers.join(', '));
    
    // 檢查是否有 coupon_url 欄位
    if (headers.includes('coupon_url')) {
      console.log('✅ 找到 coupon_url 欄位');
    } else {
      console.error('❌ 沒有 coupon_url 欄位');
    }
    
    // 顯示所有 Partners 數據
    if (sheet.getLastRow() > 1) {
      console.log('\n👥 現有夥伴:');
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      
      data.forEach((row, index) => {
        const partnerCode = row[1]; // partner_code 在第 B 列
        const name = row[2]; // name 在第 C 列
        const couponUrlIndex = headers.indexOf('coupon_url');
        const couponUrl = couponUrlIndex >= 0 ? row[couponUrlIndex] : '未找到欄位';
        
        console.log(`  夥伴 ${index + 1}: ${partnerCode || '無代碼'} (${name || '無名稱'})`);
        console.log(`    優惠券連結: ${couponUrl || '未設定'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 測試 Partners 數據失敗:', error.toString());
  }
}

function testCouponUrlQuery() {
  console.log('\n--- 🎯 測試優惠券 URL 查詢 ---');
  
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    if (!sheet || sheet.getLastRow() <= 1) {
      console.warn('⚠️ 沒有 Partners 數據可以測試');
      return;
    }
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    
    console.log('🔍 標題行:', headers.join(', '));
    
    const couponUrlIndex = headers.indexOf('coupon_url');
    if (couponUrlIndex === -1) {
      console.error('❌ 找不到 coupon_url 欄位');
      return;
    }
    
    console.log('✅ coupon_url 欄位索引:', couponUrlIndex);
    
    // 測試每個夥伴的查詢
    for (let i = 1; i < values.length; i++) {
      const partnerCode = values[i][1];
      const couponUrl = values[i][couponUrlIndex];
      
      console.log(`\n🧪 測試夥伴: ${partnerCode}`);
      console.log(`  直接查詢結果: ${couponUrl || '空值'}`);
      
      // 測試 getPartnerCouponUrl 函數
      if (typeof getPartnerCouponUrl === 'function') {
        const result = getPartnerCouponUrl(partnerCode);
        console.log(`  函數查詢結果: ${result || '空值'}`);
      } else {
        console.log('  函數不存在，請確保 Apps Script 已部署最新版本');
      }
    }
    
  } catch (error) {
    console.error('❌ 測試優惠券 URL 查詢失敗:', error.toString());
  }
}

// 測試特定夥伴代碼
function testSpecificPartner(partnerCode) {
  console.log(`\n=== 🎯 測試特定夥伴: ${partnerCode} ===`);
  
  if (typeof getPartnerCouponUrl === 'function') {
    const result = getPartnerCouponUrl(partnerCode);
    console.log('查詢結果:', result || '找不到');
  } else {
    console.log('getPartnerCouponUrl 函數不存在');
  }
}

// 測試後台數據載入
function testDashboardData() {
  console.log('\n=== 📊 測試後台數據載入 ===');
  
  if (typeof handleGetDashboardData === 'function') {
    try {
      const mockData = { action: 'get_dashboard_data' };
      const result = handleGetDashboardData(mockData, null);
      
      if (result && typeof result.getContent === 'function') {
        const content = result.getContent();
        const parsed = JSON.parse(content);
        
        console.log('✅ 後台數據載入成功');
        console.log('Partners 數量:', parsed.data?.partners?.length || 0);
        console.log('Bookings 數量:', parsed.data?.bookings?.length || 0);
      }
    } catch (error) {
      console.error('❌ 後台數據載入失敗:', error.toString());
    }
  } else {
    console.log('handleGetDashboardData 函數不存在');
  }
}