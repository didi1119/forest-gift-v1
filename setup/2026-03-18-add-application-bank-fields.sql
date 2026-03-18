-- Application bank fields
-- Safe to run multiple times.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS bank_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_code TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_branch TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT DEFAULT '';
