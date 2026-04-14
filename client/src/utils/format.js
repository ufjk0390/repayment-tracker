import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';

export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `NT$ ${num.toLocaleString('zh-TW')}`;
}

export function formatDate(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy/MM/dd', { locale: zhTW });
}

export function formatDateTime(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy/MM/dd HH:mm', { locale: zhTW });
}

export function timeAgo(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: zhTW });
}

export function formatMonth(year, month) {
  return `${year} 年 ${month} 月`;
}

export function getCurrentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function formatPercent(value) {
  return `${Math.round(value * 100) / 100}%`;
}
