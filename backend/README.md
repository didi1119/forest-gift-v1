# ⚠️ 已棄用 — 請勿使用

此目錄包含舊版 Google Apps Script 後端代碼，已被 Vercel Serverless Function 取代。

**目前正式後端在：** `api/_lib/backend.js`

## 檔案說明

- `apps-script-integrated-v5-complete.js` — 最後一版 Google Apps Script（v5），僅供歷史參考
- `archive/` — 更早期的版本（v2-v4），不應使用

## 為什麼棄用？

1. Google Apps Script 有 CORS 限制，導致前端需用 form.submit() 迴避
2. 執行時間限制（6 分鐘）不適合複雜佣金計算
3. 無法整合 Supabase 等現代資料庫
4. 除錯困難，缺乏本地開發環境

現在所有後端邏輯都在 `api/` 目錄，由 Vercel 託管。
