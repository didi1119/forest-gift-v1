// Apps Script 主程式：中繼轉址與日誌功能
// 部署為 Web App，處理 GET（轉址）與 POST（週記）請求

const SPREADSHEET_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
const GITHUB_PAGES_URL = 'https://你的網址.github.io/知音計畫'; // 待更新
const LINE_COUPON_BASE = 'https://line.me/R/ti/p/%40your_line_account'; // 待更新

function doGet(e) {
  try {
    const params = e.parameter;
    const pid = params.pid || params.subid; // 聯盟夥伴代碼
    const dest = params.dest; // 目標類型：'landing' 或 'coupon'
    const referer = e.headers && e.headers.referer ? e.headers.referer : '';
    
    // 驗證參數
    if (!pid) {
      return HtmlService.createHtmlOutput('錯誤：缺少 pid 參數');
    }
    
    if (!dest || !['landing', 'coupon'].includes(dest)) {
      return HtmlService.createHtmlOutput('錯誤：dest 參數必須是 landing 或 coupon');
    }
    
    // 記錄點擊日誌
    logClick(pid, dest === 'landing' ? 'click' : 'coupon', referer);
    
    // 生成目標 URL
    let targetUrl;
    if (dest === 'landing') {
      // 跳轉到 GitHub Pages 主頁，帶上 subid 參數
      targetUrl = `${GITHUB_PAGES_URL}?subid=${encodeURIComponent(pid)}&utm_source=affiliate&utm_medium=referral&utm_campaign=${encodeURIComponent(pid)}`;
    } else if (dest === 'coupon') {
      // 跳轉到 LINE 優惠券
      targetUrl = `${LINE_COUPON_BASE}?utm_source=affiliate&utm_medium=coupon&utm_campaign=${encodeURIComponent(pid)}`;
    }
    
    // 執行轉址
    return HtmlService.createHtmlOutput(`
      <script>
        window.location.href = '${targetUrl}';
      </script>
      <p>正在跳轉到目標頁面...</p>
      <p><a href="${targetUrl}">如果沒有自動跳轉，請點擊此連結</a></p>
    `);
    
  } catch (error) {
    console.error('doGet 錯誤:', error);
    return HtmlService.createHtmlOutput('系統錯誤，請稍後再試');
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const subid = data.subid;
    const content = data.content;
    
    if (!content) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: '缺少週記內容' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 保存週記到 Journals 表
    const success = saveJournal(subid, content);
    
    return ContentService
      .createTextOutput(JSON.stringify({ success }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('doPost 錯誤:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: '系統錯誤' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function logClick(partnerCode, type, referer = '') {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Clicks Log');
    
    if (!sheet) {
      throw new Error('找不到 Clicks Log 工作表');
    }
    
    // 新增記錄
    sheet.appendRow([
      new Date(), // ts
      partnerCode, // partner_code
      type, // type (click/coupon)
      referer, // referrer
      '', // user_agent (Apps Script 無法直接獲取)
      '' // ip (Apps Script 無法直接獲取)
    ]);
    
    console.log(`記錄點擊：${partnerCode} - ${type}`);
    
  } catch (error) {
    console.error('記錄點擊失敗:', error);
  }
}

function saveJournal(subid, content) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Journals');
    
    if (!sheet) {
      throw new Error('找不到 Journals 工作表');
    }
    
    // 產生唯一 ID
    const journalId = Utilities.getUuid();
    
    // 新增週記記錄
    sheet.appendRow([
      journalId, // id
      subid || '', // subid
      content, // content
      new Date() // timestamp
    ]);
    
    console.log(`保存週記：${subid || '匿名'}`);
    return true;
    
  } catch (error) {
    console.error('保存週記失敗:', error);
    return false;
  }
}

// 測試函數
function testConnections() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('✅ Spreadsheet 連接成功:', ss.getName());
    
    const clicksSheet = ss.getSheetByName('Clicks Log');
    console.log('✅ Clicks Log 工作表存在:', !!clicksSheet);
    
    const journalsSheet = ss.getSheetByName('Journals');
    console.log('✅ Journals 工作表存在:', !!journalsSheet);
    
    // 測試記錄點擊
    logClick('TEST001', 'click', 'test-referer');
    console.log('✅ 測試點擊記錄完成');
    
    // 測試保存週記
    const journalSuccess = saveJournal('TEST001', '這是一個測試週記');
    console.log('✅ 測試週記保存:', journalSuccess);
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
  }
}

// 夜間彙整函數（預留）
function dailyAggregation() {
  // 這個函數將在後續實作中完成
  console.log('夜間彙整功能待實作');
}