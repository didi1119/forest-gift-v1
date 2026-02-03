/**
 * 取消結算修復測試
 * 專門測試 related_booking_ids.trim() 錯誤的修復
 */

const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxWVmkMJUladdBVp56vcISxqCfebXaytT4_SX970OaD7Aq8wg74Kcf_9OxyNEaPA_4W/exec';

// API 客戶端
class ApiClient {
    constructor(endpoint) {
        this.endpoint = endpoint;
    }

    async post(action, data = {}) {
        const formData = new URLSearchParams();
        formData.append('action', action);
        Object.keys(data).forEach(key => {
            formData.append(key, data[key]);
        });

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log(`API Response for ${action}:`, result);
        return result;
    }

    async get(action, params = {}) {
        const url = new URL(this.endpoint);
        url.searchParams.append('action', action);
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    }
}

// 測試主函數
async function testCancelPayoutFix() {
    console.log('========================================');
    console.log('取消結算修復測試');
    console.log('========================================');
    
    const api = new ApiClient(API_ENDPOINT);
    const testResults = [];
    
    try {
        // 測試 1: 檢查現有的 Payouts 資料類型
        console.log('\n測試 1: 檢查 related_booking_ids 資料類型');
        console.log('----------------------------------------');
        
        const allData = await api.get('get_all_data');
        const payouts = allData.data.payouts || [];
        
        const typeStats = {
            string: 0,
            number: 0,
            undefined: 0,
            null: 0,
            array: 0,
            object: 0
        };
        
        payouts.forEach(payout => {
            const value = payout.related_booking_ids;
            const type = value === null ? 'null' : 
                        value === undefined ? 'undefined' :
                        Array.isArray(value) ? 'array' :
                        typeof value;
            typeStats[type] = (typeStats[type] || 0) + 1;
        });
        
        console.log('related_booking_ids 類型分佈:');
        Object.entries(typeStats).forEach(([type, count]) => {
            if (count > 0) {
                console.log(`  ${type}: ${count} 筆`);
            }
        });
        
        testResults.push({
            test: 'Type Analysis',
            passed: true,
            details: typeStats
        });
        
        // 測試 2: 找一個數字類型的 Payout 進行測試
        console.log('\n測試 2: 測試數字類型的 related_booking_ids');
        console.log('----------------------------------------');
        
        const numberPayout = payouts.find(p => typeof p.related_booking_ids === 'number');
        if (numberPayout) {
            console.log(`找到數字類型 Payout: ID=${numberPayout.id}, related_booking_ids=${numberPayout.related_booking_ids}`);
            
            // 嘗試取消（如果還沒取消的話）
            if (numberPayout.payout_status !== 'CANCELLED') {
                console.log('嘗試取消這筆 Payout...');
                try {
                    const cancelResult = await api.post('cancel_payout', {
                        payout_id: numberPayout.id
                    });
                    
                    if (cancelResult.success) {
                        console.log('✅ 成功取消數字類型的 Payout！');
                        testResults.push({
                            test: 'Cancel Number Type',
                            passed: true,
                            payoutId: numberPayout.id
                        });
                    } else {
                        console.log('❌ 取消失敗:', cancelResult.error);
                        testResults.push({
                            test: 'Cancel Number Type',
                            passed: false,
                            error: cancelResult.error
                        });
                    }
                } catch (error) {
                    console.error('❌ 錯誤:', error.message);
                    // 檢查是否是 trim 錯誤
                    if (error.message.includes('trim') || error.toString().includes('trim')) {
                        console.error('🚨 仍然存在 trim 錯誤！需要修復後端代碼');
                    }
                    testResults.push({
                        test: 'Cancel Number Type',
                        passed: false,
                        error: error.message
                    });
                }
            } else {
                console.log('此 Payout 已經被取消');
            }
        } else {
            console.log('沒有找到數字類型的 Payout');
        }
        
        // 測試 3: 創建新的測試案例
        console.log('\n測試 3: 創建新測試案例');
        console.log('----------------------------------------');
        
        const testPartnerCode = `TEST_CANCEL_${Date.now()}`;
        console.log(`創建測試大使: ${testPartnerCode}`);
        
        // 創建測試大使
        const partnerData = {
            partner_code: testPartnerCode,
            partner_name: '取消測試大使',
            contact_phone: '0900000000',
            partner_level: 'LV1_INSIDER',
            commission_preference: 'ACCOMMODATION',
            successful_referrals: 0,
            available_points: 0
        };
        
        // 由於沒有 create_partner API，我們創建訂房來間接創建
        console.log('創建測試訂房...');
        const bookingResult = await api.post('create_booking', {
            partner_code: testPartnerCode,
            guest_name: '測試取消房客',
            guest_phone: '0911111111',
            checkin_date: '2024-12-25',
            checkout_date: '2024-12-26',
            room_price: 5000
        });
        
        if (bookingResult.success) {
            const bookingId = bookingResult.data.id;
            console.log(`訂房創建成功: ID=${bookingId}`);
            
            // 確認入住以產生 Payout
            console.log('確認入住...');
            const checkinResult = await api.post('confirm_checkin_completion', {
                booking_id: bookingId
            });
            
            if (checkinResult.success) {
                console.log('入住確認成功');
                
                // 等待一下再查詢
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 查找產生的 Payout
                const newData = await api.get('get_all_data');
                const newPayouts = newData.data.payouts.filter(p => 
                    p.partner_code === testPartnerCode
                );
                
                console.log(`找到 ${newPayouts.length} 筆相關 Payout`);
                
                // 測試取消每一筆
                for (const payout of newPayouts) {
                    console.log(`\n測試取消 Payout ID=${payout.id}`);
                    console.log(`  related_booking_ids: ${payout.related_booking_ids} (類型: ${typeof payout.related_booking_ids})`);
                    
                    try {
                        const cancelResult = await api.post('cancel_payout', {
                            payout_id: payout.id
                        });
                        
                        if (cancelResult.success) {
                            console.log('  ✅ 取消成功');
                            testResults.push({
                                test: `Cancel New Payout ${payout.id}`,
                                passed: true,
                                type: typeof payout.related_booking_ids
                            });
                        } else {
                            console.log('  ❌ 取消失敗:', cancelResult.error);
                            testResults.push({
                                test: `Cancel New Payout ${payout.id}`,
                                passed: false,
                                error: cancelResult.error
                            });
                        }
                    } catch (error) {
                        console.error('  ❌ 錯誤:', error.message);
                        testResults.push({
                            test: `Cancel New Payout ${payout.id}`,
                            passed: false,
                            error: error.message
                        });
                    }
                }
                
                // 清理：刪除測試訂房
                console.log('\n清理測試數據...');
                await api.post('delete_booking', { booking_id: bookingId });
            }
        }
        
        // 測試 4: 智慧取消邏輯測試
        console.log('\n測試 4: 智慧取消邏輯（n-1）');
        console.log('----------------------------------------');
        
        // 這需要一個有多筆成功訂單的大使
        const partnersWithMultiple = allData.data.partners.filter(p => 
            p.successful_referrals >= 3
        );
        
        if (partnersWithMultiple.length > 0) {
            const testPartner = partnersWithMultiple[0];
            console.log(`使用大使 ${testPartner.partner_code} (${testPartner.successful_referrals} 筆成功)`);
            
            // 找一筆該大使的 Payout
            const partnerPayout = payouts.find(p => 
                p.partner_code === testPartner.partner_code && 
                p.payout_status !== 'CANCELLED' &&
                p.payout_type === 'ACCOMMODATION'
            );
            
            if (partnerPayout) {
                console.log('記錄取消前狀態:');
                console.log(`  成功推薦: ${testPartner.successful_referrals}`);
                console.log(`  年度推薦: ${testPartner.yearly_referrals}`);
                console.log(`  等級: ${testPartner.partner_level}`);
                console.log(`  可用點數: ${testPartner.available_points}`);
                
                // 執行智慧取消
                console.log('\n執行智慧取消...');
                const cancelResult = await api.post('cancel_payout', {
                    payout_id: partnerPayout.id
                });
                
                if (cancelResult.success) {
                    // 重新獲取數據檢查結果
                    const afterData = await api.get('get_all_data');
                    const afterPartner = afterData.data.partners.find(p => 
                        p.partner_code === testPartner.partner_code
                    );
                    
                    console.log('\n取消後狀態:');
                    console.log(`  成功推薦: ${afterPartner.successful_referrals} (應為 ${testPartner.successful_referrals - 1})`);
                    console.log(`  年度推薦: ${afterPartner.yearly_referrals}`);
                    console.log(`  等級: ${afterPartner.partner_level}`);
                    console.log(`  可用點數: ${afterPartner.available_points}`);
                    
                    const passed = afterPartner.successful_referrals === testPartner.successful_referrals - 1;
                    console.log(passed ? '✅ 智慧取消邏輯正確' : '❌ 智慧取消邏輯有誤');
                    
                    testResults.push({
                        test: 'Smart Cancel Logic',
                        passed: passed,
                        before: testPartner.successful_referrals,
                        after: afterPartner.successful_referrals
                    });
                }
            }
        }
        
    } catch (error) {
        console.error('測試過程發生錯誤:', error);
        testResults.push({
            test: 'General',
            passed: false,
            error: error.message
        });
    }
    
    // 總結
    console.log('\n========================================');
    console.log('測試總結');
    console.log('========================================');
    
    const passedTests = testResults.filter(r => r.passed).length;
    const totalTests = testResults.length;
    
    console.log(`通過: ${passedTests}/${totalTests}`);
    
    testResults.forEach((result, index) => {
        const status = result.passed ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${result.test}`);
        if (!result.passed && result.error) {
            console.log(`   錯誤: ${result.error}`);
        }
    });
    
    // 返回測試是否全部通過
    return passedTests === totalTests;
}

// 如果是在瀏覽器環境，自動執行
if (typeof window !== 'undefined') {
    window.testCancelPayoutFix = testCancelPayoutFix;
    console.log('測試函數已載入。執行: testCancelPayoutFix()');
}

// 如果是 Node.js 環境
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testCancelPayoutFix };
}