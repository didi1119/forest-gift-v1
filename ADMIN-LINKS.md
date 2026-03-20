# 知音計畫 - 管理後台連結清單

## 📌 主要管理後台

### 🏠 主控制台
**功能：** 查看所有大使、訂房、佣金、結算等完整數據
```
https://didi1119.github.io/forest-gift-v1/frontend/admin/admin-dashboard-real.html
```

---

## 🔧 核心功能頁面

### 🔗 連結生成器（最常用）
**功能：** 為大使生成專屬推薦連結和短網址
```
https://didi1119.github.io/forest-gift-v1/frontend/admin/link-generator-form.html
```

### 📝 手動訂房登記
**功能：** 手動登記新訂房記錄
```
https://didi1119.github.io/forest-gift-v1/frontend/admin/admin-dashboard-real.html?openManualBooking=1
```

### ✅ 入住確認
**功能：** 確認房客已完成入住（觸發佣金計算）
```
https://didi1119.github.io/forest-gift-v1/frontend/admin/manual-checkin-confirm.html
```

### 📊 分析儀表板
**功能：** 數據分析和統計
```
https://didi1119.github.io/forest-gift-v1/frontend/admin/analytics-dashboard.html
```

### 🧾 佣金審計
**功能：** 查看和審核佣金記錄
```
https://didi1119.github.io/forest-gift-v1/frontend/admin/commission-audit.html
```

### 📋 申請審核
**功能：** 審核大使申請
```
https://didi1119.github.io/forest-gift-v1/frontend/admin/application-review-dashboard.html
```

### 📚 資源中心
**功能：** 管理資源和文檔
```
https://didi1119.github.io/forest-gift-v1/frontend/admin/resources.html
```

---

## 🧪 測試工具

### 🔗 短網址測試
**功能：** 測試後端短網址代理服務（POST /api shorten_url）
```
https://didi1119.github.io/forest-gift-v1/frontend/admin/test-shorturl.html
```

### 🎁 優惠券流程測試
**功能：** 測試完整的推薦連結和優惠券流程
```
https://didi1119.github.io/forest-gift-v1/frontend/admin/test-coupon-flow.html
```

### 🧪 綜合測試套件
**功能：** 完整系統功能測試
```
https://didi1119.github.io/forest-gift-v1/frontend/admin/comprehensive-test-suite.html
```

### 📍 欄位映射測試
**功能：** 測試資料欄位對應
```
https://didi1119.github.io/forest-gift-v1/frontend/admin/field-mapping-test.html
```

### 🧪 短網址 API 測試
**功能：** 快速測試後端短網址代理
```
https://didi1119.github.io/forest-gift-v1/test-reurl-api.html
```

---

## 📱 前台頁面

### 🌲 主頁（推薦禮物包）
**功能：** 用戶看到的森林禮物頁面
```
https://didi1119.github.io/forest-gift-v1/
或
https://didi1119.github.io/forest-gift-v1/frontend/index.html
```

### 📝 大使申請頁面
**功能：** 新大使申請入口
```
https://didi1119.github.io/forest-gift-v1/frontend/invitation.html
```

---

## 🔖 快速書籤建議

建議您將以下**最常用**的連結加入瀏覽器書籤：

1. ⭐ **主控制台** - admin-dashboard-real.html
2. ⭐ **連結生成器** - link-generator-form.html
3. ⭐ **手動訂房** - admin-dashboard-real.html?openManualBooking=1
4. ⭐ **入住確認** - manual-checkin-confirm.html

---

## 📋 使用流程範例

### 新增大使流程：
1. 打開「連結生成器」
2. 填寫大使資訊和專屬 LINE 優惠券連結
3. 生成短網址
4. 儲存到 Google Sheets

### 訂房處理流程：
1. 打開「手動訂房登記」
2. 填寫房客資訊和推薦人代碼
3. 創建訂房記錄
4. 入住完成後，打開「入住確認」
5. 確認入住（自動計算佣金）

### 查看數據流程：
1. 打開「主控制台」
2. 查看所有大使和訂房資料
3. 使用「分析儀表板」查看統計
4. 使用「佣金審計」檢查結算記錄

---

## 🔐 重要提醒

- 這些是管理後台連結，請妥善保管
- 管理後台有簡易密碼驗證（admin_secret），API 每次請求都會檢查
- 大使端有 Email/代碼 + 手機末 4 碼驗證
- 建議不要公開分享管理連結

---

**最後更新：** 2026-03-20
**GitHub Repository：** https://github.com/didi1119/forest-gift-v1
