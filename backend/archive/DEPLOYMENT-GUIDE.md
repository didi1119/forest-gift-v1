# Google Apps Script 部署指南

## 📋 部署步驟

### 步驟 1：開啟 Google Apps Script 編輯器
1. 前往 [Google Apps Script](https://script.google.com)
2. 找到你的專案「森林知音計畫-佣金管理系統」
3. 或者從 Google Sheets 打開：Extensions → Apps Script

### 步驟 2：備份現有程式碼
1. 將現有的 `apps-script-commission-v2.js` 內容複製到本地保存
2. 建議命名為 `apps-script-commission-v2-backup-日期.js`

### 步驟 3：部署新版本

#### 方案 A：漸進式部署（推薦）
保留舊版本，逐步遷移功能：

1. **創建新檔案**
   - 在 Apps Script 編輯器中點擊「+」新增檔案
   - 命名為 `DataAccessLayer.gs`
   
2. **複製核心類別**
   - 從 `apps-script-integrated-v3.js` 複製以下部分：
     - SheetDataModel 類
     - 通用數據訪問函數
   
3. **逐步替換函數**
   - 保留原本的 `doGet()` 和 `doPost()` 入口
   - 逐個替換內部函數，使用新的數據訪問層
   
4. **測試每個替換**
   - 使用測試函數驗證功能正常

#### 方案 B：完整替換（快速但風險較高）

1. **備份並重命名舊檔案**
   - 將現有的主檔案重命名為 `Code-backup.gs`
   
2. **創建新的主檔案**
   - 創建新檔案 `Code.gs`
   - 複製整個 `apps-script-integrated-v3.js` 的內容
   
3. **立即測試所有功能**

### 步驟 4：測試新架構

在 Apps Script 編輯器中執行測試函數：

```javascript
// 執行這個函數來測試新架構
function testNewArchitecture() {
  // 測試會自動執行
  // 查看 Execution log 確認結果
}

// 檢查欄位映射是否正確
function checkColumnMappings() {
  // 這會顯示所有表格的欄位映射
  // 確認欄位名稱都正確識別
}
```

### 步驟 5：部署為 Web App

1. 點擊「Deploy」→「New Deployment」
2. 設定：
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
3. 點擊「Deploy」
4. 複製新的 Web App URL

### 步驟 6：更新前端 URL（如果 URL 改變）

如果部署產生新的 URL，需要更新前端的 `APPS_SCRIPT_URL`：

1. 打開前端檔案
2. 搜尋 `APPS_SCRIPT_URL`
3. 替換為新的 URL

## 🔄 版本對照表

| 檔案名稱 | 說明 | 使用時機 |
|---------|------|---------|
| `apps-script-commission-v2.js` | 原始版本（硬編碼索引） | 目前運行中 |
| `apps-script-integrated-v3.js` | 新架構整合版 | 準備部署 |
| `apps-script-main-refactored.js` | 模組化版本 | 需要多檔案時使用 |

## ⚠️ 重要注意事項

### 1. 欄位名稱必須完全匹配
新架構依賴表頭名稱，確保 Google Sheets 的第一行（表頭）包含正確的欄位名稱：

**Bookings 表頭：**
```
id | partner_code | guest_name | guest_phone | guest_email | bank_account_last5 | checkin_date | checkout_date | room_price | booking_source | stay_status | payment_status | commission_status | commission_amount | commission_type | is_first_referral_bonus | first_referral_bonus_amount | manually_confirmed_by | manually_confirmed_at | notes | created_at | updated_at
```

**Partners 表頭：**
```
partner_code | partner_name | partner_level | contact_phone | contact_email | bank_code | bank_account | commission_preference | total_referrals | successful_referrals | yearly_referrals | total_commission_earned | total_commission_paid | available_points | points_used | pending_commission | join_date | is_active | line_coupon_url | notes | created_at | updated_at
```

**Payouts 表頭：**
```
id | partner_code | payout_type | amount | related_booking_ids | payout_method | payout_status | bank_transfer_date | bank_transfer_reference | accommodation_voucher_code | notes | created_by | created_at | updated_at
```

**Accommodation_Usage 表頭：**
```
id | partner_code | deduct_amount | related_booking_id | usage_date | usage_type | notes | created_by | created_at | updated_at
```

### 2. 測試清單

部署前必須測試：
- [ ] 創建新訂房
- [ ] 確認入住完成
- [ ] 計算佣金
- [ ] 使用住宿金
- [ ] 查詢所有數據
- [ ] 大使等級升級
- [ ] 結算創建

### 3. 回滾計劃

如果新版本有問題：
1. 在 Apps Script 編輯器中
2. Deploy → Manage Deployments
3. 選擇前一個版本
4. 點擊「Edit」→ 選擇舊版本號碼
5. Update 部署

## 🚀 部署時間建議

- **最佳時間**：非營業時間（晚上或清晨）
- **準備時間**：30 分鐘
- **測試時間**：1 小時
- **監控時間**：部署後 24 小時密切監控

## 📊 監控檢查

部署後監控：
1. **錯誤日誌**：View → Executions 查看是否有錯誤
2. **數據完整性**：檢查新創建的記錄是否正確
3. **性能監控**：注意執行時間是否正常

## 🆘 緊急聯絡

如果遇到問題：
1. 立即回滾到舊版本
2. 檢查錯誤日誌
3. 確認表頭名稱是否正確
4. 檢查 SHEETS_ID 是否正確

## 📝 部署檢查表

### 部署前：
- [ ] 備份現有程式碼
- [ ] 備份 Google Sheets 數據
- [ ] 確認表頭名稱正確
- [ ] 在測試環境驗證

### 部署中：
- [ ] 複製新程式碼
- [ ] 執行測試函數
- [ ] 部署為 Web App
- [ ] 記錄新的 URL

### 部署後：
- [ ] 測試所有主要功能
- [ ] 監控錯誤日誌
- [ ] 確認數據正確寫入
- [ ] 更新前端 URL（如需要）

---

**記住：安全第一，寧可慢慢測試，也不要急著部署！**