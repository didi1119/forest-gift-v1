// Apps Script 夜間彙整與商業規則映射
// 定時執行：每日凌晨彙總數據，更新 Affiliate Master

const SPREADSHEET_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
const GA4_PROPERTY_ID = ''; // 待設定 GA4 Property ID
const LEVEL_RANKS = {
  LV1_INSIDER: 1,
  LV2_GUIDE: 2,
  LV3_GUARDIAN: 3
};
const LEVEL_TRACKING_COLUMNS = [
  'current_level',
  'level_achieved_at',
  'level_valid_until',
  'current_year_successes',
  'last_level_review_year'
];

function dailyAggregation() {
  try {
    console.log('🔄 開始執行每日彙整...');
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    ensureMasterLevelColumns(ss.getSheetByName('Affiliate Master'));
    
    // 1. 彙總點擊數據
    aggregateClicks(ss);
    
    // 2. 彙總訂房數據
    const bookingAggregation = aggregateBookings(ss, new Date());
    
    // 3. 更新符合資格的轉換數（等於完成入住數）
    updateEligibleConversions(ss);

    // 4. 更新夥伴等級：年初單階降級審核 + 當年即時升級
    updatePartnerLevels(ss, bookingAggregation, new Date());
    
    // 5. 從 GA4 拉取互動數據（分析用，不計獎）
    if (GA4_PROPERTY_ID) {
      fetchGA4InteractionData();
    }
    
    console.log('✅ 每日彙整完成');
    
  } catch (error) {
    console.error('❌ 每日彙整失敗:', error);
    
    // 可以在這裡加入通知管理員的邏輯
    sendErrorNotification('每日彙整失敗', error.toString());
  }
}

function aggregateClicks(ss) {
  try {
    console.log('📊 彙總點擊數據...');
    
    const clicksSheet = ss.getSheetByName('Clicks Log');
    const masterSheet = ss.getSheetByName('Affiliate Master');
    
    if (!clicksSheet || !masterSheet) {
      throw new Error('找不到必要的工作表');
    }
    
    // 取得所有點擊記錄
    const clicksData = clicksSheet.getDataRange().getValues();
    const clicksHeaders = clicksData[0];
    const clicksRows = clicksData.slice(1);
    
    // 取得夥伴主檔資料
    const masterData = masterSheet.getDataRange().getValues();
    const masterHeaders = masterData[0];
    const masterRows = masterData.slice(1);
    
    // 計算每個夥伴的點擊數
    const clickCounts = {};
    
    clicksRows.forEach(row => {
      const partnerCode = row[clicksHeaders.indexOf('partner_code')];
      if (partnerCode) {
        clickCounts[partnerCode] = (clickCounts[partnerCode] || 0) + 1;
      }
    });
    
    // 更新 Affiliate Master 的 clicks_total
    const partnerCodeIndex = masterHeaders.indexOf('partner_code');
    const clicksTotalIndex = masterHeaders.indexOf('clicks_total');
    
    if (partnerCodeIndex === -1 || clicksTotalIndex === -1) {
      throw new Error('Affiliate Master 缺少點擊彙整欄位');
    }
    
    for (let i = 0; i < masterRows.length; i++) {
      const partnerCode = masterRows[i][partnerCodeIndex];
      if (partnerCode) {
        masterSheet
          .getRange(i + 2, clicksTotalIndex + 1)
          .setValue(clickCounts[partnerCode] || 0);
      }
    }
    
    console.log('✅ 點擊數據彙總完成');
    
  } catch (error) {
    console.error('❌ 彙總點擊數據失敗:', error);
    throw error;
  }
}

function aggregateBookings(ss, today) {
  try {
    console.log('📊 彙總訂房數據...');
    
    const bookingsSheet = ss.getSheetByName('Bookings');
    const masterSheet = ss.getSheetByName('Affiliate Master');
    
    if (!bookingsSheet || !masterSheet) {
      throw new Error('找不到必要的工作表');
    }
    
    // 取得所有訂房記錄
    const bookingsData = bookingsSheet.getDataRange().getValues();
    const bookingsHeaders = bookingsData[0];
    const bookingsRows = bookingsData.slice(1);
    
    // 取得夥伴主檔資料
    const masterData = masterSheet.getDataRange().getValues();
    const masterHeaders = masterData[0];
    const masterRows = masterData.slice(1);
    const currentYear = today.getFullYear();
    
    // 計算每個夥伴各狀態的訂房數
    const bookingCounts = {};
    const yearlySuccessCounts = {};
    const statusIndex = bookingsHeaders.indexOf('status');
    const partnerCodeInBookingsIndex = bookingsHeaders.indexOf('partner_code');
    
    if (statusIndex === -1 || partnerCodeInBookingsIndex === -1) {
      throw new Error('Bookings 缺少 partner_code 或 status 欄位');
    }
    
    bookingsRows.forEach(row => {
      const partnerCode = row[partnerCodeInBookingsIndex];
      const status = row[statusIndex];
      
      if (partnerCode && status) {
        if (!bookingCounts[partnerCode]) {
          bookingCounts[partnerCode] = {
            pending: 0,
            paid: 0,
            stayed_completed: 0,
            canceled: 0,
            refunded: 0
          };
        }
        
        if (bookingCounts[partnerCode][status] !== undefined) {
          bookingCounts[partnerCode][status]++;
        }

        if (status === 'stayed_completed') {
          const successYear = extractSuccessYear(row, bookingsHeaders, today);
          if (!yearlySuccessCounts[partnerCode]) {
            yearlySuccessCounts[partnerCode] = {};
          }
          yearlySuccessCounts[partnerCode][successYear] =
            (yearlySuccessCounts[partnerCode][successYear] || 0) + 1;
        }
      }
    });
    
    // 更新 Affiliate Master 的各項數據
    const partnerCodeIndex = masterHeaders.indexOf('partner_code');
    const pendingIndex = masterHeaders.indexOf('bookings_pending');
    const paidIndex = masterHeaders.indexOf('bookings_paid');
    const completedIndex = masterHeaders.indexOf('stays_completed');
    const canceledIndex = masterHeaders.indexOf('bookings_canceled');
    const refundedIndex = masterHeaders.indexOf('bookings_refunded');
    const currentYearSuccessesIndex = masterHeaders.indexOf('current_year_successes');
    
    if (
      partnerCodeIndex === -1 ||
      pendingIndex === -1 ||
      paidIndex === -1 ||
      completedIndex === -1 ||
      canceledIndex === -1 ||
      refundedIndex === -1 ||
      currentYearSuccessesIndex === -1
    ) {
      throw new Error('Affiliate Master 缺少訂房彙整欄位');
    }
    
    for (let i = 0; i < masterRows.length; i++) {
      const partnerCode = masterRows[i][partnerCodeIndex];
      const counts = bookingCounts[partnerCode] || {
        pending: 0,
        paid: 0,
        stayed_completed: 0,
        canceled: 0,
        refunded: 0
      };
      
      if (partnerCode) {
        // 批次更新數據
        const rowNum = i + 2;
        masterSheet.getRange(rowNum, pendingIndex + 1).setValue(counts.pending);
        masterSheet.getRange(rowNum, paidIndex + 1).setValue(counts.paid);
        masterSheet.getRange(rowNum, completedIndex + 1).setValue(counts.stayed_completed);
        masterSheet.getRange(rowNum, canceledIndex + 1).setValue(counts.canceled);
        masterSheet.getRange(rowNum, refundedIndex + 1).setValue(counts.refunded);
        masterSheet
          .getRange(rowNum, currentYearSuccessesIndex + 1)
          .setValue(getYearlySuccessCount(yearlySuccessCounts, partnerCode, currentYear));
      }
    }
    
    console.log('✅ 訂房數據彙總完成');
    return { yearlySuccessCounts };
    
  } catch (error) {
    console.error('❌ 彙總訂房數據失敗:', error);
    throw error;
  }
}

function updateEligibleConversions(ss) {
  try {
    console.log('📊 更新符合資格的轉換數...');
    
    const masterSheet = ss.getSheetByName('Affiliate Master');
    
    if (!masterSheet) {
      throw new Error('找不到 Affiliate Master 工作表');
    }
    
    const masterData = masterSheet.getDataRange().getValues();
    const masterHeaders = masterData[0];
    
    const completedIndex = masterHeaders.indexOf('stays_completed');
    const eligibleIndex = masterHeaders.indexOf('eligible_conversions');
    
    if (completedIndex === -1 || eligibleIndex === -1) {
      throw new Error('找不到必要的欄位');
    }
    
    // 將 eligible_conversions 設為等於 stays_completed
    for (let i = 1; i < masterData.length; i++) {
      const staysCompleted = masterData[i][completedIndex] || 0;
      masterSheet.getRange(i + 1, eligibleIndex + 1).setValue(staysCompleted);
    }
    
    console.log('✅ 符合資格轉換數更新完成');
    
  } catch (error) {
    console.error('❌ 更新符合資格轉換數失敗:', error);
    throw error;
  }
}

function updatePartnerLevels(ss, bookingAggregation, today) {
  try {
    console.log('🏅 更新夥伴等級...');
    
    const masterSheet = ss.getSheetByName('Affiliate Master');
    if (!masterSheet) {
      throw new Error('找不到 Affiliate Master 工作表');
    }
    
    ensureMasterLevelColumns(masterSheet);
    
    const masterData = masterSheet.getDataRange().getValues();
    const headers = masterData[0];
    const rows = masterData.slice(1);
    const indexes = {
      partnerCode: headers.indexOf('partner_code'),
      currentLevel: headers.indexOf('current_level'),
      levelAchievedAt: headers.indexOf('level_achieved_at'),
      levelValidUntil: headers.indexOf('level_valid_until'),
      currentYearSuccesses: headers.indexOf('current_year_successes'),
      lastLevelReviewYear: headers.indexOf('last_level_review_year')
    };
    
    if (Object.values(indexes).some(index => index === -1)) {
      throw new Error('Affiliate Master 缺少等級欄位');
    }
    
    const shouldRunAnnualReview = today.getMonth() === 0;
    const reviewYear = today.getFullYear() - 1;
    
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const partnerCode = row[indexes.partnerCode];
      
      if (!partnerCode) {
        continue;
      }
      
      let currentLevel = normalizeLevel(row[indexes.currentLevel]);
      const lastReviewedYear = parseInt(row[indexes.lastLevelReviewYear], 10) || 0;
      
      if (shouldRunAnnualReview && lastReviewedYear < reviewYear) {
        const reviewSuccesses = getYearlySuccessCount(
          bookingAggregation.yearlySuccessCounts,
          partnerCode,
          reviewYear
        );
        const reviewedLevel = determineReviewLevel(currentLevel, reviewSuccesses);
        
        applyLevelState(masterSheet, rowNum, indexes, reviewedLevel, today, {
          reviewedYear: reviewYear,
          validUntilYear: reviewYear + 1
        });
        currentLevel = reviewedLevel;
      } else if (!row[indexes.currentLevel]) {
        applyLevelState(masterSheet, rowNum, indexes, currentLevel, today, {});
      }
      
      const currentYearSuccesses = parseInt(row[indexes.currentYearSuccesses], 10) || 0;
      const upgradedLevel = determineImmediateLevel(currentYearSuccesses);
      
      if (LEVEL_RANKS[upgradedLevel] > LEVEL_RANKS[currentLevel]) {
        applyLevelState(masterSheet, rowNum, indexes, upgradedLevel, today, {
          validUntilYear: today.getFullYear() + 1
        });
      }
    }
    
    console.log('✅ 夥伴等級更新完成');
    
  } catch (error) {
    console.error('❌ 更新夥伴等級失敗:', error);
    throw error;
  }
}

function ensureMasterLevelColumns(masterSheet) {
  if (!masterSheet) {
    return;
  }
  
  const lastColumn = Math.max(masterSheet.getLastColumn(), 1);
  const headers = masterSheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const missingColumns = LEVEL_TRACKING_COLUMNS.filter(header => headers.indexOf(header) === -1);
  
  if (!missingColumns.length) {
    return;
  }
  
  masterSheet.insertColumnsAfter(lastColumn, missingColumns.length);
  masterSheet
    .getRange(1, lastColumn + 1, 1, missingColumns.length)
    .setValues([missingColumns]);
  
  console.log(`🧱 已補齊等級欄位: ${missingColumns.join(', ')}`);
}

function determineImmediateLevel(successCount) {
  if (successCount >= 10) {
    return 'LV3_GUARDIAN';
  }
  if (successCount >= 4) {
    return 'LV2_GUIDE';
  }
  return 'LV1_INSIDER';
}

function determineReviewLevel(currentLevel, successCount) {
  if (successCount >= 10) {
    return 'LV3_GUARDIAN';
  }
  
  if (currentLevel === 'LV3_GUARDIAN') {
    return successCount >= 6 ? 'LV3_GUARDIAN' : 'LV2_GUIDE';
  }
  
  if (currentLevel === 'LV2_GUIDE') {
    return successCount >= 3 ? 'LV2_GUIDE' : 'LV1_INSIDER';
  }
  
  return successCount >= 4 ? 'LV2_GUIDE' : 'LV1_INSIDER';
}

function applyLevelState(masterSheet, rowNum, indexes, level, effectiveDate, options) {
  const reviewedYear = options && options.reviewedYear;
  const validUntilYear = options && options.validUntilYear;
  const grantedAt = effectiveDate.toISOString();
  const validUntil =
    level === 'LV1_INSIDER' || !validUntilYear ? '' : getYearEndDate(validUntilYear);
  
  masterSheet.getRange(rowNum, indexes.currentLevel + 1).setValue(level);
  masterSheet.getRange(rowNum, indexes.levelAchievedAt + 1).setValue(grantedAt);
  masterSheet.getRange(rowNum, indexes.levelValidUntil + 1).setValue(validUntil);
  
  if (reviewedYear !== '' && reviewedYear !== null && reviewedYear !== undefined) {
    masterSheet.getRange(rowNum, indexes.lastLevelReviewYear + 1).setValue(reviewedYear);
  }
}

function normalizeLevel(level) {
  return LEVEL_RANKS[level] ? level : 'LV1_INSIDER';
}

function getYearEndDate(year) {
  return `${year}-12-31`;
}

function getYearlySuccessCount(yearlySuccessCounts, partnerCode, year) {
  if (!yearlySuccessCounts[partnerCode]) {
    return 0;
  }
  return yearlySuccessCounts[partnerCode][year] || 0;
}

function extractSuccessYear(row, headers, today) {
  const candidateFields = ['verified_at', 'checkout_date', 'checkin_date'];
  
  for (let i = 0; i < candidateFields.length; i++) {
    const fieldName = candidateFields[i];
    const fieldIndex = headers.indexOf(fieldName);
    
    if (fieldIndex === -1) {
      continue;
    }
    
    const parsedDate = parseSheetDate(row[fieldIndex]);
    if (parsedDate) {
      return parsedDate.getFullYear();
    }
  }
  
  return today.getFullYear();
}

function parseSheetDate(value) {
  if (!value) {
    return null;
  }
  
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value;
  }
  
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function runAnnualLevelReviewForPreviousYear() {
  const today = new Date();
  const reviewDate = new Date(today.getFullYear(), 0, 1, 2, 0, 0);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureMasterLevelColumns(ss.getSheetByName('Affiliate Master'));
  const bookingAggregation = aggregateBookings(ss, reviewDate);
  updatePartnerLevels(ss, bookingAggregation, reviewDate);
}

function fetchGA4InteractionData() {
  try {
    console.log('📊 從 GA4 拉取互動數據...');
    
    // 這裡實作 GA4 Data API 的呼叫
    // 注意：僅用於分析，不用於計獎
    
    if (!GA4_PROPERTY_ID) {
      console.log('⚠️ GA4_PROPERTY_ID 未設定，跳過 GA4 數據拉取');
      return;
    }
    
    // GA4 API 需要額外的權限和設定
    // 這是一個示例結構，實際實作需要 GA4 Data API
    
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 過去 7 天
    
    console.log(`📅 拉取 ${startDate.toISOString().split('T')[0]} 到 ${endDate.toISOString().split('T')[0]} 的數據`);
    
    // 這裡會實作實際的 GA4 API 呼叫
    // 拉取事件：card_draw, playlist_play, journal_submit, line_click, booking_intent
    
    console.log('✅ GA4 互動數據拉取完成（僅供分析）');
    
  } catch (error) {
    console.error('❌ GA4 數據拉取失敗:', error);
    // GA4 失敗不影響主要流程
  }
}

function sendErrorNotification(subject, message) {
  try {
    // 發送錯誤通知給管理員
    // 可以使用 Gmail API 或其他通知方式
    
    const adminEmail = 'admin@example.com'; // 待設定管理員信箱
    
    MailApp.sendEmail({
      to: adminEmail,
      subject: `[靜謐森林] ${subject}`,
      body: `系統自動通知：\n\n錯誤時間：${new Date().toLocaleString('zh-TW')}\n錯誤訊息：${message}\n\n請檢查系統狀態。`
    });
    
  } catch (error) {
    console.error('❌ 發送錯誤通知失敗:', error);
  }
}

// 設定定時觸發器（需要手動執行一次來建立）
function setupDailyTrigger() {
  try {
    // 刪除現有的觸發器
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'dailyAggregation') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // 建立新的每日觸發器（凌晨 2 點執行）
    ScriptApp.newTrigger('dailyAggregation')
      .timeBased()
      .everyDays(1)
      .atHour(2)
      .create();
      
    console.log('✅ 每日觸發器設定完成');
    
  } catch (error) {
    console.error('❌ 設定觸發器失敗:', error);
  }
}

// 手動執行彙整（用於測試）
function manualAggregation() {
  console.log('🔧 手動執行彙整...');
  dailyAggregation();
}
