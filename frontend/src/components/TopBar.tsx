import { Plus, Bell, Search } from 'lucide-react';
import type { TimePeriod, UserRole } from '../types';

interface TopBarProps {
  activePeriod: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  userRole: UserRole;
  onAddRecord?: () => void;
}

const periods: { id: TimePeriod; label: string }[] = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_3_months', label: 'Last 3 months' },
  { id: 'last_6_months', label: 'Last 6 months' },
  { id: 'custom', label: 'Custom' },
];

export default function TopBar({ activePeriod, onPeriodChange, userRole, onAddRecord }: TopBarProps) {
  const canAddRecord = userRole === 'Admin' || userRole === 'NormalUser';

  return (
    <header
      id="topbar"
      className="animate-fade-in"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 28px',
        borderBottom: '1px solid var(--color-border-subtle)',
        backgroundColor: 'var(--color-bg-dark)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Left side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)',
          }}
        >
          Dashboard
        </h1>

        {/* Period filters */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '4px',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          {periods.map((period) => {
            const isActive = activePeriod === period.id;
            return (
              <button
                key={period.id}
                id={`period-${period.id}`}
                onClick={() => onPeriodChange(period.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive ? 'var(--color-bg-card-hover)' : 'transparent',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
              >
                {period.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
          }}
        >
          <Search size={16} color="var(--color-text-muted)" />
          <input
            id="search-input"
            type="text"
            placeholder="Search..."
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--color-text-primary)',
              fontSize: '13px',
              fontFamily: 'inherit',
              width: '120px',
            }}
          />
        </div>

        {/* Notifications */}
        <button
          id="notifications-btn"
          style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-card)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent-blue)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <Bell size={18} />
          <span
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: 'var(--color-accent-red)',
              border: '2px solid var(--color-bg-card)',
            }}
          />
        </button>

        {/* Add record button */}
        {canAddRecord && (
          <button
            id="add-record-btn"
            onClick={onAddRecord}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              background: 'linear-gradient(135deg, var(--color-accent-blue), #7c3aed)',
              fontFamily: 'inherit',
              transition: 'all 0.25s ease',
              boxShadow: '0 2px 12px rgba(79, 140, 255, 0.25)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(79, 140, 255, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(79, 140, 255, 0.25)';
            }}
          >
            <Plus size={16} />
            Add record
          </button>
        )}
      </div>
    </header>
  );
}
