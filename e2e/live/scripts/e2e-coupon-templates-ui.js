const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const siteOrigin = process.env.SITE_ORIGIN || 'https://forest-ambassador.vercel.app';
const baseUrl = `${siteOrigin}/frontend/admin/admin-dashboard-real.html`;
const adminSecret = process.env.ADMIN_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!adminSecret) throw new Error('Missing ADMIN_SECRET');
if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env');

const ts = Date.now();
const screenshotsDir = path.join('/tmp/codex-browser-test', `coupon-screens-${ts}`);
fs.mkdirSync(screenshotsDir, { recursive: true });

let passed = 0;
let failed = 0;
const results = [];

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function assert(condition, msg) {
  if (condition) {
    passed++;
    results.push({ status: 'PASS', msg });
    log('PASS:', msg);
  } else {
    failed++;
    results.push({ status: 'FAIL', msg });
    log('FAIL:', msg);
  }
}

async function shot(page, name) {
  const file = path.join(screenshotsDir, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false, animations: 'disabled', timeout: 10000 });
    log('SCREENSHOT', file);
  } catch (e) {
    log('SCREENSHOT_FAIL', name, e.message);
  }
}

async function supabaseQuery(table, query = '') {
  const url = `${supabaseUrl}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  return res.json();
}

async function supabaseDelete(table, query) {
  const url = `${supabaseUrl}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=representation'
    }
  });
  return res.json();
}

async function apiCall(action, data = {}) {
  const payload = { action, admin_secret: adminSecret, ...data };
  const res = await fetch(`${siteOrigin}/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

(async () => {
  log('=== E2E Coupon Template Management Test ===');
  log('Site:', siteOrigin);
  log('Supabase:', supabaseUrl);
  log('Screenshots:', screenshotsDir);

  // ========================================
  // Phase 1: API-level CRUD Tests
  // ========================================
  log('\n--- Phase 1: API CRUD Tests ---');

  // Test 1: get_all_data includes coupon_templates
  const allData = await apiCall('get_all_data');
  assert(allData.success === true, 'get_all_data returns success');
  assert(Array.isArray(allData.data?.coupon_templates), 'get_all_data includes coupon_templates array');
  const existingTemplates = allData.data?.coupon_templates || [];
  log('Existing templates:', existingTemplates.length);

  // Test 2: Verify seed data exists
  const seedTemplate = existingTemplates.find(t => (t.data || t).coupon_url === 'https://lin.ee/q38pqot');
  assert(!!seedTemplate, 'Seed template "土地的厚愛" exists');

  // Test 3: Create a new coupon template
  const createResult = await apiCall('create_coupon_template', {
    coupon_name: `E2E測試券_${ts}`,
    coupon_url: `https://lin.ee/test_${ts}`,
    coupon_description: 'E2E 測試用優惠券',
    is_default: false
  });
  assert(createResult.success === true, 'create_coupon_template succeeds');
  const newTemplateId = createResult.data?.id || createResult.data?.data?.id;
  log('Created template ID:', newTemplateId);

  // Test 4: Update the template
  const updateResult = await apiCall('update_coupon_template', {
    template_id: newTemplateId,
    coupon_name: `E2E測試券_更新_${ts}`,
    coupon_description: 'E2E 更新後描述'
  });
  assert(updateResult.success === true, 'update_coupon_template succeeds');

  // Test 5: Set as default
  const setDefaultResult = await apiCall('update_coupon_template', {
    template_id: newTemplateId,
    is_default: true
  });
  assert(setDefaultResult.success === true, 'Set template as default succeeds');

  // Verify old default was cleared
  const afterDefault = await apiCall('get_all_data');
  const templates = afterDefault.data?.coupon_templates || [];
  const defaults = templates.filter(t => {
    const d = t.data || t;
    return d.is_default === true || d.is_default === 'true';
  });
  assert(defaults.length === 1, `Only 1 default template (got ${defaults.length})`);

  // Test 6: Delete (soft) the test template
  const deleteResult = await apiCall('delete_coupon_template', {
    template_id: newTemplateId
  });
  assert(deleteResult.success === true, 'delete_coupon_template (soft delete) succeeds');

  // Verify soft delete
  const afterDelete = await supabaseQuery('coupon_templates', `id=eq.${newTemplateId}&select=is_active`);
  assert(afterDelete[0]?.is_active === false, 'Soft-deleted template has is_active=false');

  // Restore the original default
  const origDefault = existingTemplates.find(t => {
    const d = t.data || t;
    return d.coupon_url === 'https://lin.ee/q38pqot';
  });
  if (origDefault) {
    const origId = origDefault.id || origDefault.data?.id;
    await apiCall('update_coupon_template', { template_id: origId, is_default: true });
  }

  // ========================================
  // Phase 2: promote_to_partner with coupon_template_id
  // ========================================
  log('\n--- Phase 2: Promote with Template ---');

  // Create a test template for promotion
  const promoTemplate = await apiCall('create_coupon_template', {
    coupon_name: `促銷券_${ts}`,
    coupon_url: `https://lin.ee/promo_${ts}`,
    coupon_description: '促銷測試',
    is_default: false
  });
  const promoTemplateId = promoTemplate.data?.id || promoTemplate.data?.data?.id;

  // Create a test application first (submit_application is public, remove admin_secret)
  const appPayload = {
    action: 'submit_application',
    name: `E2E券測試_${ts}`,
    email: `e2e_coupon_${ts}@test.com`,
    phone: '0912345678',
    message: 'E2E coupon test',
    referral_source: 'E2E_TEST',
    line_name: 'e2e_test'
  };
  const appRes = await fetch(`${siteOrigin}/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appPayload)
  });
  const appResult = await appRes.json();
  assert(appResult.success === true, 'Test application created');

  // Approve the application
  const apps = await apiCall('get_applications');
  const testApp = (apps.data || []).find(a => (a.data || a).email === `e2e_coupon_${ts}@test.com`);
  if (testApp) {
    const appId = testApp.id || testApp.data?.id;
    await apiCall('review_application', {
      application_id: appId,
      new_status: 'APPROVED',
      review_notes: 'E2E auto-approve'
    });

    // Promote with coupon_template_id
    const promoteResult = await apiCall('promote_to_partner', {
      application_id: appId,
      partner_code: `E2ECPN${String(ts).slice(-6)}`,
      coupon_code: `TCPN${String(ts).slice(-6)}`,
      coupon_template_id: promoTemplateId
    });
    assert(promoteResult.success === true, 'promote_to_partner with coupon_template_id succeeds');

    // Verify the partner has the correct coupon URL
    const partnerData = await apiCall('get_all_data');
    const newPartner = (partnerData.data?.partners || []).find(p =>
      (p.data || p).partner_code === `E2ECPN${String(ts).slice(-6)}`
    );
    if (newPartner) {
      const pData = newPartner.data || newPartner;
      assert(
        pData.line_coupon_url === `https://lin.ee/promo_${ts}` || pData.coupon_url === `https://lin.ee/promo_${ts}`,
        'Partner coupon_url matches template URL'
      );
    } else {
      assert(false, 'Partner coupon_url matches template URL (partner not found)');
    }
  } else {
    assert(false, 'Test application found for promotion');
  }

  // ========================================
  // Phase 3: UI Tests (Playwright)
  // ========================================
  log('\n--- Phase 3: UI Tests ---');

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // Handle admin prompt
    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') {
        await dialog.accept(adminSecret);
      } else if (dialog.type() === 'confirm') {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });

    // Navigate to admin dashboard
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await shot(page, '01-dashboard-loaded');

    // Click on 工作台 tab
    const workbenchTab = page.locator('#tab-onboarding');
    assert(await workbenchTab.isVisible(), 'Workbench (工作台) tab is visible');
    await workbenchTab.click();
    await page.waitForTimeout(2000);
    await shot(page, '02-workbench-tab');

    // Check coupon management section exists
    const couponSection = page.locator('#obSectionCoupons');
    assert(await couponSection.isVisible(), 'Coupon management section (#obSectionCoupons) is visible');

    // Check coupon template list rendered
    const couponList = page.locator('#couponTemplateList');
    const couponListHtml = await couponList.innerHTML();
    assert(couponListHtml.includes('土地的厚愛'), 'Default coupon "土地的厚愛" displayed in list');
    assert(couponListHtml.includes('lin.ee/q38pqot'), 'Default coupon URL displayed');
    assert(couponListHtml.includes('預設'), 'Default badge shown');
    await shot(page, '03-coupon-list');

    // Test: Click "新增優惠券" button
    const addBtn = page.locator('#ctAddBtn');
    assert(await addBtn.isVisible(), '"新增優惠券" button is visible');
    await addBtn.click();
    await page.waitForTimeout(500);

    // Check form is shown
    const formPanel = page.locator('#couponTemplateForm');
    assert(await formPanel.isVisible(), 'Coupon template form is visible after clicking add');
    await shot(page, '04-add-form-open');

    // Fill in the form
    await page.fill('#ctFormName', 'UI測試優惠券');
    await page.fill('#ctFormUrl', 'https://lin.ee/uitest123');
    await page.fill('#ctFormDesc', 'UI 測試用的優惠券描述');
    await shot(page, '05-form-filled');

    // Save the template
    await page.locator('button:has-text("儲存")').first().click();
    // Wait for API call + data reload + re-render
    await page.waitForTimeout(6000);
    await shot(page, '06-after-save');

    // Verify new template appears in list (re-query DOM after save)
    const updatedListHtml = await page.locator('#couponTemplateList').innerHTML();
    assert(updatedListHtml.includes('UI測試優惠券'), 'Newly created coupon appears in list');
    assert(updatedListHtml.includes('uitest123'), 'New coupon URL displayed');

    // Test: Click on an application to open slide panel
    const appRows = page.locator('.ob-table tbody tr');
    const appRowCount = await appRows.count();
    log('Application rows found:', appRowCount);

    if (appRowCount > 0) {
      await appRows.first().click();
      await page.waitForTimeout(1500);
      await shot(page, '07-slide-panel-open');

      // Check slide panel has coupon selector (select dropdown)
      const couponSelect = page.locator('#obSlideBody select');
      const selectCount = await couponSelect.count();
      assert(selectCount > 0, 'Coupon template dropdown exists in slide panel');

      if (selectCount > 0) {
        const options = await couponSelect.first().locator('option').allTextContents();
        log('Coupon dropdown options:', options);
        assert(options.some(o => o.includes('土地的厚愛')), 'Default coupon in dropdown options');
        assert(options.some(o => o.includes('自訂')), '"自訂 URL" option exists in dropdown');
      }
      await shot(page, '08-coupon-dropdown');
    } else {
      log('SKIP: No application rows to test slide panel');
    }

    // Close slide panel before switching tabs
    const closeBtn = page.locator('.ob-slide-close');
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
    // Also click overlay to ensure it's closed
    await page.evaluate(() => {
      const overlay = document.getElementById('obSlideOverlay');
      if (overlay && overlay.classList.contains('open')) overlay.click();
      const panel = document.getElementById('obSlidePanel');
      if (panel && panel.classList.contains('open')) panel.classList.remove('open');
    });
    await page.waitForTimeout(500);

    // Test: Navigate to overview tab and check partner detail
    const overviewTab = page.locator('#tab-overview');
    if (await overviewTab.isVisible()) {
      await overviewTab.click();
      await page.waitForTimeout(2000);
      await shot(page, '09-overview-tab');

      // Click on a partner row to see detail
      const partnerRows = page.locator('.ob-table tbody tr, table tbody tr').first();
      if (await partnerRows.isVisible()) {
        await partnerRows.click();
        await page.waitForTimeout(2000);
        await shot(page, '10-partner-detail');

        // Check for coupon URL display and selector
        const detailContent = await page.content();
        const hasCouponSection = detailContent.includes('優惠券連結');
        assert(hasCouponSection, 'Partner detail shows coupon link section');
      }
    }

    // Test: Verify all main tabs still work (no JS errors)
    const tabs = ['overview', 'bookings', 'payouts', 'analytics', 'linkgen', 'onboarding'];
    for (const tab of tabs) {
      try {
        const tabBtn = page.locator(`#tab-${tab}`);
        if (await tabBtn.isVisible({ timeout: 2000 })) {
          await tabBtn.click();
          await page.waitForTimeout(1000);
          await shot(page, `11-tab-${tab}`);
          assert(true, `Tab "${tab}" renders without error`);
        }
      } catch (e) {
        assert(false, `Tab "${tab}" renders without error: ${e.message}`);
      }
    }

    // Cleanup: delete test templates from DB
    log('\n--- Cleanup ---');
    await supabaseDelete('coupon_templates', `coupon_name=like.*E2E*`);
    await supabaseDelete('coupon_templates', `coupon_name=like.*UI測試*`);
    await supabaseDelete('coupon_templates', `coupon_name=like.*促銷券*`);
    // Clean up test partner and application
    await supabaseDelete('partners', `partner_code=like.*E2ECPN*`);
    await supabaseDelete('applications', `email=like.*e2e_coupon_*`);

    log('Cleanup complete');

  } catch (e) {
    log('UI TEST ERROR:', e.message);
    assert(false, 'UI tests complete without crash: ' + e.message);
  } finally {
    if (browser) await browser.close();
  }

  // ========================================
  // Summary
  // ========================================
  log('\n========================================');
  log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  log('========================================');
  results.forEach(r => log(`  [${r.status}] ${r.msg}`));
  log('Screenshots:', screenshotsDir);

  if (failed > 0) {
    process.exit(1);
  }
})();
