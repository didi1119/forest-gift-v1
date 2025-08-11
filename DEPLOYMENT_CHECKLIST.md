# 靜謐森林知音計畫 - 部署準備清單

## 📋 部署前檢查清單

### 1. Google Analytics 4 設定
- [ ] 建立 GA4 Property 並取得 Measurement ID
- [ ] 更新以下檔案中的 `G-XXXXXXXXXX`：
  - [ ] `index.html` (第9行和第343、351行)
  - [ ] `inner_map.html` (第9行和第258行)
- [ ] 設定自訂維度 `subid`
- [ ] 測試事件追蹤是否正常

### 2. Google Apps Script 部署
- [ ] 新增 Google Apps Script 專案
- [ ] 上傳 `apps-script-main.js` 內容
- [ ] 上傳 `apps-script-aggregation.js` 內容 
- [ ] 部署為 Web App，取得執行 URL
- [ ] 更新 `link-generator.html` 第132行的 `YOUR_SCRIPT_ID`
- [ ] 設定定時觸發器（每日凌晨執行 aggregation）
- [ ] 測試 GET/POST 請求處理

### 3. Google Sheets 設定
- [ ] 執行 `node setup-sheets.js` 建立試算表
- [ ] 建立 Google Service Account 並下載 JSON 金鑰
- [ ] 將金鑰檔案路徑更新到相關檔案
- [ ] 授予 Service Account 試算表編輯權限
- [ ] 測試 API 連線與資料寫入

### 4. 檔案上傳與託管
- [ ] 選擇託管服務（Vercel/Netlify/GitHub Pages）
- [ ] 上傳所有 HTML/JS/CSS 檔案
- [ ] 設定自訂網域名稱（如需要）
- [ ] 設定 HTTPS 證書
- [ ] 測試所有頁面可正常存取

### 5. LINE 整合設定
- [ ] 取得 LINE 優惠券的深層連結
- [ ] 更新 Apps Script 中的重定向目標
- [ ] 測試 LINE 導流是否正常

### 6. 安全性檢查
- [ ] 確保 Google Service Account 金鑰不會暴露
- [ ] 檢查 Apps Script 權限設定
- [ ] 驗證跨域請求設定（CORS）
- [ ] 測試惡意輸入處理

### 7. 功能測試
- [ ] 端對端流程測試：點擊 → 轉址 → 記錄
- [ ] 不同 subid 值的追蹤測試
- [ ] 週記提交功能測試
- [ ] 抽卡系統正常運作測試
- [ ] Feature Flags 切換測試
- [ ] 跨裝置相容性測試

### 8. 資料驗證
- [ ] GA4 即時報表顯示事件
- [ ] Google Sheets 正確記錄點擊資料
- [ ] localStorage 資料持久化正常
- [ ] 夜間彙整程序正常執行

---

## 🔧 設定步驟詳解

### Google Analytics 4 設定步驟：
1. 前往 [Google Analytics](https://analytics.google.com)
2. 建立新的 Property
3. 選擇「網站」平台
4. 複製 Measurement ID (格式：G-XXXXXXXXXX)
5. 在「事件」→「轉換」中設定目標事件
6. 在「管理」→「自訂定義」中新增維度 `subid`

### Google Apps Script 部署步驟：
1. 前往 [Google Apps Script](https://script.google.com)
2. 建立新專案，命名為「靜謐森林知音計畫」
3. 將 `apps-script-main.js` 內容貼到 Code.gs
4. 新增檔案 `aggregation.js`，貼入 `apps-script-aggregation.js` 內容
5. 點擊「部署」→「新增部署作業」
6. 類型選擇「網路應用程式」
7. 執行身分選擇「我」，存取權選擇「任何人」
8. 複製 Web App URL

### Google Sheets 設定步驟：
1. 在 [Google Cloud Console](https://console.cloud.google.com) 建立專案
2. 啟用 Google Sheets API
3. 建立 Service Account 並下載 JSON 金鑰
4. 修改 `setup-sheets.js` 中的 `keyFilename` 路徑
5. 執行 `npm install google-spreadsheet`
6. 執行 `node setup-sheets.js`
7. 將產生的 Sheets ID 更新到其他檔案

---

## 🚀 部署後驗證清單

### 立即測試項目：
- [ ] 前往主頁：`https://你的網域.com`
- [ ] 測試推薦連結：`https://你的網域.com?subid=test123`
- [ ] 檢查 GA4 即時報表是否有資料
- [ ] 測試抽卡功能並確認事件追蹤
- [ ] 填寫週記並確認提交事件
- [ ] 檢查 Google Sheets 是否有新資料

### 管理功能測試：
- [ ] 前往夥伴連結產生器，建立測試夥伴
- [ ] 使用生成的連結測試轉址
- [ ] 檢查管理儀表板資料顯示
- [ ] 測試手動新增訂房記錄
- [ ] 測試結算管理功能

### 效能與相容性：
- [ ] 手機瀏覽器測試
- [ ] 桌面瀏覽器測試  
- [ ] 頁面載入速度檢查
- [ ] 離線狀態下的功能（localStorage）

---

## 📞 上線後監控重點

### 每日檢查：
- GA4 事件數量是否正常
- Google Sheets 資料更新狀況
- 夜間彙整程序執行結果

### 每週檢查：
- 推薦夥伴成效統計
- 系統錯誤日誌
- 使用者體驗反饋

### 每月檢查：
- 資料完整性稽核
- 安全性漏洞掃描  
- 效能最佳化評估

---

## 📝 緊急聯絡資訊

如遇到技術問題，請檢查以下項目：

1. **GA4 沒有資料**：檢查 Measurement ID 是否正確
2. **Apps Script 錯誤**：檢查權限設定和 Sheets ID
3. **夥伴連結無效**：檢查 Web App URL 和部署狀態
4. **資料同步問題**：檢查 Service Account 權限

系統已完成開發並通過 UAT 測試，準備進入生產環境部署階段。