import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCircle,
  AlertCircle,
  Info,
  CheckCheck,
} from 'lucide-react';
import Card, { CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import useNotifications from '../../hooks/useNotifications';
import { timeAgo } from '../../utils/format';
import { clsx } from 'clsx';

const typeIcons = {
  APPROVED: CheckCircle,
  REJECTED: AlertCircle,
  REMINDER: Bell,
  INFO: Info,
};

const typeColors = {
  APPROVED: 'text-green-500',
  REJECTED: 'text-red-500',
  REMINDER: 'text-yellow-500',
  INFO: 'text-blue-500',
};

function getNotificationLink(notif) {
  if (!notif.referenceType || !notif.referenceId) return null;
  if (notif.referenceType === 'Transaction') return `/transactions/${notif.referenceId}`;
  if (notif.referenceType === 'Debt') return `/debts/${notif.referenceId}`;
  if (notif.referenceType === 'RepaymentPlan') return `/plan`;
  return null;
}

export default function NotificationPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const {
    notifications,
    pagination,
    isLoading,
    markRead,
    markAllRead,
    unreadCount,
  } = useNotifications({ page, limit: 20 });

  const queryClient = useQueryClient();

  const handleMarkRead = (id) => {
    markRead(id);
  };

  const handleMarkAllRead = () => {
    markAllRead();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">通知</h1>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="h-4 w-4" />
            全部已讀
          </Button>
        )}
      </div>

      <Card>
        {isLoading ? (
          <Loading />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="沒有通知"
            message="目前沒有任何通知"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notif) => {
              const Icon = typeIcons[notif.type] || Bell;
              const iconColor = typeColors[notif.type] || 'text-gray-400';
              const isRead = notif.isRead || notif.readAt;

              return (
                <div
                  key={notif.id}
                  className={clsx(
                    'flex items-start gap-3 py-4 px-2 -mx-2 rounded-lg cursor-pointer transition-colors',
                    isRead
                      ? 'hover:bg-gray-50'
                      : 'bg-indigo-50/50 hover:bg-indigo-50'
                  )}
                  onClick={() => {
                    if (!isRead) handleMarkRead(notif.id);
                    const link = getNotificationLink(notif);
                    if (link) navigate(link);
                  }}
                >
                  <div className={clsx('mt-0.5 flex-shrink-0', iconColor)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={clsx(
                          'text-sm',
                          isRead
                            ? 'text-gray-700'
                            : 'text-gray-900 font-semibold'
                        )}
                      >
                        {notif.title}
                      </p>
                      {!isRead && (
                        <span className="inline-block h-2 w-2 rounded-full bg-indigo-600 flex-shrink-0" />
                      )}
                    </div>
                    {notif.message && (
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {timeAgo(notif.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {pagination && (
          <Pagination
            page={page}
            totalPages={pagination.totalPages || 1}
            onPageChange={setPage}
          />
        )}
      </Card>
    </div>
  );
}
