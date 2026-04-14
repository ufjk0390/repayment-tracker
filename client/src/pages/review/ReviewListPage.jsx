import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle } from 'lucide-react';
import Card, { CardTitle } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import Table, { Thead, Tbody, Th, Td } from '../../components/ui/Table';
import { getTransactions, reviewTransaction, batchReview } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { TYPE_LABELS, TYPE_COLORS } from '../../utils/constants';

export default function ReviewListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['pendingTransactions', page],
    queryFn: () =>
      getTransactions({ status: 'PENDING', page, limit: 20 }).then((r) => r.data),
  });

  const transactions = data?.data || [];
  const pagination = data?.pagination || {};

  const reviewMutation = useMutation({
    mutationFn: ({ id, data }) => reviewTransaction(id, data),
    onSuccess: () => {
      toast.success('審核完成');
      queryClient.invalidateQueries({ queryKey: ['pendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || '審核失敗'),
  });

  const batchMutation = useMutation({
    mutationFn: batchReview,
    onSuccess: () => {
      toast.success('批次審核完成');
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['pendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || '批次審核失敗'),
  });

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map((tx) => tx.id)));
    }
  };

  const handleBatchApprove = () => {
    if (selected.size === 0) {
      toast.error('請選擇要核實的紀錄');
      return;
    }
    batchMutation.mutate({
      reviews: Array.from(selected).map(id => ({ id, action: 'APPROVE' })),
    });
  };

  const handleQuickApprove = (e, id) => {
    e.stopPropagation();
    reviewMutation.mutate({ id, data: { action: 'APPROVE' } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">審核紀錄</h1>
        {selected.size > 0 && (
          <Button
            onClick={handleBatchApprove}
            loading={batchMutation.isPending}
            variant="success"
          >
            <CheckCircle className="h-4 w-4" />
            批次核實 ({selected.size})
          </Button>
        )}
      </div>

      <Card>
        {isLoading ? (
          <Loading />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="沒有待審核紀錄"
            message="所有紀錄已審核完畢"
          />
        ) : (
          <>
            <Table>
              <Thead>
                <tr>
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === transactions.length}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </Th>
                  <Th>日期</Th>
                  <Th>類型</Th>
                  <Th>金額</Th>
                  <Th>分類</Th>
                  <Th>描述</Th>
                  <Th>操作</Th>
                </tr>
              </Thead>
              <Tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/review/${tx.id}`)}
                  >
                    <Td>
                      <input
                        type="checkbox"
                        checked={selected.has(tx.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(tx.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </Td>
                    <Td>{formatDate(tx.date)}</Td>
                    <Td>
                      <Badge color={TYPE_COLORS[tx.type]}>
                        {TYPE_LABELS[tx.type]}
                      </Badge>
                    </Td>
                    <Td className="font-semibold">{formatCurrency(tx.amount)}</Td>
                    <Td>{tx.category?.name || '-'}</Td>
                    <Td className="max-w-xs truncate">{tx.description || '-'}</Td>
                    <Td>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleQuickApprove(e, tx.id)}
                          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                          title="核實"
                        >
                          <CheckCircle className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/review/${tx.id}`);
                          }}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                          title="退回"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
            <Pagination
              page={page}
              totalPages={pagination.totalPages || 1}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
