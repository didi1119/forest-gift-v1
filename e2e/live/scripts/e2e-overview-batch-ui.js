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
const partnerCodes = [`ov${suffix}a`, `ov${suffix}b`];
const partnerNames = [`OV Partner A ${suffix}`, `OV Partner B ${suffix}`];
const guestNames = [`OV Guest A ${suffix}`, `OV Guest B ${suffix}`];
const screenshotsDir = path.join('/tmp/codex-browser-test', `overview-batch-${ts}`);
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

async function visitTrackingLink(partnerCode, dest = 'landing') {
  const res = await fetch(`${apiBase}?dest=${encodeURIComponent(dest)}&pid=${encodeURIComponent(partnerCode)}`, {
    method: 'GET',
    redirect: 'manual',
  });
  if (![200, 302, 303, 307, 308].includes(res.status)) {
    throw new Error(`Tracking request failed for ${partnerCode}: ${res.status}`);
  }
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
  for (const partnerCode of partnerCodes) {
    await supabaseDelete('payouts', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
    await supabaseDelete('bookings', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
    await supabaseDelete('clicks', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
    await supabaseDelete('partners', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  }
  log('CLEANUP_DONE', partnerCodes.join(','));
}

function expectIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`${label} missing ${needle}\nActual:\n${text}`);
}

function currency(n) {
  return `$${Number(n || 0).toLocaleString()}`;
}

function computeOverviewMetrics(data) {
  const totalPartners = data.partners.length;
  const totalClicks = data.clicks.length;
  const completedBookings = data.bookings.filter(b => b.stay_status === 'COMPLETED').length;
  const totalPayouts = data.partners.reduce((sum, p) => sum + (Number(p.pending_cash || p.pending_commission || 0)), 0);
  const completionRate = totalClicks > 0 ? `${((completedBookings / totalClicks) * 100).toFixed(1)}%` : '0.0%';
  return {
    totalPartners: String(totalPartners),
    totalClicks: String(totalClicks),
    totalStayCompleted: String(completedBookings),
    stayCompletionRate: completionRate,
    totalPayouts: currency(totalPayouts),
  };
}

function computeAnalyticsMetrics(data) {
  const totalBookings = data.bookings.length;
  const completedBookings = data.bookings.filter(b => b.stay_status === 'COMPLETED');
  const totalCommission = completedBookings.reduce((sum, b) => sum + (parseFloat(b.commission_amount) || 0), 0);
  const conversionRate = totalBookings > 0 ? `${((completedBookings.length / totalBookings) * 100).toFixed(1)}%` : '0.0%';
  const avgCommission = `$${completedBookings.length > 0 ? Math.round(totalCommission / completedBookings.length) : 0}`;
  const partnerStats = data.partners.map(partner => {
    const partnerBookings = data.bookings.filter(b => b.partner_code === partner.partner_code);
    const partnerCompleted = partnerBookings.filter(b => b.stay_status === 'COMPLETED');
    return {
      partner_code: partner.partner_code,
      name: partner.name || '-',
      bookings: partnerBookings.length,
      completed: partnerCompleted.length,
      conversionRate: partnerBookings.length > 0 ? ((partnerCompleted.length / partnerBookings.length) * 100) : 0,
      avgOrderValue: partnerCompleted.length > 0
        ? Math.round(partnerCompleted.reduce((sum, b) => sum + (parseFloat(b.room_price) || 0), 0) / partnerCompleted.length)
        : 0,
      total_commission_earned: parseFloat(partner.total_commission_earned) || 0,
    };
  }).sort((a, b) => b.conversionRate - a.conversionRate);
  const top = partnerStats[0] || { conversionRate: 0, name: '-' };
  return {
    totalConversionRate: conversionRate,
    avgCommissionPerBooking: avgCommission,
    topAmbassadorConversion: `${top.conversionRate.toFixed(1)}%`,
    topAmbassadorName: top.name || '-',
    partnerStats,
  };
}

function computePartnerClickCounts(data) {
  return data.clicks.reduce((acc, click) => {
    const key = click.partner_code || '__unknown__';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

(async () => {
  let browser;
  const resourceErrors = [];
  try {
    await cleanup();

    await apiAction('create_partner', {
      partner_code: partnerCodes[0],
      coupon_code: `CP${partnerCodes[0].toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: partnerNames[0],
      phone: '0911000001',
      email: `${partnerCodes[0]}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'CASH',
      available_points: 600,
      points_used: 0,
      pending_commission: 800,
      bank_name: 'Overview Bank',
      bank_code: '700',
      bank_account_name: partnerNames[0],
      bank_account_number: '1234567890123',
      notes: `overview batch ${ts}`,
    });
    await apiAction('create_partner', {
      partner_code: partnerCodes[1],
      coupon_code: `CP${partnerCodes[1].toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: partnerNames[1],
      phone: '0911000002',
      email: `${partnerCodes[1]}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'CASH',
      available_points: 900,
      points_used: 0,
      pending_commission: 1200,
      bank_name: 'Overview Bank',
      bank_code: '700',
      bank_account_name: partnerNames[1],
      bank_account_number: '1234567890999',
      notes: `overview batch ${ts}`,
    });

    const booking1 = await apiAction('create_booking', {
      partner_code: partnerCodes[0],
      guest_name: guestNames[0],
      guest_phone: '0900111222',
      guest_email: `${partnerCodes[0]}-guest@example.com`,
      checkin_date: '2026-03-20',
      checkout_date: '2026-03-21',
      room_price: 5000,
      booking_source: 'MANUAL',
      notes: `overview booking ${ts}`,
    });
    const booking2 = await apiAction('create_booking', {
      partner_code: partnerCodes[1],
      guest_name: guestNames[1],
      guest_phone: '0900333444',
      guest_email: `${partnerCodes[1]}-guest@example.com`,
      checkin_date: '2026-03-22',
      checkout_date: '2026-03-23',
      room_price: 3600,
      booking_source: 'MANUAL',
      notes: `overview booking ${ts}`,
    });

    await apiAction('confirm_checkin_completion', {
      booking_id: booking1.booking_id || booking1.id,
      confirmed_by: 'codex_overview_batch',
    });

    await visitTrackingLink(partnerCodes[0], 'landing');
    await visitTrackingLink(partnerCodes[0], 'coupon');
    await visitTrackingLink(partnerCodes[1], 'landing');

    const dashboardBeforeBatch = (await apiAction('get_dashboard_data', {})).data;
    const overviewExpected = computeOverviewMetrics(dashboardBeforeBatch);
    const analyticsExpected = computeAnalyticsMetrics(dashboardBeforeBatch);
    const partnerClickCounts = computePartnerClickCounts(dashboardBeforeBatch);
    log('EXPECTED_OVERVIEW_BEFORE', JSON.stringify(overviewExpected));
    log('EXPECTED_ANALYTICS', JSON.stringify({
      totalConversionRate: analyticsExpected.totalConversionRate,
      avgCommissionPerBooking: analyticsExpected.avgCommissionPerBooking,
      topAmbassadorConversion: analyticsExpected.topAmbassadorConversion,
      topAmbassadorName: analyticsExpected.topAmbassadorName,
    }));
    log('EXPECTED_PARTNER_CLICKS', JSON.stringify(partnerClickCounts));

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
      if (response.status() >= 400) {
        const line = `${response.status()} ${response.request().method()} ${response.url()}`;
        resourceErrors.push(line);
        log('RESOURCE', line);
      }
      if (!response.url().includes('/api')) return;
      let body = '';
      try { body = response.request().postData() || ''; } catch (_) {}
      let text = '';
      try { text = await response.text(); } catch (_) {}
      log('API', response.status(), response.request().method(), response.url(), 'REQ=', body.slice(0, 240), 'RESP=', text.slice(0, 240));
    });

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(({ expectedPartners, expectedClicks }) => {
      const partners = document.querySelector('#totalPartners')?.textContent?.trim();
      const clicks = document.querySelector('#totalClicks')?.textContent?.trim();
      return partners === expectedPartners && clicks === expectedClicks;
    }, {
      expectedPartners: overviewExpected.totalPartners,
      expectedClicks: overviewExpected.totalClicks,
    }, { timeout: 30000 });
    await page.evaluate(() => window.showTab('overview'));

    const overviewActual = {
      totalPartners: (await page.locator('#totalPartners').innerText()).trim(),
      totalClicks: (await page.locator('#totalClicks').innerText()).trim(),
      totalStayCompleted: (await page.locator('#totalStayCompleted').innerText()).trim(),
      stayCompletionRate: (await page.locator('#stayCompletionRate').innerText()).trim(),
      totalPayouts: (await page.locator('#totalPayouts').innerText()).trim(),
    };
    log('OVERVIEW_ACTUAL', JSON.stringify(overviewActual));
    for (const [key, value] of Object.entries(overviewExpected)) {
      if (overviewActual[key] !== value) {
        throw new Error(`Overview metric mismatch for ${key}: expected ${value}, got ${overviewActual[key]}`);
      }
    }

    // Use table row locator (table view is default in refactored UI)
    const rowA = page.locator(`tr:has(input[data-partner-code="${partnerCodes[0]}"])`).first();
    const rowB = page.locator(`tr:has(input[data-partner-code="${partnerCodes[1]}"])`).first();
    await rowA.waitFor({ timeout: 30000 });
    await rowB.waitFor({ timeout: 30000 });

    // Verify partner data via Supabase instead of UI text (table format differs from old card format)
    const partnersBefore = await supabaseQuery('partners', `select=partner_code,pending_commission,available_points&partner_code=in.(${partnerCodes.map(c => `"${c}"`).join(',')})&order=partner_code.asc`);
    const partnerABefore = partnersBefore.find(p => p.partner_code === partnerCodes[0]);
    const partnerBBefore = partnersBefore.find(p => p.partner_code === partnerCodes[1]);
    if (Number(partnerABefore.pending_commission) + Number(partnerABefore.available_points) === 0) throw new Error('Partner A has no financial data');
    if (Number(partnerBBefore.pending_commission) !== 1200) throw new Error(`Partner B pending commission expected 1200, got ${partnerBBefore.pending_commission}`);
    log('DB_PARTNERS_BEFORE_BATCH', JSON.stringify(partnersBefore));
    await shot(page, '01_overview_before_batch');

    await page.locator('#tab-analytics').click();
    await page.waitForTimeout(1500);
    const analyticsActual = {
      totalConversionRate: (await page.locator('#totalConversionRate').innerText()).trim(),
      avgCommissionPerBooking: (await page.locator('#avgCommissionPerBooking').innerText()).trim(),
      topAmbassadorConversion: (await page.locator('#topAmbassadorConversion').innerText()).trim(),
      topAmbassadorName: (await page.locator('#topAmbassadorName').innerText()).trim(),
    };
    log('ANALYTICS_ACTUAL', JSON.stringify(analyticsActual));
    for (const key of ['totalConversionRate', 'avgCommissionPerBooking', 'topAmbassadorConversion', 'topAmbassadorName']) {
      if (analyticsActual[key] !== analyticsExpected[key]) {
        throw new Error(`Analytics metric mismatch for ${key}: expected ${analyticsExpected[key]}, got ${analyticsActual[key]}`);
      }
    }
    const analyticsTableText = await page.locator('#detailedAnalyticsTable').innerText();
    log('ANALYTICS_TABLE', analyticsTableText);
    expectIncludes(analyticsTableText, partnerCodes[0], 'analytics table');
    expectIncludes(analyticsTableText, partnerCodes[1], 'analytics table');
    expectIncludes(analyticsTableText, '開發中', 'analytics clicks placeholder');
    await shot(page, '02_analytics_metrics');

    await page.locator('#tab-overview').click();
    await page.waitForTimeout(1000);
    await rowA.locator('.partner-selector').check();
    await rowB.locator('.partner-selector').check();
    const toolbarText = await page.locator('#batchToolbar').innerText();
    log('BATCH_TOOLBAR', toolbarText);
    expectIncludes(toolbarText, '已選擇 2 位夥伴', 'batch toolbar');
    await page.selectOption('#batchOperation', 'payout_pending');
    await shot(page, '03_batch_toolbar_ready');
    await page.getByRole('button', { name: '執行' }).click();
    // executeBatchAction shows a custom confirm modal; click confirm
    await page.waitForSelector('#acm-confirm', { state: 'visible', timeout: 5000 });
    await page.locator('#acm-confirm').click();

    await page.getByText(/批量操作完成！已執行「結算待付現金」並處理 2 位夥伴/).waitFor({ timeout: 15000 });

    // Wait for pending cash to clear in table rows (table view uses $0 format)
    await page.waitForFunction((codes) => {
      return codes.every(code => {
        const checkbox = document.querySelector(`input[data-partner-code="${code}"]`);
        const row = checkbox && checkbox.closest('tr');
        return row && row.innerText.includes('$0');
      });
    }, partnerCodes, { timeout: 30000 });

    // Verify via DB instead of row text
    const partnersAfterBatchDb = await supabaseQuery('partners', `select=partner_code,pending_commission&partner_code=in.(${partnerCodes.map(c => `"${c}"`).join(',')})&order=partner_code.asc`);
    for (const row of partnersAfterBatchDb) {
      if (Number(row.pending_commission) !== 0) {
        throw new Error(`Partner ${row.partner_code} pending commission not cleared after batch: ${JSON.stringify(row)}`);
      }
    }
    log('DB_PARTNERS_AFTER_BATCH_UI', JSON.stringify(partnersAfterBatchDb));
    await shot(page, '04_overview_after_batch');

    const dashboardAfterBatch = (await apiAction('get_dashboard_data', {})).data;
    const overviewAfterExpected = computeOverviewMetrics(dashboardAfterBatch);
    const overviewAfterActual = {
      totalPartners: (await page.locator('#totalPartners').innerText()).trim(),
      totalClicks: (await page.locator('#totalClicks').innerText()).trim(),
      totalStayCompleted: (await page.locator('#totalStayCompleted').innerText()).trim(),
      stayCompletionRate: (await page.locator('#stayCompletionRate').innerText()).trim(),
      totalPayouts: (await page.locator('#totalPayouts').innerText()).trim(),
    };
    log('OVERVIEW_AFTER_BATCH', JSON.stringify(overviewAfterActual));
    for (const [key, value] of Object.entries(overviewAfterExpected)) {
      if (overviewAfterActual[key] !== value) {
        throw new Error(`Overview after batch mismatch for ${key}: expected ${value}, got ${overviewAfterActual[key]}`);
      }
    }

    const partnerRows = await supabaseQuery('partners', `select=partner_code,pending_commission,total_commission_paid&partner_code=in.(${partnerCodes.map(c => `\"${c}\"`).join(',')})&order=partner_code.asc`);
    log('DB_PARTNERS_AFTER_BATCH', JSON.stringify(partnerRows));
    for (const row of partnerRows) {
      if (Number(row.pending_commission) !== 0) {
        throw new Error(`Partner pending commission not cleared: ${JSON.stringify(row)}`);
      }
    }

    const payoutRows = await supabaseQuery('payouts', `select=partner_code,payout_type,amount,payout_status,notes&partner_code=in.(${partnerCodes.map(c => `\"${c}\"`).join(',')})&payout_type=eq.PAYMENT_COMPLETED&order=id.asc`);
    log('DB_PAYOUTS_AFTER_BATCH', JSON.stringify(payoutRows));
    const batchPayoutPartners = new Set(payoutRows.map(p => p.partner_code));
    for (const code of partnerCodes) {
      if (!batchPayoutPartners.has(code)) {
        throw new Error(`Missing PAYMENT_COMPLETED payout for ${code}`);
      }
    }

    const bookingRows = await supabaseQuery('bookings', `select=id,partner_code,stay_status,commission_status,commission_amount&guest_name=in.(\"${guestNames[0]}\",\"${guestNames[1]}\")&order=id.asc`);
    log('DB_BOOKINGS', JSON.stringify(bookingRows));

    const blockingErrors = resourceErrors.filter(line => !line.includes('cdn.tailwindcss.com'));
    if (blockingErrors.length > 0) {
      throw new Error(`Unexpected resource errors: ${blockingErrors.join(' | ')}`);
    }

    await cleanup();
    log('E2E_OVERVIEW_BATCH_RESULT', 'PASS');
  } catch (error) {
    log('E2E_OVERVIEW_BATCH_RESULT', 'FAIL', error.stack || error.message);
    try { await cleanup(); } catch (cleanupError) { log('CLEANUP_FAIL', cleanupError.message); }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
