/**
 * 靜謐森林知音計畫 - Google Sheets 完整設定腳本
 * 根據知音.txt內容建立完整的資料庫結構
 */

// 服務帳號設定
const SERVICE_ACCOUNT = {
  "type": "service_account",
  "project_id": "foresthouse-468510",
  "private_key_id": "6023ebf30b5de02eb1f14025592ceb2e6a29f076", 
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDBu7t2F9Rqsq7N\n13jBN8azJ+8k+SYvtUZLIGnMMFXA4CP8VUE/MiWz4X8Tiu6kG2ABKDPBYhU7eu1v\nCBcCfxhiDhVr6LPS1YYs48L5lBbwGv7c8n2YUU+gn8KL/FWLF6MJcs80nr34hLB8\nRDtmjBhAc8aeZgegblSpbEJJPgyVkzdJPzEq7BJvbYI4Pv92oREaV126kMIS2X72\nH6O5uQJPfhUEX4G6o5Cn4UJzXpYmH7QF7LP4DqJElfd4OGuwgKhvSATjB5/i04R/\nOyhs/lV09aW1pwana6gLCNVWiKHACgDniob3FPOmIkbu+iB5DzIokePkKJ/SmdKl\n6yQiRUmNAgMBAAECggEAO1iy+F4caAMMoWncR/Q6Hi+hhoX8OKkjO2hWgIJeApOm\n8ml7b0yBWDU/pFDvAb6RDkmucRMGxg3GJjkoM0+TvJXr4f6K948JZz7uP14qGKts\nX2q5Jqvh5KaMBi3qVo2LGB3fc5MdRr//AFI2kBdiZnwQ3/0JYQ/rR2sucxla6YaB\n9w+VJP73+X900TEfm+jCm4tiYIr4gI/Us4xMRvJIX0XtXkFEnRFaETOccNUkgC9s\nWpIsTDRthG1F89txU3T5hAbFiBOBfCjLWT9Osh2nvjhGnE94hAY/OyLfyDJmEyln\nVGboCBCPxPyWwXXC1cOwFgoma33jTq+gGbiGNVee0QKBgQD7oS2Zj25f+AaAA8gT\nPoiSVK6gXLwUIv2QhRF/snOPoq8jS4dYGeVZHyrSpC8h7ODBESOQUqmZZYgQcvEs\nDSLhs2IpijtSA2tt05EGDKm/PF/bsbt5xPrDNLvney0+/aUTgivvkxdTrxuyvJ0V\n58nMfHqcXeg2XN/wODePuzKfgwKBgQDFGSEyjoizvFGolC2q6wVI59vf2P5Wkb+b\nXEhxahavGPaRXnqUqPshHBleJ9BcijGUHDt1YO9kd64iLGHb1UWjUqsg/ChZtdvG\n3vFkAMqXZVE56lboZWO+aW0tx4ns6kmog72cP9HdGgLo5FFBTZrPFHjZLVgLCkUL\neKjrmXGVrwKBgQDxYsQQvJRggdkScw46z9FJtuyyL2PJWWuveMe5nWHYV3L1Q945\nONZX8VsuKIyCWe+dpihcqb/CxLCLPwh2fr+IjoHLYazYVyl2eO91Qy6PooY+hbhX\n7wuzuWHMhNB5ze7O0R/+ujc1cxT6GJAE1I80l/EzEa7Sf7PfiL5cJnNAqwKBgFug\nohlBv/Vmr8OiF1Tk61EIUORQmXSfTycnkJoBCsid30qXVH81y4GJ8ZUfBzNuHzxO\nn6mixce8B5zlaxzqmfQiY2HzN8L001YxoKCv6X7WYBt/gKWLNQJ5OoNUxx73kASi\nMgyocqTKCd5A/jFQpY5tYvz7onmHba+2iTj13aMLAoGAJ8E8ru52/rcCF22Cpngs\nBB1R4oHw6RmsZddxtDWwInBFoUjQuoTO+tlGzPgRviFbJebK9CxHtuk73UepsojO\nXbZKx0qp+WztcqGI8tOKETT6+9v93k8Qwion+anFl4jKVkLj/DSxJaXVhu691Pzh\nwPDNBdj0yXYGsFDtjCPs4mo=\n-----END PRIVATE KEY-----\n",
  "client_email": "forest-ambassador@foresthouse-468510.iam.gserviceaccount.com",
  "client_id": "110412141342772391367",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/forest-ambassador%40foresthouse-468510.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

// 建立 4 個資料表的完整結構

/**
 * 1. Partners 表 - 知音大使資料
 */
const PARTNERS_HEADERS = [
  'partner_id',          // 夥伴ID (自動生成)
  'partner_code',        // 夥伴代碼 (例：WANG001)
  'name',               // 夥伴姓名
  'email',              // Email
  'phone',              // 電話 (選填)
  'join_date',          // 加入日期
  'level',              // 等級 (知音大使/森林嚮導/秘境守護者)
  'status',             // 狀態 (active/inactive)
  'total_referrals',    // 總推薦數
  'successful_referrals', // 成功推薦數
  'current_year_referrals', // 本年度推薦數
  'landing_link',       // 主頁連結
  'coupon_link',        // 優惠券連結
  'coupon_code',        // 專屬優惠券代碼
  'notes',              // 備註
  'created_at',         // 創建時間
  'updated_at'          // 更新時間
];

/**
 * 2. Clicks 表 - 點擊記錄
 */
const CLICKS_HEADERS = [
  'click_id',           // 點擊ID (自動生成)
  'partner_code',       // 夥伴代碼
  'click_timestamp',    // 點擊時間
  'ip_address',         // IP地址
  'user_agent',         // 瀏覽器資訊
  'referrer',           // 來源頁面
  'destination',        // 目標頁面 (landing/coupon)
  'utm_source',         // UTM來源
  'utm_medium',         // UTM媒介
  'utm_campaign',       // UTM活動
  'session_id',         // 會話ID
  'country',            // 國家 (根據IP)
  'city',               // 城市 (根據IP)
  'device_type',        // 設備類型 (mobile/desktop)
  'conversion_status',  // 轉換狀態 (pending/converted/failed)
  'created_at'          // 創建時間
];

/**
 * 3. Bookings 表 - 訂房記錄
 */
const BOOKINGS_HEADERS = [
  'booking_id',         // 訂房ID
  'partner_code',       // 推薦夥伴代碼
  'customer_name',      // 客戶姓名
  'customer_email',     // 客戶Email
  'customer_phone',     // 客戶電話
  'check_in_date',      // 入住日期
  'check_out_date',     // 退房日期
  'room_type',          // 房型
  'total_amount',       // 總金額
  'paid_amount',        // 已付金額
  'payment_status',     // 付款狀態 (pending/paid/cancelled)
  'booking_status',     // 訂房狀態 (confirmed/checked_in/checked_out/cancelled)
  'coupon_used',        // 使用的優惠券
  'discount_amount',    // 折扣金額
  'commission_rate',    // 佣金比例
  'commission_amount',  // 佣金金額
  'commission_status',  // 佣金狀態 (pending/calculated/paid)
  'booking_source',     // 訂房來源 (website/line/phone)
  'special_requests',   // 特殊需求
  'created_at',         // 創建時間
  'updated_at'          // 更新時間
];

/**
 * 4. Payouts 表 - 佣金結算記錄
 */
const PAYOUTS_HEADERS = [
  'payout_id',          // 結算ID
  'partner_code',       // 夥伴代碼
  'payout_period',      // 結算期間 (例：2025-01)
  'total_commission',   // 總佣金
  'booking_count',      // 訂房筆數
  'payout_method',      // 付款方式 (bank_transfer/cash/accommodation_credit)
  'bank_account',       // 銀行帳戶 (如適用)
  'payout_status',      // 結算狀態 (pending/processing/completed/failed)
  'payout_date',        // 付款日期
  'receipt_number',     // 收據號碼
  'tax_amount',         // 稅額
  'net_amount',         // 實付金額
  'booking_ids',        // 相關訂房ID (JSON陣列)
  'notes',              // 備註
  'created_at',         // 創建時間
  'updated_at'          // 更新時間
];

/**
 * 獎勵制度設定 (根據知音.txt內容)
 */
const REWARD_SYSTEM = {
  // 啟動儀式獎勵
  FIRST_REFERRAL_BONUS: 1500, // 首次推薦額外獎勵 (住宿金)
  
  // 等級設定
  LEVELS: {
    'LV1_INSIDER': {
      name: '知音大使',
      english: 'The Insider',
      requirements: 0, // 免費加入
      rewards: {
        accommodation_credit: 1000, // 住宿金回饋
        cash_option: 500           // 現金回饋選項
      },
      upgrade_target: 4 // 年度4組客人可晉升
    },
    'LV2_GUIDE': {
      name: '森林嚮導', 
      english: 'The Guide',
      requirements: 4, // 年度4組客人
      upgrade_gift: '靜謐森林特色紀念信物',
      rewards: {
        accommodation_credit: 1200, // 住宿金回饋升級
        cash_option: 600           // 現金回饋升級
      },
      perks: ['品牌共創機會', '森友故事專欄主角'],
      upgrade_target: 10, // 年度10組客人可晉升
      annual_requirement: 3 // 次年需3組維持資格
    },
    'LV3_GUARDIAN': {
      name: '秘境守護者',
      english: 'The Guardian', 
      requirements: 10, // 年度10組客人
      upgrade_gift: '守護者之息客製香水',
      rewards: {
        accommodation_credit: 1500, // 住宿金回饋最高級
        cash_option: 800           // 現金回饋最高級
      },
      perks: [
        '年度森棲假期 (1晚平日及旺日通用住宿券)',
        '延遲退房1小時禮遇',
        '新境探索優先體驗權'
      ],
      annual_requirement: 6 // 次年需6組維持資格
    }
  }
};

/**
 * 初始化所有資料表
 */
function initializeAllSheets() {
  console.log('🚀 開始初始化 Google Sheets...');
  
  // 建立 Partners 表
  createSheet('Partners', PARTNERS_HEADERS);
  
  // 建立 Clicks 表
  createSheet('Clicks', CLICKS_HEADERS);
  
  // 建立 Bookings 表  
  createSheet('Bookings', BOOKINGS_HEADERS);
  
  // 建立 Payouts 表
  createSheet('Payouts', PAYOUTS_HEADERS);
  
  // 建立設定表
  createConfigSheet();
  
  console.log('✅ 所有資料表初始化完成！');
  console.log('📊 請將以下服務帳號Email加入 Google Sheets 編輯權限：');
  console.log(SERVICE_ACCOUNT.client_email);
}

/**
 * 建立單一資料表
 */
function createSheet(sheetName, headers) {
  console.log(`📝 建立 ${sheetName} 表...`);
  // 實際實作時會使用 Google Sheets API
  console.log(`Headers: ${headers.join(', ')}`);
}

/**
 * 建立系統設定表
 */
function createConfigSheet() {
  const configData = [
    ['設定項目', '設定值', '說明'],
    ['REWARD_SYSTEM', JSON.stringify(REWARD_SYSTEM), '獎勢制度設定'],
    ['GITHUB_PAGES_URL', 'https://didi1119.github.io/forest-gift-v1', 'GitHub Pages 網址'],
    ['LINE_COUPON_URL', 'https://line.me/R/ti/p/@forest.house', 'LINE 優惠券連結'],
    ['CURRENT_VERSION', '1.0.0', '系統版本'],
    ['LAST_UPDATED', new Date().toISOString(), '最後更新時間']
  ];
  
  console.log('⚙️ 建立系統設定表...');
  console.log('Config data:', configData);
}

// 執行初始化
if (typeof module !== 'undefined') {
  module.exports = {
    initializeAllSheets,
    REWARD_SYSTEM,
    SERVICE_ACCOUNT
  };
} else {
  // 瀏覽器環境下直接執行
  initializeAllSheets();
}