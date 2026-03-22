const fs = require('fs');
const path = require('path');

const apiBase = process.env.API_BASE || 'https://forest-ambassador.vercel.app/api';
const adminSecret = process.env.ADMIN_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!adminSecret || !supabaseUrl || !supabaseKey) throw new Error('Missing env');

const ts = Date.now();
const suffix = String(ts).slice(-6);
const partnerCode = `cp${suffix}`;
const artifactFile = path.join('/tmp/codex-browser-test', `cancel-payout-${ts}.json`);

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

    // Step 1: Create partner with CASH preference
    log('STEP 1: Create partner', partnerCode);
    await apiAction('create_partner', {
      partner_code: partnerCode,
      coupon_code: `CP${partnerCode.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `CancelPayout ${suffix}`,
      phone: '0912500001',
      email: `${partnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'CASH'
    });

    // Step 2: Create booking and confirm checkin to earn commission
    log('STEP 2: Create booking and confirm checkin');
    const created = await apiAction('create_booking', {
      partner_code: partnerCode,
      guest_name: `CP_Guest_${suffix}`,
      guest_phone: '0912500002',
      guest_email: `cp_guest_${suffix}@example.com`,
      bank_account_last5: '22222',
      checkin_date: '2026-04-05',
      checkout_date: '2026-04-06',
      room_price: '5000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID'
    });
    const bookingId = created.booking_id || created.data.id;
    log('  Booking created:', bookingId);

    await apiAction('confirm_checkin_completion', { booking_id: bookingId, confirmed_by: `CP_E2E` });
    log('  Checkin confirmed');

    // Check partner pending_commission after checkin
    const partnerAfterCheckin = (await supabaseQuery('partners', `select=partner_code,pending_commission&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`))[0];
    const pendingAfterCheckin = Number(partnerAfterCheckin.pending_commission);
    log('  pending_commission after checkin:', pendingAfterCheckin);
    ensure(pendingAfterCheckin > 0, `pending_commission should be > 0 after checkin, got ${pendingAfterCheckin}`);

    // Step 3: Create payout
    log('STEP 3: Create payout');
    const payoutResult = await apiAction('create_payout', {
      partner_code: partnerCode,
      payout_type: 'CASH',
      amount: pendingAfterCheckin
    });
    const payoutId = payoutResult.payout_id || (payoutResult.data && payoutResult.data.id);
    log('  Payout created:', payoutId);

    // Verify payout exists with PENDING status
    const payoutsBefore = await supabaseQuery('payouts', `select=id,payout_type,amount,payout_status&partner_code=eq.${encodeURIComponent(partnerCode)}&payout_type=eq.CASH&payout_status=eq.PENDING&order=id.desc&limit=1`);
    ensure(payoutsBefore.length > 0, 'Payout record should exist with PENDING status');
    const actualPayoutId = payoutId || payoutsBefore[0].id;
    ensure(payoutsBefore[0].payout_status === 'PENDING', `Payout status should be PENDING, got ${payoutsBefore[0].payout_status}`);
    log('  Payout verified: PENDING');
    result.scenarios.payout_created = { payout: payoutsBefore[0] };

    // Step 4: Cancel payout (within 7-day grace period)
    log('STEP 4: Cancel payout');
    await apiAction('cancel_payout', { payout_id: actualPayoutId });
    log('  Payout cancelled');

    // Step 5: Verify payout status changed
    log('STEP 5: Verify payout cancelled');
    const payoutAfterCancel = (await supabaseQuery('payouts', `select=id,payout_status&id=eq.${actualPayoutId}`))[0];
    ensure(['CANCELLED', 'FAILED'].includes(payoutAfterCancel.payout_status), `Payout status should be CANCELLED or FAILED after cancel, got ${payoutAfterCancel.payout_status}`);
    log('  Payout status:', payoutAfterCancel.payout_status);
    result.scenarios.payout_cancelled = { payout_status: payoutAfterCancel.payout_status };

    // Step 6: Verify partner pending_commission restored
    log('STEP 6: Verify pending_commission restored');
    const partnerAfterCancel = (await supabaseQuery('partners', `select=partner_code,pending_commission&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`))[0];
    const pendingAfterCancel = Number(partnerAfterCancel.pending_commission);
    log('  pending_commission after cancel:', pendingAfterCancel);
    // After cancelling, pending_commission should be restored to at least the checkin amount
    ensure(pendingAfterCancel >= pendingAfterCheckin, `pending_commission should be restored to >= ${pendingAfterCheckin}, got ${pendingAfterCancel}`);
    result.scenarios.commission_restored = { pendingAfterCheckin, pendingAfterCancel };

    // Step 7: Edge case — cancel same payout again
    log('STEP 7: Cancel already-cancelled payout');
    const failResult = await apiActionExpectFail('cancel_payout', { payout_id: actualPayoutId });
    ensure(!failResult.success, `Cancelling already-cancelled payout should fail, got success`);
    log('  Double cancel correctly rejected');
    result.scenarios.edge_double_cancel = { failResult };

    fs.mkdirSync(path.dirname(artifactFile), { recursive: true });
    fs.writeFileSync(artifactFile, JSON.stringify(result, null, 2));
    log('E2E_CANCEL_PAYOUT PASS', artifactFile);
    await cleanup();
  } catch (error) {
    log('E2E_CANCEL_PAYOUT FAIL', error.stack || error.message);
    try { fs.mkdirSync(path.dirname(artifactFile), { recursive: true }); fs.writeFileSync(artifactFile, JSON.stringify({ error: error.stack || error.message, partial: result }, null, 2)); } catch (_) {}
    await cleanup().catch(() => {});
    process.exitCode = 1;
  }
})();
