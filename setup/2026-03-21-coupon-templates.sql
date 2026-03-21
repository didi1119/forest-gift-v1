-- ========================================
-- 優惠券模板表 (Coupon Templates)
-- 管理可分配給大使的 LINE 優惠券連結
-- ========================================

CREATE TABLE IF NOT EXISTS coupon_templates (
  id BIGSERIAL PRIMARY KEY,
  coupon_name TEXT NOT NULL,
  coupon_url TEXT NOT NULL,
  coupon_description TEXT DEFAULT '',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TEXT DEFAULT '',
  updated_at TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_coupon_templates_is_active ON coupon_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_coupon_templates_is_default ON coupon_templates(is_default);

-- 種子資料：現有預設優惠券
INSERT INTO coupon_templates (coupon_name, coupon_url, coupon_description, is_default, created_at)
VALUES (
  '土地的厚愛',
  'https://lin.ee/q38pqot',
  '獲贈 [山城地瓜包] 乙份 ＆ [延時退房一小時]',
  true,
  NOW()::TEXT
);

-- 加入 updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON coupon_templates;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON coupon_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
