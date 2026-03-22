const fs = require('fs');
const path = require('path');

const apiBase = process.env.API_BASE || 'https://forest-ambassador.vercel.app/api';
const adminSecret = process.env.ADMIN_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!adminSecret || !supabaseUrl || !supabaseKey) throw new Error('Missing env');

const ts = Date.now();
const suffix = String(ts).slice(-6);
const partnerCode = `py${suffix}`;
const artifactFile = path.join('/tmp/codex-browser-test', `payout-lifecycle-${ts}.json`);

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
      partner_name: `PayoutLifecycle ${suffix}`,
      phone: '0912700001',
      email: `${partnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'CASH'
    });

    // Step 2: Create booking and confirm checkin → earn $500 cash (LV1)
    log('STEP 2: Create booking and confirm checkin');
    const created = await apiAction('create_booking', {
      partner_code: partnerCode,
      guest_name: `PY_Guest_${suffix}`,
      guest_phone: '0912700002',
      guest_email: `py_guest_${suffix}@example.com`,
      bank_account_last5: '44444',
      checkin_date: '2026-04-15',
      checkout_date: '2026-04-16',
      room_price: '5000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID'
    });
    const bookingId = created.booking_id || created.data.id;
    log('  Booking created:', bookingId);

    await apiAction('confirm_checkin_completion', { booking_id: bookingId, confirmed_by: 'PY_E2E' });
    log('  Checkin confirmed');

    // Step 3: Verify pending_commission = 500
    log('STEP 3: Verify pending_commission');
    const partnerAfterCheckin = (await supabaseQuery('partners', `select=partner_code,pending_commission&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`))[0];
    const pendingCommission = Number(partnerAfterCheckin.pending_commission);
    log('  pending_commission:', pendingCommission);
    ensure(pendingCommission === 500, `pending_commission should be 500 (LV1 cash), got ${pendingCommission}`);
    result.scenarios.after_checkin = { pending_commission: pendingCommission };

    // Step 4: Create payout
    log('STEP 4: Create payout (CASH, amount=500)');
    const payoutResult = await apiAction('create_payout', {
      partner_code: partnerCode,
      payout_type: 'CASH',
      amount: 500
    });
    const payoutId = payoutResult.payout_id || (payoutResult.data && payoutResult.data.id);
    log('  Payout created:', payoutId);

    // Step 5: Verify payout record
    log('STEP 5: Verify payout record');
    const payoutsAfterCreate = await supabaseQuery('payouts', `select=id,payout_type,amount,payout_status,notes&partner_code=eq.${encodeURIComponent(partnerCode)}&payout_type=eq.CASH&order=id.desc&limit=1`);
    ensure(payoutsAfterCreate.length > 0, 'Payout record should exist');
    const actualPayoutId = payoutId || payoutsAfterCreate[0].id;
    ensure(payoutsAfterCreate[0].payout_status === 'PENDING', `Payout status should be PENDING, got ${payoutsAfterCreate[0].payout_status}`);
    ensure(Number(payoutsAfterCreate[0].amount) === 500, `Payout amount should be 500, got ${payoutsAfterCreate[0].amount}`);
    log('  Payout verified: PENDING, amount=500');
    result.scenarios.payout_created = payoutsAfterCreate[0];

    // Step 6: Update payout notes
    log('STEP 6: Update payout notes');
    await apiAction('update_payout', {
      payout_id: actualPayoutId,
      notes: 'Test update notes'
    });

    const payoutAfterUpdate = (await supabaseQuery('payouts', `select=id,notes&id=eq.${actualPayoutId}`))[0];
    ensure(payoutAfterUpdate.notes === 'Test update notes', `Payout notes should be "Test update notes", got ${payoutAfterUpdate.notes}`);
    log('  Payout notes verified: Test update notes');
    result.scenarios.payout_updated = { notes: payoutAfterUpdate.notes };

    // Step 7: Process payout (bank transfer confirmation)
    // NOTE: process_payout creates a NEW PAYMENT_COMPLETED payout and deducts pending_commission.
    // It is NOT an update to the existing payout record. It's a separate action.
    // Since create_payout already consumed the pending_commission, we need to add more first.
    log('STEP 7: Add more pending_commission for process_payout test');
    await apiAction('update_partner_commission', {
      partner_code: partnerCode,
      pending_commission: 300,
      adjustment_reason: 'Test: add pending for process_payout'
    });

    log('STEP 8: Process payout (bank transfer)');
    await apiAction('process_payout', {
      partner_code: partnerCode,
      amount: 300,
      bank_transfer_date: '2026-03-22',
      bank_transfer_reference: 'REF123'
    });
    log('  Payout processed');

    // Step 9: Verify process_payout created a PAYMENT_COMPLETED record
    log('STEP 9: Verify payout processed');
    const processPayouts = await supabaseQuery('payouts', `select=id,payout_type,payout_status,amount,bank_transfer_date,bank_transfer_reference&partner_code=eq.${encodeURIComponent(partnerCode)}&payout_type=eq.PAYMENT_COMPLETED&order=id.desc&limit=1`);
    ensure(processPayouts.length > 0, 'PAYMENT_COMPLETED payout should exist');
    ensure(processPayouts[0].payout_status === 'COMPLETED', `Payout status should be COMPLETED, got ${processPayouts[0].payout_status}`);
    ensure(processPayouts[0].bank_transfer_reference === 'REF123', `bank_transfer_reference should be REF123, got ${processPayouts[0].bank_transfer_reference}`);
    log('  Payout status: COMPLETED, ref: REF123');

    const transferDate = String(processPayouts[0].bank_transfer_date || '');
    ensure(transferDate.includes('2026-03-22'), `bank_transfer_date should contain 2026-03-22, got ${transferDate}`);
    log('  Bank transfer details verified');
    result.scenarios.payout_processed = processPayouts[0];

    // Step 10: Verify partner pending_commission decreased
    log('STEP 10: Verify pending_commission decreased');
    const partnerAfterProcess = (await supabaseQuery('partners', `select=partner_code,pending_commission&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`))[0];
    const pendingAfterProcess = Number(partnerAfterProcess.pending_commission);
    log('  pending_commission after process:', pendingAfterProcess);
    ensure(pendingAfterProcess < pendingCommission, `pending_commission should decrease after process: ${pendingAfterProcess} < ${pendingCommission}`);
    result.scenarios.commission_after_process = { before: pendingCommission, after: pendingAfterProcess };

    fs.mkdirSync(path.dirname(artifactFile), { recursive: true });
    fs.writeFileSync(artifactFile, JSON.stringify(result, null, 2));
    log('E2E_PAYOUT_LIFECYCLE PASS', artifactFile);
    await cleanup();
  } catch (error) {
    log('E2E_PAYOUT_LIFECYCLE FAIL', error.stack || error.message);
    try { fs.mkdirSync(path.dirname(artifactFile), { recursive: true }); fs.writeFileSync(artifactFile, JSON.stringify({ error: error.stack || error.message, partial: result }, null, 2)); } catch (_) {}
    await cleanup().catch(() => {});
    process.exitCode = 1;
  }
})();
