const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const siteOrigin = process.env.SITE_ORIGIN || 'https://forest-ambassador.vercel.app';
const baseUrl = process.env.BASE_URL || `${siteOrigin}/frontend/admin/admin-dashboard-real.html`;
const adminSecret = process.env.ADMIN_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!adminSecret) throw new Error('Missing ADMIN_SECRET');
if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env');

const ts = Date.now();
const guestName = `PW-E2E-${ts}`;
const guestPhone = '0900000000';
const createNotes = `PW_CREATE_${ts}`;
const updateNotes = `PW_UPDATE_${ts}`;
const screenshotsDir = path.join('/tmp/codex-browser-test', `screens-${ts}`);
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
  await page.locator('#tab-bookings').click();
  await page.waitForSelector('#searchBooking', { state: 'visible', timeout: 10000 });
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 200)}`);
  }
  return { res, json };
}

async function queryBookingByName() {
  const url = `${supabaseUrl}/rest/v1/bookings?select=*&guest_name=eq.${encodeURIComponent(guestName)}&order=id.desc&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : [];
  return json[0] || null;
}

async function cleanupBooking(id) {
  if (!id) return;
  const res = await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${id}`, {
    method: 'DELETE',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  log('CLEANUP_STATUS', res.status);
}

(async () => {
  let browser;
  let bookingId = null;
  try {
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

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.body.innerText.includes('載入數據中...'), { timeout: 30000 });
    await page.locator('#tab-bookings').click({ force: true });
    await page.waitForFunction(() => {
      const tabButton = document.getElementById('tab-bookings');
      const content = document.getElementById('content-bookings');
      return !!tabButton && !!content &&
        tabButton.classList.contains('active') &&
        !content.classList.contains('hidden');
    }, { timeout: 20000 });
    await page.waitForSelector('#bookingsTable');
    await page.waitForFunction(() => {
      const el = document.querySelector('#bookingsTable');
      return !!el && !el.innerText.includes('載入中');
    }, { timeout: 20000 });

    const pageText = await page.locator('body').innerText();
    if (pageText.includes('數據格式錯誤')) {
      throw new Error('Dashboard still shows 數據格式錯誤');
    }
    await shot(page, '01_bookings_loaded');

    await page.getByRole('button', { name: /手動登記訂房/ }).click();
    await page.waitForSelector('#manualBookingForm');
    await page.locator('#modal_guest_name').fill(guestName);
    await page.locator('#modal_guest_phone').fill(guestPhone);
    await page.locator('#modal_guest_email').fill('codex-e2e@example.com');
    await page.locator('#modal_checkin_date').fill('2026-03-10');
    await page.locator('#modal_checkout_date').fill('2026-03-11');
    await page.locator('#modal_room_price').fill('3456');
    await page.locator('#modal_payment_status').selectOption('PAID');
    await page.locator('#modal_notes').fill(createNotes);
    await shot(page, '02_manual_booking_modal_filled');
    await page.locator('#manualBookingForm button[type="submit"]').click();
    await page.waitForFunction(() => !document.querySelector('#manualBookingModal'), { timeout: 20000 });
    await page.waitForTimeout(2500);
    await shot(page, '03_after_create');

    await focusBookingsTab(page);
    await page.locator('#searchBooking').click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    await page.locator('#searchBooking').type(guestName, { delay: 30 });
    const bookingsDebug = await page.evaluate((targetGuestName) => {
      const rows = Array.from(document.querySelectorAll('#bookingsTable tr'));
      const table = document.getElementById('bookingsTable');
      const allBookings = Array.isArray(window.allData?.bookings) ? window.allData.bookings : [];
      return {
        searchValue: document.querySelector('#searchBooking')?.value || null,
        rowCount: rows.length,
        tableText: table ? table.innerText.slice(0, 2000) : null,
        tableHtmlSnippet: table ? table.innerHTML.slice(0, 2000) : null,
        containsGuestInTableText: table ? table.innerText.includes(targetGuestName) : false,
        containsGuestInAllData: allBookings.some(b => b && b.guest_name === targetGuestName),
        bookingsCount: allBookings.length,
        bookingNamesSample: allBookings.slice(0, 20).map(b => b?.guest_name).filter(Boolean),
        activeTab: document.querySelector('.tab-button.bg-green-800')?.id || null,
      };
    }, guestName);
    log('BOOKINGS_DEBUG_AFTER_CREATE', JSON.stringify(bookingsDebug));
    const row = page.locator('#bookingsTable tr', { hasText: guestName }).first();
    await row.waitFor({ timeout: 20000 });
    const rowTextAfterCreate = await row.innerText();
    log('ROW_AFTER_CREATE', rowTextAfterCreate);
    if (!rowTextAfterCreate.includes('NT$ 3,456') || !rowTextAfterCreate.includes('待入住')) {
      throw new Error(`Unexpected row after create: ${rowTextAfterCreate}`);
    }

    let booking = await queryBookingByName();
    if (!booking) throw new Error('Booking not found in Supabase after create');
    bookingId = booking.id;
    log('DB_AFTER_CREATE', JSON.stringify({ id: booking.id, room_price: booking.room_price, stay_status: booking.stay_status, notes: booking.notes }));

    await focusBookingsTab(page);
    await row.getByRole('button', { name: /編輯訂單/ }).click();
    await page.waitForSelector('#editBookingForm');
    await page.locator('#edit_room_price').fill('4567');
    await page.locator('#edit_notes').fill(updateNotes);
    await shot(page, '04_edit_modal');
    await page.locator('#editBookingForm button[type="submit"]').click();
    await page.waitForFunction(() => !document.querySelector('#editBookingModal'), { timeout: 20000 });
    await page.waitForTimeout(2500);
    await shot(page, '05_after_edit');

    const rowAfterEdit = page.locator('#bookingsTable tr', { hasText: guestName }).first();
    const rowTextAfterEdit = await rowAfterEdit.innerText();
    log('ROW_AFTER_EDIT', rowTextAfterEdit);
    if (!rowTextAfterEdit.includes('NT$ 4,567')) {
      throw new Error(`Row did not update room price: ${rowTextAfterEdit}`);
    }

    booking = await queryBookingByName();
    if (!booking || booking.room_price !== 4567 || booking.notes !== updateNotes) {
      throw new Error(`Supabase update mismatch: ${JSON.stringify(booking)}`);
    }
    log('DB_AFTER_EDIT', JSON.stringify({ id: booking.id, room_price: booking.room_price, notes: booking.notes, stay_status: booking.stay_status }));

    await focusBookingsTab(page);
    await rowAfterEdit.getByRole('button', { name: /確認入住/ }).click();
    await page.waitForFunction((targetGuestName) => {
      const rows = Array.from(document.querySelectorAll('#bookingsTable tr'));
      const row = rows.find(item => item.innerText.includes(targetGuestName));
      return row && row.innerText.includes('已完成');
    }, guestName, { timeout: 30000 });
    await shot(page, '06_after_confirm');
    const rowAfterConfirm = page.locator('#bookingsTable tr', { hasText: guestName }).first();
    const rowTextAfterConfirm = await rowAfterConfirm.innerText();
    log('ROW_AFTER_CONFIRM', rowTextAfterConfirm);
    if (!rowTextAfterConfirm.includes('已完成')) {
      throw new Error(`Row did not become completed: ${rowTextAfterConfirm}`);
    }

    booking = await queryBookingByName();
    if (!booking || booking.stay_status !== 'COMPLETED' || booking.manually_confirmed_by !== 'system') {
      log('DB_AFTER_CONFIRM_FULL', JSON.stringify(booking));
      throw new Error(`Supabase confirm mismatch`);
    }
    log('DB_AFTER_CONFIRM', JSON.stringify({ id: booking.id, stay_status: booking.stay_status, manually_confirmed_by: booking.manually_confirmed_by }));

    await focusBookingsTab(page);
    await rowAfterConfirm.getByRole('button', { name: /編輯訂單/ }).click();
    await page.waitForSelector('#editBookingForm');
    await shot(page, '07_before_delete');
    await page.getByRole('button', { name: /刪除訂單/ }).click();
    await page.waitForTimeout(2500);
    await shot(page, '08_after_delete');

    await focusBookingsTab(page);
    await page.locator('#searchBooking').click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    await page.locator('#searchBooking').type(guestName, { delay: 30 });
    await page.waitForTimeout(1000);
    const tableTextAfterDelete = await page.locator('#bookingsTable').innerText();
    log('TABLE_AFTER_DELETE', tableTextAfterDelete);
    if (tableTextAfterDelete.includes('✅ 確認入住') || tableTextAfterDelete.includes('⏰ 可確認入住')) {
      throw new Error(`Cancelled booking still shows confirm UI: ${tableTextAfterDelete}`);
    }

    booking = await queryBookingByName();
    if (!booking || booking.stay_status !== 'CANCELLED') {
      throw new Error(`Supabase delete/cancel mismatch: ${JSON.stringify(booking)}`);
    }
    log('DB_AFTER_DELETE', JSON.stringify({ id: booking.id, stay_status: booking.stay_status, commission_status: booking.commission_status }));

    await cleanupBooking(booking.id);
    const postCleanup = await queryBookingByName();
    if (postCleanup) {
      throw new Error(`Cleanup failed: ${JSON.stringify(postCleanup)}`);
    }

    log('E2E_UI_RESULT', 'PASS');
    await page.waitForTimeout(1000);
    await browser.close();
  } catch (error) {
    log('E2E_UI_RESULT', 'FAIL', error && error.stack ? error.stack : String(error));
    try {
      if (bookingId) await cleanupBooking(bookingId);
    } catch (_) {}
    if (browser) await browser.close();
    process.exit(1);
  }
})();
