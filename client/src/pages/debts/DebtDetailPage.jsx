import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import Card, { CardTitle } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import ProgressBar from '../../components/ui/ProgressBar';
import EmptyState from '../../components/ui/EmptyState';
import Table, { Thead, Tbody, Th, Td } from '../../components/ui/Table';
import { getDebt, getDebtPayments, deleteDebt } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { DEBT_STATUS_LABELS, DEBT_STATUS_COLORS } from '../../utils/constants';
import useAuthStore from '../../stores/authStore';

export default function DebtDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isUser = user?.role === 'USER';

  const { data: debtData, isLoading } = useQuery({
    queryKey: ['debt', id],
    queryFn: () => getDebt(id).then((r) => r.data),
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['debtPayments', id],
    queryFn: () => getDebtPayments(id).then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDebt(id),
    onSuccess: () => {
      toast.success('債務已刪除');
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      navigate('/debts');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || '刪除失敗');
    },
  });

  const handleDelete = () => {
    if (window.confirm('確定要刪除這筆債務嗎？')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) return <Loading />;

  const debt = debtData?.data;
  if (!debt) return <div className="text-center py-12 text-gray-500">找不到債務</div>;

  const payments = paymentsData?.data?.payments || paymentsData?.data || [];
  const paid = debt.originalAmount - (debt.currentBalance || 0);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </button>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <CardTitle>{debt.name}</CardTitle>
              <Badge color={DEBT_STATUS_COLORS[debt.status]}>
                {DEBT_STATUS_LABELS[debt.status]}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">債權人：{debt.creditor}</p>
          </div>
          {isUser && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/debts/${id}/edit`)}
              >
                <Edit className="h-4 w-4" />
                編輯
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                loading={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                刪除
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">原始金額</p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(debt.originalAmount)}
            </p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">目前餘額</p>
            <p className="text-lg font-bold text-indigo-600">
              {formatCurrency(debt.currentBalance)}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">已還金額</p>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(paid)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">每月應還</p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(debt.monthlyDue)}
            </p>
          </div>
        </div>

        <div className="mb-2">
          <p className="text-sm font-medium text-gray-700 mb-2">還款進度</p>
          <ProgressBar
            value={paid}
            max={debt.originalAmount}
            color={debt.status === 'PAID_OFF' ? 'green' : 'indigo'}
            size="lg"
          />
        </div>

        {debt.note && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">備註</p>
            <p className="text-sm text-gray-900 mt-1">{debt.note}</p>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>還款紀錄</CardTitle>
        {payments.length === 0 ? (
          <EmptyState title="尚無還款紀錄" message="待核實的還款會在核實後顯示於此" />
        ) : (
          <Table className="mt-4">
            <Thead>
              <tr>
                <Th>日期</Th>
                <Th>金額</Th>
                <Th>描述</Th>
              </tr>
            </Thead>
            <Tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <Td>{formatDate(p.date)}</Td>
                  <Td>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(p.amount)}
                    </span>
                  </Td>
                  <Td>{p.description || '-'}</Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
