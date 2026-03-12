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
const cashPartnerCode = `pc${suffix}`;
const cashPartnerName = `PC Partner ${suffix}`;
const pointsPartnerCode = `px${suffix}`;
const pointsPartnerName = `PX Partner ${suffix}`;
const screenshotsDir = path.join('/tmp/codex-browser-test', `payout-reversal-${ts}`);
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
  for (const code of [cashPartnerCode, pointsPartnerCode]) {
    await supabaseDelete('accommodation_usage', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDelete('payouts', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDelete('bookings', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDelete('clicks', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
    await supabaseDelete('partners', `partner_code=eq.${encodeURIComponent(code)}`).catch(() => {});
  }
  log('CLEANUP_DONE', `${cashPartnerCode},${pointsPartnerCode}`);
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
      partner_code: cashPartnerCode,
      partner_name: cashPartnerName,
      phone: '0911555001',
      email: `${cashPartnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'CASH',
      available_points: 0,
      points_used: 0,
      pending_commission: 300,
      bank_name: 'Cash Reset Bank',
      bank_code: '700',
      bank_account_name: cashPartnerName,
      bank_account_number: '1000000000001',
      notes: `E2E cash cancel/reprocess ${ts}`,
    });
    await apiAction('create_partner', {
      partner_code: pointsPartnerCode,
      partner_name: pointsPartnerName,
      phone: '0911555002',
      email: `${pointsPartnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION',
      available_points: 2000,
      points_used: 0,
      pending_commission: 0,
      bank_name: 'Points Reset Bank',
      bank_code: '700',
      bank_account_name: pointsPartnerName,
      bank_account_number: '1000000000002',
      notes: `E2E points cancel ${ts}`,
    });

    const cashPayout = await apiAction('create_payout', {
      partner_code: cashPartnerCode,
      payout_type: 'CASH',
      amount: 300,
      payout_status: 'PENDING',
      payout_method: 'BANK_TRANSFER',
      notes: `PC_PENDING_${ts}`,
    });
    const cashPayoutId = cashPayout.payout_id || cashPayout.data?.id;

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
      if (response.status() >= 400) log('RESOURCE', response.status(), response.request().method(), response.url());
      if (!response.url().includes('/api')) return;
      let body = '';
      try { body = response.request().postData() || ''; } catch (_) {}
      let text = '';
      try { text = await response.text(); } catch (_) {}
      log('API', response.status(), response.request().method(), response.url(), 'REQ=', body.slice(0, 240), 'RESP=', text.slice(0, 240));
    });

    await waitForInitialData(page);

    await page.evaluate(() => window.showTab('payouts'));
    await page.waitForFunction((code) => {
      const table = document.querySelector('#payoutsTable');
      return table && table.innerText.includes(code);
    }, cashPartnerCode, { timeout: 30000 });
    const payoutTableText = await page.locator('#payoutsTable').innerText();
    log('PAYOUT_TABLE_CASH_SCENARIO', payoutTableText);
    expectIncludes(payoutTableText, cashPartnerCode, 'cash payout table');
    await shot(page, '01_cash_payout_table');

    await page.evaluate((id) => window.viewPayoutDetails(String(id)), String(cashPayoutId));
    await page.locator('#payoutDetailsModal').waitFor({ timeout: 10000 });
    const payoutDetailText = await page.locator('#payoutDetailsModal').innerText();
    log('CASH_PAYOUT_DETAIL', payoutDetailText);
    expectIncludes(payoutDetailText, '$300', 'cash payout detail');
    await shot(page, '02_cash_payout_detail');
    await page.getByRole('button', { name: '取消結算' }).click();
    await page.getByText('結算已取消！相關訂單狀態已重置').waitFor({ timeout: 15000 });

    const cashPartnerAfterCancel = (await supabaseQuery('partners', `select=partner_code,pending_commission,total_commission_paid&partner_code=eq.${encodeURIComponent(cashPartnerCode)}`))[0];
    const cashPayoutsAfterCancel = await supabaseQuery('payouts', `select=partner_code,payout_type,amount,payout_status,notes&partner_code=eq.${encodeURIComponent(cashPartnerCode)}&order=id.asc`);
    log('DB_CASH_AFTER_CANCEL', JSON.stringify({ cashPartnerAfterCancel, cashPayoutsAfterCancel }));
    if (Number(cashPartnerAfterCancel.pending_commission) !== 300) {
      throw new Error(`Cash partner pending commission not restored: ${JSON.stringify(cashPartnerAfterCancel)}`);
    }
    if (!cashPayoutsAfterCancel.some(p => p.payout_type === 'COMMISSION_REVERSAL' && Number(p.amount) === -300)) {
      throw new Error(`Missing cash cancellation reversal payout: ${JSON.stringify(cashPayoutsAfterCancel)}`);
    }

    await page.evaluate(() => window.showTab('overview'));
    const cashPartnerCard = page.locator(`[data-partner-code="${cashPartnerCode}"]`).first();
    await cashPartnerCard.waitFor({ timeout: 10000 });
    const cashCardAfterCancel = await cashPartnerCard.innerText();
    log('CASH_CARD_AFTER_CANCEL', cashCardAfterCancel);
    expectIncludes(cashCardAfterCancel, 'NT$ 300', 'cash card after cancel');
    await shot(page, '03_cash_card_after_cancel');

    await cashPartnerCard.locator('button').nth(1).click();
    await page.getByRole('link', { name: /處理結算/ }).click();
    await page.locator('#partnerActionsModal').waitFor({ timeout: 10000 });
    const cashModalText = await page.locator('#partnerActionsModal').innerText();
    log('CASH_ACTION_MODAL_AFTER_CANCEL', cashModalText);
    expectIncludes(cashModalText, '待結算：$300', 'cash action modal after cancel');
    await shot(page, '04_cash_action_modal_after_cancel');
    await page.getByRole('button', { name: /執行結算/ }).click();
    await page.waitForFunction((code) => {
      const card = document.querySelector(`[data-partner-code="${code}"]`);
      return card && card.innerText.includes('NT$ 0');
    }, cashPartnerCode, { timeout: 30000 });

    const cashPartnerAfterReprocess = (await supabaseQuery('partners', `select=partner_code,pending_commission,total_commission_paid&partner_code=eq.${encodeURIComponent(cashPartnerCode)}`))[0];
    const cashPayoutsAfterReprocess = await supabaseQuery('payouts', `select=partner_code,payout_type,amount,payout_status,notes&partner_code=eq.${encodeURIComponent(cashPartnerCode)}&order=id.asc`);
    log('DB_CASH_AFTER_REPROCESS', JSON.stringify({ cashPartnerAfterReprocess, cashPayoutsAfterReprocess }));
    if (Number(cashPartnerAfterReprocess.pending_commission) !== 0 || Number(cashPartnerAfterReprocess.total_commission_paid) !== 300) {
      throw new Error(`Cash partner reprocess mismatch: ${JSON.stringify(cashPartnerAfterReprocess)}`);
    }
    if (!cashPayoutsAfterReprocess.some(p => p.payout_type === 'PAYMENT_COMPLETED' && Number(p.amount) === 300)) {
      throw new Error(`Missing reprocessed payment payout: ${JSON.stringify(cashPayoutsAfterReprocess)}`);
    }

    const pointsPartnerCard = page.locator(`[data-partner-code="${pointsPartnerCode}"]`).first();
    await pointsPartnerCard.waitFor({ timeout: 10000 });
    const pointsCardInitial = await pointsPartnerCard.innerText();
    log('POINTS_CARD_INITIAL', pointsCardInitial);
    expectIncludes(pointsCardInitial, '2,000', 'points card initial');
    await shot(page, '05_points_card_initial');

    await pointsPartnerCard.getByRole('button', { name: /使用點數/ }).click();
    await page.locator('#partnerActionsModal').waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /轉換現金/ }).click();
    await page.locator('#pointsToCashModal').waitFor({ timeout: 10000 });
    await page.locator('#points_to_convert').fill('2000');
    await page.locator('#conversion_notes').fill(`PX_CONVERT_${ts}`);
    const convertModalText = await page.locator('#pointsToCashModal').innerText();
    log('POINTS_CONVERT_MODAL', convertModalText);
    expectIncludes(convertModalText, '最多可轉換 2,000 點', 'points convert modal');
    await shot(page, '06_points_convert_modal');
    await page.getByRole('button', { name: /確認轉換/ }).click();
    await page.waitForFunction((code) => {
      const card = document.querySelector(`[data-partner-code="${code}"]`);
      return card && card.innerText.includes('NT$ 1,000') && card.innerText.includes('0');
    }, pointsPartnerCode, { timeout: 30000 });

    const pointsPartnerAfterConvert = (await supabaseQuery('partners', `select=partner_code,available_points,points_used,pending_commission&partner_code=eq.${encodeURIComponent(pointsPartnerCode)}`))[0];
    const pointsPayoutsAfterConvert = await supabaseQuery('payouts', `select=id,partner_code,payout_type,amount,payout_status,notes&partner_code=eq.${encodeURIComponent(pointsPartnerCode)}&order=id.asc`);
    const conversionPayout = pointsPayoutsAfterConvert.find(p => p.payout_type === 'CASH_CONVERSION');
    log('DB_POINTS_AFTER_CONVERT', JSON.stringify({ pointsPartnerAfterConvert, pointsPayoutsAfterConvert }));
    if (!conversionPayout || Number(conversionPayout.amount) !== 1000) {
      throw new Error(`Missing conversion payout: ${JSON.stringify(pointsPayoutsAfterConvert)}`);
    }
    if (Number(pointsPartnerAfterConvert.available_points) !== 0 || Number(pointsPartnerAfterConvert.pending_commission) !== 1000) {
      throw new Error(`Points partner convert mismatch: ${JSON.stringify(pointsPartnerAfterConvert)}`);
    }

    await page.evaluate(() => window.showTab('payouts'));
    await page.waitForFunction((code) => document.querySelector('#payoutsTable')?.innerText.includes(code), pointsPartnerCode, { timeout: 30000 });
    await page.evaluate((id) => window.viewPayoutDetails(String(id)), String(conversionPayout.id));
    await page.locator('#payoutDetailsModal').waitFor({ timeout: 10000 });
    const conversionDetailText = await page.locator('#payoutDetailsModal').innerText();
    log('POINTS_CONVERSION_DETAIL', conversionDetailText);
    expectIncludes(conversionDetailText, '$1,000', 'points conversion detail');
    await shot(page, '07_points_conversion_detail');
    await page.getByRole('button', { name: '取消結算' }).click();
    await page.getByText('結算已取消！相關訂單狀態已重置').waitFor({ timeout: 15000 });

    const pointsPartnerAfterCancel = (await supabaseQuery('partners', `select=partner_code,available_points,points_used,pending_commission&partner_code=eq.${encodeURIComponent(pointsPartnerCode)}`))[0];
    const pointsPayoutsAfterCancel = await supabaseQuery('payouts', `select=partner_code,payout_type,amount,payout_status,notes&partner_code=eq.${encodeURIComponent(pointsPartnerCode)}&order=id.asc`);
    log('DB_POINTS_AFTER_CANCEL', JSON.stringify({ pointsPartnerAfterCancel, pointsPayoutsAfterCancel }));
    if (Number(pointsPartnerAfterCancel.available_points) !== 2000 || Number(pointsPartnerAfterCancel.points_used) !== 0 || Number(pointsPartnerAfterCancel.pending_commission) !== 0) {
      throw new Error(`Points partner not restored after conversion cancel: ${JSON.stringify(pointsPartnerAfterCancel)}`);
    }
    if (!pointsPayoutsAfterCancel.some(p => p.payout_type === 'POINTS_ADJUSTMENT' && Number(p.amount) === 2000 && String(p.notes || '').includes('撤銷點數轉現金'))) {
      throw new Error(`Missing points restoration payout: ${JSON.stringify(pointsPayoutsAfterCancel)}`);
    }

    await cleanup();
    log('E2E_PAYOUT_REVERSAL_RESULT', 'PASS');
  } catch (error) {
    log('E2E_PAYOUT_REVERSAL_RESULT', 'FAIL', error.stack || error.message);
    try { await cleanup(); } catch (cleanupError) { log('CLEANUP_FAIL', cleanupError.message); }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
