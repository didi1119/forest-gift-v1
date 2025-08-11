// Feature Flag 系統
// 可在前端控制功能的開啟與關閉，支援未來擴展

class FeatureFlags {
    constructor() {
        // 預設功能旗標設定
        this.defaultFlags = {
            // 額外功能旗標 1：特殊節日模式
            EXTRA_FEATURE_1: false,
            
            // 額外功能旗標 2：進階分析
            EXTRA_FEATURE_2: false,
            
            // 其他功能旗標
            ENHANCED_TRACKING: true,
            PERSONALIZED_GREETINGS: true,
            JOURNAL_SYNC: false,
            REWARD_NOTIFICATIONS: false
        };
        
        this.flags = { ...this.defaultFlags };
        this.loadFlags();
    }
    
    // 從 localStorage 載入旗標設定
    loadFlags() {
        try {
            const savedFlags = localStorage.getItem('forest_feature_flags');
            if (savedFlags) {
                const parsed = JSON.parse(savedFlags);
                this.flags = { ...this.defaultFlags, ...parsed };
            }
        } catch (error) {
            console.warn('載入 Feature Flags 失敗:', error);
        }
    }
    
    // 儲存旗標設定到 localStorage
    saveFlags() {
        try {
            localStorage.setItem('forest_feature_flags', JSON.stringify(this.flags));
        } catch (error) {
            console.warn('儲存 Feature Flags 失敗:', error);
        }
    }
    
    // 檢查功能是否啟用
    isEnabled(flagName) {
        return this.flags[flagName] === true;
    }
    
    // 啟用功能
    enable(flagName) {
        this.flags[flagName] = true;
        this.saveFlags();
        this.triggerFlagChange(flagName, true);
    }
    
    // 停用功能
    disable(flagName) {
        this.flags[flagName] = false;
        this.saveFlags();
        this.triggerFlagChange(flagName, false);
    }
    
    // 切換功能狀態
    toggle(flagName) {
        const newValue = !this.flags[flagName];
        this.flags[flagName] = newValue;
        this.saveFlags();
        this.triggerFlagChange(flagName, newValue);
        return newValue;
    }
    
    // 取得所有旗標狀態
    getAllFlags() {
        return { ...this.flags };
    }
    
    // 重設所有旗標為預設值
    reset() {
        this.flags = { ...this.defaultFlags };
        this.saveFlags();
        // 觸發所有旗標的變更事件
        Object.keys(this.flags).forEach(flagName => {
            this.triggerFlagChange(flagName, this.flags[flagName]);
        });
    }
    
    // 觸發旗標變更事件
    triggerFlagChange(flagName, enabled) {
        const event = new CustomEvent('featureFlagChanged', {
            detail: { flagName, enabled }
        });
        document.dispatchEvent(event);
        
        // 執行特定功能的初始化或清理
        this.handleFlagChange(flagName, enabled);
    }
    
    // 處理特定旗標的變更
    handleFlagChange(flagName, enabled) {
        switch (flagName) {
            case 'EXTRA_FEATURE_1':
                this.handleExtraFeature1(enabled);
                break;
            case 'EXTRA_FEATURE_2':
                this.handleExtraFeature2(enabled);
                break;
            case 'ENHANCED_TRACKING':
                this.handleEnhancedTracking(enabled);
                break;
            case 'JOURNAL_SYNC':
                this.handleJournalSync(enabled);
                break;
            case 'REWARD_NOTIFICATIONS':
                this.handleRewardNotifications(enabled);
                break;
        }
    }
    
    // 處理額外功能 1：節日模式
    handleExtraFeature1(enabled) {
        const holidayElements = document.querySelectorAll('.holiday-mode');
        
        if (enabled) {
            // 顯示節日特色元素
            holidayElements.forEach(el => {
                el.style.display = 'block';
            });
            
            // 追蹤事件
            if (typeof trackEvent === 'function') {
                trackEvent('extra_feature_use', {
                    feature: 'holiday_mode',
                    action: 'enabled'
                });
            }
            
            // 添加節日樣式
            document.body.classList.add('holiday-mode');
            
        } else {
            // 隱藏節日特色元素
            holidayElements.forEach(el => {
                el.style.display = 'none';
            });
            
            document.body.classList.remove('holiday-mode');
        }
    }
    
    // 處理額外功能 2：進階分析
    handleExtraFeature2(enabled) {
        const analyticsElements = document.querySelectorAll('.advanced-analytics');
        
        if (enabled) {
            // 顯示進階分析功能
            analyticsElements.forEach(el => {
                el.style.display = 'block';
            });
            
            // 啟用進階追蹤
            if (typeof trackEvent === 'function') {
                trackEvent('extra_feature_use', {
                    feature: 'advanced_analytics',
                    action: 'enabled'
                });
            }
            
            console.log('進階分析功能已啟用');
            
        } else {
            // 隱藏進階分析功能
            analyticsElements.forEach(el => {
                el.style.display = 'none';
            });
        }
    }
    
    // 處理增強追蹤
    handleEnhancedTracking(enabled) {
        if (enabled) {
            console.log('增強追蹤已啟用');
        } else {
            console.log('增強追蹤已停用');
        }
    }
    
    // 處理週記同步
    handleJournalSync(enabled) {
        if (enabled) {
            console.log('週記雲端同步已啟用');
            // 可以在這裡加入雲端同步邏輯
        } else {
            console.log('週記雲端同步已停用');
        }
    }
    
    // 處理獎勵通知
    handleRewardNotifications(enabled) {
        if (enabled) {
            console.log('獎勵通知已啟用');
            // 可以在這裡加入通知邏輯
        } else {
            console.log('獎勵通知已停用');
        }
    }
}

// 建立全域 Feature Flags 實例
window.featureFlags = new FeatureFlags();

// 開發者工具：在 console 中提供快速操作
if (typeof window !== 'undefined') {
    window.debugFeatureFlags = {
        // 檢查功能狀態
        check: (flagName) => window.featureFlags.isEnabled(flagName),
        
        // 啟用功能
        enable: (flagName) => window.featureFlags.enable(flagName),
        
        // 停用功能
        disable: (flagName) => window.featureFlags.disable(flagName),
        
        // 切換功能
        toggle: (flagName) => window.featureFlags.toggle(flagName),
        
        // 查看所有旗標
        list: () => window.featureFlags.getAllFlags(),
        
        // 重設所有旗標
        reset: () => window.featureFlags.reset(),
        
        // 使用說明
        help: () => {
            console.log(`
Feature Flags 開發工具：
- debugFeatureFlags.check('FLAG_NAME') - 檢查功能狀態
- debugFeatureFlags.enable('FLAG_NAME') - 啟用功能
- debugFeatureFlags.disable('FLAG_NAME') - 停用功能  
- debugFeatureFlags.toggle('FLAG_NAME') - 切換功能
- debugFeatureFlags.list() - 查看所有旗標
- debugFeatureFlags.reset() - 重設所有旗標

可用的功能旗標：
- EXTRA_FEATURE_1: 節日模式
- EXTRA_FEATURE_2: 進階分析
- ENHANCED_TRACKING: 增強追蹤
- PERSONALIZED_GREETINGS: 個人化問候
- JOURNAL_SYNC: 週記同步
- REWARD_NOTIFICATIONS: 獎勵通知

範例：debugFeatureFlags.enable('EXTRA_FEATURE_1')
            `);
        }
    };
}

// DOM 載入完成後初始化所有功能
document.addEventListener('DOMContentLoaded', () => {
    // 觸發所有已啟用功能的初始化
    Object.keys(window.featureFlags.getAllFlags()).forEach(flagName => {
        if (window.featureFlags.isEnabled(flagName)) {
            window.featureFlags.triggerFlagChange(flagName, true);
        }
    });
    
    console.log('Feature Flags 系統已初始化');
    console.log('使用 debugFeatureFlags.help() 查看開發工具');
});