import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  Copy,
  UserPlus,
} from 'lucide-react';
import Card, { CardTitle } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loading from '../../components/ui/Loading';
import ProgressBar from '../../components/ui/ProgressBar';
import EmptyState from '../../components/ui/EmptyState';
import ExpensePieChart from '../../components/charts/ExpensePieChart';
import MonthlyBarChart from '../../components/charts/MonthlyBarChart';
import { getDashboardSummary, getPairing, joinPairing } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { STATUS_LABELS, STATUS_COLORS, TYPE_LABELS, TYPE_COLORS } from '../../utils/constants';

export default function UserDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteCode, setInviteCode] = useState('');

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: () => getDashboardSummary().then((r) => r.data),
  });

  const { data: pairingData } = useQuery({
    queryKey: ['pairing'],
    queryFn: () => getPairing().then((r) => r.data),
  });

  const joinMutation = useMutation({
    mutationFn: joinPairing,
    onSuccess: () => {
      toast.success('配對成功');
      queryClient.invalidateQueries({ queryKey: ['pairing'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || '配對失敗');
    },
  });

  const handleJoin = () => {
    if (!inviteCode.trim()) {
      toast.error('請輸入邀請碼');
      return;
    }
    joinMutation.mutate({ inviteCode: inviteCode.trim() });
  };

  if (isLoading) return <Loading />;

  const summary = summaryData?.data || {};
  const pairing = pairingData?.data;
  const isPaired = !!pairing?.id;

  const thisMonth = summary.thisMonth || {};
  const summaryCards = [
    {
      label: '本月收入',
      amount: thisMonth.income || 0,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '本月支出',
      amount: thisMonth.expense || 0,
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: '本月還款',
      amount: thisMonth.repayment || 0,
      icon: Wallet,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">儀表板</h1>

      {!isPaired && (
        <Card className="border-yellow-200 bg-yellow-50">
          <div className="flex items-start gap-3">
            <UserPlus className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800">尚未配對監督人</h3>
              <p className="text-sm text-yellow-700 mt-1 mb-3">
                請輸入監督人提供的邀請碼完成配對
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="輸入邀請碼"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  onClick={handleJoin}
                  loading={joinMutation.isPending}
                  size="sm"
                >
                  配對
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(card.amount)}
                </p>
                {card.change !== undefined && card.change !== null && (
                  <p className={`text-xs mt-1 ${card.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    較上月 {card.change >= 0 ? '+' : ''}{card.change}%
                  </p>
                )}
              </div>
              <div className={`${card.bg} p-3 rounded-xl`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>債務還款進度</CardTitle>
          {summary.debts?.length > 0 ? (
            <div className="space-y-4 mt-4">
              {summary.debts.slice(0, 5).map((debt) => (
                <div key={debt.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{debt.name}</span>
                    <span className="text-gray-500">
                      {formatCurrency(debt.currentBalance)} / {formatCurrency(debt.originalAmount)}
                    </span>
                  </div>
                  <ProgressBar
                    value={debt.originalAmount - debt.currentBalance}
                    max={debt.originalAmount}
                    color="indigo"
                    showLabel={false}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="尚無債務" message="新增債務開始追蹤還款進度" />
          )}
        </Card>

        <Card>
          <CardTitle>預算使用狀況</CardTitle>
          {summary.budgetStatus?.length > 0 ? (
            <div className="space-y-4 mt-4">
              {summary.budgetStatus.map((budget, idx) => {
                const usage = budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0;
                const overBudget = usage > 100;
                return (
                  <div key={budget.category?.id || idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{budget.category?.name}</span>
                      <span className={overBudget ? 'text-red-600 font-medium' : 'text-gray-500'}>
                        {formatCurrency(budget.spent)} / {formatCurrency(budget.limit)}
                      </span>
                    </div>
                    <ProgressBar
                      value={budget.spent}
                      max={budget.limit}
                      color={overBudget ? 'red' : usage > 80 ? 'yellow' : 'green'}
                      showLabel={false}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="尚未設定預算" message="設定預算開始追蹤支出" />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>支出分佈</CardTitle>
          <ExpensePieChart data={summary.expenseByCategory || []} />
        </Card>

        <Card>
          <CardTitle>月度趨勢</CardTitle>
          <MonthlyBarChart data={summary.monthlyTrend || []} />
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>最近收支紀錄</CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/transactions')}>
            查看全部
          </Button>
        </div>
        {summary.recentTransactions?.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {summary.recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg"
                onClick={() => navigate(`/transactions/${tx.id}`)}
              >
                <div className="flex items-center gap-3">
                  <Badge color={TYPE_COLORS[tx.type]}>{TYPE_LABELS[tx.type]}</Badge>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tx.category?.name || tx.description}</p>
                    <p className="text-xs text-gray-500">{formatDate(tx.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                  <Badge color={STATUS_COLORS[tx.status]}>{STATUS_LABELS[tx.status]}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="尚無紀錄" actionLabel="新增紀錄" onAction={() => navigate('/transactions/new')} />
        )}
      </Card>

      {summary.alerts?.length > 0 && (
        <Card className="border-red-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <CardTitle>提醒事項</CardTitle>
          </div>
          <div className="space-y-2">
            {summary.alerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2"
              >
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {alert.message}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
