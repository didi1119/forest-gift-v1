/**
 * 基礎功能測試 - Basic Functionality Tests
 *
 * 測試項目：
 * 1. API 連線測試 - 驗證 Google Apps Script API 是否正常回應
 * 2. 數據結構驗證 - 驗證 Partners, Bookings, Payouts 表結構完整性
 *
 * 執行頻率：必要（每次測試都應執行）
 * 預估耗時：10-15 秒
 *
 * @requires TestFramework from ../core/test-framework.js
 */

/**
 * 測試 1: API 連線測試
 *
 * 目的：確保能夠成功連接到 Google Apps Script 並獲取數據
 *
 * 步驟：
 * 1. 調用 fetchSheetData() 獲取所有表數據
 * 2. 驗證返回的數據包含 partners 和 bookings
 * 3. 驗證數據不為空
 *
 * 通過條件：
 * - API 調用成功
 * - 返回數據包含必要的表
 * - partners 或 bookings 至少有一個有數據
 */
const connectivityTest = {
    name: '基礎連線測試',
    description: '驗證 Google Apps Script API 連線和數據獲取',
    category: 'basic',
    execute: async (framework) => {
        // 步驟 1: 獲取數據
        const data = await framework.fetchSheetData();

        // 步驟 2: 驗證數據結構
        if (!data.partners || !data.bookings) {
            throw new Error('無法獲取基礎數據：partners 或 bookings 為空');
        }

        // 步驟 3: 記錄結果
        framework.log(`✓ API 連線成功`);
        framework.log(`  Partners: ${data.partners.length} 筆`);
        framework.log(`  Bookings: ${data.bookings.length} 筆`);
        framework.log(`  Payouts: ${data.payouts ? data.payouts.length : 0} 筆`);

        return {
            success: true,
            partnersCount: data.partners.length,
            bookingsCount: data.bookings.length,
            payoutsCount: data.payouts ? data.payouts.length : 0
        };
    }
};

/**
 * 測試 2: 數據結構驗證
 *
 * 目的：確保 Partners 表包含所有必要欄位
 *
 * 步驟：
 * 1. 獲取 Partners 表數據
 * 2. 檢查第一筆資料是否包含必要欄位
 * 3. 驗證欄位類型和格式
 *
 * 必要欄位：
 * - partner_code: 大使代碼（string）
 * - partner_name: 大使姓名（string）
 * - partner_level: 大使等級（string）
 * - commission_preference: 佣金偏好（string）
 * - available_points: 可用點數（number）
 * - successful_referrals: 成功推薦數（number）
 *
 * 通過條件：
 * - Partners 表至少有一筆資料
 * - 所有必要欄位都存在
 * - 欄位值符合預期類型
 */
const dataStructureTest = {
    name: '數據結構驗證',
    description: '驗證 Partners 表結構和必要欄位',
    category: 'basic',
    execute: async (framework) => {
        // 步驟 1: 獲取數據
        const data = await framework.fetchSheetData();

        // 步驟 2: 檢查 Partners 表
        if (!data.partners || data.partners.length === 0) {
            throw new Error('Partners 表無資料');
        }

        // 步驟 3: 定義必要欄位
        const requiredFields = [
            { name: 'partner_code', type: 'string' },
            { name: 'partner_name', type: 'string' },
            { name: 'partner_level', type: 'string' },
            { name: 'commission_preference', type: 'string' },
            { name: 'available_points', type: 'number' },
            { name: 'successful_referrals', type: 'number' }
        ];

        // 步驟 4: 驗證第一筆資料
        const partner = data.partners[0];

        if (!partner) {
            throw new Error('無法讀取第一筆 Partner 資料');
        }

        // 步驟 5: 檢查每個必要欄位
        const missingFields = [];
        const wrongTypeFields = [];

        for (const field of requiredFields) {
            if (!(field.name in partner)) {
                missingFields.push(field.name);
            } else {
                const value = partner[field.name];
                const actualType = typeof value;

                // 特殊處理：數字可能被存儲為字符串
                if (field.type === 'number') {
                    if (actualType !== 'number' && actualType !== 'string') {
                        wrongTypeFields.push(`${field.name} (預期: ${field.type}, 實際: ${actualType})`);
                    } else if (actualType === 'string' && isNaN(Number(value))) {
                        wrongTypeFields.push(`${field.name} (無法轉換為數字)`);
                    }
                } else if (actualType !== field.type) {
                    wrongTypeFields.push(`${field.name} (預期: ${field.type}, 實際: ${actualType})`);
                }
            }
        }

        // 步驟 6: 報告結果
        if (missingFields.length > 0) {
            throw new Error(`缺少必要欄位: ${missingFields.join(', ')}`);
        }

        if (wrongTypeFields.length > 0) {
            framework.log(`⚠️ 欄位類型警告: ${wrongTypeFields.join(', ')}`);
        }

        framework.log(`✓ 數據結構驗證通過`);
        framework.log(`  驗證的大使: ${partner.partner_code} (${partner.partner_name})`);
        framework.log(`  等級: ${partner.partner_level}`);
        framework.log(`  可用點數: ${partner.available_points}`);

        return { success: true, partner: partner.partner_code };
    }
};

/**
 * 導出所有基礎測試
 */
const basicTests = [
    connectivityTest,
    dataStructureTest
];

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        tests: basicTests,
        category: 'basic',
        metadata: {
            frequency: 'required',
            estimatedTime: 15,
            dependencies: []
        }
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.basicTests = basicTests;
}
