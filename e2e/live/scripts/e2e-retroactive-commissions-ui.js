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

if (!adminSecret) throw new Error('Missing ADMIN_SECRET');
if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env');

const ts = Date.now();
const suffix = String(ts).slice(-6);
const screenshotsDir = path.join('/tmp/codex-browser-test', `retroactive-commissions-${ts}`);
fs.mkdirSync(screenshotsDir, { recursive: true });

const firstBonusPartner = `rb${suffix}`;
const cashPartner = `rc${suffix}`;

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function shot(page, name) {
  const file = path.join(screenshotsDir, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled', timeout: 10000 });
    log('SCREENSHOT', file);
  } catch (error) {
    log('SCREENSHOT_FAIL', name, error.message);
  }
}

async function apiAction(action, payload) {
  const params = new URLSearchParams({ action, admin_secret: adminSecret });
  Object.entries(payload || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.append(k, String(v));
  });
  const res = await fetch(apiBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (_) { throw new Error(`API ${action} non-JSON: ${text}`); }
  if (!res.ok || !json.success) throw new Error(`API ${action} failed: ${text}`);
  return json;
}

async function supabaseQuery(table, query) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase query ${table} failed: ${text}`);
  return text ? JSON.parse(text) : [];
}

async function supabaseDelete(table, query) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  if (!res.ok && res.status !== 204) throw new Error(`Supabase delete ${table} failed: ${await res.text()}`);
}

async function cleanup() {
  for (const code of [firstBonusPartner, cashPartner]) {
    await supabaseDelete('accommodation_usage', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDelete('payouts', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDelete('bookings', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDelete('clicks', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDelete('partners', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    log('CLEANED', code);
  }
}

function expectIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`${label} missing ${needle}\nActual:\n${text}`);
}

async function waitForAsync(check, timeoutMs = 30000, intervalMs = 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await check();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
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

async function confirmBookingByApi(bookingId, confirmedBy) {
  await apiAction('confirm_checkin_completion', {
    booking_id: bookingId,
    confirmed_by: confirmedBy
  });
}

async function refreshDashboard(page) {
  const resp = page.waitForResponse(response => {
    const body = response.request().postData() || '';
    return response.url().includes('/api') && response.request().method() === 'POST' && body.includes('action=get_dashboard_data') && response.status() === 200;
  }, { timeout: 30000 });
  await page.evaluate(() => loadRealData(true));
  await resp;
  await page.waitForTimeout(1200);
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

(async () => {
  let browser;
  try {
    await cleanup().catch(() => {});

    // Scenario A: first referral bonus transfer
    await apiAction('create_partner', {
      partner_code: firstBonusPartner,
      coupon_code: `CP${firstBonusPartner.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `Retro Bonus ${suffix}`,
      phone: '0912111001',
      email: `${firstBonusPartner}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION',
      available_points: 0,
      points_used: 0,
      pending_commission: 0,
      total_commission_earned: 0,
      successful_referrals: 0,
      total_successful_referrals: 0,
      yearly_referrals: 0,
      notes: `Retro bonus ${ts}`
    });

    const bonusBooking1Name = `RB1_${suffix}`;
    const bonusBooking2Name = `RB2_${suffix}`;
    const bonusBooking1Id = await createCheckinBooking(firstBonusPartner, bonusBooking1Name, '0912111002', `${bonusBooking1Name}@example.com`, `retro bonus 1 ${ts}`);
    const bonusBooking2Id = await createCheckinBooking(firstBonusPartner, bonusBooking2Name, '0912111003', `${bonusBooking2Name}@example.com`, `retro bonus 2 ${ts}`);

    // Scenario B: cash level retroactive recalculation
    await apiAction('create_partner', {
      partner_code: cashPartner,
      coupon_code: `CP${cashPartner.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `Retro Cash ${suffix}`,
      phone: '0912111004',
      email: `${cashPartner}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'CASH',
      available_points: 0,
      points_used: 0,
      pending_commission: 0,
      total_commission_earned: 0,
      successful_referrals: 0,
      total_successful_referrals: 0,
      yearly_referrals: 0,
      notes: `Retro cash ${ts}`
    });

    const historicalCashBookingIds = [];
    for (let i = 1; i <= 9; i += 1) {
      const name = `RC_H${i}_${suffix}`;
      const bookingId = await createCheckinBooking(cashPartner, name, `0922${String(i).padStart(6, '0')}`, `${name}@example.com`, `retro cash history ${i} ${ts}`);
      historicalCashBookingIds.push(bookingId);
      await confirmBookingByApi(bookingId, 'SEED_HISTORY');
    }

    const cashBooking10Name = `RC10_${suffix}`;
    const cashBooking11Name = `RC11_${suffix}`;
    const cashBooking10Id = await createCheckinBooking(cashPartner, cashBooking10Name, '0912111010', `${cashBooking10Name}@example.com`, `retro cash 10 ${ts}`);
    const cashBooking11Id = await createCheckinBooking(cashPartner, cashBooking11Name, '0912111011', `${cashBooking11Name}@example.com`, `retro cash 11 ${ts}`);

    browser = await chromium.launch({ executablePath: chromePath, headless: false, args: ['--disable-notifications', '--disable-popup-blocking'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    let lastDialogMessage = '';

    page.on('dialog', async dialog => {
      lastDialogMessage = dialog.message();
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
      let body = '';
      try { body = response.request().postData() || ''; } catch (_) {}
      let text = '';
      try { text = await response.text(); } catch (_) {}
      log('API', response.status(), response.request().method(), 'REQ=', body.slice(0, 220), 'RESP=', text.slice(0, 220));
    });

    const initial = page.waitForResponse(response => {
      const body = response.request().postData() || '';
      return response.url().includes('/api') && response.request().method() === 'POST' && body.includes('action=get_dashboard_data') && response.status() === 200;
    }, { timeout: 30000 });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await initial;
    await page.waitForTimeout(1500);

    // Scenario A UI flow
    await showBookingsFor(page, bonusBooking1Name);
    const bonusTable1 = await page.locator('#bookingsTable').innerText();
    log('BONUS_TABLE_1', bonusTable1);
    expectIncludes(bonusTable1, '$2500', 'first bonus booking 1 expected');
    await shot(page, '01_bonus_booking1_before_confirm');

    lastDialogMessage = '';
    await page.getByRole('button', { name: /確認入住/ }).click();
    await waitForAsync(async () => {
      const rows = await supabaseQuery('bookings', `select=id,stay_status,commission_amount,is_first_referral_bonus,first_referral_bonus_amount&partner_code=eq.${encodeURIComponent(firstBonusPartner)}&id=eq.${bonusBooking1Id}`);
      return rows[0] && rows[0].stay_status === 'COMPLETED' ? rows[0] : null;
    });
    expectIncludes(lastDialogMessage, '$2500 住宿金', 'first bonus booking 1 confirm dialog');

    await refreshDashboard(page);
    await showBookingsFor(page, bonusBooking2Name);
    const bonusTable2 = await page.locator('#bookingsTable').innerText();
    log('BONUS_TABLE_2', bonusTable2);
    expectIncludes(bonusTable2, '$1000', 'second booking expected after first confirmed');
    await shot(page, '02_bonus_booking2_before_confirm');

    lastDialogMessage = '';
    await page.getByRole('button', { name: /確認入住/ }).click();
    await waitForAsync(async () => {
      const rows = await supabaseQuery('bookings', `select=id,stay_status,commission_amount,is_first_referral_bonus,first_referral_bonus_amount&partner_code=eq.${encodeURIComponent(firstBonusPartner)}&id=eq.${bonusBooking2Id}`);
      return rows[0] && rows[0].stay_status === 'COMPLETED' ? rows[0] : null;
    });
    expectIncludes(lastDialogMessage, '$1000 住宿金', 'second booking confirm dialog');

    lastDialogMessage = '';
    await page.evaluate((id) => window.deleteBooking(String(id)), String(bonusBooking1Id));
    await waitForAsync(async () => {
      const rows = await supabaseQuery('bookings', `select=id,stay_status&partner_code=eq.${encodeURIComponent(firstBonusPartner)}&id=eq.${bonusBooking1Id}`);
      return rows[0] && rows[0].stay_status === 'CANCELLED' ? rows[0] : null;
    });
    await refreshDashboard(page);
    await showBookingsFor(page, bonusBooking2Name);
    const bonusTableAfterDelete = await page.locator('#bookingsTable').innerText();
    log('BONUS_TABLE_AFTER_DELETE', bonusTableAfterDelete);
    expectIncludes(bonusTableAfterDelete, '$2500', 'second booking actual commission after transfer');
    await shot(page, '03_bonus_after_delete');

    const bonusBooking2After = (await supabaseQuery('bookings', `select=id,commission_amount,is_first_referral_bonus,first_referral_bonus_amount,stay_status&partner_code=eq.${encodeURIComponent(firstBonusPartner)}&id=eq.${bonusBooking2Id}`))[0];
    const bonusPartnerAfter = (await supabaseQuery('partners', `select=partner_code,available_points,total_commission_earned,successful_referrals,yearly_referrals,partner_level&partner_code=eq.${encodeURIComponent(firstBonusPartner)}`))[0];
    const bonusPayouts = await supabaseQuery('payouts', `select=partner_code,payout_type,amount,related_booking_ids,notes&partner_code=eq.${encodeURIComponent(firstBonusPartner)}&order=id.asc`);
    log('BONUS_AFTER_DELETE_DB', JSON.stringify({ bonusBooking2After, bonusPartnerAfter, bonusPayouts }));
    if (Number(bonusBooking2After.commission_amount) !== 2500 || String(bonusBooking2After.is_first_referral_bonus).toLowerCase() !== 'true' || Number(bonusBooking2After.first_referral_bonus_amount) !== 1500) {
      throw new Error(`First bonus transfer mismatch: ${JSON.stringify(bonusBooking2After)}`);
    }
    if (Number(bonusPartnerAfter.available_points) !== 2500 || Number(bonusPartnerAfter.total_commission_earned) !== 2500 || Number(bonusPartnerAfter.successful_referrals) !== 1) {
      throw new Error(`First bonus partner mismatch: ${JSON.stringify(bonusPartnerAfter)}`);
    }
    if (!bonusPayouts.some(p => p.payout_type === 'LEVEL_ADJUSTMENT' && Number(p.amount) === 1500 && String(p.related_booking_ids) === String(bonusBooking2Id))) {
      throw new Error(`Missing first bonus transfer payout adjustment: ${JSON.stringify(bonusPayouts)}`);
    }

    // Scenario B UI flow
    await refreshDashboard(page);
    await showBookingsFor(page, cashBooking10Name);
    const cashTable10 = await page.locator('#bookingsTable').innerText();
    log('CASH_TABLE_10', cashTable10);
    expectIncludes(cashTable10, '($600現金)', 'cash booking 10 expected');
    await shot(page, '04_cash_booking10_before_confirm');

    lastDialogMessage = '';
    await page.getByRole('button', { name: /確認入住/ }).click();
    await waitForAsync(async () => {
      const rows = await supabaseQuery('bookings', `select=id,stay_status,commission_amount,commission_type&partner_code=eq.${encodeURIComponent(cashPartner)}&id=eq.${cashBooking10Id}`);
      return rows[0] && rows[0].stay_status === 'COMPLETED' ? rows[0] : null;
    });
    expectIncludes(lastDialogMessage, '$600 現金', 'cash booking 10 confirm dialog');

    await refreshDashboard(page);
    await showBookingsFor(page, cashBooking11Name);
    const cashTable11 = await page.locator('#bookingsTable').innerText();
    log('CASH_TABLE_11', cashTable11);
    expectIncludes(cashTable11, '($750現金)', 'cash booking 11 expected');
    await shot(page, '05_cash_booking11_before_confirm');

    lastDialogMessage = '';
    await page.getByRole('button', { name: /確認入住/ }).click();
    await waitForAsync(async () => {
      const rows = await supabaseQuery('bookings', `select=id,stay_status,commission_amount,commission_type&partner_code=eq.${encodeURIComponent(cashPartner)}&id=eq.${cashBooking11Id}`);
      return rows[0] && rows[0].stay_status === 'COMPLETED' ? rows[0] : null;
    });
    expectIncludes(lastDialogMessage, '$750 現金', 'cash booking 11 confirm dialog');

    // Cancel the earliest historical booking to trigger retroactive recomputation.
    lastDialogMessage = '';
    await page.evaluate((id) => window.deleteBooking(String(id)), String(historicalCashBookingIds[0]));
    await waitForAsync(async () => {
      const rows = await supabaseQuery('bookings', `select=id,stay_status&partner_code=eq.${encodeURIComponent(cashPartner)}&id=eq.${historicalCashBookingIds[0]}`);
      return rows[0] && rows[0].stay_status === 'CANCELLED' ? rows[0] : null;
    });

    await refreshDashboard(page);
    await showBookingsFor(page, cashBooking11Name);
    const cashTableAfterDelete = await page.locator('#bookingsTable').innerText();
    log('CASH_TABLE_AFTER_DELETE', cashTableAfterDelete);
    expectIncludes(cashTableAfterDelete, '$600', 'cash booking 11 actual commission after retroactive adjust');
    await shot(page, '06_cash_after_delete');

    const cashBooking5After = (await supabaseQuery('bookings', `select=id,guest_name,commission_amount,commission_type,stay_status&partner_code=eq.${encodeURIComponent(cashPartner)}&guest_name=eq.RC_H5_${suffix}`))[0];
    const cashBooking11After = (await supabaseQuery('bookings', `select=id,guest_name,commission_amount,commission_type,stay_status&partner_code=eq.${encodeURIComponent(cashPartner)}&id=eq.${cashBooking11Id}`))[0];
    const cashPartnerAfter = (await supabaseQuery('partners', `select=partner_code,pending_commission,total_commission_earned,successful_referrals,yearly_referrals,partner_level&partner_code=eq.${encodeURIComponent(cashPartner)}`))[0];
    const cashPayouts = await supabaseQuery('payouts', `select=partner_code,payout_type,amount,related_booking_ids,notes&partner_code=eq.${encodeURIComponent(cashPartner)}&order=id.asc`);
    log('CASH_AFTER_DELETE_DB', JSON.stringify({ cashBooking5After, cashBooking11After, cashPartnerAfter, cashPayouts }));

    if (Number(cashBooking5After.commission_amount) !== 500 || Number(cashBooking11After.commission_amount) !== 600) {
      throw new Error(`Cash retroactive booking mismatch: ${JSON.stringify({ cashBooking5After, cashBooking11After })}`);
    }
    if (cashPartnerAfter.partner_level !== 'LV3_GUARDIAN' || Number(cashPartnerAfter.pending_commission) !== 5600 || Number(cashPartnerAfter.total_commission_earned) !== 5600 || Number(cashPartnerAfter.successful_referrals) !== 10) {
      throw new Error(`Cash retroactive partner mismatch: ${JSON.stringify(cashPartnerAfter)}`);
    }
    if (!cashPayouts.some(p => p.payout_type === 'LEVEL_ADJUSTMENT' && Number(p.amount) === -100 && String(p.related_booking_ids) === String(cashBooking5After.id))) {
      throw new Error(`Missing retroactive adjustment for historical booking #5: ${JSON.stringify(cashPayouts)}`);
    }
    if (!cashPayouts.some(p => p.payout_type === 'LEVEL_ADJUSTMENT' && Number(p.amount) === -150 && String(p.related_booking_ids) === String(cashBooking11Id))) {
      throw new Error(`Missing retroactive adjustment for booking 11: ${JSON.stringify(cashPayouts)}`);
    }

    await cleanup();
    log('E2E_RETROACTIVE_COMMISSIONS_RESULT', 'PASS');
  } catch (error) {
    log('E2E_RETROACTIVE_COMMISSIONS_RESULT', 'FAIL', error.stack || error.message);
    try { await cleanup(); } catch (cleanupError) { log('CLEANUP_FAIL', cleanupError.message); }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
