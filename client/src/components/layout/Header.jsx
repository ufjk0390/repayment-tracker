import { useNavigate } from 'react-router-dom';
import { Menu, Bell, LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import useAuthStore from '../../stores/authStore';
import { getUnreadCount, logout as logoutApi } from '../../services/api';
import { ROLE_LABELS } from '../../utils/constants';

export default function Header({ onMenuToggle }) {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  const { data: unreadData } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => getUnreadCount().then((r) => r.data),
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.data?.count || 0;

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // ignore logout api error
    }
    clearAuth();
    toast.success('已登出');
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
      <button
        onClick={onMenuToggle}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-xs font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500">
              {ROLE_LABELS[user?.role] || user?.role}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
          title="登出"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
