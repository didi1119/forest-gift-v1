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

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW()::TEXT;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON line_coupon_bindings;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON line_coupon_bindings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
