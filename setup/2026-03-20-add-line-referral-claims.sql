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

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW()::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON line_referral_claims;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON line_referral_claims
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
