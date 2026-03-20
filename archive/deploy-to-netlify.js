const https = require('https');

async function createNetlifySite() {
  const NETLIFY_TOKEN = 'nfp_cxYU84jTiBMztvaWoG7czxtTRCApay2Q1dee';
  const GITHUB_REPO = 'https://github.com/didi1119/forest-gift';
  
  const siteConfig = {
    name: 'forest-gift-main',
    repo: {
      provider: 'github',
      repo_owner: 'didi1119',
      repo_name: 'forest-gift',
      repo_branch: 'main'
    },
    build_settings: {
      cmd: 'echo "No build needed"',
      dir: '.',
      env: {
        GOOGLE_SHEET_ID: '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4',
        GOOGLE_CLIENT_EMAIL: 'forest-ambassador@foresthouse-468510.iam.gserviceaccount.com',
        GOOGLE_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDBu7t2F9Rqsq7N
13jBN8azJ+8k+SYvtUZLIGnMMFXA4CP8VUE/MiWz4X8Tiu6kG2ABKDPBYhU7eu1v
CBcCfxhiDhVr6LPS1YYs48L5lBbwGv7c8n2YUU+gn8KL/FWLF6MJcs80nr34hLB8
RDtmjBhAc8aeZgegblSpbEJJPgyVkzdJPzEq7BJvbYI4Pv92oREaV126kMIS2X72
H6O5uQJPfhUEX4G6o5Cn4UJzXpYmH7QF7LP4DqJElfd4OGuwgKhvSATjB5/i04R/
Oyhs/lV09aW1pwana6gLCNVWiKHACgDniob3FPOmIkbu+iB5DzIokePkKJ/SmdKl
6yQiRUmNAgMBAAECggEAO1iy+F4caAMMoWncR/Q6Hi+hhoX8OKkjO2hWgIJeApOm
8ml7b0yBWDU/pFDvAb6RDkmucRMGxg3GJjkoM0+TvJXr4f6K948JZz7uP14qGKts
X2q5Jqvh5KaMBi3qVo2LGB3fc5MdRr//AFI2kBdiZnwQ3/0JYQ/rR2sucxla6YaB
9w+VJP73+X900TEfm+jCm4tiYIr4gI/Us4xMRvJIX0XtXkFEnRFaETOccNUkgC9s
WpIsTDRthG1F89txU3T5hAbFiBOBfCjLWT9Osh2nvjhGnE94hAY/OyLfyDJmEyln
VGboCBCPxPyWwXXC1cOwFgoma33jTq+gGbiGNVee0QKBgQD7oS2Zj25f+AaAA8gT
PoiSVK6gXLwUIv2QhRF/snOPoq8jS4dYGeVZHyrSpC8h7ODBESOQUqmZZYgQcvEs
DSLhs2IpijtSA2tt05EGDKm/PF/bsbt5xPrDNLvney0+/aUTgivvkxdTrxuyvJ0V
58nMfHqcXeg2XN/wODePuzKfgwKBgQDFGSEyjoizvFGolC2q6wVI59vf2P5Wkb+b
XEhxahavGPaRXnqUqPshHBleJ9BcijGUHDt1YO9kd64iLGHb1UWjUqsg/ChZtdvG
3vFkAMqXZVE56lboZWO+aW0tx4ns6kmog72cP9HdGgLo5FFBTZrPFHjZLVgLCkUL
eKjrmXGVrwKBgQDxYsQQvJRggdkScw46z9FJtuyyL2PJWWuveMe5nWHYV3L1Q945
ONZX8VsuKIyCWe+dpihcqb/CxLCLPwh2fr+IjoHLYazYVyl2eO91Qy6PooY+hbhX
7wuzuWHMhNB5ze7O0R/+ujc1cxT6GJAE1I80l/EzEa7Sf7PfiL5cJnNAqwKBgFug
ohlBv/Vmr8OiF1Tk61EIUORQmXSfTycnkJoBCsid30qXVH81y4GJ8ZUfBzNuHzxO
n6mixce8B5zlaxzqmfQiY2HzN8L001YxoKCv6X7WYBt/gKWLNQJ5OoNUxx73kASi
MgyocqTKCd5A/jFQpY5tYvz7onmHba+2iTj13aMLAoGAJ8E8ru52/rcCF22Cpngs
BB1R4oHw6RmsZddxtDWwInBFoUjQuoTO+tlGzPgRviFbJebK9CxHtuk73UepsojO
XbZKx0qp+WztcqGI8tOKETT6+9v93k8Qwion+anFl4jKVkLj/DSxJaXVhu691Pzh
wPDNBdj0yXYGsFDtjCPs4mo=
-----END PRIVATE KEY-----`,
        NETLIFY_ACCESS_TOKEN: 'nfp_cxYU84jTiBMztvaWoG7czxtTRCApay2Q1dee',
        GITHUB_REPO_URL: 'https://github.com/didi1119/forest-gift.git'
      }
    }
  };

  console.log('🚀 開始創建 Netlify 站點...');
  
  try {
    const response = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(siteConfig)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Netlify 站點創建成功！');
      console.log('🌐 網站 URL:', result.ssl_url || result.url);
      console.log('🔧 站點 ID:', result.id);
      console.log('📋 站點名稱:', result.name);
      
      // 返回重要資訊
      return {
        success: true,
        url: result.ssl_url || result.url,
        siteId: result.id,
        siteName: result.name
      };
    } else {
      console.error('❌ 創建失敗:', result);
      return { success: false, error: result };
    }
    
  } catch (error) {
    console.error('❌ 網路錯誤:', error);
    return { success: false, error: error.message };
  }
}

// 使用 fetch polyfill for Node.js
async function fetch(url, options) {
  return new Promise((resolve, reject) => {
    const data = options?.body ? options.body : '';
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options?.method || 'GET',
      headers: options?.headers || {}
    };

    if (data) {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(requestOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(responseData))
        });
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

// 執行部署
createNetlifySite().then(result => {
  if (result.success) {
    console.log('\n🎉 部署完成！');
    console.log('請訪問您的網站:', result.url);
    console.log('\n📝 接下來的步驟:');
    console.log('1. 等待 2-3 分鐘讓站點完全部署');
    console.log('2. 訪問連結生成器測試功能');
    console.log('3. 訪問管理後台查看數據');
  } else {
    console.log('\n❌ 部署失敗，請檢查錯誤訊息');
  }
});