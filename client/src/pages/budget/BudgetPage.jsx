import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, ChevronLeft, ChevronRight, Edit, Trash2, Check, X } from 'lucide-react';
import Card, { CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Loading from '../../components/ui/Loading';
import EmptyState from '../../components/ui/EmptyState';
import ProgressBar from '../../components/ui/ProgressBar';
import { getBudgets, getBudgetSummary, createBudget, updateBudget, deleteBudget, getCategories } from '../../services/api';
import { formatCurrency, formatMonth, getCurrentYearMonth } from '../../utils/format';

export default function BudgetPage() {
  const queryClient = useQueryClient();
  const { year: initYear, month: initMonth } = getCurrentYearMonth();
  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth);
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newBudget, setNewBudget] = useState({ categoryId: '', amount: '' });

  const params = { year, month };

  const { data: budgetsData, isLoading } = useQuery({
    queryKey: ['budgets', params],
    queryFn: () => getBudgets(params).then((r) => r.data),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['budgetSummary', params],
    queryFn: () => getBudgetSummary(params).then((r) => r.data),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories().then((r) => r.data),
  });

  // Use summary.categories which already contains spent/remaining/usagePercent
  const summary = summaryData?.data || {};
  const budgets = summary.categories || [];
  const categories = (categoriesData?.data?.categories || categoriesData?.data || [])
    .filter((c) => c.type === 'EXPENSE');

  const usedCategoryIds = budgets.map((b) => b.category?.id);
  const availableCategories = categories
    .filter((c) => !usedCategoryIds.includes(c.id))
    .map((c) => ({ value: c.id.toString(), label: c.name }));

  const createMutation = useMutation({
    mutationFn: createBudget,
    onSuccess: () => {
      toast.success('預算已新增');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budgetSummary'] });
      setShowAdd(false);
      setNewBudget({ categoryId: '', amount: '' });
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || '新增失敗'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateBudget(id, data),
    onSuccess: () => {
      toast.success('預算已更新');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budgetSummary'] });
      setEditingId(null);
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || '更新失敗'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => {
      toast.success('預算已刪除');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budgetSummary'] });
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || '刪除失敗'),
  });

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  const startEdit = (budget) => {
    setEditingId(budget.budgetId);
    setEditAmount(budget.limitAmount?.toString() || '');
  };

  const saveEdit = (id) => {
    if (!editAmount || Number(editAmount) <= 0) {
      toast.error('請輸入有效金額');
      return;
    }
    updateMutation.mutate({ id, data: { limitAmount: Number(editAmount) } });
  };

  const handleAdd = () => {
    if (!newBudget.categoryId) { toast.error('請選擇分類'); return; }
    if (!newBudget.amount || Number(newBudget.amount) <= 0) { toast.error('請輸入有效金額'); return; }
    createMutation.mutate({
      categoryId: newBudget.categoryId,
      limitAmount: Number(newBudget.amount),
      year,
      month,
    });
  };

  const handleDelete = (id) => {
    if (window.confirm('確定要刪除此預算嗎？')) {
      deleteMutation.mutate(id);
    }
  };

  const totalBudget = summary.totalBudget || 0;
  const totalSpent = summary.totalSpent || 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">預算設定</h1>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-lg font-semibold text-gray-900">
              {formatMonth(year, month)}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4" />
            新增預算
          </Button>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">總預算使用</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
            </span>
          </div>
          <ProgressBar
            value={totalSpent}
            max={totalBudget}
            color={totalSpent > totalBudget ? 'red' : totalSpent > totalBudget * 0.8 ? 'yellow' : 'green'}
            showLabel={false}
          />
        </div>

        {showAdd && (
          <div className="flex gap-3 items-end mb-4 bg-indigo-50 rounded-lg p-3">
            <div className="flex-1">
              <Select
                label="分類"
                options={availableCategories}
                value={newBudget.categoryId}
                onChange={(e) => setNewBudget({ ...newBudget, categoryId: e.target.value })}
                placeholder="選擇分類"
              />
            </div>
            <div className="w-40">
              <Input
                label="預算金額"
                type="number"
                placeholder="0"
                min="0"
                value={newBudget.amount}
                onChange={(e) => setNewBudget({ ...newBudget, amount: e.target.value })}
              />
            </div>
            <div className="flex gap-1 pb-0.5">
              <Button size="sm" onClick={handleAdd} loading={createMutation.isPending}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <Loading />
        ) : budgets.length === 0 ? (
          <EmptyState
            title="尚未設定預算"
            message="設定各分類的預算限額"
            actionLabel="新增預算"
            onAction={() => setShowAdd(true)}
          />
        ) : (
          <div className="space-y-3">
            {budgets.map((budget) => {
              const amount = budget.limitAmount || 0;
              const spent = budget.spent || 0;
              const remaining = amount - spent;
              const overBudget = spent > amount;
              const usage = amount > 0 ? (spent / amount) * 100 : 0;

              return (
                <div
                  key={budget.budgetId}
                  className="border border-gray-100 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      {budget.category?.name}
                    </span>
                    <div className="flex items-center gap-2">
                      {editingId === budget.budgetId ? (
                        <>
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                            min="0"
                          />
                          <button
                            onClick={() => saveEdit(budget.budgetId)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className={`text-sm font-medium ${overBudget ? 'text-red-600' : 'text-gray-700'}`}>
                            {formatCurrency(spent)} / {formatCurrency(amount)}
                          </span>
                          <button
                            onClick={() => startEdit(budget)}
                            className="text-gray-400 hover:text-indigo-600"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(budget.budgetId)}
                            className="text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <ProgressBar
                    value={spent}
                    max={amount}
                    color={overBudget ? 'red' : usage > 80 ? 'yellow' : 'green'}
                    showLabel={false}
                    size="sm"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-500">
                      已使用 {Math.round(usage)}%
                    </span>
                    <span className={`text-xs ${overBudget ? 'text-red-600' : 'text-gray-500'}`}>
                      {overBudget ? `超支 ${formatCurrency(Math.abs(remaining))}` : `剩餘 ${formatCurrency(remaining)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
