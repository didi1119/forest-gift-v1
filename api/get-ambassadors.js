const { GoogleSpreadsheet } = require('google-spreadsheet');
const { GoogleAuth } = require('google-auth-library');

export default async function handler(req, res) {
  // 設定 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

    // 獲取所有大使數據
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const ambassadors = rows.map(row => ({
      ambassadorId: row.ambassadorId,
      ambassadorName: row.ambassadorName,
      lineLink: row.lineLink,
      contactInfo: row.contactInfo || '',
      siteUrl: row.siteUrl,
      createdAt: row.createdAt,
      status: row.status || 'active',
      totalClicks: parseInt(row.totalClicks) || 0,
      totalConversions: parseInt(row.totalConversions) || 0,
      lastActiveAt: row.lastActiveAt
    }));

    return res.status(200).json({
      success: true,
      ambassadors,
      total: ambassadors.length
    });

  } catch (error) {
    console.error('獲取大使列表錯誤:', error);
    return res.status(500).json({ 
      error: '系統錯誤',
      details: error.message 
    });
  }
}