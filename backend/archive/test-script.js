// ===== 知音計畫測試腳本 =====
// 用於測試 apps-script-integrated-v3.js 的所有功能

// 測試配置
const TEST_CONFIG = {
  APPS_SCRIPT_URL: 'YOUR_APPS_SCRIPT_URL_HERE', // 請填入你的 Google Apps Script URL
  DELAY_MS: 1000 // 每個測試之間的延遲
};

// 測試數據
const TEST_DATA = {
  partner: {
    partner_code: 'TEST001',
    partner_name: '測試大使',
    contact_phone: '0912345678',
    contact_email: 'test@example.com',
    bank_code: '808',
    bank_account: '12345678901234',
    commission_preference: 'ACCOMMODATION'
  },
  booking: {
    guest_name: '測試房客',
    guest_phone: '0987654321',
    guest_email: 'guest@example.com',
    checkin_date: '2024-12-25',
    checkout_date: '2024-12-27',
    room_price: 5000
  }
};

// 測試結果記錄
const testResults = [];

// 延遲函數
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// API 調用函數
async function callAPI(action, data) {
  try {
    const params = new URLSearchParams({
      action: action,
      ...data
    });
    
    const response = await fetch(TEST_CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      mode: 'no-cors' // 避免 CORS 問題
    });
    
    // 注意：no-cors 模式下無法讀取響應內容
    // 實際測試時應該在 Google Apps Script 中查看日誌
    return { success: true, message: `${action} 請求已發送` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 測試函數集合
const tests = {
  // 1. 測試創建大使
  async testCreatePartner() {
    console.log('📝 測試創建大使...');
    const result = await callAPI('create_partner', TEST_DATA.partner);
    testResults.push({
      test: '創建大使',
      expected: '成功創建大使 TEST001',
      result: result
    });
    await delay(TEST_CONFIG.DELAY_MS);
  },

  // 2. 測試創建訂房（REFERRAL類型）
  async testCreateReferralBooking() {
    console.log('📝 測試創建推薦訂房...');
    const result = await callAPI('create_booking', {
      ...TEST_DATA.booking,
      partner_code: TEST_DATA.partner.partner_code
    });
    testResults.push({
      test: '創建推薦訂房',
      expected: 'booking_source 應為 REFERRAL，total_referrals 應增加',
      result: result
    });
    await delay(TEST_CONFIG.DELAY_MS);
  },

  // 3. 測試創建訂房（SELF_USE類型）
  async testCreateSelfUseBooking() {
    console.log('📝 測試創建自用訂房...');
    const result = await callAPI('create_booking', {
      ...TEST_DATA.booking,
      partner_code: TEST_DATA.partner.partner_code,
      booking_source: 'SELF_USE',
      guest_name: '測試大使（自用）'
    });
    testResults.push({
      test: '創建自用訂房',
      expected: 'booking_source 應為 SELF_USE，total_referrals 不應增加',
      result: result
    });
    await delay(TEST_CONFIG.DELAY_MS);
  },

  // 4. 測試確認入住完成
  async testConfirmCheckin() {
    console.log('📝 測試確認入住完成...');
    const result = await callAPI('confirm_checkin_completion', {
      guest_name: TEST_DATA.booking.guest_name,
      guest_phone: TEST_DATA.booking.guest_phone,
      checkin_date: TEST_DATA.booking.checkin_date
    });
    testResults.push({
      test: '確認入住完成',
      expected: '計算佣金，LV1 住宿金應為 2500（1000+1500首次獎勵）',
      result: result
    });
    await delay(TEST_CONFIG.DELAY_MS);
  },

  // 5. 測試使用住宿金
  async testUseAccommodationPoints() {
    console.log('📝 測試使用住宿金...');
    const result = await callAPI('use_accommodation_points', {
      partner_code: TEST_DATA.partner.partner_code,
      deduct_amount: 1000,
      checkin_date: '2024-12-28',
      room_price: 3000
    });
    testResults.push({
      test: '使用住宿金',
      expected: 'available_points 減少 1000，points_used 增加 1000',
      result: result
    });
    await delay(TEST_CONFIG.DELAY_MS);
  },

  // 6. 測試轉換現金
  async testConvertPointsToCash() {
    console.log('📝 測試轉換點數為現金...');
    const result = await callAPI('convert_points_to_cash', {
      partner_code: TEST_DATA.partner.partner_code,
      points_used: 1000,
      cash_amount: 500,
      exchange_rate: 0.5
    });
    testResults.push({
      test: '轉換點數為現金',
      expected: 'available_points 減少 1000，pending_commission 增加 500',
      result: result
    });
    await delay(TEST_CONFIG.DELAY_MS);
  },

  // 7. 測試更新訂房（推薦人變更）
  async testUpdateBookingPartner() {
    console.log('📝 測試更新訂房推薦人...');
    // 首先創建另一個大使
    await callAPI('create_partner', {
      ...TEST_DATA.partner,
      partner_code: 'TEST002',
      partner_name: '測試大使2'
    });
    
    const result = await callAPI('update_booking', {
      guest_name: TEST_DATA.booking.guest_name,
      guest_phone: TEST_DATA.booking.guest_phone,
      partner_code: 'TEST002'
    });
    testResults.push({
      test: '更新訂房推薦人',
      expected: '撤銷 TEST001 佣金，計算 TEST002 佣金',
      result: result
    });
    await delay(TEST_CONFIG.DELAY_MS);
  },

  // 8. 測試更新訂房（狀態變更）
  async testUpdateBookingStatus() {
    console.log('📝 測試更新訂房狀態...');
    // 創建一個新的待確認訂房
    await callAPI('create_booking', {
      ...TEST_DATA.booking,
      guest_name: '狀態測試房客',
      partner_code: TEST_DATA.partner.partner_code
    });
    
    // 通過更新狀態來觸發確認入住
    const result = await callAPI('update_booking', {
      guest_name: '狀態測試房客',
      guest_phone: TEST_DATA.booking.guest_phone,
      stay_status: 'COMPLETED'
    });
    testResults.push({
      test: '更新訂房狀態觸發業務流程',
      expected: 'PENDING → COMPLETED 應觸發確認入住流程',
      result: result
    });
    await delay(TEST_CONFIG.DELAY_MS);
  },

  // 9. 測試取消訂房
  async testDeleteBooking() {
    console.log('📝 測試取消訂房...');
    const result = await callAPI('delete_booking', {
      guest_name: TEST_DATA.booking.guest_name,
      guest_phone: TEST_DATA.booking.guest_phone
    });
    testResults.push({
      test: '取消訂房',
      expected: '已完成訂房應撤銷佣金，減少推薦統計',
      result: result
    });
    await delay(TEST_CONFIG.DELAY_MS);
  },

  // 10. 測試取消結算
  async testCancelPayout() {
    console.log('📝 測試取消結算...');
    // 這需要知道一個 Payout ID，實際測試時需要從數據庫獲取
    const result = await callAPI('cancel_payout', {
      payout_id: 'PAYOUT_ID_HERE'
    });
    testResults.push({
      test: '取消結算',
      expected: '撤銷相關佣金，創建 COMMISSION_REVERSAL 記錄',
      result: result
    });
    await delay(TEST_CONFIG.DELAY_MS);
  },

  // 11. 測試支付完成
  async testProcessPayout() {
    console.log('📝 測試處理支付完成...');
    const result = await callAPI('process_payout', {
      partner_code: TEST_DATA.partner.partner_code,
      amount: 500,
      bank_transfer_date: '2024-08-16',
      bank_transfer_reference: 'REF123456'
    });
    testResults.push({
      test: '處理支付完成',
      expected: 'pending_commission 歸零，total_commission_paid 增加',
      result: result
    });
    await delay(TEST_CONFIG.DELAY_MS);
  },

  // 12. 測試循環調用防護
  async testCircularCallPrevention() {
    console.log('📝 測試循環調用防護...');
    // 嘗試創建可能觸發循環的更新
    const result = await callAPI('update_booking', {
      guest_name: '循環測試房客',
      guest_phone: '0911111111',
      stay_status: 'COMPLETED',
      _internal_call: false
    });
    testResults.push({
      test: '循環調用防護',
      expected: '不應觸發無限循環',
      result: result
    });
    await delay(TEST_CONFIG.DELAY_MS);
  }
};

// 主測試函數
async function runAllTests() {
  console.log('🚀 開始執行知音計畫測試套件');
  console.log('================================');
  
  // 檢查配置
  if (TEST_CONFIG.APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    console.error('❌ 請先設定 TEST_CONFIG.APPS_SCRIPT_URL');
    return;
  }
  
  // 執行測試
  const testFunctions = [
    'testCreatePartner',
    'testCreateReferralBooking',
    'testCreateSelfUseBooking',
    'testConfirmCheckin',
    'testUseAccommodationPoints',
    'testConvertPointsToCash',
    'testUpdateBookingPartner',
    'testUpdateBookingStatus',
    'testDeleteBooking',
    'testProcessPayout',
    'testCircularCallPrevention'
  ];
  
  for (const testName of testFunctions) {
    try {
      await tests[testName]();
    } catch (error) {
      console.error(`❌ ${testName} 發生錯誤:`, error);
      testResults.push({
        test: testName,
        error: error.message
      });
    }
  }
  
  // 顯示測試結果
  console.log('\n================================');
  console.log('📊 測試結果總結：');
  console.log('================================');
  
  testResults.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.test}`);
    console.log(`   預期: ${result.expected || 'N/A'}`);
    console.log(`   結果: ${JSON.stringify(result.result || result.error)}`);
  });
  
  console.log('\n================================');
  console.log('✅ 測試完成！');
  console.log('⚠️  注意：由於 CORS 限制，請在 Google Apps Script 的日誌中查看實際執行結果');
  console.log('📝 建議：在 Google Apps Script 中添加詳細的 Logger.log() 來追蹤執行狀況');
}

// 執行測試
// runAllTests();

// 導出給 HTML 使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllTests, tests, callAPI };
}