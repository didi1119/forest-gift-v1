# 🔧 取消結算功能修復說明

## 🚨 問題描述

您發現的嚴重問題：
1. **佣金錯誤增加**：取消結算後，大使的待結算金額反而增加了（應該要減少）
2. **訂單狀態未更新**：相關訂單仍維持「完成入住」狀態（應該改回「待結算」）
3. **邏輯錯誤**：系統將取消的金額**加回**佣金，而不是**扣除**

## 🔍 根本原因

### 錯誤的程式碼（第 1333 行）：
```javascript
// ❌ 錯誤：將金額加回待支付佣金
const newPendingCommission = currentPendingCommission + payoutAmount;
```

### 正確的邏輯應該是：
```javascript
// ✅ 正確：從佣金中扣除
const newTotalEarned = currentTotalEarned - payoutAmount;
const newPendingCommission = currentPendingCommission - payoutAmount;
```

## ✅ 修復內容

### 1. 修正佣金計算邏輯
- **取消普通結算**：從累積佣金和待支付佣金中**扣除**金額
- **取消手動調整**：執行反向操作

### 2. 新增訂單狀態更新
- 找到相關訂單（根據 related_booking_ids）
- 將佣金狀態改回 `PENDING`
- 記錄更新日誌

### 3. 修復後的流程
```
取消結算 → 刪除結算記錄
        ↓
    扣除大使佣金（不是增加）
        ↓
    更新相關訂單狀態為 PENDING
        ↓
    記錄操作日誌
```

## 📊 影響分析

### 已發生的問題：
- 大使佣金被錯誤增加
- 訂單狀態不一致
- 財務數據錯誤

### 修復後的改善：
- ✅ 取消結算會正確扣除佣金
- ✅ 相關訂單會改回待結算狀態
- ✅ 防止重複計算佣金

## 🚀 部署步驟

### 1. 立即部署後端修復
```
1. 開啟 Google Apps Script
2. 複製 backend/apps-script-commission-v2.js 內容
3. 貼上並儲存
4. 點擊「部署」→「管理部署」→「編輯」→「新版本」
5. 描述：「修復取消結算的佣金計算錯誤」
6. 點擊「更新」
```

### 2. 修復現有錯誤數據
需要手動檢查並修正：
- 找出所有被取消的結算記錄
- 重新計算受影響大使的佣金
- 更新相關訂單狀態

## ⚠️ 重要提醒

### 緊急修復建議：
1. **立即停止**所有取消結算操作
2. **部署修復**後才繼續使用
3. **審計數據**找出所有受影響的記錄

### 數據修復 SQL（概念）：
```sql
-- 找出所有被錯誤處理的大使
SELECT partner_code, total_commission_earned, pending_commission
FROM Partners
WHERE pending_commission > total_commission_earned;

-- 修正佣金（需要根據實際情況調整）
UPDATE Partners
SET pending_commission = pending_commission - (2 * cancelled_amount)
WHERE affected = true;
```

## 🔍 測試驗證

### 測試步驟：
1. 創建測試訂單並確認入住
2. 檢查大使佣金（記錄數值）
3. 取消該筆結算
4. 驗證：
   - ✅ 佣金應該**減少**（不是增加）
   - ✅ 訂單狀態改為 PENDING
   - ✅ 結算記錄被刪除

### 預期結果：
```
取消前：累積佣金 $1000，待支付 $1000
取消後：累積佣金 $0，待支付 $0
（而不是：累積佣金 $1000，待支付 $2000）
```

## 📝 日誌檢查

部署後在 Google Apps Script 查看日誌應該看到：
```
❌ 取消結算，扣除累積佣金: 1000 → 0
❌ 取消結算，扣除待支付佣金: 1000 → 0
📦 訂單 123 佣金狀態已改回 PENDING
```

## 🆘 緊急聯絡

如果發現更多問題：
1. 立即停止所有操作
2. 備份當前數據
3. 記錄所有異常情況

---

**修復版本**：2024-08-17
**問題嚴重性**：🔴 高（財務數據錯誤）
**建議**：立即部署修復