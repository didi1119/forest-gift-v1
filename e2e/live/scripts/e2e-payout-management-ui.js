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
const partnerCode = `pm${suffix}`;
const partnerName = `PM Partner ${suffix}`;
const screenshotsDir = path.join('/tmp/codex-browser-test', `payout-management-${ts}`);
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
  await supabaseDelete('payouts', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDelete('bookings', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDelete('clicks', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDelete('partners', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  log('CLEANUP_DONE', partnerCode);
}

function expectIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`${label} missing ${needle}\nActual:\n${text}`);
}

(async () => {
  let browser;
  try {
    await cleanup();

    await apiAction('create_partner', {
      partner_code: partnerCode,
      coupon_code: `CP${partnerCode.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: partnerName,
      phone: '0911222333',
      email: `${partnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'CASH',
      available_points: 0,
      points_used: 0,
      pending_commission: 300,
      bank_name: 'Payout Bank',
      bank_code: '700',
      bank_account_name: partnerName,
      bank_account_number: '777788889999',
      notes: `E2E_PAYOUT_${ts}`,
    });

    const payoutEdit = await apiAction('create_payout', {
      partner_code: partnerCode,
      payout_type: 'CASH',
      amount: 100,
      notes: `PM_EDIT_${ts}`,
      payout_status: 'PENDING',
      payout_method: 'BANK_TRANSFER',
    });
    const payoutCancel = await apiAction('create_payout', {
      partner_code: partnerCode,
      payout_type: 'CASH',
      amount: 200,
      notes: `PM_CANCEL_${ts}`,
      payout_status: 'PENDING',
      payout_method: 'BANK_TRANSFER',
    });
    const payoutEditId = payoutEdit.payout_id || payoutEdit.data?.id;
    const payoutCancelId = payoutCancel.payout_id || payoutCancel.data?.id;

    const partnerAfterSetup = (await supabaseQuery('partners', `select=partner_code,pending_commission,total_commission_paid&partner_code=eq.${encodeURIComponent(partnerCode)}`))[0];
    log('DB_AFTER_SETUP', JSON.stringify(partnerAfterSetup));
    if (!partnerAfterSetup || Number(partnerAfterSetup.pending_commission) !== 0) {
      throw new Error(`Unexpected partner state after setup: ${JSON.stringify(partnerAfterSetup)}`);
    }

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

    const initialDataResponse = page.waitForResponse(response => {
      const body = response.request().postData() || '';
      return response.url().includes('/api') &&
        response.request().method() === 'POST' &&
        body.includes('action=get_dashboard_data') &&
        response.status() === 200;
    }, { timeout: 30000 });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await initialDataResponse;
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.showTab('payouts'));
    await page.waitForFunction((code) => {
      const table = document.querySelector('#payoutsTable');
      return table && table.innerText.includes(code);
    }, partnerCode, { timeout: 30000 });

    const payoutTableText = await page.locator('#payoutsTable').innerText();
    log('PAYOUT_TABLE', payoutTableText);
    expectIncludes(payoutTableText, partnerCode, 'payout table');
    expectIncludes(payoutTableText, '現金佣金', 'payout table type text');
    await shot(page, '01_payout_table');

    await page.evaluate((id) => window.viewPayoutDetails(String(id)), String(payoutEditId));
    await page.locator('#payoutDetailsModal').waitFor({ timeout: 10000 });
    const detailText = await page.locator('#payoutDetailsModal').innerText();
    log('PAYOUT_DETAIL_EDIT', detailText);
    expectIncludes(detailText, partnerCode, 'payout detail edit');
    expectIncludes(detailText, '$100', 'payout detail amount');
    await shot(page, '02_payout_detail_edit');

    await page.getByRole('button', { name: /修改結算/ }).click();
    await page.locator('#editPayoutModal').waitFor({ timeout: 10000 });
    const editModalText = await page.locator('#editPayoutModal').innerText();
    log('EDIT_MODAL', editModalText);
    expectIncludes(editModalText, '金額、類型、大使代碼', 'edit modal warning');
    await page.locator('#edit_bank_transfer_date').fill('2026-03-15');
    await page.locator('#edit_bank_transfer_reference').fill(`PMREF${suffix}`);
    await page.locator('#edit_payout_notes').fill(`PM_EDITED_${ts}`);
    await shot(page, '03_edit_modal');
    await page.getByRole('button', { name: '儲存變更' }).click();
    await page.getByText('結算記錄修改成功！').waitFor({ timeout: 15000 });

    const payoutEditRow = (await supabaseQuery('payouts', `select=id,partner_code,payout_type,amount,payout_status,bank_transfer_date,bank_transfer_reference,notes&id=eq.${payoutEditId}`))[0];
    log('DB_AFTER_EDIT', JSON.stringify(payoutEditRow));
    if (!payoutEditRow) throw new Error('Edited payout not found');
    if (payoutEditRow.payout_type !== 'CASH' || Number(payoutEditRow.amount) !== 100) {
      throw new Error(`Protected payout fields changed unexpectedly: ${JSON.stringify(payoutEditRow)}`);
    }
    if (payoutEditRow.bank_transfer_reference !== `PMREF${suffix}` || payoutEditRow.notes !== `PM_EDITED_${ts}`) {
      throw new Error(`Editable payout metadata not saved: ${JSON.stringify(payoutEditRow)}`);
    }

    await page.evaluate((id) => window.viewPayoutDetails(String(id)), String(payoutCancelId));
    await page.locator('#payoutDetailsModal').waitFor({ timeout: 10000 });
    const cancelDetailText = await page.locator('#payoutDetailsModal').innerText();
    log('PAYOUT_DETAIL_CANCEL', cancelDetailText);
    expectIncludes(cancelDetailText, '$200', 'payout detail cancel amount');
    await shot(page, '04_payout_detail_cancel');
    await page.getByRole('button', { name: /取消此結算|取消結算/ }).click();
    // cancelPayout shows a custom confirm modal; click confirm
    await page.waitForSelector('#acm-confirm', { state: 'visible', timeout: 5000 });
    await page.locator('#acm-confirm').click();
    await page.getByText('結算已取消！相關訂單狀態已重置').waitFor({ timeout: 15000 });

    const payoutCancelRow = (await supabaseQuery('payouts', `select=id,payout_status,notes,partner_code,payout_type,amount&id=eq.${payoutCancelId}`))[0];
    const partnerAfterCancel = (await supabaseQuery('partners', `select=partner_code,pending_commission,total_commission_paid&partner_code=eq.${encodeURIComponent(partnerCode)}`))[0];
    log('DB_AFTER_CANCEL', JSON.stringify({ payoutCancelRow, partnerAfterCancel }));
    if (!payoutCancelRow || payoutCancelRow.payout_status !== 'CANCELLED') {
      throw new Error(`Cancelled payout row invalid: ${JSON.stringify(payoutCancelRow)}`);
    }
    if (!partnerAfterCancel || Number(partnerAfterCancel.pending_commission) !== 200) {
      throw new Error(`Pending commission was not restored after payout cancellation: ${JSON.stringify(partnerAfterCancel)}`);
    }

    await cleanup();
    log('E2E_PAYOUT_MANAGEMENT_RESULT', 'PASS');
  } catch (error) {
    log('E2E_PAYOUT_MANAGEMENT_RESULT', 'FAIL', error.stack || error.message);
    try { await cleanup(); } catch (cleanupError) { log('CLEANUP_FAIL', cleanupError.message); }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
