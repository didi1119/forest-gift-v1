const { GoogleSpreadsheet } = require('google-spreadsheet');
const { GoogleAuth } = require('google-auth-library');
const config = require('../../config/credentials');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // 處理 CORS 預檢請求
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
    const { ambassadorName, ambassadorId, lineLink, contactInfo } = JSON.parse(event.body);

    // 驗證必要欄位
    if (!ambassadorName || !ambassadorId || !lineLink) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少必要欄位' })
      };
    }

    // 1. 連接 Google Sheets 資料庫
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

    // 2. 檢查大使是否已存在
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const existingAmbassador = rows.find(row => row.ambassadorId === ambassadorId);

    if (existingAmbassador) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: '此大使 ID 已存在' })
      };
    }

    // 3. 生成專屬網址
    const siteId = `forest-${ambassadorId}`;
    const customDomain = `${siteId}.netlify.app`;

    // 4. 通過 Netlify API 創建新站點
    const netlifyResponse = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.netlify.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: siteId,
        custom_domain: customDomain,
        build_settings: {
          repo_url: config.github.repoUrl,
          branch: 'main',
          dir: '.',
          cmd: 'echo "No build needed"'
        },
        environment_variables: {
          AMBASSADOR_ID: ambassadorId,
          AMBASSADOR_NAME: ambassadorName,
          LINE_LINK: lineLink
        }
      })
    });

    const siteData = await netlifyResponse.json();

    if (!netlifyResponse.ok) {
      throw new Error(`Netlify API 錯誤: ${siteData.message}`);
    }

    // 5. 記錄到 Google Sheets
    const newRow = await sheet.addRow({
      ambassadorId,
      ambassadorName,
      lineLink,
      contactInfo: contactInfo || '',
      siteUrl: `https://${customDomain}`,
      netlifyId: siteData.id,
      createdAt: new Date().toISOString(),
      status: 'active',
      totalClicks: 0,
      totalConversions: 0,
      lastActiveAt: new Date().toISOString()
    });

    // 6. 觸發部署
    const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteData.id}/deploys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.netlify.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch: 'main',
        title: `Initial deploy for ${ambassadorName}`
      })
    });

    const deployData = await deployResponse.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        ambassadorId,
        siteUrl: `https://${customDomain}`,
        deployId: deployData.id,
        message: '知音大使專屬網站創建成功！預計 2-3 分鐘後可訪問。'
      })
    };

  } catch (error) {
    console.error('創建大使網站錯誤:', error);
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