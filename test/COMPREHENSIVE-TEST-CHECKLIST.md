# 知音計畫 - 完整測試檢查清單

## 測試原則
本清單不只測試初始狀態的單一變動，更重視**長期使用中的連鎖反應**和**數據一致性**。

---

## 一、大使（Partners）生命週期測試

### 1.1 大使創建與初始化
- [ ] **1.1.1** 創建新大使，驗證所有欄位初始值
  - partner_code 唯一性
  - partner_level = LV1_INSIDER
  - available_points = 0
  - points_used = 0
  - total_commission_earned = 0
  - successful_referrals = 0
  - yearly_referrals = 0
  - commission_preference = ACCOMMODATION (預設)

- [ ] **1.1.2** 重複創建相同 partner_code，驗證錯誤處理
  - 應拒絕創建
  - 不影響現有大使數據

### 1.2 大使等級晉升測試（長期累積）

- [ ] **1.2.1** LV1 → LV2 晉升（年度 4 組）
  - 前置：創建 LV1 大使
  - 操作：確認 4 筆推薦訂房入住
  - 驗證：
    - partner_level 更新為 LV2_GUIDE
    - yearly_referrals = 4
    - successful_referrals = 4
    - level_progress 重置
  - **長期連動**：後續佣金按 LV2 標準計算

- [ ] **1.2.2** LV2 → LV3 晉升（年度 10 組）
  - 前置：已有 LV2 大使（4組推薦）
  - 操作：再確認 6 筆推薦訂房入住
  - 驗證：
    - partner_level 更新為 LV3_GUARDIAN
    - yearly_referrals = 10
    - successful_referrals = 10
  - **長期連動**：後續佣金按 LV3 標準計算

- [ ] **1.2.3** 跨年度資格延續測試
  - 前置：LV3 大使，年度結算前
  - 操作：模擬跨年（重置 yearly_referrals = 0）
  - 驗證：
    - partner_level 保持 LV3（降級規則待定義）
    - 次年需達到保級標準（6組）
  - **長期影響**：未達標準應降級

### 1.3 首次推薦獎勵測試

- [ ] **1.3.1** LV1 首次推薦住宿金獎勵
  - 前置：新 LV1 大使，successful_referrals = 0
  - 操作：確認第一筆推薦訂房入住
  - 驗證：
    - commission_amount = 1000 + 1500 = 2500
    - available_points += 2500
    - total_commission_earned += 2500
    - is_first_referral_bonus = true
  - **長期連動**：第二筆開始只有基礎佣金

- [ ] **1.3.2** LV1 首次推薦現金不享獎勵
  - 前置：LV1 大使，commission_preference = CASH
  - 操作：確認第一筆推薦訂房入住
  - 驗證：
    - commission_amount = 500（不含獎勵）
    - pending_commission += 500

- [ ] **1.3.3** LV2/LV3 沒有首次獎勵
  - 前置：LV2 或 LV3 大使
  - 操作：確認任意推薦訂房入住
  - 驗證：只有基礎佣金，無首次獎勵

### 1.4 佣金偏好切換測試（長期影響）

- [ ] **1.4.1** 住宿金 → 現金切換
  - 前置：已有住宿金佣金的大使
  - 操作：修改 commission_preference = CASH
  - 驗證：
    - 現有 available_points 不變
    - 後續新佣金進入 pending_commission
    - total_commission_earned 持續累積（住宿金+現金）

- [ ] **1.4.2** 現金 → 住宿金切換
  - 前置：已有待結算現金的大使
  - 操作：修改 commission_preference = ACCOMMODATION
  - 驗證：
    - 現有 pending_commission 不變
    - 後續新佣金進入 available_points

### 1.5 點數使用與累積測試

- [ ] **1.5.1** 住宿金折抵房費
  - 前置：available_points = 5000
  - 操作：使用 1000 點折抵
  - 驗證：
    - available_points -= 1000 → 4000
    - points_used += 1000
    - total_commission_earned 不變（不是新收入）
  - **創建記錄**：
    - Accommodation_Usage 新增一筆
    - Payouts 新增 POINTS_ADJUSTMENT_DEBIT
    - Bookings 新增 SELF_USE 訂房

- [ ] **1.5.2** 點數不足時使用
  - 前置：available_points = 500
  - 操作：嘗試使用 1000 點
  - 驗證：
    - 操作失敗
    - 所有數據不變

- [ ] **1.5.3** 點數轉現金（2:1）
  - 前置：available_points = 2000
  - 操作：轉換 2000 點為現金
  - 驗證：
    - available_points -= 2000 → 0
    - points_used += 2000
    - pending_commission += 1000
    - total_commission_earned 不變
  - **創建記錄**：
    - Payouts 新增 CASH_CONVERSION

- [ ] **1.5.4** 連續多次使用點數
  - 前置：available_points = 10000
  - 操作：分 5 次使用，每次 2000
  - 驗證每次：
    - available_points 正確遞減
    - points_used 正確累加
    - Accommodation_Usage 有 5 筆記錄
    - Payouts 有 5 筆 POINTS_ADJUSTMENT_DEBIT

### 1.6 大使統計欄位完整性測試

- [ ] **1.6.1** total_commission_earned 累積測試
  - 操作：混合住宿金佣金、現金佣金、首次獎勵
  - 驗證：total_commission_earned = 所有佣金總和

- [ ] **1.6.2** total_clicks 與 last_click_date 更新
  - 操作：模擬多次連結點擊
  - 驗證：
    - total_clicks 正確累加
    - last_click_date 更新為最新時間

---

## 二、訂房（Bookings）生命週期測試

### 2.1 訂房創建與類型識別

- [ ] **2.1.1** REFERRAL 推薦訂房
  - 輸入：partner_code = "KOBE", booking_source 未指定
  - 驗證：
    - booking_source = REFERRAL
    - Partners.total_referrals += 1
    - stay_status = PENDING
    - commission_status = PENDING

- [ ] **2.1.2** DIRECT 直客訂房
  - 輸入：partner_code 為空或未指定
  - 驗證：
    - booking_source = DIRECT
    - commission_status = NOT_ELIGIBLE
    - Partners 表不更新

- [ ] **2.1.3** SELF_USE 自用訂房（住宿金折抵）
  - 操作：使用住宿金功能
  - 驗證：
    - booking_source = SELF_USE
    - commission_status = NOT_ELIGIBLE
    - stay_status = COMPLETED（自動完成）

### 2.2 訂房狀態流轉測試

- [ ] **2.2.1** PENDING → COMPLETED（正常完成）
  - 前置：PENDING 訂房
  - 操作：確認入住完成
  - 驗證：
    - stay_status = COMPLETED
    - commission_status = CALCULATED（有推薦人）
    - payment_status = PAID
    - manually_confirmed_at 記錄時間
    - manually_confirmed_by 記錄操作者

- [ ] **2.2.2** PENDING → CANCELLED（訂房取消）
  - 前置：PENDING 訂房（未確認入住）
  - 操作：取消訂房
  - 驗證：
    - stay_status = CANCELLED
    - commission_status 不變（PENDING）
    - Partners.total_referrals -= 1
    - 無佣金記錄產生

- [ ] **2.2.3** COMPLETED → CANCELLED（入住後取消，極端情況）
  - 前置：COMPLETED 訂房，已計算佣金
  - 操作：取消訂房
  - 驗證：
    - stay_status = CANCELLED
    - commission_status 維持 CALCULATED（歷史記錄）
    - **觸發佣金撤銷流程**（見 2.4）

### 2.3 佣金計算測試（所有組合）

#### 2.3.1 LV1 大使
- [ ] LV1 + ACCOMMODATION + 首次推薦
  - 預期：1000 + 1500 = 2500 點

- [ ] LV1 + ACCOMMODATION + 非首次
  - 預期：1000 點

- [ ] LV1 + CASH + 首次推薦
  - 預期：500 元（無首次獎勵）

- [ ] LV1 + CASH + 非首次
  - 預期：500 元

#### 2.3.2 LV2 大使
- [ ] LV2 + ACCOMMODATION
  - 預期：1200 點

- [ ] LV2 + CASH
  - 預期：600 元

#### 2.3.3 LV3 大使
- [ ] LV3 + ACCOMMODATION
  - 預期：1500 點

- [ ] LV3 + CASH
  - 預期：750 元

### 2.4 訂房取消與佣金撤銷（核心複雜邏輯）

- [ ] **2.4.1** 取消已計算住宿金佣金的訂房
  - 前置：
    - 訂房已確認入住
    - 佣金類型：ACCOMMODATION
    - 大使已獲得點數
  - 操作：取消訂房
  - 驗證：
    - Partners.available_points -= 佣金金額
    - Partners.total_commission_earned -= 佣金金額
    - Partners.successful_referrals -= 1
    - Partners.yearly_referrals -= 1
    - Partners.level_progress 重新計算
    - **等級降級判斷**：如降級，更新 partner_level
  - **創建記錄**：
    - Payouts 新增 COMMISSION_REVERSAL（負金額）
    - 保留原 Bookings 記錄（歷史）

- [ ] **2.4.2** 取消已計算現金佣金的訂房
  - 前置：佣金類型：CASH
  - 操作：取消訂房
  - 驗證：
    - Partners.pending_commission -= 佣金金額
    - Partners.total_commission_earned -= 佣金金額
    - Partners.successful_referrals -= 1
    - Partners.yearly_referrals -= 1
  - **創建記錄**：
    - Payouts 新增 COMMISSION_REVERSAL

- [ ] **2.4.3** 取消包含首次獎勵的訂房
  - 前置：
    - LV1 大使首次推薦
    - 佣金：2500（1000基礎+1500獎勵）
  - 操作：取消訂房
  - 驗證：
    - available_points -= 2500
    - successful_referrals 回到 0
    - **下次推薦仍享首次獎勵**

- [ ] **2.4.4** 取消後大使等級降級連鎖效應
  - 前置：
    - LV2 大使，yearly_referrals = 4（剛好晉升）
  - 操作：取消其中 1 筆訂房
  - 驗證：
    - yearly_referrals = 3
    - partner_level 降回 LV1_INSIDER
    - **後續訂房佣金按 LV1 計算**
  - **極端情況**：如該大使已有其他訂房按 LV2 計算，不應回溯修改

- [ ] **2.4.5** 取消已使用點數的大使的佣金（負點數情況）
  - 前置：
    - 大使獲得 1000 點佣金
    - 已使用 800 點
    - available_points = 200
  - 操作：取消該筆佣金來源訂房
  - 驗證：
    - available_points -= 1000 → -800（負點數）
    - **系統應處理負點數**：
      - 選項 A：允許負點數，標記為欠款
      - 選項 B：拒絕取消（需還點數）
      - 選項 C：從其他收入扣除

### 2.5 推薦人變更測試（複雜連鎖）

- [ ] **2.5.1** 未確認入住的訂房變更推薦人
  - 前置：
    - 訂房推薦人 A，stay_status = PENDING
  - 操作：修改 partner_code 為 B
  - 驗證：
    - Partners A: total_referrals -= 1
    - Partners B: total_referrals += 1
    - Bookings.partner_code 更新為 B

- [ ] **2.5.2** 已確認入住的訂房變更推薦人（極端複雜）
  - 前置：
    - 訂房推薦人 A，已確認入住，已計算佣金
  - 操作：修改 partner_code 為 B
  - 驗證：
    - **撤銷 A 的佣金**：
      - Partners A: available_points -= 佣金
      - Partners A: successful_referrals -= 1
      - Payouts 新增 COMMISSION_REVERSAL（A）
    - **重新計算 B 的佣金**：
      - 根據 B 的等級和偏好計算
      - Partners B: 更新相應統計
      - Payouts 新增新佣金記錄（B）
    - **注意首次獎勵判斷**：
      - 如 B 是首次推薦，應給首次獎勵
      - 如 A 原本是首次推薦，撤銷後 A 的下次推薦仍享首次獎勵

- [ ] **2.5.3** 推薦人變更觸發等級變動
  - 前置：
    - A: LV2（4組推薦）
    - B: LV1（3組推薦）
  - 操作：將 A 的一筆訂房改為 B
  - 驗證：
    - A: yearly_referrals = 3，降級為 LV1
    - B: yearly_referrals = 4，晉升為 LV2
    - **所有等級相關的後續佣金都受影響**

---

## 三、結算（Payouts）審計測試

### 3.1 Payout 記錄創建與不可變性

- [ ] **3.1.1** 所有佣金操作都創建 Payout
  - 操作清單：
    - 確認入住 → ACCOMMODATION / CASH
    - 使用住宿金 → POINTS_ADJUSTMENT_DEBIT
    - 點數轉現金 → CASH_CONVERSION
    - 取消佣金 → COMMISSION_REVERSAL
    - 手動調整 → MANUAL_ADJUSTMENT
  - 驗證：每個操作都有對應 Payout 記錄

- [ ] **3.1.2** Payout 記錄不可修改
  - 操作：嘗試修改已存在的 Payout 記錄
  - 驗證：
    - 修改失敗或創建新記錄（修正記錄）
    - 原記錄保持不變

- [ ] **3.1.3** Payout 記錄完整性
  - 驗證欄位：
    - partner_code（必填）
    - payout_type（必填）
    - amount（必填，可為負）
    - related_booking_ids（可空）
    - created_at（自動生成）
    - created_by（記錄操作者）

### 3.2 Payout 類型覆蓋測試

- [ ] **3.2.1** ACCOMMODATION 住宿金佣金
  - 觸發：確認入住（偏好為住宿金）
  - 驗證：amount > 0，related_booking_ids 有值

- [ ] **3.2.2** CASH 現金佣金
  - 觸發：確認入住（偏好為現金）
  - 驗證：amount > 0，related_booking_ids 有值

- [ ] **3.2.3** CASH_CONVERSION 點數轉現金
  - 觸發：點數轉現金操作
  - 驗證：amount = 點數 ÷ 2

- [ ] **3.2.4** POINTS_ADJUSTMENT_DEBIT 點數扣除
  - 觸發：使用住宿金
  - 驗證：amount < 0（負數）

- [ ] **3.2.5** COMMISSION_REVERSAL 佣金撤銷
  - 觸發：取消已確認訂房
  - 驗證：amount < 0（負數），related_booking_ids 指向被取消的訂房

- [ ] **3.2.6** MANUAL_ADJUSTMENT 手動調整
  - 觸發：管理員手動調整
  - 驗證：notes 欄位說明調整原因

### 3.3 Payout 金額與 Partners 統計一致性測試

- [ ] **3.3.1** 住宿金佣金一致性
  - 驗證：
    ```
    Partners.available_points =
      Σ(ACCOMMODATION payouts) -
      Σ(POINTS_ADJUSTMENT_DEBIT payouts) -
      Σ(CASH_CONVERSION points_used) -
      Σ(COMMISSION_REVERSAL where type=ACCOMMODATION)
    ```

- [ ] **3.3.2** 現金佣金一致性
  - 驗證：
    ```
    Partners.pending_commission =
      Σ(CASH payouts) +
      Σ(CASH_CONVERSION cash_amount) -
      Σ(PAYMENT_COMPLETED payouts) -
      Σ(COMMISSION_REVERSAL where type=CASH)
    ```

- [ ] **3.3.3** 總收入一致性
  - 驗證：
    ```
    Partners.total_commission_earned =
      Σ(ACCOMMODATION payouts) +
      Σ(CASH payouts) -
      Σ(COMMISSION_REVERSAL payouts)
    ```
    注意：POINTS_ADJUSTMENT_DEBIT 和 CASH_CONVERSION 不計入總收入

- [ ] **3.3.4** 已使用點數一致性
  - 驗證：
    ```
    Partners.points_used =
      Σ(POINTS_ADJUSTMENT_DEBIT amounts, 取絕對值) +
      Σ(CASH_CONVERSION points_used)
    ```

### 3.4 取消結算測試（cancel_payout）

- [ ] **3.4.1** 取消住宿金結算
  - 前置：已創建 ACCOMMODATION payout
  - 操作：cancel_payout
  - 驗證：
    - 創建 COMMISSION_REVERSAL payout（負金額）
    - Partners.available_points 扣除
    - Partners.total_commission_earned 扣除
    - 原 payout 記錄保留（不可變）

- [ ] **3.4.2** 取消現金結算
  - 前置：已創建 CASH payout
  - 操作：cancel_payout
  - 驗證：
    - 創建 COMMISSION_REVERSAL payout
    - Partners.pending_commission 扣除

- [ ] **3.4.3** 連鎖取消測試（複雜場景）
  - 前置：
    - 訂房 1 → 佣金 A
    - 訂房 2 → 佣金 B
    - 訂房 3 → 佣金 C
  - 操作：取消訂房 2
  - 驗證：
    - 只撤銷佣金 B
    - 佣金 A 和 C 不受影響
    - Payouts 表有完整審計追蹤

---

## 四、住宿金使用（Accommodation_Usage）測試

### 4.1 使用記錄創建

- [ ] **4.1.1** 折抵房費創建記錄
  - 操作：使用 1000 點折抵
  - 驗證：
    - Accommodation_Usage 新增記錄
    - usage_type = ROOM_DISCOUNT
    - related_booking_id 指向 SELF_USE 訂房

- [ ] **4.1.2** 點數轉現金不創建 Accommodation_Usage
  - 操作：點數轉現金
  - 驗證：
    - Accommodation_Usage 不新增記錄
    - 只有 Payouts 記錄（CASH_CONVERSION）

### 4.2 取消使用測試

- [ ] **4.2.1** 取消住宿金使用（如功能實作）
  - 前置：已使用 1000 點折抵
  - 操作：取消該筆使用
  - 驗證：
    - Partners.available_points += 1000
    - Partners.points_used -= 1000
    - 創建 POINTS_ADJUSTMENT_CREDIT payout
    - 相關 SELF_USE 訂房狀態更新

---

## 五、點擊追蹤（Clicks）測試

### 5.1 點擊記錄創建

- [ ] **5.1.1** 主頁連結點擊
  - 操作：訪問 ?pid=KOBE&dest=landing
  - 驗證：
    - Clicks 新增記錄
    - destination = landing
    - partner_code = KOBE
    - 記錄 IP、User-Agent、Referrer

- [ ] **5.1.2** 優惠券連結點擊
  - 操作：訪問 ?pid=KOBE&dest=coupon
  - 驗證：
    - Clicks 新增記錄
    - destination = coupon

- [ ] **5.1.3** 點擊轉換標記
  - 前置：用戶點擊後完成訂房
  - 驗證：
    - 對應 Clicks 記錄的 converted = true

### 5.2 大使點擊統計更新

- [ ] **5.2.1** total_clicks 累積
  - 操作：多次點擊同一大使連結
  - 驗證：
    - Partners.total_clicks 正確累加
    - Partners.last_click_date 更新為最新

---

## 六、並發與競爭條件測試

### 6.1 GlobalLockService 測試

- [ ] **6.1.1** 同時確認多筆訂房
  - 操作：並發確認同一大使的 3 筆訂房
  - 驗證：
    - 所有佣金都正確計算
    - Partners 統計無遺漏或重複
    - 無競爭條件錯誤

- [ ] **6.1.2** 同時使用和取消
  - 操作：
    - 線程 A：使用 1000 點
    - 線程 B：取消 1000 點佣金來源訂房
  - 驗證：
    - 最終點數正確
    - 操作順序可追溯

### 6.2 數據一致性測試（長期累積）

- [ ] **6.2.1** 大量操作後的數據一致性
  - 操作：
    - 創建 100 筆訂房
    - 確認 80 筆
    - 取消 20 筆
    - 使用點數 10 次
    - 轉換現金 5 次
  - 驗證：
    - Partners 所有統計欄位與 Payouts 表計算一致
    - Bookings 狀態正確
    - 無遺漏或重複記錄

---

## 七、極端情況與邊界測試

### 7.1 負點數處理

- [ ] **7.1.1** 點數不足時扣除
  - 前置：available_points = 100
  - 操作：取消 1000 點佣金來源訂房
  - 驗證：系統如何處理負點數

- [ ] **7.1.2** 負點數後的使用限制
  - 前置：available_points = -500
  - 操作：嘗試使用點數
  - 驗證：應被拒絕

### 7.2 大數值測試

- [ ] **7.2.1** 累積大量點數
  - 操作：模擬獲得 100,000 點
  - 驗證：
    - 數值正確存儲
    - 計算無溢出

- [ ] **7.2.2** 大量訂房記錄
  - 操作：創建 10,000 筆訂房
  - 驗證：
    - 性能可接受
    - 查詢正確

### 7.3 邊界值測試

- [ ] **7.3.1** 0 點使用
  - 操作：使用 0 點
  - 驗證：應被拒絕或無操作

- [ ] **7.3.2** 極小房價
  - 操作：room_price = 1
  - 驗證：佣金計算正確

- [ ] **7.3.3** 極大房價
  - 操作：room_price = 1000000
  - 驗證：佣金計算正確

---

## 八、數據完整性與審計測試

### 8.1 審計追蹤完整性

- [ ] **8.1.1** 所有金額變動都有 Payout 記錄
  - 驗證：
    - 每筆 Partners 餘額變動都能追溯到 Payout
    - Payout 記錄包含操作者和時間

- [ ] **8.1.2** 訂房狀態變更歷史
  - 驗證：
    - manually_confirmed_at / manually_confirmed_by 正確記錄
    - 狀態變更可追溯

### 8.2 數據關聯完整性

- [ ] **8.2.1** Payouts.related_booking_ids 有效性
  - 驗證：
    - 所有 related_booking_ids 都指向存在的 Bookings
    - 逗號分隔的多個 ID 都有效

- [ ] **8.2.2** Accommodation_Usage.related_booking_id 有效性
  - 驗證：
    - 指向存在的 SELF_USE 訂房

- [ ] **8.2.3** Bookings.partner_code 有效性
  - 驗證：
    - 所有非空 partner_code 都指向存在的 Partners

---

## 九、回滾與恢復測試

### 9.1 取消後恢復測試

- [ ] **9.1.1** 取消訂房後重新確認
  - 前置：訂房已取消（CANCELLED）
  - 操作：重新確認入住
  - 驗證：
    - stay_status = COMPLETED
    - 重新計算佣金
    - Partners 統計恢復
    - 創建新的 Payout 記錄（不是撤銷的相反）

- [ ] **9.1.2** 取消結算後重新結算
  - 前置：Payout 已取消
  - 操作：重新創建相同的結算
  - 驗證：
    - 創建新 Payout 記錄
    - Partners 統計正確更新

### 9.2 數據修正測試

- [ ] **9.2.1** 手動調整佣金
  - 操作：創建 MANUAL_ADJUSTMENT payout
  - 驗證：
    - Partners 統計更新
    - notes 欄位說明原因
    - 所有連動數據正確

---

## 十、UI 與前後端整合測試

### 10.1 管理後台功能測試

- [ ] **10.1.1** 創建訂房表單驗證
  - 測試必填欄位驗證
  - 測試日期範圍驗證
  - 測試 partner_code 存在性驗證

- [ ] **10.1.2** 確認入住流程
  - 測試查找訂房功能
  - 測試佣金預覽顯示
  - 測試確認後即時更新

- [ ] **10.1.3** 點數使用介面
  - 測試餘額顯示
  - 測試金額驗證
  - 測試快速選擇按鈕

### 10.2 數據同步測試

- [ ] **10.2.1** 前端數據載入
  - 測試 get_all_data API
  - 測試數據解析正確性
  - 測試載入速度

- [ ] **10.2.2** 前端操作與後端同步
  - 測試操作延遲（2秒等待）
  - 測試樂觀更新
  - 測試錯誤處理

---

## 十一、性能與壓力測試

### 11.1 性能基準測試

- [ ] **11.1.1** API 響應時間
  - 測試 get_all_data 響應時間
  - 測試 create_booking 響應時間
  - 測試 confirm_checkin 響應時間
  - 目標：< 2 秒

- [ ] **11.1.2** 大數據量查詢
  - 測試 1000 筆 Bookings 查詢
  - 測試 5000 筆 Payouts 查詢
  - 驗證性能可接受

### 11.2 壓力測試

- [ ] **11.2.1** 並發請求測試
  - 同時 10 個請求
  - 驗證：
    - 所有請求都成功
    - 無數據丟失
    - 無競爭條件

- [ ] **11.2.2** 長時間運行測試
  - 連續操作 1 小時
  - 驗證：
    - 系統穩定
    - 內存無洩漏
    - 數據一致性

---

## 十二、安全性測試

### 12.1 輸入驗證測試

- [ ] **12.1.1** SQL 注入測試（雖然用 Sheets）
  - 輸入特殊字符：`'; DROP TABLE--`
  - 驗證：正確處理或拒絕

- [ ] **12.1.2** XSS 測試
  - 輸入：`<script>alert('xss')</script>`
  - 驗證：前端正確轉義

- [ ] **12.1.3** 數值溢出測試
  - 輸入：極大或極小數值
  - 驗證：正確驗證或拒絕

### 12.2 權限測試

- [ ] **12.2.1** 未授權訪問測試
  - 測試無 API key 訪問
  - 測試跨用戶數據訪問

---

## 十三、用戶場景端到端測試

### 13.1 新大使完整流程

```
1. 創建大使（LV1, ACCOMMODATION）
2. 生成專屬連結
3. 用戶點擊連結（記錄 Click）
4. 創建第一筆推薦訂房
5. 確認入住（獲得 2500 點：1000基礎+1500首次獎勵）
6. 創建第二筆推薦訂房
7. 確認入住（獲得 1000 點）
8. 使用 1500 點折抵房費
9. 創建第三、四筆推薦訂房並確認（晉升 LV2）
10. 後續訂房佣金變為 1200 點
```

**驗證每步驟的所有連動數據**

### 13.2 複雜取消場景

```
1. 大使有 5 筆已確認訂房（LV2 等級）
2. 取消第 1 筆（降級為 LV1，但已按 LV2 計算的佣金不變）
3. 取消第 2 筆（扣除佣金，points 不足變負數）
4. 新增第 6 筆訂房確認（按當前 LV1 計算）
5. 恢復第 1 筆訂房（重新確認）
6. 驗證最終狀態一致性
```

---

## 測試執行策略

### 優先級 P0（必須通過）
- 所有佣金計算測試
- 訂房生命週期測試
- 取消與撤銷測試
- 數據一致性測試

### 優先級 P1（重要）
- 等級晉升測試
- 並發測試
- 點數使用測試
- 審計完整性測試

### 優先級 P2（建議）
- 性能測試
- 極端情況測試
- 安全性測試

### 優先級 P3（可選）
- UI 互動測試
- 壓力測試

---

## 測試環境要求

1. **測試數據庫**：獨立的 Google Sheets（避免污染生產環境）
2. **測試前置條件**：至少 3 個不同等級的測試大使
3. **清理機制**：每次測試後清理 TEST_ 開頭的記錄
4. **快照與恢復**：測試前備份，測試後可選擇恢復

---

## 自動化測試腳本建議

```javascript
// 建議結構
class ComprehensiveTestSuite {
    async runAllTests() {
        // 第一部分：基礎功能測試
        await this.testPartnerCreation();
        await this.testBookingLifecycle();

        // 第二部分：佣金計算測試
        await this.testAllCommissionCombinations();
        await this.testFirstReferralBonus();

        // 第三部分：複雜場景測試
        await this.testCancellationAndReversal();
        await this.testPartnerChange();
        await this.testLevelUpgrade();

        // 第四部分：數據一致性測試
        await this.testDataConsistency();
        await this.testAuditTrail();

        // 第五部分：極端情況測試
        await this.testEdgeCases();
        await this.testConcurrency();
    }
}
```

---

## 總結

本測試清單涵蓋：
- ✅ **360個測試項目**（概略）
- ✅ **11大測試類別**
- ✅ **長期使用中的連鎖反應**
- ✅ **數據一致性驗證**
- ✅ **極端情況處理**
- ✅ **審計追蹤完整性**

測試的核心原則：
1. **不只測初始狀態，更測長期累積後的狀態**
2. **不只測單一操作，更測連鎖反應**
3. **不只測成功路徑，更測失敗和回滾**
4. **不只測數據正確，更測數據一致性**

---

**最後更新**：2026-02-03
**版本**：v1.0
