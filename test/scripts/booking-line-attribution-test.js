#!/usr/bin/env node

const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const dataAdapterPath = path.join(repoRoot, 'api/_lib/data-adapter.js');
const backendPath = path.join(repoRoot, 'api/_lib/backend.js');

require.cache[dataAdapterPath] = {
  id: dataAdapterPath,
  filename: dataAdapterPath,
  loaded: true,
  exports: {
    getAllRecords: async () => [],
    findByField: async () => [],
    findById: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    ensureTable: async () => {},
    getFields: async () => []
  }
};

const { __test__ } = require(backendPath);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function testLatestClaimSelection() {
  const claims = [
    {
      id: 1,
      partner_code: 'amb1001',
      entered_code: 'FOREST101',
      last_claimed_at: '2026-03-19T09:00:00.000Z'
    },
    {
      id: 2,
      partner_code: 'amb2002',
      entered_code: 'FOREST202',
      last_claimed_at: '2026-03-20T10:30:00.000Z'
    }
  ];

  const latest = __test__.selectLatestLineReferralClaim(claims);
  assert(latest.partner_code === 'amb2002', 'Should pick the newest claim as default attribution');
}

function testAutoAttributionUsesLatestClaim() {
  const attribution = __test__.determineBookingAttribution(
    {
      line_user_id: 'U1234567890',
      line_display_name: 'Forest Guest',
      partner_code: ''
    },
    {
      partner_code: 'amb2002',
      entered_code: 'FOREST202',
      line_display_name: 'Forest Guest',
      last_claimed_at: '2026-03-20T10:30:00.000Z'
    },
    {
      hasExplicitPartnerField: false
    }
  );

  assert(attribution.partner_code === 'amb2002', 'Missing partner should default to latest claim partner');
  assert(attribution.attribution_source === 'LATEST_LINE_CLAIM', 'Auto attribution source should be latest claim');
  assert(attribution.attribution_entered_code === 'FOREST202', 'Should keep entered coupon code snapshot');
}

function testManualOverrideWins() {
  const attribution = __test__.determineBookingAttribution(
    {
      line_user_id: 'U1234567890',
      line_display_name: 'Forest Guest',
      partner_code: 'amb9009'
    },
    {
      partner_code: 'amb2002',
      entered_code: 'FOREST202',
      line_display_name: 'Forest Guest',
      last_claimed_at: '2026-03-20T10:30:00.000Z'
    },
    {
      hasExplicitPartnerField: true
    }
  );

  assert(attribution.partner_code === 'amb9009', 'Manual override should keep chosen partner');
  assert(attribution.attribution_source === 'MANUAL_OVERRIDE', 'Override should be marked explicitly');
}

function testManualClearWinsDuringEdit() {
  const attribution = __test__.determineBookingAttribution(
    {
      line_user_id: 'U1234567890',
      line_display_name: 'Forest Guest',
      partner_code: ''
    },
    {
      partner_code: 'amb2002',
      entered_code: 'FOREST202',
      line_display_name: 'Forest Guest',
      last_claimed_at: '2026-03-20T10:30:00.000Z'
    },
    {
      hasExplicitPartnerField: true,
      explicitEmptyPartnerClears: true
    }
  );

  assert(attribution.partner_code === null, 'Explicitly clearing partner should not snap back to latest claim');
  assert(attribution.attribution_source === 'MANUAL_CLEAR', 'Clearing attribution should be marked as manual clear');
}

function main() {
  testLatestClaimSelection();
  testAutoAttributionUsesLatestClaim();
  testManualOverrideWins();
  testManualClearWinsDuringEdit();
  console.log('booking-line-attribution-test: ok');
}

main();
