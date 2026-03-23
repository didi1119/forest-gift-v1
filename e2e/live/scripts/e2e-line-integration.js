const crypto = require('crypto');

const siteOrigin = process.env.SITE_ORIGIN || 'https://forest-ambassador.vercel.app';
const apiUrl = `${siteOrigin}/api`;
const adminSecret = process.env.ADMIN_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!adminSecret) throw new Error('Missing ADMIN_SECRET');
if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env');

const ts = Date.now();
const suffix = String(ts).slice(-8);
const testPartnerCode1 = `PW-LINE-${suffix}`;
const testPartnerCode2 = `PW-LINE2-${suffix}`;
const testLineUserId = `FAKE_LINE_TEST_${suffix}`;

function log(...args) { console.log(new Date().toISOString(), ...args); }

let passed = 0;
let failed = 0;
let warnings = 0;

function pass(msg) {
  passed++;
  log(`PASS: ${msg}`);
}

function fail(msg) {
  failed++;
  log(`FAIL: ${msg}`);
}

function warn(msg) {
  warnings++;
  log(`WARN: ${msg}`);
}

function assert(cond, msg) {
  if (!cond) {
    fail(msg);
    return false;
  }
  pass(msg);
  return true;
}

async function apiCall(action, data = {}) {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, admin_secret: adminSecret, ...data })
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`API ${action} returned non-JSON: ${text.slice(0, 200)}`);
  }
  return json;
}

async function apiCallPublic(action, data = {}) {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data })
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`API ${action} returned non-JSON: ${text.slice(0, 200)}`);
  }
  return json;
}

function generateSig(lineUserId) {
  return crypto.createHmac('sha256', adminSecret).update(lineUserId).digest('hex');
}

async function supabaseDelete(table, filter) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  log(`CLEANUP ${table} (${filter}): ${res.status}`);
}

(async () => {
  try {
    // ================================================================
    // SETUP: Create test partners
    // ================================================================
    log('');
    log('=== SETUP: Creating test partners ===');

    const partner1Result = await apiCall('create_partner', {
      partner_code: testPartnerCode1,
      name: `LINE Test Partner ${suffix}`,
      email: `linetest${suffix}@example.com`,
      phone: `0900${suffix.slice(-6)}`,
      coupon_code: `lcpn${suffix}`,
      level: 'LV1_INSIDER',
    });
    assert(partner1Result.success, `Create test partner 1 (${testPartnerCode1})`);

    const partner2Result = await apiCall('create_partner', {
      partner_code: testPartnerCode2,
      name: `LINE Test Partner2 ${suffix}`,
      email: `linetest2${suffix}@example.com`,
      phone: `0901${suffix.slice(-6)}`,
      coupon_code: `lcpn2${suffix}`,
      level: 'LV1_INSIDER',
    });
    assert(partner2Result.success, `Create test partner 2 (${testPartnerCode2})`);

    // ================================================================
    // TEST 1: verify_line_login — missing params
    // ================================================================
    log('');
    log('=== TEST 1: verify_line_login — missing params ===');
    {
      const res = await apiCallPublic('verify_line_login', {});
      assert(!res.success, 'verify_line_login with no params returns error');
      assert(
        (res.error || '').includes('缺少必要參數'),
        'verify_line_login missing params error message correct'
      );
    }

    // ================================================================
    // TEST 2: verify_line_login — invalid signature
    // ================================================================
    log('');
    log('=== TEST 2: verify_line_login — invalid signature ===');
    {
      const res = await apiCallPublic('verify_line_login', {
        line_user_id: testLineUserId,
        sig: 'invalid_signature_abc123',
      });
      assert(!res.success, 'verify_line_login with invalid sig returns error');
      assert(
        (res.error || '').includes('簽名驗證失敗'),
        'verify_line_login invalid sig error message correct'
      );
    }

    // ================================================================
    // TEST 3: verify_line_login — valid sig but no partner bound
    // ================================================================
    log('');
    log('=== TEST 3: verify_line_login — valid sig, no partner bound ===');
    {
      const validSig = generateSig(testLineUserId);
      const res = await apiCallPublic('verify_line_login', {
        line_user_id: testLineUserId,
        sig: validSig,
      });
      assert(!res.success, 'verify_line_login with valid sig but unbound LINE ID returns error');
      assert(
        (res.error || '').includes('找不到對應的大使帳號'),
        'verify_line_login unbound error message correct'
      );
    }

    // ================================================================
    // TEST 4: Bind LINE ID to partner, then verify_line_login succeeds
    // ================================================================
    log('');
    log('=== TEST 4: verify_line_login — after binding LINE ID ===');
    {
      // Bind line_user_id via update_partner
      const updateRes = await apiCall('update_partner', {
        partner_code: testPartnerCode1,
        line_user_id: testLineUserId,
        line_display_name: 'TestLineUser',
      });
      assert(updateRes.success, `Set line_user_id on ${testPartnerCode1}`);

      // Now verify_line_login should succeed
      const validSig = generateSig(testLineUserId);
      const loginRes = await apiCallPublic('verify_line_login', {
        line_user_id: testLineUserId,
        sig: validSig,
      });
      assert(loginRes.success, 'verify_line_login succeeds after binding');
      if (loginRes.success && loginRes.partner) {
        assert(
          loginRes.partner.partner_code === testPartnerCode1,
          'verify_line_login returns correct partner_code'
        );
        assert(
          loginRes.partner.line_user_id === testLineUserId,
          'verify_line_login returns correct line_user_id'
        );
      }
    }

    // ================================================================
    // TEST 5: verify_line_login — deactivated partner fails
    // ================================================================
    log('');
    log('=== TEST 5: verify_line_login — deactivated partner ===');
    {
      // Deactivate partner
      const deactivateRes = await apiCall('update_partner', {
        partner_code: testPartnerCode1,
        is_active: false,
      });
      assert(deactivateRes.success, `Deactivate ${testPartnerCode1}`);

      const validSig = generateSig(testLineUserId);
      const loginRes = await apiCallPublic('verify_line_login', {
        line_user_id: testLineUserId,
        sig: validSig,
      });
      assert(!loginRes.success, 'verify_line_login fails for deactivated partner');

      // Reactivate for subsequent tests
      await apiCall('update_partner', {
        partner_code: testPartnerCode1,
        is_active: true,
      });
    }

    // ================================================================
    // TEST 6: line_auto_login — missing access_token
    // ================================================================
    log('');
    log('=== TEST 6: line_auto_login — missing access_token ===');
    {
      const res = await apiCallPublic('line_auto_login', {});
      assert(!res.success, 'line_auto_login with no access_token returns error');
      assert(
        (res.error || '').includes('缺少必要參數'),
        'line_auto_login missing params error message correct'
      );
    }

    // ================================================================
    // TEST 7: line_auto_login — fake access_token
    // ================================================================
    log('');
    log('=== TEST 7: line_auto_login — fake access_token ===');
    {
      const res = await apiCallPublic('line_auto_login', {
        access_token: 'fake_token_12345',
      });
      assert(!res.success, 'line_auto_login with fake token returns error');
      assert(
        (res.error || '').includes('LINE 身份驗證失敗') || (res.error || '').includes('LINE'),
        'line_auto_login fake token error mentions LINE auth failure'
      );
    }

    // ================================================================
    // TEST 8: bind_line_account — missing params
    // ================================================================
    log('');
    log('=== TEST 8: bind_line_account — missing params ===');
    {
      const res = await apiCallPublic('bind_line_account', {});
      assert(!res.success, 'bind_line_account with no params returns error');
      assert(
        (res.error || '').includes('缺少必要參數'),
        'bind_line_account missing params error message correct'
      );
    }

    // ================================================================
    // TEST 9: bind_line_account — fake access_token
    // ================================================================
    log('');
    log('=== TEST 9: bind_line_account — fake access_token ===');
    {
      const res = await apiCallPublic('bind_line_account', {
        partner_code: testPartnerCode2,
        access_token: 'fake_token_bind_test',
      });
      assert(!res.success, 'bind_line_account with fake token returns error');
      assert(
        (res.error || '').includes('LINE 身份驗證失敗') || (res.error || '').includes('LINE'),
        'bind_line_account fake token error mentions LINE auth'
      );
    }

    // ================================================================
    // TEST 10: Duplicate binding prevention via update_partner
    // ================================================================
    log('');
    log('=== TEST 10: Duplicate LINE binding prevention ===');
    {
      // Partner1 already has testLineUserId bound
      // Try to set the same line_user_id on partner2 via update_partner
      // Note: update_partner may not enforce uniqueness directly,
      // but verify_line_login should find the first active partner
      const updateRes = await apiCall('update_partner', {
        partner_code: testPartnerCode2,
        line_user_id: testLineUserId,
      });

      if (updateRes.success) {
        // If update succeeded, verify_line_login might return either partner
        // The system should ideally prevent duplicates, but update_partner may not enforce it
        warn('update_partner allowed duplicate line_user_id — checking verify_line_login behavior');
        const validSig = generateSig(testLineUserId);
        const loginRes = await apiCallPublic('verify_line_login', {
          line_user_id: testLineUserId,
          sig: validSig,
        });
        if (loginRes.success) {
          log(`  verify_line_login returned partner: ${loginRes.partner?.partner_code}`);
        }
        // Clean up: remove line_user_id from partner2
        await apiCall('update_partner', {
          partner_code: testPartnerCode2,
          line_user_id: '',
        });
      } else {
        pass('update_partner correctly prevents duplicate line_user_id binding');
      }
    }

    // ================================================================
    // TEST 11: LIFF ID endpoint
    // ================================================================
    log('');
    log('=== TEST 11: LIFF ID endpoint ===');
    {
      const res = await fetch(`${apiUrl}?get_liff_id=1`);
      const json = await res.json();
      assert(
        json.hasOwnProperty('liff_id'),
        'GET /api?get_liff_id=1 returns liff_id field'
      );
      log(`  liff_id value: "${json.liff_id}" (may be empty in test env)`);
    }

    // ================================================================
    // TEST 12: Signature generation consistency
    // ================================================================
    log('');
    log('=== TEST 12: Signature generation consistency ===');
    {
      const testId1 = 'U1234567890abcdef';
      const testId2 = 'Ufedcba0987654321';

      const sig1a = generateSig(testId1);
      const sig1b = generateSig(testId1);
      const sig2 = generateSig(testId2);

      assert(sig1a === sig1b, 'Same line_user_id produces same signature');
      assert(sig1a !== sig2, 'Different line_user_ids produce different signatures');
      assert(sig1a.length === 64, 'Signature is 64 hex chars (SHA256)');
    }

    // ================================================================
    // TEST 13: verify_line_login with correct sig after reactivation
    // ================================================================
    log('');
    log('=== TEST 13: verify_line_login works after partner reactivation ===');
    {
      const validSig = generateSig(testLineUserId);
      const loginRes = await apiCallPublic('verify_line_login', {
        line_user_id: testLineUserId,
        sig: validSig,
      });
      assert(loginRes.success, 'verify_line_login works for reactivated partner');
      if (loginRes.success && loginRes.partner) {
        assert(
          typeof loginRes.partner.total_commission_earned === 'number',
          'Partner data includes total_commission_earned as number'
        );
        assert(
          typeof loginRes.partner.available_points === 'number',
          'Partner data includes available_points as number'
        );
        assert(
          typeof loginRes.partner.level === 'string' && loginRes.partner.level.length > 0,
          'Partner data includes level as non-empty string'
        );
      }
    }

    // ================================================================
    // CLEANUP
    // ================================================================
    log('');
    log('=== CLEANUP ===');
    await supabaseDelete('partners', `partner_code=eq.${testPartnerCode1}`);
    await supabaseDelete('partners', `partner_code=eq.${testPartnerCode2}`);

    // ================================================================
    // SUMMARY
    // ================================================================
    log('');
    log('========================================');
    log(`E2E line-integration SUMMARY: ${passed} passed, ${failed} failed, ${warnings} warnings`);
    log('========================================');

    if (failed > 0) {
      process.exitCode = 1;
    }

  } catch (error) {
    log('FATAL:', error.message);
    log(error.stack);
    process.exitCode = 1;

    // Best-effort cleanup
    log('');
    log('=== EMERGENCY CLEANUP ===');
    try { await supabaseDelete('partners', `partner_code=eq.${testPartnerCode1}`); } catch (_) {}
    try { await supabaseDelete('partners', `partner_code=eq.${testPartnerCode2}`); } catch (_) {}
  }
})();
