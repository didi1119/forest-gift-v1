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
  login: `lg${suffix}`
};
const artifactFile = path.join('/tmp/codex-browser-test', `partner-login-verify-${ts}.json`);

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

async function apiActionRaw(action, payload) {
  const params = new URLSearchParams({ action });
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

    const partnerEmail = `${codes.login}@example.com`;
    const partnerPhone = '0912345678';

    // --- Setup: create partner ---
    log('Creating partner', codes.login);
    await apiAction('create_partner', {
      partner_code: codes.login,
      coupon_code: `CP${codes.login.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `Login ${suffix}`,
      phone: partnerPhone,
      email: partnerEmail,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION'
    });

    // Set available_points to 3000
    await apiAction('update_partner_commission', {
      partner_code: codes.login,
      available_points: 3000,
      adjustment_reason: 'E2E login test setup'
    });

    // --- Create 2 bookings ---
    log('Creating booking 1 (will confirm)');
    const booking1 = await apiAction('create_booking', {
      partner_code: codes.login,
      guest_name: `LOGIN_GUEST1_${suffix}`,
      guest_phone: '0911222001',
      guest_email: `loginguest1${suffix}@example.com`,
      bank_account_last5: '11111',
      checkin_date: '2026-03-20',
      checkout_date: '2026-03-21',
      room_price: '5000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID'
    });
    const bookingId1 = booking1.booking_id || booking1.data.id;
    await apiAction('confirm_checkin_completion', { booking_id: bookingId1, confirmed_by: 'E2E_LOGIN' });
    log('Booking 1 confirmed');

    log('Creating booking 2 (leave PENDING)');
    await apiAction('create_booking', {
      partner_code: codes.login,
      guest_name: `LOGIN_GUEST2_${suffix}`,
      guest_phone: '0911222002',
      guest_email: `loginguest2${suffix}@example.com`,
      bank_account_last5: '22222',
      checkin_date: '2026-04-01',
      checkout_date: '2026-04-02',
      room_price: '6000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID'
    });
    log('Booking 2 created (not confirmed)');

    // --- Scenario 1: Login with partner_code + correct phone_last4 ---
    log('Scenario 1: login with partner_code');
    const login1 = await apiActionRaw('verify_partner_login', {
      login_identifier: codes.login,
      phone_last4: '5678'
    });
    ensure(login1.success === true, `Login with partner_code should succeed: ${JSON.stringify(login1)}`);
    ensure(login1.partner && login1.partner.partner_code === codes.login, `Login should return correct partner_code`);
    log('Scenario 1 OK: login with partner_code succeeded');
    result.scenarios.login_by_code = login1;

    // --- Scenario 2: Login with email + correct phone_last4 ---
    log('Scenario 2: login with email');
    const login2 = await apiActionRaw('verify_partner_login', {
      login_identifier: partnerEmail,
      phone_last4: '5678'
    });
    ensure(login2.success === true, `Login with email should succeed: ${JSON.stringify(login2)}`);
    ensure(login2.partner && login2.partner.partner_code === codes.login, `Login by email should return correct partner_code`);
    log('Scenario 2 OK: login with email succeeded');
    result.scenarios.login_by_email = login2;

    // --- Scenario 3: Login with wrong phone_last4 should fail ---
    log('Scenario 3: login with wrong phone_last4');
    const login3 = await apiActionRaw('verify_partner_login', {
      login_identifier: codes.login,
      phone_last4: '9999'
    });
    ensure(login3.success === false, `Login with wrong phone should fail, got: ${JSON.stringify(login3)}`);
    log('Scenario 3 OK: wrong phone_last4 correctly rejected');
    result.scenarios.login_wrong_phone = login3;

    // --- Scenario 4: get_partner_dashboard_data ---
    log('Scenario 4: get_partner_dashboard_data');
    const dashboard = await apiActionRaw('get_partner_dashboard_data', {
      partner_code: codes.login
    });
    ensure(dashboard.success === true, `Dashboard should succeed: ${JSON.stringify(dashboard)}`);

    // Verify financial data from DB
    const dbPartner = (await supabaseQuery('partners', `select=partner_code,available_points,points_used,total_commission_earned,pending_commission,successful_referrals,yearly_referrals&partner_code=eq.${encodeURIComponent(codes.login)}&limit=1`))[0];
    const dbBookings = await supabaseQuery('bookings', `select=id,stay_status,commission_status&partner_code=eq.${encodeURIComponent(codes.login)}&order=id.asc`);

    // Partner should have 1 completed booking with commission
    const completedBookings = dbBookings.filter(b => b.stay_status === 'COMPLETED');
    ensure(completedBookings.length === 1, `Should have 1 completed booking, got ${completedBookings.length}`);
    ensure(dbBookings.length === 2, `Should have 2 total bookings, got ${dbBookings.length}`);

    // Verify dashboard returns partner data
    ensure(dashboard.partner !== undefined, `Dashboard should include partner data`);

    // Verify the DB has correct referral count
    const referrals = parseInt(dbPartner.successful_referrals) || parseInt(dbPartner.total_successful_referrals) || 0;
    ensure(referrals >= 1, `Should have at least 1 successful referral, got ${referrals}`);

    log('Scenario 4 OK: dashboard data verified');
    result.scenarios.dashboard = { dashboard_partner: dashboard.partner, dbPartner, dbBookings };

    fs.mkdirSync(path.dirname(artifactFile), { recursive: true });
    fs.writeFileSync(artifactFile, JSON.stringify(result, null, 2));
    log('E2E_PARTNER_LOGIN_VERIFY PASS', artifactFile);
    await cleanup();
  } catch (error) {
    log('E2E_PARTNER_LOGIN_VERIFY FAIL', error.stack || error.message);
    try { fs.mkdirSync(path.dirname(artifactFile), { recursive: true }); fs.writeFileSync(artifactFile, JSON.stringify({ error: error.stack || error.message, partial: result }, null, 2)); } catch (_) {}
    await cleanup().catch(() => {});
    process.exitCode = 1;
  }
})();
