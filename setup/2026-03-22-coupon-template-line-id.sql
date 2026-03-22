-- Migration: Add line_coupon_id to coupon_templates
-- Allows each coupon template to specify which LINE coupon to reply with
-- when a customer enters the partner's coupon code on LINE@

ALTER TABLE coupon_templates ADD COLUMN IF NOT EXISTS line_coupon_id TEXT DEFAULT '';

COMMENT ON COLUMN coupon_templates.line_coupon_id IS 'LINE Messaging API coupon ID for auto-reply. Falls back to LINE_SHARED_COUPON_ID env var if empty.';
