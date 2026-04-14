import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import Card, { CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import { exportTransactionsCsv, getMonthlyReport } from '../../services/api';
import { formatCurrency, formatMonth, getCurrentYearMonth } from '../../utils/format';

export default function ReportsPage() {
  const { year: initYear, month: initMonth } = getCurrentYearMonth();
  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth);
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['monthlyReport', year, month],
    queryFn: () => getMonthlyReport({ year, month }).then((r) => r.data),
  });

  const summary = data?.data?.summary;

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  const handleExport = async () => {
    setDownloading(true);
    try {
      const res = await exportTransactionsCsv({ year, month });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transactions-${year}-${String(month).padStart(2, '0')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('CSV 已下載');
    } catch (err) {
      toast.error('匯出失敗');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">報表</h1>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-lg font-semibold text-gray-900">
              {formatMonth(year, month)}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <Button onClick={handleExport} loading={downloading}>
            <Download className="h-4 w-4" />
            匯出 CSV
          </Button>
        </div>

        {isLoading ? (
          <Loading />
        ) : summary ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-green-50 border-green-200">
              <p className="text-sm text-green-700">收入</p>
              <p className="text-2xl font-bold text-green-700 mt-1">
                {formatCurrency(summary.income.total)}
              </p>
              <p className="text-xs text-green-600 mt-1">{summary.income.count} 筆</p>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <p className="text-sm text-red-700">支出</p>
              <p className="text-2xl font-bold text-red-700 mt-1">
                {formatCurrency(summary.expense.total)}
              </p>
              <p className="text-xs text-red-600 mt-1">{summary.expense.count} 筆</p>
            </Card>
            <Card className="bg-indigo-50 border-indigo-200">
              <p className="text-sm text-indigo-700">還款</p>
              <p className="text-2xl font-bold text-indigo-700 mt-1">
                {formatCurrency(summary.repayment.total)}
              </p>
              <p className="text-xs text-indigo-600 mt-1">{summary.repayment.count} 筆</p>
            </Card>
            <Card className="bg-gray-50 border-gray-200">
              <p className="text-sm text-gray-700">淨收入</p>
              <p className={`text-2xl font-bold mt-1 ${summary.netIncome >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                {formatCurrency(summary.netIncome)}
              </p>
              <p className="text-xs text-gray-600 mt-1">收入 - 支出 - 還款</p>
            </Card>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">無資料</p>
        )}
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-indigo-600 mt-0.5" />
          <div>
            <CardTitle>關於報表</CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              月度報表彙整當月已核實（APPROVED）的交易資料。匯出的 CSV 採用 UTF-8 with BOM 編碼，可直接以 Excel 開啟。
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
