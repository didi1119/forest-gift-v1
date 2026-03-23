// ========================================
// 知音計畫後端商業邏輯 — Vercel Serverless 版
// 從 Google Apps Script 轉換而來
// 資料層透過 data-adapter 抽象，支援 Sheets / Supabase 切換
// ========================================

const crypto = require('crypto');
const db = require('./data-adapter');
const {
  SHEETS_ID, GITHUB_PAGES_URL, DEFAULT_LINE_COUPON_URL,
  DEFAULT_LINE_COUPON_TITLE, DEFAULT_LINE_COUPON_DESCRIPTION,
  DEFAULT_LINE_COUPON_USAGE_CONDITION, DEFAULT_LINE_COUPON_VALID_DAYS,
  DEFAULT_LINE_SHARED_CLAIM_STATUS,
  COMMISSION_RATES, FIRST_REFERRAL_BONUS, LEVEL_REQUIREMENTS,
  LEVEL_RETENTION_REQUIREMENTS, DataModels
} = require('./config');

// 調用深度追蹤
let CALL_DEPTH = 0;
const MAX_CALL_DEPTH = 5;
const BUSINESS_TIMEZONE = 'Asia/Taipei';
const LEVEL_SEQUENCE = ['LV1_INSIDER', 'LV2_GUIDE', 'LV3_GUARDIAN'];
const LINE_COUPON_BINDING_TABLE = 'Line_Coupon_Bindings';
const LINE_REFERRAL_CLAIM_TABLE = 'Line_Referral_Claims';
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const LINE_SHARED_COUPON_ID = process.env.LINE_SHARED_COUPON_ID || '';
const LINE_COUPON_VISIBILITY = 'UNLISTED';
const LINE_COUPON_TIMEZONE = 'ASIA_TAIPEI';
const LINE_COUPON_IMAGE_URL = process.env.LINE_COUPON_IMAGE_URL || '';
const LIFF_ID = process.env.LIFF_ID || '';
const DASHBOARD_BASE_URL = 'https://forest-ambassador.vercel.app/frontend/partner-dashboard.html';

// ========================================
// LINE 免登入簽名 helpers
// ========================================
function generateLineLoginSig(lineUserId) {
  const secret = process.env.ADMIN_SECRET || '';
  return crypto.createHmac('sha256', secret).update(lineUserId).digest('hex');
}

function generateLineDashboardUrl(lineUserId) {
  const sig = generateLineLoginSig(lineUserId);
  return `${DASHBOARD_BASE_URL}?lu=${encodeURIComponent(lineUserId)}&sig=${sig}`;
}

// ========================================
// 通用數據訪問函數（adapter 薄包裝）
// ========================================

async function findRecordsByField(sheetName, fieldName, value) {
  return db.findByField(sheetName, fieldName, value);
}

async function findRecordById(sheetName, id) {
  return db.findById(sheetName, id);
}

async function updateRecord(sheetName, id, updates) {
  return db.update(sheetName, id, updates);
}

async function createRecord(sheetName, data) {
  return db.create(sheetName, data);
}

async function upsertRecord(sheetName, data, onConflictColumn) {
  return db.upsert(sheetName, data, onConflictColumn);
}

async function ensureTable(sheetName, fields) {
  return db.ensureTable(sheetName, fields);
}

// ========================================
// 輔助函數
// ========================================

function toInt(value, fallback = 0) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumber(value, fallback = 0) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLevel(level) {
  return LEVEL_SEQUENCE.includes(level) ? level : 'LV1_INSIDER';
}

function getLevelRank(level) {
  return LEVEL_SEQUENCE.indexOf(normalizeLevel(level));
}

function maxLevel(levelA, levelB) {
  return getLevelRank(levelA) >= getLevelRank(levelB) ? normalizeLevel(levelA) : normalizeLevel(levelB);
}

function getBusinessDateParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const lookup = {};
  for (const part of parts) {
    if (part.type !== 'literal') lookup[part.type] = part.value;
  }

  if (!lookup.year || !lookup.month || !lookup.day) return null;
  return { year: toInt(lookup.year), month: lookup.month, day: lookup.day };
}

function getBusinessYear(value = new Date()) {
  const parts = getBusinessDateParts(value);
  return parts ? parts.year : new Date().getUTCFullYear();
}

function getStartOfYearDate(year) {
  return `${year}-01-01`;
}

function getEndOfYearDate(year) {
  return `${year}-12-31`;
}

async function createShortUrl(originalUrl) {
  if (!originalUrl) return '';

  try {
    const response = await fetch('https://api.reurl.cc/shorten', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'reurl-api-key': '4070ff49d794e43515523b663c974755ecd7b335959e04df8a38b58d65165567c4f5d6'
      },
      body: JSON.stringify({ url: originalUrl })
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.res === 'success' && data.short_url) {
        return data.short_url;
      }
    }
  } catch (error) {
    console.warn('createShortUrl reurl.cc failed:', error.message || error);
  }

  try {
    const response = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(originalUrl)}`);
    if (response.ok) {
      const shortUrl = (await response.text()).trim();
      if (shortUrl.startsWith('https://is.gd/')) {
        return shortUrl;
      }
    }
  } catch (error) {
    console.warn('createShortUrl is.gd failed:', error.message || error);
  }

  return originalUrl;
}

function normalizeCouponKeyword(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function buildLineCouponTimestamps(now = new Date()) {
  const startTimestamp = Math.floor(now.getTime() / 1000);
  const validDays = Number.isFinite(DEFAULT_LINE_COUPON_VALID_DAYS) && DEFAULT_LINE_COUPON_VALID_DAYS > 0
    ? DEFAULT_LINE_COUPON_VALID_DAYS
    : 365;
  const endTimestamp = startTimestamp + (validDays * 24 * 60 * 60);
  return { startTimestamp, endTimestamp };
}

function hasLineCouponApiConfigured() {
  return Boolean(LINE_CHANNEL_ACCESS_TOKEN);
}

function canVerifyLineWebhookSignature() {
  return Boolean(LINE_CHANNEL_SECRET);
}

function isMissingTableError(error) {
  const message = String(error && error.message || error || '');
  return (
    /relation .* does not exist/i.test(message) ||
    /schema cache/i.test(message) ||
    /Could not find the table/i.test(message) ||
    /Sheet .* not found/i.test(message) ||
    /not found or empty/i.test(message)
  );
}

function buildDefaultLineCouponPayload(partner) {
  const { startTimestamp, endTimestamp } = buildLineCouponTimestamps();
  const payload = {
    title: DEFAULT_LINE_COUPON_TITLE,
    description: DEFAULT_LINE_COUPON_DESCRIPTION,
    acquisitionCondition: { type: 'normal' },
    maxUseCountPerTicket: 1,
    startTimestamp,
    endTimestamp,
    timezone: LINE_COUPON_TIMEZONE,
    reward: { type: 'gift' },
    visibility: LINE_COUPON_VISIBILITY,
    couponCode: String(partner.coupon_code || '').slice(0, 16),
    usageCondition: DEFAULT_LINE_COUPON_USAGE_CONDITION
  };

  if (LINE_COUPON_IMAGE_URL) {
    payload.imageUrl = LINE_COUPON_IMAGE_URL;
  }

  return payload;
}

async function callLineApi(method, path, body) {
  if (!hasLineCouponApiConfigured()) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN 未設定');
  }

  const response = await fetch(`https://api.line.me${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let parsed = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      parsed = {};
    }
  }
  if (!response.ok) {
    throw new Error(`LINE API ${method} ${path} 失敗: ${response.status} ${text}`);
  }

  return parsed;
}

async function fetchLineProfileByUserId(lineUserId) {
  const normalizedUserId = String(lineUserId || '').trim();
  if (!normalizedUserId || !hasLineCouponApiConfigured()) return null;

  try {
    const profile = await callLineApi('GET', `/v2/bot/profile/${encodeURIComponent(normalizedUserId)}`);
    return {
      userId: normalizedUserId,
      displayName: String(profile && profile.displayName || '').trim()
    };
  } catch (error) {
    return null;
  }
}

async function fetchLineProfileForEventSource(source) {
  if (!source || !source.userId || !hasLineCouponApiConfigured()) return null;

  const sourceType = String(source.type || 'user').trim().toLowerCase();
  const userId = String(source.userId || '').trim();
  if (!userId) return null;

  try {
    let path = `/v2/bot/profile/${encodeURIComponent(userId)}`;
    if (sourceType === 'group' && source.groupId) {
      path = `/v2/bot/group/${encodeURIComponent(source.groupId)}/member/${encodeURIComponent(userId)}`;
    } else if (sourceType === 'room' && source.roomId) {
      path = `/v2/bot/room/${encodeURIComponent(source.roomId)}/member/${encodeURIComponent(userId)}`;
    }

    const profile = await callLineApi('GET', path);
    return {
      userId,
      displayName: String(profile && profile.displayName || '').trim()
    };
  } catch (error) {
    return fetchLineProfileByUserId(userId);
  }
}

async function ensureLineCouponBindingsTable() {
  try {
    await ensureTable(LINE_COUPON_BINDING_TABLE, DataModels.LineCouponBinding.fields);
    if (typeof db.getFields === 'function') {
      await db.getFields(LINE_COUPON_BINDING_TABLE);
    } else {
      await db.getAllRecords(LINE_COUPON_BINDING_TABLE);
    }
    return true;
  } catch (error) {
    if (isMissingTableError(error)) return false;
    throw error;
  }
}

async function getLineCouponBindingByPartnerCode(partnerCode) {
  try {
    const results = await findRecordsByField(LINE_COUPON_BINDING_TABLE, 'partner_code', partnerCode);
    return results.length ? results[0].data : null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

async function getActiveLineCouponBindingByKeyword(input) {
  const normalized = normalizeCouponKeyword(input);
  if (!normalized) return null;

  try {
    const results = await findRecordsByField(LINE_COUPON_BINDING_TABLE, 'normalized_coupon_code', normalized);
    const row = results.find(item => item.data && item.data.is_active !== false && item.data.line_keyword_status !== 'INACTIVE');
    return row ? row.data : null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

async function upsertLineCouponBinding(binding) {
  const ensured = await ensureLineCouponBindingsTable();
  if (!ensured) {
    return { success: false, skipped: true, error: 'line_coupon_bindings table is missing' };
  }

  const payload = {
    partner_code: binding.partner_code,
    coupon_code: binding.coupon_code,
    normalized_coupon_code: normalizeCouponKeyword(binding.coupon_code),
    line_coupon_id: binding.line_coupon_id || '',
    line_coupon_status: binding.line_coupon_status || 'PENDING',
    line_keyword_status: binding.line_keyword_status || 'ACTIVE',
    coupon_title: binding.coupon_title || DEFAULT_LINE_COUPON_TITLE,
    coupon_description: binding.coupon_description || DEFAULT_LINE_COUPON_DESCRIPTION,
    coupon_usage_condition: binding.coupon_usage_condition || DEFAULT_LINE_COUPON_USAGE_CONDITION,
    reply_count: toInt(binding.reply_count, 0),
    last_replied_at: binding.last_replied_at || '',
    line_coupon_closed_at: binding.line_coupon_closed_at || '',
    is_active: binding.is_active !== false,
    last_error: binding.last_error || ''
  };

  try {
    const data = await upsertRecord(LINE_COUPON_BINDING_TABLE, payload, 'partner_code');
    return { success: true, data };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { success: false, skipped: true, error: 'line_coupon_bindings table is missing' };
    }
    throw error;
  }
}

async function discontinueLineCouponBinding(binding, reason = '') {
  if (!binding) return { success: false, skipped: true, error: 'binding not found' };

  let lastError = '';
  let lineApiClosed = false;

  if (binding.line_coupon_id && hasLineCouponApiConfigured()) {
    try {
      await callLineApi('PUT', `/v2/bot/coupon/${encodeURIComponent(binding.line_coupon_id)}/close`);
      lineApiClosed = true;
    } catch (error) {
      // 410 means the coupon was already closed.
      if (String(error.message || '').includes('410')) {
        lineApiClosed = true;
      } else {
        lastError = error.message || String(error);
      }
    }
  }

  const updateResult = await upsertLineCouponBinding({
    ...binding,
    line_coupon_status: lineApiClosed ? 'CLOSED' : (binding.line_coupon_status || 'ERROR'),
    line_keyword_status: 'INACTIVE',
    is_active: false,
    line_coupon_closed_at: getValueAsDateString(new Date()) || new Date().toISOString(),
    last_error: lastError || reason || binding.last_error || ''
  });

  return {
    success: lineApiClosed || !binding.line_coupon_id,
    data: updateResult.data,
    error: lastError || null
  };
}

async function provisionLineCouponForPartner(rawPartner, options = {}) {
  const partner = normalizePartnerRecord(rawPartner);
  const storageReady = await ensureLineCouponBindingsTable();
  if (!storageReady) {
    return { success: false, skipped: true, error: 'line_coupon_bindings table is missing' };
  }

  const existingBinding = await getLineCouponBindingByPartnerCode(partner.partner_code);

  if (existingBinding && options.recreate !== true &&
      existingBinding.is_active !== false &&
      existingBinding.line_coupon_status === 'ACTIVE' &&
      String(existingBinding.coupon_code || '') === String(partner.coupon_code || '')) {
    return { success: true, binding: existingBinding, skipped: true };
  }

  if (existingBinding && options.recreate === true) {
    await discontinueLineCouponBinding(existingBinding, options.reason || 'Reprovision requested');
  }

  if (!hasLineCouponApiConfigured()) {
    const fallbackBinding = await upsertLineCouponBinding({
      ...(existingBinding || {}),
      partner_code: partner.partner_code,
      coupon_code: partner.coupon_code,
      line_coupon_status: 'DISABLED',
      line_keyword_status: 'INACTIVE',
      is_active: false,
      last_error: 'LINE_CHANNEL_ACCESS_TOKEN 未設定'
    });
    return { success: false, skipped: true, binding: fallbackBinding.data, error: 'LINE_CHANNEL_ACCESS_TOKEN 未設定' };
  }

  const payload = buildDefaultLineCouponPayload(partner);

  try {
    const response = await callLineApi('POST', '/v2/bot/coupon', payload);
    const bindingResult = await upsertLineCouponBinding({
      ...(existingBinding || {}),
      partner_code: partner.partner_code,
      coupon_code: partner.coupon_code,
      line_coupon_id: response.couponId,
      line_coupon_status: 'ACTIVE',
      line_keyword_status: 'ACTIVE',
      coupon_title: payload.title,
      coupon_description: payload.description,
      coupon_usage_condition: payload.usageCondition,
      is_active: true,
      last_error: ''
    });

    return { success: true, binding: bindingResult.data };
  } catch (error) {
    const bindingResult = await upsertLineCouponBinding({
      ...(existingBinding || {}),
      partner_code: partner.partner_code,
      coupon_code: partner.coupon_code,
      line_coupon_id: existingBinding?.line_coupon_id || '',
      line_coupon_status: 'ERROR',
      line_keyword_status: 'INACTIVE',
      coupon_title: payload.title,
      coupon_description: payload.description,
      coupon_usage_condition: payload.usageCondition,
      is_active: false,
      last_error: error.message || String(error)
    });

    return { success: false, binding: bindingResult.data, error: error.message || String(error) };
  }
}

async function updateLineCouponReplyStats(binding) {
  if (!binding || !binding.partner_code) return null;
  const result = await upsertLineCouponBinding({
    ...binding,
    reply_count: toInt(binding.reply_count, 0) + 1,
    last_replied_at: new Date().toISOString(),
    is_active: true,
    line_keyword_status: binding.line_keyword_status || 'ACTIVE'
  });
  return result.data;
}

function hasSharedLineCouponConfigured() {
  return Boolean(LINE_SHARED_COUPON_ID);
}

async function ensureLineReferralClaimsTable() {
  try {
    await ensureTable(LINE_REFERRAL_CLAIM_TABLE, DataModels.LineReferralClaim.fields);
    if (typeof db.getFields === 'function') {
      await db.getFields(LINE_REFERRAL_CLAIM_TABLE);
    } else {
      await db.getAllRecords(LINE_REFERRAL_CLAIM_TABLE);
    }
    return true;
  } catch (error) {
    if (isMissingTableError(error)) return false;
    throw error;
  }
}

function buildLineReferralClaimKey(lineUserId, lineMessageId, partnerCode) {
  const userKey = String(lineUserId || '').trim() || `msg:${String(lineMessageId || '').trim() || 'unknown'}`;
  return `${userKey}:${partnerCode}`;
}

function getSortableTimestamp(value) {
  const ts = new Date(value || '').getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function sortLineClaimsNewestFirst(claims = []) {
  return [...claims].sort((a, b) => {
    const aTs = Math.max(
      getSortableTimestamp(a && a.last_claimed_at),
      getSortableTimestamp(a && a.last_replied_at),
      getSortableTimestamp(a && a.created_at)
    );
    const bTs = Math.max(
      getSortableTimestamp(b && b.last_claimed_at),
      getSortableTimestamp(b && b.last_replied_at),
      getSortableTimestamp(b && b.created_at)
    );
    if (aTs !== bTs) return bTs - aTs;
    return String(b && b.id || '').localeCompare(String(a && a.id || ''));
  });
}

function selectLatestLineReferralClaim(claims = []) {
  return sortLineClaimsNewestFirst(claims)[0] || null;
}

function determineBookingAttribution(input = {}, latestClaim = null, options = {}) {
  const requestedPartnerCode = String(input.partner_code || '').trim();
  const lineUserId = String(input.line_user_id || '').trim();
  const lineDisplayName = String(input.line_display_name || '').trim();
  const latestPartnerCode = String(latestClaim && latestClaim.partner_code || '').trim();
  const explicitEmptyPartnerClears = options.explicitEmptyPartnerClears === true;
  const hasExplicitPartnerField = options.hasExplicitPartnerField === true;

  let resolvedPartnerCode = requestedPartnerCode;
  let attributionSource = '';

  if (!requestedPartnerCode && !explicitEmptyPartnerClears && lineUserId && latestPartnerCode) {
    resolvedPartnerCode = latestPartnerCode;
    attributionSource = 'LATEST_LINE_CLAIM';
  } else if (lineUserId && latestPartnerCode && requestedPartnerCode && requestedPartnerCode !== latestPartnerCode) {
    attributionSource = 'MANUAL_OVERRIDE';
  } else if (lineUserId && latestPartnerCode && requestedPartnerCode === latestPartnerCode) {
    attributionSource = 'LATEST_LINE_CLAIM';
  } else if (lineUserId && !latestPartnerCode && requestedPartnerCode) {
    attributionSource = 'MANUAL_NO_CLAIM';
  } else if (lineUserId && !latestPartnerCode && !requestedPartnerCode) {
    attributionSource = 'LINE_USER_NO_MATCH';
  } else if (explicitEmptyPartnerClears && hasExplicitPartnerField && !requestedPartnerCode) {
    attributionSource = lineUserId ? 'MANUAL_CLEAR' : '';
    resolvedPartnerCode = '';
  } else if (requestedPartnerCode) {
    attributionSource = 'MANUAL';
  }

  return {
    partner_code: resolvedPartnerCode || null,
    line_user_id: lineUserId,
    line_display_name: lineDisplayName || String(latestClaim && latestClaim.line_display_name || '').trim(),
    attribution_source: attributionSource,
    attribution_claimed_at: latestClaim && latestClaim.last_claimed_at ? latestClaim.last_claimed_at : '',
    attribution_entered_code: latestClaim && latestClaim.entered_code ? latestClaim.entered_code : ''
  };
}

async function getLineReferralClaimsByLineUserId(lineUserId) {
  const normalizedLineUserId = String(lineUserId || '').trim();
  if (!normalizedLineUserId) return [];

  try {
    const results = await findRecordsByField(LINE_REFERRAL_CLAIM_TABLE, 'line_user_id', normalizedLineUserId);
    return results.map(item => item.data || item).filter(Boolean);
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

async function getLatestLineReferralClaimByLineUserId(lineUserId) {
  const claims = await getLineReferralClaimsByLineUserId(lineUserId);
  return selectLatestLineReferralClaim(claims);
}

async function syncLineClaimProfiles(options = {}) {
  const storageReady = await ensureLineReferralClaimsTable();
  if (!storageReady) {
    return { success: false, skipped: true, error: 'line_referral_claims table is missing' };
  }
  if (!hasLineCouponApiConfigured()) {
    return { success: false, skipped: true, error: 'LINE_CHANNEL_ACCESS_TOKEN 未設定' };
  }

  const onlyMissing = options.onlyMissing !== false;
  const limit = Math.max(1, Math.min(toInt(options.limit, 50), 200));
  const claims = await db.getAllRecords(LINE_REFERRAL_CLAIM_TABLE).catch(() => []);
  const newestFirst = sortLineClaimsNewestFirst(claims.map(item => item.data || item).filter(Boolean));
  const seen = new Set();
  const targets = [];

  for (const claim of newestFirst) {
    const lineUserId = String(claim.line_user_id || '').trim();
    if (!lineUserId || seen.has(lineUserId)) continue;
    seen.add(lineUserId);
    const missingDisplayName = !String(claim.line_display_name || '').trim();
    if (onlyMissing && !missingDisplayName) continue;
    targets.push({ lineUserId, sourceType: claim.line_source_type || 'user' });
    if (targets.length >= limit) break;
  }

  let updatedUsers = 0;
  let updatedClaims = 0;
  const errors = [];

  for (const target of targets) {
    const profile = await fetchLineProfileByUserId(target.lineUserId);
    const displayName = String(profile && profile.displayName || '').trim();
    if (!displayName) {
      errors.push({ line_user_id: target.lineUserId, error: 'displayName not available' });
      continue;
    }

    const relatedClaims = newestFirst.filter(claim => String(claim.line_user_id || '').trim() === target.lineUserId);
    for (const claim of relatedClaims) {
      const result = await upsertLineReferralClaim({
        ...claim,
        line_display_name: displayName
      });
      if (result.success) updatedClaims += 1;
    }
    updatedUsers += 1;
  }

  return {
    success: true,
    updated_users: updatedUsers,
    updated_claims: updatedClaims,
    attempted_users: targets.length,
    errors
  };
}

async function findActivePartnerByCouponCode(input) {
  const normalized = normalizeCouponKeyword(input);
  if (!normalized) return null;

  const exactMatches = await findRecordsByField('Partners', 'coupon_code', normalized).catch(() => []);
  for (const match of exactMatches) {
    const partner = normalizePartnerRecord(match.data || match);
    if (partner.is_active !== false && normalizeCouponKeyword(partner.coupon_code) === normalized) {
      return partner;
    }
  }

  const partners = await db.getAllRecords('Partners');
  for (const rawPartner of partners) {
    const partner = normalizePartnerRecord(rawPartner);
    if (partner.is_active === false) continue;
    if (normalizeCouponKeyword(partner.coupon_code) === normalized) {
      return partner;
    }
  }

  return null;
}

async function upsertLineReferralClaim(claim) {
  const ensured = await ensureLineReferralClaimsTable();
  if (!ensured) {
    return { success: false, skipped: true, error: 'line_referral_claims table is missing' };
  }

  const payload = {
    claim_key: claim.claim_key,
    line_user_id: claim.line_user_id || '',
    line_source_type: claim.line_source_type || 'user',
    line_display_name: claim.line_display_name || '',
    line_message_id: claim.line_message_id || '',
    entered_code: claim.entered_code || '',
    normalized_entered_code: normalizeCouponKeyword(claim.entered_code),
    partner_code: claim.partner_code || '',
    shared_coupon_id: claim.shared_coupon_id || '',
    claim_status: claim.claim_status || DEFAULT_LINE_SHARED_CLAIM_STATUS,
    claim_count: toInt(claim.claim_count, 1),
    coupon_reply_count: toInt(claim.coupon_reply_count, 0),
    first_claimed_at: claim.first_claimed_at || '',
    last_claimed_at: claim.last_claimed_at || '',
    last_replied_at: claim.last_replied_at || '',
    last_reply_status: claim.last_reply_status || '',
    booking_id: claim.booking_id || '',
    notes: claim.notes || '',
    last_error: claim.last_error || ''
  };

  try {
    const data = await upsertRecord(LINE_REFERRAL_CLAIM_TABLE, payload, 'claim_key');
    return { success: true, data };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { success: false, skipped: true, error: 'line_referral_claims table is missing' };
    }
    throw error;
  }
}

function extractCouponKeywordCandidates(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const candidates = new Set();
  const direct = normalizeCouponKeyword(raw);
  if (direct) candidates.add(direct);

  const matches = raw.match(/[A-Za-z0-9]{3,16}/g) || [];
  for (const match of matches) {
    const normalized = normalizeCouponKeyword(match);
    if (normalized) candidates.add(normalized);
  }

  return Array.from(candidates);
}

function verifyLineSignature(rawBody, signature) {
  if (!canVerifyLineWebhookSignature()) return true;
  if (!rawBody || !signature) return false;

  const expected = crypto
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(rawBody)
    .digest('base64');

  return expected === signature;
}

function getValueAsDateString(value) {
  if (!value) return '';
  const raw = String(value);
  const directMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (directMatch) return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;

  const parts = getBusinessDateParts(value);
  if (!parts) return '';
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getBookingLevelDateValue(booking) {
  return booking.checkout_date ||
    booking.checkin_date ||
    booking.manually_confirmed_at ||
    booking.updated_at ||
    booking.created_at ||
    '';
}

function getBookingLevelYear(booking) {
  const dateValue = getBookingLevelDateValue(booking);
  const directMatch = String(dateValue).match(/^(\d{4})-/);
  if (directMatch) return toInt(directMatch[1]);
  return getBusinessYear(dateValue || new Date());
}

function getBookingSortKey(booking) {
  return `${getValueAsDateString(getBookingLevelDateValue(booking))}:${booking.id || booking.ID || ''}`;
}

function isCompletedReferralBooking(booking) {
  return Boolean(
    booking &&
    booking.partner_code &&
    booking.booking_source !== 'SELF_USE' &&
    booking.stay_status === 'COMPLETED'
  );
}

function normalizePartnerRecord(rawPartner) {
  const partner = { ...rawPartner };
  partner.partner_name = partner.partner_name || partner.name || '';
  partner.name = partner.name || partner.partner_name || '';
  partner.partner_level = normalizeLevel(partner.partner_level || partner.level);
  partner.level = normalizeLevel(partner.level || partner.partner_level);
  partner.base_level_for_year = normalizeLevel(partner.base_level_for_year || partner.partner_level || partner.level);
  partner.contact_phone = partner.contact_phone || partner.phone || '';
  partner.contact_email = partner.contact_email || partner.email || '';
  partner.successful_referrals = toInt(
    partner.successful_referrals !== undefined ? partner.successful_referrals : partner.total_successful_referrals,
    0
  );
  partner.total_successful_referrals = toInt(
    partner.total_successful_referrals !== undefined ? partner.total_successful_referrals : partner.successful_referrals,
    0
  );
  partner.yearly_referrals = toInt(
    partner.yearly_referrals !== undefined ? partner.yearly_referrals : partner.level_progress,
    0
  );
  partner.level_progress = toInt(
    partner.level_progress !== undefined ? partner.level_progress : partner.yearly_referrals,
    0
  );
  partner.yearly_referrals_year = toInt(partner.yearly_referrals_year, 0);
  partner.last_level_review_year = toInt(partner.last_level_review_year, 0);
  partner.total_referrals = toInt(partner.total_referrals, 0);
  partner.available_points = toNumber(partner.available_points, 0);
  partner.points_used = toNumber(partner.points_used, 0);
  partner.pending_commission = toNumber(partner.pending_commission, 0);
  partner.total_commission_earned = toNumber(partner.total_commission_earned, 0);
  partner.total_commission_paid = toNumber(partner.total_commission_paid, 0);
  partner.level_achieved_at = partner.level_achieved_at || '';
  partner.level_valid_until = partner.level_valid_until || '';
  return partner;
}

function buildPartnerLevelUpdates(snapshot) {
  return {
    partner_level: snapshot.partner_level,
    level: snapshot.partner_level,
    base_level_for_year: snapshot.base_level_for_year,
    yearly_referrals: snapshot.yearly_referrals,
    yearly_referrals_year: snapshot.yearly_referrals_year,
    level_progress: snapshot.yearly_referrals,
    successful_referrals: snapshot.successful_referrals,
    total_successful_referrals: snapshot.successful_referrals,
    level_achieved_at: snapshot.level_achieved_at,
    level_valid_until: snapshot.level_valid_until,
    last_level_review_year: snapshot.last_level_review_year
  };
}

function partnerLevelUpdatesChanged(partner, updates) {
  return (
    normalizeLevel(partner.partner_level) !== normalizeLevel(updates.partner_level) ||
    normalizeLevel(partner.level) !== normalizeLevel(updates.level) ||
    normalizeLevel(partner.base_level_for_year) !== normalizeLevel(updates.base_level_for_year) ||
    toInt(partner.yearly_referrals) !== toInt(updates.yearly_referrals) ||
    toInt(partner.yearly_referrals_year) !== toInt(updates.yearly_referrals_year) ||
    toInt(partner.level_progress) !== toInt(updates.level_progress) ||
    toInt(partner.successful_referrals) !== toInt(updates.successful_referrals) ||
    toInt(partner.total_successful_referrals) !== toInt(updates.total_successful_referrals) ||
    String(partner.level_achieved_at || '') !== String(updates.level_achieved_at || '') ||
    String(partner.level_valid_until || '') !== String(updates.level_valid_until || '') ||
    toInt(partner.last_level_review_year) !== toInt(updates.last_level_review_year)
  );
}

function reviewLevelForNextYear(levelAtEndOfYear, yearlyReferrals) {
  const currentLevel = normalizeLevel(levelAtEndOfYear);
  const count = toInt(yearlyReferrals, 0);

  if (count >= LEVEL_REQUIREMENTS.LV3_GUARDIAN) return 'LV3_GUARDIAN';
  if (currentLevel === 'LV3_GUARDIAN') {
    if (count >= LEVEL_RETENTION_REQUIREMENTS.LV3_GUARDIAN) return 'LV3_GUARDIAN';
    return 'LV2_GUIDE';
  }
  if (count >= LEVEL_REQUIREMENTS.LV2_GUIDE) return 'LV2_GUIDE';
  if (currentLevel === 'LV2_GUIDE') {
    if (count >= LEVEL_RETENTION_REQUIREMENTS.LV2_GUIDE) return 'LV2_GUIDE';
    return 'LV1_INSIDER';
  }
  return 'LV1_INSIDER';
}

function getThresholdAchievementDate(bookings, level) {
  const threshold = LEVEL_REQUIREMENTS[level];
  if (!threshold) return '';

  const sorted = [...bookings].sort((a, b) => getBookingSortKey(a).localeCompare(getBookingSortKey(b)));
  if (sorted.length < threshold) return '';

  return getValueAsDateString(getBookingLevelDateValue(sorted[threshold - 1])) || '';
}

function groupPartnerCompletedBookings(partnerCode, allBookings, options = {}) {
  const excludeIds = new Set((options.excludeBookingIds || []).map(id => String(id)));
  const normalizedPartnerCode = String(partnerCode || '');
  const bookings = [];

  for (const booking of allBookings || []) {
    if (!isCompletedReferralBooking(booking)) continue;
    if (String(booking.partner_code || '') !== normalizedPartnerCode) continue;
    if (excludeIds.has(String(booking.id || booking.ID || ''))) continue;
    bookings.push(booking);
  }

  for (const extraBooking of options.extraCompletedBookings || []) {
    if (!isCompletedReferralBooking(extraBooking)) continue;
    if (String(extraBooking.partner_code || '') !== normalizedPartnerCode) continue;
    bookings.push(extraBooking);
  }

  const bookingsByYear = new Map();
  for (const booking of bookings) {
    const year = getBookingLevelYear(booking);
    const list = bookingsByYear.get(year) || [];
    list.push(booking);
    bookingsByYear.set(year, list);
  }

  for (const list of bookingsByYear.values()) {
    list.sort((a, b) => getBookingSortKey(a).localeCompare(getBookingSortKey(b)));
  }

  return { bookings, bookingsByYear };
}

function buildLegacyLevelSnapshot(partner, bookingsByYear, referenceDate) {
  const currentYear = getBusinessYear(referenceDate);
  const existingLevel = normalizeLevel(partner.partner_level || partner.level);
  const currentYearBookings = bookingsByYear.get(currentYear) || [];
  const upgradeLevel = checkLevelUpgrade(currentYearBookings.length);
  const effectiveLevel = maxLevel(existingLevel, upgradeLevel);
  const upgradedThisYear = getLevelRank(upgradeLevel) > getLevelRank(existingLevel);

  return {
    partner_level: effectiveLevel,
    base_level_for_year: existingLevel,
    yearly_referrals: currentYearBookings.length,
    yearly_referrals_year: currentYear,
    successful_referrals: Array.from(bookingsByYear.values()).reduce((sum, list) => sum + list.length, 0),
    level_achieved_at: upgradedThisYear
      ? (getThresholdAchievementDate(currentYearBookings, effectiveLevel) || getStartOfYearDate(currentYear))
      : getStartOfYearDate(currentYear),
    level_valid_until: upgradedThisYear ? getEndOfYearDate(currentYear + 1) : getEndOfYearDate(currentYear),
    last_level_review_year: currentYear - 1
  };
}

function simulatePartnerLevelSnapshot(partner, bookingsByYear, referenceDate = new Date()) {
  const currentYear = getBusinessYear(referenceDate);
  const totalSuccessful = Array.from(bookingsByYear.values()).reduce((sum, list) => sum + list.length, 0);
  const hasCycleMetadata = (
    toInt(partner.yearly_referrals_year, 0) > 0 ||
    Boolean(partner.level_valid_until) ||
    toInt(partner.last_level_review_year, 0) > 0
  );

  if (!hasCycleMetadata) {
    return buildLegacyLevelSnapshot(partner, bookingsByYear, referenceDate);
  }

  let trackedYear = Math.min(Math.max(toInt(partner.yearly_referrals_year, currentYear), 1), currentYear);
  let baseLevelForYear = normalizeLevel(partner.base_level_for_year || partner.partner_level || partner.level);
  let effectiveLevel = normalizeLevel(partner.partner_level || partner.level);
  let lastLevelReviewYear = partner.last_level_review_year ? toInt(partner.last_level_review_year, trackedYear - 1) : trackedYear - 1;

  const trackedYearBookings = bookingsByYear.get(trackedYear) || [];
  const trackedUpgradeLevel = checkLevelUpgrade(trackedYearBookings.length);
  const trackedEffectiveLevel = maxLevel(baseLevelForYear, trackedUpgradeLevel);
  effectiveLevel = trackedEffectiveLevel;

  let levelAchievedAt = getLevelRank(trackedUpgradeLevel) > getLevelRank(baseLevelForYear)
    ? (getThresholdAchievementDate(trackedYearBookings, trackedEffectiveLevel) || getStartOfYearDate(trackedYear))
    : getStartOfYearDate(trackedYear);
  let levelValidUntil = getLevelRank(trackedUpgradeLevel) > getLevelRank(baseLevelForYear)
    ? getEndOfYearDate(trackedYear + 1)
    : getEndOfYearDate(trackedYear);

  for (let year = trackedYear + 1; year <= currentYear; year++) {
    const previousYear = year - 1;
    const previousYearCount = (bookingsByYear.get(previousYear) || []).length;
    baseLevelForYear = reviewLevelForNextYear(effectiveLevel, previousYearCount);

    const currentYearBookings = bookingsByYear.get(year) || [];
    const upgradeLevel = checkLevelUpgrade(currentYearBookings.length);
    effectiveLevel = maxLevel(baseLevelForYear, upgradeLevel);
    lastLevelReviewYear = previousYear;

    if (getLevelRank(upgradeLevel) > getLevelRank(baseLevelForYear)) {
      levelAchievedAt = getThresholdAchievementDate(currentYearBookings, effectiveLevel) || getStartOfYearDate(year);
      levelValidUntil = getEndOfYearDate(year + 1);
    } else {
      levelAchievedAt = getStartOfYearDate(year);
      levelValidUntil = getEndOfYearDate(year);
    }

    trackedYear = year;
  }

  return {
    partner_level: effectiveLevel,
    base_level_for_year: baseLevelForYear,
    yearly_referrals: (bookingsByYear.get(currentYear) || []).length,
    yearly_referrals_year: currentYear,
    successful_referrals: totalSuccessful,
    level_achieved_at: levelAchievedAt,
    level_valid_until: levelValidUntil,
    last_level_review_year: lastLevelReviewYear
  };
}

async function buildPartnerLevelSnapshot(partner, options = {}) {
  const allBookings = options.bookings || await db.getAllRecords('Bookings');
  const { bookingsByYear } = groupPartnerCompletedBookings(partner.partner_code, allBookings, options);
  return simulatePartnerLevelSnapshot(partner, bookingsByYear, options.referenceDate);
}

async function syncPartnerLevelState(partner, options = {}) {
  const normalizedPartner = normalizePartnerRecord(partner);
  const snapshot = await buildPartnerLevelSnapshot(normalizedPartner, options);
  const updates = buildPartnerLevelUpdates(snapshot);
  const merged = normalizePartnerRecord({ ...normalizedPartner, ...updates });

  if (!options.skipPersist && partnerLevelUpdatesChanged(normalizedPartner, updates)) {
    await updateRecord('Partners', normalizedPartner.partner_code, updates);
  }

  return merged;
}

async function syncPartnerCollectionLevelState(partners, bookings, referenceDate = new Date()) {
  const syncedPartners = [];

  for (const rawPartner of partners || []) {
    const partner = normalizePartnerRecord(rawPartner);
    const snapshot = await buildPartnerLevelSnapshot(partner, { bookings, referenceDate });
    const updates = buildPartnerLevelUpdates(snapshot);
    const merged = normalizePartnerRecord({ ...partner, ...updates });

    if (partnerLevelUpdatesChanged(partner, updates)) {
      await updateRecord('Partners', partner.partner_code, updates);
    }

    syncedPartners.push(merged);
  }

  return syncedPartners;
}

function parseRelatedBookingIds(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

async function findPartnerByCode(partnerCode, options = {}) {
  const results = await findRecordsByField('Partners', 'partner_code', partnerCode);
  if (results.length === 0) return null;
  return syncPartnerLevelState(results[0].data, options);
}

async function findPartnerByCodeCaseInsensitive(code, options = {}) {
  let partner = await findPartnerByCode(code, options);
  if (!partner) partner = await findPartnerByCode(code.toLowerCase(), options);
  if (!partner) partner = await findPartnerByCode(code.toUpperCase(), options);
  return partner;
}

async function findPartnersByEmailCaseInsensitive(email, options = {}) {
  const targetEmail = String(email || '').trim().toLowerCase();
  if (!targetEmail) return [];

  const partners = await db.getAllRecords('Partners');
  const matches = [];

  for (const partner of partners) {
    const emails = [partner.contact_email, partner.email]
      .map(value => String(value || '').trim().toLowerCase())
      .filter(Boolean);

    if (emails.includes(targetEmail)) {
      matches.push(await syncPartnerLevelState(partner, options));
    }
  }

  return matches;
}

async function findPartnersByLoginIdentifier(loginIdentifier, options = {}) {
  const normalized = String(loginIdentifier || '').trim();
  if (!normalized) return [];

  const candidates = [];
  const seen = new Set();

  const codeMatch = await findPartnerByCodeCaseInsensitive(normalized, options);
  if (codeMatch && !seen.has(codeMatch.partner_code)) {
    candidates.push(codeMatch);
    seen.add(codeMatch.partner_code);
  }

  const emailMatches = await findPartnersByEmailCaseInsensitive(normalized, options);
  for (const partner of emailMatches) {
    if (!seen.has(partner.partner_code)) {
      candidates.push(partner);
      seen.add(partner.partner_code);
    }
  }

  return candidates;
}

async function findRecordsByGuestInfo(guestName, guestPhone, checkinDate) {
  const allRecords = await db.getAllRecords('Bookings');
  const results = [];

  for (const record of allRecords) {
    const name = record.guest_name;
    const phone = record.guest_phone;

    if (name === guestName && String(phone) === String(guestPhone)) {
      if (checkinDate) {
        const bookingCheckin = record.checkin_date;
        if (formatDate(bookingCheckin) !== formatDate(checkinDate)) continue;
      }
      results.push({ data: record });
    }
  }
  return results;
}

async function updatePartnerReferralStats(partnerCode, increment) {
  const partner = await findPartnerByCode(partnerCode);
  if (!partner) {
    console.log(`Partner ${partnerCode} not found`);
    return;
  }
  await updateRecord('Partners', partner.partner_code, {
    total_referrals: (partner.total_referrals || 0) + increment
  });
}

async function updatePartnerAfterCheckin(partner, booking, commissionAmount, commissionType) {
  const updates = {
    total_commission_earned: (partner.total_commission_earned || 0) + commissionAmount
  };

  if (commissionType === 'ACCOMMODATION') {
    updates.available_points = (partner.available_points || 0) + commissionAmount;
  } else if (commissionType === 'CASH') {
    updates.pending_commission = (partner.pending_commission || 0) + commissionAmount;
  }

  const snapshot = await buildPartnerLevelSnapshot(partner, {
    extraCompletedBookings: [{
      ...booking,
      stay_status: 'COMPLETED',
      manually_confirmed_at: booking.manually_confirmed_at || new Date().toISOString()
    }]
  });
  Object.assign(updates, buildPartnerLevelUpdates(snapshot));

  if (snapshot.partner_level !== partner.partner_level) {
    console.log(`Partner ${partner.partner_code} level changed to ${snapshot.partner_level}`);
  }

  await updateRecord('Partners', partner.partner_code, updates);
}

function calculateCommission(partner) {
  const level = partner.partner_level || 'LV1_INSIDER';
  const preference = partner.commission_preference || 'ACCOMMODATION';
  const rates = COMMISSION_RATES[level];

  if (!rates) return { amount: 0, type: 'NONE', isFirstBonus: false, firstBonusAmount: 0 };

  const baseAmount = rates[preference.toLowerCase()] || 0;
  const isFirstBonus = (level === 'LV1_INSIDER' &&
    (partner.successful_referrals || 0) === 0 &&
    preference.toUpperCase() === 'ACCOMMODATION');
  const firstBonusAmount = isFirstBonus ? FIRST_REFERRAL_BONUS : 0;

  return {
    amount: baseAmount + firstBonusAmount,
    type: preference,
    isFirstBonus,
    firstBonusAmount
  };
}

function checkLevelUpgrade(yearlyReferrals) {
  if (yearlyReferrals >= LEVEL_REQUIREMENTS.LV3_GUARDIAN) return 'LV3_GUARDIAN';
  if (yearlyReferrals >= LEVEL_REQUIREMENTS.LV2_GUIDE) return 'LV2_GUIDE';
  return 'LV1_INSIDER';
}

async function createPayoutRecord(partnerCode, amount, bookingId, type) {
  return createRecord('Payouts', {
    partner_code: partnerCode,
    payout_type: type,
    amount: amount,
    related_booking_ids: bookingId.toString(),
    payout_method: type === 'CASH' ? 'BANK_TRANSFER' : 'ACCOMMODATION_VOUCHER',
    payout_status: 'PENDING',
    notes: `佣金 - 訂單 #${bookingId}`,
    created_by: 'system'
  });
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toISOString().split('T')[0];
}

function maskName(name) {
  if (!name || typeof name !== 'string') return '***';
  if (name.length <= 1) return name + '**';
  return name.charAt(0) + '**';
}

function extractDeductAmount(notes) {
  if (!notes) return 0;
  const match = notes.match(/折抵\s*NT\$?\s*(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function analyzeBookingChanges(oldBooking, newData) {
  const changes = {
    hasPartnerChange: false,
    hasPriceChange: false,
    hasStatusChange: false,
    hasMonetaryImpact: false,
    hasStatisticalImpact: false
  };

  if (newData.partner_code !== undefined && newData.partner_code !== oldBooking.partner_code) {
    changes.hasPartnerChange = true;
    changes.hasStatisticalImpact = true;
    if (oldBooking.stay_status === 'COMPLETED') changes.hasMonetaryImpact = true;
  }

  if (newData.room_price !== undefined && parseFloat(newData.room_price) !== parseFloat(oldBooking.room_price)) {
    changes.hasPriceChange = true;
    if (oldBooking.commission_status === 'CALCULATED') changes.hasMonetaryImpact = true;
  }

  if (newData.stay_status !== undefined && newData.stay_status !== oldBooking.stay_status) {
    changes.hasStatusChange = true;
    changes.hasMonetaryImpact = true;
    changes.hasStatisticalImpact = true;
  }

  return changes;
}

function calculateCommissionForLevel(level, commissionType, roomPrice, includeFirstReferral) {
  const rates = {
    'LV1_INSIDER': { ACCOMMODATION: 1000, CASH: 500 },
    'LV2_GUIDE': { ACCOMMODATION: 1200, CASH: 600 },
    'LV3_GUARDIAN': { ACCOMMODATION: 1500, CASH: 750 }
  };
  let commission = rates[level][commissionType] || 0;
  if (includeFirstReferral && commissionType === 'ACCOMMODATION') commission += 1500;
  return commission;
}

function isTruthy(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function getBookingTimelineValue(booking) {
  return booking.manually_confirmed_at || booking.created_at || booking.updated_at || booking.checkin_date || booking.id || '';
}

async function getCompletedReferralBookings(partnerCode) {
  const allBookings = await db.getAllRecords('Bookings');
  return allBookings
    .filter(booking =>
      booking.partner_code === partnerCode &&
      booking.booking_source === 'REFERRAL' &&
      booking.stay_status === 'COMPLETED'
    )
    .sort((a, b) => {
      const aTime = new Date(getBookingTimelineValue(a)).getTime();
      const bTime = new Date(getBookingTimelineValue(b)).getTime();
      if (!isNaN(aTime) && !isNaN(bTime) && aTime !== bTime) return aTime - bTime;
      return Number(a.id || 0) - Number(b.id || 0);
    });
}

function buildCompletedBookingLevelTimeline(bookings, startingLevel = 'LV1_INSIDER') {
  const timeline = [];
  let activeYear = null;
  let baseLevelForYear = normalizeLevel(startingLevel);
  let effectiveLevel = normalizeLevel(startingLevel);
  let yearlyCount = 0;
  let totalSuccessfulBefore = 0;

  for (const booking of bookings) {
    const bookingYear = getBookingLevelYear(booking);

    if (activeYear === null) {
      activeYear = bookingYear;
      baseLevelForYear = normalizeLevel(startingLevel);
      effectiveLevel = normalizeLevel(startingLevel);
      yearlyCount = 0;
    }

    while (activeYear < bookingYear) {
      baseLevelForYear = reviewLevelForNextYear(effectiveLevel, yearlyCount);
      effectiveLevel = baseLevelForYear;
      yearlyCount = 0;
      activeYear += 1;
    }

    timeline.push({
      booking,
      levelBeforeBooking: effectiveLevel,
      successfulBefore: totalSuccessfulBefore
    });

    yearlyCount += 1;
    totalSuccessfulBefore += 1;
    effectiveLevel = maxLevel(baseLevelForYear, checkLevelUpgrade(yearlyCount));
  }

  return timeline;
}

async function reconcilePartnerCompletedReferralBookings(partnerCode, context = {}) {
  const partner = await findPartnerByCode(partnerCode);
  if (!partner) return [];

  const bookings = await getCompletedReferralBookings(partnerCode);
  if (bookings.length === 0) return [];

  let earnedDelta = 0;
  let pointsDelta = 0;
  let cashDelta = 0;
  const adjustments = [];
  const timeline = buildCompletedBookingLevelTimeline(bookings);

  for (const entry of timeline) {
    const { booking, levelBeforeBooking, successfulBefore } = entry;
    const commissionType = String(booking.commission_type || 'ACCOMMODATION').toUpperCase();
    const shouldHaveFirstBonus = (
      levelBeforeBooking === 'LV1_INSIDER' &&
      successfulBefore === 0 &&
      commissionType === 'ACCOMMODATION'
    );
    const expectedFirstBonusAmount = shouldHaveFirstBonus ? FIRST_REFERRAL_BONUS : 0;
    const expectedCommissionAmount = calculateCommissionForLevel(
      levelBeforeBooking,
      commissionType,
      parseFloat(booking.room_price || 0),
      shouldHaveFirstBonus
    );

    const actualCommissionAmount = parseFloat(booking.commission_amount || 0);
    const actualFirstBonus = isTruthy(booking.is_first_referral_bonus);
    const actualFirstBonusAmount = parseFloat(booking.first_referral_bonus_amount || 0);

    const needsAdjustment = (
      Math.abs(expectedCommissionAmount - actualCommissionAmount) > 0.01 ||
      actualFirstBonus !== shouldHaveFirstBonus ||
      Math.abs(expectedFirstBonusAmount - actualFirstBonusAmount) > 0.01
    );

    if (needsAdjustment) {
      const delta = expectedCommissionAmount - actualCommissionAmount;
      const noteReasons = [];

      if (Math.abs(delta) > 0.01) {
        noteReasons.push(`佣金 ${actualCommissionAmount} → ${expectedCommissionAmount}`);
      }
      if (actualFirstBonus !== shouldHaveFirstBonus || Math.abs(expectedFirstBonusAmount - actualFirstBonusAmount) > 0.01) {
        noteReasons.push(`首次獎勵 ${actualFirstBonusAmount} → ${expectedFirstBonusAmount}`);
      }

      const bookingUpdates = {
        commission_amount: expectedCommissionAmount,
        is_first_referral_bonus: shouldHaveFirstBonus,
        first_referral_bonus_amount: expectedFirstBonusAmount,
        notes: (booking.notes || '') + `\n[重新計算於 ${new Date().toISOString()}] ${noteReasons.join('；')}（因取消訂房 #${context.cancelledBookingId || '?'}）`
      };

      if (booking.original_commission_amount === undefined || booking.original_commission_amount === null || booking.original_commission_amount === '') {
        bookingUpdates.original_commission_amount = actualCommissionAmount;
      }

      await updateRecord('Bookings', booking.id, bookingUpdates);

      if (Math.abs(delta) > 0.01) {
        await createRecord('Payouts', {
          partner_code: partnerCode,
          payout_type: 'LEVEL_ADJUSTMENT',
          amount: delta,
          related_booking_ids: String(booking.id),
          payout_method: 'RETROACTIVE_RECALCULATION',
          payout_status: 'COMPLETED',
          notes: `取消訂房 #${context.cancelledBookingId || '?'} 後重算訂房 #${booking.id}：${actualCommissionAmount} → ${expectedCommissionAmount}`,
          created_by: context.updatedBy || 'system_adjustment'
        });
      }

      earnedDelta += delta;
      if (commissionType === 'ACCOMMODATION') pointsDelta += delta;
      if (commissionType === 'CASH') cashDelta += delta;

      adjustments.push({
        booking_id: booking.id,
        delta,
        old_amount: actualCommissionAmount,
        new_amount: expectedCommissionAmount,
        old_first_bonus: actualFirstBonusAmount,
        new_first_bonus: expectedFirstBonusAmount
      });
    }
  }

  if (Math.abs(earnedDelta) > 0.01 || Math.abs(pointsDelta) > 0.01 || Math.abs(cashDelta) > 0.01) {
    const currentAvailablePoints = parseFloat(partner.available_points || 0);
    const currentPendingCommission = parseFloat(partner.pending_commission || 0);
    const currentTotalEarned = parseFloat(partner.total_commission_earned || 0);
    const nextAvailablePoints = currentAvailablePoints + pointsDelta;
    const nextPendingCommission = currentPendingCommission + cashDelta;
    const partnerUpdates = {
      total_commission_earned: Math.max(0, currentTotalEarned + earnedDelta),
      available_points: Math.max(0, nextAvailablePoints),
      pending_commission: Math.max(0, nextPendingCommission)
    };

    await updateRecord('Partners', partnerCode, partnerUpdates);

    if (nextAvailablePoints < 0) {
      await createRecord('Payouts', {
        partner_code: partnerCode,
        payout_type: 'DEBT_RECORD',
        amount: nextAvailablePoints,
        payout_method: 'RETROACTIVE_RECALCULATION',
        payout_status: 'PENDING',
        notes: `取消訂房 #${context.cancelledBookingId || '?'} 後重算造成住宿金負債 ${Math.abs(nextAvailablePoints)}`,
        created_by: context.updatedBy || 'system_adjustment'
      });
    }

    if (nextPendingCommission < 0) {
      await createRecord('Payouts', {
        partner_code: partnerCode,
        payout_type: 'DEBT_RECORD',
        amount: nextPendingCommission,
        payout_method: 'RETROACTIVE_RECALCULATION',
        payout_status: 'PENDING',
        notes: `取消訂房 #${context.cancelledBookingId || '?'} 後重算造成現金負債 ${Math.abs(nextPendingCommission)}`,
        created_by: context.updatedBy || 'system_adjustment'
      });
    }
  }

  return adjustments;
}

// ========================================
// 業務邏輯處理函數
// ========================================

async function handleCreateBooking(data) {
  const selfUseBooking = data.booking_source === 'SELF_USE';
  const latestClaim = (!selfUseBooking && data.line_user_id)
    ? await getLatestLineReferralClaimByLineUserId(data.line_user_id)
    : null;
  const attribution = selfUseBooking
    ? {
        partner_code: data.partner_code || null,
        line_user_id: '',
        line_display_name: '',
        attribution_source: '',
        attribution_claimed_at: '',
        attribution_entered_code: ''
      }
    : determineBookingAttribution(data, latestClaim, {
        hasExplicitPartnerField: Object.prototype.hasOwnProperty.call(data, 'partner_code')
      });

  if (attribution.partner_code) {
    const partner = await findPartnerByCode(attribution.partner_code);
    if (!partner) throw new Error(`找不到推薦大使：${attribution.partner_code}`);
  }

  let bookingSource = 'DIRECT';
  if (selfUseBooking) bookingSource = 'SELF_USE';
  else if (attribution.partner_code) bookingSource = 'REFERRAL';

  const bookingData = {
    partner_code: attribution.partner_code,
    guest_name: data.guest_name || '',
    guest_phone: data.guest_phone || '',
    guest_email: data.guest_email || '',
    bank_account_last5: data.bank_account_last5 || '',
    line_user_id: attribution.line_user_id || '',
    line_display_name: attribution.line_display_name || '',
    attribution_source: attribution.attribution_source || '',
    attribution_claimed_at: attribution.attribution_claimed_at || '',
    attribution_entered_code: attribution.attribution_entered_code || '',
    checkin_date: data.checkin_date || '',
    checkout_date: data.checkout_date || '',
    room_price: parseInt(data.room_price) || 0,
    booking_source: bookingSource,
    stay_status: data.stay_status || 'PENDING',
    payment_status: data.payment_status || 'PENDING',
    commission_status: data.partner_code ? 'PENDING' : 'NOT_ELIGIBLE',
    commission_amount: 0,
    commission_type: 'ACCOMMODATION',
    is_first_referral_bonus: false,
    first_referral_bonus_amount: 0,
    manually_confirmed_by: '',
    manually_confirmed_at: '',
    notes: data.notes || ''
  };

  const booking = await createRecord('Bookings', bookingData);

  if (attribution.partner_code && bookingSource !== 'SELF_USE') {
    await updatePartnerReferralStats(attribution.partner_code, 1);
  }

  return { success: true, message: '訂房記錄建立成功', booking_id: booking.id || booking.ID, data: booking };
}

async function handleConfirmCheckinCompletion(data) {
  let booking = null;

  if (data.booking_id) {
    const result = await findRecordById('Bookings', data.booking_id);
    if (result) booking = result.data;
  }

  if (!booking && data.guest_name && data.guest_phone) {
    const results = await findRecordsByGuestInfo(data.guest_name, data.guest_phone, data.checkin_date);
    if (results.length > 0) booking = results[0].data;
  }

  if (!booking) throw new Error('找不到訂房記錄');
  if (booking.stay_status === 'CANCELLED') throw new Error('此訂單已取消，無法確認入住。');
  if (booking.stay_status === 'COMPLETED') {
    return { success: true, message: '該訂房已經確認過了', booking_id: booking.id };
  }

  let commissionAmount = 0, commissionType = 'ACCOMMODATION', isFirstBonus = false, firstBonusAmount = 0;

  if (booking.partner_code && booking.booking_source !== 'SELF_USE') {
    const partner = await findPartnerByCode(booking.partner_code);
    if (partner) {
      const commission = calculateCommission(partner);
      commissionAmount = commission.amount;
      commissionType = commission.type;
      isFirstBonus = commission.isFirstBonus;
      firstBonusAmount = commission.firstBonusAmount;
      await updatePartnerAfterCheckin(partner, booking, commissionAmount, commissionType);
      await createPayoutRecord(partner.partner_code, commissionAmount, booking.id, commissionType);
    }
  }

  await updateRecord('Bookings', booking.id, {
    stay_status: 'COMPLETED',
    commission_status: commissionAmount > 0 ? 'CALCULATED' : 'NOT_ELIGIBLE',
    commission_amount: commissionAmount,
    commission_type: commissionType,
    is_first_referral_bonus: isFirstBonus,
    first_referral_bonus_amount: firstBonusAmount,
    manually_confirmed_by: data.confirmed_by || 'system',
    manually_confirmed_at: new Date().toISOString()
  });

  return { success: true, message: '入住確認成功', booking_id: booking.id, commission_amount: commissionAmount };
}

async function handleUseAccommodationPoints(data) {
  const partnerCode = data.partner_code;
  const deductAmount = parseFloat(data.deduct_amount || 0);
  const checkinDate = data.checkin_date || data.usage_date || new Date().toISOString();

  if (!partnerCode || deductAmount <= 0) throw new Error('參數無效');

  const partner = await findPartnerByCode(partnerCode);
  if (!partner) throw new Error('找不到大使資料');

  const currentPoints = Math.max(0, parseFloat(partner.available_points) || 0);
  if (currentPoints < deductAmount) throw new Error(`點數不足。可用：${currentPoints}，需要：${deductAmount}`);

  const bookingData = {
    partner_code: partnerCode,
    guest_name: data.guest_name || partner.partner_name,
    guest_phone: data.guest_phone || partner.contact_phone,
    guest_email: data.guest_email || partner.contact_email || '',
    checkin_date: checkinDate,
    checkout_date: data.checkout_date || checkinDate,
    room_price: parseFloat(data.room_price || deductAmount),
    booking_source: 'SELF_USE',
    stay_status: 'COMPLETED',
    payment_status: 'PAID',
    commission_status: 'NOT_ELIGIBLE',
    notes: `住宿金折抵 NT$ ${deductAmount}，實付 NT$ ${(data.room_price || deductAmount) - deductAmount}`
  };

  const booking = await createRecord('Bookings', bookingData);
  const bookingId = booking.id || booking.ID;

  const newAvailablePoints = currentPoints - deductAmount;
  const newPointsUsed = (parseFloat(partner.points_used) || 0) + deductAmount;

  await updateRecord('Partners', partner.partner_code, {
    available_points: newAvailablePoints,
    points_used: newPointsUsed
  });

  await createRecord('Accommodation_Usage', {
    partner_code: partnerCode,
    deduct_amount: deductAmount,
    related_booking_id: bookingId,
    usage_date: checkinDate,
    usage_type: 'ROOM_DISCOUNT',
    notes: data.notes || '住宿金折抵',
    created_by: 'system'
  });

  await createRecord('Payouts', {
    partner_code: partnerCode,
    payout_type: 'POINTS_ADJUSTMENT_DEBIT',
    amount: -deductAmount,
    related_booking_ids: String(bookingId),
    payout_method: 'POINTS_ADJUSTMENT',
    payout_status: 'COMPLETED',
    notes: `住宿金折抵 - 訂房 #${bookingId}`,
    created_by: 'system'
  });

  return { success: true, message: `成功使用 ${deductAmount} 點住宿金`, booking_id: bookingId };
}

async function handleGetAllData() {
  const data = {};
  const sheetNames = ['Bookings', 'Partners', 'Payouts', 'Accommodation_Usage', 'Clicks', LINE_COUPON_BINDING_TABLE, LINE_REFERRAL_CLAIM_TABLE, 'Coupon_Templates'];

  for (const sheetName of sheetNames) {
    try {
      const records = await db.getAllRecords(sheetName);
      data[sheetName.toLowerCase()] = records;
    } catch (err) {
      console.error(`[handleGetAllData] Error reading ${sheetName}:`, err.message);
      data[sheetName.toLowerCase()] = [];
    }
  }

  if (data.partners && data.bookings) {
    data.partners = await syncPartnerCollectionLevelState(data.partners, data.bookings);
  }

  const backend = process.env.DATA_BACKEND || 'sheets';
  return { success: true, backend, data };
}

async function handleUpdateBooking(data) {
  CALL_DEPTH++;
  if (CALL_DEPTH > MAX_CALL_DEPTH) {
    CALL_DEPTH = 0;
    throw new Error('Maximum call depth exceeded');
  }

  try {
    const bookingId = data.booking_id || data.id;
    if (!bookingId) throw new Error('Booking ID is required');

    const oldBookingResult = await findRecordById('Bookings', bookingId);
    if (!oldBookingResult) throw new Error('Booking not found');
    const oldBooking = oldBookingResult.data;

    delete data.action; delete data.booking_id; delete data.id;
    delete data.created_at; delete data._internal_call; delete data.admin_secret;
    delete data.original_guest_name; delete data.original_guest_phone;

    if (oldBooking.booking_source !== 'SELF_USE') {
      const lineUserIdForResolution = String(
        Object.prototype.hasOwnProperty.call(data, 'line_user_id')
          ? data.line_user_id
          : oldBooking.line_user_id || ''
      ).trim();
      const latestClaim = lineUserIdForResolution
        ? await getLatestLineReferralClaimByLineUserId(lineUserIdForResolution)
        : null;
      const attribution = determineBookingAttribution(
        {
          ...oldBooking,
          ...data
        },
        latestClaim,
        {
          hasExplicitPartnerField: Object.prototype.hasOwnProperty.call(data, 'partner_code'),
          explicitEmptyPartnerClears: Object.prototype.hasOwnProperty.call(data, 'partner_code')
        }
      );

      data.partner_code = attribution.partner_code;
      data.line_user_id = attribution.line_user_id || '';
      data.line_display_name = attribution.line_display_name || '';
      data.attribution_source = attribution.attribution_source || '';
      data.attribution_claimed_at = attribution.attribution_claimed_at || '';
      data.attribution_entered_code = attribution.attribution_entered_code || '';
    }

    const changes = analyzeBookingChanges(oldBooking, data);

    if (changes.hasPartnerChange) await handlePartnerChange(oldBooking, data);
    if (changes.hasPriceChange && oldBooking.commission_status === 'CALCULATED') {
      handlePriceChange(oldBooking, data);
    }
    if (changes.hasStatusChange) return await handleStatusChange(oldBooking, data, bookingId);

    const updated = await updateRecord('Bookings', bookingId, data);
    return { success: true, message: 'Booking updated successfully', data: updated, changes };
  } finally {
    CALL_DEPTH = Math.max(0, CALL_DEPTH - 1);
  }
}

async function handlePartnerChange(oldBooking, newData) {
  const oldPartnerCode = oldBooking.partner_code;
  const newPartnerCode = newData.partner_code;

  if (oldBooking.stay_status !== 'COMPLETED') {
    if (oldBooking.booking_source !== 'SELF_USE') {
      if (oldPartnerCode) await updatePartnerReferralStats(oldPartnerCode, -1);
      if (newPartnerCode) await updatePartnerReferralStats(newPartnerCode, 1);
    }
    return;
  }

  if (oldBooking.commission_amount > 0 && oldPartnerCode) {
    const oldPartner = await findPartnerByCode(oldPartnerCode);
    if (oldPartner) {
      const commissionAmount = parseFloat(oldBooking.commission_amount);
      const levelSnapshot = await buildPartnerLevelSnapshot(oldPartner, {
        excludeBookingIds: [oldBooking.id]
      });
      const oldPartnerUpdates = {
        total_commission_earned: Math.max(0, (oldPartner.total_commission_earned || 0) - commissionAmount)
      };
      Object.assign(oldPartnerUpdates, buildPartnerLevelUpdates(levelSnapshot));

      if (oldBooking.commission_type === 'ACCOMMODATION') {
        oldPartnerUpdates.available_points = Math.max(0, (oldPartner.available_points || 0) - commissionAmount);
      } else {
        oldPartnerUpdates.pending_commission = Math.max(0, (oldPartner.pending_commission || 0) - commissionAmount);
      }

      await updateRecord('Partners', oldPartnerCode, oldPartnerUpdates);
      await createRecord('Payouts', {
        partner_code: oldPartnerCode,
        payout_type: 'COMMISSION_REVERSAL',
        amount: -commissionAmount,
        related_booking_ids: oldBooking.id,
        payout_method: 'OTHER',
        payout_status: 'COMPLETED',
        notes: `變更推薦人，撤銷原佣金 NT$ ${commissionAmount}`,
        created_by: 'system'
      });
    }
  }

  if (newPartnerCode && oldBooking.stay_status === 'COMPLETED') {
    const newPartner = await findPartnerByCode(newPartnerCode);
    if (newPartner) {
      const commission = calculateCommission(newPartner);
      await updatePartnerAfterCheckin(newPartner, {
        ...oldBooking,
        partner_code: newPartnerCode
      }, commission.amount, commission.type);
      await createPayoutRecord(newPartnerCode, commission.amount, oldBooking.id, commission.type);
      newData.commission_amount = commission.amount;
      newData.commission_type = commission.type;
      newData.is_first_referral_bonus = commission.isFirstBonus;
      newData.first_referral_bonus_amount = commission.firstBonusAmount;
    }
  } else if (newPartnerCode) {
    newData.commission_status = 'PENDING';
  }
}

function handlePriceChange(oldBooking, newData) {
  console.log(`Room price changed, but commission remains fixed`);
}

async function handleStatusChange(oldBooking, newData, bookingId) {
  const oldStatus = oldBooking.stay_status;
  const newStatus = newData.stay_status;
  const isFromInternalCall = newData._internal_call || false;

  if (oldStatus === 'PENDING' && newStatus === 'COMPLETED' && !isFromInternalCall) {
    return await handleConfirmCheckinCompletion({
      booking_id: bookingId, confirmed_by: 'status_update', _internal_call: true
    });
  }

  if (oldStatus === 'COMPLETED' && newStatus === 'CANCELLED' && !isFromInternalCall) {
    return await handleDeleteBooking({
      booking_id: bookingId, _internal_call: true
    });
  }

  if (oldStatus === 'CANCELLED' && newStatus === 'PENDING') {
    newData.commission_status = oldBooking.partner_code ? 'PENDING' : 'NOT_ELIGIBLE';
    newData.commission_amount = 0;
    newData.manually_confirmed_at = '';
    newData.manually_confirmed_by = '';
    if (oldBooking.partner_code) await updatePartnerReferralStats(oldBooking.partner_code, 1);
  }

  const updated = await updateRecord('Bookings', bookingId, newData);
  return { success: true, message: `Booking status changed from ${oldStatus} to ${newStatus}`, data: updated };
}

async function handleDeleteBooking(data) {
  const bookingId = data.booking_id || data.id;
  if (!bookingId) throw new Error('Booking ID is required');

  const booking = await findRecordById('Bookings', bookingId);
  if (!booking) throw new Error('Booking not found');

  if (booking.data.stay_status === 'CANCELLED') {
    return { success: true, message: '此訂單已經取消過了', booking_id: bookingId };
  }

  if (booking.data.booking_source === 'SELF_USE' && booking.data.partner_code) {
    const partner = await findPartnerByCode(booking.data.partner_code);
    if (partner) {
      const deductAmount = extractDeductAmount(booking.data.notes);
      if (deductAmount > 0) {
        await updateRecord('Partners', partner.partner_code, {
          available_points: (partner.available_points || 0) + deductAmount,
          points_used: Math.max(0, (partner.points_used || 0) - deductAmount)
        });
        await createRecord('Payouts', {
          partner_code: partner.partner_code,
          payout_type: 'POINTS_REFUND',
          amount: deductAmount,
          related_booking_ids: bookingId,
          payout_method: 'ACCOMMODATION_REFUND',
          payout_status: 'COMPLETED',
          notes: `取消訂單 ${bookingId}，返還住宿金 NT$ ${deductAmount}`,
          created_by: 'system'
        });
      }
    }
  } else if (booking.data.booking_source === 'REFERRAL' && booking.data.partner_code) {
    const partner = await findPartnerByCode(booking.data.partner_code);
    if (partner) {
      const levelSnapshot = await buildPartnerLevelSnapshot(partner, {
        excludeBookingIds: [bookingId]
      });
      const partnerUpdates = {
        total_referrals: Math.max(0, (partner.total_referrals || 0) - 1)
      };
      Object.assign(partnerUpdates, buildPartnerLevelUpdates(levelSnapshot));

      if (booking.data.stay_status === 'COMPLETED' && booking.data.commission_amount > 0) {
        const commissionAmount = parseFloat(booking.data.commission_amount);
        partnerUpdates.total_commission_earned = Math.max(0, (partner.total_commission_earned || 0) - commissionAmount);
        let debtAmount = 0;

        if (booking.data.commission_type === 'ACCOMMODATION') {
          const currentAvailablePoints = parseFloat(partner.available_points || 0);
          partnerUpdates.available_points = Math.max(0, currentAvailablePoints - commissionAmount);
          debtAmount = Math.max(0, commissionAmount - currentAvailablePoints);
        } else if (booking.data.commission_type === 'CASH') {
          const currentPendingCommission = parseFloat(partner.pending_commission || 0);
          partnerUpdates.pending_commission = Math.max(0, currentPendingCommission - commissionAmount);
          debtAmount = Math.max(0, commissionAmount - currentPendingCommission);
        }

        await createRecord('Payouts', {
          partner_code: partner.partner_code,
          payout_type: 'COMMISSION_REVERSAL',
          amount: -commissionAmount,
          related_booking_ids: bookingId,
          payout_method: 'OTHER',
          payout_status: 'COMPLETED',
          notes: `取消訂單 ${bookingId}，撤銷${booking.data.commission_type === 'ACCOMMODATION' ? '住宿金' : '現金'}佣金 NT$ ${commissionAmount}`,
          created_by: 'system'
        });

        if (debtAmount > 0) {
          await createRecord('Payouts', {
            partner_code: partner.partner_code,
            payout_type: 'DEBT_RECORD',
            amount: -debtAmount,
            related_booking_ids: String(bookingId),
            payout_method: 'OTHER',
            payout_status: 'PENDING',
            notes: `取消訂單 ${bookingId} 時，可用${booking.data.commission_type === 'ACCOMMODATION' ? '住宿金' : '待支付現金'}不足，產生負債 NT$ ${debtAmount}`,
            created_by: 'system'
          });
        }
      }

      await updateRecord('Partners', partner.partner_code, partnerUpdates);
    }
  }

  const cancelData = {
    stay_status: 'CANCELLED',
    commission_status: 'CANCELLED',
    notes: (booking.data.notes || '') + `\n[取消於 ${new Date().toISOString()}] ${data.reason || ''}`
  };

  const cancelled = await updateRecord('Bookings', bookingId, cancelData);

  if (
    booking.data.booking_source === 'REFERRAL' &&
    booking.data.partner_code &&
    booking.data.stay_status === 'COMPLETED' &&
    parseFloat(booking.data.commission_amount || 0) > 0
  ) {
    await reconcilePartnerCompletedReferralBookings(booking.data.partner_code, {
      cancelledBookingId: bookingId,
      updatedBy: data.cancelled_by || data.updated_by || 'system'
    });
  }

  return { success: true, message: 'Booking cancelled successfully', data: cancelled };
}

async function handleUpdatePayout(data) {
  const payoutId = data.payout_id || data.id;
  if (!payoutId) throw new Error('Payout ID is required');

  delete data.action;
  delete data.payout_id;
  delete data.id;
  delete data.created_at;
  delete data.admin_secret;
  const updated = await updateRecord('Payouts', payoutId, data);
  return { success: true, message: 'Payout updated successfully', data: updated };
}

async function handleCancelPayout(data) {
  const payoutId = data.payout_id || data.id;
  if (!payoutId) throw new Error('Payout ID is required');

  let payoutResults = await findRecordsByField('Payouts', 'id', payoutId);
  if (payoutResults.length === 0) payoutResults = await findRecordsByField('Payouts', 'ID', payoutId);
  if (payoutResults.length === 0) throw new Error(`Payout not found: ${payoutId}`);

  const payout = payoutResults[0].data;
  if (payout.payout_status === 'CANCELLED') {
    return { success: false, error: 'Payout already cancelled' };
  }

  const hasRelatedBooking = payout.related_booking_ids && String(payout.related_booking_ids).trim() !== '';

  // 只有與訂房關聯的佣金 Payout 才觸發智慧取消（修改等級/點數/推薦數）
  // 沒有 related_booking_ids 的純記帳 Payout 只做狀態取消
  if (hasRelatedBooking && ['ACCOMMODATION', 'CASH', 'FIRST_REFERRAL_BONUS'].includes(payout.payout_type)) {
    const partner = await findPartnerByCode(payout.partner_code);
    if (partner) {
      const commissionToDeduct = Math.abs(parseFloat(payout.amount) || 0);
      const currentAvailablePoints = parseFloat(partner.available_points || 0);
      const currentPendingCommission = parseFloat(partner.pending_commission || 0);
      const levelSnapshot = await buildPartnerLevelSnapshot(partner, {
        excludeBookingIds: parseRelatedBookingIds(payout.related_booking_ids)
      });

      const partnerUpdates = {
        total_commission_earned: Math.max(0, (partner.total_commission_earned || 0) - commissionToDeduct)
      };
      Object.assign(partnerUpdates, buildPartnerLevelUpdates(levelSnapshot));

      if (payout.payout_type === 'CASH') {
        partnerUpdates.pending_commission = Math.max(0, currentPendingCommission - commissionToDeduct);
      } else {
        let remaining = commissionToDeduct;

        if (currentAvailablePoints >= remaining) {
          partnerUpdates.available_points = currentAvailablePoints - remaining;
          remaining = 0;
        } else {
          partnerUpdates.available_points = 0;
          remaining -= currentAvailablePoints;
        }

        if (remaining > 0) {
          partnerUpdates.notes = (partner.notes || '') +
            `\n[${new Date().toISOString()}] 取消結算 #${payoutId} 產生負債 ${remaining} 點`;
          await createRecord('Payouts', {
            partner_code: payout.partner_code,
            payout_type: 'DEBT_RECORD',
            amount: -remaining,
            related_booking_ids: payout.related_booking_ids || '',
            payout_method: 'OTHER',
            payout_status: 'PENDING',
            notes: `取消結算 #${payoutId} 產生的負債`,
            created_by: 'SYSTEM'
          });
        }
      }

      await updateRecord('Partners', partner.partner_code, partnerUpdates);
      await createRecord('Payouts', {
        partner_code: payout.partner_code,
        payout_type: 'COMMISSION_REVERSAL',
        amount: -commissionToDeduct,
        related_booking_ids: payout.related_booking_ids || '',
        payout_method: 'OTHER',
        payout_status: 'COMPLETED',
        notes: `撤銷 Payout #${payoutId}，退回 NT$ ${commissionToDeduct}`,
        created_by: 'SYSTEM'
      });
    }
  } else if (!hasRelatedBooking && payout.payout_status === 'PENDING' && payout.payout_type !== 'CASH_CONVERSION' && payout.payout_type !== 'POINTS_REFUND') {
    const partner = await findPartnerByCode(payout.partner_code);
    if (partner) {
      const restoredAmount = Math.abs(parseFloat(payout.amount) || 0);
      await updateRecord('Partners', partner.partner_code, {
        pending_commission: (parseFloat(partner.pending_commission) || 0) + restoredAmount
      });

      await createRecord('Payouts', {
        partner_code: payout.partner_code,
        payout_type: 'COMMISSION_REVERSAL',
        amount: -restoredAmount,
        related_booking_ids: payout.related_booking_ids || '',
        payout_method: 'OTHER',
        payout_status: 'COMPLETED',
        notes: `撤銷純結算 Payout #${payoutId}，恢復待支付現金 NT$ ${restoredAmount}`,
        created_by: 'SYSTEM'
      });
    }
  } else if (payout.payout_type === 'CASH_CONVERSION') {
    const partner = await findPartnerByCode(payout.partner_code);
    if (partner) {
      const cashAmount = Math.abs(parseFloat(payout.amount) || 0);
      const notesMatch = (payout.notes || '').match(/點數轉現金：(\d+)/);
      const pointsToRestore = notesMatch ? parseInt(notesMatch[1]) : Math.round(cashAmount / 0.5);

      await updateRecord('Partners', partner.partner_code, {
        available_points: (parseFloat(partner.available_points) || 0) + pointsToRestore,
        points_used: Math.max(0, (parseFloat(partner.points_used) || 0) - pointsToRestore),
        pending_commission: Math.max(0, (parseFloat(partner.pending_commission) || 0) - cashAmount)
      });

      await createRecord('Payouts', {
        partner_code: payout.partner_code,
        payout_type: 'POINTS_ADJUSTMENT',
        amount: pointsToRestore,
        payout_method: 'POINTS_CONVERSION_REVERSAL',
        payout_status: 'COMPLETED',
        notes: `撤銷點數轉現金 #${payoutId}，退回 ${pointsToRestore} 點`,
        created_by: 'SYSTEM'
      });
    }
  }

  const updated = await updateRecord('Payouts', payoutId, {
    payout_status: 'CANCELLED',
    notes: (payout.notes || '') + ` [取消於 ${new Date().toISOString()}] ${data.reason || ''}`
  });

  return { success: true, message: 'Smart payout cancellation completed', data: updated };
}

async function handleProcessPayout(data) {
  const partnerCode = data.partner_code;
  const payAmount = parseFloat(data.amount || 0);
  if (!partnerCode) throw new Error('Partner code is required');

  const partner = await findPartnerByCode(partnerCode);
  if (!partner) throw new Error('Partner not found');

  const actualPayAmount = payAmount > 0 ? payAmount : (partner.pending_commission || 0);
  if (actualPayAmount <= 0) throw new Error('No pending commission to pay');

  const payout = await createRecord('Payouts', {
    partner_code: partnerCode,
    payout_type: 'PAYMENT_COMPLETED',
    amount: actualPayAmount,
    payout_method: 'BANK_TRANSFER',
    payout_status: 'COMPLETED',
    bank_transfer_date: data.bank_transfer_date || new Date().toISOString().split('T')[0],
    bank_transfer_reference: data.bank_transfer_reference || '',
    notes: data.notes || `銀行匯款 NT$ ${actualPayAmount}`,
    created_by: data.created_by || 'admin'
  });

  const partnerUpdates = {
    pending_commission: Math.max(0, (partner.pending_commission || 0) - actualPayAmount),
    total_commission_paid: (partner.total_commission_paid || 0) + actualPayAmount
  };
  await updateRecord('Partners', partner.partner_code, partnerUpdates);

  return {
    success: true,
    message: `Payment completed. Paid NT$ ${actualPayAmount}`,
    payout_id: payout.id,
    data: { payout, remaining_pending: partnerUpdates.pending_commission }
  };
}

async function handleRevertCashToPoints(data) {
  const partnerCode = data.partner_code;
  if (!partnerCode) throw new Error('Partner code is required');

  // 季度截止日檢查：僅限當季截止日（3/31、6/30、9/30、12/31）前可撤回
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3); // 0=Q1, 1=Q2, 2=Q3, 3=Q4
  const quarterEndDates = [
    new Date(now.getFullYear(), 2, 31, 23, 59, 59),  // Q1: 3/31
    new Date(now.getFullYear(), 5, 30, 23, 59, 59),  // Q2: 6/30
    new Date(now.getFullYear(), 8, 30, 23, 59, 59),  // Q3: 9/30
    new Date(now.getFullYear(), 11, 31, 23, 59, 59)  // Q4: 12/31
  ];
  const quarterEnd = quarterEndDates[quarter];
  if (now > quarterEnd) {
    throw new Error(`已超過當季截止日（${quarterEnd.toISOString().slice(0, 10)}），無法撤回轉換`);
  }

  const partner = await findPartnerByCode(partnerCode);
  if (!partner) throw new Error('Partner not found');

  const cashAmount = parseFloat(data.amount || data.pending_commission || partner.pending_commission || 0);
  if (cashAmount <= 0) throw new Error('No pending cash to revert');

  const currentPending = parseFloat(partner.pending_commission || 0);
  if (currentPending < cashAmount) {
    throw new Error(`待支付現金不足。可用：${currentPending}，需要：${cashAmount}`);
  }

  const pointsAmount = Math.floor(cashAmount * 2);
  const partnerUpdates = {
    available_points: (parseFloat(partner.available_points) || 0) + pointsAmount,
    points_used: Math.max(0, (parseFloat(partner.points_used) || 0) - pointsAmount),
    pending_commission: Math.max(0, currentPending - cashAmount)
  };
  await updateRecord('Partners', partner.partner_code, partnerUpdates);

  const payout = await createRecord('Payouts', {
    partner_code: partnerCode,
    payout_type: 'POINTS_ADJUSTMENT',
    amount: pointsAmount,
    payout_method: 'MANUAL_ADJUSTMENT',
    payout_status: 'COMPLETED',
    notes: data.notes || `現金轉回住宿金：NT$ ${cashAmount} → ${pointsAmount} 點`,
    created_by: data.created_by || 'admin'
  });

  return {
    success: true,
    message: `Converted NT$ ${cashAmount} to ${pointsAmount} points`,
    payout_id: payout.id,
    data: { payout, available_points: partnerUpdates.available_points, pending_commission: partnerUpdates.pending_commission }
  };
}

async function handleUpdatePartnerCommission(data) {
  const partnerCode = data.partner_code;
  if (!partnerCode) throw new Error('Partner code is required');

  const partner = await findPartnerByCode(partnerCode);
  if (!partner) throw new Error('Partner not found');

  const updates = {};
  const auditEntries = [];
  const adjustmentReason = data.adjustment_reason || '';

  function createAdjustmentNote(label, oldValue, newValue, extraDetail = '') {
    const parts = [`手動調整${label}: ${oldValue} -> ${newValue}`];
    if (extraDetail) parts.push(extraDetail);
    if (adjustmentReason) parts.push(`原因: ${adjustmentReason}`);
    return parts.join(' | ');
  }

  if (data.total_commission_earned !== undefined) {
    const newValue = parseFloat(data.total_commission_earned);
    const oldValue = parseFloat(partner.total_commission_earned) || 0;
    const diff = newValue - oldValue;
    if (diff !== 0) {
      updates.total_commission_earned = newValue;
      auditEntries.push({
        payout_type: 'MANUAL_ADJUSTMENT',
        amount: diff,
        notes: createAdjustmentNote('累積佣金', oldValue, newValue)
      });
    }
  }
  if (data.pending_commission !== undefined) {
    const newValue = Math.max(0, parseFloat(data.pending_commission));
    const oldValue = parseFloat(partner.pending_commission) || 0;
    const diff = newValue - oldValue;
    if (diff !== 0) {
      updates.pending_commission = newValue;
      auditEntries.push({
        payout_type: 'CASH_ADJUSTMENT',
        amount: diff,
        notes: createAdjustmentNote('待支付現金', oldValue, newValue)
      });
    }
  }
  if (data.available_points !== undefined) {
    const newValue = Math.max(0, parseFloat(data.available_points));
    const oldValue = parseFloat(partner.available_points) || 0;
    const diff = newValue - oldValue;
    if (diff !== 0) {
      updates.available_points = newValue;
      const oldPointsUsed = parseFloat(partner.points_used) || 0;
      const newPointsUsed = data.points_used !== undefined ? (parseFloat(data.points_used) || 0) : oldPointsUsed;
      const extraDetail = oldPointsUsed !== newPointsUsed
        ? `已使用點數: ${oldPointsUsed} -> ${newPointsUsed}`
        : '';
      auditEntries.push({
        payout_type: 'POINTS_ADJUSTMENT',
        amount: diff,
        notes: createAdjustmentNote('可用點數', oldValue, newValue, extraDetail)
      });
    }
  }
  if (data.points_used !== undefined) {
    const newValue = parseFloat(data.points_used);
    const oldValue = parseFloat(partner.points_used) || 0;
    if (newValue !== oldValue) {
      updates.points_used = newValue;
      if (data.available_points === undefined || (parseFloat(data.available_points) || 0) === (parseFloat(partner.available_points) || 0)) {
        auditEntries.push({
          payout_type: 'MANUAL_ADJUSTMENT',
          amount: 0,
          notes: createAdjustmentNote('已使用點數', oldValue, newValue)
        });
      }
    }
  }
  if (data.successful_referrals !== undefined) updates.successful_referrals = parseInt(data.successful_referrals);
  if (data.yearly_referrals !== undefined) updates.yearly_referrals = parseInt(data.yearly_referrals);

  const updated = await updateRecord('Partners', partnerCode, updates);

  for (const entry of auditEntries) {
    await createRecord('Payouts', {
      partner_code: partnerCode,
      payout_type: entry.payout_type,
      amount: entry.amount,
      payout_method: 'MANUAL_ADJUSTMENT',
      payout_status: 'COMPLETED',
      notes: entry.notes,
      created_by: data.created_by || 'admin'
    });
  }

  return {
    success: true, message: 'Partner commission updated successfully', data: updated,
    adjustments: auditEntries
  };
}

async function handleUpdatePartner(data) {
  const partnerCode = data.partner_code;
  if (!partnerCode) throw new Error('Partner code is required');

  const partner = await findPartnerByCode(partnerCode);
  if (!partner) throw new Error('Partner not found');

  delete data.action; delete data.partner_code; delete data.created_at;
  delete data.admin_secret; delete data._internal_call;

  const oldLevel = partner.partner_level;
  const oldPreference = partner.commission_preference;
  const oldCouponCode = String(partner.coupon_code || '').trim();
  const oldIsActive = partner.is_active !== false;
  const currentYear = getBusinessYear();

  if (data.partner_level && data.partner_level !== oldLevel) {
    const normalizedLevel = normalizeLevel(data.partner_level);
    data.partner_level = normalizedLevel;
    data.level = normalizedLevel;
    data.base_level_for_year = data.base_level_for_year || normalizedLevel;
    data.yearly_referrals_year = data.yearly_referrals_year || currentYear;
    data.level_achieved_at = data.level_achieved_at || getValueAsDateString(new Date()) || getStartOfYearDate(currentYear);
    data.level_valid_until = data.level_valid_until || getEndOfYearDate(currentYear);
    data.last_level_review_year = data.last_level_review_year !== undefined
      ? toInt(data.last_level_review_year, currentYear - 1)
      : currentYear - 1;

    await createRecord('Payouts', {
      partner_code: partnerCode,
      payout_type: 'LEVEL_ADJUSTMENT',
      amount: 0,
      payout_method: 'OTHER',
      payout_status: 'COMPLETED',
      notes: `等級調整：${oldLevel} → ${normalizedLevel}`,
      created_by: data.updated_by || 'admin'
    });
  }

  if (data.coupon_code !== undefined) {
    const nextCouponCode = String(data.coupon_code || '').trim();
    if (nextCouponCode && nextCouponCode.toLowerCase() === String(partnerCode).toLowerCase()) {
      throw new Error('優惠券代碼不可與大使代碼相同');
    }
  }

  let lineCouponProvision = null;
  let lineCouponDeactivation = null;

  const updated = await updateRecord('Partners', partnerCode, data);
  const mergedPartner = normalizePartnerRecord({ ...partner, ...updated });

  if (data.is_active !== undefined) {
    const nextIsActive = data.is_active !== false && data.is_active !== 'false';
    if (oldIsActive && !nextIsActive) {
      lineCouponDeactivation = await discontinueLineCouponBinding(
        await getLineCouponBindingByPartnerCode(partnerCode),
        'Partner suspended'
      );
    }
  }

  if (data.coupon_code !== undefined) {
    const nextCouponCode = String(data.coupon_code || '').trim();
    if (nextCouponCode && nextCouponCode !== oldCouponCode) {
      const legacyBinding = await getLineCouponBindingByPartnerCode(partnerCode);
      if (legacyBinding && legacyBinding.is_active !== false) {
        lineCouponDeactivation = await discontinueLineCouponBinding(
          legacyBinding,
          'Coupon code updated, legacy dedicated coupon closed'
        );
      }
    }
  }

  lineCouponProvision = {
    success: hasSharedLineCouponConfigured(),
    skipped: true,
    mode: 'shared_coupon_claim',
    shared_coupon_id_configured: hasSharedLineCouponConfigured()
  };

  return {
    success: true, message: 'Partner updated successfully', data: updated,
    changes: {
      levelChanged: data.partner_level && data.partner_level !== oldLevel,
      preferenceChanged: data.commission_preference && data.commission_preference !== oldPreference
    },
    line_coupon_provision: lineCouponProvision,
    line_coupon_deactivation: lineCouponDeactivation
  };
}

async function handleConvertPointsToCash(data) {
  const partnerCode = data.partner_code;
  const convertAmount = parseFloat(data.points_used || data.amount || 0);
  const EXCHANGE_RATE = 0.5;

  const MIN_CONVERT_POINTS = 1000;
  if (!partnerCode || convertAmount <= 0) throw new Error('參數無效');
  if (convertAmount < MIN_CONVERT_POINTS) throw new Error(`最低轉換金額為 ${MIN_CONVERT_POINTS} 點，您輸入了 ${convertAmount} 點`);

  const partner = await findPartnerByCode(partnerCode);
  if (!partner) throw new Error('找不到大使: ' + partnerCode);

  const currentPoints = parseFloat(partner.available_points) || 0;
  if (currentPoints < convertAmount) throw new Error(`點數不足。可用：${currentPoints}，需要：${convertAmount}`);

  const cashAmount = Math.floor(convertAmount * EXCHANGE_RATE);
  const newAvailablePoints = currentPoints - convertAmount;
  const newPointsUsed = (parseFloat(partner.points_used) || 0) + convertAmount;
  const newPendingCommission = (parseFloat(partner.pending_commission) || 0) + cashAmount;

  await updateRecord('Partners', partnerCode, {
    available_points: newAvailablePoints,
    points_used: newPointsUsed,
    pending_commission: newPendingCommission
  });

  await createRecord('Payouts', {
    partner_code: partnerCode,
    payout_type: 'CASH_CONVERSION',
    amount: cashAmount,
    payout_method: 'POINTS_CONVERSION',
    payout_status: 'PENDING',
    notes: data.notes || `點數轉現金：${convertAmount} 點 → NT$ ${cashAmount} (2:1)`,
    created_by: 'system'
  });

  return {
    success: true, message: `成功轉換 ${convertAmount} 點為 NT$ ${cashAmount}`,
    data: { points_converted: convertAmount, cash_amount: cashAmount }
  };
}

async function handleCreatePayout(data) {
  const payoutData = {
    partner_code: data.partner_code,
    payout_type: data.payout_type || 'CASH',
    amount: parseFloat(data.amount || 0),
    related_booking_ids: data.related_booking_ids || data.booking_ids || '',
    payout_method: data.payout_method || (data.payout_type === 'CASH' ? 'BANK_TRANSFER' : 'ACCOMMODATION_VOUCHER'),
    payout_status: data.payout_status || 'PENDING',
    bank_transfer_date: data.bank_transfer_date || '',
    bank_transfer_reference: data.bank_transfer_reference || '',
    accommodation_voucher_code: data.accommodation_voucher_code || '',
    notes: data.notes || '',
    created_by: data.created_by || 'admin'
  };

  if (!payoutData.partner_code) throw new Error('Partner code is required');
  if (payoutData.amount <= 0) throw new Error('Amount must be greater than 0');

  const partner = await findPartnerByCode(payoutData.partner_code);
  if (!partner) throw new Error('Partner not found');

  const payout = await createRecord('Payouts', payoutData);

  if (payoutData.payout_status === 'PENDING' && payoutData.payout_type !== 'POINTS_REFUND') {
    const currentPending = parseFloat(partner.pending_commission || 0);
    await updateRecord('Partners', partner.partner_code, {
      pending_commission: Math.max(0, currentPending - payoutData.amount)
    });
  }

  return { success: true, message: 'Payout created successfully', payout_id: payout.id, data: payout };
}

async function handleDeletePartner(data) {
  const partnerCode = data.partner_code;
  if (!partnerCode) throw new Error('Partner code is required');

  const partner = await findPartnerByCode(partnerCode);
  if (!partner) throw new Error('Partner not found');

  const delFn = db.deleteByField;
  if (!delFn) throw new Error('deleteByField not available in current adapter');

  // Delete all related records in order
  const tables = ['Accommodation_Usage', 'Clicks', 'Line_Coupon_Bindings', 'Line_Referral_Claims', 'Payouts', 'Bookings'];
  const deleted = {};
  for (const table of tables) {
    try {
      deleted[table] = await delFn(table, 'partner_code', partnerCode);
    } catch (e) {
      deleted[table] = 'skip: ' + e.message;
    }
  }

  // Delete the partner record itself
  deleted['Partners'] = await delFn('Partners', 'partner_code', partnerCode);

  return {
    success: true,
    message: `已永久刪除大使 ${partner.name || partnerCode} 及所有關聯資料`,
    data: { partner_code: partnerCode, deleted }
  };
}

async function handleCreatePartner(data) {
  const applicationId = data.application_id;
  const partnerData = {
    partner_code: data.partner_code,
    name: data.partner_name || data.name || '',
    partner_name: data.partner_name || data.name || '',
    level: data.partner_level || data.level || 'LV1_INSIDER',
    partner_level: data.partner_level || data.level || 'LV1_INSIDER',
    phone: data.contact_phone || data.phone || '',
    contact_phone: data.contact_phone || data.phone || '',
    email: data.contact_email || data.email || '',
    contact_email: data.contact_email || data.email || '',
    bank_code: data.bank_code || '',
    bank_account: data.bank_account || data.bank_account_number || '',
    bank_name: data.bank_name || '',
    bank_branch: data.bank_branch || '',
    bank_account_name: data.bank_account_name || '',
    commission_preference: data.commission_preference || 'ACCOMMODATION',
    total_referrals: parseInt(data.total_referrals) || 0,
    successful_referrals: parseInt(data.successful_referrals) || parseInt(data.total_successful_referrals) || 0,
    total_successful_referrals: parseInt(data.successful_referrals) || parseInt(data.total_successful_referrals) || 0,
    yearly_referrals: parseInt(data.yearly_referrals) || 0,
    level_progress: parseInt(data.level_progress) || 0,
    base_level_for_year: data.base_level_for_year || data.partner_level || data.level || 'LV1_INSIDER',
    yearly_referrals_year: parseInt(data.yearly_referrals_year) || getBusinessYear(),
    level_achieved_at: data.level_achieved_at || getStartOfYearDate(getBusinessYear()),
    level_valid_until: data.level_valid_until || getEndOfYearDate(getBusinessYear()),
    last_level_review_year: parseInt(data.last_level_review_year) || (getBusinessYear() - 1),
    total_commission_earned: parseFloat(data.total_commission_earned) || 0,
    total_commission_paid: parseFloat(data.total_commission_paid) || 0,
    available_points: data.available_points !== undefined ? parseFloat(data.available_points) : 0,
    points_used: parseFloat(data.points_used) || 0,
    pending_commission: parseFloat(data.pending_commission) || 0,
    line_coupon_url: data.line_coupon_url || data.coupon_url || '',
    coupon_code: data.coupon_code || '',
    coupon_url: data.coupon_url || '',
    landing_link: data.landing_link || '',
    coupon_link: data.coupon_link || '',
    short_landing_link: data.short_landing_link || '',
    short_coupon_link: data.short_coupon_link || '',
    join_date: data.join_date || new Date().toISOString(),
    is_active: data.is_active !== false,
    notes: data.notes || '',
    total_clicks: 0,
    last_click_date: null
  };

  if (!partnerData.partner_code) throw new Error('Partner code is required');
  if (!partnerData.partner_name) throw new Error('Partner name is required');
  if (!partnerData.contact_phone) throw new Error('Contact phone is required');
  if (!partnerData.coupon_code) throw new Error('Coupon code is required');
  if (String(partnerData.coupon_code).trim().toLowerCase() === String(partnerData.partner_code).trim().toLowerCase()) {
    throw new Error('優惠券代碼不可與大使代碼相同');
  }

  const existing = await findPartnerByCode(partnerData.partner_code);
  if (existing) throw new Error('Partner code already exists');

  const partner = await createRecord('Partners', partnerData);

  if (applicationId) {
    await ensureApplicationsSheet();
    const applicationRecord = await findRecordById(APPLICATION_SHEET, applicationId);
    if (applicationRecord) {
      await updateRecord(APPLICATION_SHEET, applicationId, {
        partner_code_assigned: partner.partner_code,
        partner_link_sent: true
      });
    }
  }

  return {
    success: true,
    message: 'Partner created successfully',
    partner_code: partner.partner_code,
    data: partner,
    line_coupon_provision: {
      success: hasSharedLineCouponConfigured(),
      skipped: true,
      mode: 'shared_coupon_claim',
      shared_coupon_id_configured: hasSharedLineCouponConfigured()
    }
  };
}

// ========================================
// 點擊追蹤與重導向
// ========================================

async function handleRedirect(req, res) {
  const params = req.query || {};
  const destination = params.dest || 'landing';
  const subid = params.pid || params.subid || '';
  const partner = subid ? await findPartnerByCode(subid) : null;

  // 非同步記錄點擊（不等待完成）
  recordClick(params).catch(err => console.error('recordClick error:', err));

  let redirectUrl;
  if (destination === 'coupon') {
    const targetUrl = params.target;
    if (targetUrl) {
      redirectUrl = decodeURIComponent(targetUrl);
    } else {
      redirectUrl = (partner && partner.is_active !== false && partner.line_coupon_url) ? partner.line_coupon_url : DEFAULT_LINE_COUPON_URL;
    }
  } else {
    if (partner && partner.is_active === false) {
      redirectUrl = GITHUB_PAGES_URL;
    } else if (req.url && req.url.includes('?')) {
      const queryString = req.url.split('?')[1];
      redirectUrl = GITHUB_PAGES_URL + '?' + queryString;
    } else if (subid) {
      redirectUrl = GITHUB_PAGES_URL + `?subid=${encodeURIComponent(subid)}`;
      if (params.coupon_url) redirectUrl += `&coupon_url=${encodeURIComponent(params.coupon_url)}`;
    } else {
      redirectUrl = GITHUB_PAGES_URL;
    }
  }

  return res.redirect(302, redirectUrl);
}

async function recordClick(params) {
  const clickHeaders = ['id', 'partner_code', 'destination', 'utm_source', 'utm_medium',
    'utm_campaign', 'referrer', 'user_agent', 'ip_address', 'click_time', 'created_at'];
  await db.ensureTable('Clicks', clickHeaders);

  const clickData = {
    partner_code: params.pid || params.subid || null,
    destination: params.dest || 'landing',
    utm_source: params.utm_source || null,
    utm_medium: params.utm_medium || null,
    utm_campaign: params.utm_campaign || null,
    referrer: params.referrer || 'Direct',
    user_agent: params.userAgent || 'Unknown',
    ip_address: null,
    click_time: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  await createRecord('Clicks', clickData);

  if (clickData.partner_code) {
    await updatePartnerClickStats(clickData.partner_code);
  }
}

async function updatePartnerClickStats(partnerCode) {
  try {
    const partner = await findPartnerByCode(partnerCode);
    if (partner) {
      await updateRecord('Partners', partnerCode, {
        total_clicks: (partner.total_clicks || 0) + 1,
        last_click_date: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('updatePartnerClickStats error:', err);
  }
}

async function handleGetClickStats(params) {
  try {
    const clicks = await db.getAllRecords('Clicks');
    if (!clicks || clicks.length === 0) {
      return { success: true, data: { total_clicks: 0, partner_stats: [], destination_stats: {}, recent_clicks: [] } };
    }

    const stats = {
      total_clicks: clicks.length,
      partner_stats: {},
      destination_stats: {},
      utm_stats: { sources: {}, mediums: {}, campaigns: {} },
      recent_clicks: []
    };

    clicks.forEach(click => {
      if (click.partner_code) {
        if (!stats.partner_stats[click.partner_code]) stats.partner_stats[click.partner_code] = { total: 0, destinations: {} };
        stats.partner_stats[click.partner_code].total++;
        const dest = click.destination || 'unknown';
        stats.partner_stats[click.partner_code].destinations[dest] = (stats.partner_stats[click.partner_code].destinations[dest] || 0) + 1;
      }
      const destination = click.destination || 'unknown';
      stats.destination_stats[destination] = (stats.destination_stats[destination] || 0) + 1;
      if (click.utm_source) stats.utm_stats.sources[click.utm_source] = (stats.utm_stats.sources[click.utm_source] || 0) + 1;
      if (click.utm_medium) stats.utm_stats.mediums[click.utm_medium] = (stats.utm_stats.mediums[click.utm_medium] || 0) + 1;
      if (click.utm_campaign) stats.utm_stats.campaigns[click.utm_campaign] = (stats.utm_stats.campaigns[click.utm_campaign] || 0) + 1;
    });

    stats.recent_clicks = clicks.slice(-20).reverse();

    if (params.partner_code) {
      const partnerClicks = clicks.filter(c => c.partner_code === params.partner_code);
      return {
        success: true, data: {
          partner_code: params.partner_code, total_clicks: partnerClicks.length,
          clicks: partnerClicks, stats: stats.partner_stats[params.partner_code] || { total: 0, destinations: {} }
        }
      };
    }
    return { success: true, data: stats };
  } catch (err) {
    return { success: true, data: { total_clicks: 0, partner_stats: [], destination_stats: {}, recent_clicks: [] } };
  }
}

// ========================================
// 新增功能（2025-08-24）
// ========================================

async function handleCancelAccommodationUsage(data) {
  const { usage_id, partner_code, refund_amount, reason } = data;
  if (!usage_id && !partner_code) throw new Error('需要 usage_id 或 partner_code');

  let usageRecord = null;
  if (usage_id) usageRecord = await findRecordById('Accommodation_Usage', usage_id);

  const partnerResults = await findRecordsByField('Partners', 'partner_code', partner_code);
  if (partnerResults.length === 0) throw new Error(`找不到夥伴: ${partner_code}`);
  const partner = partnerResults[0];

  const currentAvailable = parseInt(partner.data.available_points || 0);
  const currentUsed = parseInt(partner.data.points_used || 0);
  const refundPoints = parseInt(refund_amount || 0);

  const updates = {
    available_points: currentAvailable + refundPoints,
    points_used: Math.max(0, currentUsed - refundPoints)
  };

  await updateRecord('Partners', partner_code, updates);

  if (usageRecord) {
    await updateRecord('Accommodation_Usage', usage_id, {
      usage_type: 'REFUNDED',
      notes: (usageRecord.data.notes || '') + `\n[退款於 ${new Date().toISOString()}] ${reason || ''}`
    });
  }

  await createRecord('Payouts', {
    partner_code: partner_code,
    payout_type: 'POINTS_REFUND',
    amount: refundPoints,
    payout_status: 'COMPLETED',
    notes: `住宿金退款: ${reason || ''}`,
    created_by: 'SYSTEM'
  });

  return {
    success: true, message: `成功退回 ${refundPoints} 點`,
    data: { refunded_points: refundPoints, new_available: updates.available_points, new_used: updates.points_used }
  };
}

async function handleRestoreBooking(data) {
  const bookingId = data.booking_id || data.id;
  if (!bookingId) throw new Error('缺少 booking_id');

  const booking = await findRecordById('Bookings', bookingId);
  if (!booking) throw new Error(`找不到訂房: ${bookingId}`);
  if (booking.data.stay_status !== 'CANCELLED') throw new Error(`訂房不是取消狀態: ${booking.data.stay_status}`);

  const restoreData = {
    stay_status: data.new_status || 'PENDING',
    commission_status: 'PENDING',
    notes: (booking.data.notes || '') + `\n[恢復於 ${new Date().toISOString()}] ${data.reason || ''}`
  };

  await updateRecord('Bookings', bookingId, restoreData);

  if (data.new_status === 'COMPLETED' || data.confirm_immediately) {
    return await handleConfirmCheckinCompletion({
      booking_id: bookingId, confirmed_by: data.restored_by || 'SYSTEM', _restored: true
    });
  }

  if (booking.data.partner_code) {
    await createRecord('Payouts', {
      partner_code: booking.data.partner_code,
      payout_type: 'BOOKING_RESTORED',
      amount: 0,
      related_booking_ids: bookingId,
      payout_status: 'INFO',
      notes: `訂房恢復: ${data.reason || ''}`,
      created_by: data.restored_by || 'SYSTEM'
    });
  }

  return { success: true, message: '訂房已恢復' };
}

async function handlePartialRefund(data) {
  const booking_id = data.booking_id;
  const reason = data.reason || '';
  if (!booking_id) throw new Error('需要 booking_id');

  const booking = await findRecordById('Bookings', booking_id);
  if (!booking) throw new Error(`找不到訂房: ${booking_id}`);

  const oldPrice = parseFloat(booking.data.room_price || 0);

  let newPrice;
  if (data.refund_amount !== undefined) {
    const refundAmount = parseFloat(data.refund_amount);
    if (refundAmount <= 0) throw new Error('退款金額必須大於 0');
    newPrice = oldPrice - refundAmount;
  } else if (data.new_room_price !== undefined) {
    newPrice = parseFloat(data.new_room_price);
  } else {
    throw new Error('需要 refund_amount 或 new_room_price');
  }

  const priceDiff = oldPrice - newPrice;
  if (priceDiff <= 0) throw new Error('退款後價格必須低於原價格');

  await updateRecord('Bookings', booking_id, {
    room_price: newPrice,
    notes: (booking.data.notes || '') + `\n[部分退款 ${priceDiff} 於 ${new Date().toISOString()}] ${reason}`
  });

  await createRecord('Payouts', {
    partner_code: booking.data.partner_code,
    payout_type: 'PARTIAL_REFUND',
    amount: 0,
    related_booking_ids: booking_id,
    payout_status: 'COMPLETED',
    notes: `部分退款 - 房價: ${oldPrice} → ${newPrice}，退款 NT$ ${priceDiff}`,
    created_by: data.adjusted_by || 'SYSTEM'
  });

  return {
    success: true, message: '部分退款處理成功',
    data: { old_price: oldPrice, new_price: newPrice, price_diff: priceDiff }
  };
}

async function handleBatchCancel(data) {
  const { booking_ids, reason } = data;
  if (!booking_ids || !Array.isArray(booking_ids)) throw new Error('需要 booking_ids 陣列');

  const results = { success: [], failed: [] };

  for (const bookingId of booking_ids) {
    try {
      const result = await handleDeleteBooking({ booking_id: bookingId, _batch: true });
      if (result.success) results.success.push(bookingId);
      else results.failed.push({ id: bookingId, error: result.error });
    } catch (err) {
      results.failed.push({ id: bookingId, error: err.message });
    }
  }

  return {
    success: results.failed.length === 0,
    message: `成功取消 ${results.success.length} 筆訂房`,
    data: results
  };
}

// ========================================
// 大使登入 & 儀表板
// ========================================

async function handleVerifyPartnerLogin(data) {
  const loginIdentifier = (data.login_identifier || data.partner_code || '').trim();
  const phoneLast4 = (data.phone_last4 || '').trim();

  if (!loginIdentifier || !phoneLast4) return { success: false, error: '請提供 Email 或大使代碼，以及手機末4碼' };
  if (!/^\d{4}$/.test(phoneLast4)) return { success: false, error: '手機末4碼必須是4位數字' };

  const candidates = await findPartnersByLoginIdentifier(loginIdentifier);
  if (candidates.length === 0) return { success: false, error: '登入資訊不正確' };

  const partner = candidates.find(candidate => {
    const contactPhone = String(candidate.contact_phone || candidate.phone || '');
    return contactPhone.length >= 4 && contactPhone.slice(-4) === phoneLast4;
  });

  if (!partner) return { success: false, error: '登入資訊不正確' };
  if (partner.is_active === false) return { success: false, error: '此大使帳號已停用，請聯繫管理員協助' };

  // 計算點擊數
  let totalClicks = 0;
  try {
    const clicks = await db.getAllRecords('Clicks');
    for (const click of clicks) {
      if (click.partner_code === partner.partner_code) totalClicks++;
    }
  } catch (e) { console.error('Error loading clicks for login:', e); }

  return {
    success: true,
    partner: {
      partner_code: partner.partner_code,
      name: partner.name || partner.partner_name || '',
      level: partner.level || partner.partner_level || 'LV1_INSIDER',
      total_commission_earned: parseFloat(partner.total_commission_earned) || 0,
      total_commission_paid: parseFloat(partner.total_commission_paid) || 0,
      pending_commission: parseFloat(partner.pending_commission) || 0,
      available_points: parseFloat(partner.available_points) || 0,
      points_used: parseFloat(partner.points_used) || 0,
      commission_preference: partner.commission_preference || 'ACCOMMODATION',
      total_successful_referrals: parseInt(partner.successful_referrals || partner.total_successful_referrals) || 0,
      yearly_referrals: parseInt(partner.yearly_referrals) || 0,
      short_landing_link: partner.short_landing_link || '',
      short_coupon_link: partner.short_coupon_link || '',
      coupon_code: partner.coupon_code || '',
      total_clicks: totalClicks
    }
  };
}

async function handleGetPartnerDashboardData(data) {
  const partnerCodeInput = (data.partner_code || '').trim();
  if (!partnerCodeInput) return { success: false, error: 'partner_code is required' };

  const partner = await findPartnerByCodeCaseInsensitive(partnerCodeInput);
  if (!partner) return { success: false, error: 'Partner not found' };
  if (partner.is_active === false) return { success: false, error: '此大使帳號已停用' };

  const partnerCode = partner.partner_code;

  // 1. 訂房記錄
  const bookings = [];
  try {
    const allBookings = await db.getAllRecords('Bookings');
    for (const row of allBookings) {
      if (row.partner_code === partnerCode) {
        bookings.push({
          id: row.id, guest_name: maskName(row.guest_name),
          checkin_date: row.checkin_date, checkout_date: row.checkout_date,
          room_price: row.room_price, booking_source: row.booking_source,
          stay_status: row.stay_status, payment_status: row.payment_status,
          commission_status: row.commission_status, commission_amount: row.commission_amount,
          commission_type: row.commission_type, is_first_referral_bonus: row.is_first_referral_bonus,
          first_referral_bonus_amount: row.first_referral_bonus_amount,
          notes: row.notes, created_at: row.created_at
        });
      }
    }
  } catch (e) { console.error('Error loading bookings:', e); }

  // 2. 結算記錄
  const payouts = [];
  try {
    const allPayouts = await db.getAllRecords('Payouts');
    for (const row of allPayouts) {
      if (row.partner_code === partnerCode) {
        payouts.push({
          id: row.id, payout_type: row.payout_type, amount: row.amount,
          payout_method: row.payout_method, payout_status: row.payout_status,
          notes: row.notes, created_at: row.created_at
        });
      }
    }
  } catch (e) { console.error('Error loading payouts:', e); }

  // 3. 住宿金使用記錄
  const accommodationUsage = [];
  try {
    const allUsage = await db.getAllRecords('Accommodation_Usage');
    for (const row of allUsage) {
      if (row.partner_code === partnerCode) {
        accommodationUsage.push({
          id: row.id, deduct_amount: row.deduct_amount, usage_date: row.usage_date,
          usage_type: row.usage_type, notes: row.notes, created_at: row.created_at
        });
      }
    }
  } catch (e) { console.error('Error loading accommodation usage:', e); }

  // 4. 點擊統計
  let totalClicks = 0;
  try {
    const allClicks = await db.getAllRecords('Clicks');
    for (const click of allClicks) {
      if (click.partner_code === partnerCode) totalClicks++;
    }
  } catch (e) { console.error('Error loading clicks:', e); }

  return {
    success: true,
    partner: {
      partner_code: partner.partner_code,
      name: partner.name || partner.partner_name || '',
      level: partner.level || partner.partner_level || 'LV1_INSIDER',
      total_commission_earned: parseFloat(partner.total_commission_earned) || 0,
      total_commission_paid: parseFloat(partner.total_commission_paid) || 0,
      pending_commission: parseFloat(partner.pending_commission) || 0,
      available_points: parseFloat(partner.available_points) || 0,
      points_used: parseFloat(partner.points_used) || 0,
      commission_preference: partner.commission_preference || 'ACCOMMODATION',
      total_successful_referrals: parseInt(partner.successful_referrals || partner.total_successful_referrals) || 0,
      yearly_referrals: parseInt(partner.yearly_referrals) || 0,
      short_landing_link: partner.short_landing_link || '',
      short_coupon_link: partner.short_coupon_link || '',
      coupon_code: partner.coupon_code || '',
      total_clicks: totalClicks
    },
    bookings, payouts, accommodation_usage: accommodationUsage
  };
}

// ========================================
// 路由函數
// ========================================

// ========================================
// 申請管理
// ========================================

const APPLICATION_SHEET = 'Applications';
const APPLICATION_HEADERS = DataModels.Application.fields;

async function ensureApplicationsSheet() {
  await db.ensureTable(APPLICATION_SHEET, APPLICATION_HEADERS);
}

async function handleSubmitApplication(data) {
  await ensureApplicationsSheet();

  if (!data.name || !data.email || !data.phone) {
    throw new Error('姓名、Email 與聯絡電話為必填欄位');
  }

  // 字串清理 & 截斷
  const name = String(data.name).trim().slice(0, 50);
  const email = String(data.email).trim().slice(0, 100);
  const lineName = String(data.line_name || '').trim().slice(0, 50);
  const phone = String(data.phone || '').trim().slice(0, 20);
  const message = String(data.message || '').trim().slice(0, 500);
  const referralSource = String(data.referral_source || '').trim().slice(0, 100);
  const socialProfile = String(data.social_profile || '').trim().slice(0, 200);
  const bankName = String(data.bank_name || '').trim().slice(0, 50);
  const bankCode = String(data.bank_code || '').trim().slice(0, 10);
  const bankBranch = String(data.bank_branch || '').trim().slice(0, 50);
  const bankAccountName = String(data.bank_account_name || '').trim().slice(0, 50);
  const bankAccountNumber = String(data.bank_account_number || '').trim().slice(0, 30);

  // Email 格式驗證
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Email 格式不正確');
  }

  if (!phone) {
    throw new Error('聯絡電話為必填欄位');
  }

  // 推薦來源必填
  if (!referralSource) {
    throw new Error('推薦來源為必填欄位');
  }

  // 同 email 防重複（檢查是否已有 PENDING 申請）
  const existingApps = await db.getAllRecords(APPLICATION_SHEET);
  for (const row of existingApps) {
    if (row.email && row.email.toLowerCase() === email.toLowerCase() && row.application_status === 'PENDING') {
      throw new Error('您已有一筆待審核的申請，請耐心等候');
    }
  }

  const applicationData = {
    name,
    email,
    line_name: lineName,
    phone,
    message,
    referral_source: referralSource,
    social_profile: socialProfile,
    bank_name: bankName,
    bank_code: bankCode,
    bank_branch: bankBranch,
    bank_account_name: bankAccountName,
    bank_account_number: bankAccountNumber,
    application_status: 'PENDING',
    review_notes: '',
    reviewed_by: '',
    reviewed_at: '',
    partner_code_assigned: '',
    partner_link_sent: false
  };

  const record = await createRecord(APPLICATION_SHEET, applicationData);
  return { success: true, message: '申請已成功提交', id: record.id };
}

async function handleGetApplications(data) {
  await ensureApplicationsSheet();

  const allApps = await db.getAllRecords(APPLICATION_SHEET);

  const statusFilter = data.status_filter || 'ALL';
  const filtered = statusFilter === 'ALL'
    ? allApps
    : allApps.filter(app => app.application_status === statusFilter);

  const counts = {
    pending: allApps.filter(a => a.application_status === 'PENDING').length,
    approved: allApps.filter(a => a.application_status === 'APPROVED').length,
    rejected: allApps.filter(a => a.application_status === 'REJECTED').length
  };

  return { success: true, data: filtered, total_count: allApps.length, counts };
}

async function handleReviewApplication(data) {
  await ensureApplicationsSheet();

  const appId = data.application_id;
  const status = data.status;

  if (!appId) throw new Error('application_id 為必填');
  if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
    throw new Error('status 必須為 APPROVED 或 REJECTED');
  }

  const record = await findRecordById(APPLICATION_SHEET, appId);
  if (!record) throw new Error('找不到該申請記錄');

  if (record.data.application_status !== 'PENDING') {
    throw new Error('該申請已審核過，無法重複審核');
  }

  await updateRecord(APPLICATION_SHEET, appId, {
    application_status: status,
    review_notes: data.review_notes || '',
    reviewed_by: data.reviewed_by || 'admin',
    reviewed_at: new Date().toISOString()
  });

  return { success: true, message: `申請已${status === 'APPROVED' ? '核准' : '拒絕'}` };
}

// ===== Email 通知（Resend REST API）=====
async function sendWelcomeEmail({ email, name, partnerCode, shortLandingLink, shortCouponLink, phone, couponCode }) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.NOTIFICATION_FROM_EMAIL || 'onboarding@resend.dev';
  if (!apiKey) {
    console.log('RESEND_API_KEY not set, skipping welcome email');
    return;
  }

  const phoneLast4 = (phone || '').slice(-4);
  const dashboardUrl = 'https://forest-ambassador.vercel.app/frontend/partner-login.html';
  const couponCodeDisplay = couponCode || '';
  // 稱呼：取姓氏後加上柔和稱呼，避免直呼全名
  const displayName = name ? name.charAt(0) + (name.length > 1 ? name.slice(1) : '') : '';
  const greeting = displayName || '你好';

  const html = `
    <div style="font-family: 'Noto Sans TC', 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 32px; background: #FDFBF8; color: #5C544B; line-height: 1.8;">
      <div style="text-align: center; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 1px solid #E8E4DF;">
        <h1 style="font-family: 'Noto Serif TC', Georgia, serif; color: #2E4B36; font-size: 22px; margin: 0 0 6px; font-weight: 500; letter-spacing: 0.05em;">歡迎加入知音計畫</h1>
        <p style="color: #A09890; font-size: 13px; margin: 0;">靜謐森林 · 知音大使</p>
      </div>

      <p style="margin: 0 0 16px;">${greeting}，</p>
      <p style="margin: 0 0 24px;">很高興你加入了靜謐森林的知音計畫。接下來，讓我們一起把森林裡的寧靜與美好，分享給更多人。</p>

      <div style="background: #F5F0EB; padding: 20px 24px; border-radius: 12px; margin: 0 0 28px;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #8B8178; margin: 0 0 12px; font-weight: 600;">你的專屬資訊</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #8B8178; width: 110px;">大使代碼</td><td style="padding: 6px 0; color: #2E4B36; font-weight: 500;">${partnerCode}</td></tr>
          ${couponCodeDisplay ? `<tr><td style="padding: 6px 0; color: #8B8178;">對外優惠碼</td><td style="padding: 6px 0; color: #2E4B36; font-weight: 500;">${couponCodeDisplay}</td></tr>` : ''}
          <tr><td style="padding: 6px 0; color: #8B8178;">推薦連結</td><td style="padding: 6px 0;"><a href="${shortLandingLink}" style="color: #2E4B36; text-decoration: underline;">${shortLandingLink}</a></td></tr>
          <tr><td style="padding: 6px 0; color: #8B8178;">優惠券連結</td><td style="padding: 6px 0;"><a href="${shortCouponLink}" style="color: #2E4B36; text-decoration: underline;">${shortCouponLink}</a></td></tr>
        </table>
      </div>

      <div style="background: #F0F5F0; padding: 20px 24px; border-radius: 12px; margin: 0 0 28px;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #2E4B36; margin: 0 0 12px; font-weight: 600;">登入你的儀表板</p>
        <p style="margin: 0 0 8px; font-size: 14px;">前往 <a href="${dashboardUrl}" style="color: #2E4B36; font-weight: 500;">${dashboardUrl}</a></p>
        <p style="margin: 0; font-size: 14px; color: #6B6560;">使用 Email 或大使代碼，搭配手機末 4 碼（${phoneLast4}）即可登入。</p>
      </div>

      <div style="background: #FAF6F0; padding: 20px 24px; border-radius: 12px; margin: 0 0 28px; border: 1px solid #E8DFD4;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #92400E; margin: 0 0 10px; font-weight: 600;">綁定 LINE 帳號</p>
        <p style="margin: 0; font-size: 14px; color: #6B6560;">
          登入儀表板後，點擊「綁定 LINE 帳號」按鈕即可一鍵完成綁定。<br>
          綁定後可直接從 LINE 開啟儀表板，免輸入帳密，也能收到結算通知。
        </p>
      </div>

      <p style="font-size: 14px; color: #6B6560; margin: 0 0 8px;">如有任何疑問，歡迎透過 LINE 官方帳號 <strong style="color:#2E4B36;">@forest.house</strong> 與我們聯繫。</p>

      <div style="text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #E8E4DF;">
        <p style="color: #A09890; font-size: 12px; margin: 0; letter-spacing: 0.05em;">靜謐森林 — 知音計畫</p>
      </div>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `靜謐森林知音計畫 <${fromEmail}>`,
      to: [email],
      subject: `歡迎加入知音計畫！您的大使代碼：${partnerCode}`,
      html
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend API error: ${response.status} ${err}`);
  }
  console.log(`Welcome email sent to ${email}`);
}

async function handlePromoteToPartner(data) {
  await ensureApplicationsSheet();

  const appId = data.application_id;
  const partnerCode = data.partner_code;
  const couponCode = String(data.coupon_code || '').trim();

  if (!appId) throw new Error('application_id 為必填');
  if (!partnerCode) throw new Error('partner_code 為必填');
  if (!couponCode) throw new Error('coupon_code 為必填');

  if (!/^[A-Za-z0-9]{3,20}$/.test(partnerCode)) {
    throw new Error('大使代碼只能包含英文字母與數字，3-20 字元');
  }
  if (couponCode.toLowerCase() === partnerCode.toLowerCase()) {
    throw new Error('優惠券代碼不可與大使代碼相同');
  }

  const record = await findRecordById(APPLICATION_SHEET, appId);
  if (!record) throw new Error('找不到該申請記錄');

  if (record.data.application_status !== 'APPROVED') {
    throw new Error('僅核准的申請可轉為大使');
  }

  const existing = await findPartnerByCode(partnerCode);
  if (existing) throw new Error('大使代碼已被使用: ' + partnerCode);
  if (!record.data.phone) throw new Error('申請資料缺少聯絡電話，請先補齊再建立大使');

  const baseUrl = GITHUB_PAGES_URL.replace('/frontend/index.html', '');
  const landingLink = `${baseUrl}/api?dest=landing&pid=${partnerCode}`;
  const couponLink = `${baseUrl}/api?dest=coupon&pid=${partnerCode}`;
  // 優惠券 URL 解析順序：coupon_template_id → coupon_url → 預設模板 → DEFAULT_LINE_COUPON_URL
  let couponUrl = DEFAULT_LINE_COUPON_URL;
  if (data.coupon_template_id) {
    try {
      const tpl = await findRecordById('Coupon_Templates', data.coupon_template_id);
      const tplData = tpl?.data || tpl;
      if (tplData && tplData.coupon_url) couponUrl = tplData.coupon_url;
    } catch (e) { console.error('coupon template lookup failed:', e.message); }
  } else if (data.coupon_url) {
    couponUrl = data.coupon_url;
  } else {
    try {
      const allTemplates = await db.getAllRecords('Coupon_Templates');
      const defaultTpl = allTemplates.find(t => {
        const d = t.data || t;
        return d.is_default === true || d.is_default === 'true';
      });
      const dData = defaultTpl?.data || defaultTpl;
      if (dData && dData.coupon_url) couponUrl = dData.coupon_url;
    } catch (e) { /* fallback to DEFAULT_LINE_COUPON_URL */ }
  }
  const [shortLandingLink, shortCouponLink] = await Promise.all([
    createShortUrl(landingLink),
    createShortUrl(couponLink)
  ]);

  const partnerData = {
    partner_code: partnerCode,
    name: record.data.name || '',
    email: record.data.email || '',
    phone: record.data.phone || '',
    level: 'LV1_INSIDER',
    level_progress: 0,
    total_successful_referrals: 0,
    commission_preference: 'ACCOMMODATION',
    total_commission_earned: 0,
    total_commission_paid: 0,
    pending_commission: 0,
    coupon_code: couponCode,
    line_coupon_url: couponUrl,
    coupon_url: couponUrl,
    landing_link: landingLink,
    coupon_link: couponLink,
    short_landing_link: shortLandingLink,
    short_coupon_link: shortCouponLink,
    available_points: 0,
    points_used: 0,
    bank_account: record.data.bank_account_number || '',
    bank_code: record.data.bank_code || '',
    bank_name: record.data.bank_name || '',
    bank_branch: record.data.bank_branch || '',
    bank_account_name: record.data.bank_account_name || '',
    yearly_referrals: 0,
    base_level_for_year: 'LV1_INSIDER',
    yearly_referrals_year: getBusinessYear(),
    level_achieved_at: getStartOfYearDate(getBusinessYear()),
    level_valid_until: getEndOfYearDate(getBusinessYear()),
    last_level_review_year: getBusinessYear() - 1,
    notes: `從申請 #${appId} 轉入`,
    is_active: true,
    contact_phone: record.data.phone || '',
    contact_email: record.data.email || ''
  };

  const partner = await createRecord('Partners', partnerData);

  await updateRecord(APPLICATION_SHEET, appId, {
    partner_code_assigned: partnerCode,
    partner_link_sent: true
  });

  // 發送歡迎 Email（失敗不阻擋流程）
  try {
    await sendWelcomeEmail({
      email: partnerData.email,
      name: partnerData.name,
      partnerCode,
      shortLandingLink,
      shortCouponLink,
      phone: partnerData.phone,
      couponCode
    });
  } catch (emailErr) {
    console.error('Welcome email failed:', emailErr.message);
  }

  return {
    success: true,
    message: '已成功轉為正式大使',
    partner_code: partnerCode,
    landing_link: landingLink,
    coupon_link: couponLink,
    short_landing_link: shortLandingLink,
    short_coupon_link: shortCouponLink,
    line_coupon_provision: {
      success: hasSharedLineCouponConfigured(),
      skipped: true,
      mode: 'shared_coupon_claim',
      shared_coupon_id_configured: hasSharedLineCouponConfigured()
    }
  };
}

// ========================================
// 優惠券模板 CRUD
// ========================================

const COUPON_TEMPLATE_TABLE = 'Coupon_Templates';

async function handleCreateCouponTemplate(data) {
  if (!data.coupon_name) throw new Error('coupon_name 為必填');

  const createOnLine = data.create_on_line === true || data.create_on_line === 'true';
  let lineCouponId = data.line_coupon_id || '';
  let couponUrl = data.coupon_url || '';
  let lineResult = null;

  // 同步建立 LINE 券
  if (createOnLine) {
    if (!hasLineCouponApiConfigured()) throw new Error('LINE API 未設定（缺少 LINE_CHANNEL_ACCESS_TOKEN）');

    const { startTimestamp, endTimestamp } = buildLineCouponTimestamps();
    const linePayload = {
      title: data.coupon_name,
      description: data.coupon_description || data.coupon_name,
      acquisitionCondition: { type: 'normal' },
      maxUseCountPerTicket: 1,
      startTimestamp,
      endTimestamp,
      timezone: LINE_COUPON_TIMEZONE,
      reward: { type: 'gift' },
      visibility: LINE_COUPON_VISIBILITY,
      usageCondition: data.usage_condition || DEFAULT_LINE_COUPON_USAGE_CONDITION
    };
    if (data.image_url || LINE_COUPON_IMAGE_URL) {
      linePayload.imageUrl = data.image_url || LINE_COUPON_IMAGE_URL;
    }

    lineResult = await callLineApi('POST', '/v2/bot/coupon', linePayload);
    if (lineResult && lineResult.couponId) {
      lineCouponId = lineResult.couponId;
    }
    if (lineResult && lineResult.couponUrl) {
      couponUrl = couponUrl || lineResult.couponUrl;
    }
  }

  if (!couponUrl && !createOnLine) throw new Error('coupon_url 為必填（或勾選「同步建立 LINE 券」）');

  // 若設為預設，先清除其他預設
  if (data.is_default === true || data.is_default === 'true') {
    await clearDefaultCouponTemplates();
  }

  const record = await createRecord(COUPON_TEMPLATE_TABLE, {
    coupon_name: data.coupon_name,
    coupon_url: couponUrl,
    coupon_description: data.coupon_description || '',
    line_coupon_id: lineCouponId,
    is_default: data.is_default === true || data.is_default === 'true',
    is_active: true
  });

  return {
    success: true,
    message: createOnLine ? '優惠券模板已建立，LINE 券已同步建立' : '優惠券模板已建立',
    data: record,
    line_coupon: lineResult || null
  };
}

async function handleUpdateCouponTemplate(data) {
  const templateId = data.template_id || data.id;
  if (!templateId) throw new Error('template_id 為必填');

  const existing = await findRecordById(COUPON_TEMPLATE_TABLE, templateId);
  if (!existing) throw new Error('找不到該優惠券模板');

  // 若設為預設，先清除其他預設
  if (data.is_default === true || data.is_default === 'true') {
    await clearDefaultCouponTemplates();
  }

  const updates = {};
  if (data.coupon_name !== undefined) updates.coupon_name = data.coupon_name;
  if (data.coupon_url !== undefined) updates.coupon_url = data.coupon_url;
  if (data.coupon_description !== undefined) updates.coupon_description = data.coupon_description;
  if (data.line_coupon_id !== undefined) updates.line_coupon_id = data.line_coupon_id;
  if (data.is_default !== undefined) updates.is_default = data.is_default === true || data.is_default === 'true';
  if (data.is_active !== undefined) updates.is_active = data.is_active === true || data.is_active === 'true';

  const updated = await updateRecord(COUPON_TEMPLATE_TABLE, templateId, updates);
  return { success: true, message: '優惠券模板已更新', data: updated };
}

async function handleDeleteCouponTemplate(data) {
  const templateId = data.template_id || data.id;
  if (!templateId) throw new Error('template_id 為必填');

  const existing = await findRecordById(COUPON_TEMPLATE_TABLE, templateId);
  if (!existing) throw new Error('找不到該優惠券模板');

  await updateRecord(COUPON_TEMPLATE_TABLE, templateId, { is_active: false });
  return { success: true, message: '優惠券模板已停用' };
}

async function clearDefaultCouponTemplates() {
  try {
    const all = await db.getAllRecords(COUPON_TEMPLATE_TABLE);
    for (const t of all) {
      const d = t.data || t;
      const id = t.id || t.rowIndex;
      if (d.is_default === true || d.is_default === 'true') {
        await updateRecord(COUPON_TEMPLATE_TABLE, id, { is_default: false });
      }
    }
  } catch (e) {
    console.error('clearDefaultCouponTemplates error:', e.message);
  }
}

function getRawBodyFromRequest(req) {
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return '';
}

async function resolveLineCouponIdForPartner(partner) {
  // 查大使的 coupon_url 對應的優惠券範本，取其 line_coupon_id
  const partnerCouponUrl = partner.coupon_url || partner.line_coupon_url || '';
  if (!partnerCouponUrl) return '';
  try {
    const allTemplates = await db.getAllRecords(COUPON_TEMPLATE_TABLE);
    for (const t of allTemplates) {
      const d = t.data || t;
      if (d.is_active === false || d.is_active === 'false') continue;
      if (d.coupon_url === partnerCouponUrl && d.line_coupon_id) {
        return d.line_coupon_id;
      }
    }
  } catch (e) {
    console.error('resolveLineCouponIdForPartner error:', e.message);
  }
  return '';
}

async function resolveCouponTemplateForPartner(partner) {
  const partnerCouponUrl = partner.coupon_url || partner.line_coupon_url || '';
  if (!partnerCouponUrl) return null;
  try {
    const allTemplates = await db.getAllRecords(COUPON_TEMPLATE_TABLE);
    for (const t of allTemplates) {
      const d = t.data || t;
      if (d.is_active === false || d.is_active === 'false') continue;
      if (d.coupon_url === partnerCouponUrl) return d;
    }
  } catch (e) {
    console.error('resolveCouponTemplateForPartner error:', e.message);
  }
  return null;
}

async function replyLineCoupon(replyToken, couponIdOrUrl, template) {
  if (!replyToken) return;

  // 優先用 Flex Message 發送優惠券連結（相容 LINE Official Account 後台建立的券）
  const couponUrl = (template && template.coupon_url) || couponIdOrUrl || '';
  const couponName = (template && template.coupon_name) || '森林專屬優惠';
  const couponDesc = (template && template.coupon_description) || '點擊下方按鈕領取優惠券';

  if (couponUrl && couponUrl.startsWith('http')) {
    await callLineApi('POST', '/v2/bot/message/reply', {
      replyToken,
      messages: [{
        type: 'flex',
        altText: `${couponName} — 點擊領取`,
        contents: {
          type: 'bubble',
          size: 'kilo',
          header: {
            type: 'box', layout: 'vertical', paddingAll: '16px',
            backgroundColor: '#2E4B36',
            contents: [
              { type: 'text', text: '靜謐森林', size: 'xs', color: '#C5A065', weight: 'bold' },
              { type: 'text', text: couponName, size: 'md', color: '#FFFFFF', weight: 'bold', margin: 'xs' }
            ]
          },
          body: {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
            contents: [
              { type: 'text', text: couponDesc, size: 'sm', color: '#555555', wrap: true }
            ]
          },
          footer: {
            type: 'box', layout: 'vertical', paddingAll: '12px',
            contents: [{
              type: 'button', style: 'primary', color: '#2E4B36',
              action: { type: 'uri', label: '領取優惠券', uri: couponUrl }
            }]
          }
        }
      }]
    });
    return;
  }

  // Fallback: 用 coupon message type（僅適用於 Messaging API 建立的券）
  if (couponIdOrUrl) {
    await callLineApi('POST', '/v2/bot/message/reply', {
      replyToken,
      messages: [{ type: 'coupon', couponId: couponIdOrUrl }]
    });
  }
}

async function handleLineWebhook(req, res) {
  const rawBody = getRawBodyFromRequest(req);
  const signature = req.headers['x-line-signature'] || req.headers['X-Line-Signature'];

  if (canVerifyLineWebhookSignature() && !verifyLineSignature(rawBody, signature)) {
    return res.status(401).json({ success: false, error: 'Invalid LINE signature' });
  }

  const events = Array.isArray(req.body && req.body.events) ? req.body.events : [];

  for (const event of events) {
    if (!event || event.type !== 'message' || !event.message || event.message.type !== 'text' || !event.replyToken) {
      continue;
    }

    // ===== 大使 LINE 配對：#綁定 大使代碼 =====
    const bindMatch = (event.message.text || '').match(/^#綁定\s+(.+)/);
    if (bindMatch) {
      const bindCode = bindMatch[1].trim();
      const lineUserId = event.source && event.source.userId ? event.source.userId : '';
      if (!lineUserId) {
        await callLineApi('POST', '/v2/bot/message/reply', {
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: '無法取得您的 LINE 帳號資訊，請稍後再試。' }]
        });
        continue;
      }
      try {
        const partner = await findPartnerByCode(bindCode);
        if (!partner) {
          await callLineApi('POST', '/v2/bot/message/reply', {
            replyToken: event.replyToken,
            messages: [{ type: 'text', text: `查無大使代碼「${bindCode}」，請確認後重試。` }]
          });
          continue;
        }
        const sourceProfile = await fetchLineProfileForEventSource(event.source || {});
        const displayName = String(sourceProfile && sourceProfile.displayName || '').trim();
        const bindUpdates = { line_user_id: lineUserId };
        try {
          if (displayName) bindUpdates.line_display_name = displayName;
          await updateRecord('Partners', partner.partner_code, bindUpdates);
        } catch (updateErr) {
          // line_display_name 欄位可能不存在，退回只更新 line_user_id
          if (String(updateErr.message).includes('line_display_name')) {
            await updateRecord('Partners', partner.partner_code, { line_user_id: lineUserId });
          } else {
            throw updateErr;
          }
        }

        const dashboardUrl = lineUserId ? generateLineDashboardUrl(lineUserId) : DASHBOARD_BASE_URL;

        // 先嘗試 Flex Message，失敗則降級為純文字
        try {
          const footerButtons = [
            { type: 'button', style: 'primary', color: '#2E4B36', action: { type: 'uri', label: '查看我的儀表板', uri: dashboardUrl } }
          ];
          const shareLink = partner.short_landing_link || partner.landing_link || '';
          if (shareLink && shareLink.startsWith('http')) {
            footerButtons.push({ type: 'button', style: 'link', color: '#2E4B36', action: { type: 'uri', label: '我的推薦連結', uri: shareLink } });
          }

          await callLineApi('POST', '/v2/bot/message/reply', {
            replyToken: event.replyToken,
            messages: [{
              type: 'flex',
              altText: `綁定成功！${partner.name || bindCode}，歡迎加入知音大使。`,
              contents: {
                type: 'bubble',
                size: 'kilo',
                header: {
                  type: 'box', layout: 'vertical', paddingAll: '16px',
                  backgroundColor: '#2E4B36',
                  contents: [
                    { type: 'text', text: '靜謐森林', size: 'xs', color: '#C5A065', weight: 'bold' },
                    { type: 'text', text: '帳號綁定成功', size: 'lg', color: '#FFFFFF', weight: 'bold', margin: 'sm' }
                  ]
                },
                body: {
                  type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'md',
                  contents: [
                    { type: 'text', text: `${partner.name || bindCode}，你好！`, size: 'sm', color: '#1d1d1f', weight: 'bold' },
                    { type: 'text', text: '你的 LINE 帳號已與大使身分綁定，日後可直接從這裡查看推薦成果。', size: 'sm', color: '#555555', wrap: true }
                  ]
                },
                footer: {
                  type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm',
                  contents: footerButtons
                }
              }
            }]
          });
        } catch (flexErr) {
          console.error('LINE bind flex reply failed, falling back to text:', flexErr.message);
          try {
            await callLineApi('POST', '/v2/bot/message/reply', {
              replyToken: event.replyToken,
              messages: [{ type: 'text', text: `綁定成功！${partner.name || bindCode}，你的 LINE 帳號已綁定。\n\n查看儀表板：${dashboardUrl}` }]
            });
          } catch (_) { /* replyToken already used */ }
        }
      } catch (bindErr) {
        console.error('LINE bind error:', bindErr.message, bindErr.stack);
        try {
          await callLineApi('POST', '/v2/bot/message/reply', {
            replyToken: event.replyToken,
            messages: [{ type: 'text', text: '配對過程發生錯誤，請稍後再試或聯繫客服。' }]
          });
        } catch (_) { /* replyToken may already be used */ }
      }
      continue;
    }

    const candidates = extractCouponKeywordCandidates(event.message.text);
    let matchedPartner = null;
    let matchedCode = '';
    for (const candidate of candidates) {
      matchedPartner = await findActivePartnerByCouponCode(candidate);
      if (matchedPartner) {
        matchedCode = candidate;
        break;
      }
    }

    if (!matchedPartner || !matchedCode) {
      continue;
    }

    const lineUserId = event.source && event.source.userId ? event.source.userId : '';

    // 偵測大使本人輸入自己的優惠碼
    if (lineUserId && matchedPartner.line_user_id && lineUserId === matchedPartner.line_user_id) {
      const dashboardUrl = generateLineDashboardUrl(lineUserId);
      const shareLink = matchedPartner.short_landing_link || matchedPartner.landing_link || '';
      await callLineApi('POST', '/v2/bot/message/reply', {
        replyToken: event.replyToken,
        messages: [{
          type: 'flex',
          altText: `${matchedPartner.name || matchedCode}，這是你的專屬優惠碼`,
          contents: {
            type: 'bubble',
            size: 'kilo',
            header: {
              type: 'box', layout: 'vertical', paddingAll: '16px',
              backgroundColor: '#2E4B36',
              contents: [
                { type: 'text', text: '靜謐森林 ・ 知音大使', size: 'xs', color: '#C5A065', weight: 'bold' },
                { type: 'text', text: '你的專屬優惠碼', size: 'md', color: '#FFFFFF', weight: 'bold', margin: 'xs' }
              ]
            },
            body: {
              type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
              contents: [
                { type: 'text', text: `${matchedPartner.name || ''}，這是你的對外優惠碼：`, size: 'sm', color: '#555555', wrap: true },
                { type: 'text', text: matchedPartner.coupon_code || matchedCode, size: 'xl', color: '#2E4B36', weight: 'bold', align: 'center', margin: 'md' },
                { type: 'text', text: '請將這組優惠碼分享給朋友，對方在此輸入即可領取優惠券，推薦也會自動記錄到你的帳戶。', size: 'xs', color: '#86868b', wrap: true, margin: 'md' }
              ]
            },
            footer: {
              type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm',
              contents: [
                { type: 'button', style: 'primary', color: '#2E4B36', action: { type: 'uri', label: '查看推薦成果', uri: dashboardUrl } },
                ...(shareLink ? [{ type: 'button', style: 'link', color: '#2E4B36', action: { type: 'uri', label: '分享推薦連結', uri: shareLink } }] : [])
              ]
            }
          }
        }]
      });
      continue;
    }

    const claimTimestamp = new Date().toISOString();
    const sourceProfile = await fetchLineProfileForEventSource(event.source || {});
    const resolvedDisplayName = String(
      sourceProfile && sourceProfile.displayName ||
      event.source && event.source.displayName ||
      ''
    ).trim();
    const claimKey = buildLineReferralClaimKey(lineUserId, event.message.id, matchedPartner.partner_code);
    const existingClaims = lineUserId
      ? await findRecordsByField(LINE_REFERRAL_CLAIM_TABLE, 'claim_key', claimKey).catch(() => [])
      : [];
    const existingClaim = existingClaims.length ? existingClaims[0].data : null;

    const claimResult = await upsertLineReferralClaim({
      ...(existingClaim || {}),
      claim_key: claimKey,
      line_user_id: lineUserId,
      line_source_type: event.source && event.source.type ? event.source.type : 'user',
      line_display_name: resolvedDisplayName || String(existingClaim && existingClaim.line_display_name || '').trim(),
      line_message_id: event.message.id || '',
      entered_code: matchedCode,
      partner_code: matchedPartner.partner_code,
      shared_coupon_id: LINE_SHARED_COUPON_ID,
      claim_status: DEFAULT_LINE_SHARED_CLAIM_STATUS,
      claim_count: toInt(existingClaim && existingClaim.claim_count, 0) + 1,
      coupon_reply_count: toInt(existingClaim && existingClaim.coupon_reply_count, 0),
      first_claimed_at: existingClaim && existingClaim.first_claimed_at ? existingClaim.first_claimed_at : claimTimestamp,
      last_claimed_at: claimTimestamp,
      last_reply_status: existingClaim && existingClaim.last_reply_status ? existingClaim.last_reply_status : '',
      last_error: ''
    });

    // 查詢大使對應的優惠券範本
    const couponTemplate = await resolveCouponTemplateForPartner(matchedPartner);
    const resolvedCouponId = (couponTemplate && couponTemplate.line_coupon_id) || LINE_SHARED_COUPON_ID || (couponTemplate && couponTemplate.coupon_url);

    if (!resolvedCouponId) {
      await upsertLineReferralClaim({
        ...(claimResult.data || {}),
        claim_key: claimKey,
        line_user_id: lineUserId,
        line_source_type: event.source && event.source.type ? event.source.type : 'user',
        line_display_name: resolvedDisplayName || String(claimResult.data && claimResult.data.line_display_name || '').trim(),
        line_message_id: event.message.id || '',
        entered_code: matchedCode,
        partner_code: matchedPartner.partner_code,
        shared_coupon_id: '',
        claim_status: DEFAULT_LINE_SHARED_CLAIM_STATUS,
        claim_count: toInt(claimResult.data && claimResult.data.claim_count, 1),
        coupon_reply_count: toInt(claimResult.data && claimResult.data.coupon_reply_count, 0),
        first_claimed_at: claimResult.data && claimResult.data.first_claimed_at ? claimResult.data.first_claimed_at : claimTimestamp,
        last_claimed_at: claimTimestamp,
        last_reply_status: 'NO_SHARED_COUPON',
        last_error: 'LINE coupon ID 未設定（範本無 line_coupon_id 且 LINE_SHARED_COUPON_ID 為空）'
      }).catch(err => console.error('Failed to persist missing shared coupon state:', err.message || err));
      continue;
    }

    try {
      await replyLineCoupon(event.replyToken, resolvedCouponId, couponTemplate);
      await upsertLineReferralClaim({
        ...(claimResult.data || {}),
        claim_key: claimKey,
        line_user_id: lineUserId,
        line_source_type: event.source && event.source.type ? event.source.type : 'user',
        line_display_name: resolvedDisplayName || String(claimResult.data && claimResult.data.line_display_name || '').trim(),
        line_message_id: event.message.id || '',
        entered_code: matchedCode,
        partner_code: matchedPartner.partner_code,
        shared_coupon_id: resolvedCouponId,
        claim_status: DEFAULT_LINE_SHARED_CLAIM_STATUS,
        claim_count: toInt(claimResult.data && claimResult.data.claim_count, 1),
        coupon_reply_count: toInt(claimResult.data && claimResult.data.coupon_reply_count, 0) + 1,
        first_claimed_at: claimResult.data && claimResult.data.first_claimed_at ? claimResult.data.first_claimed_at : claimTimestamp,
        last_claimed_at: claimTimestamp,
        last_replied_at: claimTimestamp,
        last_reply_status: 'SENT',
        last_error: ''
      });
    } catch (error) {
      await upsertLineReferralClaim({
        ...(claimResult.data || {}),
        claim_key: claimKey,
        line_user_id: lineUserId,
        line_source_type: event.source && event.source.type ? event.source.type : 'user',
        line_display_name: resolvedDisplayName || String(claimResult.data && claimResult.data.line_display_name || '').trim(),
        line_message_id: event.message.id || '',
        entered_code: matchedCode,
        partner_code: matchedPartner.partner_code,
        shared_coupon_id: LINE_SHARED_COUPON_ID,
        claim_status: DEFAULT_LINE_SHARED_CLAIM_STATUS,
        claim_count: toInt(claimResult.data && claimResult.data.claim_count, 1),
        coupon_reply_count: toInt(claimResult.data && claimResult.data.coupon_reply_count, 0),
        first_claimed_at: claimResult.data && claimResult.data.first_claimed_at ? claimResult.data.first_claimed_at : claimTimestamp,
        last_claimed_at: claimTimestamp,
        last_reply_status: 'FAILED',
        last_error: error.message || String(error),
      }).catch(err => console.error('Failed to persist LINE claim reply error:', err.message || err));
      console.error('LINE webhook reply failed:', error.message || error);
    }
  }

  return res.status(200).json({ success: true });
}

async function handleShortenUrl(data) {
  const url = data.url;
  if (!url) throw new Error('缺少 url 參數');
  const shortUrl = await createShortUrl(url);
  return { success: true, short_url: shortUrl };
}

// ========================================
// LINE 免登入 / LIFF 綁定
// ========================================
async function handleVerifyLineLogin(data) {
  const lineUserId = (data.line_user_id || '').trim();
  const sig = (data.sig || '').trim();
  if (!lineUserId || !sig) return { success: false, error: '缺少必要參數' };

  const expectedSig = generateLineLoginSig(lineUserId);
  if (sig !== expectedSig) return { success: false, error: '簽名驗證失敗' };

  const allPartners = await db.getAllRecords('Partners');
  const partner = allPartners.find(p => p.line_user_id === lineUserId && p.is_active !== false);
  if (!partner) return { success: false, error: '找不到對應的大使帳號' };

  return {
    success: true,
    partner: {
      partner_code: partner.partner_code,
      name: partner.name || partner.partner_name || '',
      level: partner.level || 'LV1_INSIDER',
      total_commission_earned: parseFloat(partner.total_commission_earned) || 0,
      pending_commission: parseFloat(partner.pending_commission) || 0,
      available_points: parseFloat(partner.available_points) || 0,
      points_used: parseFloat(partner.points_used) || 0,
      commission_preference: partner.commission_preference || 'ACCOMMODATION',
      total_successful_referrals: parseInt(partner.total_successful_referrals) || 0,
      yearly_referrals: parseInt(partner.yearly_referrals) || 0,
      line_user_id: partner.line_user_id,
      line_display_name: partner.line_display_name || ''
    }
  };
}

async function handleLineAutoLogin(data) {
  const accessToken = (data.access_token || '').trim();
  if (!accessToken) return { success: false, error: '缺少必要參數' };

  // 用 access token 向 LINE API 取得 user profile
  let lineProfile;
  try {
    const resp = await fetch('https://api.line.me/v2/profile', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!resp.ok) throw new Error(`LINE API ${resp.status}`);
    lineProfile = await resp.json();
  } catch (e) {
    return { success: false, error: 'LINE 身份驗證失敗' };
  }

  const lineUserId = lineProfile.userId;
  if (!lineUserId) return { success: false, error: 'LINE 身份驗證失敗' };

  // 查找已綁定此 LINE 帳號的 partner
  const allPartners = await db.getAllRecords('Partners');
  const partner = allPartners.find(p => p.line_user_id === lineUserId && p.is_active !== false);
  if (!partner) return { success: false, error: '此 LINE 帳號尚未綁定大使身份' };

  const dashboardUrl = generateLineDashboardUrl(lineUserId);
  return {
    success: true,
    dashboard_url: dashboardUrl,
    partner_name: partner.name || partner.partner_name || ''
  };
}

async function handleBindLineAccount(data) {
  const partnerCode = (data.partner_code || '').trim();
  const accessToken = (data.access_token || '').trim();
  if (!partnerCode || !accessToken) return { success: false, error: '缺少必要參數' };

  // 用 LIFF access token 向 LINE API 驗證取得真實 user profile
  let lineProfile;
  try {
    const resp = await fetch('https://api.line.me/v2/profile', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!resp.ok) throw new Error(`LINE API ${resp.status}`);
    lineProfile = await resp.json();
  } catch (e) {
    return { success: false, error: 'LINE 身份驗證失敗：' + e.message };
  }

  const lineUserId = lineProfile.userId;
  const lineDisplayName = lineProfile.displayName || '';
  if (!lineUserId) return { success: false, error: 'LINE 身份驗證失敗' };

  // 查找 partner
  const partner = await findPartnerByCodeCaseInsensitive(partnerCode);
  if (!partner) return { success: false, error: '找不到大使帳號' };
  if (partner.is_active === false) return { success: false, error: '此大使帳號已停用' };

  // 檢查此 LINE 帳號是否已綁定其他大使
  const allPartners = await db.getAllRecords('Partners');
  const existingBind = allPartners.find(p =>
    p.line_user_id === lineUserId &&
    p.partner_code !== partner.partner_code &&
    p.is_active !== false
  );
  if (existingBind) {
    return { success: false, error: `此 LINE 帳號已綁定到其他大使（${existingBind.partner_code}），請先解除綁定` };
  }

  // 更新 line_user_id
  await db.update('Partners', partner.partner_code, {
    line_user_id: lineUserId,
    line_display_name: lineDisplayName
  });

  // 回傳簽名 URL 供前端跳轉
  const dashboardUrl = generateLineDashboardUrl(lineUserId);

  // 透過 LINE Bot 發送綁定成功訊息（含簽名儀表板連結）
  if (LINE_CHANNEL_ACCESS_TOKEN) {
    try {
      await callLineApi('POST', '/v2/bot/message/push', {
        to: lineUserId,
        messages: [{
          type: 'flex',
          altText: `綁定成功！${partner.name || partnerCode}，點擊下方按鈕查看儀表板。`,
          contents: {
            type: 'bubble', size: 'kilo',
            header: {
              type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#2E4B36',
              contents: [
                { type: 'text', text: '靜謐森林', size: 'xs', color: '#C5A065', weight: 'bold' },
                { type: 'text', text: '帳號綁定成功', size: 'lg', color: '#FFFFFF', weight: 'bold', margin: 'sm' }
              ]
            },
            body: {
              type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'md',
              contents: [
                { type: 'text', text: `${lineDisplayName || partner.name || partnerCode}，你好！`, size: 'sm', color: '#1d1d1f', weight: 'bold' },
                { type: 'text', text: '你的 LINE 帳號已綁定成功。日後點擊下方按鈕即可直接查看儀表板，無需再輸入帳號密碼。', size: 'sm', color: '#555555', wrap: true }
              ]
            },
            footer: {
              type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm',
              contents: [
                { type: 'button', style: 'primary', color: '#2E4B36', action: { type: 'uri', label: '查看我的儀表板', uri: dashboardUrl } }
              ]
            }
          }
        }]
      });
    } catch (e) {
      console.error('LIFF bind push message failed:', e.message);
    }
  }

  return {
    success: true,
    message: '綁定成功',
    dashboard_url: dashboardUrl,
    line_display_name: lineDisplayName
  };
}

async function route(action, data) {
  // 公開 action（不需要 admin_secret）
  const PUBLIC_ACTIONS = new Set([
    'submit_application',
    'verify_partner_login',
    'get_partner_dashboard_data',
    'shorten_url',
    'verify_line_login',
    'bind_line_account',
    'line_auto_login'
  ]);

  // 管理類 action 需要 admin_secret 驗證
  if (!PUBLIC_ACTIONS.has(action)) {
    const adminSecret = process.env.ADMIN_SECRET;
    if (adminSecret && data.admin_secret !== adminSecret) {
      throw new Error('未授權的操作');
    }
  }

  const handlers = {
    'create_booking': handleCreateBooking,
    'update_booking': handleUpdateBooking,
    'delete_booking': handleDeleteBooking,
    'confirm_checkin_completion': handleConfirmCheckinCompletion,
    'create_payout': handleCreatePayout,
    'update_payout': handleUpdatePayout,
    'cancel_payout': handleCancelPayout,
    'process_payout': handleProcessPayout,
    'revert_cash_to_points': handleRevertCashToPoints,
    'update_partner': handleUpdatePartner,
    'update_partner_commission': handleUpdatePartnerCommission,
    'use_accommodation_points': handleUseAccommodationPoints,
    'deduct_accommodation_points': handleUseAccommodationPoints,
    'convert_points_to_cash': handleConvertPointsToCash,
    'get_all_data': handleGetAllData,
    'get_dashboard_data': handleGetAllData,
    'create_partner': handleCreatePartner,
    'delete_partner': handleDeletePartner,
    'get_click_stats': handleGetClickStats,
    'cancel_accommodation_usage': handleCancelAccommodationUsage,
    'restore_booking': handleRestoreBooking,
    'partial_refund': handlePartialRefund,
    'batch_cancel': handleBatchCancel,
    'verify_partner_login': handleVerifyPartnerLogin,
    'get_partner_dashboard_data': handleGetPartnerDashboardData,

    'submit_application': handleSubmitApplication,
    'get_applications': handleGetApplications,
    'review_application': handleReviewApplication,
    'promote_to_partner': handlePromoteToPartner,
    'sync_line_claim_profiles': syncLineClaimProfiles,
    'shorten_url': handleShortenUrl,
    'verify_line_login': handleVerifyLineLogin,
    'bind_line_account': handleBindLineAccount,
    'line_auto_login': handleLineAutoLogin,

    'create_coupon_template': handleCreateCouponTemplate,
    'update_coupon_template': handleUpdateCouponTemplate,
    'delete_coupon_template': handleDeleteCouponTemplate,
  };

  const handler = handlers[action];
  if (!handler) throw new Error('未知的動作: ' + action);
  return await handler(data);
}

module.exports = {
  route,
  handleRedirect,
  handleLineWebhook,
  __test__: {
    normalizeLevel,
    maxLevel,
    checkLevelUpgrade,
    reviewLevelForNextYear,
    getBusinessYear,
    getBookingLevelYear,
    groupPartnerCompletedBookings,
    buildLegacyLevelSnapshot,
    simulatePartnerLevelSnapshot,
    buildCompletedBookingLevelTimeline,
    sortLineClaimsNewestFirst,
    selectLatestLineReferralClaim,
    determineBookingAttribution
  }
};
