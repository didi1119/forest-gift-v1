/**
 * 知音計畫 - 測試框架核心
 * 用於執行自動化測試並驗證前後端數據一致性
 */

class TestFramework {
    constructor(config = {}) {
        this.config = {
            APPS_SCRIPT_URL: '/api',
            TEST_PREFIX: 'TEST_',
            CLEANUP_AFTER: true,
            VERBOSE_LOG: true,
            WAIT_TIME: 2000, // 等待數據同步的時間（毫秒）
            TEST_PARTNER_CODE: 'TEST_AUTO', // 預設測試大使代碼
            ...config
        };

        this.testResults = [];
        this.currentTest = null;
        this.startTime = null;

        // 提供便捷訪問：外部測試腳本可以使用 framework.testPartnerCode
        this.testPartnerCode = this.config.TEST_PARTNER_CODE;
    }

    // ============= 1. API 客戶端 =============
    
    /**
     * 從 Google Sheets 獲取實時數據
     */
    async fetchSheetData(maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.log('📊 正在獲取 Google Sheets 數據...');
                const response = await fetch(`${this.config.APPS_SCRIPT_URL}?action=get_all_data`);
                const data = await response.json();

                if (data.success) {
                    this.log('✅ 成功獲取 Sheets 數據');
                    return data.data;
                } else if (data.error && data.error.includes('Quota exceeded') && attempt < maxRetries) {
                    this.log(`⚠️ 配額超限，${attempt * 5} 秒後重試 (${attempt}/${maxRetries})...`);
                    await new Promise(r => setTimeout(r, attempt * 5000));
                    continue;
                } else {
                    throw new Error(data.error || '獲取數據失敗');
                }
            } catch (error) {
                if (error.message && error.message.includes('Quota exceeded') && attempt < maxRetries) {
                    this.log(`⚠️ 配額超限，${attempt * 5} 秒後重試 (${attempt}/${maxRetries})...`);
                    await new Promise(r => setTimeout(r, attempt * 5000));
                    continue;
                }
                this.logError('❌ 獲取 Sheets 數據失敗:', error);
                throw error;
            }
        }
    }

    /**
     * 執行 API 操作
     * 使用 fetch + JSON（同網域，無 CORS 問題）
     */
    async executeAPIAction(action, params = {}, maxRetries = 3) {
        this.log(`🔄 執行 API 操作: ${action}`);
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const url = `${this.config.APPS_SCRIPT_URL}?action=${encodeURIComponent(action)}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(params)
                });
                const result = await response.json();
                if (!result.success && result.error && result.error.includes('Quota exceeded') && attempt < maxRetries) {
                    this.log(`⚠️ 配額超限，${attempt * 5} 秒後重試 (${attempt}/${maxRetries})...`);
                    await new Promise(r => setTimeout(r, attempt * 5000));
                    continue;
                }
                this.log(`${result.success ? '✅' : '❌'} API ${action}: ${result.success ? '成功' : result.error}`);
                return result;
            } catch (error) {
                if (error.message && error.message.includes('Quota exceeded') && attempt < maxRetries) {
                    this.log(`⚠️ 配額超限，${attempt * 5} 秒後重試 (${attempt}/${maxRetries})...`);
                    await new Promise(r => setTimeout(r, attempt * 5000));
                    continue;
                }
                this.logError(`❌ API 操作失敗 (${action}):`, error);
                throw error;
            }
        }
    }

    // ============= 2. UI 數據擷取器 =============
    
    /**
     * 從網頁提取顯示數據
     */
    async fetchUIData() {
        try {
            this.log('🖥️ 正在提取 UI 數據...');

            // 如果在 iframe 中運行，需要訪問父視窗
            const targetWindow = window.parent || window;
            const targetDocument = targetWindow.document;

            // 檢查是否在管理後台頁面（有相關 DOM 元素）
            if (!targetDocument.querySelector('#partnersTableBody')) {
                this.log('⚠️ 非管理後台頁面，跳過 UI 數據比對');
                return null;
            }

            const uiData = {
                partners: this.extractPartnersFromUI(targetDocument),
                bookings: this.extractBookingsFromUI(targetDocument),
                payouts: this.extractPayoutsFromUI(targetDocument)
            };

            this.log('✅ 成功提取 UI 數據');
            return uiData;
        } catch (error) {
            this.logError('❌ 提取 UI 數據失敗:', error);
            return null;
        }
    }

    /**
     * 提取夥伴列表 UI 數據
     */
    extractPartnersFromUI(doc) {
        const partners = [];
        const rows = doc.querySelectorAll('#partnersTableBody tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 0) {
                partners.push({
                    partner_code: cells[0]?.textContent?.trim(),
                    partner_name: cells[1]?.textContent?.trim(),
                    partner_level: cells[2]?.textContent?.trim(),
                    available_points: parseInt(cells[3]?.textContent?.replace(/[^0-9]/g, '') || '0'),
                    pending_commission: parseInt(cells[4]?.textContent?.replace(/[^0-9]/g, '') || '0')
                });
            }
        });
        
        return partners;
    }

    /**
     * 提取訂房列表 UI 數據
     */
    extractBookingsFromUI(doc) {
        const bookings = [];
        const rows = doc.querySelectorAll('#bookingsTableBody tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 0) {
                bookings.push({
                    id: cells[0]?.textContent?.trim(),
                    guest_name: cells[1]?.textContent?.trim(),
                    partner_code: cells[2]?.textContent?.trim(),
                    stay_status: cells[3]?.textContent?.trim(),
                    commission_amount: parseInt(cells[4]?.textContent?.replace(/[^0-9]/g, '') || '0')
                });
            }
        });
        
        return bookings;
    }

    /**
     * 提取結算列表 UI 數據
     */
    extractPayoutsFromUI(doc) {
        const payouts = [];
        const rows = doc.querySelectorAll('#payoutsTableBody tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 0) {
                payouts.push({
                    id: cells[0]?.textContent?.trim(),
                    partner_code: cells[1]?.textContent?.trim(),
                    payout_type: cells[2]?.textContent?.trim(),
                    amount: parseInt(cells[3]?.textContent?.replace(/[^0-9]/g, '') || '0'),
                    payout_status: cells[4]?.textContent?.trim()
                });
            }
        });
        
        return payouts;
    }

    // ============= 3. 數據比對器 =============
    
    /**
     * 驗證前後端數據一致性
     */
    async validateDataSync() {
        try {
            this.log('🔍 開始驗證數據一致性...');
            
            const sheetData = await this.fetchSheetData();
            const uiData = await this.fetchUIData();
            
            if (!uiData) {
                this.log('⚠️ 非管理後台頁面，跳過 UI 數據比對');
                return { success: true, skipped: true, message: '非管理後台頁面，跳過 UI 比對' };
            }
            
            const results = {
                partners: this.comparePartnerData(sheetData.partners, uiData.partners),
                bookings: this.compareBookingData(sheetData.bookings, uiData.bookings),
                payouts: this.comparePayoutData(sheetData.payouts, uiData.payouts)
            };
            
            const allMatch = results.partners.match && results.bookings.match && results.payouts.match;
            
            if (allMatch) {
                this.log('✅ 數據完全一致');
            } else {
                this.logError('❌ 發現數據不一致');
            }
            
            return {
                success: allMatch,
                results: results
            };
        } catch (error) {
            this.logError('❌ 數據驗證失敗:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 比對夥伴數據
     */
    comparePartnerData(sheetPartners, uiPartners) {
        const differences = [];
        
        sheetPartners.forEach(sheetPartner => {
            const uiPartner = uiPartners.find(p => p.partner_code === sheetPartner.partner_code);
            
            if (uiPartner) {
                // 比對關鍵欄位
                if (sheetPartner.available_points !== uiPartner.available_points) {
                    differences.push({
                        partner_code: sheetPartner.partner_code,
                        field: 'available_points',
                        sheet: sheetPartner.available_points,
                        ui: uiPartner.available_points
                    });
                }
                
                if (sheetPartner.pending_commission !== uiPartner.pending_commission) {
                    differences.push({
                        partner_code: sheetPartner.partner_code,
                        field: 'pending_commission',
                        sheet: sheetPartner.pending_commission,
                        ui: uiPartner.pending_commission
                    });
                }
            }
        });
        
        return {
            match: differences.length === 0,
            differences: differences
        };
    }

    /**
     * 比對訂房數據
     */
    compareBookingData(sheetBookings, uiBookings) {
        const differences = [];
        
        sheetBookings.forEach(sheetBooking => {
            const uiBooking = uiBookings.find(b => b.id === sheetBooking.id);
            
            if (uiBooking) {
                // 比對關鍵欄位
                if (sheetBooking.stay_status !== uiBooking.stay_status) {
                    differences.push({
                        booking_id: sheetBooking.id,
                        field: 'stay_status',
                        sheet: sheetBooking.stay_status,
                        ui: uiBooking.stay_status
                    });
                }
                
                if (sheetBooking.commission_amount !== uiBooking.commission_amount) {
                    differences.push({
                        booking_id: sheetBooking.id,
                        field: 'commission_amount',
                        sheet: sheetBooking.commission_amount,
                        ui: uiBooking.commission_amount
                    });
                }
            }
        });
        
        return {
            match: differences.length === 0,
            differences: differences
        };
    }

    /**
     * 比對結算數據
     */
    comparePayoutData(sheetPayouts, uiPayouts) {
        const differences = [];
        
        sheetPayouts.forEach(sheetPayout => {
            const uiPayout = uiPayouts.find(p => p.id === sheetPayout.id);
            
            if (uiPayout) {
                // 比對關鍵欄位
                if (sheetPayout.amount !== uiPayout.amount) {
                    differences.push({
                        payout_id: sheetPayout.id,
                        field: 'amount',
                        sheet: sheetPayout.amount,
                        ui: uiPayout.amount
                    });
                }
                
                if (sheetPayout.payout_status !== uiPayout.payout_status) {
                    differences.push({
                        payout_id: sheetPayout.id,
                        field: 'payout_status',
                        sheet: sheetPayout.payout_status,
                        ui: uiPayout.payout_status
                    });
                }
            }
        });
        
        return {
            match: differences.length === 0,
            differences: differences
        };
    }

    // ============= 4. 測試執行器 =============
    
    /**
     * 執行測試序列
     */
    async runTestSequence(testCases) {
        this.log('🚀 開始執行測試序列');
        this.startTime = Date.now();
        this.testResults = [];
        
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            this.currentTest = testCase;
            
            this.log(`\n📝 測試 ${i + 1}/${testCases.length}: ${testCase.name}`);
            
            try {
                // 執行測試前的數據快照
                const beforeState = await this.captureState();
                
                // 執行測試
                const result = await testCase.execute(this);
                
                // 等待數據同步
                await this.wait(this.config.WAIT_TIME);
                
                // 執行測試後的數據快照
                const afterState = await this.captureState();
                
                // 驗證結果
                const validation = await this.validateTestResult(testCase, beforeState, afterState, result);
                
                this.testResults.push({
                    name: testCase.name,
                    success: validation.success,
                    result: result,
                    validation: validation,
                    duration: Date.now() - this.startTime
                });
                
                if (validation.success) {
                    this.log(`✅ 測試通過: ${testCase.name}`);
                } else {
                    this.logError(`❌ 測試失敗: ${testCase.name}`);
                    this.logError('失敗原因:', validation.errors);
                }
                
            } catch (error) {
                this.logError(`❌ 測試執行錯誤: ${testCase.name}`);
                this.logError(error);
                
                this.testResults.push({
                    name: testCase.name,
                    success: false,
                    error: error.message,
                    duration: Date.now() - this.startTime
                });
            }
            
            // 清理測試數據（如果需要）
            if (this.config.CLEANUP_AFTER && testCase.cleanup) {
                await testCase.cleanup(this);
            }
        }
        
        this.log('\n📊 測試完成，生成報告...');
        return this.generateReport();
    }

    /**
     * 捕獲當前系統狀態
     */
    async captureState() {
        const sheetData = await this.fetchSheetData();
        return {
            timestamp: new Date().toISOString(),
            partners: sheetData.partners,
            bookings: sheetData.bookings,
            payouts: sheetData.payouts,
            accommodation_usage: sheetData.accommodation_usage || [],
            clicks: sheetData.clicks || []
        };
    }

    /**
     * 驗證測試結果
     */
    async validateTestResult(testCase, beforeState, afterState, result) {
        const validation = {
            success: true,
            errors: []
        };
        
        // 如果測試案例定義了預期變化
        if (testCase.expectedChanges) {
            for (const change of testCase.expectedChanges) {
                const valid = await this.validateChange(change, beforeState, afterState);
                if (!valid.success) {
                    validation.success = false;
                    validation.errors.push(valid.error);
                }
            }
        }
        
        // 驗證數據一致性
        const syncResult = await this.validateDataSync();
        if (!syncResult.success) {
            validation.success = false;
            validation.errors.push('前後端數據不一致');
            validation.syncDetails = syncResult.results;
        }
        
        return validation;
    }

    /**
     * 驗證單個變化
     */
    async validateChange(change, beforeState, afterState) {
        try {
            const { table, field, identifier, expectedValue, expectedDelta } = change;
            
            // 找到相關記錄
            const beforeRecord = beforeState[table].find(r => r[identifier.field] === identifier.value);
            const afterRecord = afterState[table].find(r => r[identifier.field] === identifier.value);
            
            if (expectedValue !== undefined) {
                // 驗證絕對值
                if (afterRecord[field] !== expectedValue) {
                    return {
                        success: false,
                        error: `${table}.${field} 預期值 ${expectedValue}，實際值 ${afterRecord[field]}`
                    };
                }
            }
            
            if (expectedDelta !== undefined) {
                // 驗證變化量
                const actualDelta = (afterRecord[field] || 0) - (beforeRecord[field] || 0);
                if (actualDelta !== expectedDelta) {
                    return {
                        success: false,
                        error: `${table}.${field} 預期變化 ${expectedDelta}，實際變化 ${actualDelta}`
                    };
                }
            }
            
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: `驗證變化時發生錯誤: ${error.message}`
            };
        }
    }

    // ============= 5. 報告生成器 =============
    
    /**
     * 生成測試報告
     */
    generateReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;
        const totalDuration = Date.now() - this.startTime;
        
        const report = {
            summary: {
                totalTests,
                passed: passedTests,
                failed: failedTests,
                passRate: (passedTests / totalTests * 100).toFixed(2) + '%',
                duration: totalDuration + 'ms',
                timestamp: new Date().toISOString()
            },
            details: this.testResults,
            environment: {
                url: window.location.href,
                userAgent: navigator.userAgent,
                testConfig: this.config
            }
        };
        
        this.log('\n========== 測試報告 ==========');
        this.log(`總測試數: ${totalTests}`);
        this.log(`通過: ${passedTests} (${report.summary.passRate})`);
        this.log(`失敗: ${failedTests}`);
        this.log(`執行時間: ${totalDuration}ms`);
        this.log('===============================\n');
        
        // 顯示失敗的測試詳情
        if (failedTests > 0) {
            this.log('失敗測試詳情:');
            this.testResults.filter(r => !r.success).forEach(test => {
                this.logError(`- ${test.name}: ${test.error || '驗證失敗'}`);
                if (test.validation && test.validation.errors) {
                    test.validation.errors.forEach(err => {
                        this.logError(`  • ${err}`);
                    });
                }
            });
        }
        
        return report;
    }

    // ============= 工具方法 =============
    
    /**
     * 等待指定時間
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 記錄日誌
     */
    log(...args) {
        if (this.config.VERBOSE_LOG) {
            console.log('[TestFramework]', ...args);
        }
    }

    /**
     * 記錄錯誤
     */
    logError(...args) {
        console.error('[TestFramework]', ...args);
    }

    /**
     * 生成測試 ID
     */
    generateTestId() {
        return `${this.config.TEST_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// 導出給其他模組使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestFramework;
}