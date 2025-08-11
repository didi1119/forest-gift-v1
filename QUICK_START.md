# 🚀 靜謐森林知音計畫 v2.0 - 快速開始指南

## 📋 部署檢查清單

### ✅ 第一步：設定 Google Sheets 資料庫
1. 開啟 `setup/setup-sheets-v2.html`
2. 按照指引建立五個工作表：Partners、Bookings、Payouts、Clicks、Applicants
3. 複製 Google Sheets ID 供後續使用

### ✅ 第二步：部署 Apps Script 後端
1. 開啟 Google Apps Script (script.google.com)
2. 建立新專案
3. 複製 `backend/apps-script-integration-complete.js` 的完整內容
4. 設定環境變數：
   ```javascript
   const SHEETS_ID = '您的_GOOGLE_SHEETS_ID';
   ```
5. 發佈為網路應用程式
6. 記錄 Apps Script URL

### ✅ 第三步：配置前端系統
1. 更新所有 HTML 檔案中的 Apps Script URL：
   ```javascript
   const APPS_SCRIPT_URL = '您的_APPS_SCRIPT_URL';
   ```
   
2. 需要更新的檔案：
   - `frontend/invitation.html` - 申請表單
   - `frontend/admin/application-review-dashboard.html` - 審核後台
   - `frontend/admin/admin-dashboard-real.html` - 管理後台
   - `frontend/admin/analytics-dashboard.html` - 分析面板
   - `frontend/admin/manual-booking.html` - 手動訂房
   - `frontend/admin/manual-checkin-confirm.html` - 入住確認
   - `frontend/admin/link-generator-form.html` - 連結生成器

### ✅ 第四步：測試系統功能
1. **申請流程測試**：
   - 開啟 `frontend/invitation.html` 
   - 填寫測試申請
   - 在 `frontend/admin/application-review-dashboard.html` 審核
   - 生成大使連結

2. **佣金系統測試**：
   - 使用 `frontend/admin/manual-booking.html` 登記訂房
   - 使用 `frontend/admin/manual-checkin-confirm.html` 確認入住
   - 檢查佣金自動計算

3. **數據分析測試**：
   - 檢查 `frontend/admin/analytics-dashboard.html` 數據顯示
   - 確認神諭卡片使用統計功能

## 🎯 管理流程示範

### 日常操作工作流程
```
1. 新申請通知 → 開啟申請審核後台
2. 審核申請資料 → 核准並生成大使代碼  
3. 客人來電訂房 → 手動訂房登記系統
4. 客人入住完成 → 入住確認系統
5. 系統自動計算 → 佣金和等級更新
6. 定期檢視分析 → 數據分析面板
```

### 週期性管理任務
- **每日**：檢查新申請、確認入住狀態
- **每週**：審核績效數據、匯出報表
- **每月**：佣金結算、等級晉升評估
- **每季**：深度數據分析、策略調整

## 📊 核心指標監控

### 申請轉換漏斗
```
邀請頁面瀏覽 → 申請提交 → 審核通過 → 轉為大使 → 首次推薦 → 持續活躍
```

### 關鍵績效指標
- **申請轉換率**：瀏覽到申請的轉換百分比
- **審核通過率**：申請到核准的成功比率  
- **大使活躍度**：推薦成功率和頻率統計
- **平均佣金**：每位大使的平均收益

## 🛠️ 故障排除

### 常見問題解決

**Q: 申請表單提交失敗？**
- 確認 Apps Script URL 正確
- 檢查 Google Sheets 權限設定
- 確認 Applicants 工作表已建立

**Q: 管理後台無法載入數據？**  
- 檢查 CORS 設定和 Apps Script 發佈狀態
- 確認 Google Sheets ID 正確
- 檢查瀏覽器控制台錯誤訊息

**Q: 佣金計算不正確？**
- 確認大使等級設定正確
- 檢查佣金率配置
- 確認入住狀態已正確更新

## 📞 技術支援

遇到問題？查看詳細文件：
- [完整系統指南](docs/COMPLETE_SYSTEM_GUIDE.md)
- [申請系統設定](docs/APPLICATION_SYSTEM_SETUP.md)  
- [資料庫結構](docs/database-structure-v2.md)

## 🎉 準備就緒！

完成上述步驟後，您的靜謐森林知音計畫 v2.0 就完全準備就緒了！

**系統已包含：**
- ✅ 完整的申請審核流程
- ✅ 自動化的佣金計算系統
- ✅ 三級大使等級管理
- ✅ 即時數據分析面板
- ✅ 神諭卡片使用追蹤
- ✅ 響應式管理後台

---

**🌲 歡迎來到完整的知音計畫管理體驗！✨**