import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Loading from '../../components/ui/Loading';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import Table, { Thead, Tbody, Th, Td } from '../../components/ui/Table';
import { getTransactions } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  TYPE_LABELS,
  TYPE_COLORS,
  TRANSACTION_TYPES,
  REVIEW_STATUSES,
} from '../../utils/constants';
import useAuthStore from '../../stores/authStore';

export default function TransactionListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isUser = user?.role === 'USER';

  const [filters, setFilters] = useState({
    type: '',
    status: '',
    startDate: '',
    endDate: '',
    search: '',
    page: 1,
    limit: 15,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => getTransactions(filters).then((r) => r.data),
  });

  const transactions = data?.data || [];
  const pagination = data?.pagination || {};

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const typeOptions = [{ value: '', label: '全部類型' }, ...TRANSACTION_TYPES];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isUser ? '收支紀錄' : '收支總覽'}
        </h1>
        {isUser && (
          <Button onClick={() => navigate('/transactions/new')}>
            <Plus className="h-4 w-4" />
            新增紀錄
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="w-40">
            <Select
              options={typeOptions}
              value={filters.type}
              onChange={(e) => updateFilter('type', e.target.value)}
              placeholder="全部類型"
            />
          </div>
          <div className="w-40">
            <Select
              options={REVIEW_STATUSES}
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
              placeholder="全部狀態"
            />
          </div>
          <div className="w-40">
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => updateFilter('startDate', e.target.value)}
              placeholder="開始日期"
            />
          </div>
          <div className="w-40">
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => updateFilter('endDate', e.target.value)}
              placeholder="結束日期"
            />
          </div>
          <div className="flex-1 min-w-48">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜尋描述..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="block w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <Loading />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="沒有收支紀錄"
            message={isUser ? '點擊右上角按鈕新增您的第一筆紀錄' : '當事人尚未新增收支紀錄'}
            actionLabel={isUser ? '新增紀錄' : undefined}
            onAction={isUser ? () => navigate('/transactions/new') : undefined}
          />
        ) : (
          <>
            <Table>
              <Thead>
                <tr>
                  <Th>日期</Th>
                  <Th>類型</Th>
                  <Th>分類</Th>
                  <Th>金額</Th>
                  <Th>描述</Th>
                  <Th>狀態</Th>
                  <Th>操作</Th>
                </tr>
              </Thead>
              <Tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      navigate(
                        isUser
                          ? `/transactions/${tx.id}`
                          : `/review/${tx.id}`
                      )
                    }
                  >
                    <Td>{formatDate(tx.date)}</Td>
                    <Td>
                      <Badge color={TYPE_COLORS[tx.type]}>
                        {TYPE_LABELS[tx.type]}
                      </Badge>
                    </Td>
                    <Td>{tx.category?.name || '-'}</Td>
                    <Td>
                      <span
                        className={`font-semibold ${
                          tx.type === 'INCOME'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {tx.type === 'INCOME' ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </span>
                    </Td>
                    <Td className="max-w-xs truncate">{tx.description || '-'}</Td>
                    <Td>
                      <Badge color={STATUS_COLORS[tx.status]}>
                        {STATUS_LABELS[tx.status]}
                      </Badge>
                    </Td>
                    <Td>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            isUser
                              ? `/transactions/${tx.id}`
                              : `/review/${tx.id}`
                          );
                        }}
                      >
                        查看
                      </Button>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
            <Pagination
              page={filters.page}
              totalPages={pagination.totalPages || 1}
              onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
            />
          </>
        )}
      </Card>
    </div>
  );
}
