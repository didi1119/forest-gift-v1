# 🚨 緊急修復指南 - 後端代碼錯誤

## 發現的關鍵問題

### 1. 變數名稱錯誤（已在本地修復）
在 `handleConvertPointsToCash` 函數中：
- ❌ 錯誤：使用了未定義的 `finalCashAmount`
- ✅ 正確：應該使用 `cashAmount`

### 2. 需要立即部署到 Google Apps Script

## 部署步驟

### 步驟 1：開啟 Google Apps Script
1. 訪問你的 Google Apps Script 專案
2. URL 應該類似：`https://script.google.com/d/[YOUR_SCRIPT_ID]/edit`

### 步驟 2：找到並修正錯誤
在 `handleConvertPointsToCash` 函數中（約第 1550-1620 行），找到並替換：

**錯誤的代碼：**
```javascript
amount: finalCashAmount,
notes: data.notes || `點數轉現金：${convertAmount} 點 → NT$ ${finalCashAmount} (${exchangeRate*2}:1)`,
message: `成功轉換 ${convertAmount} 點為 NT$ ${finalCashAmount}`,
cash_amount: finalCashAmount
```

**正確的代碼：**
```javascript
amount: cashAmount,
notes: data.notes || `點數轉現金：${convertAmount} 點 → NT$ ${cashAmount} (2:1)`,
message: `成功轉換 ${convertAmount} 點為 NT$ ${cashAmount}`,
cash_amount: cashAmount
```

### 步驟 3：部署新版本
1. 點擊「部署」→「新部署」
2. 選擇類型為「網頁應用程式」
3. 設定：
   - 說明：修復轉換現金變數錯誤
   - 執行身分：我
   - 誰可以存取：任何人
4. 點擊「部署」

### 步驟 4：更新 URL（如果有變更）
如果部署後 URL 有變更，需要更新前端所有使用的地方。

## 測試驗證

### 使用穩健測試套件
1. 開啟：https://didi1119.github.io/forest-gift-v1/backend/robust-test.html
2. 執行完整測試
3. 確認所有測試通過

### 預期結果
- ✅ 創建大使：成功
- ✅ 創建訂房：成功（使用表單提交）
- ✅ 確認入住：成功（佣金 2500 點）
- ✅ 使用住宿金：成功
- ✅ 轉換現金：成功（2000 點 → 1000 元）

## 其他發現的問題

### CORS 問題
- 原因：Google Apps Script 的 CORS 政策
- 解決：使用表單提交代替 fetch API
- 已在測試工具中實現

### 測試工具版本
確保使用最新版本：
- ❌ 舊版：complete-backend-test.html（可能有 CORS 問題）
- ✅ 新版：robust-test.html（使用表單提交）

## 完整的後端檔案

修復後的完整檔案位於：
`/Users/kobe/Library/Mobile Documents/com~apple~CloudDocs/知音計畫/backend/apps-script-integrated-v3.js`

## 緊急聯絡

如果遇到問題：
1. 檢查 Google Apps Script 的執行記錄
2. 使用診斷測試工具：diagnostic-test.html
3. 查看瀏覽器 Console 的錯誤訊息

---
*最後更新：2025-08-19*
*修復版本：v3.0.1*