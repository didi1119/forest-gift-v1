// 簡化版配置 - 用於免費版部署
// 這個版本不依賴後端服務，所有功能都在前端運作

const SimpleConfig = {
  // 基本設定
  siteName: '靜謐森林・知音計畫',
  
  // 模擬大使資料（正式版本會從 Google Sheets 讀取）
  ambassadors: {
    'test': {
      name: '測試大使',
      lineLink: 'https://line.me/ti/p/@test',
      message: '歡迎來到測試大使的專屬森林體驗！'
    }
  },
  
  // 連結生成器配置
  linkGenerator: {
    baseUrl: window.location.origin,
    generateLink: function(ambassadorId, ambassadorName) {
      return `${this.baseUrl}?amb=${ambassadorId}&name=${encodeURIComponent(ambassadorName)}`;
    }
  },
  
  // 模擬後端功能
  mockBackend: {
    // 模擬創建大使網站
    createAmbassador: function(data) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const ambassadorId = data.ambassadorId || 'demo-' + Date.now();
          const siteUrl = `${window.location.origin}?amb=${ambassadorId}&name=${encodeURIComponent(data.ambassadorName)}`;
          
          resolve({
            success: true,
            ambassadorId: ambassadorId,
            siteUrl: siteUrl,
            message: '專屬連結生成成功！（演示版本）'
          });
        }, 1000);
      });
    },
    
    // 模擬獲取大使資料
    getAmbassadors: function() {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            ambassadors: [
              {
                ambassadorId: 'demo-001',
                ambassadorName: '演示大使',
                totalClicks: Math.floor(Math.random() * 100),
                totalConversions: Math.floor(Math.random() * 20),
                createdAt: new Date().toISOString()
              }
            ],
            stats: {
              totalAmbassadors: 1,
              totalClicks: 42,
              totalConversions: 8
            },
            recentActivity: []
          });
        }, 500);
      });
    },
    
    // 模擬績效追蹤
    trackPerformance: function(data) {
      console.log('追蹤事件:', data);
      return Promise.resolve({ success: true });
    }
  }
};

// 如果是 Node.js 環境（用於 Netlify Functions）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SimpleConfig;
}

// 如果是瀏覽器環境
if (typeof window !== 'undefined') {
  window.SimpleConfig = SimpleConfig;
}