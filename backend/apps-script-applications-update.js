// Apps Script 大使申請管理系統更新
// 將以下代碼添加到現有的 Apps Script 中

// 新增：處理大使申請提交
function handleApplicationSubmission(data, e) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Applicants');
    
    if (!sheet) {
      Logger.log('錯誤: 找不到 Applicants 工作表');
      return createJsonResponse({
        success: false,
        error: '找不到 Applicants 工作表'
      });
    }
    
    const timestamp = new Date();
    const applicationData = [
      '', // ID (自動編號)
      data.name || '',
      data.email || '',
      data.line_name || '',
      data.phone || '',
      data.message || '',
      'PENDING', // application_status
      '', // review_notes
      '', // reviewed_by
      '', // partner_code_assigned
      false, // partner_link_sent
      timestamp, // created_at
      '', // reviewed_at
      '' // approved_at
    ];
    
    Logger.log('準備插入申請資料到 Applicants 工作表');
    sheet.appendRow(applicationData);
    Logger.log('申請資料插入成功');
    
    const result = {
      success: true,
      message: '申請已成功提交',
      applicant_name: data.name,
      applicant_email: data.email,
      application_id: getLastRowId(sheet),
      timestamp: timestamp.toISOString()
    };
    
    Logger.log('回傳結果: ' + JSON.stringify(result));
    
    // 如果是表單提交，返回 HTML 頁面
    if (e.parameter && Object.keys(e.parameter).length > 0) {
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>申請提交成功</title>
        </head>
        <body>
          <h1>✅ 申請已成功提交！</h1>
          <p>申請人：${data.name}</p>
          <p>Email：${data.email}</p>
          <p>我們將在 1-2 個工作天內審核您的申請。</p>
        </body>
        </html>
      `);
    } else {
      return createJsonResponse(result);
    }
    
  } catch (sheetError) {
    Logger.log('Google Sheets 錯誤: ' + sheetError.toString());
    return createJsonResponse({
      success: false,
      error: 'Google Sheets 操作失敗: ' + sheetError.message
    });
  }
}

// 新增：處理申請審核
function handleApplicationReview(data, e) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const applicantsSheet = spreadsheet.getSheetByName('Applicants');
    
    if (!applicantsSheet) {
      return createJsonResponse({
        success: false,
        error: '找不到 Applicants 工作表'
      });
    }
    
    const applicationId = parseInt(data.application_id);
    const newStatus = data.status; // APPROVED 或 REJECTED
    const reviewNotes = data.review_notes || '';
    const reviewedBy = data.reviewed_by || 'admin';
    const timestamp = new Date();
    
    // 找到對應的申請記錄
    const range = applicantsSheet.getDataRange();
    const values = range.getValues();
    let applicationRowIndex = -1;
    let applicationData = null;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === applicationId) { // 假設ID在第一列
        applicationRowIndex = i + 1; // Google Sheets 行數從1開始
        applicationData = values[i];
        break;
      }
    }
    
    if (applicationRowIndex === -1) {
      return createJsonResponse({
        success: false,
        error: '找不到指定的申請記錄'
      });
    }
    
    // 更新申請狀態
    applicantsSheet.getRange(applicationRowIndex, 7).setValue(newStatus); // application_status
    applicantsSheet.getRange(applicationRowIndex, 8).setValue(reviewNotes); // review_notes
    applicantsSheet.getRange(applicationRowIndex, 9).setValue(reviewedBy); // reviewed_by
    applicantsSheet.getRange(applicationRowIndex, 13).setValue(timestamp); // reviewed_at
    
    if (newStatus === 'APPROVED') {
      applicantsSheet.getRange(applicationRowIndex, 14).setValue(timestamp); // approved_at
    }
    
    const result = {
      success: true,
      message: `申請已${newStatus === 'APPROVED' ? '核准' : '拒絕'}`,
      application_id: applicationId,
      status: newStatus,
      applicant_name: applicationData[1], // name
      applicant_email: applicationData[2], // email
      timestamp: timestamp.toISOString()
    };
    
    Logger.log('申請審核完成: ' + JSON.stringify(result));
    
    return createJsonResponse(result);
    
  } catch (error) {
    Logger.log('申請審核錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '申請審核失敗: ' + error.message
    });
  }
}

// 新增：獲取申請列表
function handleGetApplications(data, e) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Applicants');
    
    if (!sheet) {
      return createJsonResponse({
        success: false,
        error: '找不到 Applicants 工作表'
      });
    }
    
    const applications = getSheetData(spreadsheet, 'Applicants');
    const statusFilter = data.status_filter || 'ALL';
    
    // 根據狀態篩選
    let filteredApplications = applications;
    if (statusFilter !== 'ALL') {
      filteredApplications = applications.filter(app => app.application_status === statusFilter);
    }
    
    // 按申請時間排序（最新的在前）
    filteredApplications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    const result = {
      success: true,
      data: filteredApplications,
      total_count: applications.length,
      filtered_count: filteredApplications.length,
      status_filter: statusFilter,
      timestamp: new Date().toISOString()
    };
    
    return createJsonResponse(result);
    
  } catch (error) {
    Logger.log('獲取申請列表錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '獲取申請列表失敗: ' + error.message
    });
  }
}

// 新增：將核准的申請者轉為正式夥伴
function handlePromoteToPartner(data, e) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEETS_ID);
    const applicantsSheet = spreadsheet.getSheetByName('Applicants');
    const partnersSheet = spreadsheet.getSheetByName('Partners');
    
    if (!applicantsSheet || !partnersSheet) {
      return createJsonResponse({
        success: false,
        error: '找不到必要的工作表'
      });
    }
    
    const applicationId = parseInt(data.application_id);
    const partnerCode = data.partner_code;
    const couponUrl = data.coupon_url || '';
    
    // 找到申請記錄
    const applicantsRange = applicantsSheet.getDataRange();
    const applicantsValues = applicantsRange.getValues();
    let applicationRowIndex = -1;
    let applicationData = null;
    
    for (let i = 1; i < applicantsValues.length; i++) {
      if (applicantsValues[i][0] === applicationId) {
        applicationRowIndex = i + 1;
        applicationData = applicantsValues[i];
        break;
      }
    }
    
    if (applicationRowIndex === -1) {
      return createJsonResponse({
        success: false,
        error: '找不到指定的申請記錄'
      });
    }
    
    // 檢查申請狀態是否已核准
    if (applicationData[6] !== 'APPROVED') { // application_status
      return createJsonResponse({
        success: false,
        error: '只有已核准的申請才能轉為正式夥伴'
      });
    }
    
    const timestamp = new Date();
    
    // 生成追蹤連結
    const landingUrl = `${APPS_SCRIPT_URL}?pid=${encodeURIComponent(partnerCode)}&dest=landing`;
    const trackedCouponUrl = couponUrl ? `${APPS_SCRIPT_URL}?pid=${encodeURIComponent(partnerCode)}&dest=coupon&target=${encodeURIComponent(couponUrl)}` : '';
    
    // 創建 Partners 記錄
    const partnerData = [
      '', // ID (自動編號)
      partnerCode, // partner_code
      applicationData[1], // name
      applicationData[2], // email
      applicationData[4], // phone
      'LV1_INSIDER', // level
      0, // level_progress
      0, // total_successful_referrals
      'CASH', // commission_preference
      0, // total_commission_earned
      0, // total_commission_paid
      0, // pending_commission
      '', // bank_name
      '', // bank_branch
      '', // account_holder
      '', // account_number
      false, // first_referral_bonus_claimed
      'active', // status
      landingUrl, // landing_link
      trackedCouponUrl, // coupon_link
      '', // coupon_code
      couponUrl, // coupon_url
      `從申請轉入 - 申請ID: ${applicationId}`, // notes
      timestamp, // created_at
      timestamp // updated_at
    ];
    
    // 插入到 Partners 表
    partnersSheet.appendRow(partnerData);
    
    // 更新 Applicants 表的分配資訊
    applicantsSheet.getRange(applicationRowIndex, 10).setValue(partnerCode); // partner_code_assigned
    applicantsSheet.getRange(applicationRowIndex, 11).setValue(true); // partner_link_sent
    
    const result = {
      success: true,
      message: '申請者已成功轉為正式夥伴',
      application_id: applicationId,
      partner_code: partnerCode,
      applicant_name: applicationData[1],
      landing_link: landingUrl,
      coupon_link: trackedCouponUrl,
      timestamp: timestamp.toISOString()
    };
    
    Logger.log('申請者轉為夥伴完成: ' + JSON.stringify(result));
    
    return createJsonResponse(result);
    
  } catch (error) {
    Logger.log('轉為夥伴錯誤: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '轉為夥伴失敗: ' + error.message
    });
  }
}

// 輔助函數：獲取最後一行的ID
function getLastRowId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1; // 只有標題行
  
  const idCell = sheet.getRange(lastRow, 1);
  return idCell.getValue() || lastRow - 1;
}

// 更新 doPost 函數，添加新的動作處理
// 在現有的 doPost 函數的 switch 語句中添加以下 case：

/*
在現有的 switch (data.action) 中添加：

case 'submit_application':
  return handleApplicationSubmission(data, e);

case 'review_application':
  return handleApplicationReview(data, e);

case 'get_applications':
  return handleGetApplications(data, e);

case 'promote_to_partner':
  return handlePromoteToPartner(data, e);
*/

// 測試函數
function testApplicationSystem() {
  Logger.log('=== 測試大使申請系統 ===');
  
  // 測試提交申請
  const testApplication = {
    action: 'submit_application',
    name: '測試申請者',
    email: 'test@example.com',
    line_name: '測試LINE',
    phone: '0912345678',
    message: '我很想成為知音大使！'
  };
  
  try {
    const result = handleApplicationSubmission(testApplication, { parameter: testApplication });
    Logger.log('測試申請提交結果: ' + result.getContent());
  } catch (error) {
    Logger.log('測試申請提交失敗: ' + error.toString());
  }
  
  // 測試獲取申請列表
  try {
    const listResult = handleGetApplications({ status_filter: 'PENDING' }, {});
    Logger.log('測試申請列表結果: ' + listResult.getContent());
  } catch (error) {
    Logger.log('測試申請列表失敗: ' + error.toString());
  }
}