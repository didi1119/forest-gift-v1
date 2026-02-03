# 測試文件清理計劃

## 📁 現有文件分析

### 當前測試文件列表

```
test/
├── HTML 測試執行器 (7 個，有重複)
│   ├── integrated-test-suite.html (38K) ⭐ **保留並重命名**
│   ├── master-test-suite.html (36K) ❌ 刪除（與 integrated 重複）
│   ├── automated-test-suite.html (37K) ❌ 刪除（與 integrated 重複）
│   ├── one-click-test.html (41K) ❌ 刪除（功能已整合）
│   ├── new-features-test.html (17K) ❌ 刪除（功能已整合）
│   ├── test-cancel-payout.html (19K) ❌ 刪除（功能已整合）
│   └── test-cancel-payout-debug.html (15K) ❌ 刪除（調試版本）
│   └── test-payout-restricted-edit.html (13K) ❌ 刪除（特定功能測試）
│
├── JS 測試腳本 (7 個，有重複)
│   ├── scripts/test-framework.js (23K) ✅ **已複製到 core/**
│   ├── scripts/complex-test-scenarios.js (27K) ⚠️ 需要整合
│   ├── scripts/extreme-complex-scenarios.js (37K) ⚠️ 需要整合
│   ├── scripts/points-cancel-scenarios.js (25K) ⚠️ 需要整合
│   ├── scripts/cancel-rollback-deep-test.js (46K) ⚠️ 需要整合
│   ├── scripts/test-runner.js (12K) ❌ 刪除（已有新框架）
│   └── cancel-payout-fix-test.js (13K) ❌ 刪除（功能已整合）
│
└── 文檔 (7 個，需要整理)
    ├── README.md (3.3K) ✅ **保留**
    ├── TEST-ARCHITECTURE.md ⭐ **新建**
    ├── COMPREHENSIVE-TEST-CHECKLIST.md (24K) ✅ 保留（參考）
    ├── TEST-EXECUTION-REPORT-20260203.md (11K) ✅ 保留（歷史報告）
    ├── manual-test-checklist.md (3.0K) ⚠️ 可選（手動測試）
    ├── quick-test-guide.md (4.3K) ❌ 刪除（已有新指南）
    ├── docs/TEST-CASES.md (6.7K) ⚠️ 可選（參考）
    └── docs/TEST-PLAN.md (5.1K) ⚠️ 可選（參考）
```

---

## 🎯 清理目標

### 新的目錄結構

```
test/
├── README.md                          # 快速入門
├── TEST-ARCHITECTURE.md               # 架構設計（新）
├── TEST-SUITE.html                    # 唯一測試執行器（重命名）
│
├── core/                              # 核心框架
│   └── test-framework.js             # 測試框架核心
│
├── suites/                            # 測試套件（按類別）
│   ├── basic-tests.js                # 基礎功能測試（新）
│   ├── commission-tests.js           # 佣金計算測試（待創建）
│   ├── booking-lifecycle-tests.js    # 訂房生命週期測試（待創建）
│   ├── cancellation-tests.js         # 取消與回滾測試（待創建）
│   ├── points-tests.js               # 點數操作測試（待創建）
│   ├── payout-tests.js               # 結算管理測試（待創建）
│   ├── level-upgrade-tests.js        # 等級升級測試（待創建）
│   └── consistency-tests.js          # 數據一致性測試（待創建）
│
├── docs/                              # 測試文檔
│   ├── TEST-GUIDE.md                 # 使用指南（新）
│   └── COMPREHENSIVE-TEST-CHECKLIST.md # 測試檢查清單
│
├── reports/                           # 測試報告
│   └── TEST-EXECUTION-REPORT-20260203.md
│
└── _archived/                         # 歸檔（暫時保留）
    ├── master-test-suite.html
    ├── automated-test-suite.html
    ├── scripts/complex-test-scenarios.js
    ├── scripts/extreme-complex-scenarios.js
    ├── scripts/points-cancel-scenarios.js
    └── scripts/cancel-rollback-deep-test.js
```

---

## 📋 清理步驟

### 階段 1: 立即刪除（重複文件）

這些文件功能已被 `integrated-test-suite.html` 取代：

```bash
# 刪除重複的測試執行器
rm master-test-suite.html
rm automated-test-suite.html
rm one-click-test.html
rm new-features-test.html
rm test-cancel-payout.html
rm test-cancel-payout-debug.html
rm test-payout-restricted-edit.html

# 刪除過時的腳本
rm scripts/test-runner.js
rm cancel-payout-fix-test.js

# 刪除過時的文檔
rm quick-test-guide.md
```

### 階段 2: 重命名主要文件

```bash
# 重命名測試執行器
mv integrated-test-suite.html TEST-SUITE.html

# 移動測試報告到 reports/ 目錄
mv TEST-EXECUTION-REPORT-20260203.md reports/
```

### 階段 3: 整合舊測試腳本（需要手動處理）

將這些文件的測試內容整合到新的分類測試中：

1. **scripts/complex-test-scenarios.js** → 整合到 `suites/cancellation-tests.js`
2. **scripts/extreme-complex-scenarios.js** → 整合到 `suites/cancellation-tests.js`
3. **scripts/points-cancel-scenarios.js** → 整合到 `suites/points-tests.js`
4. **scripts/cancel-rollback-deep-test.js** → 整合到 `suites/cancellation-tests.js`

整合完成後，將原文件移到 `_archived/` 目錄：

```bash
mkdir -p _archived/scripts
mv scripts/complex-test-scenarios.js _archived/scripts/
mv scripts/extreme-complex-scenarios.js _archived/scripts/
mv scripts/points-cancel-scenarios.js _archived/scripts/
mv scripts/cancel-rollback-deep-test.js _archived/scripts/
```

### 階段 4: 可選文檔處理

這些文檔可以保留作為參考，但非必須：

```bash
# 選項 A: 移到 _archived/ 保留
mkdir -p _archived/docs
mv manual-test-checklist.md _archived/docs/
mv docs/TEST-CASES.md _archived/docs/
mv docs/TEST-PLAN.md _archived/docs/

# 選項 B: 直接刪除
rm manual-test-checklist.md
rm docs/TEST-CASES.md
rm docs/TEST-PLAN.md
```

### 階段 5: 清理 scripts/ 目錄

檢查 `scripts/` 目錄是否為空：

```bash
ls -la scripts/

# 如果只剩下 .gitkeep 或為空，可以刪除整個目錄
# 但建議保留，因為 core/ 中的文件可能會用到
```

---

## ⚠️ 清理前檢查清單

在執行清理前，請確認：

- [ ] 已備份重要的測試報告
- [ ] 已檢查 `integrated-test-suite.html` 功能完整
- [ ] 已閱讀並理解新的測試架構
- [ ] 已確認沒有其他地方引用要刪除的文件
- [ ] 已創建 `_archived/` 目錄用於暫存（可選）

---

## 🔧 推薦的清理命令

### 安全版本（移到歸檔）

```bash
cd "/Users/kobe/Library/Mobile Documents/com~apple~CloudDocs/知音計畫/test"

# 創建歸檔目錄
mkdir -p _archived/scripts _archived/docs

# 移動重複的 HTML 文件
mv master-test-suite.html _archived/
mv automated-test-suite.html _archived/
mv one-click-test.html _archived/
mv new-features-test.html _archived/
mv test-cancel-payout.html _archived/
mv test-cancel-payout-debug.html _archived/
mv test-payout-restricted-edit.html _archived/

# 移動過時的腳本
mv scripts/test-runner.js _archived/scripts/
mv cancel-payout-fix-test.js _archived/

# 移動測試腳本（待整合）
mv scripts/complex-test-scenarios.js _archived/scripts/
mv scripts/extreme-complex-scenarios.js _archived/scripts/
mv scripts/points-cancel-scenarios.js _archived/scripts/
mv scripts/cancel-rollback-deep-test.js _archived/scripts/

# 移動可選文檔
mv quick-test-guide.md _archived/docs/
mv manual-test-checklist.md _archived/docs/
mv docs/TEST-CASES.md _archived/docs/ 2>/dev/null || true
mv docs/TEST-PLAN.md _archived/docs/ 2>/dev/null || true

# 重命名主要文件
mv integrated-test-suite.html TEST-SUITE.html

# 移動測試報告
mkdir -p reports
mv TEST-EXECUTION-REPORT-20260203.md reports/

echo "✓ 文件清理完成！舊文件已移到 _archived/ 目錄"
```

### 激進版本（直接刪除）

```bash
cd "/Users/kobe/Library/Mobile Documents/com~apple~CloudDocs/知音計畫/test"

# ⚠️ 注意：此操作不可恢復！

# 刪除重複的 HTML 文件
rm -f master-test-suite.html automated-test-suite.html one-click-test.html \
      new-features-test.html test-cancel-payout.html test-cancel-payout-debug.html \
      test-payout-restricted-edit.html

# 刪除過時的腳本
rm -f scripts/test-runner.js cancel-payout-fix-test.js

# 刪除過時的文檔
rm -f quick-test-guide.md manual-test-checklist.md

# 重命名主要文件
mv integrated-test-suite.html TEST-SUITE.html

# 整理測試報告
mkdir -p reports
mv TEST-EXECUTION-REPORT-20260203.md reports/

echo "✓ 文件清理完成！"
```

---

## 📊 清理前後對比

| 項目 | 清理前 | 清理後 | 減少 |
|------|--------|--------|------|
| HTML 文件 | 8 個 | 1 個 | -87.5% |
| JS 測試腳本 | 7 個 | 1-9 個* | 視整合情況 |
| 文檔文件 | 7 個 | 3-4 個 | -50% |
| 總文件大小 | ~350KB | ~100KB | -71% |

*註：整合後會有 1 個核心框架 + 8 個分類測試套件

---

## ✅ 清理後的優勢

1. **清晰的結構** - 一個執行器 + 按類別分離的測試
2. **易於維護** - 修改測試只需編輯對應的 suites/ 文件
3. **避免混淆** - 不再有多個功能相似的文件
4. **文檔完整** - 清晰的架構文檔和使用指南
5. **模組化** - 可以單獨運行特定類別的測試

---

## 🆘 如果出問題怎麼辦？

### 如果使用了「安全版本」清理

所有文件都在 `_archived/` 目錄中，可以隨時恢復：

```bash
# 恢復某個文件
cp _archived/master-test-suite.html ./

# 恢復所有文件
cp -r _archived/* ./
```

### 如果使用了「激進版本」清理

可以從 Git 歷史恢復：

```bash
# 查看被刪除的文件
git log --diff-filter=D --summary

# 恢復特定文件
git checkout HEAD~1 -- test/master-test-suite.html
```

---

## 📝 後續任務

清理完成後，還需要：

1. [ ] 創建完整的測試套件文件（suites/*.js）
2. [ ] 修改 TEST-SUITE.html 從 suites/ 加載測試
3. [ ] 測試新架構是否正常運作
4. [ ] 更新 README.md 反映新結構
5. [ ] 提交 Git 並推送到遠端

---

**創建日期**: 2026-02-03
**狀態**: 待執行
