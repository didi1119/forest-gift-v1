# 不知道網址時如何設定 GA4

## 🎯 問題：我還沒部署，不知道網址怎麼設定 GA4？

**答案：可以先用臨時網址建立，之後再更改！**

---

## 📋 方法1：使用臨時網址建立

### 建立 GA4 Property 時：
1. 網站 URL 暫時填入：`https://example.com`
2. 完成 GA4 設定並取得 Measurement ID
3. 部署後再回來更改為正確網址

### 之後如何更改網址：
1. 進入 GA4 → 管理 → 資料串流
2. 點擊你建立的網站串流
3. 更新「網址」欄位為你的實際網址
4. 儲存

**✅ 這樣不會影響追蹤功能！**

---

## 📋 方法2：先跳過 GA4，直接測試

### 你的網站現在已經可以運作：
- ✅ index.html 已經修復，不會再空白
- ✅ 所有功能都正常（抽卡、音樂、週記等）
- ✅ 追蹤功能會在 Console 中顯示

### 測試方法：
1. **開啟 index.html**
   ```
   雙擊 index.html 或
   在瀏覽器中開啟
   ```

2. **測試推薦功能**
   ```
   在網址後加上 ?subid=test123
   例如：file:///.../index.html?subid=test123
   ```

3. **查看追蹤資料**
   ```
   按 F12 → Console 頁籤
   看到所有事件記錄
   ```

---

## 🚀 建議的順序

### 現在立即可做：
1. **測試本地網站**
   - 開啟 index.html
   - 試試所有功能
   - 確認一切正常

2. **決定部署方式**
   - GitHub Pages（推薦）
   - Vercel
   - Netlify
   - 其他

### 部署後：
1. **取得實際網址**
   - 例如：`https://yourname.github.io/forest`

2. **設定 GA4**
   - 使用實際網址建立 Property
   - 取得 Measurement ID

3. **更新程式碼**
   - 取消註解 GA4 程式碼
   - 替換 ID

---

## 📁 部署到 GitHub Pages 教學

### 步驟1：建立 GitHub Repository
1. 前往 [GitHub](https://github.com)
2. 點擊「New repository」
3. 名稱填入：`forest-ambassador`
4. 選擇 Public
5. 點擊「Create repository」

### 步驟2：上傳檔案
1. 在 repository 頁面點擊「uploading an existing file」
2. 將以下檔案拖拉上傳：
   ```
   index.html
   inner_map.html
   music.html
   story.html
   admin-dashboard.html
   link-generator.html
   policy.html
   affiliate-terms.html
   feature-flags.js
   ```
3. 填寫 commit 訊息：「初始上傳」
4. 點擊「Commit changes」

### 步驟3：啟用 GitHub Pages
1. 在 repository 中點擊「Settings」
2. 在左側選單點擊「Pages」
3. Source 選擇「Deploy from a branch」
4. Branch 選擇「main」
5. 點擊「Save」

### 步驟4：取得網址
等待 2-3 分鐘後，你會看到：
```
Your site is published at https://你的GitHub帳號.github.io/forest-ambassador
```

**這就是你的網址！** 🎉

---

## 🎯 現在該做什麼？

### 立即測試：
```bash
# 開啟 index.html 看看是否正常顯示
open index.html
```

### 如果還是空白：
1. 按 F12 開啟開發者工具
2. 看 Console 是否有錯誤訊息
3. 告訴我錯誤內容

### 測試功能：
1. 試試抽卡功能
2. 點擊音樂、週記等連結
3. 在網址加上 `?subid=test123` 看推薦功能

**你的網站應該已經可以正常運作了！** ✨