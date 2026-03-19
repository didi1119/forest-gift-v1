// ========================================
// Vercel Serverless Function — 統一 API 入口
// ========================================

const { route, handleRedirect, handleLineWebhook } = require('./_lib/backend');

module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    if (req.method === 'POST' && ((req.headers['x-line-signature'] || req.headers['X-Line-Signature']) || (req.body && Array.isArray(req.body.events)))) {
      return await handleLineWebhook(req, res);
    }

    // GET: 點擊追蹤重導向
    if (req.method === 'GET' && (req.query.ref || req.query.pid || req.query.subid)) {
      // 如果沒有 action，當作重導向處理
      if (!req.query.action) {
        return await handleRedirect(req, res);
      }
    }

    // 取得 action 參數（GET query 或 POST body）
    const action = req.query.action || (req.body && req.body.action);

    if (!action) {
      // GET 無 action：可能是測試或重導向
      if (req.method === 'GET') {
        if (req.query.test) {
          return res.status(200).json({ success: true, message: 'API is running' });
        }
        return await handleRedirect(req, res);
      }
      return res.status(400).json({ success: false, error: 'Action is required' });
    }

    // 合併 query params 和 body
    const data = { ...req.query, ...(req.body || {}) };
    delete data.action; // 避免 action 被當成業務資料

    console.log(`[API] ${req.method} action=${action}`);

    // 路由到對應 handler
    const result = await route(action, data);

    // 回應
    const statusCode = result.success === false ? 400 : 200;
    return res.status(statusCode).json(result);

  } catch (error) {
    console.error('[API Error]', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};
