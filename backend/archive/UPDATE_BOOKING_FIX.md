# 更新訂房事件修復說明

## 問題診斷

當前的 `handleUpdateBooking` 函數過於簡單，沒有根據佣金制度文檔（3.6節）實現複雜的業務邏輯。

## 需要實現的邏輯

### 1. 變更類型判斷
- 房客基本資訊變更（無金額影響）
- 日期變更（無金額影響）
- 推薦人變更（影響金額和統計）
- 房價變更（影響佣金金額）
- 狀態變更（影響佣金計算）

### 2. 推薦人變更處理（最複雜）
- 如果訂房未完成：調整 total_referrals
- 如果訂房已完成：
  - 撤銷舊推薦人佣金
  - 計算新推薦人佣金
  - 創建相應的 Payout 記錄

### 3. 房價變更處理
- 只有在已計算佣金時才需要調整
- 創建 COMMISSION_ADJUSTMENT 記錄

### 4. 狀態變更處理
- PENDING → COMPLETED：執行確認入住流程
- COMPLETED → CANCELLED：執行取消流程
- CANCELLED → PENDING：重新啟用

## 建議實現方案

```javascript
function handleUpdateBooking(data) {
  // 1. 查找並記錄原始值
  const oldBooking = findRecordById('Bookings', bookingId);
  
  // 2. 檢查變更類型和影響
  const changes = analyzeChanges(oldBooking, data);
  
  // 3. 根據變更類型執行對應邏輯
  if (changes.hasPartnerChange) {
    handlePartnerChange(oldBooking, data);
  }
  
  if (changes.hasPriceChange && oldBooking.commission_status === 'CALCULATED') {
    handlePriceChange(oldBooking, data);
  }
  
  if (changes.hasStatusChange) {
    handleStatusChange(oldBooking, data);
  }
  
  // 4. 更新訂房記錄
  updateRecord('Bookings', bookingId, data);
}
```

## 影響範圍

此修復將確保：
1. 推薦人變更時正確處理佣金轉移
2. 房價調整時正確調整佣金
3. 狀態變更時觸發對應的業務流程
4. 所有金額變動都有審計記錄

## 優先級

**高** - 這是核心業務邏輯，影響佣金計算的準確性