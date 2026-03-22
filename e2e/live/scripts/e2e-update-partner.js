const fs = require('fs');
const path = require('path');

const apiBase = process.env.API_BASE || 'https://forest-ambassador.vercel.app/api';
const adminSecret = process.env.ADMIN_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!adminSecret || !supabaseUrl || !supabaseKey) throw new Error('Missing env');

const ts = Date.now();
const suffix = String(ts).slice(-6);
const partnerCode = `up${suffix}`;
const artifactFile = path.join('/tmp/codex-browser-test', `update-partner-${ts}.json`);

function log(...args) { console.log(new Date().toISOString(), ...args); }
function ensure(cond, msg) { if (!cond) throw new Error(msg); }

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

async function apiActionExpectFail(action, payload) {
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
  try { return JSON.parse(text); } catch (_) { return { success: false, raw: text }; }
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
  log('CLEANED', partnerCode);
}

(async () => {
  const result = { artifactFile, scenarios: {} };
  try {
    await cleanup().catch(() => {});

    // Step 1: Create partner with basic info
    log('STEP 1: Create partner', partnerCode);
    await apiAction('create_partner', {
      partner_code: partnerCode,
      coupon_code: `CP${partnerCode.toUpperCase()}`,
      coupon_url: 'https://www.lx-foresthouse.com/',
      partner_name: `UpdatePartner ${suffix}`,
      phone: '0912400001',
      email: `${partnerCode}@example.com`,
      partner_level: 'LV1_INSIDER',
      commission_preference: 'ACCOMMODATION'
    });

    // Scenario 1: Update bank info
    log('SCENARIO 1: Update bank info');
    await apiAction('update_partner', {
      partner_code: partnerCode,
      bank_name: '\u4e2d\u570b\u4fe1\u8a17',
      bank_code: '822',
      bank_branch: '\u677e\u5c71\u5206\u884c',
      bank_account_name: '\u738b\u5c0f\u660e',
      bank_account: '12345678'
    });

    const afterBank = (await supabaseQuery('partners', `select=partner_code,bank_name,bank_code,bank_branch,bank_account_name,bank_account&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`))[0];
    ensure(afterBank.bank_name === '\u4e2d\u570b\u4fe1\u8a17', `bank_name should be \u4e2d\u570b\u4fe1\u8a17, got ${afterBank.bank_name}`);
    ensure(afterBank.bank_code === '822', `bank_code should be 822, got ${afterBank.bank_code}`);
    ensure(afterBank.bank_branch === '\u677e\u5c71\u5206\u884c', `bank_branch should be \u677e\u5c71\u5206\u884c, got ${afterBank.bank_branch}`);
    ensure(afterBank.bank_account_name === '\u738b\u5c0f\u660e', `bank_account_name should be \u738b\u5c0f\u660e, got ${afterBank.bank_account_name}`);
    ensure(afterBank.bank_account === '12345678', `bank_account should be 12345678, got ${afterBank.bank_account}`);
    log('  All bank fields verified');
    result.scenarios.update_bank = afterBank;

    // Scenario 2: Update commission_preference to CASH
    log('SCENARIO 2: Update commission_preference to CASH');
    await apiAction('update_partner', {
      partner_code: partnerCode,
      commission_preference: 'CASH'
    });

    const afterPref = (await supabaseQuery('partners', `select=partner_code,commission_preference&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`))[0];
    ensure(afterPref.commission_preference === 'CASH', `commission_preference should be CASH, got ${afterPref.commission_preference}`);
    log('  commission_preference verified: CASH');
    result.scenarios.update_preference = { commission_preference: afterPref.commission_preference };

    // Scenario 3: Update contact info (name, email, phone)
    log('SCENARIO 3: Update contact info');
    const newName = `UP_Updated_${suffix}`;
    const newEmail = `up_updated_${suffix}@example.com`;
    const newPhone = '0912400099';
    await apiAction('update_partner', {
      partner_code: partnerCode,
      name: newName,
      email: newEmail,
      phone: newPhone
    });

    const afterContact = (await supabaseQuery('partners', `select=partner_code,name,email,phone&partner_code=eq.${encodeURIComponent(partnerCode)}&limit=1`))[0];
    ensure(afterContact.name === newName, `name should be ${newName}, got ${afterContact.name}`);
    ensure(afterContact.email === newEmail, `email should be ${newEmail}, got ${afterContact.email}`);
    ensure(afterContact.phone === newPhone, `phone should be ${newPhone}, got ${afterContact.phone}`);
    log('  All contact fields verified');
    result.scenarios.update_contact = afterContact;

    // Scenario 4: Edge case — update non-existent partner
    log('SCENARIO 4: Update non-existent partner');
    const failResult = await apiActionExpectFail('update_partner', {
      partner_code: 'NONEXISTENT_999999',
      bank_name: 'Test'
    });
    ensure(!failResult.success, `Updating non-existent partner should fail, got success`);
    log('  Non-existent partner correctly rejected');
    result.scenarios.edge_nonexistent = { failResult };

    fs.mkdirSync(path.dirname(artifactFile), { recursive: true });
    fs.writeFileSync(artifactFile, JSON.stringify(result, null, 2));
    log('E2E_UPDATE_PARTNER PASS', artifactFile);
    await cleanup();
  } catch (error) {
    log('E2E_UPDATE_PARTNER FAIL', error.stack || error.message);
    try { fs.mkdirSync(path.dirname(artifactFile), { recursive: true }); fs.writeFileSync(artifactFile, JSON.stringify({ error: error.stack || error.message, partial: result }, null, 2)); } catch (_) {}
    await cleanup().catch(() => {});
    process.exitCode = 1;
  }
})();
