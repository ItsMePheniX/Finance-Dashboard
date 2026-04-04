import { ArrowUpRight } from 'lucide-react';
import type { Transaction } from '../types';

interface RecentTransactionsProps {
  transactions: Transaction[];
  onViewAll?: () => void;
}

export default function RecentTransactions({ transactions, onViewAll }: RecentTransactionsProps) {
  return (
    <div
      id="recent-transactions"
      className="animate-fade-in stagger-5"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-card)',
        padding: '24px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              marginBottom: '2px',
            }}
          >
            Recent transactions
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Last 5 entries</p>
        </div>
        <button
          id="view-all-btn"
          onClick={onViewAll}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-card)',
            backgroundColor: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent-blue)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-card)';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          View all
          <ArrowUpRight size={14} />
        </button>
      </div>

      {/* Transactions list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {transactions.length === 0 && (
          <div
            style={{
              padding: '14px 8px',
              color: 'var(--color-text-muted)',
              fontSize: '13px',
            }}
          >
            No recent transactions match your search.
          </div>
        )}

        {transactions.map((txn, idx) => (
          <div
            key={txn.id}
            id={`txn-row-${txn.id}`}
            className={`animate-fade-in stagger-${idx + 1}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '42px 1fr auto',
              alignItems: 'center',
              gap: '14px',
              padding: '14px 8px',
              borderRadius: 'var(--radius-md)',
              transition: 'background-color 0.15s ease',
              cursor: 'default',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-card-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}
            >
              {txn.icon}
            </div>

            {/* Details */}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {txn.description} — {txn.vendor}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{txn.category}</span>
                <span>·</span>
                <span>{txn.date}</span>
              </div>
            </div>

            {/* Amount */}
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color:
                  txn.type === 'income'
                    ? 'var(--color-accent-green)'
                    : 'var(--color-accent-red)',
                whiteSpace: 'nowrap',
              }}
            >
              {txn.type === 'income' ? '+' : '-'}₹{txn.amount.toLocaleString('en-IN')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
