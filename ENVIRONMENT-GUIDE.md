# 環境操作指南

## 兩個環境，一張表看懂

| | 正式環境（Production） | 測試環境（Preview） |
|---|---|---|
| **分支** | `main` | `dev` |
| **網址** | `forest-ambassador.vercel.app` | Vercel 自動產生的預覽網址 |
| **資料庫** | 正式 Supabase（`myenmff...`） | 測試 Supabase（`actkgwf...`） |
| **LINE 通知** | 會發送 | 不會發送（無金鑰） |
| **Email 通知** | 會寄送 | 不會寄送（無金鑰） |
| **管理密碼** | 1499 | 1499 |

---

## 日常操作流程

### 情況 A：只改前端（HTML / CSS / 文字）

前端改動不會動到資料庫，風險很低。

```
直接在 main 分支修改 → 推送 → Vercel 自動部署正式版
```

跟 Claude 說：「改一下 XXX 頁面的 YYY」— 直接改就好。

### 情況 B：改後端邏輯 / API / 資料庫相關

後端改動可能影響真實資料，必須先在 dev 測試。

```
步驟 1：「切到 dev 分支」
步驟 2：修改程式碼
步驟 3：「推到 dev」→ Vercel 部署預覽版（用測試 DB）
步驟 4：在預覽網址上測試，確認沒問題
步驟 5：「把 dev 合到 main」→ Vercel 部署正式版（用正式 DB）
```

### 情況 C：不確定該怎麼做

跟 Claude 說：「現在在哪個分支？」或「這個改動需要走 dev 嗎？」

---

## 常用指令對照表

| 你想做的事 | 跟 Claude 說 |
|----------|-------------|
| 查看目前在哪個分支 | 「現在在哪個分支？」 |
| 切到測試環境開始開發 | 「切到 dev 分支」 |
| 把改動推到測試環境 | 「推到 dev」 |
| 測試完，要上正式環境 | 「把 dev 合到 main」 |
| 只改前端文字/樣式 | 直接說要改什麼，不用切分支 |
| 看 dev 跟 main 有什麼差異 | 「dev 跟 main 差了什麼？」 |

---

## 安全機制

### 自動保護
- **資料庫自動切換**：推到 `main` → 用正式 DB；推到 `dev` → 用測試 DB（Vercel 環境變數控制）
- **LINE/Email 只在正式環境有效**：測試環境沒有金鑰，不會發送任何通知
- **API 錯誤不阻擋流程**：發送失敗時程式會自動跳過，不會中斷其他操作

### 你要注意的
- **不要直接在 main 改後端邏輯**，先走 dev 測試
- **不要在 Vercel Dashboard 隨意改環境變數**，改之前問一下
- **測試用的大使/訂房資料**會存在測試 DB，不會污染正式資料

---

## Vercel 環境變數配置（目前狀態）

| 變數 | Production | Preview/Dev | 說明 |
|------|-----------|-------------|------|
| `SUPABASE_URL` | 正式 DB | 測試 DB | 資料庫自動切換 |
| `SUPABASE_SERVICE_KEY` | 正式金鑰 | 測試金鑰 | 資料庫自動切換 |
| `DATA_BACKEND` | `supabase` | `supabase` | 使用 Supabase 資料庫 |
| `ADMIN_SECRET` | `1499` | `1499` | 管理員密碼 |
| `LINE_CHANNEL_ACCESS_TOKEN` | 有 | 無 | 正式才發 LINE |
| `LINE_CHANNEL_SECRET` | 有 | 無 | 正式才驗證 LINE |
| `LINE_SHARED_COUPON_ID` | 有 | 無 | 正式才綁優惠券 |
| `RESEND_API_KEY` | 有 | 無 | 正式才寄 Email |
| `GOOGLE_PRIVATE_KEY` | 有 | 無 | Google Sheets（備用） |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | 有 | 無 | Google Sheets（備用） |

---

*最後更新：2026-03-21*
