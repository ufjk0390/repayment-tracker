export const STATUS_LABELS = {
  PENDING: '待核實',
  APPROVED: '已核實',
  REJECTED: '已退回',
};

export const STATUS_COLORS = {
  PENDING: 'yellow',
  APPROVED: 'green',
  REJECTED: 'red',
};

export const TYPE_LABELS = {
  INCOME: '收入',
  EXPENSE: '支出',
  REPAYMENT: '還款',
};

export const TYPE_COLORS = {
  INCOME: 'green',
  EXPENSE: 'red',
  REPAYMENT: 'blue',
};

export const DEBT_STATUS_LABELS = {
  ACTIVE: '進行中',
  PAID_OFF: '已結清',
  PAUSED: '暫停',
};

export const DEBT_STATUS_COLORS = {
  ACTIVE: 'blue',
  PAID_OFF: 'green',
  PAUSED: 'yellow',
};

export const ROLE_LABELS = {
  USER: '當事人',
  SUPERVISOR: '監督人',
};

export const TRANSACTION_TYPES = [
  { value: 'INCOME', label: '收入' },
  { value: 'EXPENSE', label: '支出' },
  { value: 'REPAYMENT', label: '還款' },
];

export const REVIEW_STATUSES = [
  { value: '', label: '全部狀態' },
  { value: 'PENDING', label: '待核實' },
  { value: 'APPROVED', label: '已核實' },
  { value: 'REJECTED', label: '已退回' },
];

export const ROLES = [
  { value: 'USER', label: '當事人' },
  { value: 'SUPERVISOR', label: '監督人' },
];
