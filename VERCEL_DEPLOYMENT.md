# Vercel 部署指南

## 前置準備

1. **註冊 Vercel 帳號**
   - 前往 [Vercel](https://vercel.com) 註冊帳號
   - 建議使用 GitHub 帳號登入

2. **安裝 Vercel CLI** (已完成)
   ```bash
   npm install -g vercel
   ```

## 部署步驟

### 方法一：使用 Vercel CLI（推薦）

1. **登入 Vercel**
   ```bash
   vercel login
   ```
   - 選擇您偏好的登入方式（Email / GitHub / GitLab / Bitbucket）
   - 在瀏覽器中完成驗證

2. **部署專案**
   ```bash
   vercel
   ```
   - 第一次部署時會詢問一些設定：
     - Set up and deploy "~/Library/Mobile Documents/com~apple~CloudDocs/知音計畫"? `Y`
     - Which scope do you want to deploy to? 選擇您的帳號
     - Link to existing project? `N` (新專案選 N)
     - What's your project's name? `forest-ambassador`
     - In which directory is your code located? `.` (當前目錄)
     - Want to override the settings? `N`

3. **設定環境變數**
   
   部署後，需要在 Vercel 控制台設定環境變數：
   
   a. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
   b. 點擊您的專案 `forest-ambassador`
   c. 進入 Settings → Environment Variables
   d. 新增以下環境變數：
   
   - `GOOGLE_SHEET_ID`: `1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4`
   - `GOOGLE_CLIENT_EMAIL`: `forest-ambassador@foresthouse-468510.iam.gserviceaccount.com`
   - `GOOGLE_PRIVATE_KEY`: (貼上完整的私鑰，包含 BEGIN 和 END 行)
     ```
     -----BEGIN PRIVATE KEY-----
     MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDBu7t2F9Rqsq7N
     [... 完整私鑰內容 ...]
     -----END PRIVATE KEY-----
     ```

4. **重新部署以套用環境變數**
   ```bash
   vercel --prod
   ```

### 方法二：透過 GitHub 整合

1. **推送程式碼到 GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Forest Ambassador"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **在 Vercel 導入專案**
   - 前往 [Vercel Dashboard](https://vercel.com/dashboard)
   - 點擊 "Add New..." → "Project"
   - 選擇您的 GitHub repository
   - 設定環境變數（同上）
   - 點擊 "Deploy"

## 驗證部署

部署成功後，您會獲得一個網址，格式如：
- `https://forest-ambassador.vercel.app`
- 或自訂域名

### 功能測試清單

1. **首頁載入**
   - 訪問 `https://your-domain.vercel.app`
   - 確認頁面正常顯示

2. **音樂頁面**
   - 訪問 `https://your-domain.vercel.app/music`
   - 測試音樂播放功能

3. **故事頁面**
   - 訪問 `https://your-domain.vercel.app/story`
   - 確認內容正常顯示

4. **內在地圖**
   - 訪問 `https://your-domain.vercel.app/inner-map`
   - 測試互動功能

5. **連結生成器**
   - 訪問 `https://your-domain.vercel.app/generator`
   - 測試創建新的大使連結
   - 確認 Google Sheets 有新增記錄

6. **管理後台**
   - 訪問 `https://your-domain.vercel.app/admin`
   - 確認可以看到大使列表
   - 測試數據追蹤功能

7. **API 端點測試**
   - GET `https://your-domain.vercel.app/api/get-ambassadors`
   - POST `https://your-domain.vercel.app/api/create-ambassador`
   - POST `https://your-domain.vercel.app/api/track-performance`

## 常見問題

### 1. API 返回 500 錯誤
- 檢查環境變數是否正確設定
- 確認 Google Service Account 權限
- 查看 Vercel Functions 日誌

### 2. 頁面路由不工作
- 確認 vercel.json 中的路由設定
- 檢查檔案名稱是否正確

### 3. Google Sheets 連接失敗
- 確認 Google Sheets ID 正確
- 確認 Service Account 有編輯權限
- 檢查私鑰格式（需包含換行符）

## 專案結構

```
知音計畫/
├── index.html          # 首頁
├── music.html          # 音樂頁面
├── story.html          # 故事頁面
├── inner_map.html      # 內在地圖
├── link-generator.html # 連結生成器
├── admin-dashboard.html# 管理後台
├── api/                # API 端點
│   ├── create-ambassador.js
│   ├── get-ambassadors.js
│   └── track-performance.js
├── css/                # 樣式檔案
├── js/                 # JavaScript 檔案
├── images/             # 圖片資源
├── vercel.json         # Vercel 配置
└── package.json        # 專案配置
```

## 更新部署

當您修改程式碼後，重新部署：

```bash
vercel --prod
```

或如果使用 GitHub 整合，只需推送到 main 分支：

```bash
git add .
git commit -m "Update message"
git push
```

## 監控和日誌

- 前往 Vercel Dashboard
- 點擊專案 → Functions 標籤
- 查看 API 執行日誌和錯誤訊息

## 支援

如有問題，請查看：
- [Vercel 文檔](https://vercel.com/docs)
- [Vercel Functions 指南](https://vercel.com/docs/functions)
- 專案 GitHub Issues