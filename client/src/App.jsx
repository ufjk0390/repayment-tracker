import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './stores/authStore';

import AuthLayout from './components/layout/AuthLayout';
import AppLayout from './components/layout/AppLayout';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

import UserDashboard from './pages/dashboard/UserDashboard';
import SupervisorDashboard from './pages/dashboard/SupervisorDashboard';

import TransactionListPage from './pages/transactions/TransactionListPage';
import TransactionFormPage from './pages/transactions/TransactionFormPage';
import TransactionDetailPage from './pages/transactions/TransactionDetailPage';

import DebtListPage from './pages/debts/DebtListPage';
import DebtFormPage from './pages/debts/DebtFormPage';
import DebtDetailPage from './pages/debts/DebtDetailPage';

import PlanPage from './pages/plan/PlanPage';
import PlanFormPage from './pages/plan/PlanFormPage';

import BudgetPage from './pages/budget/BudgetPage';

import ReviewListPage from './pages/review/ReviewListPage';
import ReviewDetailPage from './pages/review/ReviewDetailPage';

import NotificationPage from './pages/notifications/NotificationPage';
import ProfilePage from './pages/profile/ProfilePage';
import ReportsPage from './pages/reports/ReportsPage';

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function RoleRoute({ roles, children }) {
  const user = useAuthStore((s) => s.user);
  if (!roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function DashboardSwitch() {
  const user = useAuthStore((s) => s.user);
  if (user?.role === 'SUPERVISOR') return <SupervisorDashboard />;
  return <UserDashboard />;
}

function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route
        element={
          <PublicRoute>
            <AuthLayout />
          </PublicRoute>
        }
      >
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Protected app routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardSwitch />} />

        {/* Transactions */}
        <Route path="/transactions" element={<TransactionListPage />} />
        <Route
          path="/transactions/new"
          element={
            <RoleRoute roles={['USER']}>
              <TransactionFormPage />
            </RoleRoute>
          }
        />
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
        <Route
          path="/transactions/:id/edit"
          element={
            <RoleRoute roles={['USER']}>
              <TransactionFormPage />
            </RoleRoute>
          }
        />

        {/* Debts */}
        <Route path="/debts" element={<DebtListPage />} />
        <Route
          path="/debts/new"
          element={
            <RoleRoute roles={['USER']}>
              <DebtFormPage />
            </RoleRoute>
          }
        />
        <Route path="/debts/:id" element={<DebtDetailPage />} />
        <Route
          path="/debts/:id/edit"
          element={
            <RoleRoute roles={['USER']}>
              <DebtFormPage />
            </RoleRoute>
          }
        />

        {/* Plan */}
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/plan/new" element={<PlanFormPage />} />

        {/* Budget */}
        <Route
          path="/budget"
          element={
            <RoleRoute roles={['USER']}>
              <BudgetPage />
            </RoleRoute>
          }
        />

        {/* Review (Supervisor only) */}
        <Route
          path="/review"
          element={
            <RoleRoute roles={['SUPERVISOR']}>
              <ReviewListPage />
            </RoleRoute>
          }
        />
        <Route
          path="/review/:id"
          element={
            <RoleRoute roles={['SUPERVISOR']}>
              <ReviewDetailPage />
            </RoleRoute>
          }
        />

        {/* Reports */}
        <Route path="/reports" element={<ReportsPage />} />

        {/* Notifications */}
        <Route path="/notifications" element={<NotificationPage />} />

        {/* Profile */}
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
