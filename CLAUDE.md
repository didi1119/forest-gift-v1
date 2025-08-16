# 知音計畫 - 森林住宿大使推薦系統

## 專案概述

知音計畫是一個森林住宿推薦系統，透過大使推薦機制來推廣優質住宿體驗。系統包含完整的大使管理、訂房追蹤、佣金計算和結算功能。

## 技術架構

### 前端技術棧
- **HTML5 + JavaScript (ES6+)**：主要開發語言
- **Tailwind CSS**：UI 框架，採用 JIT 模式
- **Noto Fonts**：中文字體支援
- **原生 Fetch API + 表單提交**：混合 API 通訊模式

### 後端技術棧
- **Google Apps Script**：無伺服器後端解決方案
- **Google Sheets**：資料庫存儲
- **CORS 處理**：支援跨域請求

### 部署架構
- **前端**：GitHub Pages 靜態託管
- **後端**：Google Apps Script 雲端執行
- **資料庫**：Google Sheets 雲端存儲

## 專案結構

```
知音計畫/
├── CLAUDE.md                           # 專案說明文件 🆕
├── frontend/
│   └── admin/                          # 管理後台
│       ├── admin-dashboard-real.html   # 主控制台 🎯
│       ├── manual-booking.html         # 手動訂房頁面
│       ├── manual-checkin-confirm.html # 入住確認頁面
│       ├── link-generator-form.html    # 連結生成器
│       ├── commission-management.js    # 佣金管理模組
│       ├── payout-functions.js         # 結算功能模組
│       └── google-apps-script-fix.html # 故障排除指南
└── backend/                            # Google Apps Script 代碼
    └── apps-script-commission-v2.js    # 主要後端邏輯
```

## 核心功能模組

### 1. 大使管理系統 (Partners)
- **大使註冊**：姓名、代碼、聯絡資訊、銀行帳戶
- **等級制度**：LV1 知音大使 → LV2 森林嚮導 → LV3 秘境守護者
- **佣金偏好**：現金 vs 住宿金選擇
- **績效追蹤**：推薦成功數、累積佣金

### 2. 訂房管理系統 (Bookings) 🎯
**標準化資料結構 (22 個欄位)：**

| 欄位 | 說明 | 類型 | 必填 |
|------|------|------|------|
| id | 唯一識別符 | String | 自動生成 |
| partner_code | 推薦大使代碼 | String | ❌ |
| guest_name | 房客姓名 | String | ✅ |
| guest_phone | 房客電話 | String | ✅ |
| guest_email | 房客Email | String | ❌ |
| bank_account_last5 | 銀行帳號後5碼 | String | ❌ |
| checkin_date | 入住日期 | Date | ✅ |
| checkout_date | 退房日期 | Date | ✅ |
| room_price | 房價 | Number | ✅ |
| booking_source | 訂房來源 | String | 自動設定 |
| stay_status | 住宿狀態 | String | 自動設定 |
| payment_status | 付款狀態 | String | 自動設定 |
| commission_status | 佣金狀態 | String | 自動設定 |
| commission_amount | 佣金金額 | Number | 自動計算 |
| commission_type | 佣金類型 | String | 自動設定 |
| is_first_referral_bonus | 首次推薦獎勵 | Boolean | 自動設定 |
| first_referral_bonus_amount | 首次推薦獎勵金額 | Number | 自動計算 |
| manually_confirmed_by | 手動確認者 | String | 自動記錄 |
| manually_confirmed_at | 手動確認時間 | DateTime | 自動記錄 |
| notes | 備註 | String | ❌ |
| created_at | 創建時間 | DateTime | 自動生成 |
| updated_at | 更新時間 | DateTime | 自動更新 |

### 3. 佣金管理系統 (Commission)
- **自動計算**：根據大使等級和房價
- **佣金率表**：
  - LV1: 1000住宿金 / 500現金
  - LV2: 1200住宿金 / 600現金  
  - LV3: 1500住宿金 / 800現金
- **首次推薦獎勵**：1500住宿金
- **手動調整**：支援特殊情況處理

### 4. 結算管理系統 (Payouts)
- **混合結算**：現金 + 住宿金組合
- **住宿金點數**：累積、使用、抵扣追蹤
- **銀行匯款**：支援台灣主要銀行
- **結算記錄**：完整的歷史紀錄

### 4.1 住宿金折抵功能 🆕
- **即時折抵**：大使可使用累積的住宿金點數折抵房費
- **金額驗證**：自動驗證折抵金額不超過可用點數
- **模態框界面**：專業的折抵申請界面
  - 入住日期選擇（必填）
  - 折抵金額輸入與即時驗證
  - 快速金額按鈕（$1000, $2000, $3000, 全部）
  - 相關訂房ID和備註欄位
- **即時更新**：前端數據立即反映變化
- **Google Sheets 連動**：自動更新 `available_points` 和 `points_used` 欄位
- **CORS 相容**：使用表單提交避免瀏覽器限制

### 5. 連結生成系統 (Link Generator)
- **追蹤連結**：透過 Apps Script 中繼服務
- **短網址**：TinyURL / is.gd 整合
- **分享範本**：預設的推薦文案
- **績效統計**：點擊數與轉換率

## 資料流程圖

```
房客點擊大使連結 → GitHub Pages 引導頁 → 官方訂房
                ↓
訂房確認 → 手動登記到系統 → 入住完成確認
                ↓
自動計算佣金 → 更新大使等級 → 創建結算記錄
                ↓
結算支付 → 住宿金累積 → 點數使用追蹤 🆕
```

## 關鍵技術實作

### 1. BookingDataManager 數據管理器
```javascript
const BookingDataManager = {
    validateBooking(booking),      // 數據驗證
    normalizeBooking(rawBooking),  // 數據標準化
    createNewBooking(formData),    // 新建訂房
    updateBooking(existing, data), // 更新訂房
    detectDataIssues(bookings),    // 問題診斷
    createOrderedParams(data)      // 標準化 API 參數
}
```

### 2. 混合 API 通訊模式

**方式一：Fetch API（推薦用於數據獲取）**
```javascript
const params = BookingDataManager.createOrderedParams(submitData);
const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
});
```

**方式二：表單提交（用於避免 CORS 問題）** 🆕
```javascript
const form = document.createElement('form');
form.method = 'POST';
form.action = APPS_SCRIPT_URL;
form.target = 'hiddenFrame';  // 使用隱藏 iframe 接收回應
form.style.display = 'none';

Object.keys(submitData).forEach(key => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = submitData[key];
    form.appendChild(input);
});

document.body.appendChild(form);
form.submit();
```

### 3. 住宿金折抵核心函數 🆕
```javascript
// 主要功能函數
function useAccommodationPoints(partnerCode)     // 開啟折抵模態框
function submitUsePoints(event, partnerCode)     // 提交折抵申請
function validateUseAmount(input, maxAmount)     // 即時金額驗證
function setQuickAmount(inputId, amount, max)    // 快速金額選擇

// 使用 update_partner_commission API 端點更新點數
action: 'update_partner_commission'
available_points: newAvailablePoints  // 扣除後的可用點數
points_used: newPointsUsed           // 累積已使用點數
```

### 4. 標準化欄位定義
```javascript
const BOOKING_FIELDS = {
    FIELD_ORDER: [/* 22 個標準欄位 */],
    DEFAULTS: {/* 預設值 */},
    REQUIRED: [/* 必填欄位 */],
    NUMERIC: [/* 數字欄位 */]
};
```

## 重要開發里程碑

### 2024-08-16 修復403錯誤問題 🔧
- **問題**：使用form.submit()後調用loadRealData()會導致403錯誤
- **原因**：Google Apps Script的form.submit()回應會觸發額外的請求，與loadRealData()衝突
- **症狀**：
  - 轉換現金成功但出現403錯誤：`script.googleusercontent.com/macros/echo Failed to load resource: 403`
  - Console顯示：`✅ 成功轉換 166 點為 NT$ 83！` 但有錯誤
  - 使用住宿金也有403錯誤但數據有更新
  - 轉換現金沒有403錯誤（移除loadRealData後）但數據可能沒更新
- **解決方案**：
  1. 移除所有form.submit()後的loadRealData()調用
  2. 延長setTimeout等待時間到2秒，確保後端有足夠時間處理
  3. 只更新本地數據，避免立即重新請求
  4. 添加詳細的console.log調試信息
- **注意事項**：
  - form.submit()是異步操作，需要足夠的等待時間
  - 403錯誤來自Google Apps Script的自動重定向響應
  - 批量操作等功能如需重載數據，應使用較長的延遲時間

### 2024-08-16 轉換現金功能後端問題 🚨
- **問題**：`"未知的動作: convert_points_to_cash"`
- **根因**：Google Apps Script後端代碼版本過舊，缺少新功能處理函數
- **症狀**：
  - 使用住宿金正常（舊功能存在）
  - 轉換現金失敗（新功能不存在）
  - 200狀態碼但返回錯誤：`{"success":false,"error":"未知的動作: convert_points_to_cash"}`
- **解決方案**：
  1. 更新Google Apps Script代碼為最新版本
  2. 確保包含`handleConvertPointsToCash`函數
  3. 重新部署Google Apps Script
- **預防措施**：
  - 本地代碼更新後，及時同步到Google Apps Script
  - 測試新功能前確認後端代碼已部署

### 2024年系統標準化更新 🎯
- **問題**：Google Sheets 欄位錯位，顯示 "$MANUAL_ENTRY", "44", "$ACCOMMODATION"
- **根因**：資料庫缺少 ID 欄位，導致所有欄位左移一位
- **解決方案**：
  1. 建立 22 欄位標準化規範
  2. 創建 BookingDataManager 統一數據處理
  3. 修復所有相關功能的欄位對應
  4. 統一 API 調用方式 (form.submit → fetch)
  5. 確保數據按正確順序發送到後端

### 2024年8月住宿金折抵功能開發 🆕
- **新增功能**：完整的住宿金折抵系統
- **技術挑戰**：
  1. **CORS 問題**：fetch API 被瀏覽器 CORS 政策阻擋
  2. **數據持久性**：避免系統重載後點數復原
  3. **金額驗證**：確保折抵金額不超過可用點數
- **解決方案**：
  1. 使用表單提交 + 隱藏 iframe 避免 CORS
  2. 立即更新前端數據，移除自動重載機制
  3. 添加即時驗證和智慧快速選擇按鈕
  4. 使用 `update_partner_commission` API 端點更新點數

### API 一致性更新
- **問題**：部分功能出現 403 Forbidden 錯誤
- **原因**：混用 form.submit() 和 fetch() 方式
- **解決**：採用混合模式，根據功能需求選擇適當的通訊方式

## Google Apps Script 後端架構

### 主要端點
- `POST /?action=create_booking` - 創建新訂房
- `POST /?action=update_booking` - 更新訂房資料
- `POST /?action=confirm_checkin_completion` - 確認入住完成
- `POST /?action=create_payout` - 創建結算記錄
- `POST /?action=update_partner_commission` - 更新大使佣金 🆕
- `GET /?action=get_all_data` - 獲取所有數據

### Partners 資料表欄位 🆕
- `available_points` - 可用住宿金點數
- `points_used` - 已使用點數
- `total_commission_earned` - 累積總佣金

## 測試與除錯

### 前端除錯工具
- **Console 日誌**：詳細的數據流程追蹤
- **數據診斷**：自動偵測欄位映射問題
- **錯誤處理**：完整的錯誤提示和修復建議
- **住宿金功能除錯**：提交數據和更新狀態的詳細日誌 🆕

### 測試流程
1. **數據標準化測試**：確認 BookingDataManager 正確處理各種輸入
2. **API 通訊測試**：檢查數據按正確順序發送
3. **欄位映射測試**：驗證 Google Sheets 寫入正確位置
4. **整合測試**：完整的訂房-入住-結算流程
5. **住宿金折抵測試**：金額驗證、CORS 處理、數據持久性 🆕

## 安全性考量

### 數據保護
- **敏感資料**：銀行帳號只存後5碼
- **權限控制**：管理後台訪問限制
- **資料驗證**：前後端雙重驗證
- **金額驗證**：住宿金折抵嚴格驗證可用餘額 🆕

### API 安全
- **CORS 配置**：適當的跨域請求設定
- **混合通訊**：根據安全需求選擇通訊方式 🆕
- **錯誤處理**：避免敏感資訊洩漏
- **輸入驗證**：防止惡意數據注入

## 維護指南

### 常見問題排除
1. **數據錯位**：檢查 BOOKING_FIELDS 定義是否與 Google Sheets 一致
2. **CORS 錯誤**：確認使用表單提交而非 fetch() 🆕
3. **欄位驗證失敗**：檢查必填欄位和數據類型
4. **住宿金點數問題**：檢查 available_points 和 points_used 欄位 🆕

### 添加新功能
1. **前端**：使用 BookingDataManager 處理數據
2. **後端**：遵循標準化 API 設計模式
3. **CORS 處理**：考慮是否需要表單提交方式 🆕
4. **測試**：確保不影響現有數據結構

### 住宿金功能維護 🆕
- **驗證邏輯**：確保金額驗證函數正確運作
- **UI 更新**：檢查快速選擇按鈕和驗證提示
- **數據同步**：確認前端更新與後端一致
- **表單提交**：維護隱藏 iframe 和表單生成邏輯

## 部署資訊

### GitHub Pages 設定
- **Repository**: `didi1119/forest-gift-v1`
- **Branch**: `main`
- **Path**: `/` (根目錄)
- **URL**: `https://didi1119.github.io/forest-gift-v1/`

### 主要頁面
- **管理後台**: `/frontend/admin/admin-dashboard-real.html`
- **手動訂房**: `/frontend/admin/manual-booking.html`
- **入住確認**: `/frontend/admin/manual-checkin-confirm.html`

## 聯絡資訊

- **專案性質**：森林住宿推薦系統
- **開發階段**：持續迭代中
- **技術支援**：Claude AI 輔助開發
- **最新功能**：住宿金折抵系統 🆕

---

*本文件隨專案更新而持續維護，最後更新：2024年8月16日*
- 紀錄表單結構還有業務邏輯
- 。Google Apps Script 在 GitHub Pages 上確實會被 CORS 政策阻擋，我需要改回使用 form 提交方式。