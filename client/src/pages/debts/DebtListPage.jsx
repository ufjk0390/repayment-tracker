import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Landmark } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import EmptyState from '../../components/ui/EmptyState';
import ProgressBar from '../../components/ui/ProgressBar';
import { getDebts } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { DEBT_STATUS_LABELS, DEBT_STATUS_COLORS } from '../../utils/constants';
import useAuthStore from '../../stores/authStore';

export default function DebtListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isUser = user?.role === 'USER';

  const { data, isLoading } = useQuery({
    queryKey: ['debts'],
    queryFn: () => getDebts().then((r) => r.data),
  });

  const debts = data?.data?.debts || data?.data || [];

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isUser ? '債務管理' : '債務總覽'}
        </h1>
        {isUser && (
          <Button onClick={() => navigate('/debts/new')}>
            <Plus className="h-4 w-4" />
            新增債務
          </Button>
        )}
      </div>

      {debts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Landmark}
            title="尚無債務紀錄"
            message={isUser ? '新增您的債務開始追蹤還款進度' : '當事人尚未新增債務'}
            actionLabel={isUser ? '新增債務' : undefined}
            onAction={isUser ? () => navigate('/debts/new') : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {debts.map((debt) => {
            const paid = debt.originalAmount - (debt.currentBalance || debt.originalAmount);
            const progress = debt.originalAmount > 0 ? (paid / debt.originalAmount) * 100 : 0;

            return (
              <Card
                key={debt.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/debts/${debt.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{debt.name}</h3>
                    <p className="text-sm text-gray-500">{debt.creditor}</p>
                  </div>
                  <Badge color={DEBT_STATUS_COLORS[debt.status]}>
                    {DEBT_STATUS_LABELS[debt.status]}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">原始金額</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(debt.originalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">目前餘額</span>
                    <span className="font-semibold text-indigo-600">
                      {formatCurrency(debt.currentBalance)}
                    </span>
                  </div>

                  <ProgressBar
                    value={paid}
                    max={debt.originalAmount}
                    color={debt.status === 'PAID_OFF' ? 'green' : 'indigo'}
                    showLabel
                  />

                  <div className="flex justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
                    <span>月付 {formatCurrency(debt.monthlyDue)}</span>
                    <span>每月 {debt.dueDay} 日</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
