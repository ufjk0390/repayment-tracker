import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import Card, { CardTitle } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import { getTransaction, reviewTransaction } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  TYPE_LABELS,
  TYPE_COLORS,
} from '../../utils/constants';

export default function ReviewDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reviewNote, setReviewNote] = useState('');
  const [showReject, setShowReject] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => getTransaction(id).then((r) => r.data),
  });

  const reviewMutation = useMutation({
    mutationFn: (data) => reviewTransaction(id, data),
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'APPROVE' ? '已核實' : '已退回');
      queryClient.invalidateQueries({ queryKey: ['pendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      navigate('/review');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || '審核失敗');
    },
  });

  const handleApprove = () => {
    reviewMutation.mutate({ action: 'APPROVE', reviewNote: reviewNote.trim() || undefined });
  };

  const handleReject = () => {
    if (!reviewNote.trim()) {
      toast.error('退回時請輸入退回原因');
      return;
    }
    reviewMutation.mutate({ action: 'REJECT', reviewNote: reviewNote.trim() });
  };

  if (isLoading) return <Loading />;

  const tx = data?.data;
  if (!tx) return <div className="text-center py-12 text-gray-500">找不到紀錄</div>;

  const isPending = tx.status === 'PENDING';

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
          <CardTitle>審核詳情</CardTitle>
          <Badge color={STATUS_COLORS[tx.status]}>
            {STATUS_LABELS[tx.status]}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-6">
          <div>
            <p className="text-sm text-gray-500">日期</p>
            <p className="text-sm font-medium text-gray-900">{formatDate(tx.date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">類型</p>
            <Badge color={TYPE_COLORS[tx.type]}>{TYPE_LABELS[tx.type]}</Badge>
          </div>
          <div>
            <p className="text-sm text-gray-500">金額</p>
            <p className="text-lg font-bold text-gray-900">
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

        {tx.reviewNote && !isPending && (
          <div className={`mb-6 rounded-lg px-4 py-3 ${tx.status === 'REJECTED' ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            <p className={`text-sm font-medium ${tx.status === 'REJECTED' ? 'text-red-700' : 'text-green-700'}`}>
              審核備註
            </p>
            <p className={`text-sm mt-1 ${tx.status === 'REJECTED' ? 'text-red-600' : 'text-green-600'}`}>
              {tx.reviewNote}
            </p>
          </div>
        )}

        {isPending && (
          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">審核操作</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                審核備註 {showReject && <span className="text-red-500">（退回時必填）</span>}
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={3}
                placeholder={showReject ? '請輸入退回原因...' : '可選填備註...'}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="success"
                onClick={handleApprove}
                loading={reviewMutation.isPending}
              >
                <CheckCircle className="h-4 w-4" />
                核實
              </Button>
              {showReject ? (
                <Button
                  variant="danger"
                  onClick={handleReject}
                  loading={reviewMutation.isPending}
                >
                  <XCircle className="h-4 w-4" />
                  確認退回
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setShowReject(true)}>
                  <XCircle className="h-4 w-4" />
                  退回
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
