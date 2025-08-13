// 測試特定夥伴的腳本 - 請在 Apps Script 中執行

function testPartnerGKH() {
  console.log('=== 🧪 測試夥伴 gkh ===');
  
  // 1. 測試 getPartnerCouponUrl 函數
  if (typeof getPartnerCouponUrl === 'function') {
    console.log('✅ getPartnerCouponUrl 函數存在');
    
    const result = getPartnerCouponUrl('gkh');
    console.log('查詢結果:', result);
    
    if (result) {
      console.log('✅ 成功找到夥伴 gkh 的優惠券連結');
    } else {
      console.log('❌ 找不到夥伴 gkh 的優惠券連結');
    }
  } else {
    console.log('❌ getPartnerCouponUrl 函數不存在');
    console.log('請確保已複製最新的 apps-script-commission-v2.js 代碼');
  }
}

function testWebAppEndpoint() {
  console.log('=== 🌐 測試 Web App 端點 ===');
  
  // 測試 doGet 函數（模擬網頁請求）
  const mockEvent = {
    parameter: {
      pid: 'gkh',
      dest: 'coupon'
    }
  };
  
  try {
    const result = doGet(mockEvent);
    console.log('doGet 測試結果:', result.getContent());
  } catch (error) {
    console.error('doGet 測試失敗:', error);
  }
}

function createValidTestPartner() {
  console.log('=== 👤 創建有效測試夥伴 ===');
  
  // 模擬創建一個有效的測試夥伴
  const testData = {
    action: 'create_partner',
    partner_code: 'FOREST001',
    name: '森林測試夥伴',
    email: 'test@forest.com',
    coupon_url: 'https://line.me/R/ti/p/@478hisen'
  };
  
  try {
    const result = handleCreatePartner(testData, null);
    console.log('創建夥伴結果:', result.getContent());
  } catch (error) {
    console.error('創建夥伴失敗:', error);
  }
}

// 測試管理後台數據載入
function testDashboardDataLoad() {
  console.log('=== 📊 測試管理後台數據載入 ===');
  
  if (typeof handleGetDashboardData === 'function') {
    try {
      const mockData = { action: 'get_dashboard_data' };
      const result = handleGetDashboardData(mockData, null);
      
      if (result && typeof result.getContent === 'function') {
        const content = result.getContent();
        const parsed = JSON.parse(content);
        
        console.log('✅ 後台數據載入成功');
        console.log('Partners 數量:', parsed.data?.partners?.length || 0);
        console.log('Partners 數據:', parsed.data?.partners);
      }
    } catch (error) {
      console.error('❌ 後台數據載入失敗:', error);
    }
  } else {
    console.log('❌ handleGetDashboardData 函數不存在');
  }
}

// 完整測試流程
function fullTest() {
  console.log('=== 🎯 完整測試流程 ===\n');
  
  testPartnerGKH();
  console.log('\n');
  
  testDashboardDataLoad();
  console.log('\n');
  
  testWebAppEndpoint();
  console.log('\n');
  
  console.log('=== ✅ 完整測試完成 ===');
}