import {
  LayoutDashboard,
  ArrowLeftRight,
  BarChart3,
  Users,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import type { NavItem, User } from '../types';

const iconMap: Record<string, React.ElementType> = {
  'layout-dashboard': LayoutDashboard,
  'arrow-left-right': ArrowLeftRight,
  'bar-chart-3': BarChart3,
  'users': Users,
  'shield-check': ShieldCheck,
};

interface SidebarProps {
  navItems: NavItem[];
  activeNav: string;
  onNavChange: (id: string) => void;
  user: User;
  onLogout?: () => void;
}

export default function Sidebar({ navItems, activeNav, onNavChange, user, onLogout }: SidebarProps) {
  const overviewItems = navItems.filter((item) => item.section === 'overview');
  const managementItems = navItems.filter(
    (item) => item.section === 'management' && (!item.adminOnly || user.role === 'Admin')
  );

  const roleBadgeColor: Record<string, string> = {
    Admin: 'bg-[var(--color-accent-blue)] text-white',
    Analyst: 'bg-[var(--color-accent-purple)] text-white',
    NormalUser: 'bg-[var(--color-text-muted)] text-white',
  };

  return (
    <aside
      id="sidebar"
      className="animate-slide-left"
      style={{
        width: '240px',
        minWidth: '240px',
        height: '100vh',
        backgroundColor: 'var(--color-bg-sidebar)',
        borderRight: '1px solid var(--color-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '24px 20px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--color-accent-blue), #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 700,
            color: '#fff',
          }}
        >
          F
        </div>
        <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em' }}>
          FinanceOS
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0 12px', overflow: 'auto' }}>
        <p
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-text-muted)',
            padding: '16px 8px 8px',
          }}
        >
          Overview
        </p>
        {overviewItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onNavChange(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                backgroundColor: isActive ? 'var(--color-accent-blue)' : 'transparent',
                transition: 'all 0.2s ease',
                marginBottom: '2px',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {Icon && <Icon size={18} />}
              {item.label}
            </button>
          );
        })}

        {managementItems.length > 0 && (
          <>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-text-muted)',
                padding: '20px 8px 8px',
              }}
            >
              Management
            </p>
            {managementItems.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => onNavChange(item.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    backgroundColor: isActive ? 'var(--color-accent-blue)' : 'transparent',
                    transition: 'all 0.2s ease',
                    marginBottom: '2px',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {Icon && <Icon size={18} />}
                  {item.label}
                </button>
              );
            })}
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div
        style={{
          borderTop: '1px solid var(--color-border-subtle)',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* User chip */}
        <div
          id="user-chip"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '0 4px',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4f8cff, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {user.initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user.name}
            </div>
            <span
              className={roleBadgeColor[user.role]}
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '9999px',
                display: 'inline-block',
                marginTop: '2px',
                letterSpacing: '0.03em',
              }}
            >
              {user.role}
            </span>
          </div>
        </div>

        {/* Logout button */}
        {onLogout && (
          <button
            id="logout-btn"
            onClick={onLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-accent-red)',
              backgroundColor: 'var(--color-accent-red-soft)',
              color: 'var(--color-accent-red)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-red)';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(248, 113, 113, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-red-soft)';
              e.currentTarget.style.color = 'var(--color-accent-red)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <LogOut size={16} />
            Sign out
          </button>
        )}
      </div>
    </aside>
  );
}
