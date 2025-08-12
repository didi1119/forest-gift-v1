// 測試夥伴創建的腳本 - 請在 Apps Script 中執行

function testPartnerCreation() {
  console.log('=== 🧪 測試夥伴創建 ===');
  
  // 清理測試數據（可選）
  // cleanupTestPartners();
  
  // 創建測試夥伴
  createTestPartner();
  
  // 驗證資料是否正確寫入
  verifyPartnerData();
}

function createTestPartner() {
  console.log('\n--- 👤 創建測試夥伴 ---');
  
  const testData = {
    action: 'create_partner',
    partner_code: 'TEST_CORRECT',
    name: '正確測試夥伴',
    email: 'correct@test.com',
    phone: '0987654321',
    coupon_code: 'FOREST_TEST',
    coupon_url: 'https://line.me/R/ti/p/@correct-test',
    landing_link: 'https://script.google.com/.../exec?pid=TEST_CORRECT&dest=landing',
    coupon_link: 'https://script.google.com/.../exec?pid=TEST_CORRECT&dest=coupon',
    short_landing_link: 'https://tinyurl.com/landing123',
    short_coupon_link: 'https://tinyurl.com/coupon123'
  };
  
  try {
    const result = handleCreatePartner(testData, null);
    
    if (result && typeof result.getContent === 'function') {
      const content = result.getContent();
      const parsed = JSON.parse(content);
      
      if (parsed.success) {
        console.log('✅ 夥伴創建成功');
        console.log('夥伴代碼:', parsed.partner_code);
      } else {
        console.log('❌ 夥伴創建失敗:', parsed.error);
      }
    }
  } catch (error) {
    console.error('❌ 創建夥伴時發生錯誤:', error);
  }
}

function verifyPartnerData() {
  console.log('\n--- 🔍 驗證夥伴資料 ---');
  
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    if (!sheet) {
      console.error('❌ Partners 工作表不存在');
      return;
    }
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    
    console.log('📋 標題行:', headers.join(' | '));
    
    // 找到測試夥伴
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[1] === 'TEST_CORRECT') { // partner_code 在第 B 列
        console.log('\n✅ 找到測試夥伴：TEST_CORRECT');
        
        // 驗證每個欄位
        const partnerData = {};
        headers.forEach((header, index) => {
          partnerData[header] = row[index];
        });
        
        console.log('📊 夥伴資料:');
        console.log('  partner_code:', partnerData.partner_code);
        console.log('  name:', partnerData.name);
        console.log('  email:', partnerData.email);
        console.log('  phone:', partnerData.phone);
        console.log('  coupon_code:', partnerData.coupon_code);
        console.log('  coupon_url:', partnerData.coupon_url);
        console.log('  landing_link:', partnerData.landing_link);
        console.log('  short_landing_link:', partnerData.short_landing_link);
        
        // 檢查關鍵欄位
        if (partnerData.coupon_url === 'https://line.me/R/ti/p/@correct-test') {
          console.log('✅ coupon_url 正確');
        } else {
          console.log('❌ coupon_url 不正確，期待: https://line.me/R/ti/p/@correct-test，實際:', partnerData.coupon_url);
        }
        
        if (partnerData.name === '正確測試夥伴') {
          console.log('✅ name 正確');
        } else {
          console.log('❌ name 不正確，期待: 正確測試夥伴，實際:', partnerData.name);
        }
        
        return;
      }
    }
    
    console.log('❌ 找不到測試夥伴 TEST_CORRECT');
    
  } catch (error) {
    console.error('❌ 驗證夥伴資料時發生錯誤:', error);
  }
}

function testCouponUrlLookup() {
  console.log('\n--- 🎯 測試優惠券 URL 查詢 ---');
  
  // 測試 getPartnerCouponUrl 函數
  if (typeof getPartnerCouponUrl === 'function') {
    const result = getPartnerCouponUrl('TEST_CORRECT');
    console.log('查詢結果:', result);
    
    if (result === 'https://line.me/R/ti/p/@correct-test') {
      console.log('✅ 優惠券 URL 查詢正確');
    } else {
      console.log('❌ 優惠券 URL 查詢不正確');
      console.log('期待: https://line.me/R/ti/p/@correct-test');
      console.log('實際:', result);
    }
  } else {
    console.log('❌ getPartnerCouponUrl 函數不存在');
  }
}

function cleanupTestPartners() {
  console.log('\n--- 🧹 清理測試資料 ---');
  
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    if (!sheet) {
      console.log('❌ Partners 工作表不存在');
      return;
    }
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    // 從後往前刪除，避免索引問題
    for (let i = values.length - 1; i >= 1; i--) {
      const partnerCode = values[i][1]; // partner_code 在第 B 列
      if (partnerCode && partnerCode.startsWith('TEST')) {
        sheet.deleteRow(i + 1); // +1 因為 sheet 行號從 1 開始
        console.log('🗑️ 已刪除測試夥伴:', partnerCode);
      }
    }
    
    console.log('✅ 測試資料清理完成');
    
  } catch (error) {
    console.error('❌ 清理測試資料時發生錯誤:', error);
  }
}

// 完整測試流程
function fullPartnerTest() {
  console.log('=== 🎯 完整夥伴測試流程 ===\n');
  
  createTestPartner();
  console.log('\n');
  
  verifyPartnerData();
  console.log('\n');
  
  testCouponUrlLookup();
  
  console.log('\n=== ✅ 完整夥伴測試完成 ===');
}