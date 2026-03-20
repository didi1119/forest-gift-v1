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
const partnerCode = `pl${suffix}`;
const partnerName = `PL Partner ${suffix}`;
const screenshotsDir = path.join('/tmp/codex-browser-test', `payout-labels-${ts}`);
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

async function waitForInitialData(page) {
  const initialDataResponse = page.waitForResponse(response => {
    const body = response.request().postData() || '';
    return response.url().includes('/api') && response.request().method() === 'POST' && body.includes('action=get_dashboard_data') && response.status() === 200;
  }, { timeout: 30000 });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await initialDataResponse;
  await page.waitForTimeout(1500);
}

(async () => {
  let browser;
  try {
    await cleanup().catch(() => {});
    await apiAction('create_partner', {
      partner_code: partnerCode,
      coupon_code: `CP${partnerCode.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: partnerName,
      phone: '0911666001',
      email: `${partnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION',
      available_points: 2000,
      points_used: 0,
      pending_commission: 0,
      bank_name: 'Label Bank',
      bank_code: '700',
      bank_account_name: partnerName,
      bank_account_number: '1000000002001',
      notes: `E2E payout labels ${ts}`,
    });

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
    page.on('pageerror', error => log('PAGEERROR', error.stack || error.message));
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) log(`BROWSER_${message.type().toUpperCase()}`, message.text());
    });

    await waitForInitialData(page);
    await page.evaluate(() => window.showTab('overview'));

    const partnerCard = page.locator(`[data-partner-code="${partnerCode}"]`).first();
    await partnerCard.waitFor({ timeout: 10000 });
    await partnerCard.getByRole('button', { name: /使用點數/ }).click();
    await page.locator('#partnerActionsModal').waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /轉換現金/ }).click();
    await page.locator('#pointsToCashModal').waitFor({ timeout: 10000 });
    const convertModalText = await page.locator('#pointsToCashModal').innerText();
    log('CONVERT_MODAL', convertModalText);
    expectIncludes(convertModalText, '最多可轉換 2,000 點', 'points convert modal');
    await page.locator('#points_to_convert').fill('2000');
    await page.locator('#conversion_notes').fill(`PL_CONVERT_${ts}`);
    await shot(page, '01_points_convert_modal');
    await page.getByRole('button', { name: /確認轉換/ }).click();
    await page.waitForFunction((code) => {
      const card = document.querySelector(`[data-partner-code="${code}"]`);
      return card && card.innerText.includes('NT$ 1,000');
    }, partnerCode, { timeout: 30000 });

    const payouts = await supabaseQuery('payouts', `select=id,partner_code,payout_type,amount,payout_status,notes&partner_code=eq.${encodeURIComponent(partnerCode)}&order=id.asc`);
    const conversionPayout = payouts.find(p => p.payout_type === 'CASH_CONVERSION');
    if (!conversionPayout) throw new Error(`Missing CASH_CONVERSION payout: ${JSON.stringify(payouts)}`);

    await page.evaluate(() => window.showTab('payouts'));
    await page.waitForFunction((code) => {
      const table = document.querySelector('#payoutsTable');
      return table && table.innerText.includes(code);
    }, partnerCode, { timeout: 30000 });
    const tableText = await page.locator('#payoutsTable').innerText();
    log('PAYOUT_TABLE', tableText);
    expectIncludes(tableText, partnerCode, 'payout table');
    expectIncludes(tableText, '點數轉現金', 'payout table type');
    await shot(page, '02_payout_table');

    await page.evaluate((id) => window.viewPayoutDetails(String(id)), String(conversionPayout.id));
    await page.locator('#payoutDetailsModal').waitFor({ timeout: 10000 });
    const detailText = await page.locator('#payoutDetailsModal').innerText();
    log('PAYOUT_DETAIL', detailText);
    expectIncludes(detailText, '點數轉現金', 'payout detail type');
    expectIncludes(detailText, '$1,000', 'payout detail amount');
    await shot(page, '03_payout_detail');

    await page.getByRole('button', { name: '修改' }).click();
    await page.locator('#editPayoutModal').waitFor({ timeout: 10000 });
    const editValue = await page.locator('#editPayoutModal input[readonly]').nth(1).inputValue();
    const editText = await page.locator('#editPayoutModal').innerText();
    log('EDIT_MODAL', editText, 'TYPE_VALUE', editValue);
    if (editValue !== '點數轉現金') {
      throw new Error(`Edit modal type label mismatch: ${editValue}`);
    }
    await shot(page, '04_edit_modal');
    await page.locator('#editPayoutModal').getByRole('button', { name: '取消', exact: true }).click();
    await page.locator('#editPayoutModal').waitFor({ state: 'hidden', timeout: 10000 });

    await page.getByRole('button', { name: '取消結算' }).click();
    await page.getByText('結算已取消！相關訂單狀態已重置').waitFor({ timeout: 15000 });
    log('CANCEL_CONFIRM', lastDialogMessage);
    expectIncludes(lastDialogMessage, '點數轉現金', 'cancel confirm type');
    await shot(page, '05_after_cancel');

    const partnerAfterCancel = (await supabaseQuery('partners', `select=partner_code,available_points,points_used,pending_commission&partner_code=eq.${encodeURIComponent(partnerCode)}`))[0];
    const payoutsAfterCancel = await supabaseQuery('payouts', `select=partner_code,payout_type,amount,payout_status,notes&partner_code=eq.${encodeURIComponent(partnerCode)}&order=id.asc`);
    log('DB_AFTER_CANCEL', JSON.stringify({ partnerAfterCancel, payoutsAfterCancel }));
    if (Number(partnerAfterCancel.available_points) !== 2000 || Number(partnerAfterCancel.points_used) !== 0 || Number(partnerAfterCancel.pending_commission) !== 0) {
      throw new Error(`Partner balances not restored after cancelling conversion payout: ${JSON.stringify(partnerAfterCancel)}`);
    }
    if (!payoutsAfterCancel.some(p => p.payout_type === 'POINTS_ADJUSTMENT' && Number(p.amount) === 2000)) {
      throw new Error(`Missing points restoration payout: ${JSON.stringify(payoutsAfterCancel)}`);
    }

    await cleanup();
    log('E2E_PAYOUT_LABELS_RESULT', 'PASS');
  } catch (error) {
    log('E2E_PAYOUT_LABELS_RESULT', 'FAIL', error.stack || error.message);
    try { await cleanup(); } catch (cleanupError) { log('CLEANUP_FAIL', cleanupError.message); }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
