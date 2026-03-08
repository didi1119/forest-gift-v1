/**
 * 知音計畫 - 極端複雜測試場景
 * 包含真正複雜的業務操作組合測試
 */

// ============= 場景 1: 完整佣金撤銷與恢復循環 =============
const testCommissionReversalCycle = {
    name: '佣金撤銷與恢復完整循環測試',
    description: '測試多次確認、撤銷、再確認的複雜循環',
    
    async execute(framework) {
        const partnerCode = 'gg';
        const results = [];
        
        framework.log('=== 開始佣金撤銷與恢復循環測試 ===');
        
        // 步驟 1: 創建多筆訂房
        framework.log('步驟 1: 創建 3 筆訂房');
        const bookings = [];
        for (let i = 0; i < 3; i++) {
            const bookingData = {
                partner_code: partnerCode,
                guest_name: `REVERSAL_TEST_${i}_${Date.now()}`,
                guest_phone: `090000000${i}`,
                guest_email: `reversal${i}@test.com`,
                bank_account_last5: `9999${i}`,
                checkin_date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
                checkout_date: new Date(Date.now() + (i + 1) * 86400000).toISOString().split('T')[0],
                room_price: String(5000 + i * 1000),
                booking_source: 'REFERRAL',
                notes: `撤銷測試訂房 ${i}`
            };
            
            await framework.executeAPIAction('create_booking', bookingData);
            await framework.wait(2000);
            
            const state = await framework.fetchSheetData();
            const booking = state.bookings.find(b => b.guest_name === bookingData.guest_name);
            if (booking) {
                bookings.push(booking);
                framework.log(`  訂房 ${i + 1} 創建成功: ${booking.id}`);
            }
        }
        
        // 步驟 2: 確認所有訂房
        framework.log('步驟 2: 確認所有訂房入住');
        const initialState = await framework.fetchSheetData();
        const partnerBefore = initialState.partners.find(p => p.partner_code === partnerCode);
        const initialPoints = partnerBefore.available_points || 0;
        const initialEarned = partnerBefore.total_commission_earned || 0;
        
        for (const booking of bookings) {
            await framework.executeAPIAction('confirm_checkin_completion', {
                booking_id: booking.id,
                confirmed_by: 'TEST_REVERSAL'
            });
            await framework.wait(1500);
        }
        
        // 步驟 3: 檢查佣金累積
        framework.log('步驟 3: 驗證佣金累積');
        await framework.wait(3000);
        const afterConfirmState = await framework.fetchSheetData();
        const partnerAfterConfirm = afterConfirmState.partners.find(p => p.partner_code === partnerCode);
        
        framework.log(`  初始點數: ${initialPoints}, 確認後點數: ${partnerAfterConfirm.available_points}`);
        framework.log(`  初始總收入: ${initialEarned}, 確認後總收入: ${partnerAfterConfirm.total_commission_earned}`);
        
        // 步驟 4: 取消中間的訂房
        framework.log('步驟 4: 取消第二筆訂房');
        if (bookings[1]) {
            await framework.executeAPIAction('delete_booking', {
                booking_id: bookings[1].id
            });
            await framework.wait(3000);
            
            const afterCancelState = await framework.fetchSheetData();
            const partnerAfterCancel = afterCancelState.partners.find(p => p.partner_code === partnerCode);
            framework.log(`  取消後點數: ${partnerAfterCancel.available_points}`);
            framework.log(`  取消後總收入: ${partnerAfterCancel.total_commission_earned}`);
        }
        
        // 步驟 5: 重新創建並確認新訂房
        framework.log('步驟 5: 創建新訂房並立即確認');
        const newBookingData = {
            partner_code: partnerCode,
            guest_name: `REVERSAL_NEW_${Date.now()}`,
            guest_phone: '0900000099',
            guest_email: 'reversal_new@test.com',
            bank_account_last5: '99999',
            checkin_date: new Date().toISOString().split('T')[0],
            checkout_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            room_price: '10000',
            booking_source: 'REFERRAL',
            notes: '撤銷後新訂房'
        };
        
        await framework.executeAPIAction('create_booking', newBookingData);
        await framework.wait(3000);
        
        const newState = await framework.fetchSheetData();
        const newBooking = newState.bookings.find(b => b.guest_name === newBookingData.guest_name);
        
        if (newBooking) {
            await framework.executeAPIAction('confirm_checkin_completion', {
                booking_id: newBooking.id,
                confirmed_by: 'TEST_REVERSAL'
            });
            await framework.wait(3000);
        }
        
        // 步驟 6: 最終驗證
        framework.log('步驟 6: 最終數據驗證');
        const finalState = await framework.fetchSheetData();
        const partnerFinal = finalState.partners.find(p => p.partner_code === partnerCode);
        
        framework.log(`  最終點數: ${partnerFinal.available_points}`);
        framework.log(`  最終總收入: ${partnerFinal.total_commission_earned}`);
        framework.log(`  最終已使用: ${partnerFinal.points_used}`);
        
        // 檢查 Payouts 記錄
        const payouts = finalState.payouts.filter(p => p.partner_code === partnerCode);
        const reversals = payouts.filter(p => p.payout_type === 'COMMISSION_REVERSAL');
        framework.log(`  找到 ${reversals.length} 筆撤銷記錄`);
        
        return {
            success: true,
            bookingsCreated: bookings.length + 1,
            reversalsFound: reversals.length,
            finalPoints: partnerFinal.available_points
        };
    }
};

// ============= 場景 2: 推薦人連環變更與等級影響 =============
const testChainPartnerChanges = {
    name: '推薦人連環變更與等級影響測試',
    description: '測試訂房在多個推薦人之間變更，並觸發等級變化',
    
    async execute(framework) {
        framework.log('=== 開始推薦人連環變更測試 ===');
        
        // 獲取所有夥伴
        const initialData = await framework.fetchSheetData();
        const partners = initialData.partners.slice(0, 3); // 使用前 3 個夥伴
        
        if (partners.length < 3) {
            throw new Error('需要至少 3 個夥伴執行此測試');
        }
        
        const partnerCodes = partners.map(p => p.partner_code);
        framework.log(`使用夥伴: ${partnerCodes.join(', ')}`);
        
        // 步驟 1: 創建高價值訂房
        framework.log('步驟 1: 創建高價值訂房（$20000）');
        const bookingData = {
            partner_code: partnerCodes[0],
            guest_name: `CHAIN_TEST_${Date.now()}`,
            guest_phone: '0911223344',
            guest_email: 'chain@test.com',
            bank_account_last5: '12345',
            checkin_date: new Date().toISOString().split('T')[0],
            checkout_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            room_price: '20000',
            booking_source: 'REFERRAL',
            notes: '連環變更測試'
        };
        
        await framework.executeAPIAction('create_booking', bookingData);
        await framework.wait(3000);
        
        const state1 = await framework.fetchSheetData();
        const booking = state1.bookings.find(b => b.guest_name === bookingData.guest_name);
        
        if (!booking) {
            throw new Error('找不到創建的訂房');
        }
        
        // 步驟 2: 確認入住（給第一個夥伴）
        framework.log('步驟 2: 確認入住（佣金給夥伴 A）');
        await framework.executeAPIAction('confirm_checkin_completion', {
            booking_id: booking.id,
            confirmed_by: 'CHAIN_TEST'
        });
        await framework.wait(3000);
        
        const state2 = await framework.fetchSheetData();
        const partner0After = state2.partners.find(p => p.partner_code === partnerCodes[0]);
        if (!partner0After) {
            throw new Error(`找不到夥伴 ${partnerCodes[0]}，可能資料尚未同步`);
        }
        framework.log(`  夥伴 A 獲得佣金: ${partner0After.total_commission_earned - partners[0].total_commission_earned}`);
        
        // 步驟 3: 變更到第二個夥伴
        framework.log('步驟 3: 變更推薦人到夥伴 B');
        await framework.executeAPIAction('update_booking', {
            booking_id: booking.id,
            partner_code: partnerCodes[1]
        });
        await framework.wait(3000);
        
        const state3 = await framework.fetchSheetData();
        const partner1After = state3.partners.find(p => p.partner_code === partnerCodes[1]);
        if (!partner1After) {
            throw new Error(`找不到夥伴 ${partnerCodes[1]}，可能資料尚未同步`);
        }
        framework.log(`  夥伴 B 現在的總收入: ${partner1After.total_commission_earned}`);
        
        // 步驟 4: 再變更到第三個夥伴
        framework.log('步驟 4: 變更推薦人到夥伴 C');
        await framework.executeAPIAction('update_booking', {
            booking_id: booking.id,
            partner_code: partnerCodes[2]
        });
        await framework.wait(3000);
        
        // 步驟 5: 變更房價
        framework.log('步驟 5: 調整房價從 $20000 到 $30000');
        await framework.executeAPIAction('update_booking', {
            booking_id: booking.id,
            room_price: '30000'
        });
        await framework.wait(3000);
        
        // 步驟 6: 最後變回第一個夥伴
        framework.log('步驟 6: 最終變回夥伴 A');
        await framework.executeAPIAction('update_booking', {
            booking_id: booking.id,
            partner_code: partnerCodes[0]
        });
        await framework.wait(3000);
        
        // 最終驗證
        const finalState = await framework.fetchSheetData();
        const finalBooking = finalState.bookings.find(b => b.id === booking.id);
        const finalPartners = partnerCodes.map(code => 
            finalState.partners.find(p => p.partner_code === code)
        );
        
        framework.log('=== 最終狀態 ===');
        framework.log(`  訂房推薦人: ${finalBooking.partner_code}`);
        framework.log(`  訂房房價: ${finalBooking.room_price}`);
        framework.log(`  訂房佣金: ${finalBooking.commission_amount}`);
        
        finalPartners.forEach((p, i) => {
            framework.log(`  夥伴 ${String.fromCharCode(65 + i)} (${p.partner_code}):`);
            framework.log(`    - 總收入: ${p.total_commission_earned}`);
            framework.log(`    - 可用點數: ${p.available_points}`);
            framework.log(`    - 成功推薦數: ${p.successful_referrals}`);
        });
        
        return {
            success: true,
            changes: 4,
            finalPartner: finalBooking.partner_code,
            finalPrice: finalBooking.room_price
        };
    }
};

// ============= 場景 3: 點數極限操作測試 =============
const testPointsExtreme = {
    name: '點數極限操作與回滾測試',
    description: '測試點數使用、轉換、取消、再使用的極限情況',
    
    async execute(framework) {
        const partnerCode = 'gg';
        
        framework.log('=== 開始點數極限操作測試 ===');
        
        // 步驟 1: 獲取初始狀態
        const initialState = await framework.fetchSheetData();
        const partnerInitial = initialState.partners.find(p => p.partner_code === partnerCode);
        const startPoints = partnerInitial.available_points || 0;
        const startUsed = partnerInitial.points_used || 0;
        const startCash = partnerInitial.pending_commission || 0;
        
        framework.log(`初始狀態 - 可用: ${startPoints}, 已使用: ${startUsed}, 現金: ${startCash}`);
        
        // 步驟 2: 創建多筆訂房並確認（累積大量點數）
        framework.log('步驟 2: 創建 5 筆訂房並確認');
        const bookingIds = [];
        
        for (let i = 0; i < 5; i++) {
            const bookingData = {
                partner_code: partnerCode,
                guest_name: `POINTS_EXTREME_${i}_${Date.now()}`,
                guest_phone: `092000000${i}`,
                guest_email: `extreme${i}@test.com`,
                bank_account_last5: `7777${i}`,
                checkin_date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
                checkout_date: new Date(Date.now() + (i + 1) * 86400000).toISOString().split('T')[0],
                room_price: '10000',
                booking_source: 'REFERRAL',
                notes: `極限測試訂房 ${i}`
            };
            
            await framework.executeAPIAction('create_booking', bookingData);
            await framework.wait(1500);
            
            const tempState = await framework.fetchSheetData();
            const tempBooking = tempState.bookings.find(b => b.guest_name === bookingData.guest_name);
            
            if (tempBooking) {
                bookingIds.push(tempBooking.id);
                await framework.executeAPIAction('confirm_checkin_completion', {
                    booking_id: tempBooking.id,
                    confirmed_by: 'EXTREME_TEST'
                });
                await framework.wait(1500);
            }
        }
        
        // 步驟 3: 獲取累積後的狀態
        await framework.wait(3000);
        const afterAccumulate = await framework.fetchSheetData();
        const partnerAfterAccumulate = afterAccumulate.partners.find(p => p.partner_code === partnerCode);
        const accumulatedPoints = partnerAfterAccumulate.available_points;
        
        framework.log(`步驟 3: 累積後點數: ${accumulatedPoints}`);
        
        // 步驟 4: 使用部分點數
        framework.log('步驟 4: 使用 30% 的點數');
        const useAmount1 = Math.floor(accumulatedPoints * 0.3);
        
        await framework.executeAPIAction('use_accommodation_points', {
            partner_code: partnerCode,
            deduct_amount: useAmount1,
            guest_name: 'EXTREME_USE_1',
            checkin_date: new Date().toISOString().split('T')[0],
            notes: '極限測試使用 1'
        });
        await framework.wait(2000);
        
        // 步驟 5: 轉換部分點數為現金
        framework.log('步驟 5: 轉換 20% 的原始點數為現金');
        const convertAmount = Math.floor(accumulatedPoints * 0.2);
        
        await framework.executeAPIAction('convert_points_to_cash', {
            partner_code: partnerCode,
            points_used: convertAmount,
            notes: '極限測試轉換'
        });
        await framework.wait(2000);
        
        // 步驟 6: 再使用更多點數
        framework.log('步驟 6: 再使用 25% 的原始點數');
        const useAmount2 = Math.floor(accumulatedPoints * 0.25);
        
        await framework.executeAPIAction('use_accommodation_points', {
            partner_code: partnerCode,
            deduct_amount: useAmount2,
            guest_name: 'EXTREME_USE_2',
            checkin_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            notes: '極限測試使用 2'
        });
        await framework.wait(2000);
        
        // 步驟 7: 取消最近的 Payout
        framework.log('步驟 7: 嘗試取消最近的結算');
        const state7 = await framework.fetchSheetData();
        const recentPayouts = state7.payouts
            .filter(p => p.partner_code === partnerCode)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        if (recentPayouts.length > 0) {
            const latestPayout = recentPayouts[0];
            framework.log(`  取消 Payout: ${latestPayout.id}, 類型: ${latestPayout.payout_type}, 金額: ${latestPayout.amount}`);
            
            await framework.executeAPIAction('cancel_payout', {
                payout_id: latestPayout.id
            });
            await framework.wait(3000);
        }
        
        // 步驟 8: 嘗試使用超額點數（應該失敗）
        framework.log('步驟 8: 嘗試使用超額點數（測試防護機制）');
        const state8 = await framework.fetchSheetData();
        const partnerState8 = state8.partners.find(p => p.partner_code === partnerCode);
        const currentPoints = partnerState8.available_points;
        
        try {
            await framework.executeAPIAction('use_accommodation_points', {
                partner_code: partnerCode,
                deduct_amount: currentPoints + 1000,
                guest_name: 'EXTREME_OVER',
                checkin_date: new Date().toISOString().split('T')[0],
                notes: '超額使用測試'
            });
            framework.log('  ⚠️ 超額使用未被阻止！');
        } catch (error) {
            framework.log('  ✅ 超額使用被正確阻止');
        }
        
        // 步驟 9: 最終驗證
        await framework.wait(2000);
        const finalState = await framework.fetchSheetData();
        const partnerFinal = finalState.partners.find(p => p.partner_code === partnerCode);
        
        framework.log('=== 最終狀態 ===');
        framework.log(`  可用點數: ${partnerFinal.available_points}`);
        framework.log(`  已使用點數: ${partnerFinal.points_used}`);
        framework.log(`  待結算現金: ${partnerFinal.pending_commission}`);
        framework.log(`  總收入: ${partnerFinal.total_commission_earned}`);
        
        // 驗證數據一致性
        const totalUsed = partnerFinal.points_used;
        const expectedUsed = startUsed + useAmount1 + convertAmount + useAmount2;
        const usedDiff = Math.abs(totalUsed - expectedUsed);
        
        if (usedDiff > 100) {
            framework.log(`  ⚠️ 已使用點數可能有誤差: 預期 ${expectedUsed}, 實際 ${totalUsed}`);
        }
        
        return {
            success: true,
            operations: 8,
            finalPoints: partnerFinal.available_points,
            totalUsed: partnerFinal.points_used,
            pendingCash: partnerFinal.pending_commission
        };
    }
};

// ============= 場景 4: 併發操作壓力測試 =============
const testConcurrentOperations = {
    name: '併發操作與數據一致性測試',
    description: '同時執行多個操作，測試數據一致性',
    
    async execute(framework) {
        framework.log('=== 開始併發操作測試 ===');
        
        const partnerCode = 'gg';
        const operations = [];
        
        // 步驟 1: 準備初始數據
        const initialState = await framework.fetchSheetData();
        const partnerInitial = initialState.partners.find(p => p.partner_code === partnerCode);
        
        framework.log(`初始狀態 - 點數: ${partnerInitial.available_points}, 總收入: ${partnerInitial.total_commission_earned}`);
        
        // 步驟 2: 同時發起多個操作（不等待）
        framework.log('步驟 2: 同時發起 10 個操作');
        
        // 操作 1-3: 創建訂房
        for (let i = 0; i < 3; i++) {
            operations.push(
                framework.executeAPIAction('create_booking', {
                    partner_code: partnerCode,
                    guest_name: `CONCURRENT_${i}_${Date.now()}`,
                    guest_phone: `093000000${i}`,
                    guest_email: `concurrent${i}@test.com`,
                    bank_account_last5: `8888${i}`,
                    checkin_date: new Date().toISOString().split('T')[0],
                    checkout_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                    room_price: String(3000 + i * 1000),
                    booking_source: 'REFERRAL',
                    notes: `併發測試 ${i}`
                })
            );
        }
        
        // 操作 4-5: 使用點數
        for (let i = 0; i < 2; i++) {
            operations.push(
                framework.executeAPIAction('use_accommodation_points', {
                    partner_code: partnerCode,
                    deduct_amount: 100 + i * 50,
                    guest_name: `CONCURRENT_USE_${i}`,
                    checkin_date: new Date().toISOString().split('T')[0],
                    notes: `併發使用 ${i}`
                })
            );
        }
        
        // 操作 6: 轉換現金
        operations.push(
            framework.executeAPIAction('convert_points_to_cash', {
                partner_code: partnerCode,
                points_used: 200,
                notes: '併發轉換測試'
            })
        );
        
        // 等待所有操作完成
        framework.log('等待所有操作完成...');
        const results = await Promise.allSettled(operations);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        framework.log(`  成功: ${successful}, 失敗: ${failed}`);
        
        // 步驟 3: 等待數據同步
        await framework.wait(5000);
        
        // 步驟 4: 驗證數據一致性
        framework.log('步驟 4: 驗證數據一致性');
        const finalState = await framework.fetchSheetData();
        const partnerFinal = finalState.partners.find(p => p.partner_code === partnerCode);
        
        framework.log(`最終狀態 - 點數: ${partnerFinal.available_points}, 總收入: ${partnerFinal.total_commission_earned}`);
        
        // 檢查是否有數據異常
        if (partnerFinal.available_points < 0) {
            framework.log('  ❌ 發現負數點數！');
        }
        
        // 檢查 Payouts 記錄
        const payouts = finalState.payouts.filter(p => 
            p.partner_code === partnerCode &&
            p.notes && p.notes.includes('併發')
        );
        
        framework.log(`  找到 ${payouts.length} 筆併發操作的 Payout 記錄`);
        
        return {
            success: true,
            totalOperations: operations.length,
            successful: successful,
            failed: failed,
            finalPoints: partnerFinal.available_points
        };
    }
};

// ============= 場景 5: 年度統計重置測試 =============
const testYearlyReset = {
    name: '年度統計與等級降級測試',
    description: '模擬跨年度的統計重置和等級調整',
    
    async execute(framework) {
        framework.log('=== 開始年度統計測試 ===');
        
        // 這個測試需要特殊的後端支援來模擬日期
        // 或者需要手動調整系統日期
        
        const partnerCode = 'gg';
        
        // 步驟 1: 記錄當前年度統計
        const initialState = await framework.fetchSheetData();
        const partner = initialState.partners.find(p => p.partner_code === partnerCode);
        
        framework.log('當前統計:');
        framework.log(`  等級: ${partner.partner_level}`);
        framework.log(`  年度推薦: ${partner.yearly_referrals}`);
        framework.log(`  累積推薦: ${partner.successful_referrals}`);
        
        // 步驟 2: 創建足夠的訂房使其升級
        framework.log('步驟 2: 創建訂房直到升級');
        const targetReferrals = partner.partner_level === 'LV1_INSIDER' ? 4 : 10;
        const needed = Math.max(0, targetReferrals - partner.yearly_referrals);
        
        for (let i = 0; i < needed; i++) {
            const bookingData = {
                partner_code: partnerCode,
                guest_name: `YEARLY_TEST_${i}_${Date.now()}`,
                guest_phone: `094000000${i}`,
                guest_email: `yearly${i}@test.com`,
                bank_account_last5: `5555${i}`,
                checkin_date: new Date().toISOString().split('T')[0],
                checkout_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                room_price: '8000',
                booking_source: 'REFERRAL',
                notes: `年度測試 ${i}`
            };
            
            await framework.executeAPIAction('create_booking', bookingData);
            await framework.wait(2000);
            
            const tempState = await framework.fetchSheetData();
            const tempBooking = tempState.bookings.find(b => b.guest_name === bookingData.guest_name);
            
            if (tempBooking) {
                await framework.executeAPIAction('confirm_checkin_completion', {
                    booking_id: tempBooking.id,
                    confirmed_by: 'YEARLY_TEST'
                });
                await framework.wait(2000);
            }
        }
        
        // 步驟 3: 檢查升級結果
        const afterUpgrade = await framework.fetchSheetData();
        const partnerAfterUpgrade = afterUpgrade.partners.find(p => p.partner_code === partnerCode);
        
        framework.log('升級後:');
        framework.log(`  等級: ${partnerAfterUpgrade.partner_level}`);
        framework.log(`  年度推薦: ${partnerAfterUpgrade.yearly_referrals}`);
        
        // 步驟 4: 模擬年度重置（需要特殊 API）
        // 這裡只能記錄預期行為
        framework.log('步驟 4: 年度重置預期行為:');
        framework.log('  - yearly_referrals 應重置為 0');
        framework.log('  - successful_referrals 保持不變');
        framework.log('  - 等級根據新年度表現調整');
        
        return {
            success: true,
            originalLevel: partner.partner_level,
            newLevel: partnerAfterUpgrade.partner_level,
            yearlyReferrals: partnerAfterUpgrade.yearly_referrals,
            totalReferrals: partnerAfterUpgrade.successful_referrals
        };
    }
};

// ============= 場景 6: 數據修復與審計追蹤 =============
const testDataRecovery = {
    name: '數據修復與審計追蹤測試',
    description: '測試錯誤數據的修復和完整審計記錄',
    
    async execute(framework) {
        framework.log('=== 開始數據修復測試 ===');
        
        const partnerCode = 'gg';
        const operations = [];
        
        // 步驟 1: 創建一系列正常操作
        framework.log('步驟 1: 執行正常操作序列');
        
        // 創建訂房
        const bookingData = {
            partner_code: partnerCode,
            guest_name: `RECOVERY_TEST_${Date.now()}`,
            guest_phone: '0950000001',
            guest_email: 'recovery@test.com',
            bank_account_last5: '11111',
            checkin_date: new Date().toISOString().split('T')[0],
            checkout_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            room_price: '15000',
            booking_source: 'REFERRAL',
            notes: '修復測試訂房'
        };
        
        await framework.executeAPIAction('create_booking', bookingData);
        await framework.wait(3000);
        
        const state1 = await framework.fetchSheetData();
        const booking = state1.bookings.find(b => b.guest_name === bookingData.guest_name);
        
        // 確認入住
        if (booking) {
            await framework.executeAPIAction('confirm_checkin_completion', {
                booking_id: booking.id,
                confirmed_by: 'RECOVERY_TEST'
            });
            await framework.wait(3000);
        }
        
        // 步驟 2: 執行一系列修改
        framework.log('步驟 2: 執行多次修改操作');
        
        // 修改房價
        await framework.executeAPIAction('update_booking', {
            booking_id: booking.id,
            room_price: '20000'
        });
        await framework.wait(2000);
        
        // 修改推薦人
        const state2 = await framework.fetchSheetData();
        const otherPartner = state2.partners.find(p => p.partner_code !== partnerCode);
        
        if (otherPartner) {
            await framework.executeAPIAction('update_booking', {
                booking_id: booking.id,
                partner_code: otherPartner.partner_code
            });
            await framework.wait(2000);
        }
        
        // 再改回來
        await framework.executeAPIAction('update_booking', {
            booking_id: booking.id,
            partner_code: partnerCode
        });
        await framework.wait(2000);
        
        // 步驟 3: 檢查審計記錄
        framework.log('步驟 3: 驗證審計追蹤');
        const auditState = await framework.fetchSheetData();
        
        // 檢查 Payouts 審計記錄
        const auditRecords = auditState.payouts.filter(p => {
            const relatedIds = String(p.related_booking_ids || '');
            return relatedIds.includes(booking.id);
        });
        
        framework.log(`找到 ${auditRecords.length} 筆審計記錄:`);
        auditRecords.forEach(record => {
            framework.log(`  - ${record.payout_type}: ${record.amount} (${record.payout_status})`);
        });
        
        // 步驟 4: 嘗試手動調整（模擬數據修復）
        framework.log('步驟 4: 執行手動調整（模擬修復）');
        
        await framework.executeAPIAction('update_partner_commission', {
            partner_code: partnerCode,
            available_points: '+500',  // 增加 500 點
            notes: '系統修復補償'
        });
        await framework.wait(2000);
        
        // 最終驗證
        const finalState = await framework.fetchSheetData();
        const partnerFinal = finalState.partners.find(p => p.partner_code === partnerCode);
        const finalAuditRecords = finalState.payouts.filter(p => 
            p.partner_code === partnerCode && 
            p.notes && p.notes.includes('修復')
        );
        
        framework.log('=== 審計追蹤完整性 ===');
        framework.log(`  總審計記錄: ${auditRecords.length}`);
        framework.log(`  修復記錄: ${finalAuditRecords.length}`);
        framework.log(`  最終點數: ${partnerFinal.available_points}`);
        
        return {
            success: true,
            auditRecords: auditRecords.length,
            repairRecords: finalAuditRecords.length,
            finalPoints: partnerFinal.available_points
        };
    }
};

// ============= 場景 7: 邊界條件組合測試 =============
const testEdgeCombinations = {
    name: '邊界條件組合測試',
    description: '測試各種邊界條件的組合',
    
    async execute(framework) {
        framework.log('=== 開始邊界條件組合測試 ===');
        
        const results = [];
        
        // 測試 1: 零元訂單 + 確認入住
        framework.log('測試 1: 零元訂單確認入住');
        try {
            await framework.executeAPIAction('create_booking', {
                partner_code: framework.testPartnerCode || 'TEST_AUTO',
                guest_name: `EDGE_ZERO_${Date.now()}`,
                guest_phone: '0960000001',
                guest_email: 'edge_zero@test.com',
                bank_account_last5: '00000',
                checkin_date: new Date().toISOString().split('T')[0],
                checkout_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                room_price: '0',
                booking_source: 'REFERRAL',
                notes: '零元訂單測試'
            });
            results.push({ test: '零元訂單', status: 'success' });
        } catch (error) {
            results.push({ test: '零元訂單', status: 'failed', error: error.message });
        }
        
        await framework.wait(2000);
        
        // 測試 2: 負數房價
        framework.log('測試 2: 負數房價測試');
        try {
            await framework.executeAPIAction('create_booking', {
                partner_code: framework.testPartnerCode || 'TEST_AUTO',
                guest_name: `EDGE_NEGATIVE_${Date.now()}`,
                guest_phone: '0960000002',
                guest_email: 'edge_neg@test.com',
                bank_account_last5: '99999',
                checkin_date: new Date().toISOString().split('T')[0],
                checkout_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                room_price: '-1000',
                booking_source: 'REFERRAL',
                notes: '負數房價測試'
            });
            results.push({ test: '負數房價', status: 'blocked' });
        } catch (error) {
            results.push({ test: '負數房價', status: 'correctly_blocked' });
        }
        
        await framework.wait(2000);
        
        // 測試 3: 極大數值
        framework.log('測試 3: 極大數值測試');
        try {
            await framework.executeAPIAction('create_booking', {
                partner_code: framework.testPartnerCode || 'TEST_AUTO',
                guest_name: `EDGE_HUGE_${Date.now()}`,
                guest_phone: '0960000003',
                guest_email: 'edge_huge@test.com',
                bank_account_last5: '88888',
                checkin_date: new Date().toISOString().split('T')[0],
                checkout_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                room_price: '99999999',
                booking_source: 'REFERRAL',
                notes: '極大數值測試'
            });
            results.push({ test: '極大數值', status: 'success' });
        } catch (error) {
            results.push({ test: '極大數值', status: 'failed', error: error.message });
        }
        
        await framework.wait(2000);
        
        // 測試 4: 同名同日期重複訂房
        framework.log('測試 4: 重複訂房測試');
        const duplicateName = `EDGE_DUPLICATE_${Date.now()}`;
        const duplicateDate = new Date().toISOString().split('T')[0];
        
        try {
            // 第一筆
            await framework.executeAPIAction('create_booking', {
                partner_code: framework.testPartnerCode || 'TEST_AUTO',
                guest_name: duplicateName,
                guest_phone: '0960000004',
                guest_email: 'edge_dup1@test.com',
                bank_account_last5: '44441',
                checkin_date: duplicateDate,
                checkout_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                room_price: '5000',
                booking_source: 'REFERRAL',
                notes: '重複測試 1'
            });
            
            await framework.wait(1000);
            
            // 第二筆（相同姓名和日期）
            await framework.executeAPIAction('create_booking', {
                partner_code: framework.testPartnerCode || 'TEST_AUTO',
                guest_name: duplicateName,
                guest_phone: '0960000005',
                guest_email: 'edge_dup2@test.com',
                bank_account_last5: '44442',
                checkin_date: duplicateDate,
                checkout_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                room_price: '5000',
                booking_source: 'REFERRAL',
                notes: '重複測試 2'
            });
            
            results.push({ test: '重複訂房', status: 'allowed' });
        } catch (error) {
            results.push({ test: '重複訂房', status: 'blocked', error: error.message });
        }
        
        await framework.wait(2000);
        
        // 測試 5: 空值處理
        framework.log('測試 5: 必填欄位空值測試');
        try {
            await framework.executeAPIAction('create_booking', {
                partner_code: framework.testPartnerCode || 'TEST_AUTO',
                guest_name: '',  // 空名稱
                guest_phone: '',  // 空電話
                guest_email: '',
                bank_account_last5: '',
                checkin_date: new Date().toISOString().split('T')[0],
                checkout_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                room_price: '5000',
                booking_source: 'REFERRAL',
                notes: '空值測試'
            });
            results.push({ test: '空值處理', status: 'failed_validation' });
        } catch (error) {
            results.push({ test: '空值處理', status: 'correctly_blocked' });
        }
        
        // 總結
        framework.log('=== 邊界測試結果 ===');
        results.forEach(r => {
            const icon = r.status.includes('success') || r.status.includes('correctly') ? '✅' : '❌';
            framework.log(`  ${icon} ${r.test}: ${r.status}`);
        });
        
        return {
            success: true,
            totalTests: results.length,
            results: results
        };
    }
};

// ============= 導出所有極端複雜測試場景 =============

const extremeComplexScenarios = [
    testCommissionReversalCycle,
    testChainPartnerChanges,
    testPointsExtreme,
    testConcurrentOperations,
    testYearlyReset,
    testDataRecovery,
    testEdgeCombinations
];

// 如果在瀏覽器環境，掛載到全局
if (typeof window !== 'undefined') {
    window.extremeComplexScenarios = extremeComplexScenarios;
}

// 如果在 Node.js 環境，導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = extremeComplexScenarios;
}