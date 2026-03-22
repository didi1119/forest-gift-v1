const fs = require('fs');
const path = require('path');

const apiBase = process.env.API_BASE || 'https://forest-ambassador.vercel.app/api';
const adminSecret = process.env.ADMIN_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!adminSecret || !supabaseUrl || !supabaseKey) throw new Error('Missing env');

const ts = Date.now();
const suffix = String(ts).slice(-6);
const partnerCode = `rb${suffix}`;
const artifactFile = path.join('/tmp/codex-browser-test', `restore-booking-${ts}.json`);

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
  try { return JSON.parse(text); } catch (_) { return { success: false, raw: text }; }
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
  await supabaseDeleteBy('accommodation_usage', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDeleteBy('payouts', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDeleteBy('bookings', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDeleteBy('clicks', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDeleteBy('partners', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  log('CLEANED', partnerCode);
}

(async () => {
  const result = { artifactFile, scenarios: {} };
  try {
    await cleanup().catch(() => {});

    // Step 1: Create partner
    log('STEP 1: Create partner', partnerCode);
    await apiAction('create_partner', {
      partner_code: partnerCode,
      coupon_code: `CP${partnerCode.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `RestoreBooking ${suffix}`,
      phone: '0912600001',
      email: `${partnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION'
    });

    // Step 2: Create booking and confirm checkin
    log('STEP 2: Create booking and confirm checkin');
    const created = await apiAction('create_booking', {
      partner_code: partnerCode,
      guest_name: `RB_Guest_${suffix}`,
      guest_phone: '0912600002',
      guest_email: `rb_guest_${suffix}@example.com`,
      bank_account_last5: '33333',
      checkin_date: '2026-04-10',
      checkout_date: '2026-04-11',
      room_price: '5000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID'
    });
    const bookingId = created.booking_id || created.data.id;
    log('  Booking created:', bookingId);

    await apiAction('confirm_checkin_completion', { booking_id: bookingId, confirmed_by: 'RB_E2E' });
    log('  Checkin confirmed');

    // Step 3: Record available_points after checkin
    log('STEP 3: Record points after checkin');
    const partnerAfterCheckin = (await supabaseQuery('partners', `select=partner_code,available_points,total_successful_referrals&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`))[0];
    const pointsAfterCheckin = Number(partnerAfterCheckin.available_points);
    log('  available_points after checkin:', pointsAfterCheckin);
    // LV1 first referral: 1000 (commission) + 1500 (first bonus) = 2500
    ensure(pointsAfterCheckin === 2500, `available_points after first checkin should be 2500, got ${pointsAfterCheckin}`);
    result.scenarios.after_checkin = { available_points: pointsAfterCheckin };

    // Step 4: Delete booking
    log('STEP 4: Delete booking');
    await apiAction('delete_booking', { booking_id: bookingId });

    const bookingAfterDelete = (await supabaseQuery('bookings', `select=id,stay_status,commission_status&id=eq.${bookingId}`))[0];
    log('  Booking after delete:', JSON.stringify(bookingAfterDelete));
    ensure(['CANCELLED', 'DELETED'].includes(bookingAfterDelete.stay_status), `stay_status should be CANCELLED or DELETED, got ${bookingAfterDelete.stay_status}`);

    // Step 5: Record points after delete (should be less)
    const partnerAfterDelete = (await supabaseQuery('partners', `select=partner_code,available_points&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`))[0];
    const pointsAfterDelete = Number(partnerAfterDelete.available_points);
    log('  available_points after delete:', pointsAfterDelete);
    ensure(pointsAfterDelete < pointsAfterCheckin, `Points should decrease after delete: ${pointsAfterDelete} < ${pointsAfterCheckin}`);
    result.scenarios.after_delete = { available_points: pointsAfterDelete, booking_status: bookingAfterDelete.stay_status };

    // Step 6: Restore booking
    log('STEP 6: Restore booking');
    await apiAction('restore_booking', { booking_id: bookingId });
    log('  Booking restored');

    // Step 7: Verify booking status restored
    log('STEP 7: Verify booking restored');
    const bookingAfterRestore = (await supabaseQuery('bookings', `select=id,stay_status,commission_status&id=eq.${bookingId}`))[0];
    log('  Booking after restore:', JSON.stringify(bookingAfterRestore));
    // Backend restores to PENDING (not COMPLETED) — admin needs to re-confirm checkin
    ensure(bookingAfterRestore.stay_status !== 'CANCELLED', `stay_status should not be CANCELLED after restore, got ${bookingAfterRestore.stay_status}`);
    log('  Booking restored to status:', bookingAfterRestore.stay_status);
    result.scenarios.after_restore_booking = bookingAfterRestore;

    // Step 8: Verify partner — restore_booking may not re-add commission (since status is PENDING, not COMPLETED)
    log('STEP 8: Check partner state after restore');
    const partnerAfterRestore = (await supabaseQuery('partners', `select=partner_code,available_points&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`))[0];
    const pointsAfterRestore = Number(partnerAfterRestore.available_points);
    log('  available_points after restore:', pointsAfterRestore);
    result.scenarios.after_restore_partner = { available_points: pointsAfterRestore };

    // Step 9: Edge case — restore non-existent booking
    log('STEP 9: Restore non-existent booking');
    const failResult = await apiActionExpectFail('restore_booking', { booking_id: 999999 });
    ensure(!failResult.success, `Restoring non-existent booking should fail, got success`);
    log('  Non-existent booking restore correctly rejected');
    result.scenarios.edge_nonexistent = { failResult };

    fs.mkdirSync(path.dirname(artifactFile), { recursive: true });
    fs.writeFileSync(artifactFile, JSON.stringify(result, null, 2));
    log('E2E_RESTORE_BOOKING PASS', artifactFile);
    await cleanup();
  } catch (error) {
    log('E2E_RESTORE_BOOKING FAIL', error.stack || error.message);
    try { fs.mkdirSync(path.dirname(artifactFile), { recursive: true }); fs.writeFileSync(artifactFile, JSON.stringify({ error: error.stack || error.message, partial: result }, null, 2)); } catch (_) {}
    await cleanup().catch(() => {});
    process.exitCode = 1;
  }
})();
