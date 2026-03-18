#!/usr/bin/env node
// ========================================
// Google Sheets → Supabase 資料遷移腳本
// 用法: node setup/migrate-sheets-to-supabase.js
// 需要 .env.local 或環境變數中設定：
//   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEETS_ID
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
// ========================================

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// 動態載入 sheets 模組
const sheets = require('../api/_lib/sheets');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 表名對照
const TABLES = [
  { sheet: 'Partners', table: 'partners' },
  { sheet: 'Bookings', table: 'bookings' },
  { sheet: 'Payouts', table: 'payouts' },
  { sheet: 'Accommodation_Usage', table: 'accommodation_usage' },
  { sheet: 'Clicks', table: 'clicks' },
  { sheet: 'Applications', table: 'applications' }
];

const BATCH_SIZE = 100;

/**
 * 將 Sheets 的 2D 陣列轉為物件陣列
 */
function sheetDataToObjects(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(h => String(h).toLowerCase().trim());
  const records = [];

  for (let i = 1; i < values.length; i++) {
    const obj = {};
    headers.forEach((header, idx) => {
      if (header) obj[header] = values[i][idx] !== undefined ? values[i][idx] : null;
    });
    records.push(obj);
  }
  return records;
}

/**
 * 型別轉換：將 Sheets 的字串轉為適當型別
 */
function convertTypes(record, tableName) {
  const numericFields = [
    'room_price', 'commission_amount', 'first_referral_bonus_amount',
    'amount', 'deduct_amount', 'total_commission_earned', 'total_commission_paid',
    'pending_commission', 'available_points', 'points_used', 'total_commission',
    'original_commission_amount', 'original_room_price'
  ];
  const intFields = [
    'level_progress', 'total_successful_referrals', 'total_referrals',
    'successful_referrals', 'yearly_referrals', 'total_clicks',
    'yearly_referrals_year', 'last_level_review_year'
  ];
  const boolFields = ['is_active'];

  for (const field of numericFields) {
    if (record[field] !== undefined) {
      if (record[field] === null || record[field] === '') {
        record[field] = 0;
      } else {
        record[field] = parseFloat(record[field]) || 0;
      }
    }
  }

  for (const field of intFields) {
    if (record[field] !== undefined) {
      if (record[field] === null || record[field] === '') {
        record[field] = 0;
      } else {
        record[field] = parseInt(record[field]) || 0;
      }
    }
  }

  for (const field of boolFields) {
    if (record[field] !== undefined) {
      record[field] = record[field] === true || record[field] === 'true' || record[field] === 'TRUE';
    }
  }

  // partner_link_sent: Sheets 裡可能是 true/false 字串
  if (record.partner_link_sent !== undefined) {
    record.partner_link_sent = String(record.partner_link_sent);
  }

  // is_first_referral_bonus: 轉為字串
  if (record.is_first_referral_bonus !== undefined) {
    record.is_first_referral_bonus = String(record.is_first_referral_bonus);
  }

  return record;
}

/**
 * 取得 Supabase 表的有效欄位，過濾掉表中不存在的欄位
 */
const validColumnsCache = {};
async function getValidColumns(table) {
  if (validColumnsCache[table]) return validColumnsCache[table];
  const { data, error } = await supabase.from(table).select('*').limit(0);
  if (error) {
    // 備用：插一筆空的看哪些欄位存在
    console.log(`  Warning: cannot detect columns for ${table}, skipping filter`);
    return null;
  }
  // 用 RPC 取欄位名
  const { data: cols } = await supabase.rpc('get_columns', { tbl: table }).catch(() => ({ data: null }));
  return null; // 用另一種方式
}

function filterRecord(record, knownBadColumns) {
  const filtered = {};
  for (const [key, val] of Object.entries(record)) {
    if (!knownBadColumns.has(key)) {
      filtered[key] = val;
    }
  }
  return filtered;
}

/**
 * 分批 upsert 到 Supabase（自動偵測並移除不存在的欄位）
 */
async function batchUpsert(table, records, conflictColumn) {
  let inserted = 0;
  const badColumns = new Set();

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE).map(r => filterRecord(r, badColumns));
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflictColumn || 'id' });

    if (error) {
      // 檢查是否是欄位不存在的錯誤
      const colMatch = error.message.match(/Could not find the '([^']+)' column/);
      if (colMatch) {
        badColumns.add(colMatch[1]);
        console.log(`  自動移除不存在的欄位: ${colMatch[1]}`);
        // 重試這個 batch
        i -= BATCH_SIZE;
        continue;
      }

      console.error(`  Error upserting batch ${i}-${i + batch.length} to ${table}:`, error.message);
      // 逐筆插入
      for (const record of batch) {
        const cleaned = filterRecord(record, badColumns);
        const { error: singleError } = await supabase
          .from(table)
          .upsert(cleaned, { onConflict: conflictColumn || 'id' });
        if (singleError) {
          const colMatch2 = singleError.message.match(/Could not find the '([^']+)' column/);
          if (colMatch2) {
            badColumns.add(colMatch2[1]);
            console.log(`  自動移除不存在的欄位: ${colMatch2[1]}`);
            // 重試這筆
            const retryCleaned = filterRecord(record, badColumns);
            const { error: retryError } = await supabase
              .from(table)
              .upsert(retryCleaned, { onConflict: conflictColumn || 'id' });
            if (!retryError) { inserted++; continue; }
          }
          console.error(`  Failed record id=${record.id}:`, singleError.message);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }
  }

  if (badColumns.size > 0) {
    console.log(`  已忽略的欄位: ${[...badColumns].join(', ')}`);
  }
  return inserted;
}

/**
 * 重設 auto-increment sequence
 */
async function resetSequence(table) {
  const { data, error } = await supabase.rpc('reset_sequence', { table_name: table });
  if (error) {
    // 如果 RPC 不存在，用直接 SQL（需要在 Supabase Dashboard 執行）
    console.log(`  Note: Run this SQL in Supabase to reset sequence:`);
    console.log(`  SELECT setval('${table}_id_seq', (SELECT COALESCE(MAX(id), 0) FROM ${table}));`);
  }
}

async function migrate() {
  console.log('========================================');
  console.log('Google Sheets → Supabase 資料遷移');
  console.log('========================================\n');

  const results = {};

  for (const { sheet, table } of TABLES) {
    console.log(`\n--- 遷移 ${sheet} → ${table} ---`);

    try {
      // 1. 讀取 Google Sheets
      console.log(`  讀取 ${sheet}...`);
      const values = await sheets.getSheetData(sheet);
      const records = sheetDataToObjects(values);
      console.log(`  從 Sheets 讀取到 ${records.length} 筆記錄`);

      if (records.length === 0) {
        results[sheet] = { sheets: 0, supabase: 0, status: 'EMPTY' };
        continue;
      }

      // 2. 型別轉換
      const converted = records.map(r => convertTypes(r, table));

      // 3. 去重（Sheets 可能有重複 ID）
      const conflictColumn = table === 'partners' ? 'partner_code' : 'id';
      const seen = new Set();
      const deduped = [];
      for (const r of converted) {
        const key = table === 'partners' ? r.partner_code : r.id;
        if (key !== undefined && key !== null && key !== '') {
          if (seen.has(key)) {
            console.log(`  跳過重複 ${conflictColumn}=${key}`);
            continue;
          }
          seen.add(key);
        }
        deduped.push(r);
      }
      if (deduped.length < converted.length) {
        console.log(`  去重: ${converted.length} → ${deduped.length} 筆`);
      }
      const finalRecords = deduped;

      // 4. Upsert 到 Supabase
      console.log(`  寫入 ${table}...`);
      const inserted = await batchUpsert(table, finalRecords, conflictColumn);
      console.log(`  成功寫入 ${inserted} 筆`);

      // 5. 驗證筆數
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      const supabaseCount = error ? '?' : count;
      console.log(`  驗證: Sheets=${records.length}, Supabase=${supabaseCount}`);

      results[sheet] = {
        sheets: records.length,
        supabase: supabaseCount,
        status: records.length === supabaseCount ? 'OK' : 'MISMATCH'
      };

      // 6. 重設 sequence
      await resetSequence(table);

    } catch (err) {
      console.error(`  遷移 ${sheet} 失敗:`, err.message);
      results[sheet] = { sheets: '?', supabase: '?', status: 'ERROR: ' + err.message };
    }
  }

  // 報告
  console.log('\n========================================');
  console.log('遷移結果摘要');
  console.log('========================================');
  for (const [sheet, result] of Object.entries(results)) {
    const status = result.status === 'OK' ? '✓' : '✗';
    console.log(`  ${status} ${sheet}: Sheets=${result.sheets}, Supabase=${result.supabase} [${result.status}]`);
  }

  console.log('\n重設 sequence SQL（請在 Supabase Dashboard 執行）:');
  for (const { table } of TABLES) {
    console.log(`  SELECT setval('${table}_id_seq', (SELECT COALESCE(MAX(id), 0) FROM ${table}));`);
  }

  console.log('\n遷移完成！');
}

migrate().catch(err => {
  console.error('遷移失敗:', err);
  process.exit(1);
});
