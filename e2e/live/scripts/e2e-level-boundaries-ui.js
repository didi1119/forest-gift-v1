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
const accPartnerCode = `la${suffix}`;
const cashPartnerCode = `lc${suffix}`;
const screenshotsDir = path.join('/tmp/codex-browser-test', `level-boundaries-${ts}`);
fs.mkdirSync(screenshotsDir, { recursive: true });

const accBooking1 = `LVA1_${suffix}`;
const accBooking2 = `LVA2_${suffix}`;
const cashBooking1 = `LVC1_${suffix}`;
const cashBooking2 = `LVC2_${suffix}`;

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

async function createCompletedBooking(partnerCode, guestName, phone, email, notes) {
  const created = await apiAction('create_booking', {
    partner_code: partnerCode,
    guest_name: guestName,
    guest_phone: phone,
    guest_email: email,
    bank_account_last5: phone.slice(-5),
    checkin_date: '2026-03-01',
    checkout_date: '2026-03-02',
    room_price: '5000',
    booking_source: 'REFERRAL',
    stay_status: 'CHECKED_IN',
    payment_status: 'PAID',
    notes,
  });
  const bookingId = created.booking_id || created.data?.id;
  await apiAction('confirm_checkin_completion', { booking_id: bookingId, confirmed_by: 'E2E_SEED' });
  return bookingId;
}

async function seedCompletedReferrals(partnerCode, count, prefix) {
  for (let index = 1; index <= count; index += 1) {
    const serial = `${prefix}${String(index).padStart(2, '0')}_${suffix}`;
    await createCompletedBooking(
      partnerCode,
      serial,
      `09${String(index).padStart(8, '0')}`,
      `${serial}@example.com`,
      `seed completed referral ${index}/${count}`,
    );
  }
}

async function cleanup() {
  for (const code of [accPartnerCode, cashPartnerCode]) {
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

async function refreshDashboard(page) {
  const waitForDashboard = () => page.waitForResponse(response => {
    const body = response.request().postData() || '';
    return response.url().includes('/api') && response.request().method() === 'POST' && body.includes('action=get_dashboard_data') && response.status() === 200;
  }, { timeout: 30000 });

  try {
    const resp = waitForDashboard();
    await page.evaluate(() => loadRealData(true));
    await resp;
  } catch (error) {
    if (!String(error.message || error).includes('Execution context was destroyed')) throw error;
    const resp = waitForDashboard();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await resp;
  }
  await page.waitForTimeout(1200);
}

async function showBookingsFor(page, searchTerm, status = '') {
  await page.evaluate(() => window.showTab('bookings'));
  await page.waitForTimeout(300);
  await page.selectOption('#bookingStatusFilter', status);
  await page.evaluate(({ searchTerm }) => {
    document.getElementById('searchBooking').value = searchTerm;
    filterBookings();
  }, { searchTerm });
  await page.waitForTimeout(800);
}

async function showOverview(page) {
  await page.evaluate(() => window.showTab('overview'));
  await page.waitForTimeout(600);
}

(async () => {
  let browser;
  try {
    await cleanup().catch(() => {});

    await apiAction('create_partner', {
      partner_code: accPartnerCode,
      coupon_code: `CP${accPartnerCode.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `Acc Level ${suffix}`,
      phone: '0911999001',
      email: `${accPartnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION',
      notes: `E2E level accommodation ${ts}`,
    });

    await apiAction('create_partner', {
      partner_code: cashPartnerCode,
      coupon_code: `CP${cashPartnerCode.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `Cash Level ${suffix}`,
      phone: '0911999002',
      email: `${cashPartnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'CASH',
      notes: `E2E level cash ${ts}`,
    });

    await seedCompletedReferrals(accPartnerCode, 3, 'SLA');
    await seedCompletedReferrals(cashPartnerCode, 9, 'SLC');

    const accCreate1 = await apiAction('create_booking', {
      partner_code: accPartnerCode,
      guest_name: accBooking1,
      guest_phone: '0912000001',
      guest_email: `${accBooking1}@example.com`,
      bank_account_last5: '11111',
      checkin_date: '2026-03-09',
      checkout_date: '2026-03-10',
      room_price: '5000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID',
      notes: `ACC upgrade booking ${ts}`,
    });
    const accBooking1Id = accCreate1.booking_id || accCreate1.data?.id;

    const cashCreate1 = await apiAction('create_booking', {
      partner_code: cashPartnerCode,
      guest_name: cashBooking1,
      guest_phone: '0912000002',
      guest_email: `${cashBooking1}@example.com`,
      bank_account_last5: '22222',
      checkin_date: '2026-03-09',
      checkout_date: '2026-03-10',
      room_price: '5000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID',
      notes: `CASH upgrade booking ${ts}`,
    });
    const cashBooking1Id = cashCreate1.booking_id || cashCreate1.data?.id;

    browser = await chromium.launch({ executablePath: chromePath, headless: false, args: ['--disable-notifications', '--disable-popup-blocking'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    let lastDialogMessage = '';
    // Helper: read custom confirm modal text before clicking confirm
    async function readAndConfirmModal() {
      await page.waitForSelector('#acm-confirm', { state: 'visible', timeout: 5000 });
      lastDialogMessage = await page.locator('#appleConfirmModal').innerText().catch(() => '');
      await page.locator('#acm-confirm').click();
    }
    page.on('dialog', async dialog => {
      lastDialogMessage = dialog.message();
      log('DIALOG', dialog.type(), dialog.message());
      if (dialog.type() === 'prompt') await dialog.accept(adminSecret);
      else await dialog.accept();
    });
    page.on('console', msg => {
      if (['error', 'warning'].includes(msg.type())) log(`BROWSER_${msg.type().toUpperCase()}`, msg.text());
    });
    page.on('pageerror', err => log('PAGEERROR', err.stack || err.message));
    page.on('response', async response => {
      if (!response.url().includes('/api')) return;
      let body = '';
      try { body = response.request().postData() || ''; } catch (_) {}
      let text = '';
      try { text = await response.text(); } catch (_) {}
      log('API', response.status(), response.request().method(), 'REQ=', body.slice(0, 220), 'RESP=', text.slice(0, 220));
    });

    const initialData = page.waitForResponse(response => {
      const body = response.request().postData() || '';
      return response.url().includes('/api') && response.request().method() === 'POST' && body.includes('action=get_dashboard_data') && response.status() === 200;
    }, { timeout: 30000 });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await initialData;
    await page.waitForTimeout(1500);

    // Scenario A: LV1 accommodation boundary
    await showBookingsFor(page, accBooking1, '');
    const accTableBefore = await page.locator('#bookingsTable').innerText();
    log('ACC_TABLE_BEFORE_CONFIRM', accTableBefore);
    expectIncludes(accTableBefore, accBooking1, 'acc booking before confirm');
    expectIncludes(accTableBefore, '$1000', 'acc expected commission before confirm');
    await shot(page, '01_acc_before_confirm');

    lastDialogMessage = '';
    await page.getByRole('button', { name: /確認入住/ }).click();
    await readAndConfirmModal();
    await waitForAsync(async () => {
      const rows = await supabaseQuery('bookings', `select=id,stay_status,commission_amount,commission_type&partner_code=eq.${encodeURIComponent(accPartnerCode)}&id=eq.${accBooking1Id}`);
      return rows[0]?.stay_status === 'COMPLETED' ? rows[0] : null;
    });
    expectIncludes(lastDialogMessage, '$1000 住宿金', 'acc confirm dialog');
    await shot(page, '02_acc_after_first_confirm');

    const accPartnerAfterUpgrade = (await supabaseQuery('partners', `select=partner_code,partner_level,yearly_referrals,successful_referrals,available_points,total_commission_earned&partner_code=eq.${encodeURIComponent(accPartnerCode)}`))[0];
    const accBookingAfterUpgrade = (await supabaseQuery('bookings', `select=id,commission_amount,commission_type,stay_status&partner_code=eq.${encodeURIComponent(accPartnerCode)}&id=eq.${accBooking1Id}`))[0];
    log('ACC_AFTER_UPGRADE', JSON.stringify({ accPartnerAfterUpgrade, accBookingAfterUpgrade }));
    if (accPartnerAfterUpgrade.partner_level !== 'LV2_GUIDE' || Number(accPartnerAfterUpgrade.yearly_referrals) !== 4 || Number(accBookingAfterUpgrade.commission_amount) !== 1000) {
      throw new Error(`Accommodation upgrade mismatch: ${JSON.stringify({ accPartnerAfterUpgrade, accBookingAfterUpgrade })}`);
    }

    await refreshDashboard(page);
    await showOverview(page);
    const accCardAfterUpgrade = await page.locator(`.brand-card[data-partner-code="${accPartnerCode}"]`).innerText();
    log('ACC_CARD_AFTER_UPGRADE', accCardAfterUpgrade);
    expectIncludes(accCardAfterUpgrade, 'LV2 森林嚮導', 'acc upgraded card level');
    expectIncludes(accCardAfterUpgrade, '5,500', 'acc upgraded points');
    await shot(page, '03_acc_card_after_upgrade');

    await page.evaluate((id) => window.deleteBooking(String(id)), String(accBooking1Id));
    await readAndConfirmModal();
    await waitForAsync(async () => {
      const rows = await supabaseQuery('bookings', `select=id,stay_status,commission_status&partner_code=eq.${encodeURIComponent(accPartnerCode)}&id=eq.${accBooking1Id}`);
      return rows[0]?.stay_status === 'CANCELLED' ? rows[0] : null;
    });
    await refreshDashboard(page);
    await showOverview(page);
    const accCardAfterDelete = await page.locator(`.brand-card[data-partner-code="${accPartnerCode}"]`).innerText();
    log('ACC_CARD_AFTER_DELETE', accCardAfterDelete);
    expectIncludes(accCardAfterDelete, 'LV1 知音大使', 'acc downgraded card level');
    expectIncludes(accCardAfterDelete, '4,500', 'acc downgraded points');
    await shot(page, '04_acc_card_after_delete');

    const accCreate2 = await apiAction('create_booking', {
      partner_code: accPartnerCode,
      guest_name: accBooking2,
      guest_phone: '0912000003',
      guest_email: `${accBooking2}@example.com`,
      bank_account_last5: '33333',
      checkin_date: '2026-03-09',
      checkout_date: '2026-03-10',
      room_price: '5000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID',
      notes: `ACC post-downgrade booking ${ts}`,
    });
    const accBooking2Id = accCreate2.booking_id || accCreate2.data?.id;
    await refreshDashboard(page);
    await showBookingsFor(page, accBooking2, '');
    const accTableSecond = await page.locator('#bookingsTable').innerText();
    log('ACC_TABLE_SECOND', accTableSecond);
    expectIncludes(accTableSecond, '$1000', 'acc post-downgrade expected commission');
    await shot(page, '05_acc_second_before_confirm');

    lastDialogMessage = '';
    await page.getByRole('button', { name: /確認入住/ }).click();
    await readAndConfirmModal();
    await waitForAsync(async () => {
      const rows = await supabaseQuery('bookings', `select=id,stay_status,commission_amount,commission_type&partner_code=eq.${encodeURIComponent(accPartnerCode)}&id=eq.${accBooking2Id}`);
      return rows[0]?.stay_status === 'COMPLETED' ? rows[0] : null;
    });
    expectIncludes(lastDialogMessage, '$1000 住宿金', 'acc second confirm dialog');
    const accBooking2After = (await supabaseQuery('bookings', `select=id,commission_amount,commission_type,stay_status&partner_code=eq.${encodeURIComponent(accPartnerCode)}&id=eq.${accBooking2Id}`))[0];
    if (Number(accBooking2After.commission_amount) !== 1000 || accBooking2After.commission_type !== 'ACCOMMODATION') {
      throw new Error(`Accommodation second booking mismatch: ${JSON.stringify(accBooking2After)}`);
    }
    await shot(page, '06_acc_second_after_confirm');

    // Scenario B: LV2 cash boundary
    await refreshDashboard(page);
    await showBookingsFor(page, cashBooking1, '');
    const cashTableBefore = await page.locator('#bookingsTable').innerText();
    log('CASH_TABLE_BEFORE_CONFIRM', cashTableBefore);
    expectIncludes(cashTableBefore, cashBooking1, 'cash booking before confirm');
    expectIncludes(cashTableBefore, '$1200', 'cash expected accommodation display');
    expectIncludes(cashTableBefore, '($600現金)', 'cash expected cash display');
    await shot(page, '07_cash_before_confirm');

    lastDialogMessage = '';
    await page.getByRole('button', { name: /確認入住/ }).click();
    await readAndConfirmModal();
    await waitForAsync(async () => {
      const rows = await supabaseQuery('bookings', `select=id,stay_status,commission_amount,commission_type&partner_code=eq.${encodeURIComponent(cashPartnerCode)}&id=eq.${cashBooking1Id}`);
      return rows[0]?.stay_status === 'COMPLETED' ? rows[0] : null;
    });
    expectIncludes(lastDialogMessage, '$600 現金', 'cash first confirm dialog');
    const cashPartnerAfterUpgrade = (await supabaseQuery('partners', `select=partner_code,partner_level,yearly_referrals,successful_referrals,pending_commission,total_commission_earned&partner_code=eq.${encodeURIComponent(cashPartnerCode)}`))[0];
    const cashBooking1After = (await supabaseQuery('bookings', `select=id,commission_amount,commission_type,stay_status&partner_code=eq.${encodeURIComponent(cashPartnerCode)}&id=eq.${cashBooking1Id}`))[0];
    log('CASH_AFTER_UPGRADE', JSON.stringify({ cashPartnerAfterUpgrade, cashBooking1After }));
    if (cashPartnerAfterUpgrade.partner_level !== 'LV3_GUARDIAN' || Number(cashPartnerAfterUpgrade.yearly_referrals) !== 10 || Number(cashBooking1After.commission_amount) !== 600 || cashBooking1After.commission_type !== 'CASH') {
      throw new Error(`Cash upgrade mismatch: ${JSON.stringify({ cashPartnerAfterUpgrade, cashBooking1After })}`);
    }
    await refreshDashboard(page);
    await showOverview(page);
    const cashCardAfterUpgrade = await page.locator(`.brand-card[data-partner-code="${cashPartnerCode}"]`).innerText();
    log('CASH_CARD_AFTER_UPGRADE', cashCardAfterUpgrade);
    expectIncludes(cashCardAfterUpgrade, 'LV3 秘境守護者', 'cash upgraded card level');
    expectIncludes(cashCardAfterUpgrade, Number(cashPartnerAfterUpgrade.pending_commission).toLocaleString('en-US'), 'cash upgraded pending cash');
    await shot(page, '08_cash_card_after_upgrade');

    const cashCreate2 = await apiAction('create_booking', {
      partner_code: cashPartnerCode,
      guest_name: cashBooking2,
      guest_phone: '0912000004',
      guest_email: `${cashBooking2}@example.com`,
      bank_account_last5: '44444',
      checkin_date: '2026-03-09',
      checkout_date: '2026-03-10',
      room_price: '5000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID',
      notes: `CASH post-upgrade booking ${ts}`,
    });
    const cashBooking2Id = cashCreate2.booking_id || cashCreate2.data?.id;
    await refreshDashboard(page);
    await showBookingsFor(page, cashBooking2, '');
    const cashTableSecond = await page.locator('#bookingsTable').innerText();
    log('CASH_TABLE_SECOND', cashTableSecond);
    expectIncludes(cashTableSecond, '$1500', 'cash second expected accommodation display');
    expectIncludes(cashTableSecond, '($750現金)', 'cash second expected cash display');
    await shot(page, '09_cash_second_before_confirm');

    lastDialogMessage = '';
    await page.getByRole('button', { name: /確認入住/ }).click();
    await readAndConfirmModal();
    await waitForAsync(async () => {
      const rows = await supabaseQuery('bookings', `select=id,stay_status,commission_amount,commission_type&partner_code=eq.${encodeURIComponent(cashPartnerCode)}&id=eq.${cashBooking2Id}`);
      return rows[0]?.stay_status === 'COMPLETED' ? rows[0] : null;
    });
    expectIncludes(lastDialogMessage, '$750 現金', 'cash second confirm dialog');
    const cashBooking2After = (await supabaseQuery('bookings', `select=id,commission_amount,commission_type,stay_status&partner_code=eq.${encodeURIComponent(cashPartnerCode)}&id=eq.${cashBooking2Id}`))[0];
    const cashPartnerFinal = (await supabaseQuery('partners', `select=partner_code,partner_level,yearly_referrals,pending_commission,total_commission_earned&partner_code=eq.${encodeURIComponent(cashPartnerCode)}`))[0];
    log('CASH_FINAL', JSON.stringify({ cashBooking2After, cashPartnerFinal }));
    if (
      Number(cashBooking2After.commission_amount) !== 750 ||
      cashBooking2After.commission_type !== 'CASH' ||
      cashPartnerFinal.partner_level !== 'LV3_GUARDIAN' ||
      Number(cashPartnerFinal.pending_commission) !== Number(cashPartnerAfterUpgrade.pending_commission) + 750
    ) {
      throw new Error(`Cash second booking mismatch: ${JSON.stringify({ cashBooking2After, cashPartnerFinal })}`);
    }
    await shot(page, '10_cash_second_after_confirm');

    await cleanup();
    log('E2E_LEVEL_BOUNDARIES_RESULT', 'PASS');
  } catch (error) {
    log('E2E_LEVEL_BOUNDARIES_RESULT', 'FAIL', error.stack || error.message);
    try { await cleanup(); } catch (cleanupError) { log('CLEANUP_FAIL', cleanupError.message); }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
