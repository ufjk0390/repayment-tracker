# Hostinger VPS 部署指南

本指南說明如何將「富盛典藏」部署到 Hostinger VPS（Ubuntu 22.04/24.04）。

## 架構

```
Internet → Nginx (80/443) ──┬─→ /var/www/fusheng/client/dist  (靜態前端)
                            └─→ 127.0.0.1:3001 (Node.js API via PM2)
                                      └─→ SQLite 或 PostgreSQL
```

## 準備事項

- ✅ Hostinger VPS（KVM 2 或以上，Ubuntu 22.04+）
- ✅ 網域名稱（DNS A record 指向 VPS IP）
- ✅ SSH 能登入 VPS

---

## 第一次部署

### 1. 登入 VPS 並執行初始設定

```bash
ssh root@YOUR_VPS_IP

# 下載並執行 setup 腳本
curl -fsSL https://raw.githubusercontent.com/ufjk0390/repayment-tracker/main/deploy/setup.sh | bash
```

此腳本會自動：
- 更新系統
- 安裝 Node.js 20、Nginx、PM2、Certbot、Git
- 建立 `/var/www/fusheng` 目錄並 clone 專案
- 設定 UFW 防火牆

### 2. 設定環境變數

```bash
cd /var/www/fusheng
cp deploy/.env.production.example server/.env
nano server/.env
```

**必填項目**：
```bash
# 產生隨機 JWT secret（複製輸出貼到 .env）
openssl rand -base64 48
openssl rand -base64 48  # 再一次給 refresh secret
```

修改 `server/.env`：
```
DATABASE_URL="file:/var/www/fusheng/data/prod.db"
JWT_SECRET="上面產生的第一組"
JWT_REFRESH_SECRET="上面產生的第二組"
PORT=3001
NODE_ENV=production
CLIENT_URL="https://your-domain.com"
```

### 3. 更新後端 CORS（重要）

預設後端只允許 `http://localhost:5173`，必須改用環境變數：

編輯 `server/src/app.js`，確認 CORS 設定使用 `process.env.CLIENT_URL`：

```js
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
```

### 4. 執行部署腳本

```bash
cd /var/www/fusheng
bash deploy/deploy.sh
```

這會：
- Pull 最新程式碼
- 安裝後端依賴
- Prisma generate + db push + seed
- 建置前端（輸出到 `client/dist`）
- 啟動 PM2
- 重新載入 Nginx

### 5. 設定 Nginx

```bash
# 複製 Nginx 設定
sudo cp /var/www/fusheng/deploy/nginx.conf /etc/nginx/sites-available/fusheng.conf

# 修改網域
sudo sed -i 's/your-domain.com/實際網域.com/g' /etc/nginx/sites-available/fusheng.conf

# 啟用 site
sudo ln -s /etc/nginx/sites-available/fusheng.conf /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # 移除預設

# 測試設定
sudo nginx -t
sudo systemctl reload nginx
```

### 6. 取得 SSL 憑證（Let's Encrypt）

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

依提示輸入 email、同意條款。Certbot 會自動修改 Nginx 設定加入 SSL 並設定自動續期。

### 7. 驗證

```bash
# 健康檢查
curl https://your-domain.com/api/v1/health

# PM2 狀態
pm2 status
pm2 logs fusheng-api --lines 20
```

瀏覽器開啟 `https://your-domain.com` 應該看到登入頁。

---

## 後續更新部署

當 GitHub main branch 有新 commit 時：

```bash
ssh root@YOUR_VPS_IP
cd /var/www/fusheng
bash deploy/deploy.sh
```

就這麼簡單。腳本會自動 pull、建置、重啟。

---

## 進階設定

### 選項 A：改用 PostgreSQL（推薦生產環境）

SQLite 不支援併發寫入，若要支援多當事人並發使用建議改 PostgreSQL：

```bash
# 安裝 PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 建立資料庫與使用者
sudo -u postgres psql <<EOF
CREATE USER fusheng WITH PASSWORD 'STRONG_PASSWORD';
CREATE DATABASE fusheng OWNER fusheng;
GRANT ALL PRIVILEGES ON DATABASE fusheng TO fusheng;
\q
EOF
```

修改 `server/prisma/schema.prisma`：
```prisma
datasource db {
  provider = "postgresql"  # 從 sqlite 改為 postgresql
  url      = env("DATABASE_URL")
}
```

修改 `server/.env`：
```
DATABASE_URL="postgresql://fusheng:STRONG_PASSWORD@localhost:5432/fusheng"
```

重新部署：
```bash
cd /var/www/fusheng/server
npx prisma generate
npx prisma db push
node prisma/seed.js
pm2 restart fusheng-api
```

### 選項 B：定時備份 SQLite

建立 cron job 每日備份：

```bash
sudo nano /etc/cron.d/fusheng-backup
```

```cron
0 3 * * * root cp /var/www/fusheng/data/prod.db /var/www/fusheng/data/prod.db.$(date +\%Y\%m\%d).bak && find /var/www/fusheng/data -name "*.bak" -mtime +7 -delete
```

### 選項 C：自動部署（GitHub Webhook）

若希望 push 到 main 後自動部署，可設定 webhook 或用 GitHub Actions SSH 到 VPS。簡單版本：

```bash
# 在 VPS 上安裝 webhook server
# 或用 GitHub Actions 的 ssh-action
```

---

## 疑難排解

### PM2 啟動失敗
```bash
pm2 logs fusheng-api --err
# 常見原因：.env 未設定、JWT_SECRET 缺少、port 3001 被占用
```

### 前端 404
```bash
# 確認 dist 目錄存在
ls -la /var/www/fusheng/client/dist/
# 若不存在，手動建置
cd /var/www/fusheng/client && npm run build
```

### CORS 錯誤
確認 `server/.env` 的 `CLIENT_URL` 與實際訪問網域一致（含 `https://`）。

### SSL 憑證續期失敗
```bash
sudo certbot renew --dry-run
```

### 查看所有日誌
```bash
# PM2 應用日誌
pm2 logs fusheng-api

# Nginx 存取日誌
sudo tail -f /var/log/nginx/access.log

# Nginx 錯誤日誌
sudo tail -f /var/log/nginx/error.log

# 系統日誌
journalctl -u nginx -n 50
```

---

## 安全強化建議

### 1. 建立非 root 使用者

```bash
adduser fusheng
usermod -aG sudo fusheng
# 之後用 fusheng 帳號 SSH 登入，禁用 root SSH
```

### 2. 禁用 root SSH

編輯 `/etc/ssh/sshd_config`：
```
PermitRootLogin no
PasswordAuthentication no  # 只允許 key 登入
```
```bash
sudo systemctl restart ssh
```

### 3. Fail2ban 防暴力破解

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

### 4. 定期更新

```bash
sudo apt update && sudo apt upgrade -y
npm audit fix  # 在 server/ 和 client/ 各跑一次
```

---

## 規格建議

Hostinger VPS 方案推薦：

| 方案 | 規格 | 適用 |
|------|------|------|
| **KVM 1** | 1 vCPU / 4GB RAM / 50GB | 個人使用、低流量 ✅ 夠用 |
| **KVM 2** | 2 vCPU / 8GB RAM / 100GB | 家族共用 / 預留擴充 ⭐ 推薦 |
| **KVM 4** | 4 vCPU / 16GB RAM / 200GB | 大量資料 + PostgreSQL |

本應用單用戶實測記憶體占用約 150MB（Node 約 80MB + Nginx 約 15MB），KVM 1 足夠。

---

## 成本估算

| 項目 | 費用 |
|------|------|
| Hostinger VPS KVM 1 | ~$5.99/月（2 年約） |
| 網域（.com） | ~$12/年 |
| SSL | **免費**（Let's Encrypt） |
| **合計** | 約 $7/月 |

---

## 參考資源

- [Hostinger VPS 教學](https://www.hostinger.com/tutorials/vps)
- [Nginx 文件](https://nginx.org/en/docs/)
- [PM2 文件](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Prisma 生產環境部署](https://www.prisma.io/docs/guides/deployment)
