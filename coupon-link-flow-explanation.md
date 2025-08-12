# 優惠券連結流程說明

## 🔗 完整流程

### 1. **連結生成器階段**
**位置**: `frontend/admin/link-generator-form.html`

1. 管理員在"專屬優惠券連結"欄位輸入該夥伴的 LINE 官方帳號優惠券連結
2. 點擊"生成專屬連結"後，系統會：
   - 生成追蹤連結：`Apps Script URL + ?pid=夥伴代碼&dest=coupon&target=優惠券連結`
   - 生成短網址版本
   - 將原始優惠券連結存入 Google Sheets 的 `Partners` 表格的 `coupon_url` 欄位

### 2. **Google Sheets 儲存**
**位置**: Google Sheets → Partners 表格

```
| partner_code | name | ... | coupon_url | ... |
|--------------|------|-----|------------|-----|
| WANG001      | 王小明| ... | https://lin.ee/abc123 | ... |
```

### 3. **用戶訪問主頁**
**位置**: `frontend/index.html`

1. 用戶通過夥伴分享的連結訪問：`網站URL?subid=WANG001`
2. 頁面載入時會儲存 `subid` 參數

### 4. **點擊優惠券按鈕**
**位置**: `frontend/index.html` → `goToLineCoupon()` 函數

1. 用戶點擊"領取專屬森林優惠 🎁"按鈕
2. 函數檢查是否有有效的 `subid`
3. 如果有，跳轉到：`Apps Script URL + ?pid=WANG001&dest=coupon`
4. 如果沒有，跳轉到預設 LINE 官方帳號

### 5. **Apps Script 處理跳轉**
**位置**: `backend/apps-script-commission-v2.js` → `doGet()` 函數

1. 接收到 `?pid=WANG001&dest=coupon` 請求
2. 調用 `getPartnerCouponUrl('WANG001')` 函數
3. 從 Google Sheets Partners 表格查詢該夥伴的 `coupon_url`
4. 記錄點擊追蹤到 Clicks 表格
5. 跳轉到查詢到的優惠券連結

### 6. **最終跳轉**
用戶最終到達該夥伴專屬的 LINE 官方帳號優惠券頁面

## 🛠️ 修復內容

### Apps Script 修復
- ✅ 修復 `getPartnerCouponUrl()` 函數使用正確的欄位索引
- ✅ 添加詳細的日誌記錄和錯誤處理
- ✅ 使用動態欄位查找而非硬編碼索引

### 前端修復
- ✅ 確保 `goToLineCoupon()` 函數正確使用 `?pid=代碼&dest=coupon` 格式
- ✅ 移除不必要的 `target` 參數

## 🔍 測試步驟

1. **設定 Google Sheets 標題**
   ```javascript
   // 在 Apps Script 中執行
   setupSheetsHeaders();
   ```

2. **創建測試夥伴**
   - 使用連結生成器創建一個測試夥伴
   - 輸入專屬的 LINE 優惠券連結

3. **測試流程**
   - 使用該夥伴的連結訪問網站（帶有 subid 參數）
   - 點擊"領取專屬森林優惠 🎁"按鈕
   - 檢查是否跳轉到正確的專屬優惠券連結

4. **檢查 Apps Script 日誌**
   - 查看是否有錯誤訊息
   - 確認能找到夥伴和優惠券連結

## 🎯 預期結果

- **有 subid 時**: 跳轉到該夥伴的專屬優惠券連結
- **沒有 subid 時**: 跳轉到預設 LINE 官方帳號
- **找不到夥伴時**: 跳轉到預設 LINE 官方帳號
- **所有跳轉都會記錄追蹤數據**