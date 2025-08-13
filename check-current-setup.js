// 檢查當前 Apps Script 設定
// 這個腳本應該在複製主要代碼之後執行

function checkCurrentSetup() {
  console.log('=== 檢查當前設定 ===\n');
  
  // 列出所有可用的全域函數
  console.log('--- 檢查可用函數 ---');
  
  const functionsToCheck = [
    'doGet',
    'doPost',
    'doOptions',
    'handleCreatePartner',
    'handleCreateBooking',
    'handleConfirmCheckinCompletion',
    'handleGetDashboardData',
    'getPartnerCouponUrl',
    'createJsonResponse',
    'htmlEscape',
    'getSheetData',
    'recordClick',
    'testCommissionSystem'
  ];
  
  let foundFunctions = [];
  let missingFunctions = [];
  
  functionsToCheck.forEach(funcName => {
    try {
      if (typeof this[funcName] === 'function') {
        foundFunctions.push(funcName);
      } else {
        missingFunctions.push(funcName);
      }
    } catch (e) {
      missingFunctions.push(funcName);
    }
  });
  
  if (foundFunctions.length > 0) {
    console.log('✅ 找到的函數:');
    foundFunctions.forEach(f => console.log(`  - ${f}`));
  }
  
  if (missingFunctions.length > 0) {
    console.log('\n❌ 缺失的函數:');
    missingFunctions.forEach(f => console.log(`  - ${f}`));
  }
  
  // 檢查全域變數
  console.log('\n--- 檢查全域變數 ---');
  
  try {
    if (typeof SHEETS_ID !== 'undefined') {
      console.log('✅ SHEETS_ID:', SHEETS_ID);
    } else {
      console.log('❌ SHEETS_ID 未定義');
    }
  } catch (e) {
    console.log('❌ SHEETS_ID 未定義');
  }
  
  try {
    if (typeof DEFAULT_LINE_COUPON_URL !== 'undefined') {
      console.log('✅ DEFAULT_LINE_COUPON_URL:', DEFAULT_LINE_COUPON_URL);
    } else {
      console.log('❌ DEFAULT_LINE_COUPON_URL 未定義');
    }
  } catch (e) {
    console.log('❌ DEFAULT_LINE_COUPON_URL 未定義');
  }
  
  try {
    if (typeof GITHUB_PAGES_URL !== 'undefined') {
      console.log('✅ GITHUB_PAGES_URL:', GITHUB_PAGES_URL);
    } else {
      console.log('❌ GITHUB_PAGES_URL 未定義');
    }
  } catch (e) {
    console.log('❌ GITHUB_PAGES_URL 未定義');
  }
  
  // 結論
  console.log('\n--- 結論 ---');
  
  if (foundFunctions.includes('doGet') && foundFunctions.includes('getPartnerCouponUrl')) {
    console.log('✅ 主要代碼已正確載入！');
    console.log('📌 下一步：部署新版本');
  } else {
    console.log('❌ 主要代碼未載入');
    console.log('📌 請複製 backend/apps-script-commission-v2.js 的完整內容');
    console.log('📌 確保貼上所有 671 行代碼');
  }
}

// 測試單一函數是否存在
function testFunctionExists(functionName) {
  try {
    const exists = typeof this[functionName] === 'function';
    console.log(`${functionName}: ${exists ? '✅ 存在' : '❌ 不存在'}`);
    return exists;
  } catch (e) {
    console.log(`${functionName}: ❌ 錯誤 - ${e.message}`);
    return false;
  }
}