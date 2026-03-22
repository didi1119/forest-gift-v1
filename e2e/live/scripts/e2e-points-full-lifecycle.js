const fs = require('fs');
const path = require('path');

const apiBase = process.env.API_BASE || 'https://forest-ambassador.vercel.app/api';
const adminSecret = process.env.ADMIN_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!adminSecret || !supabaseUrl || !supabaseKey) throw new Error('Missing env');

const ts = Date.now();
const suffix = String(ts).slice(-6);
const partnerCode = `pl${suffix}`;
const artifactFile = path.join('/tmp/codex-browser-test', `points-lifecycle-${ts}.json`);

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

async function getPartner() {
  const rows = await supabaseQuery('partners', `select=partner_code,available_points,points_used,pending_commission,total_commission_earned&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`);
  return rows[0];
}

async function countPayouts() {
  const rows = await supabaseQuery('payouts', `select=id&partner_code=eq.${encodeURIComponent(partnerCode)}`);
  return rows.length;
}

(async () => {
  const result = { artifactFile, steps: {} };
  try {
    await cleanup().catch(() => {});

    // Step 1: Create partner at LV1, ACCOMMODATION preference
    log('STEP 1: Create partner');
    await apiAction('create_partner', {
      partner_code: partnerCode,
      coupon_code: `CP${partnerCode.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `Points ${suffix}`,
      phone: '0911400001',
      email: `${partnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION'
    });

    // Step 2: Create 1 booking ($5000, REFERRAL), confirm checkin
    // Earn $1000 commission + $1500 first bonus = $2500 points
    log('STEP 2: Create and confirm 1 booking');
    const created = await apiAction('create_booking', {
      partner_code: partnerCode,
      guest_name: `PLC_G1_${suffix}`,
      guest_phone: '0911400002',
      guest_email: `plc_g1_${suffix}@example.com`,
      bank_account_last5: '11111',
      checkin_date: '2026-03-10',
      checkout_date: '2026-03-11',
      room_price: '5000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID'
    });
    const bookingId = created.booking_id || created.data.id;
    await apiAction('confirm_checkin_completion', { booking_id: bookingId, confirmed_by: 'PLC_E2E' });
    log('  Booking confirmed:', bookingId);

    // Step 3: Verify available_points=2500, points_used=0
    log('STEP 3: Verify initial points');
    let partner = await getPartner();
    log('  Partner:', JSON.stringify(partner));
    ensure(Number(partner.available_points) === 2500, `available_points should be 2500, got ${partner.available_points}`);
    ensure(Number(partner.points_used) === 0, `points_used should be 0, got ${partner.points_used}`);
    let payoutCount = await countPayouts();
    result.steps.initial = { available_points: 2500, points_used: 0, payouts: payoutCount };

    // Step 4: use_accommodation_points with deduct_amount=500
    log('STEP 4: Use 500 accommodation points');
    await apiAction('use_accommodation_points', {
      partner_code: partnerCode,
      deduct_amount: 500,
      guest_name: `PLC_SELF_${suffix}`,
      checkin_date: '2026-03-15',
      checkout_date: '2026-03-16'
    });
    partner = await getPartner();
    log('  After use:', JSON.stringify(partner));
    ensure(Number(partner.available_points) === 2000, `available_points should be 2000, got ${partner.available_points}`);
    ensure(Number(partner.points_used) === 500, `points_used should be 500, got ${partner.points_used}`);
    let payoutCountAfterUse = await countPayouts();
    result.steps.after_use = { available_points: 2000, points_used: 500, payouts: payoutCountAfterUse };

    // Step 5: Query accommodation_usage record, save the usage ID
    log('STEP 5: Query usage record');
    const usageRecords = await supabaseQuery('accommodation_usage', `select=id,partner_code,deduct_amount,usage_type&partner_code=eq.${encodeURIComponent(partnerCode)}&order=id.desc&limit=1`);
    ensure(usageRecords.length > 0, 'Usage record should exist');
    const usageId = usageRecords[0].id;
    log('  Usage record:', JSON.stringify(usageRecords[0]));
    ensure(Number(usageRecords[0].deduct_amount) === 500, `Usage deduct_amount should be 500, got ${usageRecords[0].deduct_amount}`);
    result.steps.usage_record = { usage_id: usageId, deduct_amount: 500 };

    // Step 6: cancel_accommodation_usage → verify available=2500, used=0
    log('STEP 6: Cancel accommodation usage');
    await apiAction('cancel_accommodation_usage', {
      usage_id: usageId,
      partner_code: partnerCode,
      refund_amount: 500,
      reason: `PLC_CANCEL_${suffix}`
    });
    partner = await getPartner();
    log('  After cancel:', JSON.stringify(partner));
    ensure(Number(partner.available_points) === 2500, `available_points should be 2500, got ${partner.available_points}`);
    ensure(Number(partner.points_used) === 0, `points_used should be 0, got ${partner.points_used}`);
    let payoutCountAfterCancel = await countPayouts();
    result.steps.after_cancel = { available_points: 2500, points_used: 0, payouts: payoutCountAfterCancel };

    // Verify usage record is now REFUNDED
    const usageAfterCancel = (await supabaseQuery('accommodation_usage', `select=id,usage_type&id=eq.${usageId}`))[0];
    ensure(usageAfterCancel.usage_type === 'REFUNDED', `Usage should be REFUNDED, got ${usageAfterCancel.usage_type}`);

    // Step 7: convert_points_to_cash with points_used=2000 → available=500, used=2000, pending_commission=1000
    log('STEP 7: Convert 2000 points to cash');
    await apiAction('convert_points_to_cash', {
      partner_code: partnerCode,
      points_used: 2000
    });
    partner = await getPartner();
    log('  After convert:', JSON.stringify(partner));
    ensure(Number(partner.available_points) === 500, `available_points should be 500, got ${partner.available_points}`);
    ensure(Number(partner.points_used) === 2000, `points_used should be 2000, got ${partner.points_used}`);
    ensure(Number(partner.pending_commission) === 1000, `pending_commission should be 1000, got ${partner.pending_commission}`);
    let payoutCountAfterConvert = await countPayouts();
    result.steps.after_convert = { available_points: 500, points_used: 2000, pending_commission: 1000, payouts: payoutCountAfterConvert };

    // Step 8: revert_cash_to_points with amount=1000 → available=2500, used=0, pending_commission=0
    log('STEP 8: Revert 1000 cash to points');
    await apiAction('revert_cash_to_points', {
      partner_code: partnerCode,
      amount: 1000
    });
    partner = await getPartner();
    log('  After revert:', JSON.stringify(partner));
    ensure(Number(partner.available_points) === 2500, `available_points should be 2500, got ${partner.available_points}`);
    ensure(Number(partner.points_used) === 0, `points_used should be 0 after revert, got ${partner.points_used}`);
    ensure(Number(partner.pending_commission) === 0, `pending_commission should be 0, got ${partner.pending_commission}`);
    let payoutCountAfterRevert = await countPayouts();
    result.steps.after_revert = { available_points: 2500, points_used: 0, pending_commission: 0, payouts: payoutCountAfterRevert };

    // Step 9: Count payouts records — should have grown at each step
    log('STEP 9: Verify payout audit trail');
    const allPayouts = await supabaseQuery('payouts', `select=id,payout_type,amount,payout_status&partner_code=eq.${encodeURIComponent(partnerCode)}&order=id.asc`);
    log('  All payouts:', JSON.stringify(allPayouts));
    ensure(allPayouts.length >= 3, `Should have at least 3 payout records (commission, conversion, revert), got ${allPayouts.length}`);
    result.steps.payout_audit = {
      total_payouts: allPayouts.length,
      types: allPayouts.map(p => p.payout_type),
      growth: {
        after_confirm: payoutCount,
        after_use: payoutCountAfterUse,
        after_cancel: payoutCountAfterCancel,
        after_convert: payoutCountAfterConvert,
        after_revert: payoutCountAfterRevert
      }
    };

    fs.mkdirSync(path.dirname(artifactFile), { recursive: true });
    fs.writeFileSync(artifactFile, JSON.stringify(result, null, 2));
    log('E2E_POINTS_FULL_LIFECYCLE_RESULT PASS', artifactFile);
    await cleanup();
  } catch (error) {
    log('E2E_POINTS_FULL_LIFECYCLE_RESULT FAIL', error.stack || error.message);
    try { fs.mkdirSync(path.dirname(artifactFile), { recursive: true }); fs.writeFileSync(artifactFile, JSON.stringify({ error: error.stack || error.message, partial: result }, null, 2)); } catch (_) {}
    await cleanup().catch(() => {});
    process.exitCode = 1;
  }
})();
