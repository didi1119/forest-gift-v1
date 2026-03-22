const fs = require('fs');
const path = require('path');

const apiBase = process.env.API_BASE || 'https://forest-ambassador.vercel.app/api';
const adminSecret = process.env.ADMIN_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!adminSecret || !supabaseUrl || !supabaseKey) throw new Error('Missing env');

const ts = Date.now();
const suffix = String(ts).slice(-6);
const codes = {
  lifecycle: `pl${suffix}`
};
const artifactFile = path.join('/tmp/codex-browser-test', `points-cash-lifecycle-${ts}.json`);

function log(...args) { console.log(new Date().toISOString(), ...args); }
function ensure(cond, msg) { if (!cond) throw new Error(msg); }

async function apiAction(action, payload) {
  const params = new URLSearchParams({ action, admin_secret: adminSecret });
  Object.entries(payload || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.append(k, String(v));
  });
  const res = await fetch(apiBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (_) { throw new Error(`API ${action} non-JSON: ${text}`); }
  if (!res.ok || !json.success) throw new Error(`API ${action} failed: ${text}`);
  return json;
}

async function apiActionExpectFail(action, payload) {
  const params = new URLSearchParams({ action, admin_secret: adminSecret });
  Object.entries(payload || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.append(k, String(v));
  });
  const res = await fetch(apiBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (_) { return { success: false, raw: text }; }
  return json;
}

async function supabaseQuery(table, query) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase query ${table} failed: ${text}`);
  return text ? JSON.parse(text) : [];
}

async function supabaseDeleteBy(table, where) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${where}`, {
    method: 'DELETE',
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  if (!res.ok && res.status !== 204) throw new Error(`Supabase delete ${table} failed: ${await res.text()}`);
}

async function cleanup() {
  for (const code of Object.values(codes)) {
    await supabaseDeleteBy('accommodation_usage', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDeleteBy('payouts', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDeleteBy('bookings', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDeleteBy('clicks', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDeleteBy('partners', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    log('CLEANED', code);
  }
}

(async () => {
  const result = { artifactFile, scenarios: {} };
  try {
    await cleanup().catch(() => {});

    // --- Setup: create partner ---
    log('Creating partner', codes.lifecycle);
    await apiAction('create_partner', {
      partner_code: codes.lifecycle,
      coupon_code: `CP${codes.lifecycle.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `PointsCash ${suffix}`,
      phone: '0912111001',
      email: `${codes.lifecycle}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION'
    });

    // Set available_points to 6000 via update_partner_commission
    await apiAction('update_partner_commission', {
      partner_code: codes.lifecycle,
      available_points: 6000,
      adjustment_reason: 'E2E test setup'
    });

    // Verify setup
    const setupPartner = (await supabaseQuery('partners', `select=partner_code,available_points,points_used,pending_commission&partner_code=eq.${encodeURIComponent(codes.lifecycle)}&limit=1`))[0];
    ensure(Number(setupPartner.available_points) === 6000, `Setup: available_points should be 6000, got ${setupPartner.available_points}`);
    log('Setup OK: available_points=6000');

    // --- Scenario 1: convert_points_to_cash (2000 points -> 1000 cash) ---
    log('Scenario 1: convert_points_to_cash');
    await apiAction('convert_points_to_cash', {
      partner_code: codes.lifecycle,
      points_used: 2000
    });

    const afterConvert = (await supabaseQuery('partners', `select=partner_code,available_points,points_used,pending_commission&partner_code=eq.${encodeURIComponent(codes.lifecycle)}&limit=1`))[0];
    ensure(Number(afterConvert.available_points) === 4000, `After convert: available_points should be 4000, got ${afterConvert.available_points}`);
    ensure(Number(afterConvert.points_used) === 2000, `After convert: points_used should be 2000, got ${afterConvert.points_used}`);
    ensure(Number(afterConvert.pending_commission) === 1000, `After convert: pending_commission should be 1000, got ${afterConvert.pending_commission}`);
    log('Scenario 1 OK: convert verified');

    // --- Scenario 2: Verify CASH_CONVERSION payout record ---
    log('Scenario 2: verify CASH_CONVERSION payout');
    const conversionPayouts = await supabaseQuery('payouts', `select=payout_type,amount,payout_status,payout_method&partner_code=eq.${encodeURIComponent(codes.lifecycle)}&payout_type=eq.CASH_CONVERSION`);
    ensure(conversionPayouts.length >= 1, `Should have CASH_CONVERSION payout, got ${conversionPayouts.length}`);
    ensure(Number(conversionPayouts[0].amount) === 1000, `CASH_CONVERSION amount should be 1000, got ${conversionPayouts[0].amount}`);
    ensure(conversionPayouts[0].payout_status === 'PENDING', `CASH_CONVERSION status should be PENDING, got ${conversionPayouts[0].payout_status}`);
    log('Scenario 2 OK: CASH_CONVERSION payout verified');
    result.scenarios.convert = { afterConvert, conversionPayouts };

    // --- Scenario 3: revert_cash_to_points (1000 cash -> 2000 points) ---
    log('Scenario 3: revert_cash_to_points');
    await apiAction('revert_cash_to_points', {
      partner_code: codes.lifecycle,
      amount: 1000
    });

    const afterRevert = (await supabaseQuery('partners', `select=partner_code,available_points,points_used,pending_commission&partner_code=eq.${encodeURIComponent(codes.lifecycle)}&limit=1`))[0];
    // revert adds cashAmount*2 = 2000 to available_points: 4000+2000 = 6000
    ensure(Number(afterRevert.available_points) === 6000, `After revert: available_points should be 6000, got ${afterRevert.available_points}`);
    // revert subtracts cashAmount from pending_commission: 1000-1000 = 0
    ensure(Number(afterRevert.pending_commission) === 0, `After revert: pending_commission should be 0, got ${afterRevert.pending_commission}`);
    // Note: revert does NOT modify points_used, it stays at 2000
    ensure(Number(afterRevert.points_used) === 2000, `After revert: points_used should be 2000, got ${afterRevert.points_used}`);
    log('Scenario 3 OK: revert verified');

    // --- Scenario 4: Verify reversal payout record ---
    log('Scenario 4: verify reversal payout');
    const reversalPayouts = await supabaseQuery('payouts', `select=payout_type,amount,payout_status,notes&partner_code=eq.${encodeURIComponent(codes.lifecycle)}&payout_type=eq.POINTS_ADJUSTMENT&order=id.desc`);
    ensure(reversalPayouts.length >= 1, `Should have POINTS_ADJUSTMENT payout, got ${reversalPayouts.length}`);
    // The latest POINTS_ADJUSTMENT is the revert (2000 points = $1000 cash * 2)
    ensure(Number(reversalPayouts[0].amount) === 2000, `Latest POINTS_ADJUSTMENT amount should be 2000 (points), got ${reversalPayouts[0].amount}`);
    ensure(reversalPayouts[0].payout_status === 'COMPLETED', `POINTS_ADJUSTMENT status should be COMPLETED, got ${reversalPayouts[0].payout_status}`);
    log('Scenario 4 OK: reversal payout verified');
    result.scenarios.revert = { afterRevert, reversalPayouts };

    // --- Scenario 5: Edge case - convert less than 1000 should fail ---
    log('Scenario 5: convert < 1000 should fail');
    const failLow = await apiActionExpectFail('convert_points_to_cash', {
      partner_code: codes.lifecycle,
      points_used: 500
    });
    ensure(!failLow.success, `Convert < 1000 should fail, got success`);
    log('Scenario 5 OK: convert < 1000 correctly rejected');
    result.scenarios.edge_low = { failLow };

    // --- Scenario 6: Edge case - convert more than available should fail ---
    log('Scenario 6: convert > available should fail');
    const failOver = await apiActionExpectFail('convert_points_to_cash', {
      partner_code: codes.lifecycle,
      points_used: 99999
    });
    ensure(!failOver.success, `Convert > available should fail, got success`);
    log('Scenario 6 OK: convert > available correctly rejected');
    result.scenarios.edge_over = { failOver };

    fs.mkdirSync(path.dirname(artifactFile), { recursive: true });
    fs.writeFileSync(artifactFile, JSON.stringify(result, null, 2));
    log('E2E_POINTS_CASH_LIFECYCLE PASS', artifactFile);
    await cleanup();
  } catch (error) {
    log('E2E_POINTS_CASH_LIFECYCLE FAIL', error.stack || error.message);
    try { fs.mkdirSync(path.dirname(artifactFile), { recursive: true }); fs.writeFileSync(artifactFile, JSON.stringify({ error: error.stack || error.message, partial: result }, null, 2)); } catch (_) {}
    await cleanup().catch(() => {});
    process.exitCode = 1;
  }
})();
