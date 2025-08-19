# 快速修復說明

## 問題
你部署了新版本後出現錯誤：
```
未知的動作: get_dashboard_data
```

## 原因
前端使用 `get_dashboard_data` action，但新版本沒有處理這個 action。

## 解決方案
我已經更新了 `apps-script-integrated-v3.js`，添加了：

1. **支援 `get_dashboard_data`** - 現在 GET 和 POST 都支援這個 action
2. **所有缺少的處理函數**：
   - `handleUpdateBooking()` - 更新訂房
   - `handleDeleteBooking()` - 刪除訂房（含點數返還）
   - `handleUpdatePayout()` - 更新結算
   - `handleCancelPayout()` - 取消結算
   - `handleUpdatePartnerCommission()` - 更新大使佣金
   - `handleConvertPointsToCash()` - 轉換點數為現金

## 立即部署步驟

1. **複製更新的程式碼**
   - 打開 `apps-script-integrated-v3.js`
   - 全選並複製所有內容

2. **更新 Google Apps Script**
   - 在你的 Google Apps Script 編輯器中
   - 全選現有程式碼
   - 貼上新程式碼
   - 儲存（Ctrl+S 或 Cmd+S）

3. **重新部署**
   - Deploy → Manage Deployments
   - 編輯現有部署
   - 選擇 "New Version"
   - 點擊 "Update"

4. **測試**
   - 重新整理管理後台頁面
   - 應該能正常載入數據了

## 驗證成功
如果修復成功，你應該看到：
- 數據正常載入
- 沒有 "未知的動作" 錯誤
- 所有功能正常運作

## 主要改進
新版本的優勢：
1. **動態欄位映射** - 不再依賴硬編碼索引
2. **完整的錯誤處理** - 更好的錯誤訊息
3. **點數返還機制** - 刪除 SELF_USE 訂房時自動返還點數
4. **審計追蹤** - 所有操作都有 Payout 記錄

---

**如果還有問題，請檢查：**
1. Google Sheets 的表頭是否正確
2. SHEETS_ID 是否正確
3. 部署版本是否為最新