// ========================================
// Supabase Adapter — 實作 adapter 介面
// ========================================

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;

function getClient() {
  if (!supabase) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
    }
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// ========================================
// 表名對照：Sheet 名稱 → Supabase 表名（全小寫）
// ========================================

const TABLE_MAP = {
  'Partners': 'partners',
  'Bookings': 'bookings',
  'Payouts': 'payouts',
  'Accommodation_Usage': 'accommodation_usage',
  'Clicks': 'clicks',
  'Applications': 'applications'
};

function getTableName(sheetName) {
  return TABLE_MAP[sheetName] || sheetName.toLowerCase();
}

// ========================================
// Adapter 介面實作
// ========================================

/**
 * 取全部記錄 → [{...}, ...]
 */
async function getAllRecords(tableName) {
  const client = getClient();
  const table = getTableName(tableName);

  const { data, error } = await client
    .from(table)
    .select('*')
    .order('id', { ascending: true });

  if (error) throw new Error(`getAllRecords(${tableName}): ${error.message}`);
  return data || [];
}

/**
 * 依欄位查詢 → [{ rowIndex, data }, ...]
 * 保持與 sheets-adapter 相同的回傳格式
 */
async function findByField(tableName, field, value) {
  const client = getClient();
  const table = getTableName(tableName);
  const col = field.toLowerCase();

  const { data, error } = await client
    .from(table)
    .select('*')
    .eq(col, value);

  if (error) throw new Error(`findByField(${tableName}, ${field}): ${error.message}`);

  return (data || []).map(row => ({
    rowIndex: row.id, // Supabase 用 id 代替 rowIndex
    data: row
  }));
}

/**
 * 依 ID 查單筆 → { rowIndex, data } | null
 */
async function findById(tableName, id) {
  const client = getClient();
  const table = getTableName(tableName);

  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`findById(${tableName}, ${id}): ${error.message}`);
  if (!data) return null;

  return { rowIndex: data.id, data };
}

/**
 * 新增記錄（讓 PostgreSQL auto-increment ID）→ {...}
 */
async function create(tableName, data) {
  const client = getClient();
  const table = getTableName(tableName);
  const timestamp = new Date().toISOString();

  // 設定時間戳
  data.created_at = data.created_at || timestamp;
  data.updated_at = data.updated_at || timestamp;

  // 移除 id/ID，讓 PostgreSQL auto-increment
  const insertData = { ...data };
  delete insertData.id;
  delete insertData.ID;

  // 將 key 轉小寫（Supabase 欄位為小寫）
  const normalized = {};
  for (const [key, val] of Object.entries(insertData)) {
    normalized[key.toLowerCase()] = val;
  }

  const { data: result, error } = await client
    .from(table)
    .insert(normalized)
    .select()
    .single();

  if (error) throw new Error(`create(${tableName}): ${error.message}`);

  // 回傳時補上 id 和 ID（相容性）
  result.ID = result.id;
  console.log(`Created new record in ${tableName}: id=${result.id}`);
  return result;
}

/**
 * Upsert 記錄（依 onConflict 欄位）→ {...}
 * 用於 Partners（PK = partner_code）避免 duplicate key
 */
async function upsert(tableName, data, onConflictColumn) {
  const client = getClient();
  const table = getTableName(tableName);
  const timestamp = new Date().toISOString();

  data.updated_at = timestamp;
  data.created_at = data.created_at || timestamp;

  const insertData = { ...data };
  delete insertData.id;
  delete insertData.ID;

  const normalized = {};
  for (const [key, val] of Object.entries(insertData)) {
    normalized[key.toLowerCase()] = val;
  }

  const { data: result, error } = await client
    .from(table)
    .upsert(normalized, { onConflict: onConflictColumn })
    .select()
    .single();

  if (error) throw new Error(`upsert(${tableName}): ${error.message}`);

  result.ID = result.id || result[onConflictColumn];
  console.log(`Upserted record in ${tableName}: ${onConflictColumn}=${normalized[onConflictColumn]}`);
  return result;
}

/**
 * 更新記錄 → {...}
 */
async function update(tableName, id, updates) {
  const client = getClient();
  const table = getTableName(tableName);

  console.log(`--- update: ${tableName}, ID=${id} ---`);

  // 將 key 轉小寫
  const normalized = {};
  for (const [key, val] of Object.entries(updates)) {
    normalized[key.toLowerCase()] = val;
  }
  normalized.updated_at = new Date().toISOString();

  // Partners 用 partner_code 作為查詢鍵
  let query;
  if (tableName === 'Partners') {
    query = client.from(table).update(normalized).eq('partner_code', id);
  } else {
    query = client.from(table).update(normalized).eq('id', id);
  }

  const { data: result, error } = await query.select().single();

  if (error) {
    // 若用 id 找不到 Payouts，嘗試用 ID 欄位
    if (tableName === 'Payouts' && error.code === 'PGRST116') {
      const { data: retryResult, error: retryError } = await client
        .from(table)
        .update(normalized)
        .eq('id', id)
        .select()
        .single();
      if (retryError) throw new Error(`update(${tableName}, ${id}): ${retryError.message}`);
      console.log(`Updated record in ${tableName}: ID=${id}`);
      return retryResult;
    }
    throw new Error(`update(${tableName}, ${id}): ${error.message}`);
  }

  console.log(`Updated record in ${tableName}: ID=${id}`);
  return result;
}

/**
 * 確保表存在 — Supabase 為 no-op（表已預建）
 */
async function ensureTable(tableName, fields) {
  // No-op: Supabase 的表已經透過 SQL schema 預建
}

/**
 * 取欄位名稱列表
 */
async function getFields(tableName) {
  const client = getClient();
  const table = getTableName(tableName);

  // 取一筆來推斷欄位
  const { data, error } = await client
    .from(table)
    .select('*')
    .limit(1);

  if (error) throw new Error(`getFields(${tableName}): ${error.message}`);
  if (!data || data.length === 0) return [];

  return Object.keys(data[0]);
}

async function deleteByField(tableName, field, value) {
  const table = getTableName(tableName);
  const { error, count } = await getClient()
    .from(table)
    .delete({ count: 'exact' })
    .eq(field, value);

  if (error) throw new Error(`deleteByField(${tableName}, ${field}=${value}): ${error.message}`);
  return count || 0;
}

module.exports = {
  getAllRecords,
  findByField,
  findById,
  create,
  upsert,
  update,
  ensureTable,
  getFields,
  deleteByField
};
