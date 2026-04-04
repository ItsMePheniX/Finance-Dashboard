import { useEffect, useMemo, useState } from 'react';
import { Search, Shield, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import { apiRequest } from '../api/client';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roles: string[];
  initials: string;
  status: 'active' | 'inactive';
  createdAt: string;
  gradient: string;
}

type ApiUserRecord = {
  id: string;
  email: string;
  username: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  roles: string[];
};

const roleApiValues = ['admin', 'analyst', 'normal_user'] as const;

function roleLabel(role: string): UserRole {
  if (role === 'admin') return 'Admin';
  if (role === 'analyst') return 'Analyst';
  return 'NormalUser';
}

function preferredRole(roles: string[]): UserRole {
  if (roles.includes('admin')) return 'Admin';
  if (roles.includes('analyst')) return 'Analyst';
  return 'NormalUser';
}

function userName(fullName: string, username: string, email: string): string {
  const fromFullName = fullName.trim();
  if (fromFullName) return fromFullName;
  const fromUsername = username.trim();
  if (fromUsername) return fromUsername;
  return email.split('@')[0] ?? email;
}

function initials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function avatarGradient(seed: string): string {
  const gradients = [
    'linear-gradient(135deg, #4f8cff, #7c3aed)',
    'linear-gradient(135deg, #a78bfa, #ec4899)',
    'linear-gradient(135deg, #fbbf24, #f97316)',
    'linear-gradient(135deg, #2dd4bf, #22d3ee)',
    'linear-gradient(135deg, #34d399, #4ade80)',
    'linear-gradient(135deg, #818cf8, #6366f1)',
  ];

  const hash = seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

function formatCreatedAt(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return 'n/a';
  }
  return dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const roleBadge: Record<UserRole, { bg: string; text: string }> = {
  Admin: { bg: 'rgba(79,140,255,0.15)', text: 'var(--color-accent-blue)' },
  Analyst: { bg: 'rgba(167,139,250,0.15)', text: 'var(--color-accent-purple)' },
  NormalUser: { bg: 'rgba(251,191,36,0.15)', text: 'var(--color-accent-amber)' },
};

export default function UsersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('All');
  const [usersData, setUsersData] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string>('');
  const [selectedRoleByUser, setSelectedRoleByUser] = useState<Record<string, string>>({});

  const loadUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiRequest<{ users: ApiUserRecord[] }>('/api/users');
      const mapped = data.users.map((item) => {
        const normalizedRoles = (item.roles ?? []).map((role) => role.toLowerCase().trim());
        const displayName = userName(item.full_name, item.username, item.email);
        return {
          id: item.id,
          name: displayName,
          email: item.email,
          role: preferredRole(normalizedRoles),
          roles: normalizedRoles,
          initials: initials(displayName),
          status: item.is_active ? 'active' : 'inactive',
          createdAt: item.created_at,
          gradient: avatarGradient(item.email || item.id),
        } satisfies UserRecord;
      });
      setUsersData(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load users';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const applyRoleChange = async (userId: string, role: string, mode: 'assign' | 'remove') => {
    setPending(`${mode}:${userId}:${role}`);
    setError('');
    try {
      await apiRequest(`/api/users/${userId}/roles`, {
        method: mode === 'assign' ? 'POST' : 'DELETE',
        body: { role },
      });
      await loadUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update role';
      setError(message);
    } finally {
      setPending('');
    }
  };

  const toggleUserStatus = async (target: UserRecord) => {
    setPending(`status:${target.id}`);
    setError('');
    try {
      await apiRequest(`/api/users/${target.id}/status`, {
        method: 'PATCH',
        body: { is_active: target.status !== 'active' },
      });
      await loadUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      setError(message);
    } finally {
      setPending('');
    }
  };

  const filtered = useMemo(
    () =>
      usersData.filter((u) => {
        const q = search.toLowerCase();
        const matchSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
        const matchRole = filterRole === 'All' || u.role === filterRole;
        return matchSearch && matchRole;
      }),
    [usersData, search, filterRole]
  );

  const counts = {
    total: usersData.length,
    active: usersData.filter((u) => u.status === 'active').length,
    admins: usersData.filter((u) => u.role === 'Admin').length,
  };

  return (
    <div className="animate-fade-in" style={{ padding: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>Users</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Manage user roles and active status
          </p>
        </div>
        {loading && (
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Loading users...</span>
        )}
      </div>

      {error && (
        <div
          style={{
            marginBottom: '18px',
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

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Users', value: counts.total, color: 'var(--color-accent-blue)' },
          { label: 'Active Now', value: counts.active, color: 'var(--color-accent-green)' },
          { label: 'Admins', value: counts.admins, color: 'var(--color-accent-purple)' },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`animate-fade-in stagger-${i + 1}`}
            style={{
              backgroundColor: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-card)', padding: '20px 24px',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = s.color; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-card)'; }}
          >
            <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '8px' }}>{s.label}</p>
            <p style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)',
            padding: '9px 14px', flex: '1', maxWidth: '300px',
          }}
        >
          <Search size={16} color="var(--color-text-muted)" />
          <input
            id="users-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--color-text-primary)', fontSize: '13px', fontFamily: 'inherit', width: '100%',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-bg-card)', borderRadius: 'var(--radius-md)', padding: '4px', border: '1px solid var(--color-border-subtle)' }}>
          {['All', 'Admin', 'Analyst', 'NormalUser'].map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              style={{
                padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: filterRole === r ? 600 : 400,
                color: filterRole === r ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                backgroundColor: filterRole === r ? 'var(--color-bg-card-hover)' : 'transparent',
                fontFamily: 'inherit', transition: 'all 0.2s ease',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Users grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {filtered.map((u, idx) => {
          const badge = roleBadge[u.role];
          const selectValue = selectedRoleByUser[u.id] ?? 'normal_user';
          return (
            <div
              key={u.id}
              id={`user-card-${u.id}`}
              className={`animate-fade-in stagger-${Math.min(idx + 1, 5)}`}
              style={{
                backgroundColor: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-card)', padding: '24px',
                transition: 'all 0.25s ease', cursor: 'default',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent-blue)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-card)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: 46, height: 46, borderRadius: '50%', background: u.gradient,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '15px', fontWeight: 700, color: '#fff', flexShrink: 0,
                      position: 'relative',
                    }}
                  >
                    {u.initials}
                    <span
                      style={{
                        position: 'absolute', bottom: 1, right: 1, width: 10, height: 10,
                        borderRadius: '50%', border: '2px solid var(--color-bg-card)',
                        backgroundColor: u.status === 'active' ? 'var(--color-accent-green)' : 'var(--color-text-muted)',
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{u.email}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px' }}>
                <span
                  style={{
                    fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '9999px',
                    backgroundColor: badge.bg, color: badge.text,
                  }}
                >
                  {u.role}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Created: {formatCreatedAt(u.createdAt)}
                </span>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {u.roles.length === 0 ? (
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>No roles assigned</span>
                ) : (
                  u.roles.map((role) => (
                    <span
                      key={`${u.id}-${role}`}
                      style={{
                        fontSize: '11px',
                        borderRadius: '9999px',
                        padding: '3px 8px',
                        backgroundColor: roleBadge[roleLabel(role)].bg,
                        color: roleBadge[roleLabel(role)].text,
                        fontWeight: 600,
                      }}
                    >
                      {roleLabel(role)}
                    </span>
                  ))
                )}
              </div>

              {isAdmin && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <select
                      value={selectValue}
                      onChange={(e) =>
                        setSelectedRoleByUser((prev) => ({
                          ...prev,
                          [u.id]: e.target.value,
                        }))
                      }
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-subtle)',
                        backgroundColor: 'var(--color-bg-dark)',
                        color: 'var(--color-text-primary)',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                      }}
                    >
                      {roleApiValues.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>

                    <button
                      disabled={pending !== ''}
                      onClick={() => void applyRoleChange(u.id, selectValue, 'assign')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-subtle)',
                        backgroundColor: 'var(--color-bg-card)',
                        color: 'var(--color-text-primary)',
                        fontSize: '12px',
                        cursor: pending !== '' ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Add role
                    </button>
                    <button
                      disabled={pending !== ''}
                      onClick={() => void applyRoleChange(u.id, selectValue, 'remove')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(248, 113, 113, 0.4)',
                        backgroundColor: 'var(--color-accent-red-soft)',
                        color: 'var(--color-accent-red)',
                        fontSize: '12px',
                        cursor: pending !== '' ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Remove role
                    </button>
                  </div>

                  <button
                    disabled={pending !== ''}
                    onClick={() => void toggleUserStatus(u)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '8px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-subtle)',
                      backgroundColor: 'transparent',
                      color: 'var(--color-text-secondary)',
                      cursor: pending !== '' ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontFamily: 'inherit',
                    }}
                  >
                    <Shield size={13} />
                    {u.status === 'active' ? 'Deactivate user' : 'Activate user'}
                    {pending === `status:${u.id}` && <Loader2 size={13} className="animate-spin" />}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)', fontSize: '14px' }}>
          No users matching your search.
        </div>
      )}
    </div>
  );
}
