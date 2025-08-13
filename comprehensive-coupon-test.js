// 全面優惠券測試腳本 - 診斷為什麼優惠券按鈕重定向到預設 URL
// 請在 Apps Script 中執行這個腳本

function comprehensiveCouponTest() {
  console.log('=== 🔍 全面優惠券問題診斷 ===\n');
  
  // 1. 檢查環境設定
  checkEnvironmentSetup();
  
  // 2. 檢查現有夥伴數據
  checkExistingPartnerData();
  
  // 3. 測試具體夥伴的優惠券查詢
  testSpecificPartnerCouponQuery();
  
  // 4. 模擬完整的網頁請求流程
  simulateFullWebRequest();
  
  // 5. 檢查 Apps Script 部署狀態
  checkAppsScriptDeployment();
  
  console.log('\n=== ✅ 全面診斷完成 ===');
}

function checkEnvironmentSetup() {
  console.log('--- 🔧 檢查環境設定 ---');
  
  // 檢查 SHEETS_ID
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  console.log('SHEETS_ID:', SHEETS_ID);
  
  // 檢查預設連結
  const DEFAULT_LINE_COUPON_URL = 'https://lin.ee/q38pqot';
  console.log('預設優惠券 URL:', DEFAULT_LINE_COUPON_URL);
  
  // 檢查 GitHub Pages URL
  const GITHUB_PAGES_URL = 'https://didi1119.github.io/forest-gift-v1';
  console.log('GitHub Pages URL:', GITHUB_PAGES_URL);
  
  console.log('✅ 環境設定檢查完成\n');
}

function checkExistingPartnerData() {
  console.log('--- 📊 檢查現有夥伴數據 ---');
  
  const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Partners');
    
    if (!sheet) {
      console.error('❌ Partners 工作表不存在');
      return;
    }
    
    console.log('✅ Partners 工作表存在');
    console.log('行數:', sheet.getLastRow());
    
    if (sheet.getLastRow() <= 1) {
      console.warn('⚠️ Partners 表格沒有數據');
      return;
    }
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    
    console.log('標題行:', headers.join(', '));
    
    // 檢查關鍵欄位
    const partnerCodeIndex = headers.indexOf('partner_code');
    const nameIndex = headers.indexOf('name');
    const couponUrlIndex = headers.indexOf('coupon_url');
    
    console.log('重要欄位索引:');
    console.log('  partner_code:', partnerCodeIndex);
    console.log('  name:', nameIndex);
    console.log('  coupon_url:', couponUrlIndex);
    
    if (couponUrlIndex === -1) {
      console.error('❌ 找不到 coupon_url 欄位！');
      return;
    }
    
    console.log('\n現有夥伴數據:');
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const partnerCode = row[partnerCodeIndex];
      const name = row[nameIndex];
      const couponUrl = row[couponUrlIndex];
      
      console.log(`  夥伴 ${i}: ${partnerCode} (${name})`);
      console.log(`    coupon_url: ${couponUrl || '空值'}`);
      console.log(`    coupon_url 類型: ${typeof couponUrl}`);
      console.log(`    coupon_url 長度: ${couponUrl ? couponUrl.length : 0}`);
    }
    
  } catch (error) {
    console.error('❌ 檢查夥伴數據失敗:', error.toString());
  }
  
  console.log('');
}

function testSpecificPartnerCouponQuery() {
  console.log('--- 🧪 測試具體夥伴的優惠券查詢 ---');
  
  // 測試已知存在的夥伴代碼
  const testPartnerCodes = ['gkh', 'yo01', 'FOREST001', 'TEST_CORRECT'];
  
  testPartnerCodes.forEach(partnerCode => {
    console.log(`\n🔍 測試夥伴代碼: ${partnerCode}`);
    
    // 檢查函數是否存在
    if (typeof getPartnerCouponUrl !== 'function') {
      console.error('❌ getPartnerCouponUrl 函數不存在！');
      console.log('💡 請確認 Apps Script 已部署最新版本的 apps-script-commission-v2.js');
      return;
    }
    
    try {
      console.log('🚀 呼叫 getPartnerCouponUrl...');
      const result = getPartnerCouponUrl(partnerCode);
      
      console.log(`結果: ${result || 'null/undefined'}`);
      console.log(`結果類型: ${typeof result}`);
      
      if (result) {
        console.log('✅ 成功找到優惠券 URL');
        console.log(`URL 長度: ${result.length}`);
        
        // 檢查是否為預設 URL
        if (result === 'https://lin.ee/q38pqot') {
          console.log('⚠️ 這是預設的 LINE 優惠券 URL');
        } else {
          console.log('✅ 這是專屬的優惠券 URL');
        }
      } else {
        console.log('❌ 函數返回 null 或 undefined');
      }
      
    } catch (error) {
      console.error('❌ 查詢優惠券 URL 時發生錯誤:', error.toString());
    }
  });
  
  console.log('');
}

function simulateFullWebRequest() {
  console.log('--- 🌐 模擬完整的網頁請求流程 ---');
  
  // 測試已知的夥伴代碼
  const testPartnerCode = 'gkh'; // 根據之前的對話，這是一個已知的夥伴
  
  console.log(`測試夥伴代碼: ${testPartnerCode}`);
  
  // 模擬從前端發送的請求
  const mockEvent = {
    parameter: {
      pid: testPartnerCode,
      dest: 'coupon'
    }
  };
  
  console.log('模擬請求參數:', JSON.stringify(mockEvent.parameter));
  
  try {
    // 檢查 doGet 函數是否存在
    if (typeof doGet !== 'function') {
      console.error('❌ doGet 函數不存在！');
      return;
    }
    
    console.log('🚀 執行 doGet 函數...');
    const result = doGet(mockEvent);
    
    if (!result) {
      console.error('❌ doGet 返回 null');
      return;
    }
    
    if (typeof result.getContent !== 'function') {
      console.error('❌ doGet 返回的對象沒有 getContent 方法');
      return;
    }
    
    const htmlContent = result.getContent();
    console.log('HTML 內容長度:', htmlContent.length);
    
    // 解析重定向 URL
    const urlMatch = htmlContent.match(/url=([^"&]+)/);
    if (urlMatch) {
      const redirectUrl = decodeURIComponent(urlMatch[1]);
      console.log('重定向 URL:', redirectUrl);
      
      // 檢查是否為預設 URL
      if (redirectUrl.includes('lin.ee/q38pqot')) {
        console.log('❌ 使用了預設的 LINE 優惠券 URL');
        console.log('🔍 這表示 getPartnerCouponUrl 返回了 null');
      } else {
        console.log('✅ 使用了專屬的優惠券 URL');
      }
    } else {
      console.error('❌ 無法從 HTML 中找到重定向 URL');
      console.log('HTML 內容預覽:', htmlContent.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.error('❌ 模擬網頁請求失敗:', error.toString());
  }
  
  console.log('');
}

function checkAppsScriptDeployment() {
  console.log('--- 🚀 檢查 Apps Script 部署狀態 ---');
  
  // 檢查關鍵函數是否存在
  const criticalFunctions = [
    'doGet',
    'doPost',
    'getPartnerCouponUrl',
    'handleCreatePartner',
    'handleGetDashboardData'
  ];
  
  console.log('檢查關鍵函數:');
  criticalFunctions.forEach(funcName => {
    const exists = typeof eval(funcName) === 'function';
    console.log(`  ${funcName}: ${exists ? '✅ 存在' : '❌ 不存在'}`);
  });
  
  // 檢查全域變數
  console.log('\n檢查全域變數:');
  try {
    console.log('  SHEETS_ID:', typeof SHEETS_ID !== 'undefined' ? SHEETS_ID : '❌ 未定義');
    console.log('  DEFAULT_LINE_COUPON_URL:', typeof DEFAULT_LINE_COUPON_URL !== 'undefined' ? DEFAULT_LINE_COUPON_URL : '❌ 未定義');
    console.log('  GITHUB_PAGES_URL:', typeof GITHUB_PAGES_URL !== 'undefined' ? GITHUB_PAGES_URL : '❌ 未定義');
  } catch (error) {
    console.log('檢查全域變數時發生錯誤:', error.toString());
  }
  
  console.log('\n💡 如果有函數不存在，請:');
  console.log('1. 確認已複製最新的 apps-script-commission-v2.js 代碼');
  console.log('2. 點擊「部署」-> 「新增部署作業」');
  console.log('3. 選擇「網頁應用程式」類型');
  console.log('4. 設定執行身分為「我」，存取權限為「任何人」');
  console.log('5. 點擊「部署」並複製新的網頁應用程式 URL');
  
  console.log('');
}

// 快速測試特定夥伴的優惠券查詢
function quickTestPartner(partnerCode) {
  console.log(`=== ⚡ 快速測試夥伴: ${partnerCode} ===`);
  
  if (typeof getPartnerCouponUrl === 'function') {
    const result = getPartnerCouponUrl(partnerCode);
    console.log('查詢結果:', result || '找不到');
    
    if (result) {
      console.log('✅ 成功找到優惠券 URL');
    } else {
      console.log('❌ 函數返回 null，檢查:');
      console.log('1. 夥伴代碼是否正確');
      console.log('2. Google Sheets 中是否有該夥伴的數據');
      console.log('3. coupon_url 欄位是否有值');
    }
  } else {
    console.log('❌ getPartnerCouponUrl 函數不存在');
    console.log('請確認 Apps Script 已部署最新版本');
  }
  
  console.log('');
}

// 重新創建測試夥伴（如果需要）
function recreateTestPartner() {
  console.log('=== 👤 重新創建測試夥伴 ===');
  
  const testData = {
    action: 'create_partner',
    partner_code: 'COUPON_TEST',
    name: '優惠券測試夥伴',
    email: 'coupontest@forest.com',
    phone: '0987654321',
    coupon_code: 'FOREST_COUPON_TEST',
    coupon_url: 'https://line.me/R/ti/p/@coupon-test',
    landing_link: 'https://script.google.com/.../exec?pid=COUPON_TEST&dest=landing',
    coupon_link: 'https://script.google.com/.../exec?pid=COUPON_TEST&dest=coupon'
  };
  
  try {
    if (typeof handleCreatePartner === 'function') {
      const result = handleCreatePartner(testData, null);
      
      if (result && typeof result.getContent === 'function') {
        const content = result.getContent();
        const parsed = JSON.parse(content);
        
        if (parsed.success) {
          console.log('✅ 測試夥伴創建成功');
          console.log('夥伴代碼:', parsed.partner_code);
          
          // 立即測試這個新夥伴
          console.log('\n測試新創建的夥伴:');
          quickTestPartner('COUPON_TEST');
        } else {
          console.log('❌ 測試夥伴創建失敗:', parsed.error);
        }
      }
    } else {
      console.log('❌ handleCreatePartner 函數不存在');
    }
  } catch (error) {
    console.error('❌ 創建測試夥伴時發生錯誤:', error.toString());
  }
}