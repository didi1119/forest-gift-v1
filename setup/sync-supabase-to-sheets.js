#!/usr/bin/env node
// ========================================
// Supabase → Google Sheets 反向同步腳本
// 用途：切到 Supabase 一段時間後，如果需要切回 Sheets，
//       先用此腳本把 Supabase 的資料同步回 Google Sheets。
//
// 用法: node setup/sync-supabase-to-sheets.js
// 需要 .env.local 或環境變數中設定：
//   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEETS_ID
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
// ========================================

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const sheets = require('../api/_lib/sheets');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 表名對照 + 欄位順序（與 Google Sheets 表頭一致）
const TABLES = [
  {
    sheet: 'Partners',
    table: 'partners',
    fields: ['id', 'partner_code', 'name', 'email', 'phone', 'level',
      'level_progress', 'total_successful_referrals', 'commission_preference',
      'total_commission_earned', 'total_commission_paid', 'pending_commission',
      'coupon_code', 'coupon_url', 'landing_link', 'coupon_link',
      'short_landing_link', 'short_coupon_link', 'created_at', 'updated_at',
      'available_points', 'points_used', 'bank_account', 'bank_code',
      'yearly_referrals', 'notes', 'is_active', 'contact_phone', 'contact_email']
  },
  {
    sheet: 'Bookings',
    table: 'bookings',
    fields: ['id', 'partner_code', 'guest_name', 'guest_phone', 'guest_email',
      'bank_account_last5', 'checkin_date', 'checkout_date', 'room_price',
      'booking_source', 'stay_status', 'payment_status', 'commission_status',
      'commission_amount', 'commission_type', 'is_first_referral_bonus',
      'first_referral_bonus_amount', 'manually_confirmed_by',
      'manually_confirmed_at', 'notes', 'created_at', 'updated_at']
  },
  {
    sheet: 'Payouts',
    table: 'payouts',
    fields: ['id', 'partner_code', 'payout_type', 'amount', 'related_booking_ids',
      'payout_method', 'payout_status', 'bank_transfer_date',
      'bank_transfer_reference', 'accommodation_voucher_code', 'notes',
      'created_by', 'created_at', 'updated_at']
  },
  {
    sheet: 'Accommodation_Usage',
    table: 'accommodation_usage',
    fields: ['id', 'partner_code', 'deduct_amount', 'related_booking_id',
      'usage_date', 'usage_type', 'notes', 'created_by', 'created_at', 'updated_at']
  },
  {
    sheet: 'Clicks',
    table: 'clicks',
    fields: ['id', 'partner_code', 'destination', 'utm_source', 'utm_medium',
      'utm_campaign', 'referrer', 'user_agent', 'ip_address', 'click_time',
      'created_at']
  },
  {
    sheet: 'Applications',
    table: 'applications',
    fields: ['id', 'name', 'email', 'line_name', 'phone', 'message',
      'referral_source', 'social_profile',
      'application_status', 'review_notes', 'reviewed_by', 'reviewed_at',
      'partner_code_assigned', 'partner_link_sent', 'created_at', 'updated_at']
  }
];

/**
 * 將 Supabase 記錄轉為 Sheets 的 2D 陣列（含表頭）
 */
function recordsToSheetValues(records, fields) {
  const values = [fields]; // 第一列為表頭

  for (const record of records) {
    const row = fields.map(field => {
      const val = record[field];
      if (val === null || val === undefined) return '';
      if (typeof val === 'boolean') return val.toString();
      return val;
    });
    values.push(row);
  }

  return values;
}

async function sync() {
  console.log('========================================');
  console.log('Supabase → Google Sheets 反向同步');
  console.log('========================================\n');

  const results = {};

  for (const { sheet, table, fields } of TABLES) {
    console.log(`\n--- 同步 ${table} → ${sheet} ---`);

    try {
      // 1. 從 Supabase 讀取全部資料
      console.log(`  讀取 ${table}...`);
      const { data: records, error } = await supabase
        .from(table)
        .select('*')
        .order('id', { ascending: true });

      if (error) throw new Error(error.message);
      console.log(`  從 Supabase 讀取到 ${records.length} 筆記錄`);

      // 2. 確保 Sheet 存在
      const exists = await sheets.sheetExists(sheet);
      if (!exists) {
        console.log(`  建立 ${sheet} 工作表...`);
        await sheets.createSheet(sheet, fields);
      }

      // 3. 清空現有資料（保留表頭）
      console.log(`  清空 ${sheet} 現有資料...`);
      const sheetsClient = await sheets.getSheetsClient();
      const SHEETS_ID = (process.env.GOOGLE_SHEETS_ID || '').trim();

      // 先取得現有資料筆數
      const existingData = await sheets.getSheetData(sheet);
      if (existingData && existingData.length > 1) {
        // 清除資料列（保留第一列表頭）
        const lastRow = existingData.length;
        const lastCol = existingData[0].length;
        const colLetter = sheets.columnToLetter(lastCol);
        await sheetsClient.spreadsheets.values.clear({
          spreadsheetId: SHEETS_ID,
          range: `${sheet}!A2:${colLetter}${lastRow + 1000}` // 多清一些
        });
      }

      // 4. 寫入新資料
      if (records.length > 0) {
        console.log(`  寫入 ${records.length} 筆記錄到 ${sheet}...`);
        const sheetValues = recordsToSheetValues(records, fields);

        // 更新表頭
        await sheetsClient.spreadsheets.values.update({
          spreadsheetId: SHEETS_ID,
          range: `${sheet}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [sheetValues[0]] }
        });

        // 分批寫入資料
        const dataRows = sheetValues.slice(1);
        const BATCH_SIZE = 500;
        for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
          const batch = dataRows.slice(i, i + BATCH_SIZE);
          await sheetsClient.spreadsheets.values.append({
            spreadsheetId: SHEETS_ID,
            range: sheet,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: batch }
          });
        }
      }

      // 5. 驗證
      const finalData = await sheets.getSheetData(sheet);
      const sheetsCount = finalData ? Math.max(0, finalData.length - 1) : 0;
      console.log(`  驗證: Supabase=${records.length}, Sheets=${sheetsCount}`);

      results[sheet] = {
        supabase: records.length,
        sheets: sheetsCount,
        status: records.length === sheetsCount ? 'OK' : 'MISMATCH'
      };

    } catch (err) {
      console.error(`  同步 ${sheet} 失敗:`, err.message);
      results[sheet] = { supabase: '?', sheets: '?', status: 'ERROR: ' + err.message };
    }
  }

  // 報告
  console.log('\n========================================');
  console.log('同步結果摘要');
  console.log('========================================');
  for (const [sheet, result] of Object.entries(results)) {
    const status = result.status === 'OK' ? '✓' : '✗';
    console.log(`  ${status} ${sheet}: Supabase=${result.supabase}, Sheets=${result.sheets} [${result.status}]`);
  }

  console.log('\n同步完成！現在可以安全地將 DATA_BACKEND 切回 sheets。');
}

sync().catch(err => {
  console.error('同步失敗:', err);
  process.exit(1);
});
