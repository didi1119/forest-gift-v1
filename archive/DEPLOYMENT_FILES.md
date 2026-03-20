# 📁 部署檔案清單

## 🌐 前端頁面
- `index.html` - 主頁 (來自 index_old.html)
- `music.html` - 音樂播放清單頁面
- `inner_map.html` - 內在地圖手冊頁面
- `story.html` - 森林故事頁面
- `admin-dashboard.html` - 管理後台
- `link-generator.html` - 連結生成器
- `policy.html` - 隱私政策
- `affiliate-terms.html` - 聯盟夥伴條款

## 🎨 資源檔案
- `cards/` - 神諭卡SVG圖片資料夾 (60張)
- `feature-flags.js` - 功能開關設定

## ⚙️ 後端邏輯檔案
- `apps-script-main.js` - Apps Script 主程式
- `apps-script-aggregation.js` - 數據彙整腳本
- `setup-sheets.js` - Google Sheets 設定腳本
- `sheets-setup-complete.js` - 完整資料表設定

## 📋 文件檔案
- `README.md` - 專案說明
- `DEPLOYMENT_GUIDE.md` - 部署指南

## 🔧 設定檔
- `.github/workflows/deploy.yml` - GitHub Actions 自動部署設定

---

## 📊 部署後需要更新的設定

### 1. Apps Script 部署
- 上傳 `apps-script-main.js` 到 Google Apps Script
- 獲取 Web App URL
- 更新 `link-generator.html` 中的 `APPS_SCRIPT_URL`

### 2. Google Sheets 設定  
- 執行 `sheets-setup-complete.js` 建立資料表
- 添加服務帳號權限

### 3. LINE 設定
- 提供實際 LINE 帳號連結
- 更新所有檔案中的 LINE URL

---

## 🚀 GitHub Pages 設定
- Repository: `forest-gift-v1` (Private)
- 網址: https://didi1119.github.io/forest-gift-v1
- 首頁: index.html

## ✅ 準備狀態
- [x] 前端頁面完成
- [x] SVG資源準備完成
- [x] 後端邏輯腳本準備完成
- [x] 文件檔案準備完成
- [ ] GitHub Repository 建立
- [ ] 檔案上傳
- [ ] GitHub Pages 啟用
- [ ] 實際測試