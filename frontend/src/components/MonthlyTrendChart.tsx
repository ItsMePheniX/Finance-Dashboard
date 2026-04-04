import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlyData } from '../types';

interface MonthlyTrendChartProps {
  data: MonthlyData[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-card)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      }}
    >
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
        {label}
      </p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ fontSize: '12px', color: entry.color, marginBottom: 2 }}>
          {entry.name}: ₹{entry.value.toLocaleString('en-IN')}
        </p>
      ))}
    </div>
  );
}

export default function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  return (
    <div
      id="monthly-trend-chart"
      className="animate-fade-in stagger-3"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-card)',
        padding: '24px',
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ marginBottom: '20px' }}>
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            marginBottom: '4px',
          }}
        >
          Monthly trend
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          Income vs expenses, last 6 months
        </p>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '2px',
              backgroundColor: 'var(--color-accent-blue)',
            }}
          />
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Income</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '2px',
              backgroundColor: 'var(--color-accent-red)',
            }}
          />
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Expenses</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={3} barCategoryGap="25%">
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border-subtle)"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickFormatter={(v) => `${v / 1000}k`}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar
            dataKey="income"
            name="Income"
            fill="var(--color-accent-blue)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="expenses"
            name="Expenses"
            fill="var(--color-accent-red)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
