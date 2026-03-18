// ========================================
// 系統配置與常數
// ========================================

const SHEETS_ID = (process.env.GOOGLE_SHEETS_ID || '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4').trim();
const GITHUB_PAGES_URL = process.env.GITHUB_PAGES_URL || 'https://forest-ambassador.vercel.app/frontend/index.html';
const DEFAULT_LINE_COUPON_URL = process.env.DEFAULT_LINE_COUPON_URL || 'https://lin.ee/q38pqot';

// 佣金等級對照表
const COMMISSION_RATES = {
  'LV1_INSIDER': { accommodation: 1000, cash: 500 },
  'LV2_GUIDE': { accommodation: 1200, cash: 600 },
  'LV3_GUARDIAN': { accommodation: 1500, cash: 750 }
};

const FIRST_REFERRAL_BONUS = 1500;

// 等級晉升條件
const LEVEL_REQUIREMENTS = {
  'LV2_GUIDE': 4,
  'LV3_GUARDIAN': 10
};

const LEVEL_RETENTION_REQUIREMENTS = {
  'LV2_GUIDE': 3,
  'LV3_GUARDIAN': 6
};

// 數據模型定義
const DataModels = {
  Booking: {
    tableName: 'Bookings',
    fields: ['id', 'partner_code', 'guest_name', 'guest_phone', 'guest_email',
      'bank_account_last5', 'checkin_date', 'checkout_date', 'room_price',
      'booking_source', 'stay_status', 'payment_status', 'commission_status',
      'commission_amount', 'commission_type', 'is_first_referral_bonus',
      'first_referral_bonus_amount', 'manually_confirmed_by',
      'manually_confirmed_at', 'notes', 'created_at', 'updated_at']
  },
  Partner: {
    tableName: 'Partners',
    fields: ['id', 'partner_code', 'name', 'email', 'phone', 'level',
      'level_progress', 'total_successful_referrals', 'commission_preference',
      'total_commission_earned', 'total_commission_paid', 'pending_commission',
      'coupon_code', 'coupon_url', 'landing_link', 'coupon_link',
      'short_landing_link', 'short_coupon_link', 'created_at', 'updated_at',
      'available_points', 'points_used', 'bank_account', 'bank_code',
      'yearly_referrals', 'notes', 'is_active', 'contact_phone', 'contact_email',
      'base_level_for_year', 'yearly_referrals_year', 'level_achieved_at',
      'level_valid_until', 'last_level_review_year']
  },
  Payout: {
    tableName: 'Payouts',
    fields: ['id', 'partner_code', 'payout_type', 'amount', 'related_booking_ids',
      'payout_method', 'payout_status', 'bank_transfer_date',
      'bank_transfer_reference', 'accommodation_voucher_code', 'notes',
      'created_by', 'created_at', 'updated_at']
  },
  AccommodationUsage: {
    tableName: 'Accommodation_Usage',
    fields: ['id', 'partner_code', 'deduct_amount', 'related_booking_id',
      'usage_date', 'usage_type', 'notes', 'created_by', 'created_at', 'updated_at']
  },
  Clicks: {
    tableName: 'Clicks',
    fields: ['id', 'partner_code', 'destination', 'utm_source', 'utm_medium',
      'utm_campaign', 'referrer', 'user_agent', 'ip_address', 'click_time',
      'created_at']
  },
  Application: {
    tableName: 'Applications',
    fields: ['id', 'name', 'email', 'line_name', 'phone', 'message',
      'referral_source', 'social_profile',
      'application_status', 'review_notes', 'reviewed_by', 'reviewed_at',
      'partner_code_assigned', 'partner_link_sent', 'created_at', 'updated_at']
  }
};

module.exports = {
  SHEETS_ID,
  GITHUB_PAGES_URL,
  DEFAULT_LINE_COUPON_URL,
  COMMISSION_RATES,
  FIRST_REFERRAL_BONUS,
  LEVEL_REQUIREMENTS,
  LEVEL_RETENTION_REQUIREMENTS,
  DataModels
};
