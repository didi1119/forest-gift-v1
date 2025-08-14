// 結算管理相關函數

// 創建結算詳情模態框
function createPayoutDetailsModal(payout) {
    // 查找相關的訂房記錄
    const relatedBookings = [];
    if (payout.related_booking_ids) {
        const bookingIds = payout.related_booking_ids.toString().split(',');
        bookingIds.forEach(id => {
            const booking = allData.bookings.find(b => b.id == id.trim());
            if (booking) {
                relatedBookings.push(booking);
            }
        });
    }
    
    const modal = document.createElement('div');
    modal.id = 'payoutDetailsModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-start mb-6">
                <h3 class="text-2xl font-bold">💰 結算詳情</h3>
                <button onclick="closeModal('payoutDetailsModal')" class="text-gray-500 hover:text-gray-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            
            <!-- 基本信息 -->
            <div class="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 class="font-bold mb-3">📋 基本信息</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span class="text-gray-600">結算ID：</span>
                        <span class="font-medium">${payout.id || 'N/A'}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">大使代碼：</span>
                        <span class="font-medium">${payout.partner_code}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">結算類型：</span>
                        <span class="font-medium">${payout.payout_type === 'CASH' ? '現金' : '住宿金'}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">結算金額：</span>
                        <span class="font-bold text-green-600">$${(payout.amount || 0).toLocaleString()}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">付款狀態：</span>
                        <span class="px-2 py-1 rounded text-xs ${payout.payout_status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                            ${payout.payout_status === 'COMPLETED' ? '已付款' : '待付款'}
                        </span>
                    </div>
                    <div>
                        <span class="text-gray-600">付款方式：</span>
                        <span class="font-medium">${getPaymentMethodText(payout.payout_method)}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">建立時間：</span>
                        <span class="font-medium">${formatDateDisplay(payout.created_at)}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">處理人：</span>
                        <span class="font-medium">${payout.created_by || 'system'}</span>
                    </div>
                </div>
                ${payout.notes ? `
                <div class="mt-4">
                    <span class="text-gray-600">備註：</span>
                    <p class="mt-1 text-sm bg-white p-2 rounded border">${payout.notes}</p>
                </div>
                ` : ''}
            </div>
            
            <!-- 相關訂房 -->
            ${relatedBookings.length > 0 ? `
            <div class="mb-6">
                <h4 class="font-bold mb-3">🏨 相關訂房記錄</h4>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm border">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="text-left py-2 px-3 border">訂房ID</th>
                                <th class="text-left py-2 px-3 border">房客姓名</th>
                                <th class="text-left py-2 px-3 border">入住日期</th>
                                <th class="text-center py-2 px-3 border">房價</th>
                                <th class="text-center py-2 px-3 border">佣金</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${relatedBookings.map(booking => `
                                <tr class="border-b hover:bg-gray-50">
                                    <td class="py-2 px-3 border font-medium">#${booking.id}</td>
                                    <td class="py-2 px-3 border">${booking.guest_name}</td>
                                    <td class="py-2 px-3 border">${formatDateDisplay(booking.checkin_date)}</td>
                                    <td class="py-2 px-3 border text-center">$${(booking.room_price || 0).toLocaleString()}</td>
                                    <td class="py-2 px-3 border text-center font-medium text-green-600">$${(booking.commission_amount || 0).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}
            
            <!-- 操作按鈕 -->
            <div class="flex justify-end space-x-3 pt-4 border-t">
                ${payout.payout_status !== 'COMPLETED' ? `
                    <button type="button" onclick="editPayout('${payout.id}')" 
                        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        ✏️ 修改
                    </button>
                    <button type="button" onclick="cancelPayout('${payout.id}')" 
                        class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                        🚫 取消結算
                    </button>
                ` : ''}
                <button type="button" onclick="closeModal('payoutDetailsModal')" 
                    class="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                    關閉
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 獲取付款方式文字
function getPaymentMethodText(method) {
    const methodMap = {
        'BANK_TRANSFER': '銀行轉帳',
        'ACCOMMODATION_VOUCHER': '住宿金券',
        'CASH': '現金',
        'OTHER': '其他'
    };
    return methodMap[method] || method || '未設定';
}

// 取消結算
async function cancelPayout(payoutId) {
    const payout = allData.payouts.find(p => p.id == payoutId);
    if (!payout) {
        alert('找不到結算記錄');
        return;
    }
    
    const confirmMessage = `⚠️ 確定要取消以下結算嗎？\n\n大使：${payout.partner_code}\n金額：$${(payout.amount || 0).toLocaleString()}\n類型：${payout.payout_type === 'CASH' ? '現金' : '住宿金'}\n\n取消後該筆佣金將重新計算`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        // 使用表單提交方式
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = APPS_SCRIPT_URL;
        form.target = 'hiddenFrame';
        form.style.display = 'none';
        
        const actionInput = document.createElement('input');
        actionInput.type = 'hidden';
        actionInput.name = 'action';
        actionInput.value = 'cancel_payout';
        form.appendChild(actionInput);
        
        const payoutIdInput = document.createElement('input');
        payoutIdInput.type = 'hidden';
        payoutIdInput.name = 'payout_id';
        payoutIdInput.value = payoutId;
        form.appendChild(payoutIdInput);
        
        // 確保隱藏iframe存在
        let hiddenFrame = document.getElementById('hiddenFrame');
        if (!hiddenFrame) {
            hiddenFrame = document.createElement('iframe');
            hiddenFrame.id = 'hiddenFrame';
            hiddenFrame.name = 'hiddenFrame';
            hiddenFrame.style.display = 'none';
            document.body.appendChild(hiddenFrame);
        }
        
        document.body.appendChild(form);
        form.submit();
        
        // 延時回調處理結果
        setTimeout(() => {
            // 立即更新前端數據
            const payoutIndex = allData.payouts.findIndex(p => p.id == payoutId);
            if (payoutIndex !== -1) {
                allData.payouts.splice(payoutIndex, 1);
                console.log('✅ 已從前端移除結算記錄');
            }
            
            showSuccessMessage('✅ 結算已取消！相關佣金將重新計算');
            closeModal('payoutDetailsModal');
            displayPayouts(allData.payouts);
            
            // 立即重新載入所有數據
            loadRealData().then(() => {
                console.log('📊 結算修改後數據重新載入完成');
                displayPayouts(allData.payouts);
                // 同時更新大使列表，因為佣金可能已連動調整
                if (typeof displayPartners === 'function') {
                    displayPartners(allData.partners);
                }
            }).catch(error => {
                console.error('重新載入數據失敗:', error);
            });
            
            document.body.removeChild(form);
        }, 1000);
        
    } catch (error) {
        console.error('取消結算失敗:', error);
        alert('❌ 取消結算失敗：' + error.message);
    }
}

// 修改結算
function editPayout(payoutId) {
    const payout = allData.payouts.find(p => p.id == payoutId);
    if (!payout) {
        alert('找不到結算記錄');
        return;
    }
    
    createEditPayoutModal(payout);
}

// 創建修改結算模態框
function createEditPayoutModal(payout) {
    const modal = document.createElement('div');
    modal.id = 'editPayoutModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div class="flex justify-between items-start mb-6">
                <h3 class="text-xl font-bold">修改結算記錄</h3>
                <button onclick="closeModal('editPayoutModal')" class="text-gray-500 hover:text-gray-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            
            <form id="editPayoutForm" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">大使代碼</label>
                        <input type="text" id="edit_payout_partner_code" value="${payout.partner_code}" 
                            class="w-full p-2 border rounded-md bg-gray-100" readonly>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">結算類型</label>
                        <select id="edit_payout_type" class="w-full p-2 border rounded-md">
                            <option value="CASH" ${payout.payout_type === 'CASH' ? 'selected' : ''}>現金</option>
                            <option value="ACCOMMODATION" ${payout.payout_type === 'ACCOMMODATION' ? 'selected' : ''}>住宿金</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">結算金額</label>
                        <input type="number" id="edit_payout_amount" value="${payout.amount || 0}" 
                            class="w-full p-2 border rounded-md" min="0" step="1" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">付款狀態</label>
                        <select id="edit_payout_status" class="w-full p-2 border rounded-md">
                            <option value="PENDING" ${payout.payout_status === 'PENDING' ? 'selected' : ''}>待付款</option>
                            <option value="COMPLETED" ${payout.payout_status === 'COMPLETED' ? 'selected' : ''}>已付款</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">備註</label>
                    <textarea id="edit_payout_notes" rows="3" class="w-full p-2 border rounded-md"
                        placeholder="修改原因或其他說明...">${payout.notes || ''}</textarea>
                </div>
                
                <div class="flex justify-end space-x-3 pt-4 border-t">
                    <button type="button" onclick="closeModal('editPayoutModal')" 
                        class="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                        取消
                    </button>
                    <button type="button" onclick="savePayoutChanges('${payout.id}')" 
                        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        儲存變更
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 儲存結算變更
async function savePayoutChanges(payoutId) {
    try {
        const formData = {
            action: 'update_payout',
            payout_id: payoutId,
            payout_type: document.getElementById('edit_payout_type').value,
            amount: parseFloat(document.getElementById('edit_payout_amount').value) || 0,
            payout_status: document.getElementById('edit_payout_status').value,
            notes: document.getElementById('edit_payout_notes').value.trim()
        };
        
        // 驗證金額
        if (formData.amount <= 0) {
            alert('請輸入有效的金額！');
            return;
        }
        
        // 使用表單提交方式
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = APPS_SCRIPT_URL;
        form.target = 'hiddenFrame';
        form.style.display = 'none';
        
        Object.keys(formData).forEach(key => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = formData[key];
            form.appendChild(input);
        });
        
        // 確保隱藏iframe存在
        let hiddenFrame = document.getElementById('hiddenFrame');
        if (!hiddenFrame) {
            hiddenFrame = document.createElement('iframe');
            hiddenFrame.id = 'hiddenFrame';
            hiddenFrame.name = 'hiddenFrame';
            hiddenFrame.style.display = 'none';
            document.body.appendChild(hiddenFrame);
        }
        
        document.body.appendChild(form);
        form.submit();
        
        // 延時回調處理結果
        setTimeout(() => {
            // 立即更新前端數據
            const payoutIndex = allData.payouts.findIndex(p => p.id == payoutId);
            if (payoutIndex !== -1) {
                allData.payouts[payoutIndex] = {
                    ...allData.payouts[payoutIndex],
                    payout_type: formData.payout_type,
                    amount: formData.amount,
                    payout_status: formData.payout_status,
                    notes: formData.notes,
                    updated_at: new Date().toISOString()
                };
                console.log('✅ 已更新前端結算數據');
            }
            
            showSuccessMessage('✅ 結算記錄修改成功！');
            closeModal('editPayoutModal');
            closeModal('payoutDetailsModal');
            displayPayouts(allData.payouts);
            
            // 立即重新載入所有數據
            loadRealData().then(() => {
                console.log('📊 結算修改後數據重新載入完成');
                displayPayouts(allData.payouts);
                // 同時更新大使列表，因為佣金可能已連動調整
                if (typeof displayPartners === 'function') {
                    displayPartners(allData.partners);
                }
            }).catch(error => {
                console.error('重新載入數據失敗:', error);
            });
            
            document.body.removeChild(form);
        }, 1000);
        
    } catch (error) {
        console.error('修改結算失敗:', error);
        alert('❌ 修改結算失敗：' + error.message);
    }
}

// 創建結算報表模態框
function createPayoutReportModal() {
    const modal = document.createElement('div');
    modal.id = 'payoutReportModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    // 計算報表數據
    const totalPayouts = allData.payouts.length;
    const completedPayouts = allData.payouts.filter(p => p.payout_status === 'COMPLETED').length;
    const pendingPayouts = totalPayouts - completedPayouts;
    const totalAmount = allData.payouts.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const completedAmount = allData.payouts.filter(p => p.payout_status === 'COMPLETED')
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const pendingAmount = totalAmount - completedAmount;
    
    // 按大使分組統計
    const partnerStats = {};
    allData.payouts.forEach(payout => {
        if (!partnerStats[payout.partner_code]) {
            partnerStats[payout.partner_code] = {
                partner_code: payout.partner_code,
                total_amount: 0,
                completed_amount: 0,
                pending_amount: 0,
                count: 0
            };
        }
        const amount = parseFloat(payout.amount) || 0;
        partnerStats[payout.partner_code].total_amount += amount;
        partnerStats[payout.partner_code].count += 1;
        
        if (payout.payout_status === 'COMPLETED') {
            partnerStats[payout.partner_code].completed_amount += amount;
        } else {
            partnerStats[payout.partner_code].pending_amount += amount;
        }
    });
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-start mb-6">
                <h3 class="text-2xl font-bold">📊 結算報表</h3>
                <button onclick="closeModal('payoutReportModal')" class="text-gray-500 hover:text-gray-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            
            <!-- 總覽統計 -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-blue-50 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-blue-600">${totalPayouts}</div>
                    <div class="text-sm text-gray-600">總結算筆數</div>
                </div>
                <div class="bg-green-50 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-green-600">${completedPayouts}</div>
                    <div class="text-sm text-gray-600">已完成</div>
                </div>
                <div class="bg-yellow-50 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-yellow-600">${pendingPayouts}</div>
                    <div class="text-sm text-gray-600">待付款</div>
                </div>
                <div class="bg-purple-50 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-purple-600">$${totalAmount.toLocaleString()}</div>
                    <div class="text-sm text-gray-600">總金額</div>
                </div>
            </div>
            
            <!-- 金額統計 -->
            <div class="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 class="font-bold mb-2">💰 金額統計</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span class="text-gray-600">已付款金額：</span>
                        <span class="font-bold text-green-600">$${completedAmount.toLocaleString()}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">待付款金額：</span>
                        <span class="font-bold text-yellow-600">$${pendingAmount.toLocaleString()}</span>
                    </div>
                </div>
            </div>
            
            <!-- 大使別統計 -->
            <div class="mb-6">
                <h4 class="font-bold mb-3">👥 大使別統計</h4>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm border">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="text-left py-2 px-3 border">大使代碼</th>
                                <th class="text-center py-2 px-3 border">筆數</th>
                                <th class="text-center py-2 px-3 border">總金額</th>
                                <th class="text-center py-2 px-3 border">已付款</th>
                                <th class="text-center py-2 px-3 border">待付款</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.values(partnerStats).map(stat => `
                                <tr class="border-b hover:bg-gray-50">
                                    <td class="py-2 px-3 border font-medium">${stat.partner_code}</td>
                                    <td class="py-2 px-3 border text-center">${stat.count}</td>
                                    <td class="py-2 px-3 border text-center font-medium">$${stat.total_amount.toLocaleString()}</td>
                                    <td class="py-2 px-3 border text-center text-green-600">$${stat.completed_amount.toLocaleString()}</td>
                                    <td class="py-2 px-3 border text-center text-yellow-600">$${stat.pending_amount.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- 操作按鈕 -->
            <div class="flex justify-end space-x-3 pt-4 border-t">
                <button type="button" onclick="exportPayoutReport()" 
                    class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    📄 匯出報表
                </button>
                <button type="button" onclick="closeModal('payoutReportModal')" 
                    class="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                    關閉
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 匯出結算報表
function exportPayoutReport() {
    // 準備CSV數據
    const headers = ['大使代碼', '結算類型', '金額', '狀態', '建立時間', '備註'];
    const csvData = [
        headers.join(','),
        ...allData.payouts.map(payout => [
            payout.partner_code,
            payout.payout_type === 'CASH' ? '現金' : '住宿金',
            payout.amount || 0,
            payout.payout_status === 'COMPLETED' ? '已付款' : '待付款',
            formatDateDisplay(payout.created_at) || '',
            (payout.notes || '').replace(/,/g, '；') // 替換逗號避免CSV格式問題
        ].join(','))
    ].join('\n');
    
    // 下載CSV文件
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `結算報表_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showSuccessMessage('✅ 結算報表已匯出！');
}

// 格式化日期顯示
function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.getFullYear() + '-' + 
           String(date.getMonth() + 1).padStart(2, '0') + '-' + 
           String(date.getDate()).padStart(2, '0');
}