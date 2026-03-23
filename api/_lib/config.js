// ========================================
// 系統配置與常數
// ========================================

const SHEETS_ID = (process.env.GOOGLE_SHEETS_ID || '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4').trim();
const GITHUB_PAGES_URL = process.env.GITHUB_PAGES_URL || 'https://forest-ambassador.vercel.app/frontend/index.html';
const DEFAULT_LINE_COUPON_URL = process.env.DEFAULT_LINE_COUPON_URL || '';
const DEFAULT_LINE_COUPON_TITLE = process.env.LINE_COUPON_TITLE || '土地的厚愛';
const DEFAULT_LINE_COUPON_DESCRIPTION = process.env.LINE_COUPON_DESCRIPTION || '獲贈 [山城地瓜包] 乙份 ＆ [延時退房一小時]。\n\n這是我們想送給你的兩份禮物：\n一份是紮實飽滿的在地滋味，\n一份是悠哉退房的自由時光。\n希望你在這裡，像在家一樣自在。';
const DEFAULT_LINE_COUPON_USAGE_CONDITION = process.env.LINE_COUPON_USAGE_CONDITION || '出示此券即可兌換，每組訂單限用一次。';
const DEFAULT_LINE_COUPON_VALID_DAYS = parseInt(process.env.LINE_COUPON_VALID_DAYS || '365', 10);
const DEFAULT_LINE_SHARED_CLAIM_STATUS = 'CLAIMED';

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
      'bank_account_last5', 'line_user_id', 'line_display_name',
      'attribution_source', 'attribution_claimed_at', 'attribution_entered_code',
      'checkin_date', 'checkout_date', 'room_price',
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
      'bank_name', 'bank_code', 'bank_branch', 'bank_account_name', 'bank_account_number',
      'application_status', 'review_notes', 'reviewed_by', 'reviewed_at',
      'partner_code_assigned', 'partner_link_sent', 'created_at', 'updated_at']
  },
  LineCouponBinding: {
    tableName: 'Line_Coupon_Bindings',
    fields: ['id', 'partner_code', 'coupon_code', 'normalized_coupon_code',
      'line_coupon_id', 'line_coupon_status', 'line_keyword_status',
      'coupon_title', 'coupon_description', 'coupon_usage_condition',
      'reply_count', 'last_replied_at', 'line_coupon_closed_at',
      'is_active', 'last_error', 'created_at', 'updated_at']
  },
  LineReferralClaim: {
    tableName: 'Line_Referral_Claims',
    fields: ['id', 'claim_key', 'line_user_id', 'line_source_type',
      'line_display_name', 'line_message_id', 'entered_code',
      'normalized_entered_code', 'partner_code', 'shared_coupon_id',
      'claim_status', 'claim_count', 'coupon_reply_count',
      'first_claimed_at', 'last_claimed_at', 'last_replied_at',
      'last_reply_status', 'booking_id', 'notes', 'last_error',
      'created_at', 'updated_at']
  },
  CouponTemplate: {
    tableName: 'Coupon_Templates',
    fields: ['id', 'coupon_name', 'coupon_url', 'coupon_description',
      'line_coupon_id', 'is_default', 'is_active', 'created_at', 'updated_at']
  }
};

module.exports = {
  SHEETS_ID,
  GITHUB_PAGES_URL,
  DEFAULT_LINE_COUPON_URL,
  DEFAULT_LINE_COUPON_TITLE,
  DEFAULT_LINE_COUPON_DESCRIPTION,
  DEFAULT_LINE_COUPON_USAGE_CONDITION,
  DEFAULT_LINE_COUPON_VALID_DAYS,
  DEFAULT_LINE_SHARED_CLAIM_STATUS,
  COMMISSION_RATES,
  FIRST_REFERRAL_BONUS,
  LEVEL_REQUIREMENTS,
  LEVEL_RETENTION_REQUIREMENTS,
  DataModels
};
