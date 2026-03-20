const { GoogleSpreadsheet } = require('google-spreadsheet');

async function setupGoogleSheets() {
  try {
    // 從環境變數讀取憑證（設定方式見 README.md）
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;
    const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
    const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
      console.error('❌ 請先設定環境變數: GOOGLE_SHEET_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY');
      console.error('   可在 .env 檔案或系統環境變數中設定');
      process.exit(1);
    }

    // 連接 Google Sheets
    const doc = new GoogleSpreadsheet(SHEET_ID);

    await doc.useServiceAccountAuth({
      client_email: CLIENT_EMAIL,
      private_key: PRIVATE_KEY,
    });
    await doc.loadInfo();

    console.log('✅ 連接到 Google Sheets 成功！');
    console.log('試算表標題:', doc.title);

    // 1. Affiliate Master 表
    let affiliateMaster = doc.sheetsByTitle['Affiliate Master'];
    if (!affiliateMaster) {
      affiliateMaster = await doc.addSheet({ title: 'Affiliate Master' });
    }
    
    await affiliateMaster.setHeaderRow([
      'partner_code', 'name', 'email', 'coupon_code', 'landing_link', 'coupon_link',
      'clicks_total', 'bookings_pending', 'bookings_paid', 'stays_completed',
      'bookings_canceled', 'bookings_refunded', 'eligible_conversions',
      'payout_this_period_manual', 'payout_lifetime_accum', 'notes',
      'current_level', 'level_achieved_at', 'level_valid_until',
      'current_year_successes', 'last_level_review_year'
    ]);
    console.log('✅ Affiliate Master 表設定完成');

    // 2. Clicks Log 表
    let clicksLog = doc.sheetsByTitle['Clicks Log'];
    if (!clicksLog) {
      clicksLog = await doc.addSheet({ title: 'Clicks Log' });
    }
    
    await clicksLog.setHeaderRow([
      'ts', 'partner_code', 'type', 'referrer', 'user_agent', 'ip'
    ]);
    console.log('✅ Clicks Log 表設定完成');

    // 3. Bookings 表
    let bookings = doc.sheetsByTitle['Bookings'];
    if (!bookings) {
      bookings = await doc.addSheet({ title: 'Bookings' });
    }
    
    await bookings.setHeaderRow([
      'booking_id', 'partner_code', 'coupon_code', 'subid', 'guest_name',
      'checkin_date', 'checkout_date', 'booking_amount', 'status',
      'verified_by', 'verified_at', 'commission_rate', 'commission_amount_manual',
      'payout_id'
    ]);
    console.log('✅ Bookings 表設定完成');

    // 4. Payouts 表
    let payouts = doc.sheetsByTitle['Payouts'];
    if (!payouts) {
      payouts = await doc.addSheet({ title: 'Payouts' });
    }
    
    await payouts.setHeaderRow([
      'payout_id', 'partner_code', 'period_start', 'period_end',
      'amount_manual', 'status', 'paid_at', 'method', 'notes'
    ]);
    console.log('✅ Payouts 表設定完成');

    // 5. Journals 表（週記）
    let journals = doc.sheetsByTitle['Journals'];
    if (!journals) {
      journals = await doc.addSheet({ title: 'Journals' });
    }
    
    await journals.setHeaderRow([
      'id', 'subid', 'content', 'timestamp', 'day'
    ]);
    console.log('✅ Journals 表設定完成');

    // 刪除預設的工作表（如果存在且不需要）
    const defaultSheet = doc.sheetsByTitle['工作表1'] || doc.sheetsByTitle['Sheet1'];
    if (defaultSheet && doc.sheetsByIndex.length > 5) {
      await defaultSheet.delete();
      console.log('✅ 預設工作表已刪除');
    }

    console.log('🎉 Google Sheets 四表結構設定完成！');
    console.log('📊 表格清單：');
    console.log('  - Affiliate Master：夥伴主檔');
    console.log('  - Clicks Log：點擊記錄');
    console.log('  - Bookings：訂房記錄');
    console.log('  - Payouts：結算記錄');
    console.log('  - Journals：週記記錄');

  } catch (error) {
    console.error('❌ 設定失敗:', error.message);
  }
}

setupGoogleSheets();
