// 在index.html中添加的神諭卡片使用追蹤代碼
// 將此代碼添加到index.html的現有JavaScript中

// 在全域變數區域添加：
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxWVmkMJUladdBVp56vcISxqCfebXaytT4_SX970OaD7Aq8wg74Kcf_9OxyNEaPA_4W/exec';

// 獲取當前的subid（推薦大使代碼）
function getSubid() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('subid') || 'no-subid';
}

// 追蹤神諭卡片使用情況
function trackCardUsage(cardName) {
    try {
        const subid = getSubid();
        
        // 記錄到控制台（用於調試）
        console.log(`卡片使用追蹤: ${cardName} (大使: ${subid})`);
        
        // 發送追蹤數據到Apps Script
        const trackingUrl = `${APPS_SCRIPT_URL}?pid=${encodeURIComponent(subid)}&dest=card_usage&card=${encodeURIComponent(cardName)}&timestamp=${Date.now()}`;
        
        // 使用Image對象發送請求（避免CORS問題）
        const img = new Image();
        img.src = trackingUrl;
        
        // 也可以存儲到本地存儲，用於離線時的備用追蹤
        storeCardUsageLocally(cardName, subid);
        
    } catch (error) {
        console.error('卡片使用追蹤失敗:', error);
    }
}

// 將卡片使用記錄存儲到本地存儲
function storeCardUsageLocally(cardName, subid) {
    try {
        const usageRecord = {
            cardName: cardName,
            subid: subid,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        // 獲取現有的記錄
        let cardUsageHistory = JSON.parse(localStorage.getItem('cardUsageHistory') || '[]');
        
        // 添加新記錄
        cardUsageHistory.push(usageRecord);
        
        // 保持最近100次記錄
        if (cardUsageHistory.length > 100) {
            cardUsageHistory = cardUsageHistory.slice(-100);
        }
        
        // 存儲回本地
        localStorage.setItem('cardUsageHistory', JSON.stringify(cardUsageHistory));
        
    } catch (error) {
        console.error('本地存儲卡片使用記錄失敗:', error);
    }
}

// 更新後的drawCard函數（替換原有的drawCard函數）
function drawCard() {
    let availableCards = cardData.filter((_, index) => !drawnIndices.has(index));
    if (availableCards.length === 0) {
        drawnIndices.clear();
        availableCards = cardData;
    }
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    const card = availableCards[randomIndex];
    const originalIndex = cardData.indexOf(card);
    drawnIndices.add(originalIndex);
    
    // 🆕 追蹤卡片使用
    trackCardUsage(card.name);
    
    return card;
}

// 獲取卡片使用統計（可選功能）
function getCardUsageStats() {
    try {
        const cardUsageHistory = JSON.parse(localStorage.getItem('cardUsageHistory') || '[]');
        
        // 統計各卡片的使用次數
        const cardCounts = {};
        cardUsageHistory.forEach(record => {
            cardCounts[record.cardName] = (cardCounts[record.cardName] || 0) + 1;
        });
        
        // 排序並返回統計結果
        const sortedStats = Object.entries(cardCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        
        console.log('本地卡片使用統計:', sortedStats);
        return sortedStats;
        
    } catch (error) {
        console.error('獲取卡片使用統計失敗:', error);
        return [];
    }
}

// 顯示用戶的卡片使用歷史（可選功能）
function showUserCardHistory() {
    const stats = getCardUsageStats();
    if (stats.length > 0) {
        console.log('您最常抽到的卡片：', stats.slice(0, 5));
    }
}

// 清理舊的卡片使用記錄（可選功能）
function cleanupOldCardRecords() {
    try {
        const cardUsageHistory = JSON.parse(localStorage.getItem('cardUsageHistory') || '[]');
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentRecords = cardUsageHistory.filter(record => 
            new Date(record.timestamp) > thirtyDaysAgo
        );
        
        localStorage.setItem('cardUsageHistory', JSON.stringify(recentRecords));
        console.log(`清理完成，保留 ${recentRecords.length} 條最近記錄`);
        
    } catch (error) {
        console.error('清理舊記錄失敗:', error);
    }
}

// 在頁面載入時執行初始化
document.addEventListener('DOMContentLoaded', function() {
    // 清理超過30天的舊記錄
    cleanupOldCardRecords();
    
    // 顯示歡迎信息（如果有推薦大使）
    const subid = getSubid();
    if (subid && subid !== 'no-subid') {
        console.log(`歡迎來到靜謐森林！推薦大使：${subid}`);
    }
});

// 導出函數供測試使用（可選）
window.cardTracking = {
    trackCardUsage,
    getCardUsageStats,
    showUserCardHistory,
    cleanupOldCardRecords
};