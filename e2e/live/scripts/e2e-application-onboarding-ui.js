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
const invitationUrl = process.env.INVITATION_URL || `${siteOrigin}/frontend/invitation.html`;
const adminUrl = process.env.ADMIN_URL || `${siteOrigin}/frontend/admin/admin-dashboard-real.html`;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const adminSecret = process.env.ADMIN_SECRET;
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!adminSecret) throw new Error('Missing ADMIN_SECRET');
const hasSupabase = Boolean(supabaseUrl && supabaseKey);

const ts = Date.now();
const suffix = String(ts).slice(-6);
const applicantName = `Onboarding Flow ${suffix}`;
const applicantEmail = `onboarding-${suffix}@example.com`;
const applicantPhone = `0917${suffix}`;
const applicantLine = `line_${suffix}`;
const applicantMessage = `ONBOARDING_MESSAGE_${suffix}`;
const reviewNote = `ONBOARDING_APPROVED_${suffix}`;
const partnerCode = `ob${suffix}`;
const couponUrl = `https://example.com/coupon/onboarding-${suffix}`;
const bankName = '台灣銀行';
const bankCode = '004';
const bankBranch = `信義分行${suffix.slice(-2)}`;
const bankAccountName = `林小森${suffix.slice(-2)}`;
const bankAccountNumber = `123456${suffix}`;
const screenshotsDir = path.join('/tmp/codex-browser-test', `application-onboarding-${ts}`);
fs.mkdirSync(screenshotsDir, { recursive: true });

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function isTruthyFlag(value) {
  return value === true || value === 1 || String(value).toLowerCase() === 'true';
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

async function setOnboardingDraftValues(page, nextPartnerCode, nextCouponUrl) {
  await page.waitForFunction(() => {
    return Boolean(document.getElementById('workflowPartnerCode') && document.getElementById('workflowCouponUrl'));
  }, { timeout: 30000 });

  await page.evaluate(({ partnerCodeValue, couponUrlValue }) => {
    const partnerCodeInput = document.getElementById('workflowPartnerCode');
    const couponUrlInput = document.getElementById('workflowCouponUrl');
    if (!partnerCodeInput || !couponUrlInput) {
      throw new Error('workflow draft inputs not found');
    }

    partnerCodeInput.value = partnerCodeValue;
    partnerCodeInput.dispatchEvent(new Event('input', { bubbles: true }));
    couponUrlInput.value = couponUrlValue;
    couponUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
  }, {
    partnerCodeValue: nextPartnerCode,
    couponUrlValue: nextCouponUrl
  });
}

async function logOnboardingWorkspaceState(page, label) {
  const debug = await page.evaluate(() => {
    const workspace = document.getElementById('onboardingWorkspace');
    const applicationCards = Array.from(document.querySelectorAll('.onboarding-focus-card')).map(card => (card.innerText || '').slice(0, 240));
    return {
      workspaceText: workspace ? (workspace.innerText || '').slice(0, 800) : null,
      hasPartnerCodeInput: Boolean(document.getElementById('workflowPartnerCode')),
      hasCouponUrlInput: Boolean(document.getElementById('workflowCouponUrl')),
      applicationCardCount: applicationCards.length,
      applicationCards
    };
  });
  log(label, JSON.stringify(debug));
}

async function supabaseQuery(table, query) {
  if (!hasSupabase) throw new Error('Supabase env not configured');
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
  if (!hasSupabase) return;
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
  if (!hasSupabase) return;
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
        if (message.includes('核准備註')) {
          await dialog.accept(reviewNote);
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
    page.on('pageerror', error => log('PAGEERROR', error.stack || error.message));
    page.on('requestfailed', request => {
      log('REQUEST_FAILED', request.method(), request.url(), request.failure() ? request.failure().errorText : 'unknown');
    });

    log('E2E_MODE', hasSupabase ? 'FULL' : 'UI_ONLY');

    await page.goto(invitationUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('#name').fill(applicantName);
    await page.locator('#email').fill(applicantEmail);
    await page.locator('#line-name').fill(applicantLine);
    await page.locator('#phone').fill(applicantPhone);
    await page.locator('#referral-source').fill('E2E onboarding flow');
    await page.locator('#social-profile').fill(`https://instagram.com/onboarding_${suffix}`);
    await page.locator('#message').fill(applicantMessage);
    await page.locator('#bank-name').fill(bankName);
    await page.locator('#bank-code').fill(bankCode);
    await page.locator('#bank-branch').fill(bankBranch);
    await page.locator('#bank-account-name').fill(bankAccountName);
    await page.locator('#bank-account-number').fill(bankAccountNumber);
    await page.locator('#terms').check();
    await shot(page, '01_invitation_filled');
    await page.locator('form button[type=submit]').click();
    await page.waitForFunction(() => document.body.innerText.includes('感謝您的加入'), { timeout: 30000 });
    await shot(page, '02_invitation_success');

    if (hasSupabase) {
      const application = await waitFor(async () => {
        const rows = await supabaseQuery(
          'applications',
          `select=id,name,email,phone,line_name,referral_source,social_profile,message,application_status,bank_name,bank_code,bank_branch,bank_account_name,bank_account_number,partner_code_assigned,partner_link_sent&email=eq.${encodeURIComponent(applicantEmail)}&order=id.desc&limit=1`
        );
        return rows[0] || null;
      }, 30000, 1000);
      ensure(application.application_status === 'PENDING', `application should be PENDING: ${JSON.stringify(application)}`);
      ensure(application.bank_name === bankName, `application bank_name mismatch: ${JSON.stringify(application)}`);
      ensure(application.bank_account_number === bankAccountNumber, `application bank_account_number mismatch: ${JSON.stringify(application)}`);
    }

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
    if (await selectButton.isVisible()) {
      await selectButton.click();
    }
    await page.waitForFunction((name) => {
      const workspace = document.getElementById('onboardingWorkspace');
      return workspace && workspace.innerText.includes(name);
    }, applicantName, { timeout: 30000 });
    await shot(page, '03_onboarding_pending');

    await page.locator('#onboardingWorkspace').getByRole('button', { name: /核准/ }).click();
    if (hasSupabase) {
      const approvedApplication = await waitFor(async () => {
        const rows = await supabaseQuery(
          'applications',
          `select=id,application_status,review_notes,partner_code_assigned,partner_link_sent&email=eq.${encodeURIComponent(applicantEmail)}&limit=1`
        );
        const row = rows[0];
        return row && row.application_status === 'APPROVED' ? row : null;
      }, 30000, 1000);
      ensure(approvedApplication.review_notes === reviewNote, `review note mismatch: ${JSON.stringify(approvedApplication)}`);
    } else {
      await page.waitForFunction((note) => {
        const workspace = document.getElementById('onboardingWorkspace');
        return workspace && workspace.innerText.includes('已核准') && workspace.innerText.includes(note);
      }, reviewNote, { timeout: 30000 });
    }

    await logOnboardingWorkspaceState(page, 'WORKSPACE_AFTER_APPROVAL');
    await setOnboardingDraftValues(page, partnerCode, couponUrl);
    await shot(page, '04_onboarding_approved');

    await page.waitForFunction(() => {
      return Boolean(document.querySelector('#onboardingWorkspace button[onclick*="openLinkGeneratorForSelectedApplication"]'));
    }, { timeout: 30000 });
    await page.evaluate(() => {
      const button = document.querySelector('#onboardingWorkspace button[onclick*="openLinkGeneratorForSelectedApplication"]');
      if (!button) throw new Error('找不到帶著預填資料進連結生成器按鈕');
      button.click();
    });
    await page.waitForFunction(() => {
      const tab = document.getElementById('tab-linkgen');
      const content = document.getElementById('content-linkgen');
      return tab && content && tab.classList.contains('active') && !content.classList.contains('hidden');
    }, { timeout: 20000 });

    const frame = page.frameLocator('#linkgenIframe');
    await frame.locator('#partnerName').waitFor({ timeout: 30000 });
    ensure(await frame.locator('#partnerName').inputValue() === applicantName, 'link generator partner name prefill mismatch');
    ensure(await frame.locator('#partnerEmail').inputValue() === applicantEmail, 'link generator partner email prefill mismatch');
    ensure(await frame.locator('#partnerPhone').inputValue() === applicantPhone, 'link generator partner phone prefill mismatch');
    ensure(await frame.locator('#partnerCode').inputValue() === partnerCode, 'link generator partner code prefill mismatch');
    ensure(await frame.locator('#couponUrl').inputValue() === couponUrl, 'link generator coupon url prefill mismatch');
    ensure(await frame.locator('#couponCode').inputValue() === partnerCode, 'coupon code should sync with partner code');
    ensure(await frame.locator('#bankName').inputValue() === bankName, 'link generator bank name prefill mismatch');
    ensure(await frame.locator('#bankCode').inputValue() === bankCode, 'link generator bank code prefill mismatch');
    ensure(await frame.locator('#bankBranch').inputValue() === bankBranch, 'link generator bank branch prefill mismatch');
    ensure(await frame.locator('#bankAccountName').inputValue() === bankAccountName, 'link generator account name prefill mismatch');
    ensure(await frame.locator('#bankAccountNumber').inputValue() === bankAccountNumber, 'link generator account number prefill mismatch');
    const prefillSummary = await frame.locator('#prefillApplicationSummary').innerText();
    ensure(prefillSummary.includes('申請來源：E2E onboarding flow'), `prefill summary missing referral source: ${prefillSummary}`);
    ensure(prefillSummary.includes(`申請留言：${applicantMessage}`), `prefill summary missing message: ${prefillSummary}`);
    ensure(prefillSummary.includes(`帳號：${bankAccountNumber}`), `prefill summary missing bank account: ${prefillSummary}`);
    await shot(page, '05_link_generator_prefill');

    await page.locator('#tab-onboarding').click();
    await page.waitForFunction(() => {
      const tab = document.getElementById('tab-onboarding');
      const content = document.getElementById('content-onboarding');
      return tab && content && tab.classList.contains('active') && !content.classList.contains('hidden');
    }, { timeout: 20000 });
    await waitFor(async () => {
      const cardCount = await page.locator('.onboarding-focus-card', { hasText: applicantEmail }).count();
      if (cardCount > 0) return true;
      const refreshButton = page.getByRole('button', { name: /重新整理工作台/ }).first();
      if (await refreshButton.isVisible().catch(() => false)) {
        await refreshButton.click().catch(() => {});
      }
      return null;
    }, 30000, 1500);

    await logOnboardingWorkspaceState(page, 'WORKSPACE_AFTER_RETURN');
    const returnApplicationCard = page.locator('.onboarding-focus-card', { hasText: applicantEmail }).first();
    if (await returnApplicationCard.count()) {
      const returnSelectButton = returnApplicationCard.getByRole('button', { name: /選取處理|已選取/ }).first();
      if (await returnSelectButton.isVisible().catch(() => false)) {
        await returnSelectButton.click().catch(() => {});
      }
    }

    await setOnboardingDraftValues(page, partnerCode, couponUrl);

    await page.waitForFunction(() => {
      return Boolean(document.querySelector('#onboardingWorkspace button[onclick*="quickPromoteSelectedApplication"]'));
    }, { timeout: 30000 });
    await page.evaluate(() => {
      const button = document.querySelector('#onboardingWorkspace button[onclick*="quickPromoteSelectedApplication"]');
      if (!button) throw new Error('找不到直接建立基本大使按鈕');
      button.click();
    });
    const partner = await waitFor(async () => {
      const rows = await supabaseQuery(
        'partners',
        `select=partner_code,name,partner_name,contact_email,contact_phone,line_coupon_url,coupon_url,landing_link,coupon_link,short_landing_link,short_coupon_link,bank_name,bank_code,bank_branch,bank_account_name,bank_account,commission_preference&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`
      );
      return rows[0] || null;
    }, 45000, 1000);

    ensure((partner.partner_name || partner.name) === applicantName, `partner name mismatch: ${JSON.stringify(partner)}`);
    ensure(partner.contact_email === applicantEmail, `partner email mismatch: ${JSON.stringify(partner)}`);
    ensure(partner.contact_phone === applicantPhone, `partner phone mismatch: ${JSON.stringify(partner)}`);
    ensure(partner.bank_name === bankName, `partner bank_name mismatch: ${JSON.stringify(partner)}`);
    ensure(partner.bank_code === bankCode, `partner bank_code mismatch: ${JSON.stringify(partner)}`);
    ensure(partner.bank_branch === bankBranch, `partner bank_branch mismatch: ${JSON.stringify(partner)}`);
    ensure(partner.bank_account_name === bankAccountName, `partner bank account name mismatch: ${JSON.stringify(partner)}`);
    ensure(partner.bank_account === bankAccountNumber, `partner bank account mismatch: ${JSON.stringify(partner)}`);
    ensure((partner.line_coupon_url || partner.coupon_url) === couponUrl, `partner coupon target mismatch: ${JSON.stringify(partner)}`);
    ensure(Boolean(partner.short_landing_link), `short_landing_link should be populated: ${JSON.stringify(partner)}`);
    ensure(Boolean(partner.short_coupon_link), `short_coupon_link should be populated: ${JSON.stringify(partner)}`);

    const linkedApplication = await waitFor(async () => {
      const rows = await supabaseQuery(
        'applications',
        `select=id,application_status,partner_code_assigned,partner_link_sent&email=eq.${encodeURIComponent(applicantEmail)}&limit=1`
      );
      const row = rows[0];
      return row && row.partner_code_assigned === partnerCode && isTruthyFlag(row.partner_link_sent) ? row : null;
    }, 30000, 1000);
    ensure(linkedApplication.partner_code_assigned === partnerCode, `application partner_code_assigned mismatch: ${JSON.stringify(linkedApplication)}`);

    await page.waitForFunction(() => {
      const textarea = document.getElementById('onboardingPacketMessage');
      return textarea && textarea.value.includes('大使登入頁') && textarea.value.includes('分享工具包');
    }, { timeout: 30000 });

    const packetMessage = await page.locator('#onboardingPacketMessage').inputValue();
    const deliveryLandingUrl = partner.short_landing_link || partner.landing_link;
    const deliveryCouponUrl = partner.short_coupon_link || partner.coupon_link;
    ensure(packetMessage.includes(deliveryLandingUrl), `packet should contain landing/toolkit link: ${packetMessage}`);
    ensure(packetMessage.includes(deliveryCouponUrl), `packet should contain coupon link: ${packetMessage}`);
    await shot(page, '06_onboarding_delivery_packet');

    log('SHORT_LINKS', JSON.stringify({
      landing_link: partner.landing_link,
      short_landing_link: partner.short_landing_link,
      coupon_link: partner.coupon_link,
      short_coupon_link: partner.short_coupon_link
    }));
    log('E2E_APPLICATION_ONBOARDING_RESULT', 'PASS');
  } catch (error) {
    log('E2E_APPLICATION_ONBOARDING_RESULT', 'FAIL', error && error.stack ? error.stack : String(error));
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
