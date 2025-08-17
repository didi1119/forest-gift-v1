// 佣金管理增強功能

// 快速編輯佣金
function quickEditCommission(partnerCode) {
    const partner = allData.partners.find(p => p.partner_code === partnerCode);
    if (!partner) {
        showErrorMessage('找不到夥伴資料');
        return;
    }
    
    createQuickCommissionEditModal(partner);
}

// 創建快速佣金編輯模態框
function createQuickCommissionEditModal(partner) {
    const modal = document.createElement('div');
    modal.id = 'quickCommissionEditModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    const currentEarned = parseFloat(partner.total_commission_earned) || 0;
    const currentPending = parseFloat(partner.pending_commission) || 0;
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div class="flex justify-between items-start mb-6">
                <h3 class="text-xl font-bold">💰 快速編輯佣金 - ${partner.partner_code}</h3>
                <button onclick="closeModal('quickCommissionEditModal')" class="text-gray-500 hover:text-gray-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            
            <!-- 當前狀態 -->
            <div class="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 class="font-bold mb-2">📊 當前狀態</h4>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span class="text-gray-600">累積佣金：</span>
                        <span class="font-bold text-green-600">$${currentEarned.toLocaleString()}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">待支付佣金：</span>
                        <span class="font-bold text-amber-600">$${currentPending.toLocaleString()}</span>
                    </div>
                </div>
            </div>
            
            <!-- 編輯表單 -->
            <form id="quickCommissionEditForm" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">累積佣金總額</label>
                        <input type="number" id="edit_total_earned" value="${currentEarned}" 
                            class="w-full p-2 border rounded-md" min="0" step="1">
                        <div class="text-xs text-gray-500 mt-1">大使歷史總收益</div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">待支付佣金</label>
                        <input type="number" id="edit_pending_commission" value="${currentPending}" 
                            class="w-full p-2 border rounded-md" min="0" step="1">
                        <div class="text-xs text-gray-500 mt-1">尚未結算的佣金</div>
                    </div>
                </div>
                
                <!-- 快速操作 -->
                <div class="bg-blue-50 p-4 rounded-lg">
                    <h4 class="font-bold mb-2">⚡ 快速操作</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <button type="button" onclick="adjustCommission(500)" 
                            class="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">
                            +$500
                        </button>
                        <button type="button" onclick="adjustCommission(1000)" 
                            class="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">
                            +$1000
                        </button>
                        <button type="button" onclick="adjustCommission(-500)" 
                            class="px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">
                            -$500
                        </button>
                        <button type="button" onclick="clearPendingCommission()" 
                            class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-xs hover:bg-yellow-200">
                            清空待付
                        </button>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">調整原因</label>
                    <textarea id="edit_commission_reason" rows="2" class="w-full p-2 border rounded-md"
                        placeholder="請說明調整佣金的原因..."></textarea>
                </div>
                
                <div class="flex justify-end space-x-3 pt-4 border-t">
                    <button type="button" onclick="closeModal('quickCommissionEditModal')" 
                        class="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                        取消
                    </button>
                    <button type="button" onclick="saveCommissionChanges('${partner.partner_code}')" 
                        class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        💾 儲存變更
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 快速調整佣金金額
function adjustCommission(amount) {
    const pendingInput = document.getElementById('edit_pending_commission');
    const currentValue = parseFloat(pendingInput.value) || 0;
    const newValue = Math.max(0, currentValue + amount);
    pendingInput.value = newValue;
}

// 清空待支付佣金
function clearPendingCommission() {
    document.getElementById('edit_pending_commission').value = 0;
}

// 儲存佣金變更
async function saveCommissionChanges(partnerCode) {
    try {
        const formData = {
            action: 'update_partner_commission',
            partner_code: partnerCode,
            total_commission_earned: parseFloat(document.getElementById('edit_total_earned').value) || 0,
            pending_commission: parseFloat(document.getElementById('edit_pending_commission').value) || 0,
            adjustment_reason: document.getElementById('edit_commission_reason').value.trim()
        };
        
        // 使用 fetch 提交方式，確保按照標準欄位順序發送數據
        const params = new URLSearchParams();
        
        // 首先添加 action
        params.append('action', formData.action);
        
        // 添加其他參數（佣金管理相關）
        Object.keys(formData).forEach(key => {
            if (key !== 'action') {
                params.append(key, formData[key] || '');
            }
        });
        
        console.log('📤 佣金管理 - 發送數據:', formData);
        
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });
        
        console.log('📡 佣金管理 - 收到回應:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }
        
        const result = await response.text();
        console.log('📥 佣金管理 - 後端回應:', result);
        
        // 延時處理結果
        setTimeout(() => {
                // 立即更新前端數據
                const partnerIndex = allData.partners.findIndex(p => p.partner_code === partnerCode);
                if (partnerIndex !== -1) {
                    allData.partners[partnerIndex].total_commission_earned = formData.total_commission_earned;
                    allData.partners[partnerIndex].pending_commission = formData.pending_commission;
                    allData.partners[partnerIndex].updated_at = new Date().toISOString();
                }
                
                showSuccessMessage('✅ 佣金資料已更新！結算記錄已創建！');
                closeModal('quickCommissionEditModal');
                displayPartners(allData.partners);
                
                // 立即重新載入所有數據，包括 payouts
                loadRealData().then(() => {
                    console.log('📊 數據重新載入完成，Payouts 記錄數：', allData.payouts.length);
                    displayPartners(allData.partners);
                    // 如果當前在結算管理頁面，也重新顯示 payouts
                    if (typeof displayPayouts === 'function') {
                        displayPayouts(allData.payouts);
                    }
                }).catch(error => {
                    console.error('重新載入數據失敗:', error);
                });
            }, 1500);
        
    } catch (error) {
        console.error('更新佣金失敗:', error);
        showErrorMessage('❌ 更新失敗：' + error.message);
    }
}

// 創建大使結算
function createPartnerPayout(partnerCode) {
    const partner = allData.partners.find(p => p.partner_code === partnerCode);
    if (!partner) {
        showErrorMessage('找不到夥伴資料');
        return;
    }
    
    if (!partner.pending_commission || partner.pending_commission <= 0) {
        showErrorMessage('該大使目前沒有待支付的佣金');
        return;
    }
    
    createMixedPayoutModal(partner);
}

// 創建混合結算模態框（現金+住宿金）
function createMixedPayoutModal(partner) {
    const modal = document.createElement('div');
    modal.id = 'mixedPayoutModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    const pendingAmount = parseFloat(partner.pending_commission) || 0;
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div class="flex justify-between items-start mb-6">
                <h3 class="text-xl font-bold">💳 創建結算 - ${partner.partner_code}</h3>
                <button onclick="closeModal('mixedPayoutModal')" class="text-gray-500 hover:text-gray-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            
            <!-- 待支付金額 -->
            <div class="bg-amber-50 p-4 rounded-lg mb-6">
                <h4 class="font-bold mb-2">💰 待支付金額</h4>
                <div class="text-2xl font-bold text-amber-600">$${pendingAmount.toLocaleString()}</div>
                <div class="text-sm text-gray-600">大使偏好：${partner.commission_preference === 'CASH' ? '現金' : '住宿金'}</div>
            </div>
            
            <!-- 結算分配 -->
            <form id="mixedPayoutForm" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">💵 現金金額</label>
                        <input type="number" id="cash_amount" value="0" 
                            class="w-full p-2 border rounded-md" min="0" max="${pendingAmount}" step="1"
                            onchange="updateAccommodationAmount()">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">🏨 住宿金金額</label>
                        <input type="number" id="accommodation_amount" value="${pendingAmount}" 
                            class="w-full p-2 border rounded-md" min="0" max="${pendingAmount}" step="1"
                            onchange="updateCashAmount()">
                    </div>
                </div>
                
                <div class="text-center text-sm text-gray-600">
                    <span id="total_display">總計：$${pendingAmount.toLocaleString()}</span>
                </div>
                
                <!-- 快速分配按鈕 -->
                <div class="bg-blue-50 p-4 rounded-lg">
                    <h4 class="font-bold mb-2">⚡ 快速分配</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <button type="button" onclick="setPayoutSplit(${pendingAmount}, 0)" 
                            class="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">
                            全部現金
                        </button>
                        <button type="button" onclick="setPayoutSplit(0, ${pendingAmount})" 
                            class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                            全部住宿金
                        </button>
                        <button type="button" onclick="setPayoutSplit(${Math.floor(pendingAmount/2)}, ${Math.ceil(pendingAmount/2)})" 
                            class="px-3 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200">
                            對半分
                        </button>
                        <button type="button" onclick="setPreferredSplit()" 
                            class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-xs hover:bg-yellow-200">
                            按偏好
                        </button>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">備註</label>
                    <textarea id="payout_notes" rows="2" class="w-full p-2 border rounded-md"
                        placeholder="結算說明..."></textarea>
                </div>
                
                <div class="flex justify-end space-x-3 pt-4 border-t">
                    <button type="button" onclick="closeModal('mixedPayoutModal')" 
                        class="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                        取消
                    </button>
                    <button type="button" onclick="submitMixedPayout('${partner.partner_code}')" 
                        class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        💳 創建結算
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 更新住宿金額度
function updateAccommodationAmount() {
    const cashAmount = parseFloat(document.getElementById('cash_amount').value) || 0;
    const pendingAmount = parseFloat(document.getElementById('accommodation_amount').getAttribute('max'));
    const accommodationAmount = Math.max(0, pendingAmount - cashAmount);
    document.getElementById('accommodation_amount').value = accommodationAmount;
    updateTotalDisplay();
}

// 更新現金額度
function updateCashAmount() {
    const accommodationAmount = parseFloat(document.getElementById('accommodation_amount').value) || 0;
    const pendingAmount = parseFloat(document.getElementById('cash_amount').getAttribute('max'));
    const cashAmount = Math.max(0, pendingAmount - accommodationAmount);
    document.getElementById('cash_amount').value = cashAmount;
    updateTotalDisplay();
}

// 更新總計顯示
function updateTotalDisplay() {
    const cashAmount = parseFloat(document.getElementById('cash_amount').value) || 0;
    const accommodationAmount = parseFloat(document.getElementById('accommodation_amount').value) || 0;
    const total = cashAmount + accommodationAmount;
    document.getElementById('total_display').textContent = `總計：$${total.toLocaleString()}`;
}

// 設定結算分配
function setPayoutSplit(cashAmount, accommodationAmount) {
    document.getElementById('cash_amount').value = cashAmount;
    document.getElementById('accommodation_amount').value = accommodationAmount;
    updateTotalDisplay();
}

// 按偏好分配
function setPreferredSplit() {
    const partner = allData.partners.find(p => p.partner_code === document.querySelector('#mixedPayoutModal h3').textContent.split(' - ')[1]);
    const pendingAmount = parseFloat(document.getElementById('cash_amount').getAttribute('max'));
    
    if (partner && partner.commission_preference === 'CASH') {
        setPayoutSplit(pendingAmount, 0);
    } else {
        setPayoutSplit(0, pendingAmount);
    }
}

// 提交混合結算
async function submitMixedPayout(partnerCode) {
    try {
        const cashAmount = parseFloat(document.getElementById('cash_amount').value) || 0;
        const accommodationAmount = parseFloat(document.getElementById('accommodation_amount').value) || 0;
        const notes = document.getElementById('payout_notes').value.trim();
        
        if (cashAmount <= 0 && accommodationAmount <= 0) {
            showErrorMessage('請設定結算金額');
            return;
        }
        
        // 如果有現金部分，創建現金結算
        if (cashAmount > 0) {
            await createSinglePayout(partnerCode, 'CASH', cashAmount, notes + ' (現金部分)');
        }
        
        // 如果有住宿金部分，創建住宿金結算
        if (accommodationAmount > 0) {
            await createSinglePayout(partnerCode, 'ACCOMMODATION', accommodationAmount, notes + ' (住宿金部分)');
        }
        
        showSuccessMessage('✅ 混合結算已創建！');
        closeModal('mixedPayoutModal');
        
        // 重新載入數據
        setTimeout(() => {
            loadRealData().then(() => {
                displayPartners(allData.partners);
                if (document.querySelector('.tab-button.active').textContent.includes('結算')) {
                    displayPayouts(allData.payouts);
                }
            });
        }, 1000);
        
    } catch (error) {
        console.error('創建混合結算失敗:', error);
        showErrorMessage('❌ 創建結算失敗：' + error.message);
    }
}

// 創建單一類型結算
async function createSinglePayout(partnerCode, payoutType, amount, notes) {
    try {
        const formData = {
            action: 'create_payout',
            partner_code: partnerCode,
            payout_type: payoutType,
            amount: amount,
            notes: notes
        };
        
        // 使用 fetch 方式，確保按照標準順序發送數據
        const params = new URLSearchParams();
        
        // 首先添加 action
        params.append('action', formData.action);
        
        // 添加其他參數
        Object.keys(formData).forEach(key => {
            if (key !== 'action') {
                params.append(key, formData[key] || '');
            }
        });
        
        console.log('📤 創建結算 - 發送數據:', formData);
        
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });
        
        console.log('📡 創建結算 - 收到回應:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }
        
        const result = await response.text();
        console.log('📥 創建結算 - 後端回應:', result);
        
        return result;
        
    } catch (error) {
        throw error;
    }
}

// 住宿金點數管理
function manageAccommodationPoints(partnerCode) {
    const partner = allData.partners.find(p => p.partner_code === partnerCode);
    if (!partner) {
        showErrorMessage('找不到夥伴資料');
        return;
    }
    
    createAccommodationPointsModal(partner);
}

// 創建住宿金點數管理模態框
function createAccommodationPointsModal(partner) {
    // 使用現有欄位：住宿金 = total_commission_earned, 已使用 = total_commission_paid
    const availablePoints = partner.total_commission_earned || 0;
    const usedPoints = partner.total_commission_paid || 0;
    const totalPoints = availablePoints + usedPoints;
    
    const modal = document.createElement('div');
    modal.id = 'accommodationPointsModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div class="flex justify-between items-start mb-6">
                <h3 class="text-xl font-bold">🏨 住宿金點數管理 - ${partner.partner_code}</h3>
                <button onclick="closeModal('accommodationPointsModal')" class="text-gray-500 hover:text-gray-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            
            <!-- 點數概覽 -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-blue-50 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-blue-600">${totalPoints.toLocaleString()}</div>
                    <div class="text-sm text-gray-600">總獲得點數</div>
                </div>
                <div class="bg-red-50 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-red-600">${usedPoints.toLocaleString()}</div>
                    <div class="text-sm text-gray-600">已使用點數</div>
                </div>
                <div class="bg-green-50 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-green-600">${availablePoints.toLocaleString()}</div>
                    <div class="text-sm text-gray-600">可用點數</div>
                </div>
            </div>
            
            <!-- 點數抵扣 -->
            <div class="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 class="font-bold mb-3">💳 點數抵扣</h4>
                <form id="pointsDeductionForm" class="space-y-3">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">抵扣金額</label>
                            <input type="number" id="deduct_amount" 
                                class="w-full p-2 border rounded-md" min="1" max="${availablePoints}" step="1"
                                placeholder="輸入要抵扣的點數">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">訂房記錄ID (選填)</label>
                            <input type="text" id="related_booking_id" 
                                class="w-full p-2 border rounded-md" placeholder="相關訂房ID">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">抵扣說明</label>
                        <textarea id="deduction_notes" rows="2" class="w-full p-2 border rounded-md"
                            placeholder="說明此次抵扣的用途..."></textarea>
                    </div>
                    
                    <!-- 快速金額按鈕 -->
                    <div class="flex flex-wrap gap-2">
                        <button type="button" onclick="setDeductAmount(1000)" 
                            class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                            $1000
                        </button>
                        <button type="button" onclick="setDeductAmount(2000)" 
                            class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                            $2000
                        </button>
                        <button type="button" onclick="setDeductAmount(5000)" 
                            class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                            $5000
                        </button>
                        <button type="button" onclick="setDeductAmount(${availablePoints})" 
                            class="px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">
                            全部抵扣
                        </button>
                    </div>
                </form>
            </div>
            
            <!-- 使用記錄 -->
            <div class="mb-6">
                <h4 class="font-bold mb-3">📋 最近使用記錄</h4>
                <div class="max-h-40 overflow-y-auto border rounded">
                    <div class="p-3 text-center text-gray-500 text-sm">
                        尚未有使用記錄
                    </div>
                </div>
            </div>
            
            <div class="flex justify-end space-x-3 pt-4 border-t">
                <button type="button" onclick="closeModal('accommodationPointsModal')" 
                    class="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                    關閉
                </button>
                <button type="button" onclick="processPointsDeduction('${partner.partner_code}')" 
                    class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                    💳 執行抵扣
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 設定抵扣金額
function setDeductAmount(amount) {
    document.getElementById('deduct_amount').value = amount;
}

// 處理點數抵扣
async function processPointsDeduction(partnerCode) {
    try {
        const deductAmount = parseFloat(document.getElementById('deduct_amount').value) || 0;
        const relatedBookingId = document.getElementById('related_booking_id').value.trim();
        const notes = document.getElementById('deduction_notes').value.trim();
        
        if (deductAmount <= 0) {
            showErrorMessage('請輸入有效的抵扣金額');
            return;
        }
        
        if (!notes) {
            showErrorMessage('請填寫抵扣說明');
            return;
        }
        
        const formData = {
            action: 'deduct_accommodation_points',
            partner_code: partnerCode,
            deduct_amount: deductAmount,
            related_booking_id: relatedBookingId,
            notes: notes
        };
        
        // 使用 fetch 方式，確保按照標準順序發送數據
        const params = new URLSearchParams();
        
        // 首先添加 action
        params.append('action', formData.action);
        
        // 添加其他參數
        Object.keys(formData).forEach(key => {
            if (key !== 'action') {
                params.append(key, formData[key] || '');
            }
        });
        
        console.log('📤 點數抵扣 - 發送數據:', formData);
        
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });
        
        console.log('📡 點數抵扣 - 收到回應:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }
        
        const result = await response.text();
        console.log('📥 點數抵扣 - 後端回應:', result);
        
        setTimeout(() => {
            // 立即更新前端數據
            const partnerIndex = allData.partners.findIndex(p => p.partner_code === partnerCode);
            if (partnerIndex !== -1) {
                const partner = allData.partners[partnerIndex];
                // 扣除住宿金：減少 total_commission_earned，增加 total_commission_paid
                const currentPoints = partner.total_commission_earned || 0;
                partner.total_commission_earned = Math.max(0, currentPoints - deductAmount);
                partner.total_commission_paid = (partner.total_commission_paid || 0) + deductAmount;
                
                console.log(`✅ 已扣除 ${partnerCode} 的 ${deductAmount} 點數`);
                console.log(`剩餘可用點數: ${partner.total_commission_earned}`);
            }
            
            showSuccessMessage(`✅ 成功抵扣 ${deductAmount.toLocaleString()} 住宿金點數！`);
            closeModal('accommodationPointsModal');
            
            // 重新顯示夥伴列表以反映更新
            if (typeof displayPartners === 'function') {
                displayPartners(allData.partners);
            }
            
            // 背景重新載入數據確保一致性
            setTimeout(() => {
                loadRealData().catch(error => {
                    console.log('⚠️ 背景數據重載失敗（不影響操作）:', error.message);
                });
            }, 2000);
        }, 1000);
        
    } catch (error) {
        console.error('點數抵扣失敗:', error);
        showErrorMessage('❌ 抵扣失敗：' + error.message);
    }
}