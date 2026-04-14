#!/bin/bash
# 富盛典藏 部署 / 更新腳本
# 使用方式 (在 VPS 上): cd /var/www/fusheng && bash deploy/deploy.sh

set -e

APP_DIR="/var/www/fusheng"
cd "$APP_DIR"

echo "=== 富盛典藏 部署開始 ==="

# 1. 拉取最新程式碼
echo "[1/6] Pull latest code..."
git fetch origin main
git reset --hard origin/main

# 2. 後端依賴
echo "[2/6] Install backend deps..."
cd "$APP_DIR/server"
npm install --production --no-audit --no-fund

# 3. Prisma schema + migration
echo "[3/6] Run Prisma migrations..."
npx prisma generate
npx prisma db push
# 只在首次部署執行 seed（檢查系統分類是否存在）
if [ ! -f "$APP_DIR/data/.seeded" ]; then
  node prisma/seed.js
  touch "$APP_DIR/data/.seeded"
fi

# 4. 前端依賴 + 建置
echo "[4/6] Install frontend deps and build..."
cd "$APP_DIR/client"
npm install --no-audit --no-fund
npm run build

# 5. 建立 uploads 目錄（若不存在）
echo "[5/6] Ensure uploads directory..."
mkdir -p "$APP_DIR/server/uploads"

# 6. 重啟 PM2
echo "[6/6] Restart PM2 process..."
cd "$APP_DIR"
if pm2 list | grep -q "fusheng-api"; then
  pm2 reload deploy/ecosystem.config.cjs
else
  pm2 start deploy/ecosystem.config.cjs
  pm2 save
  pm2 startup systemd -u $USER --hp $HOME | tail -1 | sudo bash || true
fi

# 重新載入 Nginx
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "=== 部署完成 ==="
pm2 status
echo ""
echo "測試 API: curl http://localhost:3001/api/v1/health"
