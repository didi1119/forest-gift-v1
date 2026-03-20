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
  usage: `au${suffix}`,
  refund: `pr${suffix}`,
  batch: `bc${suffix}`
};
const artifactFile = path.join('/tmp/codex-browser-test', `api-edge-${ts}.json`);

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
async function apiJsonAction(action, payload) {
  const res = await fetch(`${apiBase}?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(payload || {}), admin_secret: adminSecret })
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

    // Scenario 1: cancel_accommodation_usage
    await apiAction('create_partner', {
      partner_code: codes.usage,
      coupon_code: `CP${codes.usage.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `Usage ${suffix}`,
      phone: '0911000101',
      email: `${codes.usage}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION'
    });
    const usageBooking = await apiAction('create_booking', {
      partner_code: codes.usage,
      guest_name: `USE_${suffix}`,
      guest_phone: '0911000102',
      guest_email: `use${suffix}@example.com`,
      bank_account_last5: '11111',
      checkin_date: '2026-03-18',
      checkout_date: '2026-03-19',
      room_price: '5000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID'
    });
    const usageBookingId = usageBooking.booking_id || usageBooking.data.id;
    await apiAction('confirm_checkin_completion', { booking_id: usageBookingId, confirmed_by: 'EDGE_USAGE' });
    await apiAction('use_accommodation_points', {
      partner_code: codes.usage,
      deduct_amount: 1000,
      guest_name: `SELF_USE_${suffix}`,
      checkin_date: '2026-03-20',
      checkout_date: '2026-03-21',
      notes: `USE_POINTS_${suffix}`
    });
    const usageRecord = (await supabaseQuery('accommodation_usage', `select=id,partner_code,deduct_amount,usage_type,notes&partner_code=eq.${encodeURIComponent(codes.usage)}&order=id.desc&limit=1`))[0];
    ensure(usageRecord && Number(usageRecord.deduct_amount) === 1000, `usage record missing: ${JSON.stringify(usageRecord)}`);
    await apiAction('cancel_accommodation_usage', {
      usage_id: usageRecord.id,
      partner_code: codes.usage,
      refund_amount: 1000,
      reason: `EDGE_CANCEL_USAGE_${suffix}`
    });
    const usagePartner = (await supabaseQuery('partners', `select=partner_code,available_points,points_used&partner_code=eq.${encodeURIComponent(codes.usage)}&limit=1`))[0];
    const usageAfter = (await supabaseQuery('accommodation_usage', `select=id,usage_type,notes&id=eq.${usageRecord.id}`))[0];
    const usagePayouts = await supabaseQuery('payouts', `select=payout_type,amount,payout_status,notes&partner_code=eq.${encodeURIComponent(codes.usage)}&order=id.asc`);
    ensure(Number(usagePartner.available_points) === 2500, `usage partner points mismatch: ${JSON.stringify(usagePartner)}`);
    ensure(Number(usagePartner.points_used) === 0, `usage partner points_used mismatch: ${JSON.stringify(usagePartner)}`);
    ensure(usageAfter.usage_type === 'REFUNDED', `usage type mismatch: ${JSON.stringify(usageAfter)}`);
    ensure(usagePayouts.some(p => p.payout_type === 'POINTS_REFUND' && Number(p.amount) === 1000), `usage refund payout missing: ${JSON.stringify(usagePayouts)}`);
    result.scenarios.cancel_accommodation_usage = { usagePartner, usageAfter, usagePayouts };

    // Scenario 2: partial_refund
    await apiAction('create_partner', {
      partner_code: codes.refund,
      coupon_code: `CP${codes.refund.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `Refund ${suffix}`,
      phone: '0911000103',
      email: `${codes.refund}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'CASH'
    });
    const refundBooking = await apiAction('create_booking', {
      partner_code: codes.refund,
      guest_name: `REFUND_${suffix}`,
      guest_phone: '0911000104',
      guest_email: `refund${suffix}@example.com`,
      bank_account_last5: '22222',
      checkin_date: '2026-03-18',
      checkout_date: '2026-03-19',
      room_price: '5000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID'
    });
    const refundBookingId = refundBooking.booking_id || refundBooking.data.id;
    await apiAction('confirm_checkin_completion', { booking_id: refundBookingId, confirmed_by: 'EDGE_REFUND' });
    await apiAction('partial_refund', { booking_id: refundBookingId, refund_amount: 500, reason: `EDGE_PARTIAL_${suffix}` });
    const refundBookingAfter = (await supabaseQuery('bookings', `select=id,room_price,notes,commission_amount,commission_type&id=eq.${refundBookingId}`))[0];
    const refundPayouts = await supabaseQuery('payouts', `select=payout_type,amount,notes,related_booking_ids&partner_code=eq.${encodeURIComponent(codes.refund)}&order=id.asc`);
    ensure(Number(refundBookingAfter.room_price) === 4500, `partial refund price mismatch: ${JSON.stringify(refundBookingAfter)}`);
    ensure(refundPayouts.some(p => p.payout_type === 'PARTIAL_REFUND' && String(p.related_booking_ids) === String(refundBookingId)), `partial refund payout missing: ${JSON.stringify(refundPayouts)}`);
    result.scenarios.partial_refund = { refundBookingAfter, refundPayouts };

    // Scenario 3: batch_cancel
    await apiAction('create_partner', {
      partner_code: codes.batch,
      coupon_code: `CP${codes.batch.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `Batch ${suffix}`,
      phone: '0911000105',
      email: `${codes.batch}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION'
    });
    const batchIds = [];
    for (let i = 1; i <= 2; i += 1) {
      const created = await apiAction('create_booking', {
        partner_code: codes.batch,
        guest_name: `BATCH_${i}_${suffix}`,
        guest_phone: `09110001${10 + i}`,
        guest_email: `batch${i}${suffix}@example.com`,
        bank_account_last5: '33333',
        checkin_date: '2026-03-18',
        checkout_date: '2026-03-19',
        room_price: '5000',
        booking_source: 'REFERRAL',
        stay_status: 'CHECKED_IN',
        payment_status: 'PAID'
      });
      const bookingId = created.booking_id || created.data.id;
      batchIds.push(bookingId);
      await apiAction('confirm_checkin_completion', { booking_id: bookingId, confirmed_by: 'EDGE_BATCH' });
    }
    await apiJsonAction('batch_cancel', { booking_ids: batchIds, reason: `EDGE_BATCH_${suffix}` });
    const batchBookings = await supabaseQuery('bookings', `select=id,guest_name,stay_status,commission_status&partner_code=eq.${encodeURIComponent(codes.batch)}&order=id.asc`);
    const batchPayouts = await supabaseQuery('payouts', `select=payout_type,amount,related_booking_ids,notes&partner_code=eq.${encodeURIComponent(codes.batch)}&order=id.asc`);
    ensure(batchBookings.length === 2 && batchBookings.every(b => b.stay_status === 'CANCELLED'), `batch cancel bookings mismatch: ${JSON.stringify(batchBookings)}`);
    ensure(batchPayouts.filter(p => p.payout_type === 'COMMISSION_REVERSAL').length >= 2, `batch cancel reversals missing: ${JSON.stringify(batchPayouts)}`);
    result.scenarios.batch_cancel = { batchBookings, batchPayouts };

    fs.writeFileSync(artifactFile, JSON.stringify(result, null, 2));
    log('E2E_API_EDGE_RESULT PASS', artifactFile);
    await cleanup();
  } catch (error) {
    log('E2E_API_EDGE_RESULT FAIL', error.stack || error.message);
    try { fs.writeFileSync(artifactFile, JSON.stringify({ error: error.stack || error.message, partial: result }, null, 2)); } catch (_) {}
    await cleanup().catch(() => {});
    process.exitCode = 1;
  }
})();
