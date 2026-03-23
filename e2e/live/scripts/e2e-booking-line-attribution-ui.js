const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
}

[
  process.env.E2E_ENV_FILE,
  path.resolve(__dirname, '../../../.env.local'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env')
].forEach(loadEnvFile);

function loadPlaywrightChromium() {
  const fallbackRoot = process.env.PLAYWRIGHT_NODE_MODULES || '/tmp/codex-browser-test/node_modules';
  const candidateModules = [
    'playwright-core',
    path.resolve(fallbackRoot, 'playwright-core'),
    path.resolve(fallbackRoot, 'playwright-core/index.js')
  ];

  for (const candidate of candidateModules) {
    try {
      return require(candidate).chromium;
    } catch (_) {}
  }

  throw new Error('Cannot find playwright-core. Install it or set PLAYWRIGHT_NODE_MODULES.');
}

const chromium = loadPlaywrightChromium();

const siteOrigin = process.env.SITE_ORIGIN || 'https://forest-ambassador.vercel.app';
const adminUrl = process.env.ADMIN_URL || `${siteOrigin}/frontend/admin/admin-dashboard-real.html`;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const adminSecret = process.env.ADMIN_SECRET;
const sharedCouponId = process.env.LINE_SHARED_COUPON_ID || '';
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!adminSecret) throw new Error('Missing ADMIN_SECRET');
if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env');

const ts = Date.now();
const suffix = String(ts).slice(-6);
const lineUserId = `ULINE${suffix}`;
const lineDisplayName = `LINE 歸因客人 ${suffix}`;
const olderPartnerCode = `ba${suffix}`;
const newerPartnerCode = `bb${suffix}`;
const olderCouponCode = `FA${suffix}`;
const newerCouponCode = `FB${suffix}`;
const guestName = `Line Attribution ${suffix}`;
const guestPhone = `0955${suffix}`;
const updatedNotes = `LINE_ATTR_OVERRIDE_${suffix}`;
const screenshotsDir = path.join('/tmp/codex-browser-test', `booking-line-attribution-${ts}`);
fs.mkdirSync(screenshotsDir, { recursive: true });

let bookingId = null;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
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

async function waitFor(check, timeoutMs = 30000, intervalMs = 800) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await check();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

async function api(action, payload) {
  const res = await fetch(`${siteOrigin}/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, admin_secret: adminSecret, ...payload })
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Invalid JSON for ${action}: ${text}`);
  }
  if (!res.ok || data.success === false) {
    throw new Error(`${action} failed: ${text}`);
  }
  return data;
}

async function supabaseQuery(table, query) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase query ${table} failed: ${text}`);
  return text ? JSON.parse(text) : [];
}

async function supabaseDeleteBy(table, where) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${where}`, {
    method: 'DELETE',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Supabase delete ${table} failed: ${await res.text()}`);
  }
}

async function cleanup() {
  if (bookingId) {
    await supabaseDeleteBy('bookings', `id=eq.${bookingId}`).catch(() => {});
  }
  await supabaseDeleteBy('line_referral_claims', `line_user_id=eq.${encodeURIComponent(lineUserId)}`).catch(() => {});
  await supabaseDeleteBy('payouts', `partner_code=eq.${encodeURIComponent(olderPartnerCode)}`).catch(() => {});
  await supabaseDeleteBy('payouts', `partner_code=eq.${encodeURIComponent(newerPartnerCode)}`).catch(() => {});
  await supabaseDeleteBy('bookings', `partner_code=eq.${encodeURIComponent(olderPartnerCode)}`).catch(() => {});
  await supabaseDeleteBy('bookings', `partner_code=eq.${encodeURIComponent(newerPartnerCode)}`).catch(() => {});
  await supabaseDeleteBy('partners', `partner_code=eq.${encodeURIComponent(olderPartnerCode)}`).catch(() => {});
  await supabaseDeleteBy('partners', `partner_code=eq.${encodeURIComponent(newerPartnerCode)}`).catch(() => {});
  log('CLEANUP_DONE', guestName);
}

async function createClaim(partnerCode, couponCode, claimedAt) {
  const body = [{
    claim_key: `${lineUserId}:${partnerCode}`,
    line_user_id: lineUserId,
    line_display_name: lineDisplayName,
    entered_code: couponCode,
    normalized_entered_code: couponCode.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
    partner_code: partnerCode,
    shared_coupon_id: sharedCouponId,
    claim_status: 'CLAIMED',
    claim_count: 1,
    coupon_reply_count: 1,
    first_claimed_at: claimedAt,
    last_claimed_at: claimedAt,
    last_replied_at: claimedAt,
    last_reply_status: 'SENT',
    notes: 'e2e booking attribution ui'
  }];

  const res = await fetch(`${supabaseUrl}/rest/v1/line_referral_claims`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`createClaim failed: ${text}`);
}

async function queryBooking() {
  const rows = await supabaseQuery(
    'bookings',
    `select=id,guest_name,partner_code,line_user_id,line_display_name,attribution_source,attribution_claimed_at,attribution_entered_code,notes&guest_name=eq.${encodeURIComponent(guestName)}&order=id.desc&limit=1`
  );
  return rows[0] || null;
}

(async () => {
  let browser;
  try {
    await cleanup().catch(() => {});

    await api('create_partner', {
      partner_code: olderPartnerCode,
      name: `Older ${suffix}`,
      email: `older-${suffix}@example.com`,
      phone: `0901${suffix}`,
      contact_email: `older-${suffix}@example.com`,
      contact_phone: `0901${suffix}`,
      coupon_code: olderCouponCode,
      coupon_url: 'https://www.lx-foresthouse.com/',
      commission_preference: 'ACCOMMODATION'
    });

    await api('create_partner', {
      partner_code: newerPartnerCode,
      name: `Newer ${suffix}`,
      email: `newer-${suffix}@example.com`,
      phone: `0902${suffix}`,
      contact_email: `newer-${suffix}@example.com`,
      contact_phone: `0902${suffix}`,
      coupon_code: newerCouponCode,
      coupon_url: 'https://www.lx-foresthouse.com/',
      commission_preference: 'ACCOMMODATION'
    });

    const now = new Date();
    await createClaim(olderPartnerCode, olderCouponCode, new Date(now.getTime() - 3600 * 1000).toISOString());
    await createClaim(newerPartnerCode, newerCouponCode, now.toISOString());

    browser = await chromium.launch({
      executablePath: chromePath,
      headless: false,
      args: ['--disable-notifications', '--disable-popup-blocking']
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();

    page.on('dialog', async dialog => {
      const message = dialog.message() || '';
      log('DIALOG', dialog.type(), message);
      if (dialog.type() === 'prompt') {
        if (message.includes('管理密碼') || message.includes('admin_secret')) {
          await dialog.accept(adminSecret);
          return;
        }
        await dialog.accept('');
        return;
      }
      await dialog.accept();
    });

    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) {
        log(`BROWSER_${message.type().toUpperCase()}`, message.text());
      }
    });

    await page.goto(adminUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.body.innerText.includes('載入數據中...'), { timeout: 30000 });
    await page.locator('#tab-bookings').click({ force: true });
    await page.waitForFunction(() => {
      const tabButton = document.getElementById('tab-bookings');
      const content = document.getElementById('content-bookings');
      return !!tabButton && !!content &&
        tabButton.classList.contains('active') &&
        !content.classList.contains('hidden');
    }, { timeout: 20000 });

    await page.getByRole('button', { name: /手動登記/ }).click();
    await page.waitForSelector('#manualBookingForm');
    await page.locator('#modal_line_claim_selector').selectOption(lineUserId);
    await page.waitForFunction((expectedPartner) => {
      const partnerSelect = document.getElementById('modal_partner_code');
      return partnerSelect && partnerSelect.value === expectedPartner;
    }, newerPartnerCode, { timeout: 30000 });
    log('CLAIM_SELECTOR_DEBUG', JSON.stringify(await page.evaluate(() => ({
      selectedLineUserId: document.getElementById('modal_line_claim_selector')?.value || '',
      lineUserId: document.getElementById('modal_line_user_id')?.value || '',
      lineDisplayName: document.getElementById('modal_line_display_name')?.value || '',
      partnerCode: document.getElementById('modal_partner_code')?.value || '',
      claimInfo: document.getElementById('modal_line_claim_info')?.innerText || ''
    }))));
    ensure(await page.locator('#modal_partner_code').inputValue() === newerPartnerCode, 'manual booking should default to latest claim partner');
    await page.locator('#modal_guest_name').fill(guestName);
    await page.locator('#modal_guest_phone').fill(guestPhone);
    await page.locator('#modal_guest_email').fill(`line-attr-${suffix}@example.com`);
    await page.locator('#modal_checkin_date').fill('2026-04-20');
    await page.locator('#modal_checkout_date').fill('2026-04-21');
    await page.locator('#modal_room_price').fill('4567');
    await page.locator('#modal_notes').fill('LINE_ATTR_CREATE');
    await shot(page, '01_manual_booking_claim_prefill');
    await page.locator('#manualBookingForm button[type="submit"]').click();
    await page.waitForFunction(() => !document.querySelector('#manualBookingModal'), { timeout: 30000 });

    const createdBooking = await waitFor(queryBooking, 30000, 1000);
    bookingId = createdBooking.id;
    ensure(createdBooking.partner_code === newerPartnerCode, `booking should default to ${newerPartnerCode}: ${JSON.stringify(createdBooking)}`);
    ensure(createdBooking.line_user_id === lineUserId, `line_user_id mismatch: ${JSON.stringify(createdBooking)}`);
    ensure(createdBooking.attribution_source === 'LATEST_LINE_CLAIM', `attribution_source mismatch: ${JSON.stringify(createdBooking)}`);
    ensure(createdBooking.attribution_entered_code === newerCouponCode, `attribution_entered_code mismatch: ${JSON.stringify(createdBooking)}`);

    await page.locator('#searchBooking').click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    await page.locator('#searchBooking').type(guestName, { delay: 20 });
    const bookingRow = page.locator('#bookingsTable tr', { hasText: guestName }).first();
    await bookingRow.waitFor({ timeout: 20000 });
    await bookingRow.getByRole('button', { name: /編輯訂單/ }).click();
    await page.waitForSelector('#editBookingForm');
    ensure(await page.locator('#edit_line_user_id').inputValue() === lineUserId, 'edit form should retain line_user_id');
    ensure(await page.locator('#edit_partner_code').inputValue() === newerPartnerCode, 'edit form should show latest-claim partner before override');
    await page.locator('#edit_partner_code').selectOption(olderPartnerCode);
    await page.locator('#edit_notes').fill(updatedNotes);
    await shot(page, '02_edit_booking_manual_override');
    await page.locator('#editBookingForm button[type="submit"]').click();
    await page.waitForFunction(() => !document.querySelector('#editBookingModal'), { timeout: 30000 });

    const overriddenBooking = await waitFor(async () => {
      const row = await queryBooking();
      return row && row.notes === updatedNotes ? row : null;
    }, 30000, 1000);
    ensure(overriddenBooking.partner_code === olderPartnerCode, `manual override should keep ${olderPartnerCode}: ${JSON.stringify(overriddenBooking)}`);
    ensure(overriddenBooking.attribution_source === 'MANUAL_OVERRIDE', `manual override source mismatch: ${JSON.stringify(overriddenBooking)}`);
    ensure(overriddenBooking.attribution_entered_code === newerCouponCode, `override should preserve latest claim code snapshot: ${JSON.stringify(overriddenBooking)}`);

    await shot(page, '03_after_override_saved');
    log('E2E_BOOKING_LINE_ATTRIBUTION_RESULT', 'PASS');
  } catch (error) {
    log('E2E_BOOKING_LINE_ATTRIBUTION_RESULT', 'FAIL', error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  } finally {
    try {
      if (browser) await browser.close();
    } catch (_) {}
    try {
      await cleanup();
    } catch (cleanupError) {
      log('CLEANUP_FAIL', cleanupError.message || cleanupError);
    }
    if (process.exitCode) process.exit(process.exitCode);
  }
})();
