# 點數系統欄位定義說明

## 欄位定義

### Partners 表重要欄位

| 欄位名稱 | 定義 | 計算方式 | 何時更新 |
|---------|------|---------|---------|
| **total_commission_earned** | 歷史總佣金收入 | 累加所有佣金 | ✅ 確認入住時增加<br>❌ 使用點數時不變<br>❌ 取消結算時減少 |
| **available_points** | 可用住宿金點數 | 自動計算 | ✅ 獲得住宿金佣金時增加<br>✅ 使用住宿金時減少<br>✅ 取消住宿金結算時恢復 |
| **points_used** | 已使用住宿金點數 | 累加使用記錄 | ✅ 使用住宿金時增加<br>❌ 永不減少 |
| **pending_commission** | 待支付現金 | 自動計算 | ✅ 獲得現金佣金時增加<br>✅ 支付現金時減少<br>✅ 點數轉現金時增加 |
| **total_commission_paid** | （廢棄欄位） | 不再使用 | 保留但不更新 |

## 正確的計算公式

### 住宿金餘額
```
可用住宿金 = available_points
（已由系統自動維護，不需要計算）
```

### 歷史統計
```
總收入 = total_commission_earned
已使用點數 = points_used
實際獲得的住宿金總額 = total_commission_earned 中的住宿金部分
```

## 常見場景的欄位變化

### 1. 確認入住（住宿金佣金 1000 點）
- total_commission_earned: +1000
- available_points: +1000
- points_used: 不變
- pending_commission: 不變

### 2. 確認入住（現金佣金 500 元）
- total_commission_earned: +500
- available_points: 不變
- points_used: 不變
- pending_commission: +500

### 3. 使用住宿金 800 點
- total_commission_earned: **不變**（修復前會錯誤地減少）
- available_points: -800
- points_used: +800
- pending_commission: 不變

### 4. 點數轉現金 1000 點（2:1 = 500 元）
- total_commission_earned: **不變**（修復前會錯誤地減少）
- available_points: -1000
- points_used: +1000
- pending_commission: +500

### 5. 取消住宿金結算（退回 2000 點）
- total_commission_earned: -2000（這是合理的，因為要撤銷佣金）
- available_points: +2000
- points_used: 不變
- pending_commission: 不變

## 前端顯示建議

### 聯盟夥伴列表
```javascript
// 顯示可用餘額
const 住宿金餘額 = partner.available_points;
const 待支付現金 = partner.pending_commission;
```

### 佣金詳情
```javascript
// 顯示歷史統計
const 總收入 = partner.total_commission_earned;
const 已使用點數 = partner.points_used;
const 可用點數 = partner.available_points;
```

## 需要修復的問題

1. ❌ **使用住宿金時不應減少 total_commission_earned**
2. ❌ **點數轉現金時不應減少 total_commission_earned**
3. ❌ **前端各處顯示邏輯不一致**
4. ✅ **取消結算時應減少 total_commission_earned**（這是正確的）

## 遷移計畫

### Phase 1: 修復後端邏輯
- 修改 handleUseAccommodationPoints：移除對 total_commission_earned 的修改
- 修改 handleConvertPointsToCash：移除對 total_commission_earned 的修改

### Phase 2: 統一前端顯示
- admin-dashboard-real.html：使用 available_points 顯示可用餘額
- commission-management.js：移除舊的計算邏輯
- payout-functions.js：確保使用正確的欄位

### Phase 3: 數據修復（如需要）
- 檢查現有數據的一致性
- 修復 total_commission_earned 被錯誤減少的記錄

---

最後更新：2024-08-22