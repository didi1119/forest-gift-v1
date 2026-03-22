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
  crosslvl: `cl${suffix}`
};
const artifactFile = path.join('/tmp/codex-browser-test', `cross-level-commission-${ts}.json`);

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

    // --- Setup: create LV1 partner with ACCOMMODATION preference ---
    log('Creating LV1 partner', codes.crosslvl);
    await apiAction('create_partner', {
      partner_code: codes.crosslvl,
      coupon_code: `CP${codes.crosslvl.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `CrossLevel ${suffix}`,
      phone: '0912333001',
      email: `${codes.crosslvl}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION'
    });

    // Commission tracking per booking
    // Level promotion logic:
    //   - calculateCommission uses partner's current level (before this booking's update)
    //   - updatePartnerAfterCheckin includes current booking as extra to determine new level
    //   - So the 4th booking gets LV1 rate, but promotes to LV2 afterward
    //   - The 10th booking gets LV2 rate, but promotes to LV3 afterward
    //
    // Expected per-booking commission (ACCOMMODATION preference):
    //   Booking  1: LV1 1000 + first_referral_bonus 1500 = 2500
    //   Booking  2: LV1 1000
    //   Booking  3: LV1 1000
    //   Booking  4: LV1 1000 (promotes to LV2 after)
    //   Booking  5: LV2 1200
    //   Booking  6: LV2 1200
    //   Booking  7: LV2 1200
    //   Booking  8: LV2 1200
    //   Booking  9: LV2 1200
    //   Booking 10: LV2 1200 (promotes to LV3 after)
    //
    // Total = 2500 + 1000*3 + 1200*6 = 2500 + 3000 + 7200 = 12700

    const expectedCommissions = [2500, 1000, 1000, 1000, 1200, 1200, 1200, 1200, 1200, 1200];
    const expectedTotal = expectedCommissions.reduce((a, b) => a + b, 0); // 12700
    const bookingIds = [];
    const commissionResults = [];

    for (let i = 1; i <= 10; i++) {
      log(`--- Booking ${i}/10 ---`);

      // Create booking
      const created = await apiAction('create_booking', {
        partner_code: codes.crosslvl,
        guest_name: `CROSSLVL_G${i}_${suffix}`,
        guest_phone: `091233${String(3000 + i)}`,
        guest_email: `crosslvl_g${i}_${suffix}@example.com`,
        bank_account_last5: String(10000 + i).slice(-5),
        checkin_date: `2026-03-${String(i).padStart(2, '0')}`,
        checkout_date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        room_price: '5000',
        booking_source: 'REFERRAL',
        stay_status: 'CHECKED_IN',
        payment_status: 'PAID'
      });
      const bookingId = created.booking_id || created.data.id;
      bookingIds.push(bookingId);

      // Confirm checkin
      const confirmResult = await apiAction('confirm_checkin_completion', {
        booking_id: bookingId,
        confirmed_by: `E2E_CROSSLVL_${i}`
      });

      // Query the booking from DB to verify commission
      const bookingRecord = (await supabaseQuery('bookings', `select=id,commission_amount,commission_type,is_first_referral_bonus,first_referral_bonus_amount&id=eq.${bookingId}`))[0];
      const actualCommission = Number(bookingRecord.commission_amount);
      const expected = expectedCommissions[i - 1];

      log(`Booking ${i}: commission=${actualCommission}, expected=${expected}, is_first_bonus=${bookingRecord.is_first_referral_bonus}, first_bonus_amount=${bookingRecord.first_referral_bonus_amount}`);

      ensure(actualCommission === expected, `Booking ${i}: commission should be ${expected}, got ${actualCommission}`);

      // Verify first referral bonus on booking 1
      if (i === 1) {
        const firstBonusAmount = Number(bookingRecord.first_referral_bonus_amount) || 0;
        ensure(firstBonusAmount === 1500, `Booking 1: first_referral_bonus_amount should be 1500, got ${firstBonusAmount}`);
        log('Booking 1: first referral bonus verified (1500)');
      }

      // Check partner level after booking 4 (should be LV2)
      if (i === 4) {
        const partner4 = (await supabaseQuery('partners', `select=partner_code,partner_level,level,yearly_referrals,successful_referrals&partner_code=eq.${encodeURIComponent(codes.crosslvl)}&limit=1`))[0];
        const level4 = partner4.partner_level || partner4.level;
        ensure(level4 === 'LV2_GUIDE', `After booking 4: level should be LV2_GUIDE, got ${level4}`);
        log('After booking 4: level promoted to LV2_GUIDE');
      }

      // Check partner level after booking 10 (should be LV3)
      if (i === 10) {
        const partner10 = (await supabaseQuery('partners', `select=partner_code,partner_level,level,yearly_referrals,successful_referrals&partner_code=eq.${encodeURIComponent(codes.crosslvl)}&limit=1`))[0];
        const level10 = partner10.partner_level || partner10.level;
        ensure(level10 === 'LV3_GUARDIAN', `After booking 10: level should be LV3_GUARDIAN, got ${level10}`);
        log('After booking 10: level promoted to LV3_GUARDIAN');
      }

      commissionResults.push({
        booking: i,
        bookingId,
        expectedCommission: expected,
        actualCommission,
        isFirstBonus: bookingRecord.is_first_referral_bonus,
        firstBonusAmount: Number(bookingRecord.first_referral_bonus_amount) || 0
      });
    }

    // --- Final verification ---
    log('--- Final verification ---');
    const finalPartner = (await supabaseQuery('partners', `select=partner_code,partner_level,level,yearly_referrals,successful_referrals,total_successful_referrals,total_commission_earned,available_points&partner_code=eq.${encodeURIComponent(codes.crosslvl)}&limit=1`))[0];

    const finalLevel = finalPartner.partner_level || finalPartner.level;
    ensure(finalLevel === 'LV3_GUARDIAN', `Final: level should be LV3_GUARDIAN, got ${finalLevel}`);

    const yearlyReferrals = parseInt(finalPartner.yearly_referrals) || 0;
    ensure(yearlyReferrals === 10, `Final: yearly_referrals should be 10, got ${yearlyReferrals}`);

    const totalEarned = Number(finalPartner.total_commission_earned) || 0;
    ensure(totalEarned === expectedTotal, `Final: total_commission_earned should be ${expectedTotal}, got ${totalEarned}`);

    // With ACCOMMODATION preference, all commissions go to available_points
    const availablePoints = Number(finalPartner.available_points) || 0;
    ensure(availablePoints === expectedTotal, `Final: available_points should be ${expectedTotal}, got ${availablePoints}`);

    log(`Final partner state: level=${finalLevel}, yearly=${yearlyReferrals}, total_earned=${totalEarned}, available_points=${availablePoints}`);

    result.scenarios.commissionResults = commissionResults;
    result.scenarios.finalPartner = finalPartner;
    result.scenarios.expectedTotal = expectedTotal;

    fs.mkdirSync(path.dirname(artifactFile), { recursive: true });
    fs.writeFileSync(artifactFile, JSON.stringify(result, null, 2));
    log('E2E_CROSS_LEVEL_COMMISSION PASS', artifactFile);
    await cleanup();
  } catch (error) {
    log('E2E_CROSS_LEVEL_COMMISSION FAIL', error.stack || error.message);
    try { fs.mkdirSync(path.dirname(artifactFile), { recursive: true }); fs.writeFileSync(artifactFile, JSON.stringify({ error: error.stack || error.message, partial: result }, null, 2)); } catch (_) {}
    await cleanup().catch(() => {});
    process.exitCode = 1;
  }
})();
