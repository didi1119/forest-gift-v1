/**
 * admin-auth.js — 管理頁面共用驗證模組
 *
 * 在 <head> 引入此腳本，所有對 /api 的 fetch 請求會自動帶上 admin_secret。
 * 密碼輸入一次後存入 sessionStorage，同一瀏覽器 session 內不再重複詢問。
 *
 * 用法：<script src="admin-auth.js"></script>
 */
(function () {
  const STORAGE_KEY = 'admin_secret';

  // 從 sessionStorage 讀取，若無則 prompt
  let adminSecret = sessionStorage.getItem(STORAGE_KEY) || '';
  if (!adminSecret) {
    adminSecret = prompt('請輸入管理密碼（admin_secret）') || '';
    if (adminSecret) {
      sessionStorage.setItem(STORAGE_KEY, adminSecret);
    }
  }

  // 提供全域存取（方便頁面內 JS 也能讀到）
  window.__adminSecret = adminSecret;

  // 攔截原生 fetch，自動注入 admin_secret
  const originalFetch = window.fetch;

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));

    // 只攔截對自己 API 的請求（/api 開頭），不影響外部 API（reurl.cc 等）
    const isApiCall = url.startsWith('/api') || url.includes('/api?');
    if (!isApiCall || !adminSecret) {
      return originalFetch.call(this, input, init);
    }

    init = init || {};
    const method = (init.method || 'GET').toUpperCase();

    if (method === 'GET' || !init.body) {
      // GET 請求：在 URL 加上 admin_secret query param
      const separator = url.includes('?') ? '&' : '?';
      const newUrl = url + separator + 'admin_secret=' + encodeURIComponent(adminSecret);
      return originalFetch.call(this, newUrl, init);
    }

    // POST 請求：依 Content-Type 注入
    const contentType = (init.headers && (init.headers['Content-Type'] || init.headers['content-type'])) || '';

    if (typeof init.body === 'string') {
      if (contentType.includes('application/json')) {
        // JSON body
        try {
          const body = JSON.parse(init.body);
          body.admin_secret = adminSecret;
          init.body = JSON.stringify(body);
        } catch (e) {
          // 無法解析則不動
        }
      } else {
        // URL-encoded form body（application/x-www-form-urlencoded 或其他字串 body）
        init.body = init.body + '&admin_secret=' + encodeURIComponent(adminSecret);
      }
    } else if (init.body instanceof URLSearchParams) {
      init.body.set('admin_secret', adminSecret);
    }

    return originalFetch.call(this, input, init);
  };

  console.log('[admin-auth] 驗證模組已載入' + (adminSecret ? '' : '（未設定密碼）'));
})();
