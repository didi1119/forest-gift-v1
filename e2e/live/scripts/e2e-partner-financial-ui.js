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
const partnerCode = `pw${String(ts).slice(-8)}`;
const partnerName = `PW Partner ${String(ts).slice(-6)}`;
const guestName = `PW-USE-${ts}`;
const screenshotsDir = path.join('/tmp/codex-browser-test', `partner-financial-${ts}`);
fs.mkdirSync(screenshotsDir, { recursive: true });

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

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
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.append(key, String(value));
  });
  const res = await fetch(apiBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`API ${action} returned non-JSON: ${text}`);
  }
  if (!res.ok || !json.success) {
    throw new Error(`API ${action} failed: ${text}`);
  }
  return json;
}

async function supabaseQuery(table, query) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase query ${table} failed: ${text}`);
  return text ? JSON.parse(text) : [];
}

async function supabaseDelete(table, query) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Supabase delete ${table} failed: ${await res.text()}`);
  }
}

async function cleanup() {
  await supabaseDelete('accommodation_usage', `partner_code=eq.${encodeURIComponent(partnerCode)}`);
  await supabaseDelete('payouts', `partner_code=eq.${encodeURIComponent(partnerCode)}`);
  await supabaseDelete('bookings', `partner_code=eq.${encodeURIComponent(partnerCode)}`);
  await supabaseDelete('partners', `partner_code=eq.${encodeURIComponent(partnerCode)}`);
  log('CLEANUP_DONE', partnerCode);
}

function expectText(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label} missing expected text: ${needle}\nActual:\n${haystack}`);
  }
}

(async () => {
  let browser;
  try {
    await cleanup().catch(() => {});

    const createPartner = await apiAction('create_partner', {
      partner_code: partnerCode,
      coupon_code: `CP${partnerCode.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: partnerName,
      phone: '0911002200',
      email: `${partnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION',
      available_points: 5000,
      points_used: 0,
      pending_commission: 0,
      bank_name: 'Test Bank',
      bank_code: '812',
      bank_account_name: partnerName,
      bank_account_number: '1234567890123',
      notes: `PW partner ui financial ${ts}`,
    });
    log('PARTNER_CREATED', JSON.stringify({ partner_code: createPartner.partner_code || partnerCode }));

    browser = await chromium.launch({
      executablePath: chromePath,
      headless: false,
      args: ['--disable-notifications', '--disable-popup-blocking'],
    });
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
      log('API', response.status(), response.request().method(), response.url(), 'REQ=', body.slice(0, 240), 'RESP=', text.slice(0, 240));
    });

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.showTab('overview'));
    const partnerCard = page.locator(`[data-partner-code="${partnerCode}"]`).first();
    await partnerCard.waitFor({ timeout: 30000 });

    const initialCardText = await partnerCard.innerText();
    log('PARTNER_CARD_INITIAL', initialCardText);
    expectText(initialCardText, partnerName, 'partner card');
    expectText(initialCardText, partnerCode, 'partner card');
    expectText(initialCardText, '5,000', 'partner card points');
    expectText(initialCardText, 'NT$ 0', 'partner card pending cash');
    await shot(page, '01_partner_card_initial');

    await partnerCard.getByRole('button', { name: /使用點數/ }).click();
    await page.locator('#partnerActionsModal').waitFor({ timeout: 10000 });
    const actionsModalText = await page.locator('#partnerActionsModal').innerText();
    log('POINTS_ACTION_MODAL', actionsModalText);
    expectText(actionsModalText, '可用點數：$5,000', 'points action modal');
    expectText(actionsModalText, '折抵住宿', 'points action modal');
    expectText(actionsModalText, '轉換現金', 'points action modal');
    await shot(page, '02_points_action_modal');

    await page.getByRole('button', { name: /折抵住宿/ }).click();
    await page.locator('#usePointsModal').waitFor({ timeout: 10000 });
    await page.locator('#use_amount').fill('1000');
    await page.locator('#use_guest_name').fill(guestName);
    await page.locator('#use_guest_phone').fill('0900001111');
    await page.locator('#use_checkin_date').fill('2026-03-10');
    await page.locator('#use_checkout_date').fill('2026-03-11');
    await page.locator('#use_room_price').fill('2500');
    await page.locator('#use_notes').fill(`PW_USE_POINTS_${ts}`);
    const useModalText = await page.locator('#usePointsModal').innerText();
    log('USE_POINTS_MODAL_FILLED', useModalText);
    expectText(useModalText, '可用點數：$5,000', 'use points modal');
    expectText(useModalText, '確認折抵', 'use points modal');
    await shot(page, '03_use_points_modal');
    await page.locator('#usePointsForm button[type="submit"]').click();
    await page.waitForFunction((code) => {
      const card = document.querySelector(`[data-partner-code="${code}"]`);
      return card && card.innerText.includes('4,000') && !card.innerText.includes('5,000');
    }, partnerCode, { timeout: 30000 });
    const cardAfterUse = await partnerCard.innerText();
    log('PARTNER_CARD_AFTER_USE', cardAfterUse);
    expectText(cardAfterUse, '4,000', 'partner card after use');
    expectText(cardAfterUse, 'NT$ 0', 'partner card after use');
    await shot(page, '04_partner_card_after_use');

    const partnerAfterUse = (await supabaseQuery('partners', `select=partner_code,available_points,points_used,pending_commission&partner_code=eq.${encodeURIComponent(partnerCode)}`))[0];
    if (!partnerAfterUse || Number(partnerAfterUse.available_points) !== 4000 || Number(partnerAfterUse.points_used) !== 1000) {
      throw new Error(`Partner points mismatch after use: ${JSON.stringify(partnerAfterUse)}`);
    }
    const usageRow = (await supabaseQuery('accommodation_usage', `select=partner_code,deduct_amount,notes,related_booking_id&partner_code=eq.${encodeURIComponent(partnerCode)}&order=id.desc&limit=1`))[0];
    if (!usageRow || Number(usageRow.deduct_amount) !== 1000) {
      throw new Error(`Accommodation usage mismatch: ${JSON.stringify(usageRow)}`);
    }
    const selfUseBooking = (await supabaseQuery('bookings', `select=partner_code,guest_name,booking_source,stay_status,room_price,notes&partner_code=eq.${encodeURIComponent(partnerCode)}&guest_name=eq.${encodeURIComponent(guestName)}&order=id.desc&limit=1`))[0];
    if (!selfUseBooking || selfUseBooking.booking_source !== 'SELF_USE' || selfUseBooking.stay_status !== 'COMPLETED') {
      throw new Error(`Self-use booking mismatch: ${JSON.stringify(selfUseBooking)}`);
    }
    log('DB_AFTER_USE', JSON.stringify({ partnerAfterUse, usageRow, selfUseBooking }));

    await partnerCard.getByRole('button', { name: /使用點數/ }).click();
    await page.locator('#partnerActionsModal').waitFor({ timeout: 10000 });
    const actionsAfterUseText = await page.locator('#partnerActionsModal').innerText();
    expectText(actionsAfterUseText, '可用點數：$4,000', 'points action modal after use');
    await shot(page, '05_points_action_modal_after_use');
    await page.getByRole('button', { name: /轉換現金/ }).click();
    await page.locator('#pointsToCashModal').waitFor({ timeout: 10000 });
    await page.locator('#points_to_convert').fill('2000');
    await page.locator('#conversion_notes').fill(`PW_CONVERT_${ts}`);
    const cashDisplayText = await page.locator('#cash_amount_display').innerText();
    const convertModalText = await page.locator('#pointsToCashModal').innerText();
    log('CONVERT_MODAL_FILLED', `${cashDisplayText}\n---\n${convertModalText}`);
    expectText(convertModalText, '最多可轉換 4,000 點', 'convert modal');
    expectText(cashDisplayText, 'NT$ 1,000', 'convert cash display');
    await shot(page, '06_convert_modal');
    await page.getByRole('button', { name: /確認轉換/ }).click();
    await page.waitForFunction((code) => {
      const card = document.querySelector(`[data-partner-code="${code}"]`);
      return card && card.innerText.includes('2,000') && card.innerText.includes('NT$ 1,000');
    }, partnerCode, { timeout: 30000 });
    const cardAfterConvert = await partnerCard.innerText();
    log('PARTNER_CARD_AFTER_CONVERT', cardAfterConvert);
    expectText(cardAfterConvert, '2,000', 'partner card after convert');
    expectText(cardAfterConvert, 'NT$ 1,000', 'partner card after convert');
    await shot(page, '07_partner_card_after_convert');

    const partnerAfterConvert = (await supabaseQuery('partners', `select=partner_code,available_points,points_used,pending_commission&partner_code=eq.${encodeURIComponent(partnerCode)}`))[0];
    if (!partnerAfterConvert || Number(partnerAfterConvert.available_points) !== 2000 || Number(partnerAfterConvert.points_used) !== 3000 || Number(partnerAfterConvert.pending_commission) !== 1000) {
      throw new Error(`Partner state mismatch after convert: ${JSON.stringify(partnerAfterConvert)}`);
    }
    const conversionPayout = (await supabaseQuery('payouts', `select=partner_code,payout_type,amount,payout_status,notes&partner_code=eq.${encodeURIComponent(partnerCode)}&payout_type=eq.CASH_CONVERSION&order=id.desc&limit=1`))[0];
    if (!conversionPayout || Number(conversionPayout.amount) !== 1000 || conversionPayout.payout_status !== 'PENDING') {
      throw new Error(`Conversion payout mismatch: ${JSON.stringify(conversionPayout)}`);
    }
    log('DB_AFTER_CONVERT', JSON.stringify({ partnerAfterConvert, conversionPayout }));

    await partnerCard.locator('button').nth(1).click();
    await page.getByRole('link', { name: /處理結算/ }).click();
    await page.locator('#partnerActionsModal').waitFor({ timeout: 10000 });
    const cashActionsText = await page.locator('#partnerActionsModal').innerText();
    log('CASH_ACTION_MODAL', cashActionsText);
    expectText(cashActionsText, '待結算：$1,000', 'cash action modal');
    expectText(cashActionsText, '執行結算', 'cash action modal');
    expectText(cashActionsText, '改回住宿金', 'cash action modal');
    await shot(page, '08_cash_action_modal');
    await page.getByRole('button', { name: /執行結算/ }).click();
    await page.waitForFunction((code) => {
      const card = document.querySelector(`[data-partner-code="${code}"]`);
      return card && card.innerText.includes('NT$ 0');
    }, partnerCode, { timeout: 30000 });
    const cardAfterPayout = await partnerCard.innerText();
    log('PARTNER_CARD_AFTER_PAYOUT', cardAfterPayout);
    expectText(cardAfterPayout, '2,000', 'partner card after payout');
    expectText(cardAfterPayout, 'NT$ 0', 'partner card after payout');
    await shot(page, '09_partner_card_after_payout');

    const partnerAfterPayout = (await supabaseQuery('partners', `select=partner_code,available_points,points_used,pending_commission,total_commission_paid&partner_code=eq.${encodeURIComponent(partnerCode)}`))[0];
    if (!partnerAfterPayout || Number(partnerAfterPayout.pending_commission) !== 0 || Number(partnerAfterPayout.available_points) !== 2000) {
      throw new Error(`Partner state mismatch after payout: ${JSON.stringify(partnerAfterPayout)}`);
    }
    const completedPayout = (await supabaseQuery('payouts', `select=partner_code,payout_type,amount,payout_status,notes&partner_code=eq.${encodeURIComponent(partnerCode)}&payout_status=eq.COMPLETED&order=id.desc&limit=1`))[0];
    if (!completedPayout || Number(completedPayout.amount) !== 1000) {
      throw new Error(`Completed payout mismatch: ${JSON.stringify(completedPayout)}`);
    }
    log('DB_AFTER_PAYOUT', JSON.stringify({ partnerAfterPayout, completedPayout }));

    await cleanup();
    log('E2E_PARTNER_FINANCIAL_RESULT', 'PASS');
  } catch (error) {
    log('E2E_PARTNER_FINANCIAL_RESULT', 'FAIL', error.stack || error.message);
    try {
      await cleanup();
    } catch (cleanupError) {
      log('CLEANUP_FAIL', cleanupError.message);
    }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
