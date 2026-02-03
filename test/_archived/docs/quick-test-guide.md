# 快速測試指南 - 新功能測試

## 🚀 快速開始

### 步驟 1：部署後端代碼
1. 開啟 Google Apps Script
2. 將 `backend/apps-script-integrated-v5-complete.js` 的內容複製貼上
3. 部署為網路應用程式，取得 URL

### 步驟 2：開啟測試頁面
```bash
# 在瀏覽器開啟
test/new-features-test.html
```

### 步驟 3：配置測試
1. 貼上你的 Apps Script URL
2. 確認測試用大使代碼（預設 "gg"）
3. 點擊「儲存設定」

### 步驟 4：執行測試
按順序點擊測試按鈕：
1. 🟣 **測試取消住宿金使用** - 測試點數退回
2. 🟢 **測試恢復已取消訂房** - 測試訂房恢復
3. 🟡 **測試部分退款** - 測試金額調整
4. 🔴 **測試批量取消** - 測試批量操作
5. 🎯 **完整流程測試** - 端到端測試

---

## 🧪 手動測試步驟

如果你想手動測試，可以用以下步驟：

### 測試 1：取消住宿金使用
```javascript
// 1. 使用住宿金
POST /?action=use_accommodation_points
{
  partner_code: "gg",
  deduct_amount: 1000,
  guest_name: "TEST_USER",
  checkin_date: "2025-08-24",
  notes: "測試使用"
}

// 2. 取消使用（退回點數）
POST /?action=cancel_accommodation_usage
{
  partner_code: "gg",
  refund_amount: 1000,
  reason: "客戶取消"
}
```

### 測試 2：恢復已取消訂房
```javascript
// 1. 創建訂房
POST /?action=create_booking
{
  partner_code: "gg",
  guest_name: "張三",
  guest_phone: "0912345678",
  checkin_date: "2025-08-25",
  checkout_date: "2025-08-26",
  room_price: 5000
}

// 2. 取消訂房
POST /?action=delete_booking
{
  booking_id: "BK_xxxxx",
  reason: "客戶取消"
}

// 3. 恢復訂房
POST /?action=restore_booking
{
  booking_id: "BK_xxxxx",
  new_status: "PENDING",
  reason: "客戶改變心意"
}
```

### 測試 3：部分退款
```javascript
// 1. 創建並確認訂房
POST /?action=create_booking
{
  partner_code: "gg",
  guest_name: "李四",
  guest_phone: "0923456789",
  room_price: 8000
}

POST /?action=confirm_checkin_completion
{
  booking_id: "BK_xxxxx"
}

// 2. 部分退款
POST /?action=partial_refund
{
  booking_id: "BK_xxxxx",
  new_room_price: 5000,
  reason: "縮短住宿天數"
}
```

### 測試 4：批量取消
```javascript
// 批量取消多筆訂房
POST /?action=batch_cancel
{
  booking_ids: ["BK_001", "BK_002", "BK_003"],
  reason: "團體取消"
}
```

---

## 📊 驗證測試結果

### 在 Google Sheets 檢查：

1. **Partners 表**
   - `available_points` - 點數是否正確增減
   - `points_used` - 使用記錄是否更新
   - `total_commission_earned` - 佣金是否調整

2. **Bookings 表**
   - `stay_status` - 狀態是否正確（CANCELLED/PENDING/COMPLETED）
   - `commission_amount` - 佣金金額是否調整
   - `notes` - 是否有操作記錄

3. **Payouts 表**
   - 是否有新的審計記錄
   - `payout_type` 是否正確（POINTS_REFUND/BOOKING_RESTORED/PARTIAL_REFUND）
   - `amount` 金額是否正確（負數表示扣減）

4. **Audit_Trail 表**（如果有）
   - 是否記錄所有操作
   - `old_values` 和 `new_values` 是否正確

---

## 🐛 常見問題

### Q1: 出現 CORS 錯誤
**解決**：這是正常的，因為使用 no-cors 模式。只要後端有處理，就算成功。

### Q2: 找不到訂房/夥伴
**解決**：
- 確認 ID 正確
- 確認 Google Sheets 有資料
- 檢查欄位名稱是否一致

### Q3: 點數沒有更新
**解決**：
- 檢查 Partners 表是否有 `available_points` 和 `points_used` 欄位
- 確認大使代碼正確
- 查看 Payouts 表是否有記錄

### Q4: 批量取消失敗
**解決**：
- 確認 booking_ids 是陣列格式
- 確認所有 ID 都存在
- 檢查是否有回滾記錄

---

## 📝 測試檢查清單

- [ ] Apps Script 已部署最新版本
- [ ] Google Sheets 有必要的欄位
- [ ] 測試用大使存在且有足夠點數
- [ ] 所有新 API 端點都能呼叫
- [ ] 審計記錄正確創建
- [ ] 金額計算正確
- [ ] 狀態轉換正確
- [ ] 回滾機制正常運作
- [ ] 並發鎖沒有造成死鎖

---

## 💡 進階測試

如果要測試更複雜的情況：

1. **並發測試**：同時執行多個操作
2. **邊界測試**：測試極大/極小值
3. **錯誤恢復**：故意製造錯誤看回滾
4. **效能測試**：批量處理大量資料

使用 `test/master-test-suite.html` 進行完整測試。