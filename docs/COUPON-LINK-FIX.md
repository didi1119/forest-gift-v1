# 優惠券連結修復說明

## 問題描述

主頁中的「領取專屬森林優惠 🎁」按鈕沒有正確連結到推薦人專屬的 LINE 優惠券連結。

## 修復內容

### 1. 主頁增強（frontend/index.html）

**新增功能：**
- ✅ 頁面載入時自動檢測並顯示 `coupon_url` 參數
- ✅ Console 輸出詳細的 debug 信息
- ✅ 視覺提示：當有專屬優惠券時顯示「✓ 已載入專屬優惠券連結」
- ✅ 改進的 `goToLineCoupon()` 函數，提供更清晰的 console 輸出

**Console 輸出範例：**
```
🌲 靜謐森林網站載入完成
📊 當前 subid: KOBE
🎁 已載入專屬優惠券連結: https://lin.ee/KOBE001
   連結來源: URL 參數
💡 測試推薦功能：在網址後加上 ?subid=test123&coupon_url=YOUR_LINE_URL

=== 點擊優惠券按鈕 ===
subid: KOBE
couponUrl: https://lin.ee/KOBE001
✅ 使用專屬優惠券連結（帶追蹤）
   追蹤連結: https://script.google.com/...&target=https%3A%2F%2Flin.ee%2FKOBE001
   最終目標: https://lin.ee/KOBE001
========================
```

### 2. 連結生成器改進（frontend/admin/link-generator-form.html）

**新增功能：**
- ✅ 雙重短網址服務（is.gd + TinyURL 備用）
- ✅ 即時狀態顯示（綠色 ✓ 短網址 / 橙色 ⚠ 原始連結）
- ✅ 個別複製按鈕
- ✅ 改進的使用提示

**短網址服務優先順序：**
1. is.gd（主要服務，支援 CORS）
2. TinyURL（備用服務）
3. 原始 URL（所有服務失敗時）

### 3. 測試工具

**新增檔案：**
- `frontend/admin/test-shorturl.html` - 短網址服務測試
- `frontend/admin/test-coupon-flow.html` - 完整優惠券流程測試

## 運作流程

### 完整的推薦流程：

```
1. 大使使用連結生成器
   └─> 生成帶有 coupon_url 參數的短網址

2. 用戶點擊短網址
   └─> Apps Script (doGet)
       └─> 記錄點擊到 Clicks 表格
       └─> 重定向到 GitHub Pages，保留所有參數
           └─> index.html (根目錄)
               └─> 重定向到 frontend/index.html + 參數

3. frontend/index.html 載入
   └─> getCouponUrl() 從 URL 讀取 coupon_url
   └─> 儲存到 localStorage
   └─> 在 Console 顯示 debug 信息
   └─> 顯示視覺提示「✓ 已載入專屬優惠券連結」

4. 用戶點擊「領取專屬森林優惠 🎁」
   └─> goToLineCoupon()
       └─> 讀取 couponUrl
       └─> 構建追蹤連結：
           Apps Script + pid + dest=coupon + target=couponUrl
       └─> 跳轉到追蹤連結
           └─> Apps Script 記錄點擊
           └─> 重定向到專屬 LINE 優惠券
```

## 測試方法

### 方法 1：使用測試工具

1. 打開 `frontend/admin/test-coupon-flow.html`
2. 填寫推薦人代碼和 LINE 優惠券連結
3. 點擊「生成測試連結」
4. 按照頁面上的測試步驟進行測試

### 方法 2：手動測試

1. 打開連結生成器生成短網址
2. 複製主頁短網址
3. 在新的無痕視窗中打開連結
4. 按 F12 打開開發者工具
5. 查看 Console，應該顯示：
   ```
   🎁 已載入專屬優惠券連結: https://lin.ee/xxxxx
   ```
6. 點擊「領取專屬森林優惠 🎁」按鈕
7. 確認跳轉到正確的 LINE 優惠券

### 方法 3：直接 URL 測試

訪問以下 URL（替換參數）：
```
https://didi1119.github.io/forest-gift-v1/?subid=TEST001&coupon_url=https://lin.ee/YOUR_COUPON
```

## 預期行為

### ✅ 正確行為：

1. **頁面載入時**：
   - Console 顯示「🎁 已載入專屬優惠券連結」
   - 按鈕下方顯示「✓ 已載入專屬優惠券連結」

2. **點擊按鈕時**：
   - Console 顯示「✅ 使用專屬優惠券連結（帶追蹤）」
   - 顯示追蹤連結和最終目標
   - 跳轉到專屬 LINE 優惠券

3. **Clicks 表格**：
   - 記錄兩次點擊：
     1. 主頁連結點擊（dest=landing）
     2. 優惠券按鈕點擊（dest=coupon）

### ❌ 錯誤行為（需要排查）：

1. **Console 沒有顯示優惠券連結**
   - 原因：URL 沒有 coupon_url 參數
   - 解決：檢查 Apps Script handleRedirect 是否正確傳遞參數

2. **點擊按鈕跳轉到預設 LINE**
   - 原因：couponUrl 變數為空
   - 解決：檢查 getCouponUrl() 函數邏輯

3. **短網址無法生成**
   - 原因：短網址服務異常或網路問題
   - 解決：會自動使用原始 URL

## 技術細節

### URL 參數傳遞鏈：

```
連結生成器
  ↓
Apps Script URL: ?pid=XXX&dest=landing&coupon_url=LINE_URL
  ↓
Apps Script doGet: e.queryString (完整參數)
  ↓
GitHub Pages: GITHUB_PAGES_URL + '?' + e.queryString
  ↓
index.html: window.location.search (保留參數)
  ↓
frontend/index.html: new URLSearchParams(window.location.search)
  ↓
getCouponUrl(): getUrlParameter('coupon_url')
  ↓
localStorage: forest_coupon_url (持久化)
```

### 關鍵函數：

**getCouponUrl()** - 讀取優惠券 URL
```javascript
function getCouponUrl() {
    let couponUrl = getUrlParameter('coupon_url') ||
                    getUrlParameter('couponUrl') ||
                    getUrlParameter('coupon') ||
                    getUrlParameter('target');

    if (!couponUrl) {
        couponUrl = localStorage.getItem('forest_coupon_url');
    }

    if (couponUrl) {
        localStorage.setItem('forest_coupon_url', couponUrl);
    }

    return couponUrl;
}
```

**goToLineCoupon()** - 處理按鈕點擊
```javascript
function goToLineCoupon() {
    const subid = getSubid();
    const couponUrl = getCouponUrl();

    if (subid && couponUrl) {
        // 使用專屬優惠券（帶追蹤）
        const url = `${APPS_SCRIPT_URL}?pid=${subid}&dest=coupon&target=${couponUrl}`;
        window.open(url, '_blank');
    } else if (couponUrl) {
        // 無 subid，直接跳轉（無追蹤）
        window.open(couponUrl, '_blank');
    } else {
        // 使用預設 LINE
        window.open(LINE_OFFICIAL_URL, '_blank');
    }
}
```

## 故障排除

### 問題：Console 輸出「優惠券連結: 使用預設 LINE 官方帳號」

**可能原因：**
1. URL 沒有包含 `coupon_url` 參數
2. Apps Script 沒有正確傳遞參數
3. 參數名稱錯誤

**排查步驟：**
1. 查看完整的 URL，確認是否有 `coupon_url=...`
2. 在 Apps Script 中添加 Logger.log 查看 e.queryString
3. 確認 handleRedirect 函數邏輯

### 問題：短網址生成失敗

**可能原因：**
1. is.gd / TinyURL 服務異常
2. CORS 限制
3. URL 太長

**解決方案：**
- 系統會自動降級使用原始 URL
- 可以手動使用完整連結測試功能

### 問題：點擊追蹤沒有記錄

**可能原因：**
1. Clicks 表格欄位不匹配
2. Apps Script 權限問題

**解決方案：**
1. 確認 Clicks 表格已更新為 11 欄位格式
2. 檢查 Apps Script 執行日誌

## 相關檔案

### 已修改：
- `frontend/index.html` - 主頁（優惠券按鈕邏輯）
- `frontend/admin/link-generator-form.html` - 連結生成器（短網址）

### 新增：
- `frontend/admin/test-shorturl.html` - 短網址測試工具
- `frontend/admin/test-coupon-flow.html` - 流程測試工具
- `docs/COUPON-LINK-FIX.md` - 本文件

### 需要同步更新到 Google Sheets：
- `知音大使.xlsx` - Clicks 工作表（11 欄位格式）

---

**最後更新：** 2026-02-02
**版本：** v1.1
**測試狀態：** ✅ 已在本地環境測試通過
