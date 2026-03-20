// 靜謐森林知音計畫 — 集中設定檔
// 部署時請更新以下值為實際的設定

const ForestConfig = {
  // Apps Script Web App URL（部署後取得）
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyzaMMHbo1zesnAP4Go3Iz1R1z3702Ct4cuEJOdJpHArHpVpnCgvMIfeWx_PzRTWj8F/exec',

  // Google Analytics 4 Measurement ID
  GA4_MEASUREMENT_ID: 'G-XXXXXXXXXX',

  // LINE 優惠券預設連結
  DEFAULT_LINE_COUPON_URL: 'https://lin.ee/q38pqot',

  // 網站根 URL（自動偵測）
  SITE_BASE_URL: window.location.origin,
};

// 全域存取
if (typeof window !== 'undefined') {
  window.ForestConfig = ForestConfig;
}
