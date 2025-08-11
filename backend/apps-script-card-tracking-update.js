// Apps Script 卡片使用追蹤更新 - 添加到現有的 Apps Script 中

// 更新後的 recordClick 函數（替換原有的 recordClick 函數）
function recordClick(params) {
  try {
    const sheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Clicks');
    if (!sheet) {
      Logger.log('Clicks 工作表不存在');
      return;
    }
    
    const timestamp = new Date();
    const partnerCode = params.pid || params.subid || 'UNKNOWN';
    const destination = params.dest || 'landing';
    const targetUrl = params.target || '';
    
    // 🆕 處理卡片使用追蹤
    let giftCardSelected = '';
    if (params.dest === 'card_usage' && params.card) {
      giftCardSelected = params.card;
      Logger.log(`卡片使用追蹤: ${partnerCode} 選擇了 ${giftCardSelected}`);
    }
    
    const clickData = [
      '', // ID (自動編號)
      partnerCode, 
      timestamp, 
      '', // ip_address
      '', // user_agent
      params.referrer || '', 
      destination,
      params.utm_source || '', 
      params.utm_medium || '', 
      params.utm_campaign || '',
      Utilities.getUuid(), // session_id
      '', // country
      '', // city
      '', // device
      'pending', // status
      timestamp, // created_at
      giftCardSelected // 🆕 gift_card_selected
    ];
    
    sheet.appendRow(clickData);
    Logger.log('Clicks 記錄成功: ' + partnerCode + (giftCardSelected ? ` (卡片: ${giftCardSelected})` : ''));
  } catch (error) {
    Logger.log('recordClick 錯誤: ' + error.toString());
  }
}

// 新增：獲取卡片使用統計的函數
function getCardUsageStatistics(partnerCode = null, timeRange = 30) {
  try {
    const sheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Clicks');
    if (!sheet) {
      Logger.log('Clicks 工作表不存在');
      return null;
    }
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    
    // 找到相關欄位的索引
    const partnerCodeIndex = headers.indexOf('partner_code');
    const timestampIndex = headers.indexOf('timestamp');
    const giftCardIndex = headers.indexOf('gift_card_selected');
    const destinationIndex = headers.indexOf('destination');
    
    if (partnerCodeIndex === -1 || giftCardIndex === -1) {
      Logger.log('找不到必要的欄位');
      return null;
    }
    
    // 計算時間範圍
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);
    
    // 統計卡片使用情況
    const cardStats = {};
    const partnerStats = {};
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowPartnerCode = row[partnerCodeIndex];
      const rowTimestamp = new Date(row[timestampIndex]);
      const rowGiftCard = row[giftCardIndex];
      const rowDestination = row[destinationIndex];
      
      // 只處理卡片使用記錄且在時間範圍內的
      if (rowDestination === 'card_usage' && 
          rowGiftCard && 
          rowTimestamp >= cutoffDate &&
          (!partnerCode || rowPartnerCode === partnerCode)) {
        
        // 統計卡片使用次數
        if (!cardStats[rowGiftCard]) {
          cardStats[rowGiftCard] = 0;
        }
        cardStats[rowGiftCard]++;
        
        // 統計各大使的卡片使用情況
        if (!partnerStats[rowPartnerCode]) {
          partnerStats[rowPartnerCode] = {};
        }
        if (!partnerStats[rowPartnerCode][rowGiftCard]) {
          partnerStats[rowPartnerCode][rowGiftCard] = 0;
        }
        partnerStats[rowPartnerCode][rowGiftCard]++;
      }
    }
    
    // 排序卡片統計
    const sortedCardStats = Object.entries(cardStats)
      .map(([card, count]) => ({ card, count }))
      .sort((a, b) => b.count - a.count);
    
    const result = {
      timeRange: timeRange,
      totalCardInteractions: Object.values(cardStats).reduce((sum, count) => sum + count, 0),
      cardStatistics: sortedCardStats,
      partnerStatistics: partnerStats,
      generatedAt: new Date().toISOString()
    };
    
    Logger.log('卡片使用統計生成完成: ' + JSON.stringify(result));
    return result;
    
  } catch (error) {
    Logger.log('獲取卡片使用統計錯誤: ' + error.toString());
    return null;
  }
}

// 新增：生成卡片使用報表
function generateCardUsageReport() {
  try {
    const stats = getCardUsageStatistics();
    if (!stats) {
      return '無法生成卡片使用報表';
    }
    
    let report = `=== 神諭卡片使用報表 ===\n`;
    report += `報表生成時間: ${new Date(stats.generatedAt).toLocaleString('zh-TW')}\n`;
    report += `統計期間: 最近 ${stats.timeRange} 天\n`;
    report += `總互動次數: ${stats.totalCardInteractions}\n\n`;
    
    report += `=== 熱門卡片排行 ===\n`;
    stats.cardStatistics.slice(0, 10).forEach((item, index) => {
      report += `${index + 1}. ${item.card}: ${item.count} 次\n`;
    });
    
    report += `\n=== 各大使使用情況 ===\n`;
    Object.entries(stats.partnerStatistics).forEach(([partner, cards]) => {
      const totalUse = Object.values(cards).reduce((sum, count) => sum + count, 0);
      report += `${partner}: 總共 ${totalUse} 次\n`;
      
      // 顯示該大使最常用的前3張卡片
      const topCards = Object.entries(cards)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
      
      topCards.forEach(([card, count]) => {
        report += `  - ${card}: ${count} 次\n`;
      });
    });
    
    Logger.log('卡片使用報表生成完成');
    return report;
    
  } catch (error) {
    Logger.log('生成卡片使用報表錯誤: ' + error.toString());
    return '生成報表時發生錯誤: ' + error.toString();
  }
}

// 新增：清理舊的卡片使用記錄
function cleanupOldCardRecords(daysToKeep = 90) {
  try {
    const sheet = SpreadsheetApp.openById(SHEETS_ID).getSheetByName('Clicks');
    if (!sheet) {
      Logger.log('Clicks 工作表不存在');
      return false;
    }
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    
    const timestampIndex = headers.indexOf('timestamp');
    const destinationIndex = headers.indexOf('destination');
    
    if (timestampIndex === -1) {
      Logger.log('找不到timestamp欄位');
      return false;
    }
    
    // 計算截止日期
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    // 找出需要刪除的行
    const rowsToDelete = [];
    for (let i = values.length - 1; i >= 1; i--) { // 從後往前遍歷
      const row = values[i];
      const rowTimestamp = new Date(row[timestampIndex]);
      const rowDestination = row[destinationIndex];
      
      // 只刪除超過保留期限的卡片使用記錄
      if (rowDestination === 'card_usage' && rowTimestamp < cutoffDate) {
        rowsToDelete.push(i + 1); // Google Sheets 行號從1開始
      }
    }
    
    // 刪除舊記錄
    let deletedCount = 0;
    rowsToDelete.forEach(rowNumber => {
      sheet.deleteRow(rowNumber - deletedCount); // 調整行號
      deletedCount++;
    });
    
    Logger.log(`清理完成，刪除了 ${deletedCount} 條舊的卡片使用記錄`);
    return true;
    
  } catch (error) {
    Logger.log('清理舊卡片記錄錯誤: ' + error.toString());
    return false;
  }
}

// 新增：處理卡片統計請求
function handleGetCardStatistics(data, e) {
  try {
    const partnerCode = data.partner_code || null;
    const timeRange = parseInt(data.time_range) || 30;
    
    const stats = getCardUsageStatistics(partnerCode, timeRange);
    
    if (stats) {
      return createJsonResponse({
        success: true,
        data: stats
      });
    } else {
      return createJsonResponse({
        success: false,
        error: '無法獲取卡片使用統計'
      });
    }
    
  } catch (error) {
    Logger.log('處理卡片統計請求錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '處理請求時發生錯誤: ' + error.message
    });
  }
}

// 更新 doPost 函數以處理新的動作（在現有的 switch 語句中添加）
// 在現有的 doPost 函數的 switch 語句中添加以下 case：
/*
case 'get_card_statistics':
  return handleGetCardStatistics(data, e);
*/

// 測試函數
function testCardTracking() {
  Logger.log('=== 測試卡片追蹤系統 ===');
  
  // 測試記錄卡片使用
  const testParams = {
    pid: 'TEST001',
    dest: 'card_usage',
    card: '長日',
    timestamp: Date.now().toString()
  };
  
  recordClick(testParams);
  
  // 測試獲取統計
  const stats = getCardUsageStatistics('TEST001', 7);
  Logger.log('測試統計結果: ' + JSON.stringify(stats));
  
  // 測試生成報表
  const report = generateCardUsageReport();
  Logger.log('測試報表:\n' + report);
}