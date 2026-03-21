# 知音計畫 — 森林住宿大使推薦系統

## ⚠️ 資料庫環境規則（AI Agent 必讀）

**嚴格區分正式與測試資料庫，禁止混用。**

| 環境 | Supabase URL | 憑證來源 | 用途 |
|------|-------------|---------|------|
| **正式（Production）** | `https://myenmffxcufqigypwcjt.supabase.co` | `.env.local` | 真實大使資料，禁止測試寫入 |
| **測試（Test）** | `https://actkgwfrpxyvunzicgmi.supabase.co` | `.env.test` | 開發/測試專用，可任意讀寫 |

**規則：**
- 進行任何測試、驗證 API、跑腳本時 → 一律使用 `.env.test` 的憑證
- 只有在確認要操作正式資料時，才使用 `.env.local`
- 若不確定，**預設用測試 DB**，不要預設用正式 DB
- Vercel 已設定：Production 分支 → 正式 DB；Preview/Development → 測試 DB（自動）

---

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
- **LINE Official Account** (@forest.house) — Webhook 歸因 + 優惠券綁定
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

### 公開操作（不需 admin_secret）

| action | 說明 |
|--------|------|
| `verify_partner_login` | 大使登入（Email/代碼 + 手機末 4 碼） |
| `get_partner_dashboard_data` | 大使儀表板資料 |
| `submit_application` | 提交大使申請 |
| `shorten_url` | 短網址代理（reurl.cc / is.gd） |

### 管理員操作（需 admin_secret）

| action | 說明 |
|--------|------|
| `create_booking` | 建立訂房 |
| `update_booking` | 修改訂房（32 個可編輯欄位） |
| `delete_booking` | 取消訂房（含佣金回沖） |
| `restore_booking` | 恢復已刪除的訂房 |
| `confirm_checkin_completion` | 確認入住完成（觸發佣金計算） |
| `partial_refund` | 部分退款 |
| `batch_cancel` | 批次取消多筆訂房 |
| `create_partner` | 建立大使記錄 |
| `update_partner` | 更新大使資料 |
| `update_partner_commission` | 手動調整佣金 |
| `use_accommodation_points` | 使用住宿金 |
| `deduct_accommodation_points` | 同上（別名） |
| `cancel_accommodation_usage` | 取消住宿金使用記錄 |
| `convert_points_to_cash` | 住宿金轉現金（2:1） |
| `revert_cash_to_points` | 現金轉回住宿金 |
| `create_payout` | 建立結算記錄 |
| `update_payout` | 更新結算記錄 |
| `cancel_payout` | 取消結算（7 天寬限期） |
| `process_payout` | 處理結算（銀行匯款確認） |
| `get_all_data` | 取得全部資料（管理後台） |
| `get_dashboard_data` | 同上（別名） |
| `get_click_stats` | 取得點擊統計 |
| `get_applications` | 取得所有大使申請 |
| `review_application` | 審核大使申請（核准/駁回） |
| `promote_to_partner` | 將申請人轉為正式大使 |
| `sync_line_claim_profiles` | 同步 LINE 用戶歸因資料 |

### 點擊追蹤（GET）

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
- **住宿金可轉現金：** 2:1 比率，最低 1,000 點，當季截止日前可撤回
- **結算週期：** 每季（4/15、7/15、10/15、1/15），最低起付 $500
- **季度截止日：** 3/31、6/30、9/30、12/31

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

## Agent 協作守則

本專案使用 AI agent（Claude Code 等）進行持續開發。以下規則確保不同 agent、不同對話之間保持一致性。

### 文件層級與信任順序

| 優先順序 | 文件 | 用途 | 更新頻率 |
|---------|------|------|---------|
| 1 | `CLAUDE.md`（本檔案） | Agent 進入專案的前門，技術架構速覽 | 每次架構變更時 |
| 2 | `COMMISSION-SYSTEM-ARCHITECTURE.md` | 佣金商業規則的單一真相來源 | 規則變更時 |
| 3 | `HANDOVER.md` | 完整交接文件（含商業脈絡、決策紀錄、已知問題） | 重大里程碑時 |
| 4 | `ADMIN-LINKS.md` | 管理後台 URL 清單 | 新增/移除頁面時 |
| 5 | `api/_lib/config.js` | 程式碼層級的常數與設定 | 隨程式碼變更 |

**規則：當文件之間有矛盾時，優先順序高的文件為準。**

### 修改守則（絕對禁止）

1. **不可刪除或修改 Payout 記錄** — Payouts 是不可變審計日誌
2. **不可在前端 HTML/JS 中放置 API Key** — 所有第三方 API 呼叫必須透過 `/api` 代理
3. **不可直接修改佣金金額常數** — 必須先更新 `COMMISSION-SYSTEM-ARCHITECTURE.md`，確認業務方同意後再改程式碼
4. **不可跳過 admin_secret 驗證** — 所有管理員 action 必須經過 server-side 驗證
5. **不可在版控中提交憑證** — `.env.local`、Service Account Key、API Key 等必須走環境變數

### 修改守則（強烈建議）

1. **改完程式碼後更新對應文件** — 特別是 CLAUDE.md 的專案結構和 API 端點表
2. **新增 API action 時** — 同步更新 CLAUDE.md 的 API 端點表和 HANDOVER.md
3. **重大決策寫入 HANDOVER.md 第十三節** — 記錄為什麼做這個決定，方便未來 agent 理解背景
4. **前端修改後跑 E2E 測試** — `e2e/live/scripts/` 有 16 個自動化腳本
5. **金額相關邏輯修改後** — 執行 `test/suites/` 中的佣金測試套件

### Agent 間的溝通管道

不同對話的 agent 透過以下機制保持一致：

```
┌─────────────────────────────────────────────┐
│              Agent 進入專案                    │
│                    │                          │
│     ┌──────────────┼──────────────┐          │
│     ▼              ▼              ▼          │
│  CLAUDE.md    HANDOVER.md    Memory 系統     │
│  (架構速覽)   (完整背景)    (偏好/反饋)       │
│     │              │              │          │
│     └──────────────┼──────────────┘          │
│                    ▼                          │
│            理解專案全貌後開始工作                │
│                    │                          │
│            完成後更新對應文件                    │
│                    │                          │
│     ┌──────────────┼──────────────┐          │
│     ▼              ▼              ▼          │
│  更新 CLAUDE.md  更新 HANDOVER.md  更新 Memory │
│  (如架構改變)   (如有重大決策)   (如學到偏好)    │
└─────────────────────────────────────────────┘
```

**CLAUDE.md** = 技術快速參考（每個 agent 自動讀取）
**HANDOVER.md** = 深度背景（需要理解「為什麼」時讀取）
**Memory 系統** = 用戶偏好與跨對話反饋（Claude Code 自動管理）

### 變更日誌格式

在 HANDOVER.md 第十三節記錄重大決策時，使用以下格式：

```markdown
### YYYY-MM-DD — 決策標題
**背景：** 為什麼需要做這個決定
**決策：** 最終選擇了什麼方案
**替代方案：** 考慮過但放棄的方案（及原因）
**影響：** 這個決策影響了哪些檔案/流程
```

---

*最後更新：2026-03-20*
