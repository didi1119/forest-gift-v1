// ===== Google Apps Script 主程式 - 重構版 =====
// 整合新架構的數據訪問層和服務層

// 系統配置
const SHEETS_ID = '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4';
const GITHUB_PAGES_URL = 'https://didi1119.github.io/forest-gift-v1/index.html';
const DEFAULT_LINE_COUPON_URL = 'https://lin.ee/q38pqot';

// 佣金配置（從 data-models.js 引入）
const CommissionRules = {
  rates: {
    'LV1_INSIDER': { accommodation: 1000, cash: 500 },
    'LV2_GUIDE': { accommodation: 1200, cash: 600 },
    'LV3_GUARDIAN': { accommodation: 1500, cash: 800 }
  },
  firstReferralBonus: 1500,
  levelRequirements: {
    'LV2_GUIDE': 4,
    'LV3_GUARDIAN': 10
  }
};

// ===== 主要入口點 =====

/**
 * 處理 GET 請求
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action;
    
    // API 請求
    if (action) {
      return handleApiGet(action, params);
    }
    
    // 追蹤連結點擊
    if (params.pid || params.subid) {
      recordClickAndRedirect(e);
    }
    
    // 預設跳轉
    return createRedirectPage(e);
    
  } catch (error) {
    Logger.log('GET request error: ' + error.toString());
    return createErrorResponse(error);
  }
}

/**
 * 處理 POST 請求
 */
function doPost(e) {
  try {
    const data = parsePostData(e);
    const action = data.action;
    
    if (!action) {
      throw new Error('Action is required');
    }
    
    // 初始化服務
    const bookingService = new BookingService();
    const payoutService = new PayoutService();
    
    // 根據 action 路由請求
    switch (action) {
      // 訂房相關
      case 'create_booking':
        return handleCreateBooking(data, bookingService);
        
      case 'update_booking':
        return handleUpdateBooking(data, bookingService);
        
      case 'delete_booking':
        return handleDeleteBooking(data, bookingService);
        
      case 'confirm_checkin_completion':
        return handleConfirmCheckin(data, bookingService);
        
      // 結算相關
      case 'create_payout':
        return handleCreatePayout(data, payoutService);
        
      case 'update_payout':
        return handleUpdatePayout(data);
        
      case 'cancel_payout':
        return handleCancelPayout(data);
        
      // 大使相關
      case 'update_partner_commission':
        return handleUpdatePartnerCommission(data);
        
      case 'use_accommodation_points':
        return handleUseAccommodationPoints(data, bookingService);
        
      case 'convert_points_to_cash':
        return handleConvertPointsToCash(data);
        
      // 數據查詢
      case 'get_all_data':
        return handleGetAllData();
        
      default:
        throw new Error('Unknown action: ' + action);
    }
    
  } catch (error) {
    Logger.log('POST request error: ' + error.toString());
    return createErrorResponse(error);
  }
}

// ===== 請求處理函數 =====

/**
 * 處理創建訂房
 */
function handleCreateBooking(data, bookingService) {
  try {
    const booking = bookingService.createBooking(data);
    
    return createJsonResponse({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });
    
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * 處理更新訂房
 */
function handleUpdateBooking(data, bookingService) {
  try {
    const bookingDAO = new BookingDAO();
    const bookingId = data.booking_id || data.id;
    
    if (!bookingId) {
      throw new ValidationError('Booking ID is required');
    }
    
    // 查找現有訂房
    const existing = bookingDAO.findById(bookingId);
    if (!existing) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }
    
    // 如果是 SELF_USE 訂房，需要特殊處理
    if (existing.booking_source === 'SELF_USE') {
      return handleUpdateSelfUseBooking(bookingId, data, existing);
    }
    
    // 一般訂房更新
    const updated = bookingDAO.update(bookingId, data);
    
    return createJsonResponse({
      success: true,
      message: 'Booking updated successfully',
      data: updated
    });
    
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * 處理刪除訂房
 */
function handleDeleteBooking(data, bookingService) {
  try {
    const bookingId = data.booking_id || data.id;
    
    if (!bookingId) {
      throw new ValidationError('Booking ID is required');
    }
    
    const result = bookingService.cancelBooking(bookingId, data.reason || 'User cancelled');
    
    return createJsonResponse({
      success: true,
      message: 'Booking cancelled successfully',
      data: result
    });
    
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * 處理確認入住
 */
function handleConfirmCheckin(data, bookingService) {
  try {
    // 嘗試通過 ID 或房客資訊查找訂房
    let booking = null;
    const bookingDAO = new BookingDAO();
    
    if (data.booking_id) {
      booking = bookingDAO.findById(data.booking_id);
    }
    
    if (!booking && data.guest_name && data.guest_phone) {
      const bookings = bookingDAO.findByGuestInfo(
        data.guest_name,
        data.guest_phone,
        data.checkin_date
      );
      
      if (bookings.length > 0) {
        booking = bookings[0];
      }
    }
    
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    
    const result = bookingService.confirmCheckinCompletion(
      booking.id,
      data.confirmed_by || 'system'
    );
    
    return createJsonResponse({
      success: true,
      message: 'Check-in confirmed successfully',
      data: result
    });
    
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * 處理使用住宿金
 */
function handleUseAccommodationPoints(data, bookingService) {
  try {
    const partnerCode = data.partner_code;
    const deductAmount = parseFloat(data.deduct_amount || 0);
    
    if (!partnerCode) {
      throw new ValidationError('Partner code is required');
    }
    
    if (deductAmount <= 0) {
      throw new ValidationError('Deduct amount must be greater than 0');
    }
    
    // 準備訂房數據
    const bookingData = {
      guest_name: data.guest_name || partnerCode,
      guest_phone: data.guest_phone || '',
      guest_email: data.guest_email || '',
      checkin_date: data.checkin_date || data.usage_date || new Date(),
      checkout_date: data.checkout_date || data.checkin_date || new Date(),
      room_price: parseFloat(data.room_price || deductAmount),
      notes: data.notes || ''
    };
    
    const result = bookingService.useAccommodationPoints(
      partnerCode,
      deductAmount,
      bookingData
    );
    
    return createJsonResponse({
      success: true,
      message: 'Accommodation points used successfully',
      data: result
    });
    
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * 處理創建結算
 */
function handleCreatePayout(data, payoutService) {
  try {
    const partnerCode = data.partner_code;
    const cashAmount = parseFloat(data.cash_amount || 0);
    const accommodationAmount = parseFloat(data.accommodation_amount || data.amount || 0);
    
    if (!partnerCode) {
      throw new ValidationError('Partner code is required');
    }
    
    // 如果只有一種類型的金額
    if (data.payout_type === 'CASH') {
      accommodationAmount = 0;
    } else if (data.payout_type === 'ACCOMMODATION') {
      cashAmount = 0;
    }
    
    const result = payoutService.createMixedPayout(
      partnerCode,
      cashAmount,
      accommodationAmount,
      data.booking_ids ? data.booking_ids.split(',') : [],
      data.notes || ''
    );
    
    return createJsonResponse({
      success: true,
      message: 'Payout created successfully',
      data: result
    });
    
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * 處理獲取所有數據
 */
function handleGetAllData() {
  try {
    const bookingDAO = new BookingDAO();
    const partnerDAO = new PartnerDAO();
    const payoutDAO = new PayoutDAO();
    const accommodationUsageDAO = new AccommodationUsageDAO();
    
    const data = {
      bookings: bookingDAO.findAll(),
      partners: partnerDAO.findAll(),
      payouts: payoutDAO.findAll(),
      accommodation_usage: accommodationUsageDAO.findAll()
    };
    
    return createJsonResponse({
      success: true,
      data: data
    });
    
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * 處理 API GET 請求
 */
function handleApiGet(action, params) {
  switch (action) {
    case 'get_all_data':
      return handleGetAllData();
      
    case 'get_partner':
      if (!params.partner_code) {
        throw new ValidationError('Partner code is required');
      }
      const partnerDAO = new PartnerDAO();
      const partner = partnerDAO.findByPartnerCode(params.partner_code);
      return createJsonResponse({
        success: true,
        data: partner
      });
      
    case 'get_booking':
      if (!params.booking_id) {
        throw new ValidationError('Booking ID is required');
      }
      const bookingDAO = new BookingDAO();
      const booking = bookingDAO.findById(params.booking_id);
      return createJsonResponse({
        success: true,
        data: booking
      });
      
    default:
      throw new Error('Unknown GET action: ' + action);
  }
}

// ===== 輔助函數 =====

/**
 * 解析 POST 數據
 */
function parsePostData(e) {
  let data = {};
  
  // 從參數解析
  if (e.parameter) {
    data = e.parameter;
  }
  
  // 從 POST body 解析
  if (e.postData) {
    if (e.postData.type === 'application/json') {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (error) {
        Logger.log('Failed to parse JSON: ' + error.toString());
      }
    } else if (e.postData.type === 'application/x-www-form-urlencoded') {
      // 表單數據已經在 e.parameter 中
    }
  }
  
  return data;
}

/**
 * 創建 JSON 響應
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 創建錯誤響應
 */
function createErrorResponse(error) {
  const response = {
    success: false,
    error: error.message || 'Unknown error'
  };
  
  if (error instanceof ValidationError) {
    response.type = 'VALIDATION_ERROR';
    response.errors = error.errors;
  } else if (error instanceof NotFoundError) {
    response.type = 'NOT_FOUND';
  } else if (error instanceof TransactionError) {
    response.type = 'TRANSACTION_ERROR';
  }
  
  return createJsonResponse(response);
}

/**
 * 記錄點擊並跳轉
 */
function recordClickAndRedirect(e) {
  try {
    const clickDAO = new ClickDAO();
    clickDAO.recordClick(e.parameter);
  } catch (error) {
    Logger.log('Failed to record click: ' + error.toString());
  }
  
  return createRedirectPage(e);
}

/**
 * 創建跳轉頁面
 */
function createRedirectPage(e) {
  const params = e ? e.parameter : {};
  const destination = params.dest || 'landing';
  const subid = params.pid || params.subid || '';
  
  let redirectUrl;
  
  if (destination === 'coupon') {
    // 查找大使的優惠券連結
    try {
      const partnerDAO = new PartnerDAO();
      const partner = partnerDAO.findByPartnerCode(subid);
      redirectUrl = partner ? partner.line_coupon_url : DEFAULT_LINE_COUPON_URL;
    } catch (error) {
      redirectUrl = DEFAULT_LINE_COUPON_URL;
    }
  } else {
    // 傳遞參數到 landing page
    if (e && e.queryString) {
      redirectUrl = GITHUB_PAGES_URL + '?' + e.queryString;
    } else if (subid) {
      redirectUrl = GITHUB_PAGES_URL + `?subid=${encodeURIComponent(subid)}`;
    } else {
      redirectUrl = GITHUB_PAGES_URL;
    }
  }
  
  // HTML 跳轉頁面
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>正在跳轉...</title>
  <meta http-equiv="refresh" content="0; url=${redirectUrl}">
  <script>window.location.href = "${redirectUrl}";</script>
</head>
<body>
  <div style="text-align: center; margin-top: 50px;">
    <h2>正在跳轉到森林知音計畫...</h2>
    <p>如果沒有自動跳轉，請<a href="${redirectUrl}">點擊這裡</a></p>
  </div>
</body>
</html>`;
  
  return HtmlService.createHtmlOutput(html);
}

/**
 * 處理更新 SELF_USE 訂房
 */
function handleUpdateSelfUseBooking(bookingId, data, existing) {
  const transaction = new TransactionManager();
  
  try {
    const bookingDAO = new BookingDAO();
    const partnerDAO = new PartnerDAO();
    const accommodationUsageDAO = new AccommodationUsageDAO();
    const payoutDAO = new PayoutDAO();
    
    // 計算折抵金額變化
    const oldDeductAmount = extractDeductAmount(existing.notes);
    const newDeductAmount = extractDeductAmount(data.notes);
    const difference = newDeductAmount - oldDeductAmount;
    
    if (difference !== 0 && existing.partner_code) {
      // 更新大使點數
      transaction.addOperation(
        () => {
          if (difference > 0) {
            // 需要扣更多點數
            return partnerDAO.useAccommodationPoints(existing.partner_code, difference);
          } else {
            // 返還部分點數
            return partnerDAO.refundAccommodationPoints(existing.partner_code, -difference);
          }
        },
        () => {
          if (difference > 0) {
            partnerDAO.refundAccommodationPoints(existing.partner_code, difference);
          } else {
            partnerDAO.useAccommodationPoints(existing.partner_code, -difference);
          }
        }
      );
      
      // 更新住宿金使用記錄
      const usages = accommodationUsageDAO.findByBookingId(bookingId);
      if (usages.length > 0) {
        transaction.addOperation(
          () => {
            return accommodationUsageDAO.update(usages[0].id, {
              deduct_amount: newDeductAmount
            });
          },
          () => {
            accommodationUsageDAO.update(usages[0].id, {
              deduct_amount: oldDeductAmount
            });
          }
        );
      }
      
      // 創建調整 Payout 記錄
      transaction.addOperation(
        () => {
          return payoutDAO.createPointsAdjustment(
            existing.partner_code,
            difference,
            `訂房 #${bookingId} 折抵金額調整`,
            difference > 0
          );
        },
        (createdPayout) => {
          if (createdPayout && createdPayout.id) {
            payoutDAO.delete(createdPayout.id);
          }
        }
      );
    }
    
    // 更新訂房記錄
    transaction.addOperation(
      () => {
        return bookingDAO.update(bookingId, data);
      },
      () => {
        bookingDAO.update(bookingId, existing);
      }
    );
    
    // 執行事務
    const result = transaction.execute();
    
    return createJsonResponse({
      success: true,
      message: 'SELF_USE booking updated successfully',
      data: result.results[result.results.length - 1]
    });
    
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * 從備註中提取折抵金額
 */
function extractDeductAmount(notes) {
  if (!notes) return 0;
  
  const match = notes.match(/折抵\s*NT\$?\s*(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  
  return 0;
}

/**
 * 測試函數 - 用於 Google Apps Script 編輯器測試
 */
function testNewArchitecture() {
  try {
    Logger.log('Testing new architecture...');
    
    // 測試數據訪問層
    const bookingDAO = new BookingDAO();
    const bookings = bookingDAO.findAll();
    Logger.log(`Found ${bookings.length} bookings`);
    
    // 測試服務層
    const bookingService = new BookingService();
    const testBooking = {
      guest_name: 'Test Guest',
      guest_phone: '0912345678',
      checkin_date: new Date(),
      checkout_date: new Date(Date.now() + 86400000),
      room_price: 3000,
      partner_code: 'TEST001'
    };
    
    // 注意：實際測試時請小心，這會創建真實數據
    // const result = bookingService.createBooking(testBooking);
    // Logger.log('Test booking created: ' + JSON.stringify(result));
    
    Logger.log('Architecture test completed');
    
  } catch (error) {
    Logger.log('Test failed: ' + error.toString());
  }
}