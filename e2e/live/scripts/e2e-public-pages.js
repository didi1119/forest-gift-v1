const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const siteOrigin = process.env.SITE_ORIGIN || 'https://forest-ambassador.vercel.app';
const invitationUrl = `${siteOrigin}/frontend/invitation.html`;
const termsUrl = `${siteOrigin}/frontend/terms.html`;
const loginUrl = `${siteOrigin}/frontend/partner-login.html`;
const indexUrl = `${siteOrigin}/frontend/index.html`;
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const ts = Date.now();
const screenshotsDir = path.join('/tmp/codex-browser-test', `public-pages-${ts}`);
fs.mkdirSync(screenshotsDir, { recursive: true });

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function ensure(cond, msg) {
  if (!cond) throw new Error(msg);
}

function includes(text, needle, label) {
  if (!String(text).includes(needle)) {
    throw new Error(`${label} missing ${needle}\nActual:\n${text}`);
  }
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

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ executablePath: chromePath, headless: false, args: ['--disable-notifications', '--disable-popup-blocking'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();

    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) log(`BROWSER_${message.type().toUpperCase()}`, message.text());
    });
    page.on('pageerror', error => log('PAGEERROR', error.stack || error.message));
    page.on('requestfailed', request => log('REQUEST_FAILED', request.method(), request.url(), request.failure() ? request.failure().errorText : 'unknown'));

    // ========================================
    // Step 1: invitation.html - page loads, hero section visible
    // ========================================
    log('STEP_1: Navigate to invitation.html');
    await page.goto(invitationUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#hero', { state: 'visible', timeout: 15000 });
    await shot(page, '01_invitation_loaded');
    log('INVITATION_HERO_VISIBLE');

    // Step 2: Verify "已是知音夥伴？登入儀表板" link exists in hero
    log('STEP_2: Verify hero login link');
    const heroText = await page.locator('#hero').innerText();
    includes(heroText, '已是知音夥伴？登入儀表板', 'hero login link');

    // Step 3: Verify "已有帳號？直接登入儀表板" callout above form
    log('STEP_3: Verify callout above form');
    const bodyText = await page.locator('body').innerText();
    includes(bodyText, '已有帳號', 'above-form callout has 已有帳號');
    includes(bodyText, '直接登入儀表板', 'above-form callout has 直接登入儀表板');

    // Step 4: Verify form fields exist
    log('STEP_4: Verify form fields');
    await page.waitForSelector('#partner-form', { state: 'visible', timeout: 10000 });
    const formFields = ['#name', '#email', '#phone', '#line-name', '#referral-source', '#social-profile', '#message'];
    for (const selector of formFields) {
      const exists = await page.locator(selector).isVisible().catch(() => false);
      ensure(exists, `Form field ${selector} should be visible`);
    }
    log('FORM_FIELDS_VERIFIED');
    await shot(page, '02_invitation_form');

    // Step 5: Verify terms link works (opens modal)
    log('STEP_5: Verify terms modal');
    const termsModalTrigger = page.locator('#open-terms-modal');
    if (await termsModalTrigger.isVisible().catch(() => false)) {
      await termsModalTrigger.click();
      await page.waitForFunction(() => {
        const modal = document.getElementById('terms-modal');
        return modal && !modal.classList.contains('hidden');
      }, { timeout: 10000 });
      log('TERMS_MODAL_OPENED');
      await shot(page, '03_terms_modal');

      // Close modal
      const closeBtn = page.locator('#close-terms-modal');
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await page.waitForFunction(() => {
          const modal = document.getElementById('terms-modal');
          return modal && modal.classList.contains('hidden');
        }, { timeout: 5000 });
        log('TERMS_MODAL_CLOSED');
      }
    } else {
      log('TERMS_MODAL_TRIGGER_NOT_VISIBLE, skipping modal test');
    }

    // ========================================
    // Step 6: Navigate to terms.html and verify sections
    // ========================================
    log('STEP_6: Navigate to terms.html');
    await page.goto(termsUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body', { state: 'visible', timeout: 15000 });
    await shot(page, '04_terms_page');

    const termsText = await page.locator('body').innerText();
    const expectedSections = [
      '關於知音計畫',
      '參與資格',
      '合作流程',
      '獎勵計算規則',
      '核心原則',
      '等級制度',
      '結算與發放',
    ];
    for (const section of expectedSections) {
      includes(termsText, section, `terms.html section: ${section}`);
    }
    log('TERMS_SECTIONS_VERIFIED');

    // Verify section order: 關於知音計畫 before 參與資格 before 合作流程 ...
    const sectionPositions = expectedSections.map(s => termsText.indexOf(s));
    for (let i = 1; i < sectionPositions.length; i++) {
      ensure(
        sectionPositions[i] > sectionPositions[i - 1],
        `terms.html section order wrong: "${expectedSections[i]}" (pos ${sectionPositions[i]}) should come after "${expectedSections[i - 1]}" (pos ${sectionPositions[i - 1]})`
      );
    }
    log('TERMS_SECTION_ORDER_VERIFIED');
    await shot(page, '05_terms_sections');

    // ========================================
    // Step 7: Navigate to partner-login.html and verify form loads
    // ========================================
    log('STEP_7: Navigate to partner-login.html');
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#partnerCode', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('#phone', { state: 'visible', timeout: 10000 });
    await shot(page, '06_login_page');
    log('LOGIN_FORM_LOADED');

    // Step 8: Verify "還不是知音夥伴？申請加入" link exists
    log('STEP_8: Verify apply link on login page');
    const loginPageText = await page.locator('body').innerText();
    includes(loginPageText, '還不是知音夥伴', 'login page apply link text');
    includes(loginPageText, '申請加入', 'login page apply link');

    // Step 9: Verify login with wrong credentials shows error
    log('STEP_9: Test invalid login');
    await page.locator('#partnerCode').fill('NONEXISTENT_CODE_XYZ');
    await page.locator('#phone').fill('0000');
    await page.getByRole('button', { name: /登入|驗證中/ }).click();
    await page.waitForFunction(() => {
      const el = document.getElementById('errorMessage');
      return el && !el.classList.contains('hidden');
    }, { timeout: 15000 });
    const errorText = await page.locator('#errorMessage').innerText();
    ensure(errorText.length > 0, `error message should be displayed: ${errorText}`);
    log('INVALID_LOGIN_ERROR', errorText);
    await shot(page, '07_login_error');

    // ========================================
    // Step 10: Navigate to index.html and verify loads
    // ========================================
    log('STEP_10: Navigate to index.html');
    await page.goto(indexUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body', { state: 'visible', timeout: 15000 });
    // Wait for meaningful content to appear
    await page.waitForFunction(() => document.body.innerText.length > 100, { timeout: 15000 });
    await shot(page, '08_index_page');
    log('INDEX_PAGE_LOADED');

    log('E2E_PUBLIC_PAGES_RESULT PASS', JSON.stringify({ screenshotsDir }));
  } catch (error) {
    log('E2E_PUBLIC_PAGES_RESULT FAIL', error.stack || error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
})();
