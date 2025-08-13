// 驗證部署腳本 - 確認 Apps Script 已正確部署

function verifyDeployment() {
  console.log('=== 🔍 驗證 Apps Script 部署 ===\n');
  
  // 1. 檢查關鍵函數
  console.log('--- 檢查關鍵函數 ---');
  const requiredFunctions = [
    'doGet',
    'doPost',
    'getPartnerCouponUrl',
    'handleCreatePartner',
    'handleGetDashboardData',
    'handleCreateBooking',
    'handleConfirmCheckinCompletion'
  ];
  
  let allFunctionsExist = true;
  requiredFunctions.forEach(funcName => {
    const exists = typeof eval(funcName) === 'function';
    console.log(`${funcName}: ${exists ? '✅' : '❌'}`);
    if (!exists) allFunctionsExist = false;
  });
  
  if (!allFunctionsExist) {
    console.error('\n❌ 部分函數缺失！請確認已複製完整的 apps-script-commission-v2.js');
    return;
  }
  
  console.log('\n✅ 所有必要函數都存在');
  
  // 2. 測試 getPartnerCouponUrl
  console.log('\n--- 測試優惠券查詢 ---');
  const testPartnerCode = 'jx'; // 根據診斷結果，這是現有的夥伴
  
  console.log(`測試夥伴: ${testPartnerCode}`);
  const couponUrl = getPartnerCouponUrl(testPartnerCode);
  console.log(`查詢結果: ${couponUrl}`);
  
  if (couponUrl === 'https://lin.ee/gwIx5lE') {
    console.log('✅ 優惠券 URL 查詢正確！');
  } else {
    console.log('❌ 優惠券 URL 查詢不正確');
  }
  
  // 3. 模擬完整請求
  console.log('\n--- 模擬完整請求 ---');
  const mockEvent = {
    parameter: {
      pid: testPartnerCode,
      dest: 'coupon'
    }
  };
  
  try {
    const result = doGet(mockEvent);
    const html = result.getContent();
    
    // 檢查重定向 URL
    const urlMatch = html.match(/url=([^"]+)/);
    if (urlMatch) {
      const redirectUrl = decodeURIComponent(urlMatch[1]);
      console.log(`重定向 URL: ${redirectUrl}`);
      
      if (redirectUrl === 'https://lin.ee/gwIx5lE') {
        console.log('✅ 重定向到正確的專屬優惠券 URL！');
      } else if (redirectUrl === 'https://lin.ee/q38pqot') {
        console.log('❌ 仍然重定向到預設 URL');
      } else {
        console.log('⚠️ 重定向到未知 URL');
      }
    }
  } catch (error) {
    console.error('模擬請求失敗:', error);
  }
  
  console.log('\n=== ✅ 驗證完成 ===');
  console.log('如果所有檢查都通過，優惠券重定向功能應該已經修復！');
}

// 快速測試單個夥伴
function quickVerifyPartner(partnerCode) {
  console.log(`=== ⚡ 快速驗證夥伴: ${partnerCode} ===`);
  
  if (typeof getPartnerCouponUrl !== 'function') {
    console.error('❌ getPartnerCouponUrl 函數不存在');
    console.log('請先複製並部署 apps-script-commission-v2.js');
    return;
  }
  
  const couponUrl = getPartnerCouponUrl(partnerCode);
  console.log(`優惠券 URL: ${couponUrl || '未找到'}`);
  
  // 模擬請求
  const mockEvent = {
    parameter: {
      pid: partnerCode,
      dest: 'coupon'
    }
  };
  
  try {
    const result = doGet(mockEvent);
    const html = result.getContent();
    const urlMatch = html.match(/url=([^"]+)/);
    
    if (urlMatch) {
      const redirectUrl = decodeURIComponent(urlMatch[1]);
      console.log(`最終重定向: ${redirectUrl}`);
    }
  } catch (error) {
    console.error('模擬請求失敗:', error);
  }
}