#!/bin/bash

# 知音計畫自動部署腳本
# 自動提交和推送修改到 GitHub

set -e  # 遇到錯誤時退出

echo "🚀 開始自動部署..."

# 檢查是否有修改
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ 沒有需要提交的修改"
    exit 0
fi

# 顯示修改的檔案
echo "📋 檢測到以下修改："
git status --short

# 添加所有修改
echo "📦 添加修改到暫存區..."
git add .

# 生成提交訊息
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
COMMIT_MSG="自動部署更新 - $TIMESTAMP

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 提交修改
echo "💾 提交修改..."
git commit -m "$COMMIT_MSG"

# 推送到 GitHub
echo "🚀 推送到 GitHub..."
git push origin main

echo "✅ 部署完成！"
echo "🌐 線上版本：https://didi1119.github.io/forest-gift-v1"