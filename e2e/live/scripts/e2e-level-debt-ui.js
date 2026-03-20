const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const siteOrigin = process.env.SITE_ORIGIN || 'https://forest-ambassador.vercel.app';
const baseUrl = process.env.BASE_URL || `${siteOrigin}/frontend/admin/admin-dashboard-real.html`;
const apiBase = process.env.API_BASE || `${siteOrigin}/api`;
const adminSecret = process.env.ADMIN_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!adminSecret || !supabaseUrl || !supabaseKey) throw new Error('Missing env');

const ts = Date.now();
const suffix = String(ts).slice(-6);
const screenshotsDir = path.join('/tmp/codex-browser-test', `level-debt-${ts}`);
fs.mkdirSync(screenshotsDir, { recursive: true });

const codes = {
  upLv2: `u2${suffix}`,
  upLv3: `u3${suffix}`,
  debtCash: `dc${suffix}`,
  debtPoints: `dp${suffix}`
};

function log(...args) { console.log(new Date().toISOString(), ...args); }
async function shot(page, name) {
  const file = path.join(screenshotsDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled', timeout: 10000 });
  log('SCREENSHOT', file);
}
function ensure(cond, msg) { if (!cond) throw new Error(msg); }
function includes(text, needle, label) { if (!String(text).includes(needle)) throw new Error(`${label} missing ${needle}\nActual:\n${text}`); }
async function waitFor(check, timeoutMs = 30000, intervalMs = 800) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await check();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}
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
async function supabaseDelete(table, query) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  if (!res.ok && res.status !== 204) throw new Error(`Supabase delete ${table} failed: ${await res.text()}`);
}
async function createCompletedBooking(partnerCode, guestName, phone, email, note) {
  const bookingId = await createCheckinBooking(partnerCode, guestName, phone, email, note);
  await apiAction('confirm_checkin_completion', { booking_id: bookingId, confirmed_by: 'E2E_SEED' });
  return bookingId;
}
async function seedCompletedReferrals(partnerCode, count, prefix) {
  for (let index = 1; index <= count; index += 1) {
    const guestName = `${prefix}${String(index).padStart(2, '0')}_${suffix}`;
    await createCompletedBooking(
      partnerCode,
      guestName,
      `09${String(index).padStart(8, '0')}`,
      `${guestName}@example.com`,
      `seed completed referral ${index}/${count}`,
    );
  }
}
async function cleanup() {
  for (const code of Object.values(codes)) {
    await supabaseDelete('accommodation_usage', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDelete('payouts', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDelete('bookings', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDelete('clicks', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDelete('partners', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    log('CLEANED', code);
  }
}
async function createCheckinBooking(partnerCode, guestName, phone, email, note) {
  const created = await apiAction('create_booking', {
    partner_code: partnerCode,
    guest_name: guestName,
    guest_phone: phone,
    guest_email: email,
    bank_account_last5: '12345',
    checkin_date: '2026-03-10',
    checkout_date: '2026-03-11',
    room_price: '5000',
    booking_source: 'REFERRAL',
    stay_status: 'CHECKED_IN',
    payment_status: 'PAID',
    notes: note
  });
  return created.booking_id || (created.data && created.data.id);
}
async function refreshDashboard(page) {
  const resp = page.waitForResponse(response => {
    const body = response.request().postData() || '';
    return response.url().includes('/api') && response.request().method() === 'POST' && body.includes('action=get_dashboard_data') && response.status() === 200;
  }, { timeout: 30000 });
  await page.evaluate(() => loadRealData(true));
  await resp;
  await page.waitForTimeout(1000);
}
async function showBookingsFor(page, searchTerm) {
  await page.evaluate(() => window.showTab('bookings'));
  await page.waitForTimeout(300);
  await page.selectOption('#bookingStatusFilter', '');
  await page.evaluate(({ searchTerm }) => {
    document.getElementById('searchBooking').value = searchTerm;
    filterBookings();
  }, { searchTerm });
  await page.waitForTimeout(800);
}
async function showPayouts(page) {
  await page.evaluate(() => window.showTab('payouts'));
  await page.waitForTimeout(800);
}

async function hardReload(page) {
  const resp = page.waitForResponse(response => {
    const body = response.request().postData() || '';
    return response.url().includes('/api') && response.request().method() === 'POST' && body.includes('action=get_dashboard_data') && response.status() === 200;
  }, { timeout: 30000 });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await resp;
  await page.waitForTimeout(1200);
}
async function confirmSingleVisibleBooking(page, expectedDialogText) {
  let lastDialogMessage = '';
  const listener = async dialog => {
    lastDialogMessage = dialog.message();
    log('DIALOG', dialog.type(), dialog.message());
    if (dialog.type() === 'prompt') await dialog.accept(adminSecret);
    else await dialog.accept();
  };
  page.once('dialog', listener);
  await page.getByRole('button', { name: /確認入住/ }).click();
  await page.waitForTimeout(500);
  includes(lastDialogMessage, expectedDialogText, 'confirm dialog');
}
async function deleteSingleVisibleBooking(page) {
  page.once('dialog', async dialog => {
    log('DIALOG', dialog.type(), dialog.message());
    await dialog.accept();
  });
  await page.getByRole('button', { name: /刪除訂單|🗑️ 刪除訂單/ }).click().catch(async () => {
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('刪除訂單'));
      if (!button) throw new Error('Delete button not found');
      button.click();
    });
  });
}

(async () => {
  let browser;
  try {
    await cleanup().catch(() => {});

    await apiAction('create_partner', {
      partner_code: codes.upLv2,
      coupon_code: `CP${codes.upLv2.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `Upgrade LV2 ${suffix}`,
      phone: '0911000001',
      email: `${codes.upLv2}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION',
    });

    await apiAction('create_partner', {
      partner_code: codes.upLv3,
      coupon_code: `CP${codes.upLv3.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `Upgrade LV3 ${suffix}`,
      phone: '0911000002',
      email: `${codes.upLv3}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'CASH',
    });

    await apiAction('create_partner', {
      partner_code: codes.debtCash,
      coupon_code: `CP${codes.debtCash.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `Debt Cash ${suffix}`,
      phone: '0911000003',
      email: `${codes.debtCash}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'CASH'
    });

    await apiAction('create_partner', {
      partner_code: codes.debtPoints,
      coupon_code: `CP${codes.debtPoints.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `Debt Points ${suffix}`,
      phone: '0911000004',
      email: `${codes.debtPoints}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION'
    });

    await seedCompletedReferrals(codes.upLv2, 3, 'SL2');
    await seedCompletedReferrals(codes.upLv3, 9, 'SL3');
    await seedCompletedReferrals(codes.debtPoints, 1, 'SDP');

    const upLv2Booking4Name = `UL2A_${suffix}`;
    const upLv2Booking5Name = `UL2B_${suffix}`;
    const upLv2Booking4Id = await createCheckinBooking(codes.upLv2, upLv2Booking4Name, '0911000011', `${upLv2Booking4Name}@example.com`, 'upgrade to lv2 booking4');

    const upLv3Booking10Name = `UL3A_${suffix}`;
    const upLv3Booking11Name = `UL3B_${suffix}`;
    const upLv3Booking10Id = await createCheckinBooking(codes.upLv3, upLv3Booking10Name, '0911000012', `${upLv3Booking10Name}@example.com`, 'upgrade to lv3 booking10');

    const debtCashBookingName = `DC_${suffix}`;
    const debtCashBookingId = await createCheckinBooking(codes.debtCash, debtCashBookingName, '0911000013', `${debtCashBookingName}@example.com`, 'debt cash booking');
    await apiAction('confirm_checkin_completion', { booking_id: debtCashBookingId, confirmed_by: 'DEBT_CASH' });
    await apiAction('process_payout', { partner_code: codes.debtCash, amount: 500, notes: `settle ${suffix}` });

    const debtPointsBookingName = `DP_${suffix}`;
    const debtPointsBookingId = await createCheckinBooking(codes.debtPoints, debtPointsBookingName, '0911000014', `${debtPointsBookingName}@example.com`, 'debt points booking');
    await apiAction('confirm_checkin_completion', { booking_id: debtPointsBookingId, confirmed_by: 'DEBT_POINTS' });
    await apiAction('use_accommodation_points', {
      partner_code: codes.debtPoints,
      deduct_amount: 3500,
      guest_name: `SELF_${suffix}`,
      checkin_date: '2026-03-20',
      checkout_date: '2026-03-21',
      notes: `consume earned points ${suffix}`
    });

    browser = await chromium.launch({ executablePath: chromePath, headless: false, args: ['--disable-notifications', '--disable-popup-blocking'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();

    page.on('dialog', async dialog => {
      log('DIALOG', dialog.type(), dialog.message());
      if (dialog.type() === 'prompt') await dialog.accept(adminSecret);
      else await dialog.accept();
    });
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) log(`BROWSER_${message.type().toUpperCase()}`, message.text());
    });
    page.on('pageerror', error => log('PAGEERROR', error.stack || error.message));
    page.on('response', async response => {
      if (!response.url().includes('/api')) return;
      const body = response.request().postData() || '';
      let text = '';
      try { text = await response.text(); } catch (_) {}
      log('API', response.status(), response.request().method(), 'REQ=', body.slice(0, 200), 'RESP=', text.slice(0, 220));
    });

    const initial = page.waitForResponse(response => {
      const body = response.request().postData() || '';
      return response.url().includes('/api') && response.request().method() === 'POST' && body.includes('action=get_dashboard_data') && response.status() === 200;
    }, { timeout: 30000 });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await initial;
    await page.waitForTimeout(1200);

    // LV1 -> LV2
    await showBookingsFor(page, upLv2Booking4Name);
    const lv2Before = await page.locator('#bookingsTable').innerText();
    includes(lv2Before, '$1000', 'LV2 upgrade booking4 preview');
    await shot(page, '01_lv1_to_lv2_before_confirm');
    await page.getByRole('button', { name: /確認入住/ }).click();
    await waitFor(async () => {
      const rows = await supabaseQuery('partners', `select=partner_code,partner_level,yearly_referrals,successful_referrals&partner_code=eq.${encodeURIComponent(codes.upLv2)}`);
      return rows[0] && rows[0].partner_level === 'LV2_GUIDE' && Number(rows[0].yearly_referrals) === 4 ? rows[0] : null;
    });
    const upLv2Booking5Id = await createCheckinBooking(codes.upLv2, upLv2Booking5Name, '0911000015', `${upLv2Booking5Name}@example.com`, 'after upgrade lv2 booking5');
    await waitFor(async () => {
      const rows = await supabaseQuery('bookings', `select=id,guest_name,stay_status&partner_code=eq.${encodeURIComponent(codes.upLv2)}&id=eq.${upLv2Booking5Id}`);
      return rows[0] ? rows[0] : null;
    });
    await refreshDashboard(page);
    await showBookingsFor(page, upLv2Booking5Name);
    let lv2After = await page.locator('#bookingsTable').innerText();
    if (lv2After.includes('尚未有任何訂單')) {
      await hardReload(page);
      await showBookingsFor(page, upLv2Booking5Name);
      lv2After = await page.locator('#bookingsTable').innerText();
    }
    includes(lv2After, '$1200', 'LV2 upgrade booking5 preview');
    includes(lv2After, 'LV2 森林嚮導', 'LV2 label after upgrade');
    await shot(page, '02_lv1_to_lv2_after_upgrade');

    // LV2 -> LV3
    await showBookingsFor(page, upLv3Booking10Name);
    const lv3Before = await page.locator('#bookingsTable').innerText();
    includes(lv3Before, '$600', 'LV3 upgrade booking10 preview cash');
    await shot(page, '03_lv2_to_lv3_before_confirm');
    await page.getByRole('button', { name: /確認入住/ }).click();
    await waitFor(async () => {
      const rows = await supabaseQuery('partners', `select=partner_code,partner_level,yearly_referrals,successful_referrals&partner_code=eq.${encodeURIComponent(codes.upLv3)}`);
      return rows[0] && rows[0].partner_level === 'LV3_GUARDIAN' && Number(rows[0].yearly_referrals) === 10 ? rows[0] : null;
    });
    const upLv3Booking11Id = await createCheckinBooking(codes.upLv3, upLv3Booking11Name, '0911000016', `${upLv3Booking11Name}@example.com`, 'after upgrade lv3 booking11');
    await waitFor(async () => {
      const rows = await supabaseQuery('bookings', `select=id,guest_name,stay_status&partner_code=eq.${encodeURIComponent(codes.upLv3)}&id=eq.${upLv3Booking11Id}`);
      return rows[0] ? rows[0] : null;
    });
    await refreshDashboard(page);
    await showBookingsFor(page, upLv3Booking11Name);
    let lv3After = await page.locator('#bookingsTable').innerText();
    if (lv3After.includes('尚未有任何訂單')) {
      await hardReload(page);
      await showBookingsFor(page, upLv3Booking11Name);
      lv3After = await page.locator('#bookingsTable').innerText();
    }
    includes(lv3After, '$750', 'LV3 upgrade booking11 preview cash');
    includes(lv3After, 'LV3 秘境守護者', 'LV3 label after upgrade');
    await shot(page, '04_lv2_to_lv3_after_upgrade');

    // Cash debt after payout
    await refreshDashboard(page);
    await showBookingsFor(page, debtCashBookingName);
    await shot(page, '05_debt_cash_before_cancel');
    await apiAction('delete_booking', { booking_id: debtCashBookingId });
    await waitFor(async () => {
      const debt = await supabaseQuery('payouts', `select=partner_code,payout_type,amount,notes&partner_code=eq.${encodeURIComponent(codes.debtCash)}&payout_type=eq.DEBT_RECORD&order=id.desc&limit=1`);
      return debt[0] ? debt[0] : null;
    });
    await refreshDashboard(page);
    await showPayouts(page);
    const payoutCashText = await page.locator('#payoutsTable').innerText();
    includes(payoutCashText, codes.debtCash, 'cash debt payouts table');
    includes(payoutCashText, '負債記錄', 'cash debt label');
    await shot(page, '06_debt_cash_payouts');
    const debtCashRows = await supabaseQuery('payouts', `select=payout_type,amount,notes&partner_code=eq.${encodeURIComponent(codes.debtCash)}&order=id.asc`);
    const debtCashPartner = (await supabaseQuery('partners', `select=partner_code,pending_commission,total_commission_paid,total_commission_earned&partner_code=eq.${encodeURIComponent(codes.debtCash)}`))[0];
    ensure(debtCashRows.some(p => p.payout_type === 'DEBT_RECORD' && Number(p.amount) === -500), 'cash debt record missing');
    ensure(Number(debtCashPartner.pending_commission) === 0, `cash partner pending should be 0, got ${debtCashPartner.pending_commission}`);
    ensure(Number(debtCashPartner.total_commission_paid) === 500, `cash partner total paid should remain 500, got ${debtCashPartner.total_commission_paid}`);

    // Points debt after points spent
    await refreshDashboard(page);
    await showBookingsFor(page, debtPointsBookingName);
    await shot(page, '07_debt_points_before_cancel');
    await apiAction('delete_booking', { booking_id: debtPointsBookingId });
    await waitFor(async () => {
      const debt = await supabaseQuery('payouts', `select=partner_code,payout_type,amount,notes&partner_code=eq.${encodeURIComponent(codes.debtPoints)}&payout_type=eq.DEBT_RECORD&order=id.desc&limit=1`);
      return debt[0] ? debt[0] : null;
    });
    await refreshDashboard(page);
    await showPayouts(page);
    const payoutPointsText = await page.locator('#payoutsTable').innerText();
    includes(payoutPointsText, codes.debtPoints, 'points debt payouts table');
    includes(payoutPointsText, '負債記錄', 'points debt label');
    await shot(page, '08_debt_points_payouts');
    const debtPointsRows = await supabaseQuery('payouts', `select=payout_type,amount,notes&partner_code=eq.${encodeURIComponent(codes.debtPoints)}&order=id.asc`);
    const debtPointsPartner = (await supabaseQuery('partners', `select=partner_code,available_points,points_used,total_commission_earned&partner_code=eq.${encodeURIComponent(codes.debtPoints)}`))[0];
    ensure(debtPointsRows.some(p => p.payout_type === 'DEBT_RECORD' && Number(p.amount) === -1000), 'points debt record missing');
    ensure(Number(debtPointsPartner.available_points) === 0, `points partner available should be 0, got ${debtPointsPartner.available_points}`);

    log('E2E_LEVEL_DEBT_RESULT PASS', JSON.stringify({ screenshotsDir }));
    await cleanup();
    if (browser) await browser.close();
  } catch (error) {
    log('E2E_LEVEL_DEBT_RESULT FAIL', error.stack || error.message);
    await cleanup().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    process.exitCode = 1;
  }
})();
