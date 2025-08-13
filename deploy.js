#!/usr/bin/env node

// 知音計畫快速部署工具
// 使用方法：node deploy.js [commit message]

const { execSync } = require('child_process');
const fs = require('fs');

function runCommand(cmd, description) {
    console.log(`📋 ${description}...`);
    try {
        const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
        if (output.trim()) {
            console.log(output.trim());
        }
        return true;
    } catch (error) {
        console.error(`❌ ${description} 失敗:`, error.message);
        return false;
    }
}

function main() {
    console.log('🚀 知音計畫自動部署開始...\n');

    // 檢查是否有修改
    try {
        const status = execSync('git status --porcelain', { encoding: 'utf8' });
        if (!status.trim()) {
            console.log('✅ 沒有需要提交的修改');
            return;
        }
    } catch (error) {
        console.error('❌ 檢查 Git 狀態失敗:', error.message);
        return;
    }

    // 顯示修改的檔案
    console.log('📋 檢測到以下修改：');
    runCommand('git status --short', '顯示修改狀態');
    console.log('');

    // 添加所有修改
    if (!runCommand('git add .', '添加修改到暫存區')) return;

    // 生成提交訊息
    const customMessage = process.argv[2];
    const timestamp = new Date().toLocaleString('zh-TW', { 
        timeZone: 'Asia/Taipei',
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit', 
        minute: '2-digit'
    });
    
    const commitMessage = customMessage 
        ? `${customMessage}

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>`
        : `自動部署更新 - ${timestamp}

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>`;

    // 提交修改
    if (!runCommand(`git commit -m "${commitMessage}"`, '提交修改')) return;

    // 推送到 GitHub
    if (!runCommand('git push origin main', '推送到 GitHub')) return;

    console.log('\n✅ 部署完成！');
    console.log('🌐 線上版本：https://didi1119.github.io/forest-gift-v1');
    console.log('📱 管理後台：https://didi1119.github.io/forest-gift-v1/frontend/admin/admin-dashboard-real.html');
}

main();