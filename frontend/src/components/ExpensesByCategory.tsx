import type { CategoryExpense } from '../types';

interface ExpensesByCategoryProps {
  categories: CategoryExpense[];
}

export default function ExpensesByCategory({ categories }: ExpensesByCategoryProps) {
  return (
    <div
      id="expenses-by-category"
      className="animate-fade-in stagger-4"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-card)',
        padding: '24px',
        width: '360px',
        minWidth: '320px',
      }}
    >
      <h2
        style={{
          fontSize: '16px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginBottom: '20px',
        }}
      >
        Expenses by category
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {categories.map((cat, idx) => (
          <div key={cat.name} className={`animate-fade-in stagger-${idx + 1}`}>
            {/* Label row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                }}
              >
                {cat.name}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                }}
              >
                ₹{cat.amount.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Progress bar */}
            <div
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: 'var(--color-bg-dark)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${cat.percentage}%`,
                  height: '100%',
                  borderRadius: '3px',
                  backgroundColor: cat.color,
                  transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
