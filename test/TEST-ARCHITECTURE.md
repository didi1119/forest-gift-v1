# 知音計畫 - 測試架構設計

## 📋 目錄

- [整體架構](#整體架構)
- [測試分類](#測試分類)
- [文件組織](#文件組織)
- [使用指南](#使用指南)
- [測試數據管理](#測試數據管理)

---

## 整體架構

### 設計原則

1. **單一執行器** - 只有一個測試執行器 HTML 文件
2. **模組化測試** - 測試按類別分離為獨立 JS 模組
3. **清晰文檔** - 每個測試模組都有詳細說明
4. **易於維護** - 修改測試只需編輯對應模組
5. **自動化優先** - 盡可能自動化測試流程

### 目錄結構

```
test/
├── README.md                          # 測試系統快速入門
├── TEST-ARCHITECTURE.md               # 測試架構設計（本文件）
├── TEST-SUITE.html                    # 唯一測試執行器
│
├── core/                              # 核心框架
│   └── test-framework.js             # 測試框架核心邏輯
│
├── suites/                            # 測試套件（按類別）
│   ├── basic-tests.js                # 基礎功能測試
│   ├── commission-tests.js           # 佣金計算測試
│   ├── booking-lifecycle-tests.js    # 訂房生命週期測試
│   ├── cancellation-tests.js         # 取消與回滾測試
│   ├── points-tests.js               # 點數操作測試
│   ├── payout-tests.js               # 結算管理測試
│   ├── level-upgrade-tests.js        # 等級升級測試
│   └── consistency-tests.js          # 數據一致性測試
│
├── docs/                              # 測試文檔
│   ├── TEST-GUIDE.md                 # 測試使用指南
│   ├── TEST-CATEGORIES.md            # 測試分類詳細說明
│   └── COMPREHENSIVE-TEST-CHECKLIST.md # 完整測試檢查清單
│
└── reports/                           # 測試報告
    └── [自動生成的測試報告]
```

---

## 測試分類

### 1. 基礎功能測試 (basic-tests.js)

**目的**: 驗證系統基礎設施和數據結構

**測試項目**:
- API 連線測試
- Google Sheets 數據讀取測試
- 數據結構完整性驗證
- 表關聯驗證

**執行頻率**: 每次測試必執行

---

### 2. 佣金計算測試 (commission-tests.js)

**目的**: 驗證佣金計算邏輯的正確性

**測試項目**:
- LV1 住宿金佣金計算 (1000 點)
- LV1 現金佣金計算 (500 元)
- LV2 住宿金佣金計算 (1200 點)
- LV2 現金佣金計算 (600 元)
- LV3 住宿金佣金計算 (1500 點)
- LV3 現金佣金計算 (750 元)
- 首次推薦獎勵驗證 (1500 點，僅 LV1)
- 佣金偏好切換測試

**執行頻率**: 每次測試必執行

**關鍵驗證點**:
```javascript
// LV1 首次推薦
commission = base_commission + first_referral_bonus
           = 1000 + 1500 = 2500

// 一般推薦
commission = base_commission (根據等級和偏好)
```

---

### 3. 訂房生命週期測試 (booking-lifecycle-tests.js)

**目的**: 驗證從訂房創建到完成的完整流程

**測試項目**:
- 創建訂房（各種來源：REFERRAL, DIRECT, SELF_USE）
- 訂房狀態轉換 (PENDING → CONFIRMED → COMPLETED)
- 入住確認
- 佣金狀態更新 (PENDING → CALCULATED)
- 大使統計更新
- 訂房修改
- 訂房刪除

**執行頻率**: 每次測試必執行

**關鍵驗證點**:
- 狀態機轉換正確
- 佣金計算時機正確
- 大使數據同步更新

---

### 4. 取消與回滾測試 (cancellation-tests.js)

**目的**: 驗證取消操作和數據回滾的正確性

**測試項目**:
- 簡單取消測試（取消已確認訂房）
- 佣金撤銷驗證
- 連續取消測試
- 取消後重新確認
- 複雜循環測試（創建→確認→取消→重新創建）
- Payout 審計記錄驗證

**執行頻率**: 每次測試必執行

**關鍵驗證點**:
```javascript
// 取消前
available_points = 4500
successful_referrals = 3

// 確認 1 筆訂房（+1000）
available_points = 5500
successful_referrals = 4

// 取消該訂房
available_points = 4500  // 回滾
successful_referrals = 3  // 回滾
Payouts 記錄 += COMMISSION_REVERSAL
```

---

### 5. 點數操作測試 (points-tests.js)

**目的**: 驗證住宿金點數的使用和轉換

**測試項目**:
- 使用住宿金抵扣
- 點數轉現金 (2:1 比例)
- 取消住宿金使用
- 點數不足驗證
- 點數歷史記錄驗證

**執行頻率**: 每次測試必執行

**關鍵驗證點**:
```javascript
// 使用住宿金
available_points: 3000 → 2000
points_used: 0 → 1000

// 點數轉現金（2000 點 → 1000 元）
available_points: 2000 → 0
pending_commission: 0 → 1000
```

---

### 6. 結算管理測試 (payout-tests.js)

**目的**: 驗證結算創建、取消和審計功能

**測試項目**:
- 創建住宿金結算
- 創建現金結算
- 混合結算（住宿金 + 現金）
- 取消結算
- 結算記錄不可變性驗證
- 結算狀態轉換
- 銀行轉帳資訊驗證

**執行頻率**: 每次測試建議執行

**關鍵驗證點**:
- Payout 記錄一旦創建不可修改
- 取消會創建新的反向記錄
- 所有金額變動都有 Payout 記錄

---

### 7. 等級升級測試 (level-upgrade-tests.js)

**目的**: 驗證大使等級升降邏輯

**測試項目**:
- LV1 → LV2 升級（4 組成功推薦）
- LV2 → LV3 升級（10 組成功推薦）
- 升級後佣金率變化
- 降級測試（取消訂房導致）
- 年度重置測試
- 等級進度條驗證

**執行頻率**: 按需執行（較耗時）

**關鍵驗證點**:
```javascript
// LV1 → LV2
successful_referrals: 3 → 4
partner_level: 'LV1_INSIDER' → 'LV2_GUIDE'
commission_rate: 1000 → 1200 (住宿金)

// 降級（取消 2 筆訂房）
successful_referrals: 4 → 2
partner_level: 'LV2_GUIDE' → 'LV1_INSIDER'
```

---

### 8. 數據一致性測試 (consistency-tests.js)

**目的**: 驗證數據庫間的數據一致性

**測試項目**:
- 住宿金點數一致性驗證
- Payouts 審計完整性驗證
- 大使統計數據一致性
- 訂房數量一致性
- 跨表關聯驗證

**執行頻率**: 每次測試必執行

**關鍵驗證公式**:
```javascript
// Partners.available_points 一致性
expected_points =
  Σ(ACCOMMODATION payouts)
  - Σ(POINTS_ADJUSTMENT_DEBIT payouts)
  - Σ(CASH_CONVERSION points_used)
  - Σ(COMMISSION_REVERSAL where type=ACCOMMODATION)

// Partners.total_commission_earned 一致性
expected_earned =
  Σ(ACCOMMODATION payouts)
  + Σ(CASH payouts)
  - Σ(COMMISSION_REVERSAL payouts)

// Partners.successful_referrals 一致性
expected_referrals =
  COUNT(Bookings where stay_status='COMPLETED' and commission_status='CALCULATED')
  - COUNT(COMMISSION_REVERSAL payouts)
```

---

## 文件組織

### 核心框架 (core/)

#### test-framework.js
- TestFramework 類
- API 調用封裝
- 數據獲取函數
- 通用工具函數
- 日誌系統

### 測試套件 (suites/)

每個測試套件文件結構：

```javascript
/**
 * [測試類別名稱] - [用途說明]
 *
 * 測試項目：
 * 1. [測試項目 1]
 * 2. [測試項目 2]
 * ...
 *
 * 執行頻率：[必要/建議/按需]
 * 預估耗時：[X 秒]
 *
 * @requires TestFramework
 */

// 測試 1
const test1 = {
    name: '測試名稱',
    description: '測試說明',
    execute: async (framework) => {
        // 測試邏輯
    }
};

// 測試 2
const test2 = { ... };

// 導出所有測試
export const tests = [test1, test2, ...];
export const category = '測試類別';
export const metadata = {
    frequency: 'required',
    estimatedTime: 30,
    dependencies: []
};
```

### 測試文檔 (docs/)

#### TEST-GUIDE.md
- 如何運行測試
- 如何新增測試
- 如何解讀測試結果
- 常見問題排查

#### TEST-CATEGORIES.md
- 每個測試類別的詳細說明
- 測試項目清單
- 驗證點說明
- 範例代碼

---

## 使用指南

### 快速開始

1. **打開測試執行器**
   ```
   打開 test/TEST-SUITE.html
   ```

2. **配置測試**
   - Apps Script URL
   - 測試大使代碼
   - 選擇測試類別
   - 設定選項（清理數據、詳細日誌）

3. **運行測試**
   - 點擊「開始測試」
   - 觀察即時進度
   - 查看測試結果

4. **查看報告**
   - 查看統計摘要
   - 檢查失敗測試
   - 導出 JSON 報告

### 新增測試

1. **確定測試類別**
   - 選擇或創建合適的測試套件文件

2. **編寫測試**
   ```javascript
   const myNewTest = {
       name: '我的新測試',
       description: '測試某個新功能',
       execute: async (framework) => {
           // 步驟 1: 準備數據
           const data = await framework.fetchSheetData();

           // 步驟 2: 執行操作
           await framework.apiCall('some_action', {...});

           // 步驟 3: 驗證結果
           const newData = await framework.fetchSheetData();
           if (newData.someValue !== expectedValue) {
               throw new Error('驗證失敗');
           }

           return { success: true };
       }
   };
   ```

3. **添加到測試套件**
   ```javascript
   export const tests = [...existingTests, myNewTest];
   ```

4. **更新文檔**
   - 在 TEST-CATEGORIES.md 添加說明

### 測試最佳實踐

1. **測試隔離**
   - 每個測試獨立運行
   - 不依賴其他測試的結果
   - 測試後清理數據

2. **明確斷言**
   - 每個驗證都應該有清晰的錯誤訊息
   - 使用具體的預期值和實際值

3. **完整覆蓋**
   - 正常流程
   - 邊界條件
   - 錯誤情況

4. **性能考慮**
   - 避免不必要的 API 調用
   - 合併可以批量處理的操作
   - 適當使用等待時間

---

## 測試數據管理

### 測試大使

所有測試都使用同一個測試大使，由測試框架自動創建：

```javascript
{
  partner_code: 'TEST_AUTO',  // 或您指定的代碼
  partner_name: '測試大使_AUTO',
  partner_level: 'LV1_INSIDER',
  commission_preference: 'ACCOMMODATION',
  available_points: 0,
  successful_referrals: 0
}
```

### 測試訂房

測試訂房使用特殊前綴以便識別：

```javascript
{
  guest_name: 'TEST_客人_[timestamp]',
  guest_phone: '0900000001',
  room_price: 5000,
  // ...
}
```

### 數據清理

測試結束後自動清理：
- 刪除所有測試訂房
- 刪除測試 Payout 記錄
- 重置測試大使狀態（可選）

---

## 維護指南

### 定期檢查

- **每週**: 運行完整測試套件
- **每月**: 更新測試數據和場景
- **版本發布前**: 必須運行所有測試並通過

### 測試失敗處理

1. **記錄失敗詳情**
   - 截圖測試報告
   - 記錄錯誤訊息
   - 記錄測試環境

2. **分析原因**
   - 是程式錯誤還是測試錯誤？
   - 是環境問題還是邏輯問題？

3. **修復並驗證**
   - 修復代碼或測試
   - 重新運行測試
   - 更新文檔

### 文檔更新

當系統功能變更時：
1. 更新 COMMISSION-SYSTEM-ARCHITECTURE.md
2. 更新相關測試腳本
3. 更新 TEST-CATEGORIES.md
4. 更新 COMPREHENSIVE-TEST-CHECKLIST.md

---

## 附錄

### 測試執行時間參考

| 測試類別 | 測試數量 | 預估時間 |
|---------|---------|---------|
| 基礎功能 | 2 | 10-15秒 |
| 佣金計算 | 8 | 30-45秒 |
| 訂房生命週期 | 1 | 30-40秒 |
| 取消與回滾 | 3 | 90-120秒 |
| 點數操作 | 3 | 30-45秒 |
| 結算管理 | 5 | 60-90秒 |
| 等級升級 | 4 | 120-180秒 |
| 數據一致性 | 2 | 15-20秒 |
| **總計** | **28** | **6-9分鐘** |

### 測試覆蓋率目標

| 模組 | 目標覆蓋率 |
|------|-----------|
| 佣金計算 | 100% |
| 訂房管理 | 95% |
| 點數操作 | 95% |
| 結算管理 | 90% |
| 等級升級 | 85% |
| 數據驗證 | 100% |

---

**最後更新**: 2026-02-03
**維護者**: Claude Code
**版本**: 2.0
