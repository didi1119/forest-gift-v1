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
const partners = [
  { code: `ba${suffix}`, name: `BA Partner ${suffix}` },
  { code: `bb${suffix}`, name: `BB Partner ${suffix}` },
];
const screenshotsDir = path.join('/tmp/codex-browser-test', `batch-partner-ops-${ts}`);
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
  for (const partner of partners) {
    const code = partner.code;
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
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  if (lastError) throw lastError;
  throw new Error(`Condition not met within ${timeoutMs}ms`);
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

    for (const partner of partners) {
      await apiAction('create_partner', {
        partner_code: partner.code,
        partner_name: partner.name,
        phone: '0911777000',
        email: `${partner.code}@example.com`,
        partner_level: 'LV1_INSIDER',
        commission_preference: 'ACCOMMODATION',
        available_points: 2000,
        points_used: 0,
        pending_commission: 0,
        bank_name: 'Batch Bank',
        bank_code: '700',
        bank_account_name: partner.name,
        bank_account_number: '1000000003001',
        notes: `E2E batch ops ${ts}`,
      });
    }

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

    page.on('response', async response => {
      if (!response.url().includes('/api')) return;
      let body = '';
      try { body = response.request().postData() || ''; } catch (_) {}
      let text = '';
      try { text = await response.text(); } catch (_) {}
      log('API', response.status(), response.request().method(), 'REQ=', body.slice(0, 220), 'RESP=', text.slice(0, 220));
    });

    await waitForInitialData(page);

    for (const partner of partners) {
      const card = page.locator(`[data-partner-code="${partner.code}"]`).first();
      await card.waitFor({ timeout: 10000 });
      const initialText = await card.innerText();
      log('INITIAL_CARD', partner.code, initialText);
      expectIncludes(initialText, '2,000', `${partner.code} initial points`);
      expectIncludes(initialText, 'NT$ 0', `${partner.code} initial cash`);
    }
    await shot(page, '01_initial_cards');

    for (const partner of partners) {
      await page.locator(`[data-partner-code="${partner.code}"] .partner-selector`).check();
    }
    await page.waitForFunction(() => document.getElementById('selectedCount')?.textContent === '2', { timeout: 10000 });
    const toolbarText = await page.locator('#batchToolbar').innerText();
    log('BATCH_TOOLBAR_BEFORE_CONVERT', toolbarText);
    expectIncludes(toolbarText, '已選擇 2 位夥伴', 'batch toolbar count');
    await page.selectOption('#batchOperation', 'convert_all');
    await shot(page, '02_batch_toolbar_convert');
    await page.getByRole('button', { name: '執行' }).click();
    await page.waitForFunction((codes) => {
      return codes.every(code => {
        const card = document.querySelector(`[data-partner-code="${code}"]`);
        return card && card.innerText.includes('NT$ 1,000');
      });
    }, partners.map(p => p.code), { timeout: 30000 });

    expectIncludes(lastDialogMessage, '確定要對 2 位夥伴執行', 'batch convert confirm');
    await shot(page, '03_after_batch_convert');

    const partnersAfterConvert = await supabaseQuery('partners', `select=partner_code,available_points,points_used,pending_commission,total_commission_paid&partner_code=in.(${partners.map(p => p.code).join(',')})&order=partner_code.asc`);
    const payoutsAfterConvert = await supabaseQuery('payouts', `select=partner_code,payout_type,amount,payout_status,notes&partner_code=in.(${partners.map(p => p.code).join(',')})&order=id.asc`);
    log('DB_AFTER_BATCH_CONVERT', JSON.stringify({ partnersAfterConvert, payoutsAfterConvert }));
    for (const partner of partnersAfterConvert) {
      if (Number(partner.available_points) !== 0 || Number(partner.points_used) !== 2000 || Number(partner.pending_commission) !== 1000) {
        throw new Error(`Batch convert mismatch for ${partner.partner_code}: ${JSON.stringify(partner)}`);
      }
    }
    for (const code of partners.map(p => p.code)) {
      if (!payoutsAfterConvert.some(p => p.partner_code === code && p.payout_type === 'CASH_CONVERSION' && Number(p.amount) === 1000 && p.payout_status === 'PENDING')) {
        throw new Error(`Missing CASH_CONVERSION payout for ${code}: ${JSON.stringify(payoutsAfterConvert)}`);
      }
    }

    for (const partner of partners) {
      const checkbox = page.locator(`[data-partner-code="${partner.code}"] .partner-selector`);
      if (!(await checkbox.isChecked())) {
        await checkbox.check();
      }
    }
    await page.selectOption('#batchOperation', 'payout_pending');
    await shot(page, '04_batch_toolbar_payout');
    await page.getByRole('button', { name: '執行' }).click();
    const partnersAfterPayout = await waitForAsync(async () => {
      const rows = await supabaseQuery('partners', `select=partner_code,available_points,points_used,pending_commission,total_commission_paid&partner_code=in.(${partners.map(p => p.code).join(',')})&order=partner_code.asc`);
      if (rows.length === partners.length && rows.every(row => Number(row.pending_commission) === 0 && Number(row.total_commission_paid) === 1000)) {
        return rows;
      }
      return null;
    }, 30000, 1000);
    await page.waitForFunction((codes) => {
      return codes.every(code => {
        const card = document.querySelector(`[data-partner-code="${code}"]`);
        return card && card.innerText.includes('NT$ 0');
      });
    }, partners.map(p => p.code), { timeout: 30000 });
    await shot(page, '05_after_batch_payout');

    const payoutsAfterPayout = await supabaseQuery('payouts', `select=partner_code,payout_type,amount,payout_status,notes&partner_code=in.(${partners.map(p => p.code).join(',')})&order=id.asc`);
    log('DB_AFTER_BATCH_PAYOUT', JSON.stringify({ partnersAfterPayout, payoutsAfterPayout }));
    for (const partner of partnersAfterPayout) {
      if (Number(partner.pending_commission) !== 0 || Number(partner.total_commission_paid) !== 1000) {
        throw new Error(`Batch payout mismatch for ${partner.partner_code}: ${JSON.stringify(partner)}`);
      }
    }
    for (const code of partners.map(p => p.code)) {
      if (!payoutsAfterPayout.some(p => p.partner_code === code && p.payout_type === 'PAYMENT_COMPLETED' && Number(p.amount) === 1000)) {
        throw new Error(`Missing PAYMENT_COMPLETED payout for ${code}: ${JSON.stringify(payoutsAfterPayout)}`);
      }
    }

    await cleanup();
    log('E2E_BATCH_PARTNER_OPS_RESULT', 'PASS');
  } catch (error) {
    log('E2E_BATCH_PARTNER_OPS_RESULT', 'FAIL', error.stack || error.message);
    try { await cleanup(); } catch (cleanupError) { log('CLEANUP_FAIL', cleanupError.message); }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
