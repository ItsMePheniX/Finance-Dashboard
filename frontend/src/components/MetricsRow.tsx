import { TrendingUp, TrendingDown, Wallet, Receipt } from 'lucide-react';
import type { MetricCard } from '../types';

const iconMap: Record<string, React.ElementType> = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  wallet: Wallet,
  receipt: Receipt,
};

const trendColors: Record<string, { bg: string; text: string }> = {
  up: { bg: 'var(--color-accent-green-soft)', text: 'var(--color-accent-green)' },
  down: { bg: 'var(--color-accent-red-soft)', text: 'var(--color-accent-red)' },
  neutral: { bg: 'transparent', text: 'var(--color-text-muted)' },
};

interface MetricsRowProps {
  metrics: MetricCard[];
}

function formatCurrency(value: number, prefix?: string): string {
  if (prefix === '₹') {
    return `₹${value.toLocaleString('en-IN')}`;
  }
  return value.toLocaleString('en-IN');
}

export default function MetricsRow({ metrics }: MetricsRowProps) {
  return (
    <div
      id="metrics-row"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
      }}
    >
      {metrics.map((metric, i) => {
        const Icon = iconMap[metric.icon];
        const trend = trendColors[metric.trend];
        return (
          <div
            key={metric.id}
            id={`metric-${metric.id}`}
            className={`animate-fade-in stagger-${i + 1}`}
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-card)',
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'all 0.25s ease',
              cursor: 'default',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-accent-blue)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-card)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                }}
              >
                {metric.title}
              </span>
              {Icon && (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-accent-blue-glow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={16} color="var(--color-accent-blue)" />
                </div>
              )}
            </div>

            <div
              className="animate-count-up"
              style={{
                fontSize: '28px',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--color-text-primary)',
                lineHeight: 1.1,
              }}
            >
              {formatCurrency(metric.value, metric.prefix)}
            </div>

            {(metric.delta !== undefined || metric.deltaLabel) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {metric.delta !== undefined && (
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: trend.text,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : ''}
                    {metric.delta}%
                  </span>
                )}
                {metric.deltaLabel && (
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {metric.deltaLabel}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
