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
const partnerCode = `pa${String(ts).slice(-8)}`;
const partnerName = `PA Partner ${String(ts).slice(-6)}`;
const screenshotsDir = path.join('/tmp/codex-browser-test', `partner-adjustments-${ts}`);
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
  await supabaseDelete('payouts', `partner_code=eq.${encodeURIComponent(partnerCode)}`);
  await supabaseDelete('bookings', `partner_code=eq.${encodeURIComponent(partnerCode)}`);
  await supabaseDelete('partners', `partner_code=eq.${encodeURIComponent(partnerCode)}`);
  log('CLEANUP_DONE', partnerCode);
}

function expectIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`${label} missing ${needle}\nActual:\n${text}`);
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
      phone: '0922334455',
      email: `${partnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION',
      available_points: 2000,
      points_used: 300,
      pending_commission: 1200,
      bank_name: 'Adjust Bank',
      bank_code: '700',
      bank_account_name: partnerName,
      bank_account_number: '9876543210987',
      notes: `partner adjustments ${ts}`,
    });
    log('PARTNER_CREATED', partnerCode);

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
      if (!response.url().includes('/api')) {
        if (response.status() >= 400) {
          log('RESOURCE', response.status(), response.request().method(), response.url());
        }
        return;
      }
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

    const initialCard = await partnerCard.innerText();
    log('CARD_INITIAL', initialCard);
    expectIncludes(initialCard, '2,000', 'initial card points');
    expectIncludes(initialCard, 'NT$ 1,200', 'initial card pending cash');
    await shot(page, '01_initial_card');

    await partnerCard.locator('button').nth(1).click();
    await page.getByRole('link', { name: /處理結算/ }).click();
    await page.locator('#partnerActionsModal').waitFor({ timeout: 10000 });
    const cashModal = await page.locator('#partnerActionsModal').innerText();
    log('CASH_MODAL', cashModal);
    expectIncludes(cashModal, '待結算：$1,200', 'cash modal');
    expectIncludes(cashModal, '改回住宿金', 'cash modal');
    await shot(page, '02_cash_modal');

    await page.getByRole('button', { name: /改回住宿金/ }).click();
    await page.waitForFunction((code) => {
      const card = document.querySelector(`[data-partner-code="${code}"]`);
      return card && card.innerText.includes('4,400') && card.innerText.includes('NT$ 0');
    }, partnerCode, { timeout: 30000 });
    const cardAfterRevert = await partnerCard.innerText();
    log('CARD_AFTER_REVERT', cardAfterRevert);
    expectIncludes(cardAfterRevert, '4,400', 'card after revert');
    expectIncludes(cardAfterRevert, 'NT$ 0', 'card after revert');
    await shot(page, '03_card_after_revert');

    const partnerAfterRevert = (await supabaseQuery('partners', `select=partner_code,available_points,points_used,pending_commission&partner_code=eq.${encodeURIComponent(partnerCode)}`))[0];
    if (!partnerAfterRevert || Number(partnerAfterRevert.available_points) !== 4400 || Number(partnerAfterRevert.pending_commission) !== 0) {
      throw new Error(`Partner revert mismatch: ${JSON.stringify(partnerAfterRevert)}`);
    }
    const revertPayout = (await supabaseQuery('payouts', `select=partner_code,payout_type,amount,payout_status,notes&partner_code=eq.${encodeURIComponent(partnerCode)}&order=id.desc&limit=1`))[0];
    if (!revertPayout || Number(revertPayout.amount) !== 2400) {
      throw new Error(`Revert payout mismatch: ${JSON.stringify(revertPayout)}`);
    }
    log('DB_AFTER_REVERT', JSON.stringify({ partnerAfterRevert, revertPayout }));

    await partnerCard.getByText(partnerName).click();
    await page.locator('#partnerModal').waitFor({ timeout: 10000 });
    const partnerModalText = await page.locator('#partnerModal').innerText();
    log('PARTNER_MODAL', partnerModalText);
    expectIncludes(partnerModalText, '可用點數', 'partner modal');
    expectIncludes(partnerModalText, '待支付現金', 'partner modal');
    expectIncludes(partnerModalText, '編輯', 'partner modal');
    await shot(page, '04_partner_modal');

    await page.getByRole('button', { name: /編輯/ }).click();
    await page.locator(`#commission-edit-${partnerCode}`).waitFor({ timeout: 10000 });
    await page.locator(`#edit-available-points-${partnerCode}`).fill('4300');
    await page.locator(`#edit-points-used-${partnerCode}`).fill('400');
    await page.locator(`#edit-pending-cash-${partnerCode}`).fill('300');
    await page.locator(`#edit-notes-${partnerCode}`).fill(`PA_MANUAL_${ts}`);
    const editSectionText = await page.locator(`#commission-edit-${partnerCode}`).innerText();
    log('COMMISSION_EDIT_SECTION', editSectionText);
    expectIncludes(editSectionText, '調整備註', 'commission edit');
    await shot(page, '05_commission_edit');

    await page.getByRole('button', { name: /儲存/ }).click();
    await page.waitForFunction((code) => {
      const card = document.querySelector(`[data-partner-code="${code}"]`);
      return card && card.innerText.includes('4,300') && card.innerText.includes('NT$ 300');
    }, partnerCode, { timeout: 30000 });
    const cardAfterManual = await partnerCard.innerText();
    log('CARD_AFTER_MANUAL_EDIT', cardAfterManual);
    expectIncludes(cardAfterManual, '4,300', 'card after manual edit');
    expectIncludes(cardAfterManual, 'NT$ 300', 'card after manual edit');
    await shot(page, '06_card_after_manual_edit');

    const partnerAfterManual = (await supabaseQuery('partners', `select=partner_code,available_points,points_used,pending_commission&partner_code=eq.${encodeURIComponent(partnerCode)}`))[0];
    if (!partnerAfterManual || Number(partnerAfterManual.available_points) !== 4300 || Number(partnerAfterManual.points_used) !== 400 || Number(partnerAfterManual.pending_commission) !== 300) {
      throw new Error(`Partner manual edit mismatch: ${JSON.stringify(partnerAfterManual)}`);
    }
    const manualAdjustmentPayouts = await supabaseQuery(
      'payouts',
      `select=partner_code,payout_type,amount,payout_status,notes&partner_code=eq.${encodeURIComponent(partnerCode)}&payout_method=eq.MANUAL_ADJUSTMENT&notes=like.*PA_MANUAL_${ts}*&order=id.asc`
    );
    const pointsAdjustment = manualAdjustmentPayouts.find(p => p.payout_type === 'POINTS_ADJUSTMENT');
    const cashAdjustment = manualAdjustmentPayouts.find(p => p.payout_type === 'CASH_ADJUSTMENT');
    if (!pointsAdjustment || !cashAdjustment) {
      throw new Error(`Missing manual adjustment payout records: ${JSON.stringify(manualAdjustmentPayouts)}`);
    }
    if (Number(pointsAdjustment.amount) !== -100) {
      throw new Error(`Unexpected points adjustment payout: ${JSON.stringify(pointsAdjustment)}`);
    }
    if (Number(cashAdjustment.amount) !== 300) {
      throw new Error(`Unexpected cash adjustment payout: ${JSON.stringify(cashAdjustment)}`);
    }
    if (!String(pointsAdjustment.notes || '').includes('已使用點數: 300 -> 400')) {
      throw new Error(`Points adjustment note missing points_used detail: ${JSON.stringify(pointsAdjustment)}`);
    }
    log('DB_AFTER_MANUAL_EDIT', JSON.stringify({ partnerAfterManual, manualAdjustmentPayouts }));

    await cleanup();
    log('E2E_PARTNER_ADJUSTMENTS_RESULT', 'PASS');
  } catch (error) {
    log('E2E_PARTNER_ADJUSTMENTS_RESULT', 'FAIL', error.stack || error.message);
    try { await cleanup(); } catch (cleanupError) { log('CLEANUP_FAIL', cleanupError.message); }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
