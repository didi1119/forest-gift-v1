/**
 * 知音計畫 - 主測試執行器
 * 負責協調和執行所有測試模組
 */

class TestRunner {
    constructor(config = {}) {
        this.config = {
            APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxWVmkMJUladdBVp56vcISxqCfebXaytT4_SX970OaD7Aq8wg74Kcf_9OxyNEaPA_4W/exec',
            TEST_PREFIX: 'TEST_',
            CLEANUP_AFTER: true,
            VERBOSE_LOG: true,
            PARALLEL_TESTS: false,
            ...config
        };
        
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            warnings: [],
            errors: [],
            startTime: null,
            endTime: null
        };
        
        this.testData = {
            partners: [],
            bookings: [],
            payouts: []
        };
        
        this.originalData = null;
    }

    /**
     * 執行所有測試
     */
    async runAll() {
        console.log('🚀 開始執行完整測試套件');
        this.results.startTime = new Date();
        
        try {
            // 1. 準備測試環境
            await this.setup();
            
            // 2. 執行各模組測試
            await this.runCommissionTests();
            await this.runOrderTests();
            await this.runPointsTests();
            await this.runEdgeCaseTests();
            
            // 3. 清理測試環境
            if (this.config.CLEANUP_AFTER) {
                await this.cleanup();
            }
            
        } catch (error) {
            console.error('❌ 測試執行失敗:', error);
            this.results.errors.push(error.message);
        } finally {
            this.results.endTime = new Date();
            this.generateReport();
        }
        
        return this.results;
    }

    /**
     * 設置測試環境
     */
    async setup() {
        console.log('📦 準備測試環境...');
        
        // 1. 載入當前資料
        this.originalData = await this.loadCurrentData();
        
        // 2. 創建測試資料
        await this.createTestData();
        
        // 3. 驗證環境就緒
        await this.verifyEnvironment();
        
        console.log('✅ 測試環境準備完成');
    }

    /**
     * 載入當前資料
     */
    async loadCurrentData() {
        const response = await fetch(`${this.config.APPS_SCRIPT_URL}?action=get_all_data`);
        const data = await response.json();
        
        if (data.success === false) {
            throw new Error('無法載入資料: ' + data.error);
        }
        
        return data.data;
    }

    /**
     * 創建測試資料
     */
    async createTestData() {
        // 創建測試夥伴
        this.testData.partners = [
            {
                partner_code: 'TEST_LV1_NEW',
                partner_name: '測試新人',
                partner_level: 'LV1_INSIDER',
                successful_referrals: 0,
                yearly_referrals: 0,
                commission_preference: 'ACCOMMODATION',
                available_points: 0,
                points_used: 0,
                total_commission_earned: 0,
                contact_phone: '0911111111'
            },
            {
                partner_code: 'TEST_LV1_EXP',
                partner_name: '測試老手',
                partner_level: 'LV1_INSIDER', 
                successful_referrals: 3,
                yearly_referrals: 3,
                commission_preference: 'CASH',
                available_points: 3000,
                points_used: 0,
                total_commission_earned: 3000,
                contact_phone: '0922222222'
            },
            {
                partner_code: 'TEST_LV2_STD',
                partner_name: '測試嚮導',
                partner_level: 'LV2_GUIDE',
                successful_referrals: 5,
                yearly_referrals: 5,
                commission_preference: 'ACCOMMODATION',
                available_points: 6000,
                points_used: 1000,
                total_commission_earned: 7000,
                contact_phone: '0933333333'
            },
            {
                partner_code: 'TEST_LV3_VIP',
                partner_name: '測試守護者',
                partner_level: 'LV3_GUARDIAN',
                successful_referrals: 15,
                yearly_referrals: 12,
                commission_preference: 'CASH',
                available_points: 0,
                points_used: 0,
                total_commission_earned: 20000,
                pending_commission: 5000,
                contact_phone: '0944444444'
            }
        ];

        // 批量創建測試夥伴
        for (const partner of this.testData.partners) {
            await this.createPartner(partner);
        }
    }

    /**
     * 創建單個夥伴
     */
    async createPartner(partnerData) {
        const params = {
            action: 'create_partner',
            ...partnerData
        };
        
        const response = await this.apiCall(params);
        
        if (!response.success) {
            console.warn(`⚠️ 創建夥伴失敗: ${partnerData.partner_code}`);
        }
        
        return response;
    }

    /**
     * API 呼叫
     */
    async apiCall(params) {
        try {
            const response = await fetch(this.config.APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams(params).toString()
            });
            
            const result = await response.json();
            
            if (this.config.VERBOSE_LOG) {
                console.log('API Call:', params.action, result);
            }
            
            return result;
        } catch (error) {
            console.error('API 呼叫失敗:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 驗證環境
     */
    async verifyEnvironment() {
        // 檢查測試夥伴是否創建成功
        const currentData = await this.loadCurrentData();
        const testPartners = currentData.partners.filter(p => 
            p.partner_code.startsWith(this.config.TEST_PREFIX)
        );
        
        if (testPartners.length !== this.testData.partners.length) {
            throw new Error('測試夥伴創建不完整');
        }
        
        console.log(`✅ 已創建 ${testPartners.length} 個測試夥伴`);
    }

    /**
     * 執行佣金測試
     */
    async runCommissionTests() {
        console.log('\n💰 執行佣金計算測試...');
        const CommissionTests = require('./test-commission.js');
        const tester = new CommissionTests(this);
        return await tester.run();
    }

    /**
     * 執行訂單測試
     */
    async runOrderTests() {
        console.log('\n📦 執行訂單管理測試...');
        const OrderTests = require('./test-orders.js');
        const tester = new OrderTests(this);
        return await tester.run();
    }

    /**
     * 執行點數測試
     */
    async runPointsTests() {
        console.log('\n🎯 執行點數操作測試...');
        const PointsTests = require('./test-points.js');
        const tester = new PointsTests(this);
        return await tester.run();
    }

    /**
     * 執行邊界測試
     */
    async runEdgeCaseTests() {
        console.log('\n⚠️ 執行邊界條件測試...');
        const EdgeCaseTests = require('./test-edge-cases.js');
        const tester = new EdgeCaseTests(this);
        return await tester.run();
    }

    /**
     * 清理測試資料
     */
    async cleanup() {
        console.log('\n🧹 清理測試資料...');
        
        try {
            // 刪除測試訂單
            const bookings = await this.loadCurrentData();
            const testBookings = bookings.bookings.filter(b => 
                b.partner_code && b.partner_code.startsWith(this.config.TEST_PREFIX)
            );
            
            for (const booking of testBookings) {
                await this.apiCall({
                    action: 'delete_booking',
                    id: booking.id
                });
            }
            
            // 刪除測試夥伴
            for (const partner of this.testData.partners) {
                await this.apiCall({
                    action: 'delete_partner',
                    partner_code: partner.partner_code
                });
            }
            
            console.log('✅ 測試資料清理完成');
        } catch (error) {
            console.warn('⚠️ 清理資料時發生錯誤:', error.message);
        }
    }

    /**
     * 生成測試報告
     */
    generateReport() {
        const duration = (this.results.endTime - this.results.startTime) / 1000;
        const passRate = this.results.total > 0 
            ? (this.results.passed / this.results.total * 100).toFixed(1)
            : 0;
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 測試報告');
        console.log('='.repeat(60));
        console.log(`執行時間: ${duration.toFixed(2)} 秒`);
        console.log(`總測試數: ${this.results.total}`);
        console.log(`✅ 通過: ${this.results.passed} (${passRate}%)`);
        console.log(`❌ 失敗: ${this.results.failed}`);
        console.log(`⏭️ 跳過: ${this.results.skipped}`);
        
        if (this.results.warnings.length > 0) {
            console.log('\n⚠️ 警告:');
            this.results.warnings.forEach(w => console.log(`  - ${w}`));
        }
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ 錯誤:');
            this.results.errors.forEach(e => console.log(`  - ${e}`));
        }
        
        console.log('='.repeat(60));
        
        // 儲存報告到檔案
        this.saveReport();
    }

    /**
     * 儲存報告
     */
    saveReport() {
        const report = {
            timestamp: new Date().toISOString(),
            duration: (this.results.endTime - this.results.startTime) / 1000,
            results: this.results,
            config: this.config
        };
        
        const filename = `test-report-${Date.now()}.json`;
        const fs = require('fs');
        const path = require('path');
        const filepath = path.join(__dirname, '..', 'reports', filename);
        
        try {
            fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
            console.log(`\n📄 報告已儲存: ${filename}`);
        } catch (error) {
            console.warn('無法儲存報告:', error.message);
        }
    }

    /**
     * 測試斷言工具
     */
    assert(condition, message) {
        this.results.total++;
        
        if (condition) {
            this.results.passed++;
            if (this.config.VERBOSE_LOG) {
                console.log(`  ✅ ${message}`);
            }
            return true;
        } else {
            this.results.failed++;
            console.error(`  ❌ ${message}`);
            this.results.errors.push(message);
            return false;
        }
    }

    /**
     * 跳過測試
     */
    skip(message) {
        this.results.total++;
        this.results.skipped++;
        console.log(`  ⏭️ 跳過: ${message}`);
    }

    /**
     * 警告
     */
    warn(message) {
        this.results.warnings.push(message);
        console.warn(`  ⚠️ ${message}`);
    }

    /**
     * 工具函數：等待
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 工具函數：取得測試日期
     */
    getTestDate(daysFromNow) {
        const date = new Date();
        date.setDate(date.getDate() + daysFromNow);
        return date.toISOString().split('T')[0];
    }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestRunner;
}

// 瀏覽器環境
if (typeof window !== 'undefined') {
    window.TestRunner = TestRunner;
}