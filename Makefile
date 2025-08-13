# 知音計畫部署工具

.PHONY: deploy deploy-backend status push help

# 快速部署（自動提交訊息）
deploy:
	@node deploy.js

# 部署並自訂提交訊息
# 使用方法: make deploy-msg MSG="your commit message"
deploy-msg:
	@node deploy.js "$(MSG)"

# 使用 bash 腳本部署
deploy-bash:
	@./auto-deploy.sh

# 查看 Git 狀態
status:
	@echo "📋 Git 狀態："
	@git status --short
	@echo ""
	@echo "📈 分支狀態："
	@git status --branch --porcelain=v1

# 部署後端代碼到 Apps Script
deploy-backend:
	@echo "🚀 部署後端代碼..."
	@echo "📂 打開部署助手工具："
	@echo "🌐 https://didi1119.github.io/forest-gift-v1/deploy-assistant.html"
	@echo ""
	@echo "或者手動複製代碼："
	@echo "📄 Apps Script 代碼位置：backend/apps-script-commission-v2.js"
	@echo "🔗 Apps Script 編輯器：https://script.google.com"
	@echo ""
	@open "https://didi1119.github.io/forest-gift-v1/deploy-assistant.html" 2>/dev/null || echo "請手動打開上述連結"

# 僅推送現有提交
push:
	@echo "🚀 推送到 GitHub..."
	@git push origin main
	@echo "✅ 推送完成！"

# 顯示幫助
help:
	@echo "知音計畫部署工具使用說明："
	@echo ""
	@echo "make deploy          - 快速部署前端（自動生成提交訊息）"
	@echo "make deploy-backend  - 部署後端代碼到 Apps Script"
	@echo "make deploy-msg MSG='訊息' - 部署並自訂提交訊息"
	@echo "make deploy-bash     - 使用 bash 腳本部署"
	@echo "make status          - 查看 Git 狀態"
	@echo "make push            - 僅推送現有提交"
	@echo "make help            - 顯示此幫助"
	@echo ""
	@echo "線上網址："
	@echo "🌐 主站：https://didi1119.github.io/forest-gift-v1"
	@echo "📱 管理後台：https://didi1119.github.io/forest-gift-v1/frontend/admin/admin-dashboard-real.html"
	@echo "🚀 部署助手：https://didi1119.github.io/forest-gift-v1/deploy-assistant.html"