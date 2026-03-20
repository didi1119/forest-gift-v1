ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS line_user_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS line_display_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS attribution_source TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS attribution_claimed_at TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS attribution_entered_code TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_bookings_line_user_id ON bookings(line_user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_attribution_source ON bookings(attribution_source);
