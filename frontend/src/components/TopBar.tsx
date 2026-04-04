import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Bell } from 'lucide-react';
import type { TimePeriod, UserRole } from '../types';
import { apiRequest } from '../api/client';

type NotificationRecord = {
  id: string;
  category: string;
  amount: number;
  type: 'income' | 'expense';
  currency: string;
  note: string;
  record_date: string;
};

type NotificationResponse = {
  records: NotificationRecord[];
};

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

export default function TopBar({
  activePeriod,
  onPeriodChange,
  userRole,
  onAddRecord,
}: TopBarProps) {
  const canAddRecord = userRole === 'Admin' || userRole === 'NormalUser';
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [todayTransactions, setTodayTransactions] = useState<NotificationRecord[]>([]);
  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);

  const todayIsoDate = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const loadTodayTransactions = useCallback(async () => {
    setLoadingNotifications(true);
    setNotificationError('');

    const today = todayIsoDate();
    const params = new URLSearchParams({
      start_date: today,
      end_date: today,
      limit: '25',
      offset: '0',
    });

    try {
      const payload = await apiRequest<NotificationResponse>(`/api/records?${params.toString()}`);
      setTodayTransactions(payload.records ?? []);
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Failed to load notifications');
    } finally {
      setLoadingNotifications(false);
    }
  }, [todayIsoDate]);

  const toggleNotifications = () => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);

    if (nextState) {
      void loadTodayTransactions();
    }
  };

  useEffect(() => {
    if (!showNotifications) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationsPanelRef.current?.contains(target)) {
        return;
      }
      if (notificationsButtonRef.current?.contains(target)) {
        return;
      }
      setShowNotifications(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showNotifications]);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
        {/* Notifications */}
        <button
          id="notifications-btn"
          ref={notificationsButtonRef}
          onClick={toggleNotifications}
          aria-expanded={showNotifications}
          aria-haspopup="dialog"
          style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-md)',
            border: showNotifications
              ? '1px solid var(--color-accent-blue)'
              : '1px solid var(--color-border-subtle)',
            backgroundColor: showNotifications ? 'var(--color-bg-card-hover)' : 'var(--color-bg-card)',
            color: showNotifications ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
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

        {showNotifications && (
          <div
            ref={notificationsPanelRef}
            role="dialog"
            aria-label="Today's transactions"
            style={{
              position: 'absolute',
              top: '50px',
              right: 0,
              width: '340px',
              maxHeight: '430px',
              overflowY: 'auto',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-card)',
              backgroundColor: 'var(--color-bg-card)',
              boxShadow: '0 14px 34px rgba(0, 0, 0, 0.36)',
              padding: '12px',
              zIndex: 40,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 4px 10px',
                borderBottom: '1px solid var(--color-border-subtle)',
                marginBottom: '10px',
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Today's transactions
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {new Date().toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void loadTodayTransactions();
                }}
                disabled={loadingNotifications}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-secondary)',
                  fontSize: '12px',
                  cursor: loadingNotifications ? 'not-allowed' : 'pointer',
                }}
              >
                Reload
              </button>
            </div>

            {loadingNotifications && (
              <div style={{ display: 'grid', gap: '10px' }}>
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={`notif-loading-${idx + 1}`}
                    style={{
                      display: 'grid',
                      gap: '6px',
                      padding: '8px 6px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        width: '62%',
                        height: '12px',
                        borderRadius: '999px',
                        background:
                          'linear-gradient(90deg, rgba(46, 51, 72, 0.45) 20%, rgba(92, 96, 120, 0.34) 40%, rgba(46, 51, 72, 0.45) 60%)',
                        backgroundSize: '220% 100%',
                        animation: 'shimmer 1.25s linear infinite',
                      }}
                    />
                    <div
                      style={{
                        width: '38%',
                        height: '10px',
                        borderRadius: '999px',
                        background:
                          'linear-gradient(90deg, rgba(46, 51, 72, 0.45) 20%, rgba(92, 96, 120, 0.34) 40%, rgba(46, 51, 72, 0.45) 60%)',
                        backgroundSize: '220% 100%',
                        animation: 'shimmer 1.25s linear infinite',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {!loadingNotifications && notificationError && (
              <div
                style={{
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(248, 113, 113, 0.3)',
                  backgroundColor: 'var(--color-accent-red-soft)',
                  color: 'var(--color-accent-red)',
                  fontSize: '12px',
                  padding: '8px 10px',
                }}
              >
                {notificationError}
              </div>
            )}

            {!loadingNotifications && !notificationError && todayTransactions.length === 0 && (
              <div
                style={{
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--color-border-subtle)',
                  padding: '14px',
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                  textAlign: 'center',
                }}
              >
                No transactions recorded today.
              </div>
            )}

            {!loadingNotifications && !notificationError && todayTransactions.length > 0 && (
              <div style={{ display: 'grid', gap: '8px' }}>
                {todayTransactions.map((txn) => {
                  const title = txn.note?.trim() || txn.category;
                  const amountPrefix = txn.type === 'income' ? '+' : '-';
                  const amountColor = txn.type === 'income'
                    ? 'var(--color-accent-green)'
                    : 'var(--color-accent-red)';

                  return (
                    <div
                      key={txn.id}
                      style={{
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-subtle)',
                        backgroundColor: 'var(--color-bg-dark)',
                        padding: '9px 10px',
                        display: 'grid',
                        gap: '4px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {title}
                        </span>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: amountColor,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {amountPrefix}{txn.currency} {txn.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {txn.category}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
