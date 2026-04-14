#!/bin/bash
# Hostinger VPS 初始設定腳本
# 使用方式：以 root 或 sudo 執行
#   curl -fsSL https://raw.githubusercontent.com/ufjk0390/repayment-tracker/main/deploy/setup.sh | sudo bash
# 或先 git clone 後執行：sudo bash deploy/setup.sh

set -e

echo "=== 富盛典藏 VPS 初始設定 ==="

# 1. 系統更新
echo "[1/7] 更新系統套件..."
apt update && apt upgrade -y

# 2. 安裝必要工具
echo "[2/7] 安裝必要工具..."
apt install -y curl git nginx ufw certbot python3-certbot-nginx build-essential

# 3. 安裝 Node.js 20 (NodeSource)
if ! command -v node &> /dev/null; then
  echo "[3/7] 安裝 Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
else
  echo "[3/7] Node.js 已安裝: $(node -v)"
fi

# 4. 安裝 PM2
if ! command -v pm2 &> /dev/null; then
  echo "[4/7] 安裝 PM2..."
  npm install -g pm2
else
  echo "[4/7] PM2 已安裝"
fi

# 5. 建立日誌目錄（不建 /var/www/fusheng 以便 git clone 能用）
echo "[5/7] 建立日誌目錄..."
mkdir -p /var/log/fusheng

# 6. 防火牆設定
echo "[6/7] 設定防火牆..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# 7. Clone 或初始化專案
echo "[7/7] Clone / 初始化專案..."
REPO_URL="https://github.com/ufjk0390/repayment-tracker.git"
APP_DIR="/var/www/fusheng"

if [ -d "$APP_DIR/.git" ]; then
  echo "  專案已存在，略過 clone"
elif [ -d "$APP_DIR" ] && [ "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
  # 目錄已存在但非 git repo，用 init + fetch 方式接管
  echo "  目錄已存在但非 git repo，執行 init + fetch..."
  cd "$APP_DIR"
  git init -q
  git remote add origin "$REPO_URL" 2>/dev/null || git remote set-url origin "$REPO_URL"
  git fetch origin main
  git reset --hard origin/main
  git branch -M main
  git branch --set-upstream-to=origin/main main 2>/dev/null || true
else
  # 全新 clone
  mkdir -p /var/www
  git clone "$REPO_URL" "$APP_DIR"
fi

# 確保 data 目錄存在（clone 之後建立才不會影響 git clone）
mkdir -p "$APP_DIR/data"

echo ""
echo "=== 初始設定完成 ==="
echo ""
echo "下一步："
echo "1. cd /var/www/fusheng"
echo "2. 設定環境變數: cp deploy/.env.production.example server/.env && nano server/.env"
echo "3. 產生 JWT secret: openssl rand -base64 48"
echo "4. 執行部署: bash deploy/deploy.sh"
echo "5. 設定 Nginx: cp deploy/nginx.conf /etc/nginx/sites-available/fusheng.conf"
echo "   並修改 your-domain.com 為你的網域"
echo "   然後 ln -s /etc/nginx/sites-available/fusheng.conf /etc/nginx/sites-enabled/"
echo "6. 取得 SSL: certbot --nginx -d your-domain.com"
