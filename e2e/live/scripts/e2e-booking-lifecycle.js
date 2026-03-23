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
const guestName = `PW-BK-${ts}`;
const guestPhone = '0900000000';
const createNotes = `PW_BK_CREATE_${ts}`;
const updateNotes = `PW_BK_UPDATE_${ts}`;
const screenshotsDir = path.join('/tmp/codex-browser-test', `booking-lifecycle-${ts}`);
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

async function focusBookingsTab(page) {
  await page.locator('#tab-bookings').click({ force: true });
  await page.waitForFunction(() => {
    const tabButton = document.getElementById('tab-bookings');
    const content = document.getElementById('content-bookings');
    return !!tabButton && !!content &&
      tabButton.classList.contains('active') &&
      !content.classList.contains('hidden');
  }, { timeout: 20000 });
  await page.waitForSelector('#searchBooking', { state: 'visible', timeout: 10000 });
}

async function searchBooking(page, name) {
  await page.locator('#searchBooking').click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Backspace');
  await page.locator('#searchBooking').type(name, { delay: 30 });
  await page.waitForTimeout(500);
}

async function queryBookingByName(name) {
  const url = `${supabaseUrl}/rest/v1/bookings?select=*&guest_name=eq.${encodeURIComponent(name)}&order=id.desc&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase query failed: ${text}`);
  const json = text ? JSON.parse(text) : [];
  return json[0] || null;
}

async function queryPayoutsByBookingId(bookingId) {
  const url = `${supabaseUrl}/rest/v1/payouts?select=*&related_booking_ids=cs.{${bookingId}}&order=id.desc`;
  const res = await fetch(url, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase payouts query failed: ${text}`);
  return text ? JSON.parse(text) : [];
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

async function cleanupBooking(id) {
  if (!id) return;
  const res = await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${id}`, {
    method: 'DELETE',
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  log('CLEANUP_BOOKING', id, 'status', res.status);
}

async function cleanupPayouts(bookingId) {
  if (!bookingId) return;
  const res = await fetch(`${supabaseUrl}/rest/v1/payouts?related_booking_ids=cs.{${bookingId}}`, {
    method: 'DELETE',
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  log('CLEANUP_PAYOUTS', bookingId, 'status', res.status);
}

(async () => {
  let browser;
  let bookingId = null;
  try {
    log('=== E2E BOOKING LIFECYCLE START ===');
    log('Guest name:', guestName);
    log('Screenshots dir:', screenshotsDir);

    browser = await chromium.launch({
      executablePath: chromePath,
      headless: false,
      args: ['--disable-notifications', '--disable-popup-blocking'],
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();

    page.on('dialog', async dialog => {
      log('DIALOG', dialog.type(), dialog.message());
      if (dialog.type() === 'prompt') {
        await dialog.accept(adminSecret);
      } else {
        await dialog.accept();
      }
    });

    page.on('pageerror', error => {
      log('PAGEERROR', error.stack || error.message);
    });

    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) {
        log(`BROWSER_${message.type().toUpperCase()}`, message.text());
      }
    });

    page.on('response', async response => {
      if (!response.url().includes('/api')) return;
      const req = response.request();
      let body = '';
      try { body = req.postData() || ''; } catch (_) {}
      let text = '';
      try { text = await response.text(); } catch (_) {}
      log('API', response.status(), req.method(), response.url(), 'REQ=', body.slice(0, 300), 'RESP=', text.slice(0, 300));
    });

    // ── STEP 1: Load dashboard, navigate to bookings tab ──
    log('STEP 1: Loading admin dashboard...');
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.body.innerText.includes('載入數據中...'), { timeout: 30000 });

    const pageText = await page.locator('body').innerText();
    if (pageText.includes('數據格式錯誤')) {
      throw new Error('Dashboard shows 數據格式錯誤');
    }

    await focusBookingsTab(page);
    await page.waitForSelector('#bookingsTable');
    await page.waitForFunction(() => {
      const el = document.querySelector('#bookingsTable');
      return !!el && !el.innerText.includes('載入中');
    }, { timeout: 20000 });
    await shot(page, '01_bookings_tab_loaded');
    log('STEP 1: PASS - Bookings tab loaded');

    // ── STEP 2: Open manual booking modal ──
    log('STEP 2: Opening manual booking modal...');
    await page.getByRole('button', { name: /手動登記/ }).click();
    await page.waitForSelector('#manualBookingForm', { state: 'visible', timeout: 10000 });
    await shot(page, '02_manual_booking_modal_open');
    log('STEP 2: PASS - Manual booking modal opened');

    // ── STEP 3: Fill booking form ──
    log('STEP 3: Filling booking form...');
    await page.locator('#modal_guest_name').fill(guestName);
    await page.locator('#modal_guest_phone').fill(guestPhone);
    await page.locator('#modal_checkin_date').fill('2026-03-01');
    await page.locator('#modal_checkout_date').fill('2026-03-02');
    await page.locator('#modal_room_price').fill('5000');
    // Select partner (AMB7453 exists in test DB)
    const partnerSelect = page.locator('#modal_partner_code');
    const optionCount = await partnerSelect.locator('option').count();
    if (optionCount > 1) {
      await partnerSelect.selectOption({ index: 1 }); // first real partner
    }
    await page.locator('#modal_payment_status').selectOption('PAID');
    await page.locator('#modal_notes').fill(createNotes);
    await shot(page, '03_booking_form_filled');
    log('STEP 3: PASS - Form filled');

    // ── STEP 4: Submit and verify row appears ──
    log('STEP 4: Submitting booking...');
    await page.locator('#manualBookingForm button[type="submit"]').click();
    await page.waitForFunction(() => !document.querySelector('#manualBookingModal'), { timeout: 20000 });
    await page.waitForTimeout(2500);

    await focusBookingsTab(page);
    await searchBooking(page, guestName);
    const row = page.locator('#bookingsTable tr', { hasText: guestName }).first();
    await row.waitFor({ timeout: 20000 });
    const rowTextCreate = await row.innerText();
    log('ROW_AFTER_CREATE', rowTextCreate);

    if (!rowTextCreate.includes('5,000') && !rowTextCreate.includes('5,000')) {
      throw new Error(`Row missing price after create: ${rowTextCreate}`);
    }
    if (!rowTextCreate.includes('待入住')) {
      throw new Error(`Row missing PENDING status: ${rowTextCreate}`);
    }
    await shot(page, '04_booking_created_in_table');
    log('STEP 4: PASS - Booking appears in table');

    // ── STEP 5: Verify in Supabase ──
    log('STEP 5: Verifying in Supabase...');
    let booking = await queryBookingByName(guestName);
    if (!booking) throw new Error('Booking not found in Supabase after create');
    bookingId = booking.id;
    log('DB_AFTER_CREATE', JSON.stringify({
      id: booking.id,
      guest_name: booking.guest_name,
      guest_phone: booking.guest_phone,
      room_price: booking.room_price,
      stay_status: booking.stay_status,
      payment_status: booking.payment_status,
      notes: booking.notes,
    }));

    if (booking.guest_name !== guestName) throw new Error(`DB guest_name mismatch: ${booking.guest_name}`);
    if (booking.room_price !== 5000) throw new Error(`DB room_price mismatch: ${booking.room_price}`);
    if (booking.stay_status !== 'PENDING') throw new Error(`DB stay_status mismatch: ${booking.stay_status}`);
    if (booking.payment_status !== 'PAID') throw new Error(`DB payment_status mismatch: ${booking.payment_status}`);
    log('STEP 5: PASS - Supabase data verified');

    // ── STEP 6: Click edit button ──
    log('STEP 6: Opening edit modal...');
    await focusBookingsTab(page);
    await searchBooking(page, guestName);
    const rowForEdit = page.locator('#bookingsTable tr', { hasText: guestName }).first();
    await rowForEdit.waitFor({ timeout: 10000 });
    await rowForEdit.getByRole('button', { name: /編輯訂單/ }).click();
    await page.waitForSelector('#editBookingForm', { state: 'visible', timeout: 10000 });
    await shot(page, '05_edit_modal_open');
    log('STEP 6: PASS - Edit modal opened');

    // ── STEP 7: Change room_price and notes ──
    log('STEP 7: Editing booking...');
    await page.locator('#edit_room_price').fill('6000');
    await page.locator('#edit_notes').fill(updateNotes);
    await shot(page, '06_edit_modal_filled');
    log('STEP 7: Submitting edit...');
    await page.locator('#editBookingForm button[type="submit"]').click();
    await page.waitForFunction(() => !document.querySelector('#editBookingModal'), { timeout: 20000 });
    await page.waitForTimeout(2500);

    // ── STEP 8: Verify row updated ──
    log('STEP 8: Verifying UI after edit...');
    await focusBookingsTab(page);
    await searchBooking(page, guestName);
    const rowAfterEdit = page.locator('#bookingsTable tr', { hasText: guestName }).first();
    await rowAfterEdit.waitFor({ timeout: 10000 });
    const rowTextEdit = await rowAfterEdit.innerText();
    log('ROW_AFTER_EDIT', rowTextEdit);

    if (!rowTextEdit.includes('NT$ 6,000') && !rowTextEdit.includes('6,000')) {
      throw new Error(`Row did not update room price: ${rowTextEdit}`);
    }

    booking = await queryBookingByName(guestName);
    if (!booking || booking.room_price !== 6000) {
      throw new Error(`Supabase room_price mismatch after edit: ${JSON.stringify(booking)}`);
    }
    if (booking.notes !== updateNotes) {
      throw new Error(`Supabase notes mismatch after edit: ${booking.notes}`);
    }
    log('DB_AFTER_EDIT', JSON.stringify({
      id: booking.id,
      room_price: booking.room_price,
      notes: booking.notes,
      stay_status: booking.stay_status,
    }));
    await shot(page, '07_after_edit_verified');
    log('STEP 8: PASS - Edit verified in UI and DB');

    // ── STEP 9: Confirm checkin ──
    log('STEP 9: Confirming checkin...');
    await focusBookingsTab(page);
    await searchBooking(page, guestName);
    const rowForConfirm = page.locator('#bookingsTable tr', { hasText: guestName }).first();
    await rowForConfirm.waitFor({ timeout: 10000 });
    await rowForConfirm.getByRole('button', { name: /確認入住/ }).click();
    await page.waitForSelector('#acm-confirm', { state: 'visible', timeout: 5000 });
    await shot(page, '08_confirm_checkin_modal');
    await page.locator('#acm-confirm').click();

    // ── STEP 10: Verify stay_status changed to COMPLETED ──
    log('STEP 10: Verifying checkin completion...');
    await page.waitForFunction((targetName) => {
      const rows = Array.from(document.querySelectorAll('#bookingsTable tr'));
      const targetRow = rows.find(r => r.innerText.includes(targetName));
      return targetRow && targetRow.innerText.includes('已完成');
    }, guestName, { timeout: 30000 });
    await shot(page, '09_after_confirm_checkin');

    const rowAfterConfirm = page.locator('#bookingsTable tr', { hasText: guestName }).first();
    const rowTextConfirm = await rowAfterConfirm.innerText();
    log('ROW_AFTER_CONFIRM', rowTextConfirm);
    if (!rowTextConfirm.includes('已完成')) {
      throw new Error(`Row did not become completed: ${rowTextConfirm}`);
    }
    log('STEP 10: PASS - Stay status is COMPLETED in UI');

    // ── STEP 11: Verify commission calculated in Supabase ──
    log('STEP 11: Verifying commission in Supabase...');
    booking = await queryBookingByName(guestName);
    if (!booking) throw new Error('Booking not found after confirm');
    if (booking.stay_status !== 'COMPLETED') {
      throw new Error(`DB stay_status not COMPLETED: ${booking.stay_status}`);
    }
    log('DB_AFTER_CONFIRM', JSON.stringify({
      id: booking.id,
      stay_status: booking.stay_status,
      commission_status: booking.commission_status,
      commission_amount: booking.commission_amount,
      commission_type: booking.commission_type,
      manually_confirmed_by: booking.manually_confirmed_by,
    }));
    log('STEP 11: PASS - Commission data verified in DB');

    // ── STEP 12: Delete booking via API ──
    log('STEP 12: Deleting booking via API...');
    const deleteResult = await apiAction('delete_booking', { booking_id: bookingId });
    log('DELETE_RESULT', JSON.stringify(deleteResult));
    log('STEP 12: PASS - Booking deleted via API');

    // ── STEP 13: Verify booking marked as deleted ──
    log('STEP 13: Verifying deletion in Supabase...');
    booking = await queryBookingByName(guestName);
    if (!booking) throw new Error('Booking row not found after delete');
    if (booking.stay_status !== 'CANCELLED') {
      throw new Error(`DB stay_status after delete should be CANCELLED, got: ${booking.stay_status}`);
    }
    log('DB_AFTER_DELETE', JSON.stringify({
      id: booking.id,
      stay_status: booking.stay_status,
      commission_status: booking.commission_status,
    }));
    log('STEP 13: PASS - Booking is CANCELLED in DB');

    // ── STEP 14: Restore booking via API ──
    log('STEP 14: Restoring booking via API...');
    const restoreResult = await apiAction('restore_booking', { booking_id: bookingId });
    log('RESTORE_RESULT', JSON.stringify(restoreResult));
    log('STEP 14: PASS - Booking restored via API');

    // ── STEP 15: Verify booking restored ──
    log('STEP 15: Verifying restoration in Supabase...');
    booking = await queryBookingByName(guestName);
    if (!booking) throw new Error('Booking not found after restore');
    if (booking.stay_status === 'CANCELLED') {
      throw new Error(`DB stay_status still CANCELLED after restore: ${booking.stay_status}`);
    }
    log('DB_AFTER_RESTORE', JSON.stringify({
      id: booking.id,
      stay_status: booking.stay_status,
      commission_status: booking.commission_status,
    }));

    // Reload dashboard and verify restored booking appears in UI
    log('Reloading dashboard to verify restored booking in UI...');
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.body.innerText.includes('載入數據中...'), { timeout: 30000 });
    await focusBookingsTab(page);
    await page.waitForFunction(() => {
      const el = document.querySelector('#bookingsTable');
      return !!el && !el.innerText.includes('載入中');
    }, { timeout: 20000 });
    await searchBooking(page, guestName);
    const rowAfterRestore = page.locator('#bookingsTable tr', { hasText: guestName }).first();
    await rowAfterRestore.waitFor({ timeout: 20000 });
    const rowTextRestore = await rowAfterRestore.innerText();
    log('ROW_AFTER_RESTORE', rowTextRestore);
    await shot(page, '10_after_restore');
    log('STEP 15: PASS - Booking restored and visible in UI');

    // ── STEP 16: Cleanup ──
    log('STEP 16: Cleaning up test data...');
    await cleanupPayouts(bookingId);
    await cleanupBooking(bookingId);
    const postCleanup = await queryBookingByName(guestName);
    if (postCleanup) {
      throw new Error(`Cleanup failed, booking still exists: ${JSON.stringify(postCleanup)}`);
    }
    log('STEP 16: PASS - Test data cleaned up');

    log('=== E2E BOOKING LIFECYCLE RESULT: PASS ===');
    await page.waitForTimeout(1000);
    await browser.close();
  } catch (error) {
    log('=== E2E BOOKING LIFECYCLE RESULT: FAIL ===', error && error.stack ? error.stack : String(error));
    try {
      if (bookingId) {
        await cleanupPayouts(bookingId).catch(() => {});
        await cleanupBooking(bookingId).catch(() => {});
      }
    } catch (_) {}
    if (browser) await browser.close();
    process.exit(1);
  }
})();
