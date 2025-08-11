# 環境變數設定指南

## 🔑 必要的環境變數

在 Netlify 後台的 **Site settings > Environment variables** 中設定以下變數：

### 1. Google Sheets API 設定

```
GOOGLE_SHEET_ID=your_google_sheet_id_here
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com  
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"
```

**取得方式：**
1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 啟用 Google Sheets API
4. 建立服務帳號金鑰
5. 下載 JSON 金鑰檔案

### 2. Netlify API 設定

```
NETLIFY_ACCESS_TOKEN=your_netlify_access_token_here
```

**取得方式：**
1. 前往 Netlify 後台
2. User settings > Applications > Personal access tokens
3. Generate new token

### 3. GitHub 儲存庫設定

```
GITHUB_REPO_URL=https://github.com/your-username/forest-gift.git
```

## 📊 Google Sheets 資料庫結構

### 主要工作表（第一個工作表）
| 欄位名稱 | 說明 |
|---------|------|
| ambassadorId | 大使代碼 |
| ambassadorName | 大使姓名 |
| lineLink | 專屬 LINE 優惠券連結 |
| contactInfo | 聯絡資訊 |
| siteUrl | 專屬網站網址 |
| netlifyId | Netlify 站點 ID |
| createdAt | 建立時間 |
| status | 狀態（active/inactive） |
| totalClicks | 總點擊數 |
| totalConversions | 總轉換數 |
| lastActiveAt | 最後活動時間 |

### 活動記錄工作表
| 欄位名稱 | 說明 |
|---------|------|
| ambassadorId | 大使代碼 |
| eventType | 事件類型 |
| timestamp | 時間戳記 |
| userAgent | 用戶代理 |
| referer | 來源頁面 |
| ip | IP 地址 |
| additionalData | 額外資料 |

## 🚀 部署步驟

1. **設定環境變數**：在 Netlify 後台設定上述變數
2. **建立 Google Sheets**：使用上述結構建立工作表
3. **部署網站**：推送程式碼到 GitHub 並連接 Netlify
4. **測試功能**：使用連結生成器測試自動化流程

## ⚠️ 注意事項

- **Google Sheets ID 取得**：可從試算表網址取得 `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
- **私鑰格式**：需要保持完整格式，包含 `\n` 換行符號
- **權限設定**：確保服務帳號有權限存取目標試算表
- **環境變數安全**：Netlify 環境變數會自動加密，請勿在程式碼中硬編碼
- **API 配額**：Google Sheets API 有使用限制，建議監控 API 呼叫次數

## 🔍 故障排除

### 常見問題

1. **Google Sheets 連線失敗**
   ```
   錯誤：Authentication failed
   解決方案：檢查服務帳號金鑰是否正確，確認試算表權限
   ```

2. **Netlify 函數部署失敗**
   ```
   錯誤：Function build failed
   解決方案：檢查 Node.js 版本，確認 package.json 依賴項
   ```

3. **環境變數未生效**
   ```
   錯誤：Environment variable not found
   解決方案：重新部署站點使環境變數生效
   ```

### 測試步驟

1. **API 連線測試**：使用 Postman 或 curl 測試 Netlify 函數
2. **Google Sheets 讀寫測試**：在管理後台查看數據是否正常同步
3. **大使連結測試**：生成測試連結並驗證追蹤功能

## 📋 部署檢查清單

- [ ] Git 儲存庫已推送到 GitHub
- [ ] Netlify 網站已連接到儲存庫  
- [ ] 環境變數已正確設定
- [ ] Google Sheets 已建立並設定權限
- [ ] 服務帳號金鑰已正確配置
- [ ] 函數部署成功無錯誤
- [ ] 連結生成器功能正常
- [ ] 管理後台可正常訪問
- [ ] 測試大使連結功能正常
- [ ] 績效追蹤數據正確記錄 