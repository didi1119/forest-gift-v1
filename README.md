# 靜謐森林知音計畫

> 一個充滿寧靜力量的品牌大使系統，讓每一次分享都成為內心的橋樑。

## 專案簡介

靜謐森林知音計畫是一個完整的品牌大使行銷系統，結合免費數位禮物體驗與夥伴推薦追蹤：

- **數位禮物包**：音樂、電子書、神諭卡、故事四大體驗
- **60 張神諭卡系統**：互動式三卡占卜（根→幹→冠）
- **推薦追蹤系統**：完整的 subid 追蹤 + GA4 分析
- **三級獎勵制度**：知音大使 → 森林嚮導 → 秘境守護者
- **管理後台**：訂房管理、結算管理、夥伴總覽

### 數位體驗

- **禮物一**：《內在森林的回響》音樂播放清單
- **禮物二**：《內心地圖繪製手冊》七日互動指南
- **禮物三**：世界樹神諭卡占卜系統（60 張手繪 SVG）
- **禮物四**：靜謐森林品牌故事

## 目錄結構

```
forest-gift-v1/
├── index.html                  # 主頁面（數位禮物包 + 神諭卡占卜）
├── inner_map.html              # 七日內心地圖手冊
├── music.html                  # 音樂播放清單
├── story.html                  # 品牌故事
├── admin-dashboard.html        # 管理後台儀表板
├── link-generator.html         # 夥伴連結產生器
├── policy.html                 # 隱私政策
├── affiliate-terms.html        # 合作條款
├── introduction.html           # 介紹頁
├── create-sheets-database.html # Sheets 建立工具頁
├── setup-apps-script.html      # Apps Script 設定工具頁
│
├── apps-script-main.js         # Apps Script 主程式（doGet/doPost）
├── apps-script-aggregation.js  # Apps Script 夜間彙整程式
├── setup-sheets.js             # Google Sheets 五表初始化腳本
├── feature-flags.js            # 功能開關系統
│
├── js/
│   ├── config.js               # 集中設定常數
│   └── mock-backend.js         # Demo 模式用 mock 後端
│
├── api/                        # Vercel Functions（主要平台）
│   ├── create-ambassador.js
│   ├── get-ambassadors.js
│   └── track-performance.js
│
├── netlify/functions/          # Netlify Functions（備用）
├── cards/                      # 60 張 SVG 神諭卡
├── docs/                       # 詳細設定文件
│   ├── ga4-setup.md
│   └── uat-script.md
├── archive/                    # 歷史歸檔檔案
│
├── vercel.json                 # Vercel 部署設定（主要）
├── netlify.toml                # Netlify 部署設定（備用）
└── package.json
```

## 系統架構

```
使用者 → 靜態頁面（Vercel）→ Google Apps Script → Google Sheets
                ↓
           GA4 事件追蹤
                ↓
         管理後台（靜態頁面）→ Google Sheets（讀取）
```

| 層級 | 技術 | 說明 |
|------|------|------|
| 前端 | HTML5 + Tailwind CSS + Vanilla JS | 靜態頁面，無 build 步驟 |
| 後端 | Google Apps Script | GET 跳轉/點擊記錄、POST 週記儲存 |
| 資料庫 | Google Sheets | 五表結構（夥伴、點擊、訂房、結算、週記） |
| 部署 | Vercel（主）/ Netlify（備） | 靜態託管 + Serverless Functions |
| 分析 | Google Analytics 4 | 7 種自訂事件 + subid 維度 |
| 設計 | 森林綠 (#3A5A40) + 暖米色 | 思源黑體/宋體，Mobile-first |

---

## 部署指南

### 1. 部署靜態網站到 Vercel

**方式 A：Vercel CLI**

```bash
npm install -g vercel
vercel login
vercel --prod
```

**方式 B：GitHub 整合**

前往 [Vercel Dashboard](https://vercel.com/dashboard) → Add New Project → 連接 GitHub repo → Deploy。

### 2. 設定環境變數

在 Vercel Dashboard → 專案 → Settings → Environment Variables 設定：

| 變數名稱 | 說明 | 取得方式 |
|---------|------|---------|
| `GOOGLE_SHEET_ID` | Google Sheets ID | Sheets 網址中 `/d/{ID}/edit` |
| `GOOGLE_CLIENT_EMAIL` | Service Account Email | GCP Console → IAM → Service Accounts |
| `GOOGLE_PRIVATE_KEY` | Service Account 私鑰 | GCP Console → 建立金鑰 → JSON |

> `GOOGLE_PRIVATE_KEY` 需保留完整格式，包含 `-----BEGIN PRIVATE KEY-----` 和換行符。

### 3. 設定 Google Sheets

```bash
# 設定環境變數後執行
node setup-sheets.js
```

自動建立五個工作表：

| 工作表 | 欄位數 | 說明 |
|--------|--------|------|
| Affiliate Master | 21 | 夥伴主檔（含等級追蹤 LV1-LV3） |
| Clicks Log | 6 | 點擊記錄 |
| Bookings | 14 | 訂房記錄與狀態追蹤 |
| Payouts | 9 | 結算記錄 |
| Journals | 5 | 週記記錄 |

完成後，將 Service Account Email 加為 Google Sheets 編輯者。

### 4. 部署 Apps Script

1. 前往 [Google Apps Script](https://script.google.com) → 建立新專案
2. 將 `apps-script-main.js` 貼到 `Code.gs`
3. 新增 `aggregation.gs`，貼入 `apps-script-aggregation.js`
4. 部署 → 新增部署作業 → 網路應用程式
   - 執行身分：我
   - 存取權限：任何人
5. 複製 Web App URL → 更新到 `js/config.js` 的 `APPS_SCRIPT_URL`
6. 設定每日觸發器：函式 `dailyAggregation`，凌晨 3:00-4:00 執行

### 5. 設定 GA4

詳細步驟見 [docs/ga4-setup.md](docs/ga4-setup.md)。

取得 Measurement ID 後更新 `js/config.js` 中的 `GA4_MEASUREMENT_ID`。

自訂維度：`subid`（範圍：事件）
建議轉換事件：`card_draw`、`journal_submit`、`line_click`、`booking_intent`

### 6. 設定 LINE 優惠券連結

更新 `js/config.js` 中的 `DEFAULT_LINE_COUPON_URL` 為實際 LINE 連結。

### 部署前檢查清單

- [ ] 環境變數已設定（GOOGLE_SHEET_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY）
- [ ] Google Sheets 五表已建立，Service Account 有編輯權限
- [ ] Apps Script 已部署為 Web App，URL 已更新到 `js/config.js`
- [ ] GA4 已建立，Measurement ID 已更新，自訂維度 `subid` 已設定
- [ ] 每日觸發器已設定（dailyAggregation）
- [ ] LINE 優惠券連結已更新
- [ ] 所有頁面可正常存取
- [ ] 推薦追蹤測試通過（?subid=test123）

---

## 獎勵制度

| 等級 | 名稱 | 獎勵 | 晉升條件 |
|------|------|------|---------|
| LV.1 | 知音大使 (Insider) | NT$1,000 住宿金 或 NT$500 現金 | 免費加入 |
| LV.2 | 森林嚮導 (Guide) | NT$1,200 住宿金 或 NT$600 現金 | 年度 4 組成功推薦 |
| LV.3 | 秘境守護者 (Guardian) | NT$1,500 住宿金 或 NT$800 現金 | 年度 10 組成功推薦 |

核心規則：**「實際入住才計獎」**— 只有 `stayed_completed` 狀態的訂房計入 `eligible_conversions`。

等級追蹤欄位：`current_level`、`level_achieved_at`、`level_valid_until`、`current_year_successes`、`last_level_review_year`。

## 神諭卡系統

60 張手繪 SVG 卡片分為三大類：
- **天語**（12 張）：季節與天氣的智慧
- **地籟**（24 張）：大地與自然的指引
- **心鑰**（24 張）：內在成長的鑰匙

占卜方式：三卡布局（根→幹→冠），每張卡提供鏡、語、徑、影四面向解讀。

## Feature Flags

透過 `feature-flags.js` 可開關功能：

| Flag | 說明 |
|------|------|
| `ENHANCED_TRACKING` | 增強追蹤模式 |
| `PERSONALIZED_GREETINGS` | 個人化歡迎訊息 |
| `JOURNAL_SYNC` | 週記同步功能 |
| `REWARD_NOTIFICATIONS` | 獎勵通知功能 |

## 常見問題

**Apps Script CORS 錯誤**
- 確認已部署為 Web App 且存取權限為「任何人」
- 檢查 `doOptions` handler 是否存在

**Google Sheets 連線失敗**
- 確認 Service Account 有編輯權限
- 檢查 `GOOGLE_PRIVATE_KEY` 格式（需保留換行符）

**頁面空白**
- 開啟 DevTools (F12) → Console 檢查錯誤
- 確認 `js/config.js` 已正確載入

**頁面路由不正確（Vercel）**
- 檢查 `vercel.json` 中的路由設定

## 相關文件

- [GA4 設定指南](docs/ga4-setup.md)
- [UAT 測試腳本](docs/uat-script.md)

---

> 在這個喧囂的時代，我們相信最好的連結來自於無所求的分享。每一份禮物都承載著我們想與您共同守護的寧靜。

*靜謐森林知音計畫 — 用心感受，用愛分享*
