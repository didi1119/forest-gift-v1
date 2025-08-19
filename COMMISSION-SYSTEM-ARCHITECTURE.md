# 知音計畫 - 佣金制度架構文檔

## 一、佣金制度概述

### 1.1 核心理念
- 森林住宿大使推薦系統
- 透過分級制度激勵大使持續推薦
- 住宿金與現金雙軌選擇機制
- 首次推薦特別獎勵（LV1專屬）

### 1.2 關鍵數據表
- **Partners** - 大使資料（主鍵：partner_code）
- **Bookings** - 訂房記錄（主鍵：id）
- **Payouts** - 結算記錄（主鍵：id）- 所有金額變動的不可變審計記錄
- **Accommodation_Usage** - 住宿金使用記錄（主鍵：id）
- **Clicks** - 點擊追蹤（主鍵：id）

## 二、大使等級制度

### 2.1 等級定義
| 等級 | 代碼 | 名稱 | 晉升條件 |
|------|------|------|----------|
| LV1 | LV1_INSIDER | 知音大使 | 初始等級 |
| LV2 | LV2_GUIDE | 森林嚮導 | 年度成功推薦4組 |
| LV3 | LV3_GUARDIAN | 秘境守護者 | 年度成功推薦10組 |

### 2.2 佣金標準
| 等級 | 住宿金 | 現金 | 首次推薦獎勵 |
|------|--------|------|--------------|
| LV1 | $1000 | $500 | +$1500 住宿金（僅LV1享有） |
| LV2 | $1200 | $600 | 無 |
| LV3 | $1500 | $750 | 無 |

### 2.3 佣金類型選擇
- **ACCOMMODATION** - 住宿金（預設）
- **CASH** - 現金
- 大使可在 `commission_preference` 設定偏好

### 2.4 Payouts 審計原則
- **不可變性**：Payouts 記錄一旦創建，不可修改或刪除
- **完整性**：所有金額變動必須有對應的 Payout 記錄
- **可追溯性**：包含管理員手動調整、系統自動計算等所有變動
- **金流對照**：確保系統記錄與實際金流完全一致

## 三、核心業務事件流程

### 3.1 訂房創建事件 (create_booking)

#### 觸發時機
- 手動登記新訂房
- 官網訂房同步（未來功能）

#### 事件流程
```
1. 接收訂房資料
   ├─ 驗證必填欄位（guest_name, guest_phone, checkin_date, room_price）
   └─ 生成唯一 booking_id

2. 判斷訂房類型
   ├─ 有 partner_code → REFERRAL（推薦訂房）
   ├─ booking_source = SELF_USE → SELF_USE（自用）
   └─ 無 partner_code → DIRECT（直客）

3. 初始化狀態
   ├─ stay_status = PENDING（待入住）
   ├─ payment_status = UNPAID（未付款）
   └─ commission_status = PENDING（待計算）

4. 如果有推薦人（partner_code）
   └─ Partners.total_referrals += 1（增加推薦計數）

5. 寫入 Bookings 表
```

#### 資料變更
- **Bookings**: 新增一筆記錄
- **Partners**: total_referrals 欄位更新（如有推薦人）

### 3.2 確認入住完成事件 (confirm_checkin_completion)

#### 觸發時機
- 房客實際完成入住後手動確認
- 批次確認多筆訂房

#### 事件流程
```
1. 查找訂房記錄
   ├─ 優先用 booking_id 查找
   └─ 備用：guest_name + guest_phone + checkin_date

2. 檢查狀態
   └─ 如果 stay_status = COMPLETED → 跳過（避免重複）

3. 計算佣金（如果符合資格）
   ├─ 條件：有 partner_code 且 booking_source != SELF_USE
   ├─ 查找大使資料
   ├─ 根據等級和偏好計算佣金
   │   ├─ 基礎佣金 = COMMISSION_RATES[level][preference]
   │   └─ 首次獎勵 = (level == LV1 && successful_referrals == 0) ? 1500 : 0
   └─ 總佣金 = 基礎佣金 + 首次獎勵

4. 更新大使統計
   ├─ successful_referrals += 1
   ├─ yearly_referrals += 1
   ├─ total_commission_earned += 佣金金額（歷史記錄）
   └─ 根據佣金類型更新：
       ├─ 住宿金（ACCOMMODATION）：available_points += 佣金金額
       └─ 現金（CASH）：pending_commission += 佣金金額

5. 檢查等級晉升
   ├─ 根據 yearly_referrals 判斷新等級
   └─ 如果等級改變 → 更新 partner_level

6. 創建 Payout 記錄（審計追蹤，不可變）
   ├─ payout_type = commission_type（ACCOMMODATION/CASH）
   ├─ amount = 佣金金額
   ├─ payout_status = PENDING
   └─ related_booking_ids = booking_id

7. 更新訂房狀態
   ├─ stay_status = COMPLETED
   ├─ payment_status = PAID
   ├─ commission_status = CALCULATED/NOT_ELIGIBLE
   ├─ commission_amount = 計算出的佣金
   └─ manually_confirmed_at = 當前時間
```

#### 資料變更
- **Bookings**: 更新狀態和佣金欄位
- **Partners**: 更新統計、佣金、等級
- **Payouts**: 新增佣金記錄（不可變）

### 3.3 使用住宿金事件 (use_accommodation_points)

#### 觸發時機
- 大使使用累積的住宿金折抵房費

#### 事件流程
```
1. 驗證請求
   ├─ 檢查 partner_code 存在
   ├─ 檢查 deduct_amount > 0
   └─ 檢查可用點數 >= 折抵金額

2. 創建 SELF_USE 訂房記錄
   ├─ booking_source = SELF_USE
   ├─ stay_status = COMPLETED
   ├─ commission_status = NOT_ELIGIBLE
   └─ notes = 住宿金折抵資訊

3. 更新大使點數
   ├─ available_points -= deduct_amount
   └─ points_used += deduct_amount

4. 創建 Accommodation_Usage 記錄
   ├─ usage_type = ROOM_DISCOUNT
   └─ related_booking_id = 新訂房ID

5. 創建 Payout 審計記錄（不可變）
   ├─ payout_type = POINTS_ADJUSTMENT_DEBIT
   └─ amount = -deduct_amount（負數表示扣除）
```

#### 資料變更
- **Bookings**: 新增 SELF_USE 記錄
- **Partners**: 更新 available_points, points_used
- **Accommodation_Usage**: 新增使用記錄
- **Payouts**: 新增審計記錄（不可變）

### 3.4 轉換現金事件 (convert_points_to_cash)

#### 觸發時機
- 大使將住宿金轉換為現金

#### 事件流程
```
1. 驗證轉換
   ├─ 檢查可用點數充足
   └─ 計算轉換率（預設 0.5）

2. 更新大使資料
   ├─ available_points -= 轉換點數
   ├─ points_used += 轉換點數
   └─ pending_commission += 現金金額

3. 創建 Payout 記錄（不可變）
   ├─ payout_type = CASH_CONVERSION
   ├─ amount = 現金金額
   └─ payout_status = PENDING
```

#### 資料變更
- **Partners**: 更新點數和待結算現金
- **Payouts**: 新增轉換記錄（不可變）

### 3.5 取消/刪除訂房事件 (delete_booking)

#### 觸發時機
- 訂房取消
- 錯誤訂房刪除

#### 事件流程
```
1. 查找訂房記錄

2. 判斷處理方式
   ├─ SELF_USE + 已使用點數 → 返還點數
   ├─ REFERRAL + stay_status != COMPLETED → 減少推薦計數
   └─ COMPLETED + 已計算佣金 → 需要特殊處理

3. 如果需要返還點數（SELF_USE）
   ├─ 查找相關 Accommodation_Usage 記錄
   ├─ Partners.available_points += 返還金額
   ├─ Partners.points_used -= 返還金額
   └─ 創建 POINTS_REFUND Payout 記錄（不可變）

4. 如果需要調整推薦統計
   └─ Partners.total_referrals -= 1

5. 如果已計算佣金（需要撤銷）
   ├─ Partners.total_commission_earned -= 原佣金
   ├─ 如果是住宿金：available_points -= 原佣金
   ├─ 如果是現金：pending_commission -= 原佣金
   └─ 創建 COMMISSION_REVERSAL Payout 記錄（負數）

6. 更新訂房狀態
   └─ stay_status = CANCELLED
```

#### 資料變更
- **Bookings**: 更新狀態為 CANCELLED
- **Partners**: 可能更新點數、統計、佣金
- **Payouts**: 新增撤銷/退款記錄（不可變）

### 3.6 更新訂房資料事件 (update_booking) 🔴 重點注意

#### 觸發時機
- 修正房客資訊
- 更新入住日期
- 調整房價
- 變更推薦人

#### 事件流程
```
1. 查找訂房記錄，記錄原始值
   ├─ old_partner_code
   ├─ old_room_price
   ├─ old_commission_amount
   └─ old_stay_status

2. 檢查變更類型和影響
   
   A. 房客基本資訊變更（姓名、電話、Email）
      └─ 無金額影響 → 直接更新
   
   B. 日期變更（入住、退房）
      └─ 無金額影響 → 直接更新
   
   C. 推薦人變更（partner_code）⚠️
      ├─ 如果 stay_status != COMPLETED
      │   ├─ 舊推薦人：total_referrals -= 1
      │   └─ 新推薦人：total_referrals += 1
      └─ 如果 stay_status == COMPLETED（已計算佣金）
          ├─ 撤銷舊推薦人佣金
          │   ├─ total_commission_earned -= old_commission
          │   ├─ successful_referrals -= 1
          │   ├─ 調整 available_points 或 pending_commission
          │   └─ 創建 COMMISSION_REVERSAL Payout（負數）
          └─ 計算新推薦人佣金
              ├─ 計算新佣金（考慮新推薦人等級）
              ├─ successful_referrals += 1
              ├─ 更新 available_points 或 pending_commission
              └─ 創建新的 COMMISSION Payout
   
   D. 房價變更（room_price）⚠️
      └─ 如果 stay_status == COMPLETED（已計算佣金）
          ├─ 重新計算佣金差額
          ├─ 如果差額 > 0
          │   ├─ 增加大使佣金
          │   └─ 創建 COMMISSION_ADJUSTMENT Payout（正數）
          └─ 如果差額 < 0
              ├─ 減少大使佣金
              └─ 創建 COMMISSION_ADJUSTMENT Payout（負數）
   
   E. 狀態變更（stay_status）⚠️
      ├─ PENDING → COMPLETED
      │   └─ 執行確認入住流程（計算佣金）
      ├─ COMPLETED → CANCELLED
      │   └─ 執行取消流程（撤銷佣金）
      └─ CANCELLED → PENDING
          └─ 恢復為待處理狀態

3. 執行資料更新
   └─ updated_at = 當前時間
```

#### 資料變更（根據變更類型）
- **Bookings**: 更新相關欄位
- **Partners**: 可能更新統計、佣金、點數
- **Payouts**: 可能新增調整記錄（不可變）

#### 特別注意事項
- 任何涉及金額的變更都需要創建 Payout 審計記錄
- 變更推薦人是最複雜的操作，需要同時處理新舊推薦人
- 房價變更只有在已計算佣金時才需要調整
- 狀態回滾（CANCELLED → PENDING）需要特別小心

### 3.7 手動調整佣金事件 (adjust_partner_commission)

#### 觸發時機
- 管理員手動調整大使佣金
- 系統錯誤修正
- 特殊獎勵發放

#### 事件流程
```
1. 驗證調整請求
   ├─ 檢查 partner_code 存在
   ├─ 檢查調整原因（必填）
   └─ 檢查調整金額（可正可負）

2. 判斷調整類型
   ├─ 住宿金調整
   │   └─ available_points += adjustment_amount
   ├─ 現金調整
   │   └─ pending_commission += adjustment_amount
   └─ 統計調整（特殊情況）
       ├─ successful_referrals 調整
       └─ yearly_referrals 調整

3. 創建 Payout 審計記錄（不可變）
   ├─ payout_type = MANUAL_ADJUSTMENT
   ├─ amount = adjustment_amount
   ├─ notes = 調整原因（詳細說明）
   └─ created_by = 操作者
```

#### 資料變更
- **Partners**: 更新佣金相關欄位
- **Payouts**: 新增調整記錄（不可變）

### 3.8 結算支付事件 (process_payout)

#### 觸發時機
- 執行現金匯款（管理員確認已匯款）
- 批次結算多筆待支付現金

#### 事件流程
```
1. 查找待結算現金
   └─ 取得 partner 的 pending_commission > 0

2. 執行結算
   ├─ 記錄銀行匯款資訊
   │   ├─ bank_transfer_date（匯款日期）
   │   └─ bank_transfer_reference（匯款編號）
   └─ 實際匯款金額

3. 創建結算完成記錄（審計追蹤）
   ├─ payout_type = PAYMENT_COMPLETED
   ├─ amount = 實際支付金額
   ├─ payout_method = BANK_TRANSFER
   └─ payout_status = COMPLETED

4. 更新大使資料
   ├─ pending_commission = 0（歸零）
   └─ total_commission_paid += 支付金額（累計已支付）
```

#### 資料變更
- **Partners**: 更新 total_commission_paid, pending_commission
- **Payouts**: 新增支付完成記錄（不可變）

### 3.9 更新大使資料事件 (update_partner) 🔴 重點注意

#### 觸發時機
- 修改聯絡資訊
- 變更佣金偏好
- 更新銀行帳戶
- 手動調整等級

#### 事件流程
```
1. 查找大使記錄，記錄原始值

2. 判斷變更類型和影響
   
   A. 基本資訊變更（姓名、電話、Email、銀行帳戶）
      └─ 無金額影響 → 直接更新
   
   B. 佣金偏好變更（commission_preference）⚠️
      ├─ 不影響已計算的佣金
      └─ 僅影響未來的佣金計算
   
   C. 等級手動調整（partner_level）⚠️
      ├─ 不影響已計算的佣金
      ├─ 影響未來的佣金計算
      └─ 創建 LEVEL_ADJUSTMENT Payout 記錄（amount = 0，僅作記錄）
   
   D. 統計數據調整（危險操作）⚠️⚠️
      ├─ total_commission_earned
      ├─ available_points
      ├─ pending_commission
      └─ 必須創建對應的 MANUAL_ADJUSTMENT Payout

3. 更新大使記錄
   └─ updated_at = 當前時間
```

#### 資料變更
- **Partners**: 更新相關欄位
- **Payouts**: 可能新增調整記錄（特殊情況）

## 四、資料完整性規則

### 4.1 Partners 表一致性公式

#### 重要原則
- **住宿金佣金**：確認入住時直接加到 `available_points`，不影響 `pending_commission`
- **現金佣金**：確認入住時直接加到 `pending_commission`
- **點數轉現金**：從 `available_points` 扣除，加到 `pending_commission`
- **結算支付**：`pending_commission` 歸零，`total_commission_paid` 增加

#### 欄位計算公式
```
// 住宿金平衡公式
available_points = 所有住宿金佣金總和
                  - points_used（折抵使用 + 轉換現金）
                  + 所有 POINTS_REFUND 的總和
                  + 所有 MANUAL_ADJUSTMENT（住宿金）的總和

// 待結算現金公式（只包含待支付的現金）
pending_commission = 所有現金佣金總和
                    + 點數轉換的現金（CASH_CONVERSION）
                    - 已結算支付的現金（PAYMENT_COMPLETED）
                    + 所有 MANUAL_ADJUSTMENT（現金）的總和

// 累積佣金總額（歷史記錄）
total_commission_earned = 所有住宿金佣金 + 所有現金佣金（不含轉換）

// 已使用點數
points_used = 住宿金折抵使用 + 轉換為現金的點數

// 已支付總額
total_commission_paid = 所有已完成的現金結算總和
```

### 4.2 Bookings 表狀態機
```
stay_status:
  PENDING → COMPLETED（確認入住）
  PENDING → CANCELLED（取消）
  COMPLETED → CANCELLED（特殊：需要撤銷佣金）
  CANCELLED → PENDING（特殊：重新啟用）

commission_status:
  PENDING → CALCULATED（計算佣金）
  PENDING → NOT_ELIGIBLE（不符資格）
  CALCULATED → REVERSED（撤銷）
```

### 4.3 Payouts 表類型定義
```
payout_type 可能值：
- ACCOMMODATION：住宿金佣金
- CASH：現金佣金
- POINTS_ADJUSTMENT_DEBIT：點數扣除
- POINTS_ADJUSTMENT_CREDIT：點數增加
- POINTS_REFUND：點數退還
- CASH_CONVERSION：點數轉現金
- COMMISSION_ADJUSTMENT：佣金調整
- COMMISSION_REVERSAL：佣金撤銷
- MANUAL_ADJUSTMENT：手動調整
- PAYMENT_COMPLETED：支付完成
- LEVEL_ADJUSTMENT：等級調整記錄
```

### 4.4 變更影響矩陣

| 變更項目 | 影響金額 | 需要Payout | 影響統計 | 備註 |
|---------|---------|-----------|---------|------|
| 房客姓名 | ❌ | ❌ | ❌ | 純資料更正 |
| 房客電話 | ❌ | ❌ | ❌ | 純資料更正 |
| 入住日期 | ❌ | ❌ | ❌ | 不影響佣金 |
| 房價(未完成) | ❌ | ❌ | ❌ | 尚未計算佣金 |
| 房價(已完成) | ✅ | ✅ | ✅ | 需要調整佣金 |
| 推薦人(未完成) | ❌ | ❌ | ✅ | 調整推薦計數 |
| 推薦人(已完成) | ✅ | ✅ | ✅ | 撤銷+重算佣金 |
| 狀態(P→C) | ✅ | ✅ | ✅ | 計算佣金 |
| 狀態(C→X) | ✅ | ✅ | ✅ | 撤銷佣金 |
| 佣金偏好 | ❌ | ❌ | ❌ | 僅影響未來 |
| 大使等級 | ❌ | ✅ | ❌ | 記錄用 |
| 手動調整金額 | ✅ | ✅ | ❌ | 必須記錄 |

## 五、程式架構設計原則

### 5.1 事件處理器模式
每個業務事件應該是獨立的處理器，包含：
- 輸入驗證
- 原始值記錄（用於比對變更）
- 業務邏輯
- 資料更新
- 審計記錄（Payout）
- 錯誤處理與回滾

### 5.2 變更追蹤機制
```javascript
// 範例：追蹤變更影響
function trackChanges(oldData, newData) {
  const changes = {
    hasMonetaryImpact: false,
    hasStatisticalImpact: false,
    requiredPayouts: [],
    affectedPartners: []
  };
  
  // 檢查各欄位變更
  if (oldData.partner_code !== newData.partner_code) {
    changes.hasStatisticalImpact = true;
    if (oldData.stay_status === 'COMPLETED') {
      changes.hasMonetaryImpact = true;
    }
  }
  
  if (oldData.room_price !== newData.room_price) {
    if (oldData.commission_status === 'CALCULATED') {
      changes.hasMonetaryImpact = true;
    }
  }
  
  return changes;
}
```

### 5.3 審計記錄原則
- 任何金額變動必須創建 Payout 記錄
- Payout 記錄包含完整的變更上下文
- 使用負數金額表示扣除或撤銷
- 記錄操作者和操作時間

## 六、測試案例

### 6.1 變更測試案例
1. 變更房客姓名 → 確認無金額影響
2. 變更房價（未完成）→ 確認無需調整
3. 變更房價（已完成）→ 確認佣金調整正確
4. 變更推薦人（未完成）→ 確認統計正確
5. 變更推薦人（已完成）→ 確認撤銷和重算正確
6. 取消已完成訂房 → 確認佣金撤銷

### 6.2 邊界條件測試
1. LV1 首次推薦獎勵（僅住宿金有獎勵）
2. 等級晉升時機
3. 點數不足時的處理
4. 重複確認入住的防護
5. 循環變更推薦人的處理

### 6.3 審計完整性測試
1. 計算 Partners 表的 available_points 是否與 Payouts 總和一致
2. 驗證所有金額變動都有對應的 Payout 記錄
3. 檢查 Payout 記錄的連續性和完整性

## 七、佣金計算詳細規則

### 7.1 基礎佣金計算
```javascript
// LV1 首次推薦（含獎勵）
if (level === 'LV1_INSIDER' && successful_referrals === 0) {
  if (preference === 'ACCOMMODATION') {
    commission = 1000 + 1500; // 基礎 + 首次獎勵
  } else {
    commission = 500; // 現金無首次獎勵
  }
}

// 一般佣金
const RATES = {
  'LV1_INSIDER': { accommodation: 1000, cash: 500 },
  'LV2_GUIDE': { accommodation: 1200, cash: 600 },
  'LV3_GUARDIAN': { accommodation: 1500, cash: 750 }
};
```

### 7.2 點數轉換規則
- 住宿金 → 現金：2:1 比率（2點換1元）
- 最低轉換金額：1000點
- 轉換不可逆

---

## 附錄：關鍵資料欄位

### Partners 表關鍵欄位

#### 身份識別
- `partner_code` - 主鍵，大使唯一識別碼
- `partner_name` - 大使姓名
- `partner_level` - 當前等級（LV1_INSIDER/LV2_GUIDE/LV3_GUARDIAN）

#### 推薦統計
- `total_referrals` - 總推薦數（包含未完成）
- `successful_referrals` - 成功推薦數（已完成入住）
- `yearly_referrals` - 年度推薦數（用於等級判定）

#### 住宿金管理（重要：與佣金統計分開）
- `available_points` - **當前可用住宿金點數**（實時餘額）
- `points_used` - **已使用點數累計**（折抵房費 + 轉換現金的歷史總和）

#### 佣金統計（歷史記錄）
- `total_commission_earned` - **累積獲得佣金總額**（歷史記錄，包含住宿金+現金）
- `total_commission_paid` - **已結算支付的現金總額**（歷史累計）
- `pending_commission` - **待結算現金**（現金佣金 + 點數轉換的現金 - 已支付）

#### 偏好設定
- `commission_preference` - 佣金偏好（ACCOMMODATION/CASH）

#### 重要說明
⚠️ **欄位語義區分**：
1. **住宿金系統**（`available_points`/`points_used`）：追蹤點數的實時狀態和使用情況
2. **佣金統計系統**（`total_commission_earned`/`total_commission_paid`）：追蹤歷史佣金總額，用於報表和分析
3. **這兩組欄位不可混用或合併**，它們追蹤不同的業務指標

### Bookings 表關鍵欄位
- `id` - 主鍵
- `partner_code` - 推薦人
- `booking_source` - 訂房來源
- `stay_status` - 住宿狀態
- `commission_status` - 佣金狀態
- `commission_amount` - 佣金金額
- `commission_type` - 佣金類型

### Payouts 表關鍵欄位（不可變）
- `id` - 主鍵
- `partner_code` - 大使代碼
- `payout_type` - 結算類型
- `amount` - 金額（負數表示扣除）
- `payout_status` - 結算狀態
- `related_booking_ids` - 相關訂房
- `notes` - 詳細說明
- `created_by` - 創建者
- `created_at` - 創建時間（永不更新）

---

*本文檔定義了知音計畫的完整佣金制度和系統架構，作為開發和維護的核心參考。*
*特別注意：任何資料變更都需要仔細評估其對金額和統計的影響。*
*最後更新：2025年8月19日*

## 更新歷史
- 2025-08-19：澄清 Partners 表欄位語義，區分住宿金系統與佣金統計系統
- 2024-08：初版建立