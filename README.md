# 富盛典藏 / Repayment Tracker

[![CI](https://github.com/ufjk0390/repayment-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/ufjk0390/repayment-tracker/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-52%2F52-brightgreen)](https://github.com/ufjk0390/repayment-tracker/actions)

還款記帳網站 — 協助特定對象改善經濟狀況，透過「當事人記帳 + 監督人核實」的雙角色機制建立財務紀律。

## 功能

- **雙角色一對一配對**：監督人透過邀請碼與當事人綁定
- **收支紀錄審核流程**：當事人提交 → PENDING → 監督人核實 APPROVED / REJECTED
- **債務管理**：多筆債務追蹤、還款時自動扣減餘額、結清自動標記
- **還款計畫**：每筆債務每月目標 + 累計執行率追蹤
- **月度預算**：分類預算上限與使用進度
- **Dashboard**：收支摘要、債務進度、預算、圖表、最近交易
- **通知中心**：審核結果、逾期、超支、配對事件
- **收據上傳**：jpg/png/pdf 最大 5MB
- **CSV 報表匯出**：UTF-8 BOM，Excel 直接開啟
- **排程逾期檢查**：每日 01:00 自動檢查未還款債務
- **安全機制**：JWT 雙 Token、登入失敗鎖定、密碼重設、Rate Limiting、Audit Log

## 技術棧

| 層級 | 技術 |
|------|------|
| Frontend | React 19 + Vite + TailwindCSS + Zustand + TanStack Query + Recharts |
| Backend | Node.js + Express + Prisma + SQLite |
| Auth | JWT (Access 15min + Refresh 7day httpOnly cookie) + bcrypt |
| Validation | Zod (共用 schema) |
| Upload | Multer |
| Scheduling | node-cron |
| Logging | Pino |

## 專案結構

```
repayment-tracker/
├── server/                  # Node.js + Express + Prisma
│   ├── prisma/
│   │   ├── schema.prisma    # 11 張資料表
│   │   └── seed.js          # 13 個系統預設分類
│   └── src/
│       ├── controllers/     # 9 個業務 controller
│       ├── routes/          # 9 個路由模組
│       ├── middleware/      # auth, validate, rateLimit, errorHandler
│       ├── schemas/         # Zod schemas
│       ├── jobs/            # 排程任務
│       ├── lib/             # prisma client, audit helper
│       └── app.js
└── client/                  # React + Vite
    └── src/
        ├── components/
        │   ├── ui/          # 11 個 UI 元件
        │   ├── layout/      # AppLayout, Sidebar, Header
        │   └── charts/      # Recharts 圖表
        ├── pages/
        │   ├── auth/        # 登入 / 註冊 / 忘記密碼
        │   ├── dashboard/   # 當事人 / 監督人雙 Dashboard
        │   ├── transactions/
        │   ├── debts/
        │   ├── plan/
        │   ├── budget/
        │   ├── review/      # 監督人審核
        │   ├── reports/     # 月度報表 + CSV 匯出
        │   ├── notifications/
        │   └── profile/
        ├── hooks/
        ├── services/        # API client (axios + interceptor)
        ├── stores/          # Zustand auth store
        └── utils/
```

## 快速開始

### 環境需求

- Node.js 20+
- npm

### 安裝

```bash
# Clone
git clone <repo-url>
cd repayment-tracker

# Install backend
cd server
npm install
cp .env.example .env  # 編輯 .env 並設定 JWT_SECRET
npx prisma db push
node prisma/seed.js

# Install frontend (另一個終端)
cd ../client
npm install
```

### 開發模式

```bash
# Terminal 1 — backend
cd server && npm run dev
# http://localhost:3001

# Terminal 2 — frontend
cd client && npm run dev
# http://localhost:5173
```

### 生產建置

```bash
cd client && npm run build  # 輸出至 dist/
```

## 資料模型

11 張資料表：

- **User** — 使用者（含 role、loginAttempts、resetToken）
- **Pairing** — 一對一配對（邀請碼、狀態、過期時間）
- **Category** — 分類（系統預設 + 使用者自訂）
- **Debt** — 債務（原始金額、當前餘額、月繳、狀態、軟刪除）
- **Transaction** — 交易紀錄（含 version 樂觀鎖、審核狀態）
- **RepaymentPlan** / **PlanItem** — 還款計畫與明細
- **Budget** — 月度預算（複合唯一鍵）
- **Notification** — 通知
- **AuditLog** — 操作紀錄
- **RefreshToken** — Refresh token 儲存

## 測試

```bash
# Phase 1 regression (35 tests)
bash run-qa.sh

# Phase 2-4 new features (17 tests)
bash run-qa-phase234.sh
```

## 角色權限

| 功能 | 當事人 | 監督人 |
|------|:-:|:-:|
| 新增/編輯收支紀錄 | ✅ | ❌ |
| 新增/編輯債務 | ✅ | ❌ |
| 核實 / 退回紀錄 | ❌ | ✅ |
| 查看對方資料 | ✅ 自己的 | ✅ 配對對象的 |
| Dashboard | ✅ 個人版 | ✅ 監督版 |
| 報表匯出 | ✅ | ✅ |

## API 端點

所有端點前綴：`/api/v1`

- `/auth` — register, login, refresh, logout, me, profile, password, forgot-password, reset-password
- `/pairing` — invite, join, status, dissolve
- `/transactions` — list, create, get, update, delete, review, batch-review
- `/categories` — list, create, update, delete
- `/debts` — list, create, get, update, delete, payments
- `/plans` — list, create, get, update, delete, progress
- `/budgets` — list, create, update, delete, summary
- `/dashboard/summary` — 依角色回傳
- `/notifications` — list, read, read-all, unread-count
- `/upload` — 收據上傳
- `/reports` — export (CSV), monthly

## 安全性

- 密碼 bcrypt (cost 12) + 強度規則（8+ 字元、大小寫、數字）
- JWT Access Token 15 分鐘、Refresh Token 7 天 httpOnly cookie
- 登入失敗 5 次鎖定 15 分鐘
- Row-level access control（當事人只能看自己、監督人只能看配對對象）
- Zod 輸入驗證
- CORS 白名單
- Rate Limiting（auth 路由 20 次/15 分鐘）
- Audit Log 追蹤敏感操作
- 邀請碼使用 `crypto.randomBytes`、24 小時過期
- 軟刪除保護已有還款紀錄的債務

## License

Private project.
