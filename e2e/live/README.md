# Live E2E

這一層是「真實操作驗證」，不是只驗 API 規則。

它會做三件事：
- 實際操作瀏覽器頁面
- 檢查畫面可見內容是否符合預期
- 回頭查 Supabase 與 API，確認資料真的寫入或回滾

## 需求

- Node 22+
- `playwright-core`
- `@supabase/supabase-js` 不是必要，但可與既有 helper 共用
- Chrome 或 Chromium 可被 Playwright 啟動

如果本機沿用既有暫存安裝，可設定：

```bash
export NODE_PATH=/tmp/codex-browser-test/node_modules
```

## 環境變數

必要：
- `ADMIN_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

常用：
- `API_BASE` 預設 `https://forest-ambassador.vercel.app/api`
- `SITE_ORIGIN` 預設 `https://forest-ambassador.vercel.app`

## 執行

單支：

```bash
cd e2e/live
node scripts/e2e-admin-ui.js
```

整套：

```bash
cd e2e/live
./run-suite.sh
```

## 本地頁面 + 正式 API

當你要先驗證尚未部署的前端修正時，用 helper 啟本地代理：

```bash
node helpers/local-admin-proxy.js
```

然後把：

```bash
export SITE_ORIGIN=http://127.0.0.1:4173
export API_BASE=http://127.0.0.1:4173/api
```

這樣瀏覽器會吃本地 HTML，但 `/api` 仍轉到正式環境。

## 覆蓋矩陣

- `e2e-admin-ui.js`
  - 手動新增訂房
  - 編輯訂房
  - 確認入住
  - 刪除訂房
- `e2e-booking-line-attribution-ui.js`
  - 手動訂房 modal 選取近期 LINE claim
  - 預設採用最新推薦者
  - 編輯訂單時手動覆蓋推薦者
  - 回查 Supabase 驗證 `LATEST_LINE_CLAIM / MANUAL_OVERRIDE`
- `e2e-partner-financial-ui.js`
  - 使用住宿金
  - 點數轉現金
  - 執行結算
- `e2e-partner-adjustments-ui.js`
  - 現金轉回住宿金
  - 手動調整佣金
- `e2e-overview-batch-ui.js`
  - 概覽卡片
  - 分析頁
  - 批量結算
- `e2e-payout-management-ui.js`
  - 修改結算
  - 取消結算
- `e2e-payout-labels-ui.js`
  - payout 類型顯示一致性
- `e2e-batch-partner-ops-ui.js`
  - 批量全部轉現金
  - 批量結算待付現金
- `e2e-manual-checkin-ui.js`
  - `manual-checkin-confirm.html`
  - 首次推薦加碼與入住確認
- `e2e-retroactive-commissions-ui.js`
  - 取消後回溯重算
  - 首次推薦獎勵轉移
- `e2e-level-boundaries-ui.js`
  - LV1 -> LV2
  - LV2 -> LV3
- `e2e-level-debt-ui.js`
  - 已花點數後取消
  - 已結算現金後取消
  - `DEBT_RECORD`
- `e2e-payout-reversal-ui.js`
  - reversal 類 payout 與餘額回補
- `e2e-public-funnel-ui.js`
  - 公開申請頁
  - 審核後台
  - 轉正式夥伴
  - 夥伴登入
  - partner dashboard 各分頁
  - click tracking
- `e2e-application-onboarding-ui.js`
  - 公開申請頁含銀行資訊
  - admin onboarding 工作台審核
  - 帶預填資料進連結生成器
  - 直接建立基本大使
  - 驗證短網址與交付資源包
- `e2e-api-edge-cases.js`
  - `cancel_accommodation_usage`
  - `partial_refund`
  - `batch_cancel`

## 目前刻意排除

- `restore_booking`
  - 產品規則已改成「取消不可恢復」
- 年度重置
  - 需要可控時間或獨立 staging，比正式庫直接測安全
- 併發壓力
  - 適合獨立 staging，不適合直接打正式資料庫

## 產物

所有腳本都會把截圖或 JSON artifact 寫到：

```text
/tmp/codex-browser-test/
```
