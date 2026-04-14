import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from '../services/api';

export default function useNotifications(params = {}) {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ['notifications', params],
    queryFn: () => getNotifications(params).then((r) => r.data),
  });

  const unreadCountQuery = useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => getUnreadCount().then((r) => r.data),
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });

  return {
    notifications: notificationsQuery.data?.data || [],
    pagination: notificationsQuery.data?.pagination,
    isLoading: notificationsQuery.isLoading,
    unreadCount: unreadCountQuery.data?.data?.count || 0,
    markRead: markReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
  };
}
