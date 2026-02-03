# 🧪 知音計畫測試系統

> 模組化、文檔化的自動化測試框架

## 📁 目錄結構

```
test/
├── README.md                         # 本文件（快速入門）
├── TEST-ARCHITECTURE.md              # 測試架構設計文檔
├── FILE-CLEANUP-PLAN.md              # 文件清理計劃（歷史記錄）
├── TEST-SUITE.html                   # 唯一測試執行器 ⭐
│
├── core/                             # 核心框架
│   └── test-framework.js            # TestFramework 類定義
│
├── suites/                           # 測試套件（按類別分離）
│   ├── basic-tests.js               # 基礎功能測試
│   ├── commission-tests.js          # 佣金計算測試（待完成）
│   ├── booking-lifecycle-tests.js   # 訂房生命週期（待完成）
│   ├── cancellation-tests.js        # 取消與回滾（待完成）
│   ├── points-tests.js              # 點數操作（待完成）
│   ├── payout-tests.js              # 結算管理（待完成）
│   ├── level-upgrade-tests.js       # 等級升級（待完成）
│   └── consistency-tests.js         # 數據一致性（待完成）
│
├── docs/                             # 測試文檔
│   ├── TEST-GUIDE.md                # 測試使用指南 📖
│   └── COMPREHENSIVE-TEST-CHECKLIST.md # 完整測試檢查清單
│
├── reports/                          # 測試報告
│   └── TEST-EXECUTION-REPORT-20260203.md
│
└── _archived/                        # 歸檔的舊文件
    ├── *.html                       # 舊的測試執行器
    └── scripts/                     # 舊的測試腳本
```

---

## 🚀 快速開始

### 1. 打開測試執行器

```
在瀏覽器中打開：test/TEST-SUITE.html
```

### 2. 配置參數

- **Apps Script URL**: 您的部署網址
- **測試大使代碼**: 建議使用 `TEST_AUTO`
- **選擇測試類別**: 勾選要執行的測試
- **勾選選項**:
  - ✓ 測試後清理數據（推薦）
  - ✓ 顯示詳細日誌（推薦）

### 3. 運行測試

點擊「開始測試」，系統會自動：
1. 檢查/創建測試大使
2. 執行選定的測試
3. 顯示即時進度
4. 生成測試報告

### 4. 查看結果

- 綠色 = 通過 ✓
- 紅色 = 失敗 ✗
- 橙色 = 跳過 ⚠️

---

## 📚 文檔導覽

| 文檔 | 用途 | 適用對象 |
|------|------|---------|
| [README.md](./README.md) | 快速入門 | 所有人 |
| [TEST-ARCHITECTURE.md](./TEST-ARCHITECTURE.md) | 測試架構設計 | 開發者 |
| [docs/TEST-GUIDE.md](./docs/TEST-GUIDE.md) | 詳細使用指南 | 測試人員 |
| [COMPREHENSIVE-TEST-CHECKLIST.md](./COMPREHENSIVE-TEST-CHECKLIST.md) | 完整測試清單 | QA 人員 |

---

## 🧩 測試分類

| 類別 | 說明 | 測試數 | 耗時 | 頻率 |
|------|------|--------|------|------|
| **Basic** | 基礎功能（API、數據結構） | 2 | ~15秒 | 必要 |
| **Commission** | 佣金計算（各等級、首次獎勵） | 8 | ~45秒 | 必要 |
| **Lifecycle** | 訂房生命週期 | 1 | ~40秒 | 必要 |
| **Cancellation** | 取消與回滾 | 3 | ~120秒 | 必要 |
| **Points** | 點數操作 | 3 | ~45秒 | 必要 |
| **Payout** | 結算管理 | 5 | ~90秒 | 建議 |
| **Level** | 等級升級 | 4 | ~180秒 | 按需 |
| **Consistency** | 數據一致性 | 2 | ~20秒 | 必要 |

**完整測試預估時間**: 6-9 分鐘

---

## 🛠️ 修改測試

### 修改現有測試

1. 找到對應文件：`test/suites/[category]-tests.js`
2. 編輯測試的 `execute` 函數
3. 保存並重新載入測試頁面

### 新增測試

1. 在對應的 `suites/*.js` 文件中新增測試物件
2. 加入導出陣列
3. 更新文檔

詳細說明請見：[docs/TEST-GUIDE.md](./docs/TEST-GUIDE.md)

---

## 📋 測試原則

### 雙重驗證

每個測試都應該：
1. **操作驗證** - 確認操作成功執行
2. **數據驗證** - 確認數據正確更新

### 測試隔離

- 每個測試獨立運行
- 不依賴其他測試結果
- 使用 `TEST_` 前綴標識測試數據
- 測試後自動清理

### 明確斷言

- 清晰的錯誤訊息
- 具體的預期值和實際值
- 詳細的日誌輸出

---

## ⚠️ 注意事項

### 測試環境

- ⚠️ 連接到**生產環境** Google Sheets
- ⚠️ 會創建和修改**真實數據**
- ✅ 所有測試數據使用 `TEST_` 前綴
- ✅ 建議勾選「測試後清理數據」

### 執行時機

- **修改代碼後**: 執行相關類別測試
- **每週**: 執行完整測試套件
- **發布前**: 必須全部通過

---

## 🆘 常見問題

**Q: 測試失敗怎麼辦？**
A: 查看錯誤訊息，參考 [TEST-GUIDE.md](./docs/TEST-GUIDE.md) 的故障排除章節

**Q: 如何只測試特定功能？**
A: 在測試執行器中只勾選相關的測試類別

**Q: 測試數據會不會影響生產？**
A: 測試數據使用 `TEST_` 前綴且會自動清理，不影響正常業務

**Q: 為什麼有些測試被跳過？**
A: 通常是因為找不到符合條件的測試數據，這是正常的

---

## 📈 測試覆蓋率

### 當前狀態

- 基礎功能: ✅ 100%
- 佣金計算: ⚠️ 60%（部分測試待完善）
- 訂房管理: ⚠️ 70%
- 點數操作: ⚠️ 60%
- 數據一致性: ✅ 100%

### 目標

- 核心功能: 100%
- 金錢計算: 100%
- 一般功能: >90%
- 邊界條件: >85%

---

## 🔄 版本歷史

### v2.0 (2026-02-03)
- ✅ 重構測試架構為模組化設計
- ✅ 統一測試執行器為 TEST-SUITE.html
- ✅ 測試按類別分離到 suites/ 目錄
- ✅ 創建完整的測試文檔
- ✅ 清理重複和過時的文件
- ✅ 自動創建測試大使功能

### v1.x (2024-2025)
- 多個測試執行器（已歸檔）
- 測試腳本混雜（已重組）

---

## 📞 技術支援

- **系統文檔**: [CLAUDE.md](../CLAUDE.md)
- **架構文檔**: [COMMISSION-SYSTEM-ARCHITECTURE.md](../docs/COMMISSION-SYSTEM-ARCHITECTURE.md)
- **測試架構**: [TEST-ARCHITECTURE.md](./TEST-ARCHITECTURE.md)
- **使用指南**: [docs/TEST-GUIDE.md](./docs/TEST-GUIDE.md)

---

**維護者**: Claude Code
**最後更新**: 2026-02-03
**版本**: 2.0
