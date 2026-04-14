import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Target } from 'lucide-react';
import Card, { CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import EmptyState from '../../components/ui/EmptyState';
import ProgressBar from '../../components/ui/ProgressBar';
import Table, { Thead, Tbody, Th, Td } from '../../components/ui/Table';
import { getPlans, getPlanProgress } from '../../services/api';
import { formatCurrency } from '../../utils/format';

export default function PlanPage() {
  const navigate = useNavigate();

  const { data: plansData, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => getPlans().then((r) => r.data),
  });

  const plans = plansData?.data?.plans || plansData?.data || [];
  const activePlan = plans.find((p) => p.status === 'ACTIVE') || plans[0];

  const { data: progressData } = useQuery({
    queryKey: ['planProgress', activePlan?.id],
    queryFn: () => getPlanProgress(activePlan.id).then((r) => r.data),
    enabled: !!activePlan?.id,
  });

  if (isLoading) return <Loading />;

  const progress = progressData?.data;

  if (!activePlan) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">還款計畫</h1>
        </div>
        <Card>
          <EmptyState
            icon={Target}
            title="尚無還款計畫"
            message="建立還款計畫來規劃您的債務償還進度"
            actionLabel="建立計畫"
            onAction={() => navigate('/plan/new')}
          />
        </Card>
      </div>
    );
  }

  const items = progress?.items || [];
  const totalPlanned = progress?.totalPlanned ?? items.reduce((sum, i) => sum + (i.plannedTotal || 0), 0);
  const totalActual = progress?.totalActual ?? items.reduce((sum, i) => sum + (i.actualTotal || 0), 0);
  const overallProgress = progress?.executionRate ?? (totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">還款計畫</h1>
        <Button onClick={() => navigate('/plan/new')}>
          <Plus className="h-4 w-4" />
          新增計畫
        </Button>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle>{activePlan.name || '還款計畫'}</CardTitle>
            {activePlan.note && (
              <p className="text-sm text-gray-500 mt-1">{activePlan.note}</p>
            )}
          </div>
        </div>

        <div className="bg-indigo-50 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-indigo-700">整體進度</span>
            <span className="text-sm font-bold text-indigo-700">
              {Math.round(overallProgress)}%
            </span>
          </div>
          <ProgressBar
            value={totalActual}
            max={totalPlanned}
            color="indigo"
            showLabel={false}
            size="lg"
          />
          <div className="flex justify-between mt-2 text-xs text-indigo-600">
            <span>已還 {formatCurrency(totalActual)}</span>
            <span>目標 {formatCurrency(totalPlanned)}</span>
          </div>
        </div>

        {items.length > 0 ? (
          <Table>
            <Thead>
              <tr>
                <Th>債務名稱</Th>
                <Th>每月計畫</Th>
                <Th>累計計畫</Th>
                <Th>累計已還</Th>
                <Th>進度</Th>
              </tr>
            </Thead>
            <Tbody>
              {items.map((item, idx) => {
                const itemProgress =
                  item.plannedTotal > 0
                    ? ((item.actualTotal || 0) / item.plannedTotal) * 100
                    : 0;
                return (
                  <tr key={idx}>
                    <Td className="font-medium">{item.debtName || '-'}</Td>
                    <Td>{formatCurrency(item.monthlyPlanned)}</Td>
                    <Td>{formatCurrency(item.plannedTotal)}</Td>
                    <Td>
                      <span
                        className={
                          item.onTrack
                            ? 'text-green-600 font-semibold'
                            : 'text-gray-900'
                        }
                      >
                        {formatCurrency(item.actualTotal || 0)}
                      </span>
                    </Td>
                    <Td className="w-40">
                      <ProgressBar
                        value={item.actualTotal || 0}
                        max={item.plannedTotal}
                        color={itemProgress >= 100 ? 'green' : itemProgress >= 50 ? 'yellow' : 'red'}
                        showLabel={false}
                        size="sm"
                      />
                    </Td>
                  </tr>
                );
              })}
            </Tbody>
          </Table>
        ) : (
          <EmptyState title="尚無計畫項目" />
        )}
      </Card>
    </div>
  );
}
