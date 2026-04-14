import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Receipt,
  Landmark,
  Target,
  Wallet,
  Bell,
  User,
  ClipboardCheck,
  FileText,
  X,
} from 'lucide-react';
import useAuthStore from '../../stores/authStore';

const userMenuItems = [
  { to: '/dashboard', label: '儀表板', icon: LayoutDashboard },
  { to: '/transactions', label: '收支紀錄', icon: Receipt },
  { to: '/debts', label: '債務管理', icon: Landmark },
  { to: '/plan', label: '還款計畫', icon: Target },
  { to: '/budget', label: '預算設定', icon: Wallet },
  { to: '/reports', label: '報表', icon: FileText },
  { to: '/notifications', label: '通知', icon: Bell },
];

const supervisorMenuItems = [
  { to: '/dashboard', label: '儀表板', icon: LayoutDashboard },
  { to: '/review', label: '審核紀錄', icon: ClipboardCheck },
  { to: '/transactions', label: '收支總覽', icon: Receipt },
  { to: '/debts', label: '債務總覽', icon: Landmark },
  { to: '/plan', label: '還款計畫', icon: Target },
  { to: '/reports', label: '報表', icon: FileText },
  { to: '/notifications', label: '通知', icon: Bell },
];

export default function Sidebar({ isOpen, onClose }) {
  const user = useAuthStore((s) => s.user);
  const menuItems = user?.role === 'SUPERVISOR' ? supervisorMenuItems : userMenuItems;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={clsx(
          'fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-indigo-600">富盛典藏</h1>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )
              }
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          <NavLink
            to="/profile"
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            <User className="h-5 w-5 flex-shrink-0" />
            個人設定
          </NavLink>
        </div>
      </aside>
    </>
  );
}
