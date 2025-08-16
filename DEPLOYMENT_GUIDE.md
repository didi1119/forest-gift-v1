# 🚀 部署指南 - Google Apps Script 更新

## 📋 部署前檢查清單

- [ ] 已備份 Google Sheets 資料
- [ ] 已準備好新版本的 `apps-script-commission-v2.js`
- [ ] 已記錄當前的部署 URL

---

## 📝 步驟一：開啟 Google Apps Script

1. **開啟 Google Sheets**
   - 打開你的資料庫：[Google Sheets 連結](https://docs.google.com/spreadsheets/d/1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4/edit)

2. **進入 Apps Script 編輯器**
   - 點擊上方選單：`擴充功能` → `Apps Script`
   - 或直接訪問：[script.google.com](https://script.google.com)

---

## 💾 步驟二：備份現有程式碼

1. **在 Apps Script 編輯器中**
   - 全選現有程式碼（Ctrl/Cmd + A）
   - 複製（Ctrl/Cmd + C）

2. **創建備份檔案**
   - 在本地創建檔案：`apps-script-backup-[今天日期].js`
   - 貼上備份內容

---

## 📤 步驟三：更新程式碼

1. **準備新程式碼**
   ```bash
   # 開啟新版本檔案
   open "/Users/kobe/Library/Mobile Documents/com~apple~CloudDocs/知音計畫/backend/apps-script-commission-v2.js"
   ```

2. **複製新程式碼**
   - 全選新版本內容（Ctrl/Cmd + A）
   - 複製（Ctrl/Cmd + C）

3. **在 Apps Script 編輯器中**
   - 全選舊程式碼（Ctrl/Cmd + A）
   - 貼上新程式碼（Ctrl/Cmd + V）
   - 儲存（Ctrl/Cmd + S）

---

## 🔄 步驟四：部署新版本

### 方法 A：更新現有部署（推薦）

1. **點擊「部署」按鈕**
   - 位於編輯器右上角
   - 選擇「管理部署」

2. **編輯現有部署**
   - 點擊鉛筆圖示「編輯」
   - 在「版本」下拉選單中選擇「新版本」
   - 添加描述：`修復ID生成、佣金計算、編輯功能`

3. **更新部署**
   - 點擊「更新」
   - URL 保持不變（重要！）

### 方法 B：創建新部署（如果需要）

1. **點擊「部署」→「新增部署」**

2. **設定部署類型**
   - 類型：選擇「網頁應用程式」
   - 描述：`ID自動生成修復版本`
   - 執行身份：`我`
   - 存取權限：`任何人`

3. **部署**
   - 點擊「部署」
   - 複製新的 URL

⚠️ **重要**：如果創建新部署，需要更新前端的 URL！

---

## ✅ 步驟五：驗證部署

1. **檢查部署狀態**
   ```
   部署 ID: [會顯示]
   網址: https://script.google.com/macros/s/[你的部署ID]/exec
   版本: [新版本號]
   ```

2. **測試 API**
   - 開啟管理後台
   - 打開瀏覽器開發者工具（F12）
   - 進入 Console 標籤
   - 重新載入頁面
   - 應該看到資料成功載入

---

## 🧪 步驟六：功能測試

### 測試 1：新建記錄（ID 生成）
1. 進入「手動訂房」
2. 創建測試訂單
3. 檢查 Google Sheets → Bookings 表格
4. **✅ A欄（ID）應該有數字**

### 測試 2：編輯功能
1. 找一筆訂單
2. 點擊編輯
3. 修改並儲存
4. **✅ 應該成功更新**

### 測試 3：佣金計算
1. 確認入住完成
2. 檢查 Partners 表格
3. **✅ 佣金只加到 total_commission_earned**

---

## 📊 Apps Script 日誌監控

1. **開啟執行記錄**
   - 在 Apps Script 編輯器
   - 點擊左側「執行項目」圖示
   - 查看最近的執行

2. **檢查日誌訊息**
   應該看到：
   - `生成新的 Booking ID: 1`
   - `生成新的 Partner ID: 1`
   - `生成新的 Payout ID: 1`

---

## 🔥 緊急回滾

如果出現問題：

1. **立即回滾**
   - 部署 → 管理部署
   - 編輯 → 版本 → 選擇上一個版本
   - 更新

2. **恢復備份程式碼**
   - 貼上之前備份的程式碼
   - 儲存並重新部署

---

## 📞 需要協助？

如果遇到問題：

1. **檢查錯誤訊息**
   - Apps Script 執行記錄
   - 瀏覽器 Console
   
2. **常見問題**
   - 權限問題：重新授權
   - URL 錯誤：檢查部署 URL
   - 資料錯誤：檢查 Google Sheets 格式

---

## 🎯 部署完成確認

- [ ] Apps Script 已更新
- [ ] 新版本已部署
- [ ] URL 正確（如果有變更）
- [ ] 新建記錄有 ID
- [ ] 編輯功能正常
- [ ] 佣金計算正確
- [ ] 沒有錯誤訊息

---

*部署時間：約 5-10 分鐘*
*建議：在用戶較少的時段進行部署*