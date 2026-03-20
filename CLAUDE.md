# 知音計畫 — 森林住宿大使推薦系統

## 專案概述

知音計畫是「靜謐森林」品牌的大使推薦系統，透過分級獎勵機制激勵大使推薦住宿體驗。系統包含完整的大使申請/審核、訂房追蹤、佣金計算、結算支付和 LINE 優惠券整合。

## 技術架構

### 前端
- **HTML5 + JavaScript (ES6+) + Tailwind CSS (CDN)**
- **Noto Sans TC / Noto Serif TC**（Google Fonts）
- **Chart.js**（管理後台圖表）
- **託管：GitHub Pages**（`didi1119.github.io/forest-gift-v1`）

### 後端 API
- **Vercel Serverless Function**（Node.js）
- **單一入口：** `POST /api`，透過 `action` 參數分派
- **託管：** `forest-ambassador.vercel.app`

### 資料庫（可切換）
- **Google Sheets**（主要，預設）— 透過 googleapis JWT Service Account
- **Supabase PostgreSQL**（備用）— 透過 `DATA_BACKEND=supabase` 環境變數切換
- **切換機制：** `api/_lib/data-adapter.js` → adapters/sheets-adapter 或 supabase-adapter

### 外部整合
- **LINE Official Account** (@478hisen) — Webhook 歸因 + 優惠券綁定
- **reurl.cc** — 短網址生成（API Key 應放在後端）
- **Google Analytics 4** — 事件追蹤（已預埋，待啟用）

## 專案結構

```
forest-gift-v1/
├── index.html                          # 根目錄跳轉 → frontend/index.html
├── apply.html                          # 申請跳轉頁
├── vercel.json                         # Vercel API 路由 + CORS
├── package.json                        # 依賴：supabase-js, dotenv, googleapis
│
├── api/                                # Vercel Serverless Function
│   ├── index.js                        # 單一入口（action 路由 + LINE Webhook）
│   └── _lib/
│       ├── backend.js                  # 核心商業邏輯（所有 action handler）
│       ├── config.js                   # 常數、佣金率、DataModels 定義
│       ├── sheets.js                   # Google Sheets API 封裝
│       ├── data-adapter.js             # 資料層抽象
│       └── adapters/
│           ├── sheets-adapter.js       # Google Sheets 實作
│           └── supabase-adapter.js     # Supabase 實作
│
├── frontend/
│   ├── index.html                      # 主頁：禮物包 + 神諭卡占卜
│   ├── music.html                      # 音樂播放清單
│   ├── inner_map.html                  # 七日內心地圖手冊
│   ├── story.html                      # 品牌創辦故事
│   ├── invitation.html                 # 大使招募 + 申請表單
│   ├── partner-login.html              # 大使登入
│   ├── partner-dashboard.html          # 大使績效儀表板
│   ├── policy.html                     # 隱私政策
│   └── admin/
│       ├── admin-dashboard-real.html   # 主控台（大使/訂房/結算/分析）
│       ├── link-generator-form.html    # 連結生成器
│       ├── manual-checkin-confirm.html # 入住確認
│       ├── manual-booking.html         # 手動訂房（跳轉頁）
│       ├── application-review-dashboard.html # 申請審核
│       ├── analytics-dashboard.html    # 分析儀表板
│       ├── commission-audit.html       # 佣金審計
│       ├── resources.html              # 管理資源入口
│       ├── admin-auth.js               # 管理員認證
│       ├── commission-management.js    # 佣金操作模組
│       └── payout-functions.js         # 結算操作模組
│
├── setup/
│   ├── supabase-schema.sql             # Supabase 完整 Schema
│   └── 2026-03-*.sql                   # Migration 檔案
│
├── test/                               # API 測試（8 套件 30+ 案例）
├── e2e/                                # E2E 自動化（16 腳本，Playwright）
├── cards/                              # 60 張 SVG 神諭卡
└── docs/                               # 補充文件
```

## API 端點

所有 API 統一為 `POST /api`，透過 `action` 參數分派：

### 管理員操作（需 admin_secret）

| action | 說明 |
|--------|------|
| `create_booking` | 建立訂房 |
| `update_booking` | 修改訂房（32 個可編輯欄位） |
| `delete_booking` | 取消訂房（含佣金回沖） |
| `confirm_checkin` | 確認入住完成（觸發佣金計算） |
| `process_payout` | 處理結算（銀行匯款確認） |
| `adjust_partner_commission` | 手動調整佣金 |
| `use_accommodation_points` | 使用住宿金 |
| `approve_application` | 核准大使申請 |
| `reject_application` | 駁回大使申請 |
| `save_partner_link` | 儲存大使連結 |
| `get_all_data` | 取得全部資料 |
| `get_analytics_data` | 取得分析數據 |
| `audit_commissions` | 佣金審計 |

### 大使/公開操作

| action | 說明 |
|--------|------|
| `verify_partner_login` | 大使登入（Email/代碼 + 手機末 4 碼） |
| `get_partner_dashboard_data` | 大使儀表板資料 |
| `submit_partner_application` | 提交大使申請 |
| `update_partner` | 大使更新自己的資料 |
| `convert_points_to_cash` | 住宿金轉現金（2:1） |
| `cancel_payout` | 大使取消結算（7 天寬限期） |

### 點擊追蹤

- `GET /api?ref=XXX` 或 `?pid=XXX`：記錄點擊 → 跳轉到主頁

## 核心商業規則

詳細規則見 `COMMISSION-SYSTEM-ARCHITECTURE.md`（最權威的商業文件）。

### 佣金制度

| 等級 | 住宿金 | 現金 | 升級條件 | 維持條件 |
|------|--------|------|---------|---------|
| LV1 知音大使 | $1,000 | $500 | 初始等級 | — |
| LV2 森林嚮導 | $1,200 | $600 | 年度 4 組成功 | 年度 3 組 |
| LV3 秘境守護者 | $1,500 | $750 | 年度 10 組成功 | 年度 6 組 |

- **首推獎勵：** LV1 首次成功推薦 +$1,500 住宿金
- **現金 = 住宿金 × 50%**
- **住宿金可轉現金：** 2:1 比率

### 金額一致性公式

```
available_points = Σ 住宿金佣金 - points_used + 退款 + 手動調整
pending_commission = Σ 現金佣金 + 轉換金額 - 已匯款 + 調整
total_commission_earned = Σ 所有佣金（歷史紀錄，只增不減）
points_used = 住宿金折抵 + 轉換現金的歷史總和
```

### Payouts 審計原則

- **不可變性：** Payout 記錄一旦創建，不可修改或刪除
- **完整性：** 所有金額變動必須有對應 Payout 記錄
- **可追溯性：** 包含管理員調整、系統計算等所有變動

## 資料表結構

### Partners（大使主檔）

核心欄位：`partner_code`(UNIQUE), `name`, `email`, `phone`, `level`, `commission_preference`, `total_commission_earned`, `pending_commission`, `available_points`, `points_used`, `total_successful_referrals`, `yearly_referrals`, `landing_link`, `coupon_link`, `short_landing_link`, `short_coupon_link`, `bank_name`, `bank_code`, `bank_branch`, `bank_account_name`, `bank_account`, `base_level_for_year`, `yearly_referrals_year`, `level_achieved_at`, `level_valid_until`

### Bookings（訂房記錄）

核心欄位：`partner_code`, `guest_name`, `guest_phone`, `checkin_date`, `checkout_date`, `room_price`, `booking_source`(REFERRAL/SELF_USE/DIRECT), `stay_status`(PENDING/COMPLETED/CANCELLED), `payment_status`, `commission_status`(PENDING/CALCULATED/PAID/REVERSED), `commission_amount`, `commission_type`, `is_first_referral_bonus`, `first_referral_bonus_amount`, `line_user_id`, `line_display_name`, `attribution_source`, `attribution_entered_code`

### Payouts（結算審計日誌，不可變）

`partner_code`, `payout_type`(ACCOMMODATION/CASH/REVERSAL/ADJUSTMENT/CONVERSION), `amount`, `payout_status`(PENDING/COMPLETED/FAILED), `payout_method`, `bank_transfer_date`, `bank_transfer_reference`, `related_booking_ids`

### 其他資料表

- **Accommodation_Usage** — 住宿金使用記錄
- **Clicks** — 點擊追蹤（含 UTM）
- **Applications** — 大使申請（PENDING → APPROVED/REJECTED）
- **Line_Coupon_Bindings** — 大使 ↔ LINE 優惠券對應
- **Line_Referral_Claims** — LINE 用戶歸因追蹤

完整 Schema 見 `setup/supabase-schema.sql`，欄位定義見 `api/_lib/config.js`。

## 環境變數

| 變數 | 必要 | 說明 |
|------|------|------|
| `ADMIN_SECRET` | ✅ | 管理員密碼 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ✅ | GCP Service Account |
| `GOOGLE_PRIVATE_KEY` | ✅ | GCP 私鑰 |
| `GOOGLE_SHEETS_ID` | — | 預設 `1buMGx7T...` |
| `DATA_BACKEND` | — | `sheets`(預設) 或 `supabase` |
| `SUPABASE_URL` | Supabase 時 | Supabase 連線 URL |
| `SUPABASE_SERVICE_KEY` | Supabase 時 | Supabase Service Key |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE 時 | LINE Webhook |
| `LINE_CHANNEL_SECRET` | LINE 時 | LINE 簽名驗證 |
| `DEFAULT_LINE_COUPON_URL` | — | 預設 `https://lin.ee/q38pqot` |

## 部署

- **前端：** GitHub Pages（`main` 分支，push 即部署）
- **API：** Vercel（連接同一 repo，自動部署）
- **環境變數：** 在 Vercel Dashboard → Settings → Environment Variables 設定

## 認證機制

- **管理員：** 瀏覽器 prompt 輸入密碼，API 每次帶 `admin_secret` 驗證
- **大使：** Email 或 partner_code + 手機末 4 碼，sessionStorage 存登入狀態

## 測試

- **API 測試：** `test/` 目錄，8 個套件 30+ 案例
- **E2E 測試：** `e2e/live/scripts/`，16 個 Playwright 腳本
- **手動測試：** `frontend/admin/comprehensive-test-suite.html`

## 關鍵文件

| 文件 | 說明 |
|------|------|
| `COMMISSION-SYSTEM-ARCHITECTURE.md` | 佣金制度完整規則（最權威） |
| `ADMIN-LINKS.md` | 所有管理後台 URL |
| `HANDOVER.md` | 完整技術交接文件 |
| `api/_lib/config.js` | 常數、佣金率、DataModels |
| `api/_lib/backend.js` | 核心商業邏輯 |

## 注意事項

- `backend/` 目錄為**已棄用的 Google Apps Script 版本**，僅供歷史參考
- 所有商業邏輯以 `COMMISSION-SYSTEM-ARCHITECTURE.md` 為準
- 修改佣金規則時，先更新文檔再改程式碼
- 測試發現問題時，先確認是邏輯錯誤還是實作錯誤

---

*最後更新：2026-03-20*
