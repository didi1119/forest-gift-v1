const { GoogleSpreadsheet } = require('google-spreadsheet');
const { GoogleAuth } = require('google-auth-library');

export default async function handler(req, res) {
  // 設定 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ambassadorId, eventType, eventData } = req.body;

    if (!ambassadorId || !eventType) {
      return res.status(400).json({ error: '缺少必要參數' });
    }

    // 連接 Google Sheets
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    });
    
    await doc.loadInfo();

    // 找到對應的大使記錄
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const ambassadorRow = rows.find(row => row.ambassadorId === ambassadorId);

    if (!ambassadorRow) {
      return res.status(404).json({ error: '找不到此大使' });
    }

    // 更新統計數據
    const currentTime = new Date().toISOString();
    
    if (eventType === 'click') {
      ambassadorRow.totalClicks = (parseInt(ambassadorRow.totalClicks) || 0) + 1;
      ambassadorRow.lastActiveAt = currentTime;
    } else if (eventType === 'conversion') {
      ambassadorRow.totalConversions = (parseInt(ambassadorRow.totalConversions) || 0) + 1;
      ambassadorRow.lastActiveAt = currentTime;
    }

    // 保存更新
    await ambassadorRow.save();

    // 如果有追蹤表，也記錄詳細的事件
    if (doc.sheetsByIndex[1]) {
      const trackingSheet = doc.sheetsByIndex[1];
      await trackingSheet.addRow({
        ambassadorId,
        ambassadorName: ambassadorRow.ambassadorName,
        eventType,
        eventData: JSON.stringify(eventData || {}),
        userAgent: req.headers['user-agent'] || '',
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '',
        timestamp: currentTime
      });
    }

    return res.status(200).json({
      success: true,
      message: '追蹤數據已更新',
      stats: {
        totalClicks: ambassadorRow.totalClicks,
        totalConversions: ambassadorRow.totalConversions
      }
    });

  } catch (error) {
    console.error('追蹤效能錯誤:', error);
    return res.status(500).json({ 
      error: '系統錯誤',
      details: error.message 
    });
  }
}