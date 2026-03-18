-- Annual partner level retention fields
-- Safe to run multiple times.
-- Existing partners do not require a SQL backfill; backend logic can infer
-- legacy state from completed bookings until these fields are populated.

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS base_level_for_year TEXT DEFAULT 'LV1_INSIDER',
  ADD COLUMN IF NOT EXISTS yearly_referrals_year INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level_achieved_at TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS level_valid_until TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_level_review_year INTEGER DEFAULT 0;
