const fs = require('fs');
const path = require('path');

const apiBase = process.env.API_BASE || 'https://forest-ambassador.vercel.app/api';
const adminSecret = process.env.ADMIN_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!adminSecret || !supabaseUrl || !supabaseKey) throw new Error('Missing env');

const ts = Date.now();
const suffix = String(ts).slice(-6);
const partnerCode = `ub${suffix}`;
const artifactFile = path.join('/tmp/codex-browser-test', `update-booking-${ts}.json`);

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
      partner_name: `UpdateBooking ${suffix}`,
      phone: '0912300001',
      email: `${partnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION'
    });

    // Step 2: Create booking with room_price=5000
    log('STEP 2: Create booking');
    const created = await apiAction('create_booking', {
      partner_code: partnerCode,
      guest_name: `UB_Guest_${suffix}`,
      guest_phone: '0912300002',
      guest_email: `ub_guest_${suffix}@example.com`,
      bank_account_last5: '11111',
      checkin_date: '2026-04-01',
      checkout_date: '2026-04-02',
      room_price: '5000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID'
    });
    const bookingId = created.booking_id || created.data.id;
    log('  Booking created:', bookingId);

    // Scenario 1: update room_price to 8000
    log('SCENARIO 1: Update room_price to 8000');
    await apiAction('update_booking', { booking_id: bookingId, room_price: 8000 });
    const afterPrice = (await supabaseQuery('bookings', `select=id,room_price&id=eq.${bookingId}`))[0];
    ensure(Number(afterPrice.room_price) === 8000, `room_price should be 8000, got ${afterPrice.room_price}`);
    log('  room_price verified: 8000');
    result.scenarios.update_price = { room_price: Number(afterPrice.room_price) };

    // Scenario 2: update guest_name
    log('SCENARIO 2: Update guest_name');
    const newGuestName = `UB_Updated_${suffix}`;
    await apiAction('update_booking', { booking_id: bookingId, guest_name: newGuestName });
    const afterName = (await supabaseQuery('bookings', `select=id,guest_name&id=eq.${bookingId}`))[0];
    ensure(afterName.guest_name === newGuestName, `guest_name should be ${newGuestName}, got ${afterName.guest_name}`);
    log('  guest_name verified:', newGuestName);
    result.scenarios.update_name = { guest_name: afterName.guest_name };

    // Scenario 3: update notes
    log('SCENARIO 3: Update notes');
    await apiAction('update_booking', { booking_id: bookingId, notes: 'Test note' });
    const afterNotes = (await supabaseQuery('bookings', `select=id,notes&id=eq.${bookingId}`))[0];
    ensure(afterNotes.notes === 'Test note', `notes should be "Test note", got ${afterNotes.notes}`);
    log('  notes verified: Test note');
    result.scenarios.update_notes = { notes: afterNotes.notes };

    // Scenario 4: update payment_status to REFUNDED
    log('SCENARIO 4: Update payment_status to REFUNDED');
    await apiAction('update_booking', { booking_id: bookingId, payment_status: 'REFUNDED' });
    const afterPayment = (await supabaseQuery('bookings', `select=id,payment_status&id=eq.${bookingId}`))[0];
    ensure(afterPayment.payment_status === 'REFUNDED', `payment_status should be REFUNDED, got ${afterPayment.payment_status}`);
    log('  payment_status verified: REFUNDED');
    result.scenarios.update_payment_status = { payment_status: afterPayment.payment_status };

    // Scenario 5: Edge case — update non-existent booking
    log('SCENARIO 5: Update non-existent booking');
    const failResult = await apiActionExpectFail('update_booking', { booking_id: 999999, room_price: 1000 });
    ensure(!failResult.success, `Updating non-existent booking should fail, got success`);
    log('  Non-existent booking correctly rejected');
    result.scenarios.edge_nonexistent = { failResult };

    fs.mkdirSync(path.dirname(artifactFile), { recursive: true });
    fs.writeFileSync(artifactFile, JSON.stringify(result, null, 2));
    log('E2E_UPDATE_BOOKING PASS', artifactFile);
    await cleanup();
  } catch (error) {
    log('E2E_UPDATE_BOOKING FAIL', error.stack || error.message);
    try { fs.mkdirSync(path.dirname(artifactFile), { recursive: true }); fs.writeFileSync(artifactFile, JSON.stringify({ error: error.stack || error.message, partial: result }, null, 2)); } catch (_) {}
    await cleanup().catch(() => {});
    process.exitCode = 1;
  }
})();
