# 🔒 ID 安全性與資料完整性指南

## 🚨 現有問題診斷

### 您遇到的問題
當資料庫只有 ID=2 的記錄時，新增訂單後：
- ❌ ID=2 的舊記錄消失
- ❌ 只剩下 ID=1 的新記錄
- **這是資料覆蓋問題，非常危險！**

### 可能原因
1. **Google Sheets 手動操作問題**
   - 手動刪除資料時，可能不小心清空了整個表格
   - 或刪除了標題行，導致資料結構錯亂

2. **併發問題**
   - 多人同時操作可能導致資料衝突

3. **程式邏輯錯誤**
   - ID 生成邏輯在特殊情況下失敗

## ✅ 已實施的改進

### 1. 強化 ID 生成邏輯
```javascript
// 改進版 ID 生成函數
function generateNextId(sheet, tableName) {
  // 1. 記錄所有已存在的 ID
  const existingIds = new Set();
  
  // 2. 找出最大 ID
  let maxId = 0;
  
  // 3. 生成新 ID = maxId + 1
  let nextId = maxId + 1;
  
  // 4. 確保新 ID 不與現有 ID 衝突
  while (existingIds.has(nextId)) {
    nextId++;
  }
  
  // 5. 安全檢查：ID 不能太小
  if (nextId < 1) {
    nextId = 100000 + (Date.now() % 900000);
  }
  
  return nextId;
}
```

### 2. 資料完整性保護
- ✅ 使用 `appendRow` 只在表格末尾添加
- ✅ 使用 `deleteRow` 只刪除指定行
- ✅ 不使用會覆蓋資料的操作

## 🛡️ 業界最佳實踐

### 1. ID 生成策略

#### ❌ 不要這樣做
- 重用已刪除的 ID
- 手動設定 ID
- 允許 ID 為空或 0

#### ✅ 應該這樣做
```javascript
// 選項 1：自增 ID（簡單）
const nextId = getMaxId() + 1;

// 選項 2：UUID（保證唯一）
const nextId = Utilities.getUuid();

// 選項 3：時間戳基礎（避免衝突）
const nextId = Date.now() + '_' + Math.random();
```

### 2. 刪除記錄的安全做法

#### ❌ 危險做法
```javascript
// 永遠不要這樣刪除！
sheet.clear(); // 清空整個表格
sheet.getRange(2, 1, sheet.getLastRow()).clearContent(); // 清空所有資料
```

#### ✅ 安全做法
```javascript
// 1. 軟刪除（推薦）
function softDeleteBooking(bookingId) {
  // 不真正刪除，只是標記為已刪除
  const row = findRowById(bookingId);
  sheet.getRange(row, DELETE_FLAG_COLUMN).setValue('DELETED');
  sheet.getRange(row, DELETED_AT_COLUMN).setValue(new Date());
}

// 2. 硬刪除（謹慎使用）
function hardDeleteBooking(bookingId) {
  // 真正刪除，但要記錄操作
  const row = findRowById(bookingId);
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // 備份到刪除記錄表
  const deletedSheet = spreadsheet.getSheetByName('DeletedRecords');
  deletedSheet.appendRow([...data, new Date(), '管理員刪除']);
  
  // 刪除原記錄
  sheet.deleteRow(row);
}
```

## 🔧 立即檢查事項

### 1. 檢查 Google Sheets 設定
```
1. 開啟 Google Sheets
2. 檢查「版本歷史」查看是否有異常操作
3. 確認標題行是否完整
4. 檢查是否有其他人同時編輯
```

### 2. 檢查 Apps Script 日誌
```
1. 開啟 Google Apps Script
2. 查看「執行」記錄
3. 尋找錯誤訊息
4. 特別注意 ID 生成的日誌
```

### 3. 測試 ID 生成
```javascript
// 在 Apps Script 中執行測試
function testIdGeneration() {
  const sheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Bookings');
  const newId = generateNextId(sheet, 'Booking');
  Logger.log('新 ID: ' + newId);
  Logger.log('現有記錄數: ' + (sheet.getLastRow() - 1));
}
```

## 📊 建議的資料庫結構改進

### 1. 添加必要欄位
```
Bookings 表格應該包含：
- id (PRIMARY KEY, AUTO_INCREMENT)
- is_deleted (BOOLEAN, DEFAULT FALSE)
- deleted_at (TIMESTAMP, NULL)
- deleted_by (STRING, NULL)
- created_at (TIMESTAMP, NOT NULL)
- updated_at (TIMESTAMP, NOT NULL)
```

### 2. 建立備份機制
```javascript
// 每次重要操作前自動備份
function backupBeforeOperation() {
  const sourceSheet = spreadsheet.getSheetByName('Bookings');
  const backupSheet = spreadsheet.getSheetByName('Bookings_Backup');
  
  // 清空備份表
  backupSheet.clear();
  
  // 複製所有資料
  const data = sourceSheet.getDataRange().getValues();
  if (data.length > 0) {
    backupSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  }
  
  Logger.log('備份完成: ' + new Date());
}
```

## 🚀 緊急修復步驟

如果資料已經遺失：

### 1. 立即停止所有操作
```bash
# 通知所有使用者暫停操作
```

### 2. 檢查版本歷史
```
Google Sheets → 檔案 → 版本歷史 → 查看版本歷史
找到資料完整的版本並還原
```

### 3. 匯出備份
```javascript
// 緊急備份所有資料
function emergencyBackup() {
  const sheets = ['Bookings', 'Partners', 'Payouts'];
  const backupData = {};
  
  sheets.forEach(sheetName => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    backupData[sheetName] = sheet.getDataRange().getValues();
  });
  
  // 儲存到 Drive
  const file = DriveApp.createFile(
    'backup_' + new Date().toISOString() + '.json',
    JSON.stringify(backupData)
  );
  
  Logger.log('備份檔案: ' + file.getUrl());
}
```

## 📝 後續改進建議

### 短期（立即執行）
1. ✅ 部署改進的 ID 生成邏輯
2. ✅ 添加操作日誌記錄
3. ✅ 實施資料備份機制

### 中期（1-2 週）
1. 實施軟刪除機制
2. 添加資料驗證規則
3. 建立自動備份排程

### 長期（1 個月）
1. 考慮遷移到真正的資料庫（Firebase, PostgreSQL）
2. 實施完整的審計日誌
3. 添加資料恢復功能

## ⚠️ 重要提醒

1. **永遠不要直接在 Google Sheets 手動刪除資料**
   - 使用系統功能刪除
   - 或標記為已刪除

2. **定期備份**
   - 每天自動備份
   - 重要操作前手動備份

3. **監控異常**
   - 檢查 ID 是否連續
   - 監控資料筆數變化
   - 記錄所有刪除操作

---

## 🆘 需要協助？

如果發現資料遺失或異常：
1. 立即停止操作
2. 檢查版本歷史
3. 執行緊急備份
4. 聯繫技術支援

---

*最後更新：2024年8月*