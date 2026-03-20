-- ========================================
-- 知音計畫 Supabase Schema
-- 對應 6 個 Google Sheets 工作表
-- ========================================

-- 1. Partners
CREATE TABLE IF NOT EXISTS partners (
  id BIGSERIAL PRIMARY KEY,
  partner_code TEXT NOT NULL UNIQUE,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  level TEXT DEFAULT 'LV1_INSIDER',
  level_progress INTEGER DEFAULT 0,
  total_successful_referrals INTEGER DEFAULT 0,
  commission_preference TEXT DEFAULT 'ACCOMMODATION',
  total_commission_earned NUMERIC DEFAULT 0,
  total_commission_paid NUMERIC DEFAULT 0,
  pending_commission NUMERIC DEFAULT 0,
  coupon_code TEXT DEFAULT '',
  coupon_url TEXT DEFAULT '',
  landing_link TEXT DEFAULT '',
  coupon_link TEXT DEFAULT '',
  short_landing_link TEXT DEFAULT '',
  short_coupon_link TEXT DEFAULT '',
  available_points NUMERIC DEFAULT 0,
  points_used NUMERIC DEFAULT 0,
  bank_account TEXT DEFAULT '',
  bank_code TEXT DEFAULT '',
  yearly_referrals INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  contact_phone TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  -- 以下為 backend.js 中使用但不在 config.js DataModels 裡的欄位
  partner_name TEXT DEFAULT '',
  partner_level TEXT DEFAULT 'LV1_INSIDER',
  total_referrals INTEGER DEFAULT 0,
  successful_referrals INTEGER DEFAULT 0,
  line_coupon_url TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  bank_branch TEXT DEFAULT '',
  bank_account_name TEXT DEFAULT '',
  join_date TEXT DEFAULT '',
  total_clicks INTEGER DEFAULT 0,
  last_click_date TEXT DEFAULT '',
  total_commission NUMERIC DEFAULT 0,
  base_level_for_year TEXT DEFAULT 'LV1_INSIDER',
  yearly_referrals_year INTEGER DEFAULT 0,
  level_achieved_at TEXT DEFAULT '',
  level_valid_until TEXT DEFAULT '',
  last_level_review_year INTEGER DEFAULT 0,
  created_at TEXT DEFAULT '',
  updated_at TEXT DEFAULT ''
);

ALTER TABLE partners ADD COLUMN IF NOT EXISTS base_level_for_year TEXT DEFAULT 'LV1_INSIDER';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS yearly_referrals_year INTEGER DEFAULT 0;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS level_achieved_at TEXT DEFAULT '';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS level_valid_until TEXT DEFAULT '';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS last_level_review_year INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_partners_partner_code ON partners(partner_code);
CREATE INDEX IF NOT EXISTS idx_partners_email ON partners(email);
CREATE INDEX IF NOT EXISTS idx_partners_is_active ON partners(is_active);

-- 2. Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  partner_code TEXT DEFAULT '',
  guest_name TEXT DEFAULT '',
  guest_phone TEXT DEFAULT '',
  guest_email TEXT DEFAULT '',
  bank_account_last5 TEXT DEFAULT '',
  checkin_date TEXT DEFAULT '',
  checkout_date TEXT DEFAULT '',
  room_price NUMERIC DEFAULT 0,
  booking_source TEXT DEFAULT 'DIRECT',
  stay_status TEXT DEFAULT 'PENDING',
  payment_status TEXT DEFAULT 'PENDING',
  commission_status TEXT DEFAULT 'NOT_ELIGIBLE',
  commission_amount NUMERIC DEFAULT 0,
  commission_type TEXT DEFAULT 'ACCOMMODATION',
  is_first_referral_bonus TEXT DEFAULT 'false',
  first_referral_bonus_amount NUMERIC DEFAULT 0,
  manually_confirmed_by TEXT DEFAULT '',
  manually_confirmed_at TEXT DEFAULT '',
  original_commission_amount NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT '',
  updated_at TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_bookings_partner_code ON bookings(partner_code);
CREATE INDEX IF NOT EXISTS idx_bookings_stay_status ON bookings(stay_status);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_name ON bookings(guest_name);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_phone ON bookings(guest_phone);

-- 3. Payouts
CREATE TABLE IF NOT EXISTS payouts (
  id BIGSERIAL PRIMARY KEY,
  partner_code TEXT DEFAULT '',
  payout_type TEXT DEFAULT '',
  amount NUMERIC DEFAULT 0,
  related_booking_ids TEXT DEFAULT '',
  payout_method TEXT DEFAULT '',
  payout_status TEXT DEFAULT 'PENDING',
  bank_transfer_date TEXT DEFAULT '',
  bank_transfer_reference TEXT DEFAULT '',
  accommodation_voucher_code TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT '',
  updated_at TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_payouts_partner_code ON payouts(partner_code);
CREATE INDEX IF NOT EXISTS idx_payouts_payout_status ON payouts(payout_status);

-- 4. Accommodation Usage
CREATE TABLE IF NOT EXISTS accommodation_usage (
  id BIGSERIAL PRIMARY KEY,
  partner_code TEXT DEFAULT '',
  deduct_amount NUMERIC DEFAULT 0,
  related_booking_id TEXT DEFAULT '',
  usage_date TEXT DEFAULT '',
  usage_type TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT '',
  updated_at TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_accommodation_usage_partner_code ON accommodation_usage(partner_code);

-- 5. Clicks
CREATE TABLE IF NOT EXISTS clicks (
  id BIGSERIAL PRIMARY KEY,
  partner_code TEXT DEFAULT '',
  destination TEXT DEFAULT '',
  utm_source TEXT DEFAULT '',
  utm_medium TEXT DEFAULT '',
  utm_campaign TEXT DEFAULT '',
  referrer TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  click_time TEXT DEFAULT '',
  created_at TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_clicks_partner_code ON clicks(partner_code);

-- 6. Applications
CREATE TABLE IF NOT EXISTS applications (
  id BIGSERIAL PRIMARY KEY,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  line_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  message TEXT DEFAULT '',
  referral_source TEXT DEFAULT '',
  social_profile TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  bank_code TEXT DEFAULT '',
  bank_branch TEXT DEFAULT '',
  bank_account_name TEXT DEFAULT '',
  bank_account_number TEXT DEFAULT '',
  application_status TEXT DEFAULT 'PENDING',
  review_notes TEXT DEFAULT '',
  reviewed_by TEXT DEFAULT '',
  reviewed_at TEXT DEFAULT '',
  partner_code_assigned TEXT DEFAULT '',
  partner_link_sent TEXT DEFAULT 'false',
  created_at TEXT DEFAULT '',
  updated_at TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(application_status);

-- 7. Line Coupon Bindings
CREATE TABLE IF NOT EXISTS line_coupon_bindings (
  id BIGSERIAL PRIMARY KEY,
  partner_code TEXT NOT NULL UNIQUE,
  coupon_code TEXT NOT NULL UNIQUE,
  normalized_coupon_code TEXT NOT NULL UNIQUE,
  line_coupon_id TEXT DEFAULT '',
  line_coupon_status TEXT DEFAULT 'PENDING',
  line_keyword_status TEXT DEFAULT 'ACTIVE',
  coupon_title TEXT DEFAULT '',
  coupon_description TEXT DEFAULT '',
  coupon_usage_condition TEXT DEFAULT '',
  reply_count INTEGER DEFAULT 0,
  last_replied_at TEXT DEFAULT '',
  line_coupon_closed_at TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  last_error TEXT DEFAULT '',
  created_at TEXT DEFAULT '',
  updated_at TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_line_coupon_bindings_partner_code ON line_coupon_bindings(partner_code);
CREATE INDEX IF NOT EXISTS idx_line_coupon_bindings_coupon_code ON line_coupon_bindings(coupon_code);
CREATE INDEX IF NOT EXISTS idx_line_coupon_bindings_status ON line_coupon_bindings(line_coupon_status);

-- 8. Line Referral Claims
CREATE TABLE IF NOT EXISTS line_referral_claims (
  id BIGSERIAL PRIMARY KEY,
  claim_key TEXT NOT NULL UNIQUE,
  line_user_id TEXT DEFAULT '',
  line_source_type TEXT DEFAULT 'user',
  line_display_name TEXT DEFAULT '',
  line_message_id TEXT DEFAULT '',
  entered_code TEXT DEFAULT '',
  normalized_entered_code TEXT DEFAULT '',
  partner_code TEXT DEFAULT '',
  shared_coupon_id TEXT DEFAULT '',
  claim_status TEXT DEFAULT 'CLAIMED',
  claim_count INTEGER DEFAULT 1,
  coupon_reply_count INTEGER DEFAULT 0,
  first_claimed_at TEXT DEFAULT '',
  last_claimed_at TEXT DEFAULT '',
  last_replied_at TEXT DEFAULT '',
  last_reply_status TEXT DEFAULT '',
  booking_id TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  last_error TEXT DEFAULT '',
  created_at TEXT DEFAULT '',
  updated_at TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_line_referral_claims_partner_code ON line_referral_claims(partner_code);
CREATE INDEX IF NOT EXISTS idx_line_referral_claims_line_user_id ON line_referral_claims(line_user_id);
CREATE INDEX IF NOT EXISTS idx_line_referral_claims_normalized_code ON line_referral_claims(normalized_entered_code);
CREATE INDEX IF NOT EXISTS idx_line_referral_claims_status ON line_referral_claims(claim_status);

-- ========================================
-- updated_at 自動更新 trigger
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW()::TEXT;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['partners', 'bookings', 'payouts', 'accommodation_usage', 'clicks', 'applications', 'line_coupon_bindings', 'line_referral_claims'])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON %I;
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', tbl, tbl);
  END LOOP;
END $$;
