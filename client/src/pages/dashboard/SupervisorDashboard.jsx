import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  Copy,
  Link2,
} from 'lucide-react';
import Card, { CardTitle } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import ProgressBar from '../../components/ui/ProgressBar';
import EmptyState from '../../components/ui/EmptyState';
import MonthlyBarChart from '../../components/charts/MonthlyBarChart';
import { getDashboardSummary, getPairing, createInvite } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { STATUS_LABELS, STATUS_COLORS, TYPE_LABELS, TYPE_COLORS } from '../../utils/constants';

export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [generatedCode, setGeneratedCode] = useState('');

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: () => getDashboardSummary().then((r) => r.data),
  });

  const { data: pairingData } = useQuery({
    queryKey: ['pairing'],
    queryFn: () => getPairing().then((r) => r.data),
  });

  const inviteMutation = useMutation({
    mutationFn: createInvite,
    onSuccess: (res) => {
      const code = res.data?.data?.inviteCode;
      setGeneratedCode(code);
      toast.success('邀請碼已產生');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || '產生邀請碼失敗');
    },
  });

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    toast.success('已複製邀請碼');
  };

  if (isLoading) return <Loading />;

  const summary = summaryData?.data || {};
  const pairing = pairingData?.data;
  const isPaired = !!pairing?.id;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">監督人儀表板</h1>

      {!isPaired && (
        <Card className="border-indigo-200 bg-indigo-50">
          <div className="flex items-start gap-3">
            <Link2 className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-indigo-800">尚未配對當事人</h3>
              <p className="text-sm text-indigo-700 mt-1 mb-3">
                產生邀請碼並提供給當事人完成配對
              </p>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => inviteMutation.mutate()}
                  loading={inviteMutation.isPending}
                  size="sm"
                >
                  產生邀請碼
                </Button>
                {generatedCode && (
                  <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-indigo-200">
                    <code className="text-sm font-mono font-bold text-indigo-700">
                      {generatedCode}
                    </code>
                    <button
                      onClick={copyCode}
                      className="text-indigo-500 hover:text-indigo-700"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {isPaired && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-yellow-200 bg-yellow-50 md:col-span-1">
              <div className="text-center">
                <ClipboardCheck className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-yellow-700">
                  {summary.pendingCount || 0}
                </p>
                <p className="text-sm text-yellow-600 mt-1">待審核紀錄</p>
                {(summary.pendingCount || 0) > 0 && (
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate('/review')}
                  >
                    前往審核
                  </Button>
                )}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">本月收入</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {formatCurrency(summary.thisMonth?.income || 0)}
                  </p>
                </div>
                <div className="bg-green-50 p-2.5 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">本月支出</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {formatCurrency(summary.thisMonth?.expense || 0)}
                  </p>
                </div>
                <div className="bg-red-50 p-2.5 rounded-xl">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">本月還款</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {formatCurrency(summary.thisMonth?.repayment || 0)}
                  </p>
                </div>
                <div className="bg-indigo-50 p-2.5 rounded-xl">
                  <Wallet className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardTitle>還款計畫執行率</CardTitle>
              {summary.planExecutionRate !== null && summary.planExecutionRate !== undefined ? (
                <div className="mt-4 space-y-4">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-indigo-600">
                      {Math.round(summary.planExecutionRate || 0)}%
                    </p>
                    <p className="text-sm text-gray-500 mt-1">累計執行率</p>
                  </div>
                  <ProgressBar
                    value={summary.planExecutionRate || 0}
                    max={100}
                    color={
                      (summary.planExecutionRate || 0) >= 80
                        ? 'green'
                        : (summary.planExecutionRate || 0) >= 50
                        ? 'yellow'
                        : 'red'
                    }
                  />
                </div>
              ) : (
                <EmptyState title="尚無還款計畫" />
              )}
            </Card>

            <Card>
              <CardTitle>債務總覽</CardTitle>
              {summary.debts?.length > 0 ? (
                <div className="space-y-3 mt-4">
                  {summary.debts.map((debt) => (
                    <div key={debt.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{debt.name}</p>
                        <p className="text-xs text-gray-500">{debt.creditor}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(debt.currentBalance)}
                        </p>
                        <p className="text-xs text-gray-500">
                          / {formatCurrency(debt.originalAmount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="尚無債務紀錄" />
              )}
            </Card>
          </div>

          <Card>
            <CardTitle>月度趨勢</CardTitle>
            <MonthlyBarChart data={summary.monthlyTrend || []} />
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>待審核紀錄</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/review')}>
                查看全部
              </Button>
            </div>
            {summary.pendingTransactions?.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {summary.pendingTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg"
                    onClick={() => navigate(`/review/${tx.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Badge color={TYPE_COLORS[tx.type]}>{TYPE_LABELS[tx.type]}</Badge>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {tx.category?.name || tx.description}
                        </p>
                        <p className="text-xs text-gray-500">{formatDate(tx.date)}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="沒有待審核紀錄" message="所有紀錄已審核完畢" />
            )}
          </Card>
        </>
      )}

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
