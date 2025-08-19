// 診斷 Bookings 資料結構的函數
// 請將這個函數加入到您的 Google Apps Script 中執行

function diagnoseBookingsStructure() {
  const spreadsheet = SpreadsheetApp.openById('1WhJxJT1ZDysDi3Eukb2w4DTzh5p_aICvWUIg1j5PqFA');
  const bookingsSheet = spreadsheet.getSheetByName('Bookings');
  
  if (!bookingsSheet) {
    console.log('❌ 找不到 Bookings 工作表！');
    return;
  }
  
  // 獲取所有資料範圍
  const range = bookingsSheet.getDataRange();
  const values = range.getValues();
  
  console.log('📊 Bookings 工作表診斷結果：');
  console.log('================================');
  
  // 1. 基本資訊
  console.log('總列數:', values.length);
  console.log('總欄數:', values[0].length);
  
  // 2. 檢查標題列（第一列）
  const headers = values[0];
  console.log('\n📋 標題列（第一列）內容：');
  headers.forEach((header, index) => {
    const columnLetter = String.fromCharCode(65 + index); // A, B, C...
    console.log(`  ${columnLetter}列 [${index}]: "${header}"`);
  });
  
  // 3. 檢查第一個欄位
  console.log('\n🔍 第一個欄位檢查：');
  console.log(`  A1 儲存格內容: "${headers[0]}"`);
  console.log(`  是否為 "id" (小寫): ${headers[0] === 'id'}`);
  console.log(`  是否為 "ID" (大寫): ${headers[0] === 'ID'}`);
  
  // 4. 檢查是否有空白或隱藏欄位
  console.log('\n⚠️ 空白或問題欄位檢查：');
  let hasIssue = false;
  headers.forEach((header, index) => {
    if (header === '' || header === null || header === undefined) {
      console.log(`  ❌ 第 ${index} 欄（${String.fromCharCode(65 + index)}列）是空白的！`);
      hasIssue = true;
    }
    if (typeof header !== 'string') {
      console.log(`  ❌ 第 ${index} 欄（${String.fromCharCode(65 + index)}列）不是字串：類型是 ${typeof header}`);
      hasIssue = true;
    }
  });
  if (!hasIssue) {
    console.log('  ✅ 沒有發現空白或問題欄位');
  }
  
  // 5. 檢查重複欄位
  console.log('\n🔍 重複欄位檢查：');
  const headerCounts = {};
  headers.forEach(header => {
    headerCounts[header] = (headerCounts[header] || 0) + 1;
  });
  let hasDuplicate = false;
  for (let header in headerCounts) {
    if (headerCounts[header] > 1) {
      console.log(`  ❌ "${header}" 出現 ${headerCounts[header]} 次！`);
      hasDuplicate = true;
    }
  }
  if (!hasDuplicate) {
    console.log('  ✅ 沒有重複的欄位');
  }
  
  // 6. 預期的欄位列表
  const expectedHeaders = [
    'id', 'partner_code', 'guest_name', 'guest_phone', 'guest_email',
    'bank_account_last5', 'checkin_date', 'checkout_date', 'room_price',
    'booking_source', 'stay_status', 'payment_status', 'commission_status',
    'commission_amount', 'commission_type', 'is_first_referral_bonus',
    'first_referral_bonus_amount', 'manually_confirmed_by', 'manually_confirmed_at',
    'notes', 'created_at', 'updated_at'
  ];
  
  console.log('\n📊 與預期欄位比較：');
  console.log('預期欄位數量:', expectedHeaders.length);
  console.log('實際欄位數量:', headers.length);
  
  if (headers.length !== expectedHeaders.length) {
    console.log(`❌ 欄位數量不匹配！差異: ${headers.length - expectedHeaders.length}`);
  }
  
  // 比較每個欄位
  console.log('\n詳細比較：');
  const maxLength = Math.max(headers.length, expectedHeaders.length);
  for (let i = 0; i < maxLength; i++) {
    const actual = headers[i] || '(無)';
    const expected = expectedHeaders[i] || '(無)';
    if (actual !== expected) {
      console.log(`  ❌ 位置 ${i}: 實際="${actual}" vs 預期="${expected}"`);
    } else {
      console.log(`  ✅ 位置 ${i}: "${actual}" 正確`);
    }
  }
  
  // 7. 使用 getSheetData 函數測試
  console.log('\n🔧 使用 getSheetData 函數測試：');
  try {
    const data = getSheetData(spreadsheet, 'Bookings');
    if (data && data.length > 0) {
      const firstRow = data[0];
      const keys = Object.keys(firstRow);
      console.log('getSheetData 回傳的欄位數量:', keys.length);
      console.log('getSheetData 回傳的欄位:', keys);
      console.log('第一個欄位:', keys[0]);
    }
  } catch (e) {
    console.log('❌ getSheetData 執行錯誤:', e.message);
  }
  
  console.log('\n================================');
  console.log('診斷完成！');
  
  return {
    totalRows: values.length,
    totalColumns: headers.length,
    headers: headers,
    firstHeader: headers[0],
    hasEmptyHeaders: headers.some(h => !h),
    expectedCount: expectedHeaders.length,
    actualCount: headers.length
  };
}

// 執行診斷
diagnoseBookingsStructure();