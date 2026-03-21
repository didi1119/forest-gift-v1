// 結算管理相關函數

async function parsePayoutJsonResponse(response, context) {
    const responseText = await response.text();
    let result;

    try {
        result = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
        throw new Error(`${context} 回應格式錯誤：${parseError.message}`);
    }

    if (!response.ok || result.success === false) {
        throw new Error(result.error || result.message || `${context} 失敗 (HTTP ${response.status})`);
    }

    return result;
}

async function refreshPayoutDataView() {
    if (typeof forceReloadCurrentData === 'function') {
        await forceReloadCurrentData();
        return;
    }

    if (typeof loadRealData === 'function') {
        await loadRealData(true);
    }

    if (typeof updateCurrentTabDisplay === 'function') {
        updateCurrentTabDisplay();
    }
}

function getPayoutTypeLabel(type) {
    if (typeof getPayoutTypeText === 'function') {
        return getPayoutTypeText(type);
    }

    const labels = {
        'ACCOMMODATION': '住宿金佣金',
        'CASH': '現金佣金',
        'CASH_CONVERSION': '點數轉現金',
        'PAYMENT_COMPLETED': '支付完成',
        'COMMISSION_REVERSAL': '佣金撤銷',
        'LEVEL_ADJUSTMENT': '等級調整',
        'POINTS_ADJUSTMENT': '點數調整',
        'POINTS_REFUND': '點數退還'
    };
    return labels[type] || type || '其他';
}

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
                <h3 class="text-2xl font-bold">結算詳情</h3>
                <button onclick="closeModal('payoutDetailsModal')" class="text-gray-500 hover:text-gray-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            
            <!-- 基本信息 -->
            <div class="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 class="font-bold mb-3">基本信息</h4>
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
                        <span class="font-medium">${getPayoutTypeLabel(payout.payout_type)}</span>
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
                <h4 class="font-bold mb-3">相關訂房記錄</h4>
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
                        class="ob-btn ob-btn-secondary">
                        修改
                    </button>
                    <button type="button" onclick="cancelPayout('${payout.id}')"
                        class="ob-btn ob-btn-danger">
                        取消結算
                    </button>
                ` : ''}
                <button type="button" onclick="closeModal('payoutDetailsModal')"
                    class="ob-btn ob-btn-ghost">
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
    console.log('嘗試取消結算 ID:', payoutId);

    // 同時檢查 id 和 ID 欄位（Google Sheets 可能用大寫）
    let payout = allData.payouts.find(p =>
        p.id == payoutId || String(p.id) === String(payoutId)
    );

    // 如果找不到，嘗試用索引
    if (!payout) {
        const payoutIndex = parseInt(payoutId);
        if (!isNaN(payoutIndex) && payoutIndex >= 0 && payoutIndex < allData.payouts.length) {
            payout = allData.payouts[payoutIndex];
        }
    }

    // 調試輸出
    if (!payout) {
        console.error('找不到 payout，所有 payouts:', allData.payouts.map(p => ({
            id: p.id,
            partner_code: p.partner_code
        })));
    }

    if (!payout) {
        console.error('找不到結算記錄，ID:', payoutId);
        alert('找不到結算記錄。請重新載入數據後再試。');
        return;
    }

    const confirmMessage = `大使：${payout.partner_code}\n金額：$${(payout.amount || 0).toLocaleString()}\n類型：${getPayoutTypeLabel(payout.payout_type)}\n\n取消後該筆佣金將重新計算`;

    showConfirmModal('取消結算', confirmMessage, async () => {
        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel_payout', payout_id: payoutId })
            });

            const result = await parsePayoutJsonResponse(response, '取消結算');
            console.log('取消結算回應:', result);
            await refreshPayoutDataView();

            showSuccessMessage('結算已取消！相關訂單狀態已重置');
            closeModal('payoutDetailsModal');
            console.log('結算取消完成，已重新載入最新數據');

        } catch (error) {
            console.error('取消結算失敗:', error);
            showErrorMessage('取消結算失敗：' + error.message);
        }
    }, { danger: true });
}

// 修改結算
function editPayout(payoutId) {
    console.log('嘗試編輯結算 ID:', payoutId);

    // 同時檢查 id 和 ID 欄位（Google Sheets 可能用大寫）
    let payout = allData.payouts.find(p =>
        p.id == payoutId || String(p.id) === String(payoutId)
    );

    // 如果找不到，嘗試用索引
    if (!payout) {
        const payoutIndex = parseInt(payoutId);
        if (!isNaN(payoutIndex) && payoutIndex >= 0 && payoutIndex < allData.payouts.length) {
            payout = allData.payouts[payoutIndex];
        }
    }

    // 調試輸出
    if (!payout) {
        console.error('找不到 payout，所有 payouts:', allData.payouts.map(p => ({
            id: p.id,
            partner_code: p.partner_code
        })));
    }

    if (!payout) {
        console.error('找不到結算記錄，ID:', payoutId);
        alert('找不到結算記錄。請重新載入數據後再試。');
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
            
            <!-- 不可修改的提示 -->
            <div class="border border-stone-200 rounded-xl p-4 mb-4">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm text-stone-600">
                            基於財務安全，<strong>金額、類型、大使代碼</strong>不可修改。<br>
                            如需變更這些欄位，請先取消此結算，然後創建新的結算記錄。
                        </p>
                    </div>
                </div>
            </div>
            
            <form id="editPayoutForm" class="space-y-4">
                <!-- 顯示但不可編輯的核心欄位 -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <label class="block text-sm font-medium text-gray-500 mb-1">大使代碼（不可改）</label>
                        <input type="text" value="${payout.partner_code}" 
                            class="ob-input bg-gray-100 text-gray-600 cursor-not-allowed" readonly disabled>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-500 mb-1">結算類型（不可改）</label>
                        <input type="text" value="${getPayoutTypeLabel(payout.payout_type)}" 
                            class="ob-input bg-gray-100 text-gray-600 cursor-not-allowed" readonly disabled>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-500 mb-1">結算金額（不可改）</label>
                        <input type="text" value="$${(payout.amount || 0).toLocaleString()}" 
                            class="ob-input bg-gray-100 text-gray-600 cursor-not-allowed" readonly disabled>
                    </div>
                </div>
                
                <!-- 可編輯的欄位 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">付款狀態</label>
                        <select id="edit_payout_status" class="ob-input">
                            <option value="PENDING" ${payout.payout_status === 'PENDING' ? 'selected' : ''}>待付款</option>
                            <option value="COMPLETED" ${payout.payout_status === 'COMPLETED' ? 'selected' : ''}>已付款</option>
                            <option value="CANCELLED" ${payout.payout_status === 'CANCELLED' ? 'selected' : ''}>已取消</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">銀行轉帳日期</label>
                        <input type="date" id="edit_bank_transfer_date" value="${payout.bank_transfer_date || ''}" 
                            class="ob-input">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">銀行轉帳參考號</label>
                        <input type="text" id="edit_bank_transfer_reference" value="${payout.bank_transfer_reference || ''}" 
                            class="ob-input" placeholder="轉帳交易序號...">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">住宿券代碼</label>
                        <input type="text" id="edit_accommodation_voucher_code" value="${payout.accommodation_voucher_code || ''}" 
                            class="ob-input" placeholder="僅適用於住宿金結算...">
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">備註</label>
                    <textarea id="edit_payout_notes" rows="3" class="ob-input"
                        placeholder="修改原因或其他說明...">${payout.notes || ''}</textarea>
                </div>
                
                <div class="flex justify-end space-x-3 pt-4 border-t">
                    <button type="button" onclick="closeModal('editPayoutModal')"
                        class="ob-btn ob-btn-secondary">
                        取消
                    </button>
                    <button type="button" onclick="savePayoutChanges('${payout.id}')"
                        class="ob-btn ob-btn-primary">
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
        // 只更新可編輯的欄位
        const formData = {
            action: 'update_payout',
            payout_id: payoutId,
            payout_status: document.getElementById('edit_payout_status').value,
            bank_transfer_date: document.getElementById('edit_bank_transfer_date').value.trim(),
            bank_transfer_reference: document.getElementById('edit_bank_transfer_reference').value.trim(),
            accommodation_voucher_code: document.getElementById('edit_accommodation_voucher_code').value.trim(),
            notes: document.getElementById('edit_payout_notes').value.trim()
        };

        // 移除空值欄位
        Object.keys(formData).forEach(key => {
            if (formData[key] === '' && key !== 'notes') {
                delete formData[key];
            }
        });

        // 使用 fetch + JSON 送到後端
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const result = await parsePayoutJsonResponse(response, '修改結算');

        await refreshPayoutDataView();
        showSuccessMessage('結算記錄修改成功！');
        closeModal('editPayoutModal');
        closeModal('payoutDetailsModal');
        console.log('修改結算回應:', result);

    } catch (error) {
        console.error('修改結算失敗:', error);
        alert('修改結算失敗：' + error.message);
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
                <h3 class="text-2xl font-bold">結算報表</h3>
                <button onclick="closeModal('payoutReportModal')" class="text-gray-500 hover:text-gray-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            
            <!-- 總覽統計 -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="border border-stone-200 rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold text-stone-700">${totalPayouts}</div>
                    <div class="text-sm text-gray-600">總結算筆數</div>
                </div>
                <div class="border border-stone-200 rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold text-stone-700">${completedPayouts}</div>
                    <div class="text-sm text-gray-600">已完成</div>
                </div>
                <div class="border border-stone-200 rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold text-stone-700">${pendingPayouts}</div>
                    <div class="text-sm text-gray-600">待付款</div>
                </div>
                <div class="border border-stone-200 rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold text-stone-700">$${totalAmount.toLocaleString()}</div>
                    <div class="text-sm text-gray-600">總金額</div>
                </div>
            </div>
            
            <!-- 金額統計 -->
            <div class="border border-stone-200 rounded-xl p-4 mb-6">
                <h4 class="font-bold mb-2">金額統計</h4>
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
                <h4 class="font-bold mb-3">大使別統計</h4>
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
                    class="ob-btn ob-btn-primary">
                    匯出報表
                </button>
                <button type="button" onclick="closeModal('payoutReportModal')"
                    class="ob-btn ob-btn-secondary">
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
            getPayoutTypeLabel(payout.payout_type),
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

    showSuccessMessage('結算報表已匯出！');
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
