import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CategoryExpense, MetricCard, MonthlyData, TimePeriod, Transaction } from '../types';
import TopBar from '../components/TopBar';
import MetricsRow from '../components/MetricsRow';
import MonthlyTrendChart from '../components/MonthlyTrendChart';
import ExpensesByCategory from '../components/ExpensesByCategory';
import RecentTransactions from '../components/RecentTransactions';
import CreateRecordModal from '../components/CreateRecordModal';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';

type SummaryRecord = {
  id: string;
  category: string;
  amount: number;
  type: 'income' | 'expense';
  currency: string;
  note: string;
  record_date: string;
};

type SummaryResponse = {
  summary: {
    total_income: number;
    total_expenses: number;
    net_balance: number;
    recent_activity: SummaryRecord[];
  };
};

type CategoryResponse = {
  totals: Array<{
    type: 'income' | 'expense';
    category: string;
    amount: number;
  }>;
};

type TrendsResponse = {
  trends: Array<{
    period: string;
    total_income: number;
    total_expense: number;
    net_balance: number;
  }>;
};

const categoryColors = ['#4f8cff', '#2dd4bf', '#fbbf24', '#a78bfa', '#5c6078', '#f87171'];

const skeletonShimmerStyle: CSSProperties = {
  background:
    'linear-gradient(90deg, rgba(46, 51, 72, 0.45) 20%, rgba(92, 96, 120, 0.34) 40%, rgba(46, 51, 72, 0.45) 60%)',
  backgroundSize: '220% 100%',
  animation: 'shimmer 1.25s linear infinite',
};

function SkeletonBlock({
  height,
  width = '100%',
  borderRadius = 'var(--radius-md)',
}: {
  height: number | string;
  width?: number | string;
  borderRadius?: string;
}) {
  return (
    <div
      style={{
        ...skeletonShimmerStyle,
        width,
        height,
        borderRadius,
      }}
    />
  );
}

function DashboardLoadingAnimation() {
  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '20px',
        }}
      >
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={`metric-loading-${idx + 1}`}
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-card)',
              backgroundColor: 'var(--color-bg-card)',
              padding: '18px',
              display: 'grid',
              gap: '12px',
            }}
          >
            <SkeletonBlock height={12} width="44%" />
            <SkeletonBlock height={28} width="62%" />
            <SkeletonBlock height={10} width="36%" />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div
          style={{
            flex: 2,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-card)',
            backgroundColor: 'var(--color-bg-card)',
            padding: '20px',
          }}
        >
          <SkeletonBlock height={14} width="38%" />
          <div
            style={{
              marginTop: '18px',
              height: '220px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
            }}
          >
            {Array.from({ length: 8 }).map((_, idx) => (
              <SkeletonBlock
                key={`trend-loading-${idx + 1}`}
                width="100%"
                height={`${90 + ((idx * 17) % 110)}px`}
                borderRadius="10px"
              />
            ))}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-card)',
            backgroundColor: 'var(--color-bg-card)',
            padding: '20px',
            display: 'grid',
            gap: '12px',
          }}
        >
          <SkeletonBlock height={14} width="58%" />
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={`category-loading-${idx + 1}`}
              style={{ display: 'grid', gap: '8px' }}
            >
              <SkeletonBlock height={10} width="64%" />
              <SkeletonBlock height={8} width="100%" borderRadius="999px" />
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-card)',
          backgroundColor: 'var(--color-bg-card)',
          padding: '20px',
          display: 'grid',
          gap: '12px',
        }}
      >
        <SkeletonBlock height={14} width="28%" />
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={`transaction-loading-${idx + 1}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '42px 1fr 110px',
              gap: '14px',
              alignItems: 'center',
            }}
          >
            <SkeletonBlock height={42} width={42} borderRadius="var(--radius-md)" />
            <div style={{ display: 'grid', gap: '8px' }}>
              <SkeletonBlock height={12} width="62%" />
              <SkeletonBlock height={10} width="34%" />
            </div>
            <SkeletonBlock height={12} width="72%" />
          </div>
        ))}
      </div>
    </>
  );
}

function monthLabel(period: string): string {
  const date = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString('en-IN', { month: 'short' });
}

function dateRangeFor(period: TimePeriod): { start?: string; end?: string } {
  const today = new Date();
  const iso = (dt: Date) => dt.toISOString().slice(0, 10);

  if (period === 'this_month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: iso(start), end: iso(today) };
  }

  if (period === 'last_3_months') {
    const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    return { start: iso(start), end: iso(today) };
  }

  if (period === 'last_6_months') {
    const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    return { start: iso(start), end: iso(today) };
  }

  return {};
}

function queryFromPeriod(period: TimePeriod): string {
  const range = dateRangeFor(period);
  const params = new URLSearchParams();
  if (range.start) params.set('start_date', range.start);
  if (range.end) params.set('end_date', range.end);
  return params.toString() ? `?${params.toString()}` : '';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activePeriod, setActivePeriod] = useState<TimePeriod>('this_month');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<SummaryResponse['summary'] | null>(null);
  const [totals, setTotals] = useState<CategoryResponse['totals']>([]);
  const [trends, setTrends] = useState<TrendsResponse['trends']>([]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    const query = queryFromPeriod(activePeriod);

    try {
      const [summaryData, totalData, trendData] = await Promise.all([
        apiRequest<SummaryResponse>(`/api/summaries${query}`),
        apiRequest<CategoryResponse>(`/api/summaries/by-category${query}`),
        apiRequest<TrendsResponse>(`/api/summaries/trends${query}`),
      ]);

      setSummary(summaryData.summary);
      setTotals(totalData.totals ?? []);
      setTrends(trendData.trends ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activePeriod]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const metrics = useMemo<MetricCard[]>(() => {
    const income = summary?.total_income ?? 0;
    const expenses = summary?.total_expenses ?? 0;
    const net = summary?.net_balance ?? income - expenses;
    const count = summary?.recent_activity?.length ?? 0;

    return [
      {
        id: 'total-income',
        title: 'Total income',
        value: income,
        prefix: '₹',
        trend: 'up',
        icon: 'trending-up',
      },
      {
        id: 'total-expenses',
        title: 'Total expenses',
        value: expenses,
        prefix: '₹',
        trend: 'down',
        icon: 'trending-down',
      },
      {
        id: 'net-balance',
        title: 'Net balance',
        value: net,
        prefix: '₹',
        trend: net >= 0 ? 'up' : 'down',
        icon: 'wallet',
      },
      {
        id: 'transactions-count',
        title: 'Transactions',
        value: count,
        trend: 'neutral',
        icon: 'receipt',
      },
    ];
  }, [summary]);

  const recentTransactions = useMemo<Transaction[]>(() => {
    return (summary?.recent_activity ?? []).map((rec) => ({
      id: rec.id,
      description: rec.note?.trim() || rec.category,
      vendor: rec.currency,
      category: rec.category,
      type: rec.type,
      amount: rec.amount,
      date: new Date(rec.record_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      icon: rec.type === 'income' ? '💰' : '💸',
    }));
  }, [summary]);

  const categoryExpenses = useMemo<CategoryExpense[]>(() => {
    const expenseTotals = totals.filter((item) => item.type === 'expense');
    const totalAmount = expenseTotals.reduce((sum, item) => sum + item.amount, 0);

    return expenseTotals.slice(0, 6).map((item, idx) => ({
      name: item.category,
      amount: item.amount,
      color: categoryColors[idx % categoryColors.length],
      percentage: totalAmount > 0 ? Math.max(4, Math.round((item.amount / totalAmount) * 100)) : 0,
    }));
  }, [totals]);

  const monthlyData = useMemo<MonthlyData[]>(() => {
    return trends.map((item) => ({
      month: monthLabel(item.period),
      income: item.total_income,
      expenses: item.total_expense,
    }));
  }, [trends]);

  return (
    <>
      <TopBar
        activePeriod={activePeriod}
        onPeriodChange={setActivePeriod}
        userRole={user?.role ?? 'NormalUser'}
        onAddRecord={() => setShowCreateModal(true)}
      />
      <div
        style={{
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {error && (
          <div
            style={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              backgroundColor: 'var(--color-accent-red-soft)',
              padding: '10px 12px',
              color: 'var(--color-accent-red)',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: 'var(--color-text-muted)',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-accent-blue)',
                  animation: 'pulse-glow 1.1s ease-in-out infinite',
                }}
              />
              Loading dashboard data...
            </div>
            <DashboardLoadingAnimation />
          </>
        ) : (
          <>
            <MetricsRow metrics={metrics} />
            <div style={{ display: 'flex', gap: '20px' }}>
              <MonthlyTrendChart data={monthlyData} />
              <ExpensesByCategory categories={categoryExpenses} />
            </div>
            <RecentTransactions
              transactions={recentTransactions}
              onViewAll={() => navigate('/transactions')}
            />
          </>
        )}
      </div>

      <CreateRecordModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={loadDashboardData}
        title="Add record"
      />
    </>
  );
}
