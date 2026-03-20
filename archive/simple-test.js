/**
 * 簡單測試函數 - 複製到 Apps Script 中
 */
function simpleTest() {
  // 測試 URL 解析
  const testUrl = 'https://line.me/ti/p/test123';
  const parsedUrl = safeParseUrl(testUrl);
  
  console.log('Test URL:', testUrl);
  console.log('Parsed hostname:', parsedUrl ? parsedUrl.hostname : 'failed to parse');
  
  // 測試白名單
  const allowedHosts = ['lin.ee', 'line.me', 'didi1119.github.io', 'github.io'];
  const isAllowed = parsedUrl && allowedHosts.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h));
  
  console.log('Allowed hosts:', allowedHosts);
  console.log('Is allowed:', isAllowed);
  
  // 測試參數解析
  const mockParams = {
    pid: 'TEST123',
    dest: 'coupon',
    target: 'https://line.me/ti/p/test123'
  };
  
  console.log('Mock params:', JSON.stringify(mockParams));
  
  return '測試完成，請查看執行記錄';
}

function safeParseUrl(s) {
  try { 
    return new URL(s); 
  } catch(e) { 
    return null; 
  }
}