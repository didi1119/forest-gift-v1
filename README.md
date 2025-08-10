# 🌲 靜謐森林知音計畫

> 一個充滿寧靜力量的品牌大使系統，讓每一次分享都成為內心的橋樑。

## 📖 專案簡介

靜謐森林知音計畫是一個完整的品牌大使系統，包含：

- 🎁 **數位禮物包**：音樂、電子書、神諭卡、故事四大體驗
- 🔮 **60張神諭卡系統**：互動式塔羅占卜體驗
- 📊 **推薦追蹤系統**：完整的 subid/pid 追蹤機制
- 🎯 **三級獎勵制度**：知音大使 → 森林嚮導 → 秘境守護者
- 📱 **響應式設計**：適配所有設備的優雅體驗

## 🌟 主要功能

### 🎁 數位體驗
- **禮物一**：《內在森林的回響》音樂播放清單
- **禮物二**：《內心地圖繪製手冊》互動式指南
- **禮物三**：世界樹神諭卡占卜系統 (60張精美SVG)
- **禮物四**：靜謐森林品牌故事

### 📊 大使系統
- 專屬推薦連結生成
- 即時點擊與轉換追蹤
- 三級成長獎勵制度
- 自動佣金計算與結算

### 🔧 管理功能
- 管理後台儀表板
- Google Sheets 數據庫
- Apps Script 自動化處理
- 功能開關與A/B測試

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

## 📱 頁面結構

```
🏠 index.html           - 主頁與數位禮物包
🎵 music.html          - 音樂播放清單
📖 inner_map.html      - 內在地圖手冊  
📚 story.html          - 森林故事
🔗 link-generator.html - 連結生成器
📊 admin-dashboard.html - 管理後台
📋 policy.html         - 隱私政策
📝 affiliate-terms.html - 聯盟條款
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

## 🛠️ 部署指南

### 環境需求
- GitHub 帳號
- Google Cloud Platform 專案
- Google Sheets 與 Apps Script
- LINE Official Account (選用)

### 快速部署
1. **Clone Repository**
```bash
git clone https://github.com/didi1119/forest-gift-v1.git
```

2. **設定 Google Sheets**
```javascript
// 執行 sheets-setup-complete.js
initializeAllSheets();
```

3. **部署 Apps Script**
```javascript  
// 上傳 apps-script-main.js 到 Google Apps Script
// 發布為 Web App，獲取 URL
```

4. **啟用 GitHub Pages**
- Settings → Pages → Deploy from branch: main
- 網址：https://didi1119.github.io/forest-gift-v1

### 設定更新
- 更新 `link-generator.html` 中的 Apps Script URL
- 更新所有檔案中的 LINE 連結
- 測試所有功能是否正常運作

## 🧪 測試指南

### 功能測試
- [ ] 主頁載入與推薦功能 (?subid=test123)
- [ ] 神諭卡抽卡與圖片顯示
- [ ] 所有禮物頁面跳轉
- [ ] 連結生成器功能
- [ ] 管理後台數據顯示
- [ ] 追蹤事件記錄 (Console)

### 響應式測試
- [ ] 手機瀏覽器 (iOS/Android)
- [ ] 平板瀏覽器 (iPad/Android)
- [ ] 桌面瀏覽器 (Chrome/Safari/Firefox)

## 📞 技術支援

### 聯絡資訊
- **GitHub Issues**：https://github.com/didi1119/forest-gift-v1/issues
- **開發團隊**：Claude Code + 靜謐森林團隊

### 服務帳號
```
Email: forest-ambassador@foresthouse-468510.iam.gserviceaccount.com
Project: foresthouse-468510
```

---

## 💡 設計理念

> 在這個喧囂的時代，我們相信最好的連結來自於無所求的分享。每一份禮物都承載著我們想與您共同守護的寧靜，願它們能為您的日常帶來片刻的安頓與喜悅。

**靜謐森林知音計畫**不只是一個品牌大使系統，更是一個連結內心與他人的溫柔橋樑。

---

*🌲 Generated with [Claude Code](https://claude.ai/code) - 用心感受，用愛分享*