const { GoogleSpreadsheet } = require('google-spreadsheet');

async function setupGoogleSheets() {
  try {
    // 連接 Google Sheets
    const doc = new GoogleSpreadsheet('1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4');
    
    await doc.useServiceAccountAuth({
      client_email: 'forest-ambassador@foresthouse-468510.iam.gserviceaccount.com',
      private_key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDBu7t2F9Rqsq7N
13jBN8azJ+8k+SYvtUZLIGnMMFXA4CP8VUE/MiWz4X8Tiu6kG2ABKDPBYhU7eu1v
CBcCfxhiDhVr6LPS1YYs48L5lBbwGv7c8n2YUU+gn8KL/FWLF6MJcs80nr34hLB8
RDtmjBhAc8aeZgegblSpbEJJPgyVkzdJPzEq7BJvbYI4Pv92oREaV126kMIS2X72
H6O5uQJPfhUEX4G6o5Cn4UJzXpYmH7QF7LP4DqJElfd4OGuwgKhvSATjB5/i04R/
Oyhs/lV09aW1pwana6gLCNVWiKHACgDniob3FPOmIkbu+iB5DzIokePkKJ/SmdKl
6yQiRUmNAgMBAAECggEAO1iy+F4caAMMoWncR/Q6Hi+hhoX8OKkjO2hWgIJeApOm
8ml7b0yBWDU/pFDvAb6RDkmucRMGxg3GJjkoM0+TvJXr4f6K948JZz7uP14qGKts
X2q5Jqvh5KaMBi3qVo2LGB3fc5MdRr//AFI2kBdiZnwQ3/0JYQ/rR2sucxla6YaB
9w+VJP73+X900TEfm+jCm4tiYIr4gI/Us4xMRvJIX0XtXkFEnRFaETOccNUkgC9s
WpIsTDRthG1F89txU3T5hAbFiBOBfCjLWT9Osh2nvjhGnE94hAY/OyLfyDJmEyln
VGboCBCPxPyWwXXC1cOwFgoma33jTq+gGbiGNVee0QKBgQD7oS2Zj25f+AaAA8gT
PoiSVK6gXLwUIv2QhRF/snOPoq8jS4dYGeVZHyrSpC8h7ODBESOQUqmZZYgQcvEs
DSLhs2IpijtSA2tt05EGDKm/PF/bsbt5xPrDNLvney0+/aUTgivvkxdTrxuyvJ0V
58nMfHqcXeg2XN/wODePuzKfgwKBgQDFGSEyjoizvFGolC2q6wVI59vf2P5Wkb+b
XEhxahavGPaRXnqUqPshHBleJ9BcijGUHDt1YO9kd64iLGHb1UWjUqsg/ChZtdvG
3vFkAMqXZVE56lboZWO+aW0tx4ns6kmog72cP9HdGgLo5FFBTZrPFHjZLVgLCkUL
eKjrmXGVrwKBgQDxYsQQvJRggdkScw46z9FJtuyyL2PJWWuveMe5nWHYV3L1Q945
ONZX8VsuKIyCWe+dpihcqb/CxLCLPwh2fr+IjoHLYazYVyl2eO91Qy6PooY+hbhX
7wuzuWHMhNB5ze7O0R/+ujc1cxT6GJAE1I80l/EzEa7Sf7PfiL5cJnNAqwKBgFug
ohlBv/Vmr8OiF1Tk61EIUORQmXSfTycnkJoBCsid30qXVH81y4GJ8ZUfBzNuHzxO
n6mixce8B5zlaxzqmfQiY2HzN8L001YxoKCv6X7WYBt/gKWLNQJ5OoNUxx73kASi
MgyocqTKCd5A/jFQpY5tYvz7onmHba+2iTj13aMLAoGAJ8E8ru52/rcCF22Cpngs
BB1R4oHw6RmsZddxtDWwInBFoUjQuoTO+tlGzPgRviFbJebK9CxHtuk73UepsojO
XbZKx0qp+WztcqGI8tOKETT6+9v93k8Qwion+anFl4jKVkLj/DSxJaXVhu691Pzh
wPDNBdj0yXYGsFDtjCPs4mo=
-----END PRIVATE KEY-----`
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
      'payout_this_period_manual', 'payout_lifetime_accum', 'notes'
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