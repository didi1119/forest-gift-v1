# 靜謐森林知音計畫 — 技術交接文件

> 本文件提供完整的專案背景、架構、實作現況與待辦事項，供未來開發主管全面掌握。
>
> 最後更新：2026-03-20 ｜ 分支：`main`（332 commits）

---

## 一、專案概述

### 1.1 商業目標

「知音計畫」是台灣南投精品住宿品牌「靜謐森林」的**品牌大使推薦系統**。核心策略：

1. 提供**免費數位禮物包**（音樂、七日手冊、神諭卡、品牌故事）吸引訪客
2. 品牌大使分享專屬連結 → 追蹤推薦來源 → 轉化為實際住宿訂房
3. 以**三級獎勵制度 + 住宿金/現金雙軌**激勵大使持續推薦
4. 透過 **LINE Official Account** 發放優惠券，串接推薦歸因

### 1.2 使用者角色與入口

| 角色 | 說明 | 入口頁面 |
|------|------|---------|
| **訪客** | 透過大使連結進入，體驗禮物包 | `frontend/index.html?subid=XXX` |
| **潛在大使** | 想加入計畫的人 | `frontend/invitation.html`（申請表單）|
| **大使（夥伴）** | 已核准的推廣者，追蹤績效 | `frontend/partner-login.html` → `partner-dashboard.html` |
| **管理員** | 靜謐森林營運方 | `frontend/admin/admin-dashboard-real.html` |

### 1.3 獎勵制度

| 等級 | 名稱 | 住宿金 | 現金 | 升級條件 | 維持條件 |
|------|------|--------|------|---------|---------|
| LV.1 | 知音大使 (Insider) | $1,000 | $500 | 初始等級 | — |
| LV.2 | 森林嚮導 (Guide) | $1,200 | $600 | 年度 4 組成功 | 年度 3 組 |
| LV.3 | 秘境守護者 (Guardian) | $1,500 | $750 | 年度 10 組成功 | 年度 6 組 |

**首次推薦獎勵：** LV1 專屬，第一次成功推薦額外 +$1,500 住宿金。

**核心規則：**
- 「實際入住才計獎」— 只有 `stay_status = COMPLETED` 才觸發佣金
- 大使可選擇 `commission_preference`：ACCOMMODATION（住宿金）或 CASH（現金）
- 住宿金可 2:1 轉換現金（$2,000 住宿金 → $1,000 現金）
- 結算週期：每季（4/15、7/15、10/15、1/15），現金最低起付 $1,000

---

## 二、系統架構

### 2.1 架構總覽

```
訪客 / 大使
    │
    ├── 前端頁面（GitHub Pages 靜態託管）
    │     ├── frontend/index.html     ← 禮物包主頁
    │     ├── frontend/invitation.html ← 大使申請
    │     ├── frontend/partner-*.html  ← 大使登入 & 儀表板
    │     └── frontend/admin/*         ← 管理後台（10+ 頁面）
    │
    ├── API（Vercel Serverless Function）
    │     └── /api → api/index.js → api/_lib/backend.js
    │                                    │
    │              ┌─────────────────────┘
    │              │ DATA_BACKEND 環境變數切換
    │              ├── sheets-adapter.js → Google Sheets
    │              └── supabase-adapter.js → Supabase (PostgreSQL)
    │
    └── LINE Official Account
          ├── Webhook → api/index.js（LINE 簽名驗證）
          ├── Line_Coupon_Bindings（大使 ↔ 優惠券對應）
          └── Line_Referral_Claims（LINE 用戶歸因追蹤）
```

### 2.2 技術棧

| 層級 | 技術 | 說明 |
|------|------|------|
| **前端** | HTML5 + Tailwind CSS (CDN) + Vanilla JS (ES6+) | 零 build 步驟 |
| **API** | Vercel Serverless Function (Node.js) | 單一入口 `/api`，action-based 路由 |
| **資料庫 A** | Google Sheets（主要） | 透過 googleapis JWT 存取，8 個工作表 |
| **資料庫 B** | Supabase PostgreSQL（備用/遷移中） | 透過 @supabase/supabase-js |
| **短網址** | reurl.cc（主）/ is.gd（備） | 大使連結縮短 |
| **通訊** | LINE Official Account (@478hisen) | 優惠券發放 + Webhook 歸因 |
| **前端託管** | GitHub Pages | `didi1119.github.io/forest-gift-v1` |
| **API 託管** | Vercel | `forest-ambassador.vercel.app` |
| **分析** | Google Analytics 4 | 已預埋程式碼，待啟用 |
| **圖表** | Chart.js (CDN) | 管理後台分析圖表 |

### 2.3 API 路由設計

所有 API 集中在 `POST /api`，透過 `action` 欄位分派：

**公開操作（不需 admin_secret）：**

| action | 說明 |
|--------|------|
| `verify_partner_login` | 大使登入驗證（Email/代碼 + 手機末 4 碼） |
| `get_partner_dashboard_data` | 大使儀表板資料 |
| `submit_application` | 提交大使申請 |
| `shorten_url` | 短網址代理（reurl.cc / is.gd） |

**管理員操作（需 admin_secret）：**

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
| `use_accommodation_points` | 使用住宿金（別名：`deduct_accommodation_points`） |
| `cancel_accommodation_usage` | 取消住宿金使用記錄 |
| `convert_points_to_cash` | 住宿金轉現金（2:1） |
| `revert_cash_to_points` | 現金轉回住宿金 |
| `create_payout` | 建立結算記錄 |
| `update_payout` | 更新結算記錄 |
| `cancel_payout` | 取消結算（7 天寬限期） |
| `process_payout` | 處理結算（銀行匯款確認） |
| `get_all_data` | 取得全部資料（別名：`get_dashboard_data`） |
| `get_click_stats` | 取得點擊統計 |
| `get_applications` | 取得所有大使申請 |
| `review_application` | 審核大使申請（核准/駁回） |
| `promote_to_partner` | 將申請人轉為正式大使 |
| `sync_line_claim_profiles` | 同步 LINE 用戶歸因資料 |

**點擊追蹤（GET）：** `/api?ref=XXX` 或 `?pid=XXX` → 記錄點擊 + 跳轉。

---

## 三、資料庫 Schema（8 個資料表）

### 3.1 Partners（大使主檔）— 55 欄

**核心欄位：**

| 欄位 | 類型 | 說明 |
|------|------|------|
| `partner_code` | TEXT UNIQUE | 唯一識別碼（如 WANG001） |
| `name`, `email`, `phone` | TEXT | 基本資料 |
| `level` | TEXT | LV1_INSIDER / LV2_GUIDE / LV3_GUARDIAN |
| `commission_preference` | TEXT | ACCOMMODATION / CASH |
| `total_commission_earned` | NUMERIC | 累計佣金（歷史紀錄，只增不減） |
| `pending_commission` | NUMERIC | 待付現金 |
| `available_points` | NUMERIC | 可用住宿金餘額 |
| `points_used` | NUMERIC | 累計已使用住宿金 |
| `total_successful_referrals` | INTEGER | 累計成功推薦數 |
| `yearly_referrals` | INTEGER | 本年度成功推薦數 |
| `landing_link`, `coupon_link` | TEXT | 專屬長連結 |
| `short_landing_link`, `short_coupon_link` | TEXT | reurl.cc 短連結 |
| `bank_name`, `bank_code`, `bank_branch`, `bank_account_name`, `bank_account` | TEXT | 銀行帳戶資訊 |

**金額一致性公式：**
```
available_points = Σ 住宿金佣金 - points_used + 退款 + 手動調整
pending_commission = Σ 現金佣金 + 轉換金額 - 已匯款 + 調整
total_commission_earned = Σ 所有佣金（歷史，不減少）
```

### 3.2 Bookings（訂房記錄）— 26 欄

| 欄位 | 說明 |
|------|------|
| `partner_code` | 推薦大使 |
| `guest_name`, `guest_phone`, `guest_email` | 房客資訊 |
| `checkin_date`, `checkout_date`, `room_price` | 住宿資訊 |
| `booking_source` | REFERRAL / SELF_USE / DIRECT |
| `stay_status` | PENDING / COMPLETED / CANCELLED / NO_SHOW |
| `payment_status` | UNPAID / PENDING / PAID / REFUNDED |
| `commission_status` | PENDING / NOT_ELIGIBLE / CALCULATED / PAID / REVERSED |
| `commission_amount`, `commission_type` | 佣金金額與類型 |
| `is_first_referral_bonus`, `first_referral_bonus_amount` | 首推獎勵 |
| `line_user_id`, `line_display_name` | LINE 歸因 |
| `attribution_source`, `attribution_entered_code` | 歸因來源 |

### 3.3 Payouts（結算記錄）— 不可變審計日誌

| 欄位 | 說明 |
|------|------|
| `partner_code` | 大使代碼 |
| `payout_type` | ACCOMMODATION / CASH / REVERSAL / ADJUSTMENT / CONVERSION 等 |
| `amount` | 金額 |
| `payout_status` | PENDING / COMPLETED / FAILED |
| `payout_method` | BANK_TRANSFER / ACCOMMODATION_VOUCHER |
| `bank_transfer_date`, `bank_transfer_reference` | 匯款資訊 |
| `related_booking_ids` | 關聯的訂房 ID |

**審計原則：** Payouts 記錄一旦創建**不可修改或刪除**，所有金額變動都必須有對應記錄。

### 3.4 其他資料表

| 資料表 | 用途 |
|--------|------|
| `Accommodation_Usage` | 住宿金使用記錄（扣款、轉換） |
| `Clicks` | 點擊追蹤（含 UTM、IP、UA） |
| `Applications` | 大使申請（PENDING → APPROVED / REJECTED） |
| `Line_Coupon_Bindings` | 大使 ↔ LINE 優惠券對應關係 |
| `Line_Referral_Claims` | LINE 用戶領取優惠券 → 歸因到大使 |

---

## 四、檔案結構

```
forest-gift-v1/                          ← GitHub repo root
├── index.html                           ← 根目錄跳轉 → frontend/index.html
├── apply.html                           ← 申請跳轉頁
├── vercel.json                          ← API 路由 + CORS 設定
├── package.json                         ← 依賴：supabase-js, dotenv, googleapis
├── .env.local                           ← 環境變數（⚠️ 不應進版控）
│
├── api/                                 ← Vercel Serverless Function
│   ├── index.js                         ← 單一入口（65 行）
│   └── _lib/
│       ├── backend.js                   ← 核心商業邏輯（41,000+ 行）
│       ├── config.js                    ← 常數、佣金率、DataModels 定義
│       ├── sheets.js                    ← Google Sheets API 封裝
│       ├── data-adapter.js              ← 資料層抽象（切換 Sheets/Supabase）
│       └── adapters/
│           ├── sheets-adapter.js        ← Google Sheets 實作
│           └── supabase-adapter.js      ← Supabase 實作
│
├── frontend/                            ← 前端頁面
│   ├── index.html                       ← 主頁：禮物包 + 神諭卡占卜
│   ├── music.html                       ← 音樂播放清單（10 首）
│   ├── inner_map.html                   ← 七日內心地圖手冊
│   ├── story.html                       ← 品牌創辦故事
│   ├── invitation.html                  ← 大使招募 + 申請表單
│   ├── partner-login.html               ← 大使登入
│   ├── partner-dashboard.html           ← 大使績效儀表板
│   ├── policy.html                      ← 隱私政策
│   ├── images/                          ← 前端圖片資源
│   └── admin/                           ← 管理後台
│       ├── admin-dashboard-real.html    ← 主控台（7,800+ 行）
│       ├── link-generator-form.html     ← 連結生成器
│       ├── manual-checkin-confirm.html  ← 入住確認
│       ├── manual-booking.html          ← 手動訂房（跳轉頁）
│       ├── application-review-dashboard.html ← 申請審核
│       ├── analytics-dashboard.html     ← 分析儀表板
│       ├── commission-audit.html        ← 佣金審計
│       ├── resources.html               ← 管理資源入口
│       ├── admin-auth.js                ← 管理員認證（簡易密碼）
│       ├── commission-management.js     ← 佣金操作模組
│       ├── payout-functions.js          ← 結算操作模組
│       ├── test-coupon-flow.html        ← 優惠券流程測試
│       ├── test-shorturl.html           ← 短網址測試
│       ├── comprehensive-test-suite.html ← 綜合測試
│       └── field-mapping-test.html      ← 欄位映射測試
│
├── backend/
│   ├── apps-script-integrated-v5-complete.js ← Google Apps Script 版本（已棄用）
│   └── archive/                         ← 歷史版本 v2-v4
│
├── setup/
│   ├── supabase-schema.sql              ← 完整 Supabase Schema
│   ├── 2026-03-18-*.sql                 ← 資料庫 Migration 檔
│   ├── 2026-03-19-*.sql
│   ├── 2026-03-20-*.sql
│   ├── migrate-sheets-to-supabase.js    ← Sheets → Supabase 遷移腳本
│   └── sync-supabase-to-sheets.js       ← 雙向同步腳本
│
├── test/
│   ├── README.md                        ← 測試指南
│   ├── core/test-framework.js           ← 測試框架
│   └── suites/                          ← 8 個測試套件（30+ 測試案例）
│
├── e2e/live/scripts/                    ← 16 個 E2E 自動化腳本（Playwright）
├── cards/                               ← 60 張 SVG 神諭卡
└── docs/                                ← 補充文件
```

---

## 五、核心業務流程

### 5.1 大使加入流程

```
訪客 → invitation.html 填寫申請 → POST submit_partner_application
    → Applications 表新增 PENDING 記錄
    → 管理員在 application-review-dashboard.html 審核
    → approve_application → 自動建立 Partners 記錄 + 生成 partner_code
    → 管理員用 link-generator-form.html 產生專屬連結 + 短網址
    → 大使收到連結，用 partner-login.html 登入
    → partner-dashboard.html 查看績效、分享連結
```

### 5.2 訂房 → 佣金流程

```
房客透過大使連結進入 → subid/pid 記錄點擊（Clicks 表）
    → 房客訂房 → 管理員手動建立 Booking（create_booking）
       ├── 有 partner_code → REFERRAL，Partners.total_referrals += 1
       └── 無 → DIRECT
    → 房客入住完成 → 管理員確認（confirm_checkin）
       ├── 計算佣金 = COMMISSION_RATES[level][preference]
       ├── 首推獎勵？ → is_first_referral_bonus = true, +$1,500 住宿金
       ├── ACCOMMODATION → available_points += 佣金
       └── CASH → pending_commission += 佣金
       → 建立 Payout 審計記錄
       → Partners.total_successful_referrals += 1
       → 檢查升級條件（yearly_referrals >= 4 → LV2, >= 10 → LV3）
```

### 5.3 結算流程

```
管理員在 admin-dashboard 選擇大使 → process_payout
    → CASH 結算：pending_commission -= amount, 建立 COMPLETED Payout
    → ACCOMMODATION 結算：available_points -= amount, 建立 Usage 記錄
    → 銀行匯款後，更新 bank_transfer_date + bank_transfer_reference
```

### 5.4 LINE 優惠券歸因流程

```
大使分享 LINE 優惠券 → 訪客在 LINE 輸入優惠碼
    → LINE Webhook → api/index.js（驗證 LINE 簽名）
    → 查詢 Line_Coupon_Bindings 找到對應 partner_code
    → 建立 Line_Referral_Claims 記錄
    → 訂房時 attribution_source = 'LINE', line_user_id 寫入 Booking
```

---

## 六、認證機制

### 6.1 管理員認證

- **方式：** 瀏覽器 prompt 對話框要求輸入密碼
- **密碼：** `ADMIN_SECRET` 環境變數（目前為 `1499`）
- **驗證：** 每次 admin API 呼叫都帶 `admin_secret` 參數，server-side 驗證
- **儲存：** localStorage（`admin-auth.js`）

### 6.2 大使認證

- **方式：** Email 或 partner_code + 手機號碼末 4 碼
- **驗證：** `verify_partner_login` action，server-side 比對
- **儲存：** sessionStorage（`partnerCode`, `partnerData`, `loginTime`）
- **無 Token/JWT** — 純粹的 session-based

---

## 七、環境變數

### 7.1 必要環境變數（.env.local / Vercel Dashboard）

| 變數 | 說明 | 目前值 |
|------|------|--------|
| `ADMIN_SECRET` | 管理員密碼 | `1499` |
| `SUPABASE_URL` | Supabase 連線 URL | `https://myenmffxcufqigypwcjt.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase Service Role Key | （JWT Token） |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | GCP Service Account | （在 Vercel 設定） |
| `GOOGLE_PRIVATE_KEY` | GCP 私鑰 | （在 Vercel 設定） |

### 7.2 可選環境變數

| 變數 | 預設值 |
|------|--------|
| `GOOGLE_SHEETS_ID` | `1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4` |
| `DATA_BACKEND` | `sheets`（可切 `supabase`） |
| `GITHUB_PAGES_URL` | `https://forest-ambassador.vercel.app/frontend/index.html` |
| `DEFAULT_LINE_COUPON_URL` | `https://lin.ee/q38pqot` |
| `LINE_CHANNEL_ACCESS_TOKEN` | （LINE Webhook 用） |
| `LINE_CHANNEL_SECRET` | （LINE 簽名驗證） |

---

## 八、安全議題

### 8.1 已知風險（依嚴重度排序）

| 嚴重度 | 問題 | 位置 | 狀態 |
|--------|------|------|------|
| ~~高~~ | ~~reurl.cc API Key 暴露在前端~~ | ~~5 個 HTML 檔案~~ | ✅ **已修復**（2026-03-20）— 改用 `/api` 後端代理 `shorten_url` action |
| **高** | 管理後台無真正認證 | 所有 admin/*.html | 待改善 — 建議加入 Vercel Edge Middleware 或 OAuth |
| **中** | Admin 密碼只有 4 位數 | ADMIN_SECRET=1499 | 待改善 — 改用更強的密碼或 OAuth |
| **低** | 大使登入只用手機末 4 碼 | partner-login.html | 對當前規模足夠，但不建議擴大使用 |

### 8.2 PII 資料

系統收集並儲存：全名、Email、手機、銀行帳戶（帳號/戶名/分行）、LINE 用戶 ID。需確保符合台灣個資法。

---

## 九、目前已完成 vs 未完成

### 9.1 ✅ 已完成且運作中

| 功能 | 說明 |
|------|------|
| 禮物包主頁 | 4 大數位禮物 + 60 張神諭卡三卡占卜 |
| 大使申請流程 | 前台申請 → 後台審核 → 自動建帳 |
| 大使登入 & 儀表板 | 績效查看、短連結分享、銀行資料更新 |
| 完整訂房管理 | CRUD + 32 個可編輯欄位 + 取消回沖 |
| 佣金計算系統 | 3 級佣金率 + 首推獎勵 + 住宿金/現金雙軌 |
| 住宿金操作 | 使用住宿金、住宿金轉現金（2:1） |
| 結算管理 | 銀行匯款確認、結算歷史 |
| 佣金審計 | 自動偵測差異、一鍵修復 |
| LINE 優惠券整合 | 大使綁定優惠券 + Webhook 歸因 + 訂房關聯 |
| 等級升級 | 年度成功數自動觸發升級 |
| 分析儀表板 | 轉換率、營收、等級分布圖表 |
| E2E 測試 | 16 個自動化腳本覆蓋主要流程 |
| API 測試 | 8 個套件 30+ 測試案例 |
| 資料層抽象 | Sheets/Supabase 可切換 |
| SQL Migration | 4 個 migration 檔案 |

### 9.2 ⚠️ 待改善

| 項目 | 現況 | 建議 |
|------|------|------|
| `backend.js` 41,000+ 行 | 所有商業邏輯在單一檔案 | 拆分為模組（booking.js, commission.js, partner.js 等） |
| 管理後台認證 | 僅 4 位數密碼 prompt | OAuth 或 Edge Middleware |
| GA4 整合 | 程式碼已預埋但 Measurement ID 未啟用 | 建立 GA4 Property 並啟用 |
| 等級年度降級審核 | 升級已實作，但年度降級邏輯未確認是否完整 | 驗證 yearly_referrals 重設 + 降級觸發 |
| 無 CI/CD 自動化測試 | 測試需手動執行 | 加入 GitHub Actions 跑測試 |

### 9.3 ❌ 尚未實作

| 項目 | 說明 |
|------|------|
| 自動化備份 | Google Sheets / Supabase 定期備份 |
| 通知系統 | 佣金入帳通知、等級變更通知（Email/LINE） |
| 官網訂房自動同步 | 目前全部手動建立訂房 |
| 自動等級年度審核 | 每年 1 月自動觸發降級邏輯 |
| 收據/報表匯出 | 結算報表 PDF 匯出 |
| 多語言支援 | 目前僅中文 |

---

## 十、部署架構

### 10.1 目前部署

| 服務 | URL | 用途 |
|------|-----|------|
| **GitHub Pages** | `didi1119.github.io/forest-gift-v1` | 前端靜態頁面（main 分支） |
| **Vercel** | `forest-ambassador.vercel.app` | API Serverless Function |
| **Google Sheets** | Sheet ID: `1buMGx7T...` | 主要資料庫 |
| **Supabase** | `myenmffxcufqigypwcjt.supabase.co` | 備用/遷移中資料庫 |
| **LINE OA** | @478hisen | 優惠券 + Webhook |

### 10.2 雙分支問題（⚠️ 重要）

| 分支 | Commit 數 | 狀態 |
|------|-----------|------|
| `main` | 332 | **正式版** — 所有開發都在這裡 |
| `master` | 3 | 早期原型，已過時，應忽略或刪除 |

**GitHub Pages 部署的是 `main` 分支。** 確認 Vercel 也是連接到 `main`。

### 10.3 新環境部署步驟

```bash
# 1. Clone
git clone https://github.com/didi1119/forest-gift-v1.git
cd forest-gift-v1
git checkout main

# 2. 安裝依賴
npm install

# 3. 設定環境變數
cp .env.local .env.local.example  # 建立範本
# 編輯 .env.local 填入實際值

# 4. Vercel 部署
vercel login
vercel --prod
# 在 Vercel Dashboard 設定環境變數

# 5. Supabase 設定（如使用）
# 在 Supabase Dashboard 執行 setup/supabase-schema.sql
# 依序執行 setup/2026-03-18-*.sql ... 2026-03-20-*.sql

# 6. Google Sheets 設定（如使用）
# 建立 Service Account → 取得 email + private key
# 將 Service Account 加為 Sheets 編輯者

# 7. LINE Official Account 設定
# 取得 Channel Access Token + Channel Secret
# 設定 Webhook URL 為 Vercel API endpoint
```

---

## 十一、相關文件索引

| 文件 | 說明 |
|------|------|
| `COMMISSION-SYSTEM-ARCHITECTURE.md` | 佣金制度完整架構（660+ 行，最重要的商業文件） |
| `ADMIN-LINKS.md` | 所有管理後台 URL 清單 |
| `coupon-link-flow-explanation.md` | LINE 優惠券 6 步跳轉流程 |
| `docs/BOOKING_MANAGEMENT_FEATURES.md` | 訂房管理功能說明 |
| `docs/ORDER_EDIT_FEATURES.md` | 訂單編輯功能說明 |
| `docs/ID_SAFETY_GUIDE.md` | 資料完整性與 ID 安全指南 |
| `docs/VERIFIED-COMMISSION-SPEC.md` | 已驗證的佣金規格（2026-03-13） |
| `test/TEST_PLAN_ID.md` | ID 測試計畫與邊際案例 |
| `test/README.md` | API 測試框架使用指南 |

---

## 十二、聯繫資訊

| 項目 | 值 |
|------|---|
| GitHub Repo | https://github.com/didi1119/forest-gift-v1 |
| GitHub Pages | https://didi1119.github.io/forest-gift-v1 |
| Vercel 專案 | forest-ambassador.vercel.app |
| Google Sheets | `1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4` |
| Supabase 專案 | `myenmffxcufqigypwcjt.supabase.co` |
| GCP 專案 | foresthouse-468510 |
| LINE OA | @478hisen |
| reurl.cc | 需更換 API Key（已暴露） |

---

## 十三、架構決策紀錄

重大架構決策記錄於此，幫助未來開發者（包含 AI agent）理解「為什麼」。

### 2025 初期 — 從 Google Apps Script 遷移到 Vercel Serverless

**背景：** 初版後端使用 Google Apps Script，但遇到多項限制。
**決策：** 遷移到 Vercel Serverless Function（Node.js）。
**替代方案：** 繼續修補 GAS（放棄），使用 AWS Lambda（學習成本高），使用 Netlify Functions（曾嘗試，後放棄）。
**原因：**
1. GAS 有 CORS 限制，前端必須用 `form.submit()` 繞過，體驗差
2. GAS 執行時間限制 6 分鐘，不適合複雜佣金計算
3. GAS 無法整合 Supabase 等現代資料庫
4. GAS 缺乏本地開發環境，除錯困難
**影響：** `backend/` 整個目錄棄用，新後端在 `api/` 目錄。

### 2025 中期 — Google Sheets 為主、Supabase 為備

**背景：** 需要選擇資料庫方案。
**決策：** Google Sheets 為主要資料庫，Supabase PostgreSQL 為備用/未來遷移目標。
**原因：**
1. 業主已習慣在 Google Sheets 直接查看和手動編輯資料
2. 資料量小（數十位大使、數百筆訂房），Sheets 性能足夠
3. Supabase 提供 SQL 查詢能力，為未來規模化做準備
**影響：** 建立了 `data-adapter.js` 抽象層，透過 `DATA_BACKEND` 環境變數切換，所有 handler 不直接呼叫資料庫。

### 2026-03-20 — reurl.cc API Key 移到後端代理

**背景：** reurl.cc API Key 直接寫在 5 個前端 HTML 檔案中，任何人都能從瀏覽器 DevTools 取得。
**決策：** 在 `api/_lib/backend.js` 新增 `shorten_url` action 作為代理，前端改為呼叫 `/api`。
**替代方案：** 直接刪除短網址功能（不可行，大使連結需要短網址）、改用免費不需 key 的服務（穩定性差）。
**影響：** `partner-dashboard.html`、`link-generator-form.html`、`test-coupon-flow.html`、`test-shorturl.html`、`test-reurl-api.html` 全部改為呼叫 `/api` proxy。

### 2026-03-20 — 專案文件架構確立

**背景：** 經過 300+ 次 commit，累積 14+ 份 markdown、多份過時 GAS 文件，新進開發者無法分辨哪些是最新的。
**決策：** 確立三層文件架構：
1. `CLAUDE.md` — AI agent 的技術速覽入口（自動讀取）
2. `HANDOVER.md` — 人類開發者的完整交接文件（含商業背景和決策紀錄）
3. Memory 系統 — 跨對話的用戶偏好與反饋持久化
**影響：** 歸檔 `docs/APPLICATION_SYSTEM_SETUP.md`、`docs/COMPLETE_SYSTEM_GUIDE.md`、`link-generator-form-old.html` 至 `docs/archive/`。

---

> 此文件旨在讓接手的開發主管能在不詢問原作者的情況下，完全理解專案的現狀、架構決策與下一步方向。
>
> 最關鍵的商業邏輯在 `api/_lib/backend.js`（41,000+ 行）和 `COMMISSION-SYSTEM-ARCHITECTURE.md`。建議先讀後者理解規則，再讀前者理解實作。
>
> **給 AI Agent：** 請先讀 `CLAUDE.md` 取得技術架構速覽，再視需要讀本文件取得完整背景。修改守則和協作機制見 `CLAUDE.md` 最末的「Agent 協作守則」段落。
