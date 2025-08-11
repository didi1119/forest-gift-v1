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
    const { ambassadorName, ambassadorId, lineLink, contactInfo } = req.body;

    if (!ambassadorName || !ambassadorId || !lineLink) {
      return res.status(400).json({ error: '缺少必要欄位' });
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

    // 檢查大使是否已存在
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const existingAmbassador = rows.find(row => row.ambassadorId === ambassadorId);

    if (existingAmbassador) {
      return res.status(409).json({ error: '此大使 ID 已存在' });
    }

    // 生成專屬網址（使用當前域名）
    const baseUrl = req.headers.host ? `https://${req.headers.host}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-domain.vercel.app';
    const siteUrl = `${baseUrl}?amb=${ambassadorId}&name=${encodeURIComponent(ambassadorName)}`;

    // 記錄到 Google Sheets
    await sheet.addRow({
      ambassadorId,
      ambassadorName,
      lineLink,
      contactInfo: contactInfo || '',
      siteUrl,
      netlifyId: '', // Vercel 不需要此欄位
      createdAt: new Date().toISOString(),
      status: 'active',
      totalClicks: 0,
      totalConversions: 0,
      lastActiveAt: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      ambassadorId,
      siteUrl,
      message: '知音大使專屬連結創建成功！'
    });

  } catch (error) {
    console.error('創建大使連結錯誤:', error);
    return res.status(500).json({ 
      error: '系統錯誤',
      details: error.message 
    });
  }
}