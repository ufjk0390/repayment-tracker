import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Card, { CardTitle } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import { getDebt, createDebt, updateDebt } from '../../services/api';

export default function DebtFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState({
    name: '',
    creditor: '',
    originalAmount: '',
    monthlyDue: '',
    dueDay: '',
    note: '',
  });
  const [errors, setErrors] = useState({});

  const { data: debtData, isLoading } = useQuery({
    queryKey: ['debt', id],
    queryFn: () => getDebt(id).then((r) => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (debtData?.data) {
      const d = debtData.data;
      setForm({
        name: d.name || '',
        creditor: d.creditor || '',
        originalAmount: d.originalAmount?.toString() || '',
        monthlyDue: d.monthlyDue?.toString() || '',
        dueDay: d.dueDay?.toString() || '',
        note: d.note || '',
      });
    }
  }, [debtData]);

  const createMutation = useMutation({
    mutationFn: createDebt,
    onSuccess: () => {
      toast.success('債務已新增');
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      navigate('/debts');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || '新增失敗');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateDebt(id, data),
    onSuccess: () => {
      toast.success('債務已更新');
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt', id] });
      navigate(`/debts/${id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || '更新失敗');
    },
  });

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = '請輸入債務名稱';
    if (!form.creditor.trim()) errs.creditor = '請輸入債權人';
    if (!form.originalAmount || Number(form.originalAmount) <= 0)
      errs.originalAmount = '請輸入有效金額';
    if (!form.monthlyDue || Number(form.monthlyDue) <= 0)
      errs.monthlyDue = '請輸入每月應還金額';
    if (!form.dueDay || Number(form.dueDay) < 1 || Number(form.dueDay) > 31)
      errs.dueDay = '請輸入有效日期 (1-31)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      creditor: form.creditor.trim(),
      originalAmount: Number(form.originalAmount),
      monthlyDue: Number(form.monthlyDue),
      dueDay: Number(form.dueDay),
      note: form.note.trim(),
    };

    if (isEdit) {
      updateMutation.mutate({ id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEdit && isLoading) return <Loading />;

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
        <CardTitle>{isEdit ? '編輯債務' : '新增債務'}</CardTitle>
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <Input
            label="債務名稱"
            placeholder="例如：信用卡分期"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            error={errors.name}
          />

          <Input
            label="債權人"
            placeholder="例如：中信銀行"
            value={form.creditor}
            onChange={(e) => update('creditor', e.target.value)}
            error={errors.creditor}
          />

          <Input
            label="原始金額"
            type="number"
            placeholder="0"
            min="0"
            value={form.originalAmount}
            onChange={(e) => update('originalAmount', e.target.value)}
            error={errors.originalAmount}
          />

          <Input
            label="每月應還金額"
            type="number"
            placeholder="0"
            min="0"
            value={form.monthlyDue}
            onChange={(e) => update('monthlyDue', e.target.value)}
            error={errors.monthlyDue}
          />

          <Input
            label="繳款日（每月幾號）"
            type="number"
            placeholder="1-31"
            min="1"
            max="31"
            value={form.dueDay}
            onChange={(e) => update('dueDay', e.target.value)}
            error={errors.dueDay}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              備註
            </label>
            <textarea
              value={form.note}
              onChange={(e) => update('note', e.target.value)}
              rows={3}
              placeholder="輸入備註..."
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={isPending}>
              {isEdit ? '儲存變更' : '新增債務'}
            </Button>
            <Button variant="outline" onClick={() => navigate(-1)}>
              取消
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
