import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Card, { CardTitle } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import {
  getTransaction,
  createTransaction,
  updateTransaction,
  getCategories,
  getDebts,
  uploadFile,
} from '../../services/api';
import { TRANSACTION_TYPES } from '../../utils/constants';

export default function TransactionFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'EXPENSE',
    amount: '',
    categoryId: '',
    description: '',
    debtId: '',
    attachmentUrl: '',
  });
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => getTransaction(id).then((r) => r.data),
    enabled: isEdit,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories().then((r) => r.data),
  });

  const { data: debtsData } = useQuery({
    queryKey: ['debts'],
    queryFn: () => getDebts().then((r) => r.data),
  });

  useEffect(() => {
    if (txData?.data) {
      const tx = txData.data;
      setForm({
        date: tx.date?.split('T')[0] || '',
        type: tx.type || 'EXPENSE',
        amount: tx.amount?.toString() || '',
        categoryId: tx.categoryId?.toString() || '',
        description: tx.description || '',
        debtId: tx.debtId?.toString() || '',
        attachmentUrl: tx.attachmentUrl || '',
      });
    }
  }, [txData]);

  const categories = categoriesData?.data?.categories || categoriesData?.data || [];
  const debts = debtsData?.data?.debts || debtsData?.data || [];

  // REPAYMENT transactions use EXPENSE categories (還款本質上是一種支出)
  const categoryTypeForFilter = form.type === 'REPAYMENT' ? 'EXPENSE' : form.type;
  const filteredCategories = categories
    .filter((c) => c.type === categoryTypeForFilter)
    .map((c) => ({ value: c.id.toString(), label: c.name }));

  const debtOptions = debts
    .filter((d) => d.status === 'ACTIVE')
    .map((d) => ({ value: d.id.toString(), label: `${d.name} (${d.creditor})` }));

  const isApproved = txData?.data?.status === 'APPROVED';

  const createMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      toast.success('紀錄已新增');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      navigate('/transactions');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || '新增失敗');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateTransaction(id, data),
    onSuccess: () => {
      toast.success('紀錄已更新');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
      navigate(`/transactions/${id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || '更新失敗');
    },
  });

  const validate = () => {
    const errs = {};
    if (!form.date) errs.date = '請選擇日期';
    if (!form.type) errs.type = '請選擇類型';
    if (!form.amount || Number(form.amount) <= 0) errs.amount = '請輸入有效金額';
    if (!form.categoryId) errs.categoryId = '請選擇分類';
    if (form.type === 'REPAYMENT' && !form.debtId) errs.debtId = '請選擇對應債務';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      date: form.date,
      type: form.type,
      amount: Number(form.amount),
      categoryId: form.categoryId,
      description: form.description,
      ...(form.attachmentUrl ? { attachmentUrl: form.attachmentUrl } : {}),
      ...(form.type === 'REPAYMENT' && form.debtId
        ? { debtId: form.debtId }
        : {}),
    };

    if (isEdit) {
      // Include version for optimistic locking (H-01)
      payload.version = txData?.data?.version || 1;
      updateMutation.mutate({ id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('檔案大小不可超過 5MB');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await uploadFile(fd);
      update('attachmentUrl', res.data?.data?.url || '');
      toast.success('收據已上傳');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || '上傳失敗');
    } finally {
      setUploading(false);
    }
  };

  if (isEdit && txLoading) return <Loading />;

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
        <CardTitle>{isEdit ? '編輯收支紀錄' : '新增收支紀錄'}</CardTitle>

        {isApproved && (
          <div className="mt-2 mb-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-700">
            此紀錄已核實，無法編輯
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <Input
            label="日期"
            type="date"
            value={form.date}
            onChange={(e) => update('date', e.target.value)}
            error={errors.date}
            disabled={isApproved}
          />

          <Select
            label="類型"
            options={TRANSACTION_TYPES}
            value={form.type}
            onChange={(e) => {
              const newType = e.target.value;
              const oldType = form.type;
              update('type', newType);
              // 只在切換到不同分類組別時才清空 categoryId
              // REPAYMENT 和 EXPENSE 共用支出分類，切換時保留
              const oldGroup = oldType === 'REPAYMENT' ? 'EXPENSE' : oldType;
              const newGroup = newType === 'REPAYMENT' ? 'EXPENSE' : newType;
              if (oldGroup !== newGroup) {
                update('categoryId', '');
              }
              // 切離 REPAYMENT 時清空 debtId
              if (newType !== 'REPAYMENT') {
                update('debtId', '');
              }
            }}
            error={errors.type}
            disabled={isApproved}
          />

          <Input
            label="金額"
            type="number"
            placeholder="0"
            min="0"
            step="1"
            value={form.amount}
            onChange={(e) => update('amount', e.target.value)}
            error={errors.amount}
            disabled={isApproved}
          />

          <Select
            label="分類"
            options={filteredCategories}
            value={form.categoryId}
            onChange={(e) => update('categoryId', e.target.value)}
            error={errors.categoryId}
            placeholder="請選擇分類"
            disabled={isApproved}
          />

          {form.type === 'REPAYMENT' && (
            <Select
              label="對應債務"
              options={debtOptions}
              value={form.debtId}
              onChange={(e) => update('debtId', e.target.value)}
              error={errors.debtId}
              placeholder="請選擇債務"
              disabled={isApproved}
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              描述
            </label>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
              placeholder="輸入備註..."
              disabled={isApproved}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              收據附件（jpg/png/pdf，最大 5MB）
            </label>
            {form.attachmentUrl ? (
              <div className="flex items-center gap-2">
                <a
                  href={import.meta.env.DEV ? `http://localhost:3001${form.attachmentUrl}` : form.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-indigo-600 hover:underline"
                >
                  查看已上傳檔案
                </a>
                {!isApproved && (
                  <button
                    type="button"
                    onClick={() => update('attachmentUrl', '')}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    移除
                  </button>
                )}
              </div>
            ) : (
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileUpload}
                disabled={isApproved || uploading}
                className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
              />
            )}
            {uploading && <p className="text-xs text-gray-500 mt-1">上傳中…</p>}
          </div>

          {!isApproved && (
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={isPending}>
                {isEdit ? '儲存變更' : '新增紀錄'}
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)}>
                取消
              </Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
