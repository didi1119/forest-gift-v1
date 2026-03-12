# 已驗證佣金規格

最後更新：2026-03-13

這份文件只記錄兩種內容：
- 已在正式 UI 或最新程式碼上實際驗證過的規則
- 會影響帳務與審計紀錄的最終行為

## 1. 等級與基礎佣金

### 1.1 等級門檻
- `LV1_INSIDER`：年度成功推薦 `< 4`
- `LV2_GUIDE`：年度成功推薦 `>= 4`
- `LV3_GUARDIAN`：年度成功推薦 `>= 10`

### 1.2 佣金表
| 等級 | 住宿金 | 現金 |
| --- | --- | --- |
| LV1_INSIDER | 1000 | 500 |
| LV2_GUIDE | 1200 | 600 |
| LV3_GUARDIAN | 1500 | 750 |

### 1.3 升級套用時點
- 觸發升級的那一筆，仍按升級前等級計算
- 升級完成後的下一筆新訂房，才按新等級計算

已驗證：
- `LV1 -> LV2`：第 4 筆仍為 `1000`，第 5 筆變 `1200`
- `LV2 -> LV3`：第 10 筆仍為 `600`，第 11 筆變 `750`

## 2. 首次推薦獎勵

### 2.1 觸發條件
必須同時滿足：
- 等級為 `LV1_INSIDER`
- `commission_preference = ACCOMMODATION`
- 該筆為第一筆有效完成的推薦訂房

### 2.2 金額
- 基礎住宿金 `1000`
- 首次推薦加碼 `1500`
- 合計 `2500`

### 2.3 不觸發的情況
- `LV1 + CASH`
- `LV2 / LV3`
- 不是第一筆有效完成推薦

## 3. 取消與回溯

### 3.1 取消已完成推薦訂房
取消後必做：
- `Bookings.stay_status = CANCELLED`
- `Bookings.commission_status = CANCELLED`
- 建立 `COMMISSION_REVERSAL` payout
- 扣回 `Partners.total_commission_earned`
- 扣回對應餘額：
  - 住宿金：`available_points`
  - 現金：`pending_commission`

### 3.2 取消導致等級改變
如果取消後，剩餘有效完成訂房的序位改變，則：
- 必須重新回放所有仍為 `COMPLETED` 的推薦訂房
- 必須重算每一筆的等級、佣金與首次推薦狀態
- 必須更新受影響的 `Bookings`
- 必須建立 `LEVEL_ADJUSTMENT` payout 審計差額

這是回溯修改，不是只影響未來新單。

### 3.3 首次推薦獎勵轉移
如果被取消的是原本的第一筆有效完成推薦：
- 首次推薦獎勵必須轉移到新的第一筆有效完成推薦
- 新的第一筆要更新：
  - `commission_amount`
  - `is_first_referral_bonus`
  - `first_referral_bonus_amount`
- 同時建立 `LEVEL_ADJUSTMENT` payout

已驗證：
- 原第 1 筆取消後，原第 2 筆由 `1000 -> 2500`
- payout trail 出現 `LEVEL_ADJUSTMENT +1500`

## 4. 餘額不足與負債

### 4.1 已結算現金後取消原訂房
如果該筆現金佣金已經被結算，導致 `pending_commission` 不足以扣回：
- `pending_commission` 歸零
- 已支付歷史 `total_commission_paid` 保留不回寫
- 差額建立 `DEBT_RECORD`

已驗證：
- 佣金 `500` 已結算後取消
- `pending_commission = 0`
- `total_commission_paid = 500`
- payout trail 出現 `DEBT_RECORD -500`

### 4.2 住宿金已花掉後取消原訂房
如果原佣金已折抵使用，導致 `available_points` 不足以扣回：
- `available_points` 歸零
- 差額建立 `DEBT_RECORD`

已驗證：
- 賺得 `1000` 點後全數折抵，再取消原訂房
- `available_points = 0`
- payout trail 出現 `DEBT_RECORD -1000`

## 5. Payout 審計類型

下列 payout 類型目前已在真實流程中驗證：
- `ACCOMMODATION`
- `CASH`
- `CASH_CONVERSION`
- `PAYMENT_COMPLETED`
- `POINTS_ADJUSTMENT`
- `POINTS_ADJUSTMENT_DEBIT`
- `POINTS_REFUND`
- `CASH_ADJUSTMENT`
- `COMMISSION_REVERSAL`
- `LEVEL_ADJUSTMENT`
- `DEBT_RECORD`

## 6. 驗證來源

已用真實瀏覽器與 Supabase 比對驗證：
- 手動新增、編輯、確認入住、刪單
- 使用住宿金、點數轉現金、結算、轉回住宿金
- 手動調整
- 取消結算
- 首次推薦獎勵轉移
- 取消導致等級回溯
- 已結算/已使用後取消產生負債

若未來文件與此文件衝突，以此文件與實際程式碼為準。
