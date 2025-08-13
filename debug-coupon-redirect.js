// 調試優惠券跳轉問題的腳本 - 請在 Apps Script 中執行

function debugCouponRedirect() {
  console.log('=== 🔍 調試優惠券跳轉問題 ===');
  
  // 1. 檢查現有的夥伴數據
  listAllPartners();
  
  // 2. 測試 getPartnerCouponUrl 函數
  testGetPartnerCouponUrl();
  
  // 3. 模擬 doGet 請求
  simulateDoGetRequest();
  
  console.log('=== ✅ 調試完成 ===');
}

function listAllPartners() {
  console.log('\n--- 👥 列出所有夥伴 ---');
  
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    if (!sheet || sheet.getLastRow() <= 1) {
      console.log('⚠️ Partners 表格沒有資料');
      return;
    }
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    
    console.log('📋 標題行:', headers.join(' | '));
    
    const partnerCodeIndex = headers.indexOf('partner_code');
    const nameIndex = headers.indexOf('name');
    const couponUrlIndex = headers.indexOf('coupon_url');
    
    console.log('📊 欄位索引:');
    console.log('  partner_code 索引:', partnerCodeIndex);
    console.log('  name 索引:', nameIndex);
    console.log('  coupon_url 索引:', couponUrlIndex);
    
    console.log('\n👥 所有夥伴:');
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      console.log(`  夥伴 ${i}:`);
      console.log(`    代碼: ${row[partnerCodeIndex] || '未設定'}`);
      console.log(`    姓名: ${row[nameIndex] || '未設定'}`);
      console.log(`    優惠券連結: ${row[couponUrlIndex] || '未設定'}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ 列出夥伴失敗:', error);
  }
}

function testGetPartnerCouponUrl() {
  console.log('\n--- 🧪 測試 getPartnerCouponUrl 函數 ---');
  
  // 測試已知的夥伴代碼
  const testCodes = ['yo01', 'gkh', 'FOREST001', 'TEST_CORRECT', '999000'];
  
  testCodes.forEach(code => {
    console.log(`\n🔍 測試夥伴代碼: ${code}`);
    
    if (typeof getPartnerCouponUrl === 'function') {
      try {
        const result = getPartnerCouponUrl(code);
        console.log(`  結果: ${result || 'null/undefined'}`);
        
        if (result) {
          console.log('  ✅ 找到優惠券連結');
        } else {
          console.log('  ❌ 沒有找到優惠券連結');
        }
      } catch (error) {
        console.error('  ❌ 函數執行錯誤:', error);
      }
    } else {
      console.log('  ❌ getPartnerCouponUrl 函數不存在');
    }
  });
}

function simulateDoGetRequest() {
  console.log('\n--- 🌐 模擬 doGet 請求 ---');
  
  // 測試不同的夥伴代碼
  const testCodes = ['yo01', 'gkh', 'FOREST001'];
  
  testCodes.forEach(code => {
    console.log(`\n🎯 測試夥伴代碼: ${code}`);
    
    // 模擬 doGet 事件
    const mockEvent = {
      parameter: {
        pid: code,
        dest: 'coupon'
      }
    };
    
    try {
      if (typeof doGet === 'function') {
        const result = doGet(mockEvent);
        
        if (result && typeof result.getContent === 'function') {
          const content = result.getContent();
          console.log('  doGet 回應內容:');
          
          // 檢查是否包含重定向 URL
          const urlMatch = content.match(/url=([^"]+)/);
          if (urlMatch) {
            const redirectUrl = decodeURIComponent(urlMatch[1]);
            console.log(`  重定向 URL: ${redirectUrl}`);
            
            // 檢查是否為預設連結
            if (redirectUrl.includes('line.me/R/ti/p/@478hisen')) {
              console.log('  ⚠️ 使用了預設 LINE 連結');
            } else {
              console.log('  ✅ 使用了專屬優惠券連結');
            }
          } else {
            console.log('  ❌ 無法找到重定向 URL');
          }
        }
      } else {
        console.log('  ❌ doGet 函數不存在');
      }
    } catch (error) {
      console.error('  ❌ doGet 模擬失敗:', error);
    }
  });
}

function testSpecificPartner(partnerCode) {
  console.log(`\n=== 🎯 專門測試夥伴: ${partnerCode} ===`);
  
  // 1. 直接查詢資料庫
  console.log('\n1. 直接查詢資料庫:');
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    
    const couponUrlIndex = headers.indexOf('coupon_url');
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][1] === partnerCode) { // partner_code 在第 B 列
        console.log('  找到夥伴:', partnerCode);
        console.log('  coupon_url 欄位索引:', couponUrlIndex);
        console.log('  coupon_url 值:', values[i][couponUrlIndex]);
        break;
      }
    }
  } catch (error) {
    console.error('  資料庫查詢失敗:', error);
  }
  
  // 2. 使用函數查詢
  console.log('\n2. 使用函數查詢:');
  if (typeof getPartnerCouponUrl === 'function') {
    const result = getPartnerCouponUrl(partnerCode);
    console.log('  函數結果:', result);
  }
  
  // 3. 模擬完整請求
  console.log('\n3. 模擬完整請求:');
  const mockEvent = {
    parameter: {
      pid: partnerCode,
      dest: 'coupon'
    }
  };
  
  try {
    const result = doGet(mockEvent);
    if (result) {
      const content = result.getContent();
      const urlMatch = content.match(/url=([^"]+)/);
      if (urlMatch) {
        console.log('  最終重定向 URL:', decodeURIComponent(urlMatch[1]));
      }
    }
  } catch (error) {
    console.error('  完整請求模擬失敗:', error);
  }
}

// 快速測試特定問題
function quickCouponTest() {
  console.log('=== ⚡ 快速優惠券測試 ===\n');
  
  // 測試一個已知有 coupon_url 的夥伴
  testSpecificPartner('yo01');
  
  console.log('\n=== ✅ 快速測試完成 ===');
}