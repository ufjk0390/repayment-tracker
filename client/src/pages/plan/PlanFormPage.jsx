import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Card, { CardTitle } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import { getDebts, createPlan } from '../../services/api';

export default function PlanFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    description: '',
    items: [{ debtId: '', monthlyAmount: '' }],
  });
  const [errors, setErrors] = useState({});

  const { data: debtsData, isLoading } = useQuery({
    queryKey: ['debts'],
    queryFn: () => getDebts().then((r) => r.data),
  });

  const debts = (debtsData?.data?.debts || debtsData?.data || []).filter(
    (d) => d.status === 'ACTIVE'
  );
  const debtOptions = debts.map((d) => ({
    value: d.id.toString(),
    label: `${d.name} (${d.creditor})`,
  }));

  const createMutation = useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      toast.success('還款計畫已建立');
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      navigate('/plan');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || '建立失敗');
    },
  });

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { debtId: '', monthlyAmount: '' }],
    }));
  };

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = '請輸入計畫名稱';
    if (form.items.length === 0) errs.items = '請至少新增一個還款項目';
    form.items.forEach((item, i) => {
      if (!item.debtId) errs[`item_${i}_debtId`] = '請選擇債務';
      if (!item.monthlyAmount || Number(item.monthlyAmount) <= 0)
        errs[`item_${i}_amount`] = '請輸入有效金額';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    createMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim(),
      items: form.items.map((item) => ({
        debtId: item.debtId,
        monthlyAmount: Number(item.monthlyAmount),
      })),
    });
  };

  if (isLoading) return <Loading />;

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
        <CardTitle>建立還款計畫</CardTitle>
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <Input
            label="計畫名稱"
            placeholder="例如：2026年度還款計畫"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              計畫描述
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="輸入計畫描述..."
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                還款項目
              </label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3 w-3" />
                新增項目
              </Button>
            </div>
            {errors.items && (
              <p className="text-sm text-red-600 mb-2">{errors.items}</p>
            )}
            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div
                  key={index}
                  className="flex gap-3 items-start bg-gray-50 rounded-lg p-3"
                >
                  <div className="flex-1">
                    <Select
                      options={debtOptions}
                      value={item.debtId}
                      onChange={(e) =>
                        updateItem(index, 'debtId', e.target.value)
                      }
                      placeholder="選擇債務"
                      error={errors[`item_${index}_debtId`]}
                    />
                  </div>
                  <div className="w-40">
                    <Input
                      type="number"
                      placeholder="每月金額"
                      min="0"
                      value={item.monthlyAmount}
                      onChange={(e) =>
                        updateItem(index, 'monthlyAmount', e.target.value)
                      }
                      error={errors[`item_${index}_amount`]}
                    />
                  </div>
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 text-gray-400 hover:text-red-500 mt-0.5"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={createMutation.isPending}>
              建立計畫
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
