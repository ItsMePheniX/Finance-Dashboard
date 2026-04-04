import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight } from 'lucide-react';
import { apiRequest } from '../api/client';

type SummaryResponse = {
  summary: {
    total_income: number;
    total_expenses: number;
    net_balance: number;
  };
};

type TotalsResponse = {
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

type RecordsResponse = {
  records: Array<{
    type: 'income' | 'expense';
    amount: number;
    record_date: string;
  }>;
};

type View = 'overview' | 'income' | 'expenses';

function monthLabel(period: string): string {
  const date = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString('en-IN', { month: 'short' });
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function percentageDelta(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-card)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      }}
    >
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
        {label}
      </p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ fontSize: '12px', color: entry.color || entry.stroke, marginBottom: 1 }}>
          {entry.name}: {formatCurrency(Number(entry.value ?? 0))}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [view, setView] = useState<View>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<SummaryResponse['summary'] | null>(null);
  const [totals, setTotals] = useState<TotalsResponse['totals']>([]);
  const [trends, setTrends] = useState<TrendsResponse['trends']>([]);
  const [records, setRecords] = useState<RecordsResponse['records']>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const [summaryData, totalsData, trendsData, recordsData] = await Promise.all([
          apiRequest<SummaryResponse>('/api/summaries'),
          apiRequest<TotalsResponse>('/api/summaries/by-category'),
          apiRequest<TrendsResponse>('/api/summaries/trends'),
          apiRequest<RecordsResponse>('/api/records?limit=500'),
        ]);

        setSummary(summaryData.summary);
        setTotals(totalsData.totals ?? []);
        setTrends(trendsData.trends ?? []);
        setRecords(recordsData.records ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load analytics data';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const monthlyRevenue = useMemo(() => {
    return trends.map((item) => ({
      month: monthLabel(item.period),
      income: item.total_income,
      expenses: item.total_expense,
      net: item.net_balance,
    }));
  }, [trends]);

  const cashFlow = useMemo(() => {
    let running = 0;
    return monthlyRevenue.map((item) => {
      running += item.income - item.expenses;
      return {
        month: item.month,
        balance: running,
      };
    });
  }, [monthlyRevenue]);

  const categoryData = useMemo(() => {
    const typeFilter = view === 'income' ? 'income' : 'expense';
    const filtered = totals.filter((item) => item.type === typeFilter);
    const colors = ['#4f8cff', '#2dd4bf', '#fbbf24', '#a78bfa', '#5c6078', '#f87171'];

    return filtered.slice(0, 6).map((item, idx) => ({
      name: item.category,
      value: item.amount,
      color: colors[idx % colors.length],
    }));
  }, [totals, view]);

  const weeklySeries = useMemo(() => {
    const now = new Date();
    const wantType = view === 'income' ? 'income' : 'expense';
    const weeks = new Map<number, number>();

    for (const record of records) {
      if (record.type !== wantType) continue;
      const date = new Date(record.record_date);
      if (Number.isNaN(date.getTime())) continue;
      if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) continue;
      const week = Math.floor((date.getDate() - 1) / 7) + 1;
      weeks.set(week, (weeks.get(week) ?? 0) + record.amount);
    }

    return [1, 2, 3, 4, 5].map((week) => ({
      week: `W${week}`,
      amount: weeks.get(week) ?? 0,
    }));
  }, [records, view]);

  const kpis = useMemo(() => {
    const incomes = monthlyRevenue.map((item) => item.income);
    const expenses = monthlyRevenue.map((item) => item.expenses);
    const avgIncome = average(incomes);
    const avgExpense = average(expenses);

    const latestIncome = incomes[incomes.length - 1] ?? 0;
    const prevIncome = incomes[incomes.length - 2] ?? latestIncome;
    const latestExpense = expenses[expenses.length - 1] ?? 0;
    const prevExpense = expenses[expenses.length - 2] ?? latestExpense;

    const incomeDelta = percentageDelta(latestIncome, prevIncome);
    const expenseDelta = percentageDelta(latestExpense, prevExpense);

    const totalIncome = summary?.total_income ?? 0;
    const totalExpenses = summary?.total_expenses ?? 0;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
    const expenseRatio = totalIncome > 0 ? totalExpenses / totalIncome : 0;

    return [
      {
        label: 'Avg. monthly income',
        value: formatCurrency(avgIncome),
        delta: formatPercent(incomeDelta),
        up: incomeDelta >= 0,
        icon: TrendingUp,
      },
      {
        label: 'Avg. monthly expense',
        value: formatCurrency(avgExpense),
        delta: formatPercent(expenseDelta),
        up: expenseDelta <= 0,
        icon: TrendingDown,
      },
      {
        label: 'Savings rate',
        value: formatPercent(savingsRate),
        delta: totalIncome > 0 ? `${formatCurrency(summary?.net_balance ?? 0)} net` : 'No data',
        up: savingsRate >= 0,
        icon: DollarSign,
      },
      {
        label: 'Expense ratio',
        value: expenseRatio.toFixed(2),
        delta: totalIncome > 0 ? `${formatCurrency(totalExpenses)} / ${formatCurrency(totalIncome)}` : 'No data',
        up: expenseRatio <= 1,
        icon: ArrowUpRight,
      },
    ];
  }, [monthlyRevenue, summary]);

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-card)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border-card)',
    padding: '24px',
  };

  const lineColor = view === 'income' ? 'var(--color-accent-blue)' : 'var(--color-accent-amber)';
  const lineName = view === 'income' ? 'Income' : 'Spending';

  return (
    <div className="animate-fade-in" style={{ padding: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>Analytics</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Financial insights from Supabase data
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            gap: '4px',
            backgroundColor: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '4px',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          {(['overview', 'income', 'expenses'] as View[]).map((item) => (
            <button
              key={item}
              id={`analytics-${item}`}
              onClick={() => setView(item)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: view === item ? 600 : 400,
                color: view === item ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                backgroundColor: view === item ? 'var(--color-bg-card-hover)' : 'transparent',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: '16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            backgroundColor: 'var(--color-accent-red-soft)',
            color: 'var(--color-accent-red)',
            padding: '10px 12px',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Loading analytics...
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className={`animate-fade-in stagger-${i + 1}`}
              style={{
                ...cardStyle,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                transition: 'all 0.25s ease',
                cursor: 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>{kpi.label}</span>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-accent-blue-glow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={14} color="var(--color-accent-blue)" />
                </div>
              </div>
              <span style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em' }}>{kpi.value}</span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: kpi.up ? 'var(--color-accent-green)' : 'var(--color-accent-red)',
                }}
              >
                {kpi.delta}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div className="animate-fade-in stagger-3" style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Revenue vs Expenses</h2>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>Monthly totals</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyRevenue} barGap={3} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickFormatter={(v) => `${v / 1000}k`} width={36} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              {view !== 'expenses' && (
                <Bar dataKey="income" name="Income" fill="var(--color-accent-blue)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              )}
              {view !== 'income' && (
                <Bar dataKey="expenses" name="Expenses" fill="var(--color-accent-red)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="animate-fade-in stagger-4" style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Cash Flow</h2>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>Cumulative net balance</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={cashFlow}>
              <defs>
                <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent-teal)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-accent-teal)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickFormatter={(v) => `${v / 1000}k`} width={36} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="balance" name="Balance" stroke="var(--color-accent-teal)" strokeWidth={2} fill="url(#cashGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px' }}>
        <div className="animate-fade-in stagger-5" style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>
            {view === 'income' ? 'Weekly Income' : 'Weekly Spending'}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>Current month breakdown</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickFormatter={(v) => `${v / 1000}k`} width={36} />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="amount"
                name={lineName}
                stroke={lineColor}
                strokeWidth={2.5}
                dot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
                activeDot={{ r: 6, stroke: lineColor, strokeWidth: 2, fill: 'var(--color-bg-card)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="animate-fade-in stagger-5" style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>
            {view === 'income' ? 'Income Distribution' : 'Expense Distribution'}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>By category</p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {categoryData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{
                    backgroundColor: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border-card)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            {categoryData.map((item) => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: item.color }} />
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{item.name}</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {formatCurrency(item.value)}
                </span>
              </div>
            ))}
            {categoryData.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No category data available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
