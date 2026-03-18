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

function makeBooking(id, year, day, partnerCode) {
  const month = String(Math.floor((day - 1) / 28) + 1).padStart(2, '0');
  const date = String(((day - 1) % 28) + 1).padStart(2, '0');
  return {
    id,
    partner_code: partnerCode,
    booking_source: 'REFERRAL',
    stay_status: 'COMPLETED',
    checkin_date: `${year}-${month}-${date}`,
    checkout_date: `${year}-${month}-${date}`,
    commission_type: 'ACCOMMODATION',
    room_price: 4000
  };
}

function makeBookings(partnerCode, year, count, startId) {
  const bookings = [];
  for (let i = 0; i < count; i += 1) {
    bookings.push(makeBooking(startId + i, year, i + 1, partnerCode));
  }
  return bookings;
}

function groupByYear(partnerCode, bookings) {
  return __test__.groupPartnerCompletedBookings(partnerCode, bookings).bookingsByYear;
}

function testAnnualReviewRules() {
  assert(__test__.reviewLevelForNextYear('LV3_GUARDIAN', 6) === 'LV3_GUARDIAN', 'LV3 should retain with 6');
  assert(__test__.reviewLevelForNextYear('LV3_GUARDIAN', 0) === 'LV2_GUIDE', 'LV3 should single-step downgrade to LV2');
  assert(__test__.reviewLevelForNextYear('LV2_GUIDE', 3) === 'LV2_GUIDE', 'LV2 should retain with 3');
  assert(__test__.reviewLevelForNextYear('LV2_GUIDE', 0) === 'LV1_INSIDER', 'LV2 should downgrade to LV1');
}

function testLegacyBootstrapAndCarryover() {
  const partnerCode = 'BOOT001';
  const currentYearBookings = makeBookings(partnerCode, 2026, 4, 1);
  const snapshot = __test__.simulatePartnerLevelSnapshot({
    partner_code: partnerCode,
    partner_level: 'LV1_INSIDER',
    level: 'LV1_INSIDER'
  }, groupByYear(partnerCode, currentYearBookings), new Date('2026-06-01T00:00:00+08:00'));

  assert(snapshot.partner_level === 'LV2_GUIDE', 'Legacy partner should upgrade immediately on 4th success');
  assert(snapshot.base_level_for_year === 'LV1_INSIDER', 'Legacy bootstrap should preserve carry-in base level');
  assert(snapshot.level_valid_until === '2027-12-31', 'Upgraded level should extend through next year end');
}

function testCrossYearRetentionAndUpgrade() {
  const partnerCode = 'KEEP001';
  const bookings = [
    ...makeBookings(partnerCode, 2026, 4, 1),
    ...makeBookings(partnerCode, 2027, 10, 100)
  ];

  const snapshot2027 = __test__.simulatePartnerLevelSnapshot({
    partner_code: partnerCode,
    partner_level: 'LV2_GUIDE',
    level: 'LV2_GUIDE',
    base_level_for_year: 'LV1_INSIDER',
    yearly_referrals_year: 2026,
    last_level_review_year: 2025,
    level_valid_until: '2027-12-31'
  }, groupByYear(partnerCode, bookings), new Date('2027-10-20T00:00:00+08:00'));

  assert(snapshot2027.base_level_for_year === 'LV2_GUIDE', '2026 review should carry LV2 into 2027');
  assert(snapshot2027.partner_level === 'LV3_GUARDIAN', '2027 should upgrade to LV3 after 10 successes');
  assert(snapshot2027.level_valid_until === '2028-12-31', 'New LV3 should extend through end of 2028');
}

function testSingleStepDowngradeAcrossSkippedYear() {
  const partnerCode = 'DROP001';
  const bookings = makeBookings(partnerCode, 2026, 10, 1);
  const snapshot2028 = __test__.simulatePartnerLevelSnapshot({
    partner_code: partnerCode,
    partner_level: 'LV3_GUARDIAN',
    level: 'LV3_GUARDIAN',
    base_level_for_year: 'LV1_INSIDER',
    yearly_referrals_year: 2026,
    last_level_review_year: 2025,
    level_valid_until: '2027-12-31'
  }, groupByYear(partnerCode, bookings), new Date('2028-03-01T00:00:00+08:00'));

  assert(snapshot2028.base_level_for_year === 'LV2_GUIDE', 'Missing 2027 performance should downgrade LV3 to LV2 for 2028');
  assert(snapshot2028.partner_level === 'LV2_GUIDE', 'Current effective level should stay at the downgraded LV2');
  assert(snapshot2028.level_valid_until === '2028-12-31', 'Downgraded carryover should only last through current year end');
}

function testThresholdBookingKeepsOldCommissionLevel() {
  const partnerCode = 'FLOW001';
  const bookings = [
    ...makeBookings(partnerCode, 2026, 4, 1),
    ...makeBookings(partnerCode, 2027, 10, 100)
  ];
  const timeline = __test__.buildCompletedBookingLevelTimeline(bookings);

  assert(timeline[3].levelBeforeBooking === 'LV1_INSIDER', '4th booking should still use LV1 commission');
  assert(timeline[4].levelBeforeBooking === 'LV2_GUIDE', 'First booking after LV2 upgrade should use LV2 commission');
  assert(timeline[13].levelBeforeBooking === 'LV2_GUIDE', '10th booking of the year should still use LV2 commission');
}

function main() {
  testAnnualReviewRules();
  testLegacyBootstrapAndCarryover();
  testCrossYearRetentionAndUpgrade();
  testSingleStepDowngradeAcrossSkippedYear();
  testThresholdBookingKeepsOldCommissionLevel();
  console.log('annual-level-retention-test: ok');
}

main();
