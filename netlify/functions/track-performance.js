const { GoogleSpreadsheet } = require('google-spreadsheet');
const { GoogleAuth } = require('google-auth-library');
const config = require('../../config/credentials');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { ambassadorId, eventType, data } = JSON.parse(event.body);

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

    // 主要大使資料表
    const mainSheet = doc.sheetsByIndex[0];
    const rows = await mainSheet.getRows();
    const ambassadorRow = rows.find(row => row.ambassadorId === ambassadorId);

    if (!ambassadorRow) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '找不到該大使資料' })
      };
    }

    // 更新績效數據
    switch (eventType) {
      case 'page_view':
        ambassadorRow.totalClicks = (parseInt(ambassadorRow.totalClicks) || 0) + 1;
        ambassadorRow.lastActiveAt = new Date().toISOString();
        break;
        
      case 'cta_click':
        ambassadorRow.totalConversions = (parseInt(ambassadorRow.totalConversions) || 0) + 1;
        ambassadorRow.lastActiveAt = new Date().toISOString();
        break;
        
      case 'card_draw':
        // 記錄占卜使用
        break;
    }

    await ambassadorRow.save();

    // 詳細活動記錄表
    const activitySheet = doc.sheetsByTitle['活動記錄'] || await doc.addSheet({ title: '活動記錄' });
    
    await activitySheet.addRow({
      ambassadorId,
      eventType,
      timestamp: new Date().toISOString(),
      userAgent: event.headers['user-agent'] || '',
      referer: event.headers.referer || '',
      ip: event.headers['client-ip'] || event.headers['x-forwarded-for'] || '',
      additionalData: JSON.stringify(data || {})
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('績效追蹤錯誤:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '系統錯誤' })
    };
  }
}; 