# 邏輯問題清單

## 🔴 嚴重問題（必須修復）

### 1. handleCreateBooking - SELF_USE 不應增加推薦統計
```javascript
// 現在的問題代碼（第478-479行）
if (data.partner_code) {
  updatePartnerReferralStats(data.partner_code, 1);
}

// 應該改為
if (data.partner_code && bookingSource !== 'SELF_USE') {
  updatePartnerReferralStats(data.partner_code, 1);
}
```

### 2. handlePartnerChange - 新推薦人佣金計算條件錯誤
```javascript
// 問題：第915行開始，沒有檢查訂房狀態
if (newPartnerCode) {
  const newPartner = findPartnerByCode(newPartnerCode);
  if (newPartner) {
    // 錯誤：未完成的訂房也會計算佣金

// 應該改為
if (newPartnerCode && oldBooking.stay_status === 'COMPLETED') {
  // 只有已完成的訂房才計算新推薦人佣金
```

## ⚠️ 中等問題（應該修復）

### 3. handleCancelPayout - 撤銷邏輯過於簡單
```javascript
// 問題：第1194-1196行
// 不應該對所有類型的 Payout 都減少推薦數
if (payout.related_booking_ids) {
  partnerUpdates.successful_referrals = Math.max(0, (partner.successful_referrals || 0) - 1);

// 建議：只對真正的佣金 Payout 處理
// CASH_CONVERSION、POINTS_ADJUSTMENT 等不應影響推薦統計
```

### 4. Payout 金額符號不一致
- POINTS_REFUND 用正數（第1036行）
- COMMISSION_REVERSAL 用負數（第1210行）
- 建議統一規則：增加用正數，減少用負數

### 5. 循環調用風險
`handleStatusChange` → `handleConfirmCheckinCompletion` → 可能又觸發狀態變更
需要加入防護機制避免無限循環

## 💡 優化建議

### 6. handleDeleteBooking - 應該檢查是否能取消
```javascript
// 建議加入業務規則檢查
if (booking.data.stay_status === 'COMPLETED' && 
    已經過了某個時間) {
  throw new Error('已完成的訂房超過時限無法取消');
}
```

### 7. 佣金計算時機
- 確認入住時計算佣金是否應該考慮入住日期？
- 是否有過期規則？

### 8. 等級降級規則
- 現在是根據 yearly_referrals 降級
- 但如果跨年度，yearly_referrals 應該重置嗎？

## 資料一致性檢查

### 9. Partners 表公式驗證
```javascript
// 需要定期檢查這些公式是否成立
available_points = 所有住宿金佣金總和 - points_used + 返還 + 調整
pending_commission = 所有現金佣金 + 轉換現金 - 已支付 + 調整
total_commission_earned = 所有佣金（不應該因為使用而減少）
```

### 10. 併發問題
- 如果同時有多個操作更新同一個 Partner
- Google Sheets 沒有事務機制
- 可能造成資料不一致

## 修復優先級

1. **立即修復**：問題 1、2（影響核心業務邏輯）
2. **盡快修復**：問題 3、4（影響資料準確性）
3. **評估後修復**：問題 5、6（需要討論業務規則）
4. **長期優化**：問題 7-10（系統優化）