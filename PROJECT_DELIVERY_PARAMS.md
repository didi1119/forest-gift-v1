# 靜謐森林知音計畫 - 專案交付參數清單

## 📋 部署前必需參數

根據 Project Board 要求，以下參數需要在正式部署前提供並設定完成：

---

## 1. GitHub Pages 網址設定

### 主要網域
- **最終 Domain**：`https://forest-ambassador.github.io` （待確認實際網域）
- **備選自訂網域**：`https://知音計畫.forest-house.com` （如需要）

### 檔案結構確認
```
根目錄/
├── index.html                 # 主要體驗頁面
├── inner_map.html            # 內心地圖手冊
├── music.html                # 音樂播放清單  
├── story.html                # 品牌故事頁面
├── admin-dashboard.html      # 管理儀表板
├── link-generator.html       # 夥伴連結產生器
├── policy.html               # 隱私政策
├── affiliate-terms.html      # 聯盟條款
├── feature-flags.js          # 功能旗標系統
└── DEMO_QUICK_TEST.html      # 功能演示頁面
```

---

## 2. Apps Script Web App URL

### 部署資訊
- **專案名稱**：「靜謐森林知音計畫」
- **Web App URL 格式**：`https://script.google.com/macros/s/{SCRIPT_ID}/exec`
- **需要更新的檔案**：
  - `link-generator.html` 第 132 行
  - `inner_map.html` 第 313 行（註解中）

### 權限設定
- **執行身分**：我（開發者帳號）
- **存取權限**：任何人
- **允許匿名存取**：是

### 必需 Apps Script 檔案
1. **Code.gs** （來自 `apps-script-main.js`）
2. **aggregation.gs** （來自 `apps-script-aggregation.js`）

---

## 3. GA4 Property 設定

### Analytics 配置
- **Property ID**：`G-XXXXXXXXXX` （待取得實際 ID）
- **需要更新的檔案**：
  - `index.html` 第 9、343、351 行
  - `inner_map.html` 第 9、258 行

### 自訂維度設定
| 維度名稱 | 參數名稱 | 範圍 | 說明 |
|---------|----------|------|------|
| 推薦來源 | subid | 事件 | 夥伴推薦代碼 |

### 目標事件設定
建議設定為轉換事件：
- `card_draw` - 抽卡互動
- `journal_submit` - 週記提交
- `line_click` - LINE 點擊  
- `booking_intent` - 訂房意圖

---

## 4. LINE 優惠券深層連結

### 連結格式範例
- **一般格式**：`https://line.me/R/ti/p/%40foresthouse`
- **帶優惠券參數**：`https://line.me/R/ti/p/%40foresthouse?openExternalBrowser=1&coupon=${coupon_code}`
- **深層連結**：`line://ti/p/%40foresthouse/coupon/${coupon_code}`

### 需要提供的資訊
- [ ] LINE Official Account ID
- [ ] 優惠券兌換頁面 URL
- [ ] 參數傳遞格式
- [ ] 是否需要開啟外部瀏覽器

---

## 5. Google Sheets 與 Service Account

### Google Sheets 設定
- **試算表名稱**：「靜謐森林知音計畫資料庫」
- **表格數量**：5 個分頁
  - Affiliate Master (16 欄位)
  - Clicks Log (6 欄位)  
  - Bookings (14 欄位)
  - Payouts (9 欄位)
  - Journals (5 欄位)

### Service Account 設定
- **金鑰檔案位置**：需提供 JSON 金鑰檔案路徑
- **權限範圍**：Google Sheets API
- **共用設定**：需將 Service Account 電子郵件加入試算表編輯者

### 需要更新的設定
- `setup-sheets.js` 中的 `keyFilename` 路徑
- Apps Script 中的 `SPREADSHEET_ID`

---

## 6. 夥伴初始名單

### 資料格式
```csv
partner_code,name,email,coupon_code
FOREST_001,王小明,wang@example.com,HEALING_WANG2025
FOREST_002,李小華,li@example.com,HEALING_LI2025
FOREST_003,張小美,zhang@example.com,HEALING_ZHANG2025
```

### 欄位說明
- **partner_code**：唯一夥伴代碼（必填，用於追蹤）
- **name**：夥伴姓名（顯示用）
- **email**：聯繫信箱（通知用）
- **coupon_code**：專屬優惠券代碼（可選）

---

## 7. 其他配置參數

### 觸發器設定（Apps Script）
- **夜間彙整觸發器**：
  - 類型：時間驅動
  - 頻率：每日
  - 時間：凌晨 3:00-4:00
  - 函式：`dailyAggregation`

### 安全性設定
- **允許的推薦來源域名**：
  - `https://forest-ambassador.github.io`
  - `https://知音計畫.forest-house.com`
  - 其他授權的推廣平台

### 效能設定
- **GA4 取樣率**：100%（開發階段）→ 20%（生產環境）
- **localStorage 過期時間**：30 天
- **Apps Script 執行逾時**：6 分鐘

---

## 📋 部署檢查清單

### 必須完成的設定項目

#### Google Analytics
- [ ] 建立 GA4 Property 並取得 Measurement ID
- [ ] 設定自訂維度 `subid`
- [ ] 更新所有 HTML 檔案中的 `G-XXXXXXXXXX`
- [ ] 測試即時報表是否收到事件

#### Apps Script
- [ ] 建立新的 Apps Script 專案
- [ ] 上傳 main 和 aggregation 程式碼
- [ ] 部署為 Web App 並取得執行 URL
- [ ] 更新 link-generator.html 中的 APPS_SCRIPT_URL
- [ ] 設定每日觸發器
- [ ] 測試 GET/POST 請求處理

#### Google Sheets
- [ ] 執行 `node setup-sheets.js` 建立表格
- [ ] 建立 Service Account 並下載金鑰
- [ ] 設定 Sheets 權限給 Service Account
- [ ] 測試資料寫入功能
- [ ] 匯入初始夥伴資料

#### GitHub Pages
- [ ] 上傳所有檔案到 GitHub Repository
- [ ] 啟用 GitHub Pages
- [ ] 設定自訂網域（如需要）
- [ ] 測試所有頁面可正常存取

#### LINE 整合
- [ ] 取得 LINE Official Account 資訊
- [ ] 設定優惠券兌換流程
- [ ] 更新 Apps Script 中的 LINE 重導向 URL
- [ ] 測試 LINE 導流功能

---

## 🚨 特別注意事項

### 安全性
- Service Account 金鑰檔案不得上傳到公開 Repository
- Apps Script 需設定適當的執行權限
- 確保所有外部 API 呼叫都有錯誤處理

### 效能
- 大量點擊時 Apps Script 可能需要排隊處理
- GA4 事件上報可能有延遲，建議使用即時報表驗證
- localStorage 在無痕模式下會被清除

### 相容性  
- 確保在主要瀏覽器中測試：Chrome、Safari、Firefox、Edge
- 手機版本的響應式設計確認
- 確保 JavaScript 功能在較舊瀏覽器中有降級處理

---

## 📞 技術支援聯絡

如在設定過程中遇到問題，請檢查以下順序：

1. **檔案路徑問題**：確認所有相對路徑正確
2. **權限問題**：檢查 Service Account 和 Apps Script 權限  
3. **API 配額**：確認 Google API 使用量未超限
4. **網域問題**：確認 CORS 設定和允許的 Referrer

**系統現況**：所有程式碼已開發完成並通過 UAT 測試，僅需完成上述參數配置即可正式上線。