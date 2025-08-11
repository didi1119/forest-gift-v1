# 靜謐森林佣金管理系統 - 數據庫結構 v2.0

## 📋 **1. Partners 表 (聯盟夥伴主表)**

| 欄位名稱 | 類型 | 說明 | 範例 |
|---------|------|------|------|
| id | 自動編號 | 夥伴ID | 1 |
| partner_code | 文字 | 夥伴代碼 | WANG001 |
| name | 文字 | 夥伴姓名 | 王小明 |
| email | 文字 | Email | wang@example.com |
| phone | 文字 | 電話 | 0912345678 |
| **level** | 文字 | 會員等級 | LV1_INSIDER / LV2_GUIDE / LV3_GUARDIAN |
| **level_progress** | 數字 | 本年度成功推薦數 | 3 |
| **total_successful_referrals** | 數字 | 累積成功推薦數 | 8 |
| **commission_preference** | 文字 | 偏好回饋方式 | CASH / ACCOMMODATION |
| **total_commission_earned** | 數字 | 累積佣金總額 | 12500 |
| **total_commission_paid** | 數字 | 已支付佣金總額 | 8000 |
| **pending_commission** | 數字 | 未支付佣金總額 | 4500 |
| **bank_name** | 文字 | 銀行名稱 | 台灣銀行 |
| **bank_branch** | 文字 | 分行 | 信義分行 |
| **account_holder** | 文字 | 戶名 | 王小明 |
| **account_number** | 文字 | 帳號 | 123456789012 |
| **first_referral_bonus_claimed** | 布林 | 是否已領取首次推薦獎勵 | TRUE/FALSE |
| status | 文字 | 狀態 | active / suspended |
| landing_link | 文字 | 主頁連結 | https://script.google... |
| coupon_link | 文字 | 優惠券連結 | https://script.google... |
| coupon_code | 文字 | 優惠券代碼 | FOREST_WANG001 |
| coupon_url | 文字 | 專屬優惠券URL | https://lin.ee/abc123 |
| notes | 文字 | 備註 | 活躍推薦者 |
| created_at | 日期時間 | 建立時間 | 2024-01-15 10:30:00 |
| updated_at | 日期時間 | 更新時間 | 2024-01-20 15:45:00 |

## 📋 **2. Bookings 表 (訂房記錄表)**

| 欄位名稱 | 類型 | 說明 | 範例 |
|---------|------|------|------|
| id | 自動編號 | 訂房ID | 1 |
| partner_code | 文字 | 推薦大使代碼 | WANG001 |
| guest_name | 文字 | 房客姓名 | 張三 |
| guest_phone | 文字 | 房客電話 | 0987654321 |
| guest_email | 文字 | 房客Email | zhang@example.com |
| checkin_date | 日期 | 入住日期 | 2024-02-15 |
| checkout_date | 日期 | 退房日期 | 2024-02-17 |
| **room_price** | 數字 | 實際房價 | 5000 |
| **booking_source** | 文字 | 訂房來源 | REFERRAL_LINK / MANUAL_ENTRY / PHONE_BOOKING |
| **stay_status** | 文字 | 入住狀態 | PENDING / CHECKED_IN / COMPLETED / CANCELLED |
| **payment_status** | 文字 | 付款狀態 | PENDING / PARTIAL / PAID / REFUNDED |
| **commission_status** | 文字 | 佣金狀態 | NOT_ELIGIBLE / CALCULATED / PAID |
| **commission_amount** | 數字 | 應付佣金金額 | 500 |
| **commission_type** | 文字 | 佣金類型 | CASH / ACCOMMODATION |
| **is_first_referral_bonus** | 布林 | 是否為首次推薦獎勵 | TRUE/FALSE |
| **first_referral_bonus_amount** | 數字 | 首次推薦獎勵金額 | 1500 |
| **manually_confirmed_by** | 文字 | 手動確認者 | admin |
| **manually_confirmed_at** | 日期時間 | 手動確認時間 | 2024-02-18 09:00:00 |
| notes | 文字 | 備註 | 房客很滿意服務 |
| created_at | 日期時間 | 訂房時間 | 2024-02-10 14:30:00 |
| updated_at | 日期時間 | 更新時間 | 2024-02-18 09:05:00 |

## 📋 **3. Payouts 表 (佣金發放記錄表)**

| 欄位名稱 | 類型 | 說明 | 範例 |
|---------|------|------|------|
| id | 自動編號 | 發放ID | 1 |
| partner_code | 文字 | 大使代碼 | WANG001 |
| payout_type | 文字 | 發放類型 | CASH / ACCOMMODATION |
| amount | 數字 | 發放金額 | 2000 |
| **related_booking_ids** | 文字 | 相關訂房ID | 1,3,5 |
| **payout_method** | 文字 | 發放方式 | BANK_TRANSFER / ACCOMMODATION_VOUCHER |
| **payout_status** | 文字 | 發放狀態 | PENDING / PROCESSING / COMPLETED / FAILED |
| **bank_transfer_date** | 日期 | 匯款日期 | 2024-02-25 |
| **bank_transfer_reference** | 文字 | 匯款參考號 | TXN123456789 |
| **accommodation_voucher_code** | 文字 | 住宿券代碼 | VOUCHER2024020001 |
| notes | 文字 | 備註 | 2024年2月佣金結算 |
| created_by | 文字 | 建立者 | admin |
| created_at | 日期時間 | 建立時間 | 2024-02-25 10:00:00 |
| updated_at | 日期時間 | 更新時間 | 2024-02-25 16:30:00 |

## 📋 **4. Clicks 表 (點擊記錄表) - 保持現有結構**

現有結構已經很完整，只需要添加：
- **gift_card_selected** (文字): 用戶選擇的神諭卡片名稱

## 🎯 **佣金計算邏輯：**

### 基本佣金計算：
- LV1: 1000住宿金 or 500現金
- LV2: 1200住宿金 or 600現金  
- LV3: 1500住宿金 or 800現金

### 首次推薦獎勵：
- 首次成功推薦額外獲得 1500住宿金

### 等級晉升條件：
- LV1 → LV2: 年度4組成功推薦
- LV2 → LV3: 年度10組成功推薦

### 年度資格延續：
- LV2: 次年需3組成功推薦
- LV3: 次年需6組成功推薦