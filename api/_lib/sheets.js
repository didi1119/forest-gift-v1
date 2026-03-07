// ========================================
// Google Sheets API 封裝
// 替換 Google Apps Script 的 SpreadsheetApp
// ========================================

const { google } = require('googleapis');
const { SHEETS_ID } = require('./config');

let sheetsClient = null;
let authClient = null;

/**
 * 取得已授權的 Google Sheets API 客戶端（單例）
 */
async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  const clientEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();

  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY environment variables');
  }

  authClient = new google.auth.JWT(
    clientEmail,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  await authClient.authorize();
  sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  return sheetsClient;
}

// ========================================
// Sheet metadata cache (per invocation)
// ========================================
const sheetIdCache = {};

/**
 * 取得 sheet 的 sheetId（用於 deleteRow 等 batchUpdate 操作）
 */
async function getSheetId(sheetName) {
  if (sheetIdCache[sheetName] !== undefined) return sheetIdCache[sheetName];

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SHEETS_ID,
    fields: 'sheets.properties'
  });

  for (const s of res.data.sheets) {
    sheetIdCache[s.properties.title] = s.properties.sheetId;
  }

  return sheetIdCache[sheetName];
}

// ========================================
// 核心資料操作函數
// ========================================

/**
 * 讀取整個工作表的資料（含表頭）
 * 等同於 sheet.getDataRange().getValues()
 * @returns {Array<Array>} 2D 陣列，第一列為表頭
 */
async function getSheetData(sheetName) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_ID,
    range: sheetName,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING'
  });
  return res.data.values || [];
}

/**
 * 讀取表頭（第一列）
 */
async function getHeaders(sheetName) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_ID,
    range: `${sheetName}!1:1`,
    valueRenderOption: 'UNFORMATTED_VALUE'
  });
  return (res.data.values && res.data.values[0]) || [];
}

/**
 * 更新指定列的資料
 * 等同於 sheet.getRange(rowIndex, 1, 1, row.length).setValues([row])
 * @param {string} sheetName
 * @param {number} rowIndex - 1-based 行號
 * @param {Array} values - 該列的值陣列
 */
async function updateRow(sheetName, rowIndex, values) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEETS_ID,
    range: `${sheetName}!A${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] }
  });
}

/**
 * 新增一列到工作表末尾
 * 等同於 sheet.appendRow(row)
 */
async function appendRow(sheetName, values) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEETS_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] }
  });
}

/**
 * 刪除指定列
 * 等同於 sheet.deleteRow(rowIndex)
 * @param {string} sheetName
 * @param {number} rowIndex - 1-based 行號
 */
async function deleteRow(sheetName, rowIndex) {
  const sheets = await getSheetsClient();
  const sheetId = await getSheetId(sheetName);

  if (sheetId === undefined) {
    throw new Error(`Sheet ${sheetName} not found`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEETS_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1, // 0-based
            endIndex: rowIndex
          }
        }
      }]
    }
  });
}

/**
 * 讀取單一儲存格
 */
async function getCellValue(sheetName, row, col) {
  const sheets = await getSheetsClient();
  const colLetter = columnToLetter(col);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_ID,
    range: `${sheetName}!${colLetter}${row}`,
    valueRenderOption: 'UNFORMATTED_VALUE'
  });
  return res.data.values ? res.data.values[0][0] : null;
}

/**
 * 寫入單一儲存格
 */
async function setCellValue(sheetName, row, col, value) {
  const sheets = await getSheetsClient();
  const colLetter = columnToLetter(col);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEETS_ID,
    range: `${sheetName}!${colLetter}${row}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] }
  });
}

/**
 * 檢查工作表是否存在
 */
async function sheetExists(sheetName) {
  try {
    const id = await getSheetId(sheetName);
    return id !== undefined;
  } catch {
    return false;
  }
}

/**
 * 建立新工作表（含表頭）
 */
async function createSheet(sheetName, headers) {
  const sheets = await getSheetsClient();

  // 新增工作表
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEETS_ID,
    requestBody: {
      requests: [{
        addSheet: {
          properties: { title: sheetName }
        }
      }]
    }
  });

  const newSheetId = addRes.data.replies[0].addSheet.properties.sheetId;
  sheetIdCache[sheetName] = newSheetId;

  // 寫入表頭
  if (headers && headers.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEETS_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] }
    });
  }

  return newSheetId;
}

// ========================================
// 工具函數
// ========================================

/**
 * 欄位索引轉字母（1-based）
 * 1 → A, 2 → B, ..., 26 → Z, 27 → AA
 */
function columnToLetter(col) {
  let letter = '';
  while (col > 0) {
    const mod = (col - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

module.exports = {
  getSheetsClient,
  getSheetId,
  getSheetData,
  getHeaders,
  updateRow,
  appendRow,
  deleteRow,
  getCellValue,
  setCellValue,
  sheetExists,
  createSheet,
  columnToLetter
};
