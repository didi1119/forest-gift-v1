const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const siteOrigin = process.env.SITE_ORIGIN || 'https://forest-ambassador.vercel.app';
const invitationUrl = `${siteOrigin}/frontend/invitation.html`;
const adminUrl = `${siteOrigin}/frontend/admin/admin-dashboard-real.html`;
const loginUrl = `${siteOrigin}/frontend/partner-login.html`;
const apiBase = process.env.API_BASE || `${siteOrigin}/api`;
const adminSecret = process.env.ADMIN_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!adminSecret || !supabaseUrl || !supabaseKey) throw new Error('Missing env');

const ts = Date.now();
const suffix = String(ts).slice(-6);
const applicantName = `Public Funnel ${suffix}`;
const applicantEmail = `pf${suffix}@example.com`;
const applicantPhone = `0912${suffix.slice(-6)}`;
const phoneLast4 = applicantPhone.slice(-4);
const partnerCode = `pf${suffix}`;
const couponCode = `gift${suffix}`;
const couponUrl = `https://example.com/coupon/public-funnel-${suffix}`;
const reviewNote = `PF_REVIEW_${suffix}`;
const screenshotsDir = path.join('/tmp/codex-browser-test', `public-funnel-${ts}`);
fs.mkdirSync(screenshotsDir, { recursive: true });

function log(...args) { console.log(new Date().toISOString(), ...args); }
function ensure(cond, msg) { if (!cond) throw new Error(msg); }
function includes(text, needle, label) { if (!String(text).includes(needle)) throw new Error(`${label} missing ${needle}\nActual:\n${text}`); }
async function shot(page, name) {
  const file = path.join(screenshotsDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled', timeout: 10000 });
  log('SCREENSHOT', file);
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
async function setOnboardingDraftValues(page, nextPartnerCode, nextCouponCode, nextCouponUrl) {
  await page.waitForFunction(() => {
    return Boolean(document.getElementById('workflowPartnerCode') && document.getElementById('workflowCouponCode') && document.getElementById('workflowCouponUrl'));
  }, { timeout: 30000 });

  await page.evaluate(({ partnerCodeValue, couponCodeValue, couponUrlValue }) => {
    const partnerCodeInput = document.getElementById('workflowPartnerCode');
    const couponCodeInput = document.getElementById('workflowCouponCode');
    const couponUrlInput = document.getElementById('workflowCouponUrl');
    if (!partnerCodeInput || !couponCodeInput || !couponUrlInput) {
      throw new Error('workflow draft inputs not found');
    }

    partnerCodeInput.value = partnerCodeValue;
    partnerCodeInput.dispatchEvent(new Event('input', { bubbles: true }));
    couponCodeInput.value = couponCodeValue;
    couponCodeInput.dispatchEvent(new Event('input', { bubbles: true }));
    couponUrlInput.value = couponUrlValue;
    couponUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
  }, {
    partnerCodeValue: nextPartnerCode,
    couponCodeValue: nextCouponCode,
    couponUrlValue: nextCouponUrl
  });
}
async function apiAction(action, payload) {
  const params = new URLSearchParams({ action, admin_secret: adminSecret });
  Object.entries(payload || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.append(k, String(v));
  });
  const res = await fetch(apiBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (_) { throw new Error(`API ${action} non-JSON: ${text}`); }
  if (!res.ok || !json.success) throw new Error(`API ${action} failed: ${text}`);
  return json;
}
async function publicJsonAction(action, payload) {
  const res = await fetch(`${apiBase}?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (_) { throw new Error(`API ${action} non-JSON: ${text}`); }
  if (!res.ok || !json.success) throw new Error(`API ${action} failed: ${text}`);
  return json;
}
async function supabaseQuery(table, query) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase query ${table} failed: ${text}`);
  return text ? JSON.parse(text) : [];
}
async function supabaseDeleteBy(table, where) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${where}`, {
    method: 'DELETE',
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  if (!res.ok && res.status !== 204) throw new Error(`Supabase delete ${table} failed: ${await res.text()}`);
}
async function cleanup() {
  await supabaseDeleteBy('accommodation_usage', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDeleteBy('payouts', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDeleteBy('bookings', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDeleteBy('clicks', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDeleteBy('partners', `partner_code=eq.${encodeURIComponent(partnerCode)}`).catch(() => {});
  await supabaseDeleteBy('applications', `email=eq.${encodeURIComponent(applicantEmail)}`).catch(() => {});
  log('CLEANUP_DONE', partnerCode, applicantEmail);
}

(async () => {
  let browser;
  try {
    await cleanup().catch(() => {});

    browser = await chromium.launch({ executablePath: chromePath, headless: false, args: ['--disable-notifications', '--disable-popup-blocking'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    let lastDialogMessage = '';
    const dialogMessages = [];

    page.on('dialog', async dialog => {
      lastDialogMessage = dialog.message();
      dialogMessages.push(dialog.message());
      log('DIALOG', dialog.type(), dialog.message());
      if (dialog.type() === 'prompt') {
        const message = dialog.message() || '';
        if (message.includes('管理密碼') || message.includes('admin_secret')) {
          await dialog.accept(adminSecret);
        } else if (message.includes('核准備註')) {
          await dialog.accept(reviewNote);
        } else if (message.includes('拒絕原因')) {
          await dialog.accept(`AUTO_REJECT_${suffix}`);
        } else {
          await dialog.accept('');
        }
      } else {
        await dialog.accept();
      }
    });
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) log(`BROWSER_${message.type().toUpperCase()}`, message.text());
    });
    page.on('pageerror', error => log('PAGEERROR', error.stack || error.message));
    page.on('requestfailed', request => log('REQUEST_FAILED', request.method(), request.url(), request.failure() ? request.failure().errorText : 'unknown'));

    // Invitation submit
    await page.goto(invitationUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('#name').fill(applicantName);
    await page.locator('#email').fill(applicantEmail);
    await page.locator('#line-name').fill(`line_${suffix}`);
    await page.locator('#phone').fill(applicantPhone);
    await page.locator('#referral-source').fill('E2E public funnel');
    await page.locator('#social-profile').fill(`https://example.com/pf/${suffix}`);
    await page.locator('#message').fill(`PF_MESSAGE_${suffix}`);
    await page.locator('#terms').check();
    await shot(page, '01_invitation_filled');
    await page.locator('form button[type=submit]').click();
    await page.waitForFunction(() => document.body.innerText.includes('感謝您的加入'), { timeout: 30000 });
    await shot(page, '02_invitation_success');

    const application = await waitFor(async () => {
      const rows = await supabaseQuery('applications', `select=id,name,email,application_status,partner_code_assigned,partner_link_sent&email=eq.${encodeURIComponent(applicantEmail)}&order=id.desc&limit=1`);
      return rows[0] ? rows[0] : null;
    });
    ensure(application.application_status === 'PENDING', `application should be PENDING: ${JSON.stringify(application)}`);

    // Onboarding approve + promote
    await page.goto(adminUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.body.innerText.includes('載入數據中...'), { timeout: 30000 });
    await waitFor(async () => {
      await page.getByRole('button', { name: /重新整理工作台/ }).click();
      const bodyText = await page.locator('body').innerText();
      return bodyText.includes(applicantEmail) ? true : null;
    }, 30000, 1500);

    const applicationCard = page.locator('.onboarding-focus-card', { hasText: applicantEmail }).first();
    await applicationCard.waitFor({ timeout: 30000 });
    const selectButton = applicationCard.getByRole('button', { name: /選取處理|已選取/ }).first();
    if (await selectButton.isVisible().catch(() => false)) {
      await selectButton.click();
    }
    await page.waitForFunction((name) => {
      const workspace = document.getElementById('onboardingWorkspace');
      return workspace && workspace.innerText.includes(name);
    }, applicantName, { timeout: 30000 });
    await shot(page, '03_onboarding_pending');

    await page.locator('#onboardingWorkspace').getByRole('button', { name: /核准/ }).click();
    await waitFor(async () => {
      const rows = await supabaseQuery('applications', `select=id,application_status,review_notes,reviewed_by,partner_link_sent&email=eq.${encodeURIComponent(applicantEmail)}&limit=1`);
      return rows[0] && rows[0].application_status === 'APPROVED' ? rows[0] : null;
    });

    const approvedApp = (await supabaseQuery('applications', `select=id,application_status,review_notes,reviewed_by,partner_link_sent&email=eq.${encodeURIComponent(applicantEmail)}&limit=1`))[0];
    ensure(approvedApp.review_notes === reviewNote, `review note mismatch: ${JSON.stringify(approvedApp)}`);
    await setOnboardingDraftValues(page, partnerCode, couponCode, couponUrl);
    await shot(page, '04_onboarding_approved');

    await page.waitForFunction(() => {
      return Boolean(document.querySelector('#onboardingWorkspace button[onclick*="quickPromoteSelectedApplication"]'));
    }, { timeout: 30000 });
    await page.evaluate(() => {
      const button = document.querySelector('#onboardingWorkspace button[onclick*="quickPromoteSelectedApplication"]');
      if (!button) throw new Error('找不到直接建立基本大使按鈕');
      button.click();
    });
    await waitFor(async () => {
      const rows = await supabaseQuery('partners', `select=partner_code,partner_name,name,contact_phone,contact_email,commission_preference,landing_link,coupon_link,total_clicks,yearly_referrals,partner_level&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`);
      return rows[0] ? rows[0] : null;
    });
    await shot(page, '05_onboarding_promoted');

    const partner = (await supabaseQuery('partners', `select=partner_code,name,contact_phone,contact_email,commission_preference,landing_link,coupon_link,short_landing_link,short_coupon_link,coupon_code,total_clicks,yearly_referrals,partner_level,available_points,total_commission_earned&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`))[0];
    ensure(partner.commission_preference === 'ACCOMMODATION', `partner preference mismatch: ${JSON.stringify(partner)}`);
    ensure(String(partner.contact_phone || '').endsWith(phoneLast4), `partner phone mismatch: ${JSON.stringify(partner)}`);
    ensure(partner.coupon_code === couponCode, `partner coupon code mismatch: ${JSON.stringify(partner)}`);

    // Seed one completed booking for partner dashboard display
    const createBooking = await apiAction('create_booking', {
      partner_code: partnerCode,
      guest_name: `PF_GUEST_${suffix}`,
      guest_phone: '0911999000',
      guest_email: `pfguest${suffix}@example.com`,
      bank_account_last5: '67890',
      checkin_date: '2026-03-15',
      checkout_date: '2026-03-16',
      room_price: '5000',
      booking_source: 'REFERRAL',
      stay_status: 'CHECKED_IN',
      payment_status: 'PAID',
      notes: `PF_BOOKING_${suffix}`
    });
    const bookingId = createBooking.booking_id || (createBooking.data && createBooking.data.id);
    await apiAction('confirm_checkin_completion', { booking_id: bookingId, confirmed_by: 'PF_UI' });

    // Trigger click tracking on both links
    const landingResponse = await fetch(`${apiBase}?dest=landing&pid=${encodeURIComponent(partnerCode)}`, { redirect: 'manual' });
    const couponResponse = await fetch(`${apiBase}?dest=coupon&pid=${encodeURIComponent(partnerCode)}`, { redirect: 'manual' });
    ensure([200,301,302,303,307,308].includes(landingResponse.status), `landing redirect failed: ${landingResponse.status}`);
    ensure([200,301,302,303,307,308].includes(couponResponse.status), `coupon redirect failed: ${couponResponse.status}`);

    const clickStats = await waitFor(async () => {
      const rows = await supabaseQuery('partners', `select=partner_code,yearly_referrals,successful_referrals,total_successful_referrals,available_points,total_commission_earned&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`);
      const row = rows[0];
      const completedReferrals = Number(row?.successful_referrals ?? row?.total_successful_referrals ?? 0);
      return row && (completedReferrals === 1 || Number(row.yearly_referrals) === 1) ? row : null;
    }, 30000, 1000);
    ensure(Number(clickStats.available_points) === 2500, `partner points mismatch: ${JSON.stringify(clickStats)}`);
    const apiClickStats = await waitFor(async () => {
      const result = await apiAction('get_click_stats', { partner_code: partnerCode });
      return Number(result?.data?.total_clicks) >= 2 ? result : null;
    }, 30000, 1000);
    ensure(Number(apiClickStats.data.total_clicks) >= 2, `api click stats mismatch: ${JSON.stringify(apiClickStats)}`);

    // Partner login invalid then valid
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('#partnerCode').fill(partnerCode);
    await page.locator('#phone').fill('0000');
    await page.getByRole('button', { name: /登入|載入中/ }).click();
    await page.waitForFunction(() => document.getElementById('errorMessage') && !document.getElementById('errorMessage').classList.contains('hidden'), { timeout: 10000 });
    const invalidText = await page.locator('#errorMessage').innerText();
    includes(invalidText, '不正確', 'invalid login error');
    await shot(page, '06_partner_login_invalid');

    await page.locator('#phone').fill(phoneLast4);
    await page.getByRole('button', { name: /登入|載入中/ }).click();
    await page.waitForURL(/partner-dashboard\.html/, { timeout: 30000 });
    await shot(page, '07_partner_dashboard_initial');
    log('PARTNER_DASHBOARD_BODY', (await page.locator('body').innerText()).slice(0, 2000));
    await page.waitForFunction(() => {
      const totalReferrals = document.getElementById('totalReferrals')?.textContent?.trim();
      const totalCommission = document.getElementById('totalCommission')?.textContent?.trim();
      const totalClicks = document.getElementById('totalClicks')?.textContent?.trim();
      return totalReferrals && totalReferrals !== '-' &&
        totalCommission && totalCommission !== '-' &&
        totalClicks && totalClicks !== '-';
    }, { timeout: 30000 });
    await shot(page, '08_partner_dashboard_loaded');

    const overviewText = await page.locator('#tab-overview').innerText();
    includes(overviewText, '$2,500', 'partner dashboard total commission');
    includes(overviewText, '$2,500', 'partner dashboard available points');
    includes(overviewText, '1 / 4', 'partner dashboard level progress');
    ensure((await page.locator('#partnerCode').innerText()).includes(partnerCode), 'partner dashboard code mismatch');
    ensure((await page.locator('#partnerLevel').innerText()).includes('LV1 知音大使'), 'partner dashboard level mismatch');
    await shot(page, '09_partner_dashboard_overview');

    await page.evaluate(() => switchTab('tab-referral', document.querySelectorAll('.nav-tab')[1]));
    await page.waitForFunction(() => document.getElementById('tab-referral')?.classList.contains('active'), { timeout: 10000 });
    const referralText = await page.locator('#tab-referral').innerText();
    includes(referralText, '連結點擊 2', 'partner dashboard clicks');
    includes(referralText, '轉換率 50.0%', 'partner dashboard conversion rate');
    await page.waitForFunction(() => {
      const referral = document.getElementById('referralLink')?.value || '';
      const coupon = document.getElementById('couponLink')?.value || '';
      return referral && coupon && referral !== '短連結生成中...' && coupon !== '短連結生成中...';
    }, { timeout: 30000 });
    const referralLink = await page.locator('#referralLink').inputValue();
    const couponLink = await page.locator('#couponLink').inputValue();
    const overviewCode = await page.locator('#overviewPartnerCode').innerText();
    includes(overviewCode, partnerCode, 'partner dashboard referral code');
    ensure(referralLink && referralLink.length > 10, `missing referral link: ${referralLink}`);
    ensure(couponLink && couponLink.length > 10, `missing coupon link: ${couponLink}`);
    await shot(page, '10_partner_dashboard_referral');

    await page.evaluate(() => switchTab('tab-records', document.querySelectorAll('.nav-tab')[2]));
    await page.waitForFunction(() => document.getElementById('tab-records')?.classList.contains('active'), { timeout: 10000 });
    const recordsText = await page.locator('#tab-records').innerText();
    includes(recordsText, 'P**', 'partner dashboard masked booking name');
    includes(recordsText, '2026/3/15 - 2026/3/16', 'partner dashboard booking dates');
    includes(recordsText, '已完成', 'partner dashboard booking status');
    includes(recordsText, '$2,500', 'partner dashboard booking price');
    includes(recordsText, '住宿金佣金', 'partner dashboard payout history');
    await shot(page, '11_partner_dashboard_records');

    await cleanup();
    log('E2E_PUBLIC_FUNNEL_RESULT PASS', JSON.stringify({ screenshotsDir }));
  } catch (error) {
    log('E2E_PUBLIC_FUNNEL_RESULT FAIL', error.stack || error.message);
    await cleanup().catch(() => {});
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
})();
