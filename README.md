# 🌲 靜謐森林知音計畫 - 完整聯盟行銷管理系統

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-2.0-blue.svg)](https://github.com/yourusername/forest-affiliate-system)

一個完整的聯盟行銷管理平台，專為靜謐森林民宿設計，包含申請審核、佣金管理、績效追蹤等功能。

## 🎯 系統概覽

### 核心功能
- 🎴 **神諭卡片系統** - 互動式占卜體驗，60張精美SVG卡片
- 👥 **大使申請管理** - 完整的申請到審核流程，從邀請到轉換
- 💰 **智能佣金計算** - 三級等級制度自動管理，手動確認入住
- 📊 **即時數據分析** - 全面的績效追蹤面板，卡片使用統計
- 🔗 **追蹤連結生成** - 自動化推廣工具，參數化追蹤

### 技術亮點
- **無服務器架構** - 基於 Google Apps Script 和 Google Sheets
- **零 CORS 問題** - 創新的表單提交機制
- **響應式設計** - 完美支援桌面和行動裝置
- **即時數據同步** - 所有操作立即反映在管理後台

## 🆕 最新功能

### v2.0 重大更新
- ✅ **完整申請審核系統** - 從邀請表單到大使轉換的全流程
- ✅ **手動佣金確認機制** - 基於實際入住完成的佣金計算
- ✅ **卡片使用行為追蹤** - 深度分析用戶偏好和行為模式
- ✅ **三級大使晉升制度** - 自動化等級管理和獎勵發放
- ✅ **多維度數據分析** - 轉換漏斗、趨勢分析、排行榜

## 🚀 技術架構

### 前端技術
- **HTML5 + CSS3**：語意化標籤與現代CSS
- **Vanilla JavaScript**：輕量級互動邏輯
- **Tailwind CSS**：快速響應式樣式
- **SVG Graphics**：高品質神諭卡圖案

### 後端服務
- **Google Apps Script**：無伺服器中繼服務
- **Google Sheets API**：資料儲存與管理
- **GitHub Pages**：靜態網站託管

### 設計系統
- **品牌色彩**：森林綠 (#3A5A40) + 暖米色系
- **字體系統**：思源黑體 + 思源宋體
- **動畫效果**：淡入、翻牌、懸浮互動
- **響應式設計**：Mobile-first 設計理念

## 📁 專案結構

```
知音計畫/
├── frontend/                    # 前端檔案
│   ├── index.html              # 主頁面（神諭卡片系統）
│   ├── invitation.html         # 大使申請表單
│   ├── story.html             # 品牌故事頁面
│   ├── music.html             # 音樂頁面
│   ├── policy.html            # 隱私政策
│   ├── inner_map.html         # 內部地圖
│   └── admin/                 # 管理後台
│       ├── admin-dashboard-real.html       # 主管理面板
│       ├── analytics-dashboard.html       # 數據分析面板
│       ├── application-review-dashboard.html  # 申請審核面板
│       ├── manual-booking.html            # 手動訂房登記
│       ├── manual-checkin-confirm.html    # 入住確認系統
│       └── link-generator-form.html       # 連結生成器
├── backend/                    # 後端檔案（Apps Script）
│   ├── apps-script-integration-complete.js  # 完整整合代碼
│   ├── apps-script-commission-v2.js         # 佣金管理系統
│   ├── apps-script-applications-update.js   # 申請管理功能
│   └── apps-script-card-tracking-update.js  # 卡片追蹤功能
├── setup/                      # 設定檔案
│   ├── setup-sheets-v2.html    # Google Sheets 設定指南
│   ├── update-sheets-applicants.html  # 申請表格設定
│   ├── affiliate-terms.html    # 合作條款頁面
│   └── card-tracking-update.js # 卡片追蹤更新
├── docs/                       # 文件資料
│   ├── APPLICATION_SYSTEM_SETUP.md  # 申請系統設定指南
│   ├── COMPLETE_SYSTEM_GUIDE.md     # 完整系統指南
│   └── database-structure-v2.md     # 資料庫結構說明
├── cards/                      # 神諭卡片 SVG 檔案
│   ├── 1. 長日(The Longest Day).svg
│   ├── 2 永夜 (The Longest Night).svg
│   └── ... (共60張卡片)
├── netlify/                    # Netlify 部署檔案
└── 知音.txt                     # 專案說明檔案
```

## 🎯 獎勵制度

### LV.1 知音大使 (The Insider)
- **加入條件**：免費受邀加入
- **獎勵**：每筆推薦 NT$1,000住宿金 或 NT$500現金
- **晉升條件**：年度4組成功推薦

### LV.2 森林嚮導 (The Guide)  
- **晉升禮物**：靜謐森林特色紀念信物
- **獎勵升級**：每筆推薦 NT$1,200住宿金 或 NT$600現金
- **特權**：品牌共創、森友故事專欄
- **晉升條件**：年度10組成功推薦

### LV.3 秘境守護者 (The Guardian)
- **晉升禮物**：守護者之息客製香水
- **最高獎勵**：每筆推薦 NT$1,500住宿金 或 NT$800現金  
- **專屬特權**：年度住宿券、延遲退房、優先體驗權

## 🔮 神諭卡系統

### 卡片分類
- **天語 (12張)**：季節與天氣的智慧
- **地籟 (24張)**：大地與自然的指引
- **心鑰 (24張)**：內在成長的鑰匙

### 占卜方式
- **三卡布局**：根 (過去) → 幹 (現在) → 冠 (未來)
- **詳細解釋**：鏡、語、徑、影 四個面向
- **精美圖案**：手工繪製SVG藝術圖

## 📊 數據追蹤

### 追蹤指標
- 頁面瀏覽 (Page View)
- 連結點擊 (Link Click)  
- 神諭卡抽取 (Card Draw)
- LINE優惠券點擊 (CTA Click)
- 推薦轉換 (Referral Conversion)

### 資料結構
```sql
Partners  - 大使資料 (代碼、等級、獎勵)
Clicks    - 點擊記錄 (時間、來源、轉換)
Bookings  - 訂房記錄 (客戶、金額、佣金)  
Payouts   - 結算記錄 (週期、總額、狀態)
```

## 🚀 快速開始

### 1. 環境準備
1. 建立 Google Account 並開啟 Google Sheets
2. 設定 Google Apps Script 專案
3. 準備網站託管環境（GitHub Pages/Vercel/Netlify）

### 2. 資料庫設定
使用 `setup/setup-sheets-v2.html` 設定您的 Google Sheets：

```bash
# 必要的工作表
- Partners     # 大使管理表
- Bookings     # 訂房記錄表  
- Payouts      # 佣金發放表
- Clicks       # 點擊追蹤表
- Applicants   # 申請管理表
```

### 3. 後端部署
1. 開啟 Google Apps Script
2. 複製 `backend/apps-script-integration-complete.js` 內容
3. 設定必要的環境變數
4. 發佈為網路應用程式

### 4. 前端部署
1. 更新各檔案中的 `APPS_SCRIPT_URL`
2. 上傳到您的網站託管服務
3. 設定網域和 SSL

## 🔧 設定指南

### Apps Script 環境變數
```javascript
const SHEETS_ID = 'YOUR_GOOGLE_SHEETS_ID';
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL';
```

### 前端設定
每個 HTML 檔案都需要更新 Apps Script URL：
```javascript
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
```

## 🧪 系統測試

### 功能測試清單
- [ ] 神諭卡片系統 - 抽卡、圖片顯示、追蹤記錄
- [ ] 大使申請流程 - 表單提交、狀態更新、審核功能
- [ ] 佣金管理系統 - 手動登記、入住確認、自動計算
- [ ] 管理後台 - 數據顯示、篩選功能、匯出功能
- [ ] 追蹤連結 - 生成、點擊記錄、轉換統計

### 完整工作流程測試
```
申請提交 → 審核核准 → 生成連結 → 點擊追蹤 → 
手動登記 → 確認入住 → 佣金計算 → 等級晉升
```

## 📊 管理後台功能

### 🎛️ 主管理面板 (`admin/admin-dashboard-real.html`)
- 即時績效總覽和 KPI 監控
- 大使狀態監控和等級分佈
- 佣金計算和發放管理
- 點擊和轉換統計圖表

### 📈 數據分析面板 (`admin/analytics-dashboard.html`)
- 趨勢圖表分析（7天/30天/90天）
- 神諭卡片使用統計和熱度排行
- 轉換漏斗分析和用戶路徑
- 大使績效排名和質量評估

### 👤 申請審核面板 (`admin/application-review-dashboard.html`)
- 申請狀態管理（待審核/已核准/已拒絕）
- 審核工作流程和備註系統
- 大使連結生成和代碼分配
- 批量操作和 CSV 匯出功能

## 📚 文件資源

- [申請系統設定指南](docs/APPLICATION_SYSTEM_SETUP.md) - 完整的申請流程設定
- [完整系統操作手冊](docs/COMPLETE_SYSTEM_GUIDE.md) - 佣金管理和操作指南
- [資料庫結構說明](docs/database-structure-v2.md) - Google Sheets 結構文件

## 🤝 貢獻指南

歡迎提交 Issue 和 Pull Request！

### 開發環境設定
1. Fork 此專案
2. 建立功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 🛡️ 安全性功能

- **資料加密** - 敏感資訊加密存儲
- **訪問控制** - 基於角色的權限管理
- **審核日誌** - 完整的操作記錄
- **防濫用** - 頻率限制和垃圾訊息過濾

## 📞 技術支援

如有任何問題或建議，歡迎聯繫：
- 📧 Email: [您的聯絡信箱]
- 🌐 網站: [您的網站連結]
- 📱 LINE: @478hisen

---

## 💡 設計理念

> 在這個喧囂的時代，我們相信最好的連結來自於無所求的分享。每一份禮物都承載著我們想與您共同守護的寧靜，願它們能為您的日常帶來片刻的安頓與喜悅。

**靜謐森林知音計畫 v2.0** 不只是一個聯盟行銷系統，更是一個連結內心與他人的溫柔橋樑。

## 🎉 特別感謝

感謝所有參與開發和測試的朋友們，讓靜謐森林知音計畫得以完美呈現！

---

**🌲 靜謐森林，等待您的知音相聚 ✨**

*最後更新：2025年1月 - v2.0 完整版*