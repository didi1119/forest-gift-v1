const fs = require('fs');
const path = require('path');

const apiBase = process.env.API_BASE || 'https://forest-ambassador.vercel.app/api';
const adminSecret = process.env.ADMIN_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!adminSecret || !supabaseUrl || !supabaseKey) throw new Error('Missing env');

const ts = Date.now();
const suffix = String(ts).slice(-6);
const partnerCode = `ld${suffix}`;
const artifactFile = path.join('/tmp/codex-browser-test', `level-demotion-${ts}.json`);

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
  const rows = await supabaseQuery('partners', `select=partner_code,partner_level,yearly_referrals,total_successful_referrals,available_points&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`);
  return rows[0];
}

(async () => {
  const result = { artifactFile, steps: {} };
  try {
    await cleanup().catch(() => {});

    // Step 1: Create partner at LV1
    log('STEP 1: Create partner');
    await apiAction('create_partner', {
      partner_code: partnerCode,
      coupon_code: `CP${partnerCode.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `Demotion ${suffix}`,
      phone: '0911300001',
      email: `${partnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION'
    });

    // Step 2: Create 10 bookings, confirm all 10
    log('STEP 2: Create and confirm 10 bookings');
    const bookingIds = [];
    for (let i = 1; i <= 10; i++) {
      const created = await apiAction('create_booking', {
        partner_code: partnerCode,
        guest_name: `DEM_G${String(i).padStart(2, '0')}_${suffix}`,
        guest_phone: `091130${String(i).padStart(4, '0')}`,
        guest_email: `dem_g${i}_${suffix}@example.com`,
        bank_account_last5: `${String(i).padStart(2, '0')}111`,
        checkin_date: `2026-03-${String(i).padStart(2, '0')}`,
        checkout_date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        room_price: '5000',
        booking_source: 'REFERRAL',
        stay_status: 'CHECKED_IN',
        payment_status: 'PAID'
      });
      const bookingId = created.booking_id || created.data.id;
      bookingIds.push(bookingId);
      await apiAction('confirm_checkin_completion', { booking_id: bookingId, confirmed_by: `DEM_E2E_${i}` });
      log(`  Booking ${i} confirmed: ${bookingId}`);
    }

    // Step 3: Verify partner is LV3_GUARDIAN with yearly_referrals=10
    log('STEP 3: Verify LV3 after 10 referrals');
    let partner = await getPartner();
    log('  Partner:', JSON.stringify(partner));
    ensure(partner.partner_level === 'LV3_GUARDIAN', `Should be LV3_GUARDIAN, got ${partner.partner_level}`);
    ensure(Number(partner.yearly_referrals) === 10, `yearly_referrals should be 10, got ${partner.yearly_referrals}`);
    result.steps.after_10_confirms = { level: partner.partner_level, yearly_referrals: Number(partner.yearly_referrals) };

    // Backend uses simulatePartnerLevelSnapshot which re-simulates the entire year's progression.
    // When bookings are deleted, it recalculates from scratch using LEVEL_REQUIREMENTS thresholds.
    // So with 9 referrals (< LV3 threshold of 10), the partner immediately drops to LV2.
    // This means "retention thresholds" only apply during year-end evaluation, NOT during mid-year deletion.

    // Step 4: Delete booking 10 -> yearly_referrals=9, drops to LV2 (9 < LV3 threshold 10)
    log('STEP 4: Delete booking 10 (yearly=9)');
    await apiAction('delete_booking', { booking_id: bookingIds[9] });
    partner = await getPartner();
    log('  Partner after delete 10:', JSON.stringify(partner));
    ensure(Number(partner.yearly_referrals) === 9, `yearly_referrals should be 9, got ${partner.yearly_referrals}`);
    // Backend re-simulates: 9 < LV3 threshold (10), so drops below LV3. At 4th booking it reached LV2, and 9 >= LV2 threshold (4), so stays LV2.
    ensure(partner.partner_level === 'LV2_GUIDE', `Should be LV2_GUIDE at 9 (below LV3 threshold 10), got ${partner.partner_level}`);
    result.steps.after_delete_10 = { level: partner.partner_level, yearly_referrals: Number(partner.yearly_referrals) };

    // Step 5: Delete bookings 9,8,7,6 -> yearly_referrals=5, still LV2 (5 >= LV2 threshold 4)
    log('STEP 5: Delete bookings 9,8,7,6 (yearly=5)');
    for (const idx of [8, 7, 6, 5]) {
      await apiAction('delete_booking', { booking_id: bookingIds[idx] });
      log(`  Deleted booking ${idx + 1}`);
    }
    partner = await getPartner();
    log('  Partner after deletes:', JSON.stringify(partner));
    ensure(Number(partner.yearly_referrals) === 5, `yearly_referrals should be 5, got ${partner.yearly_referrals}`);
    ensure(partner.partner_level === 'LV2_GUIDE', `Should still be LV2_GUIDE at 5 (>= LV2 threshold 4), got ${partner.partner_level}`);
    result.steps.after_delete_9876 = { level: partner.partner_level, yearly_referrals: Number(partner.yearly_referrals) };

    // Step 6: Delete booking 5 -> yearly_referrals=4, still LV2 (4 >= LV2 threshold 4)
    log('STEP 6: Delete booking 5 (yearly=4, exactly at LV2 threshold)');
    await apiAction('delete_booking', { booking_id: bookingIds[4] });
    partner = await getPartner();
    log('  Partner after delete 5:', JSON.stringify(partner));
    ensure(Number(partner.yearly_referrals) === 4, `yearly_referrals should be 4, got ${partner.yearly_referrals}`);
    ensure(partner.partner_level === 'LV2_GUIDE', `Should still be LV2_GUIDE at 4 (exactly threshold), got ${partner.partner_level}`);
    result.steps.after_delete_5 = { level: partner.partner_level, yearly_referrals: Number(partner.yearly_referrals) };

    // Step 7: Delete booking 4 -> yearly_referrals=3, drops to LV1 (3 < LV2 threshold 4)
    log('STEP 7: Delete booking 4 (yearly=3, expect LV1)');
    await apiAction('delete_booking', { booking_id: bookingIds[3] });
    partner = await getPartner();
    log('  Partner after delete 4:', JSON.stringify(partner));
    ensure(Number(partner.yearly_referrals) === 3, `yearly_referrals should be 3, got ${partner.yearly_referrals}`);
    ensure(partner.partner_level === 'LV1_INSIDER', `Should be LV1_INSIDER at 3 (below LV2 threshold 4), got ${partner.partner_level}`);
    result.steps.after_delete_4 = { level: partner.partner_level, yearly_referrals: Number(partner.yearly_referrals) };

    // Step 8: Delete more bookings -> verify stays LV1
    log('STEP 8: Delete bookings 3,2 (yearly=1)');
    for (const idx of [2, 1]) {
      await apiAction('delete_booking', { booking_id: bookingIds[idx] });
      log(`  Deleted booking ${idx + 1}`);
    }
    partner = await getPartner();
    log('  Partner after delete 3,2:', JSON.stringify(partner));
    ensure(Number(partner.yearly_referrals) === 1, `yearly_referrals should be 1, got ${partner.yearly_referrals}`);
    ensure(partner.partner_level === 'LV1_INSIDER', `Should be LV1_INSIDER at 1, got ${partner.partner_level}`);
    result.steps.after_delete_32 = { level: partner.partner_level, yearly_referrals: Number(partner.yearly_referrals) };

    // Step 10: Final verification
    log('STEP 10: Final level verification');
    const finalLevel = partner.partner_level;
    result.steps.final = { level: finalLevel, yearly_referrals: Number(partner.yearly_referrals) };

    // Summary: Backend uses re-simulation from scratch (LEVEL_REQUIREMENTS thresholds)
    // LV3 requires 10, LV2 requires 4. Retention thresholds only apply at year-end.
    result.demotion_behavior = 'AUTOMATIC_VIA_RESIMULATION';
    log('DEMOTION BEHAVIOR: Automatic via level re-simulation on delete');

    fs.mkdirSync(path.dirname(artifactFile), { recursive: true });
    fs.writeFileSync(artifactFile, JSON.stringify(result, null, 2));
    log('E2E_LEVEL_DEMOTION_RESULT PASS', artifactFile);
    await cleanup();
  } catch (error) {
    log('E2E_LEVEL_DEMOTION_RESULT FAIL', error.stack || error.message);
    try { fs.mkdirSync(path.dirname(artifactFile), { recursive: true }); fs.writeFileSync(artifactFile, JSON.stringify({ error: error.stack || error.message, partial: result }, null, 2)); } catch (_) {}
    await cleanup().catch(() => {});
    process.exitCode = 1;
  }
})();
