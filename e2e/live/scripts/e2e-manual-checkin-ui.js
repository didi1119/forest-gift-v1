const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const siteOrigin = process.env.SITE_ORIGIN || 'https://forest-ambassador.vercel.app';
const baseUrl = process.env.BASE_URL || `${siteOrigin}/frontend/admin/manual-checkin-confirm.html`;
const apiBase = process.env.API_BASE || `${siteOrigin}/api`;
const adminSecret = process.env.ADMIN_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!adminSecret) throw new Error('Missing ADMIN_SECRET');
if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env');

const ts = Date.now();
const suffix = String(ts).slice(-6);
const partnerCode = `mc${suffix}`;
const partnerName = `MC Partner ${suffix}`;
const guestName = `MC Guest ${suffix}`;
const guestPhone = '0911888001';
const screenshotsDir = path.join('/tmp/codex-browser-test', `manual-checkin-${ts}`);
fs.mkdirSync(screenshotsDir, { recursive: true });

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
  await supabaseDelete('accommodation_usage', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDelete('payouts', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDelete('bookings', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDelete('clicks', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDelete('partners', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  log('CLEANUP_DONE', partnerCode);
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

(async () => {
  let browser;
  try {
    await cleanup().catch(() => {});

    await apiAction('create_partner', {
      partner_code: partnerCode,
      partner_name: partnerName,
      phone: '0911888000',
      email: `${partnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION',
      available_points: 0,
      points_used: 0,
      pending_commission: 0,
      successful_referrals: 0,
      bank_name: 'Manual Checkin Bank',
      bank_code: '700',
      bank_account_name: partnerName,
      bank_account_number: '1000000004001',
      notes: `E2E manual checkin ${ts}`,
    });

    const createBooking = await apiAction('create_booking', {
      partner_code: partnerCode,
      guest_name: guestName,
      guest_phone: guestPhone,
      guest_email: `${partnerCode}.guest@example.com`,
      bank_account_last5: '12345',
      checkin_date: '2026-03-12',
      checkout_date: '2026-03-13',
      room_price: '5000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID',
      notes: `MC_UI_${ts}`,
    });
    const bookingId = createBooking.booking_id || createBooking.data?.id;
    if (!bookingId) throw new Error('Missing booking id');

    browser = await chromium.launch({ executablePath: chromePath, headless: false, args: ['--disable-notifications', '--disable-popup-blocking'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    page.on('dialog', async dialog => {
      log('DIALOG', dialog.type(), dialog.message());
      if (dialog.type() === 'prompt') await dialog.accept(adminSecret);
      else await dialog.accept();
    });
    page.on('pageerror', error => log('PAGEERROR', error.stack || error.message));
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) log(`BROWSER_${message.type().toUpperCase()}`, message.text());
    });
    page.on('response', async response => {
      if (!response.url().includes('/api')) return;
      let body = '';
      try { body = response.request().postData() || ''; } catch (_) {}
      let text = '';
      try { text = await response.text(); } catch (_) {}
      log('API', response.status(), response.request().method(), 'REQ=', body.slice(0, 220), 'RESP=', text.slice(0, 220));
    });

    const initialDataResponse = page.waitForResponse(response => {
      const body = response.request().postData() || '';
      return response.url().includes('/api') && response.request().method() === 'POST' && body.includes('action=get_dashboard_data') && response.status() === 200;
    }, { timeout: 30000 });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await initialDataResponse;
    await page.waitForTimeout(1500);

    await page.locator('#partnerFilter').fill(partnerCode);
    await page.waitForFunction((name) => document.getElementById('bookingsTable')?.innerText.includes(name), guestName, { timeout: 30000 });
    const tableText = await page.locator('#bookingsTable').innerText();
    log('BOOKINGS_TABLE', tableText);
    expectIncludes(tableText, guestName, 'bookings table guest');
    expectIncludes(tableText, partnerCode, 'bookings table partner code');
    expectIncludes(tableText, '已入住', 'bookings table status');
    expectIncludes(tableText, '$2500', 'bookings table estimated commission');
    expectIncludes(tableText, '基本: $1000 + 首推: $1500', 'bookings table commission breakdown');
    await shot(page, '01_filtered_table');

    const pendingCount = await page.locator('#totalPendingBookings').innerText();
    log('STATS_PENDING', pendingCount);
    if (pendingCount === '-' || Number(pendingCount) < 1) {
      throw new Error(`Unexpected pending stats value: ${pendingCount}`);
    }

    await page.getByRole('button', { name: /確認完成/ }).click();
    await page.locator('#confirmModal').waitFor({ timeout: 10000 });
    const modalText = await page.locator('#confirmModal').innerText();
    log('CONFIRM_MODAL', modalText);
    expectIncludes(modalText, guestName, 'confirm modal guest');
    expectIncludes(modalText, partnerName, 'confirm modal partner');
    expectIncludes(modalText, '佣金偏好：住宿金', 'confirm modal preference');
    expectIncludes(modalText, '預計佣金：$2500 (基本: $1000 + 首推: $1500)', 'confirm modal commission');
    await shot(page, '02_confirm_modal');

    await page.getByRole('button', { name: '確認完成入住' }).click();
    await page.waitForFunction((code) => {
      const table = document.getElementById('bookingsTable');
      return table && table.innerText.includes('沒有符合條件的記錄');
    }, partnerCode, { timeout: 30000 });
    await shot(page, '03_after_confirmation');

    const bookingAfter = await waitForAsync(async () => {
      const rows = await supabaseQuery('bookings', `select=id,partner_code,stay_status,payment_status,commission_status,commission_amount,commission_type,is_first_referral_bonus,first_referral_bonus_amount,manually_confirmed_by,manually_confirmed_at&partner_code=eq.${encodeURIComponent(partnerCode)}&id=eq.${bookingId}`);
      if (rows[0]?.stay_status === 'COMPLETED') return rows[0];
      return null;
    }, 30000, 1000);
    const partnerAfter = (await supabaseQuery('partners', `select=partner_code,available_points,pending_commission,successful_referrals,total_commission_earned,partner_level&partner_code=eq.${encodeURIComponent(partnerCode)}`))[0];
    const payoutsAfter = await supabaseQuery('payouts', `select=partner_code,payout_type,amount,payout_status,related_booking_ids,notes&partner_code=eq.${encodeURIComponent(partnerCode)}&order=id.asc`);
    log('DB_AFTER_CONFIRM', JSON.stringify({ bookingAfter, partnerAfter, payoutsAfter }));

    const isFirstBonus = bookingAfter.is_first_referral_bonus === true || bookingAfter.is_first_referral_bonus === 'true';
    if (Number(bookingAfter.commission_amount) !== 2500 || bookingAfter.commission_type !== 'ACCOMMODATION' || !isFirstBonus || Number(bookingAfter.first_referral_bonus_amount) !== 1500) {
      throw new Error(`Booking confirmation mismatch: ${JSON.stringify(bookingAfter)}`);
    }
    if (Number(partnerAfter.available_points) !== 2500 || Number(partnerAfter.successful_referrals) !== 1 || Number(partnerAfter.total_commission_earned) !== 2500) {
      throw new Error(`Partner state mismatch: ${JSON.stringify(partnerAfter)}`);
    }
    if (!payoutsAfter.some(p => p.payout_type === 'ACCOMMODATION' && Number(p.amount) === 2500 && String(p.related_booking_ids || '').includes(String(bookingId)))) {
      throw new Error(`Missing accommodation payout: ${JSON.stringify(payoutsAfter)}`);
    }

    await cleanup();
    log('E2E_MANUAL_CHECKIN_RESULT', 'PASS');
  } catch (error) {
    log('E2E_MANUAL_CHECKIN_RESULT', 'FAIL', error.stack || error.message);
    try { await cleanup(); } catch (cleanupError) { log('CLEANUP_FAIL', cleanupError.message); }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
