import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit, Trash2, AlertTriangle } from 'lucide-react';
import Card, { CardTitle } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import { getTransaction, deleteTransaction } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  TYPE_LABELS,
  TYPE_COLORS,
} from '../../utils/constants';

export default function TransactionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => getTransaction(id).then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTransaction(id),
    onSuccess: () => {
      toast.success('紀錄已刪除');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      navigate('/transactions');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || '刪除失敗');
    },
  });

  const handleDelete = () => {
    if (window.confirm('確定要刪除這筆紀錄嗎？')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) return <Loading />;

  const tx = data?.data;
  if (!tx) return <div className="text-center py-12 text-gray-500">找不到紀錄</div>;

  const canEdit = tx.status !== 'APPROVED';

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </button>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <CardTitle>收支紀錄詳情</CardTitle>
          {canEdit && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/transactions/${id}/edit`)}
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

        {tx.status === 'REJECTED' && tx.reviewNote && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">退回原因</span>
            </div>
            <p className="text-sm text-red-600">{tx.reviewNote}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
          <div>
            <p className="text-sm text-gray-500">日期</p>
            <p className="text-sm font-medium text-gray-900">{formatDate(tx.date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">狀態</p>
            <Badge color={STATUS_COLORS[tx.status]}>
              {STATUS_LABELS[tx.status]}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-gray-500">類型</p>
            <Badge color={TYPE_COLORS[tx.type]}>{TYPE_LABELS[tx.type]}</Badge>
          </div>
          <div>
            <p className="text-sm text-gray-500">金額</p>
            <p
              className={`text-lg font-bold ${
                tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {tx.type === 'INCOME' ? '+' : '-'}
              {formatCurrency(tx.amount)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">分類</p>
            <p className="text-sm font-medium text-gray-900">
              {tx.category?.name || '-'}
            </p>
          </div>
          {tx.debtName && (
            <div>
              <p className="text-sm text-gray-500">對應債務</p>
              <p className="text-sm font-medium text-gray-900">{tx.debt?.name}</p>
            </div>
          )}
          <div className="col-span-2">
            <p className="text-sm text-gray-500">描述</p>
            <p className="text-sm text-gray-900">{tx.description || '-'}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
