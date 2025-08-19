# 前後端整合檢查清單

## ✅ 已完成的整合點

### 核心功能 API
- [x] `get_dashboard_data` - 獲取儀表板數據
- [x] `get_all_data` - 獲取所有數據
- [x] `create_booking` - 創建訂房
- [x] `update_booking` - 更新訂房
- [x] `delete_booking` - 刪除/取消訂房
- [x] `confirm_checkin_completion` - 確認入住完成

### 結算管理 API
- [x] `create_payout` - 創建結算
- [x] `update_payout` - 更新結算
- [x] `cancel_payout` - 取消結算

### 大使管理 API
- [x] `create_partner` - 創建新大使
- [x] `update_partner_commission` - 更新大使佣金

### 住宿金管理 API
- [x] `use_accommodation_points` - 使用住宿金
- [x] `deduct_accommodation_points` - 扣除住宿金（使用相同處理函數）
- [x] `convert_points_to_cash` - 轉換點數為現金

## 重要改進點

### 1. 動態欄位映射
新版本使用 `SheetDataModel` 類，不再依賴硬編碼的欄位索引：
```javascript
// 舊版（危險）
const name = bookingValues[i][2];  // 如果欄位順序改變就會出錯

// 新版（安全）
const name = dataModel.getFieldValue(row, 'guest_name');  // 自動找到正確欄位
```

### 2. 完整的 SELF_USE 訂房處理
- 刪除 SELF_USE 訂房時自動返還點數
- 創建對應的 POINTS_REFUND Payout 記錄
- 更新 Partners 表的 available_points 和 points_used

### 3. 審計追蹤
所有點數變動都會創建 Payout 記錄：
- `POINTS_REFUND` - 點數返還
- `POINTS_ADJUSTMENT_DEBIT` - 點數扣除
- `POINTS_ADJUSTMENT_CREDIT` - 點數增加
- `COMMISSION_ADJUSTMENT` - 佣金調整

## 測試檢查項目

### 基本功能測試
- [ ] 載入儀表板數據
- [ ] 創建新訂房
- [ ] 確認入住完成（觸發佣金計算）
- [ ] 使用住宿金折抵
- [ ] 轉換點數為現金

### SELF_USE 訂房測試
- [ ] 創建 SELF_USE 訂房（使用住宿金）
- [ ] 更新 SELF_USE 訂房
- [ ] 刪除 SELF_USE 訂房（確認點數返還）

### 結算管理測試
- [ ] 創建現金結算
- [ ] 創建住宿金結算
- [ ] 取消結算
- [ ] 更新結算狀態

### 大使管理測試
- [ ] 創建新大使
- [ ] 更新大使佣金
- [ ] 等級自動升級

## 部署前檢查

### Google Sheets 表頭確認
確保每個表格的第一行（表頭）包含正確的欄位名稱：

#### Bookings 表頭
```
id | partner_code | guest_name | guest_phone | guest_email | bank_account_last5 | checkin_date | checkout_date | room_price | booking_source | stay_status | payment_status | commission_status | commission_amount | commission_type | is_first_referral_bonus | first_referral_bonus_amount | manually_confirmed_by | manually_confirmed_at | notes | created_at | updated_at
```

#### Partners 表頭
```
partner_code | partner_name | partner_level | contact_phone | contact_email | bank_code | bank_account | commission_preference | total_referrals | successful_referrals | yearly_referrals | total_commission_earned | total_commission_paid | available_points | points_used | pending_commission | join_date | is_active | line_coupon_url | notes | created_at | updated_at
```

#### Payouts 表頭
```
id | partner_code | payout_type | amount | related_booking_ids | payout_method | payout_status | bank_transfer_date | bank_transfer_reference | accommodation_voucher_code | notes | created_by | created_at | updated_at
```

#### Accommodation_Usage 表頭
```
id | partner_code | deduct_amount | related_booking_id | usage_date | usage_type | notes | created_by | created_at | updated_at
```

### 配置確認
- [ ] SHEETS_ID 正確：`1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4`
- [ ] 前端 APPS_SCRIPT_URL 指向正確的部署 URL

## 部署步驟

1. **複製最新程式碼**
   - 從 `apps-script-integrated-v3.js` 複製全部內容

2. **更新 Google Apps Script**
   - 貼上新程式碼
   - 儲存（Ctrl+S）

3. **執行測試函數**
   ```javascript
   testNewArchitecture()  // 測試新架構
   checkColumnMappings()  // 檢查欄位映射
   ```

4. **重新部署**
   - Deploy → Manage Deployments
   - Update → New Version

5. **測試前端**
   - 重新整理管理後台
   - 確認數據正常載入
   - 測試核心功能

## 回滾計劃

如果出現問題：
1. Deploy → Manage Deployments
2. 選擇前一個版本
3. Update 回到舊版本

## 監控點

部署後 24 小時內監控：
- Google Apps Script 執行日誌
- 錯誤訊息
- 數據完整性
- 性能指標

---

**所有檢查項目完成後，新版本即可安全上線運行！**