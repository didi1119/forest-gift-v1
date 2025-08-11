const { GoogleSpreadsheet } = require('google-spreadsheet');
const { GoogleAuth } = require('google-auth-library');
const config = require('../../config/credentials');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // 連接 Google Sheets
    const doc = new GoogleSpreadsheet(config.googleSheets.sheetId);
    const auth = new GoogleAuth({
      credentials: {
        client_email: config.googleSheets.clientEmail,
        private_key: config.googleSheets.privateKey.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    doc.useServiceAccountAuth(auth);
    await doc.loadInfo();

    // 取得大使資料
    const mainSheet = doc.sheetsByIndex[0];
    const rows = await mainSheet.getRows();
    
    const ambassadors = rows.map(row => ({
      ambassadorId: row.ambassadorId,
      ambassadorName: row.ambassadorName,
      lineLink: row.lineLink,
      contactInfo: row.contactInfo,
      siteUrl: row.siteUrl,
      netlifyId: row.netlifyId,
      createdAt: row.createdAt,
      status: row.status,
      totalClicks: parseInt(row.totalClicks) || 0,
      totalConversions: parseInt(row.totalConversions) || 0,
      lastActiveAt: row.lastActiveAt
    }));

    // 計算統計資料
    const stats = {
      totalAmbassadors: ambassadors.length,
      totalClicks: ambassadors.reduce((sum, amb) => sum + amb.totalClicks, 0),
      totalConversions: ambassadors.reduce((sum, amb) => sum + amb.totalConversions, 0)
    };

    // 取得最近活動（如果活動記錄表存在）
    let recentActivity = [];
    try {
      const activitySheet = doc.sheetsByTitle['活動記錄'];
      if (activitySheet) {
        const activityRows = await activitySheet.getRows();
        recentActivity = activityRows
          .slice(-20) // 取最近 20 筆
          .reverse() // 最新的在前
          .map(row => ({
            ambassadorId: row.ambassadorId,
            eventType: row.eventType,
            timestamp: row.timestamp,
            userAgent: row.userAgent,
            referer: row.referer,
            ip: row.ip,
            additionalData: row.additionalData
          }));
      }
    } catch (error) {
      console.log('活動記錄表不存在或讀取失敗:', error.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        ambassadors,
        stats,
        recentActivity
      })
    };

  } catch (error) {
    console.error('取得大使資料錯誤:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: '系統錯誤',
        details: error.message 
      })
    };
  }
}; 