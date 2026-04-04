import { useEffect, useMemo, useState } from 'react';
import { Shield, Plus, AlertTriangle, Check, X, ChevronRight } from 'lucide-react';
import type { UserRole } from '../types';
import { apiRequest } from '../api/client';

interface Permission {
  id: string;
  label: string;
  description: string;
}

interface RoleDef {
  role: UserRole;
  description: string;
  color: string;
  colorBg: string;
  userCount: number;
  permissions: string[];
}

type ApiUserRecord = {
  email: string;
  username: string;
  full_name: string;
  roles: string[];
};

const allPermissions: Permission[] = [
  { id: 'view_dashboard', label: 'View Dashboard', description: 'Access dashboard summary and charts' },
  { id: 'view_transactions', label: 'View Transactions', description: 'View all transaction records' },
  { id: 'add_transactions', label: 'Add Transactions', description: 'Create new income/expense records' },
  { id: 'edit_transactions', label: 'Edit Transactions', description: 'Modify existing transaction records' },
  { id: 'delete_transactions', label: 'Delete Transactions', description: 'Remove transaction records' },
  { id: 'view_analytics', label: 'View Analytics', description: 'Access analytics and reports' },
  { id: 'export_data', label: 'Export Data', description: 'Download reports and CSVs' },
  { id: 'manage_users', label: 'Manage Users', description: 'Invite, deactivate, or remove users' },
  { id: 'manage_roles', label: 'Manage Roles', description: 'Modify role permissions' },
  { id: 'system_settings', label: 'System Settings', description: 'Access application configuration' },
];

const baseRoles: Omit<RoleDef, 'userCount'>[] = [
  {
    role: 'Admin',
    description: 'Full system access with user and role management',
    color: 'var(--color-accent-blue)',
    colorBg: 'rgba(79,140,255,0.12)',
    permissions: allPermissions.map((p) => p.id),
  },
  {
    role: 'Analyst',
    description: 'Global read access for records and analytics (read-only)',
    color: 'var(--color-accent-purple)',
    colorBg: 'rgba(167,139,250,0.12)',
    permissions: ['view_dashboard', 'view_transactions', 'view_analytics', 'export_data'],
  },
  {
    role: 'NormalUser',
    description: 'Can manage own transactions with limited visibility of others',
    color: 'var(--color-accent-amber)',
    colorBg: 'rgba(251,191,36,0.12)',
    permissions: ['view_dashboard', 'view_transactions', 'add_transactions', 'edit_transactions', 'delete_transactions', 'view_analytics'],
  },
];

function roleFromApi(roles: string[]): UserRole {
  if (roles.includes('admin')) return 'Admin';
  if (roles.includes('analyst')) return 'Analyst';
  return 'NormalUser';
}

function displayName(user: ApiUserRecord): string {
  if (user.full_name?.trim()) return user.full_name.trim();
  if (user.username?.trim()) return user.username.trim();
  return user.email;
}

export default function RolesPage() {
  const [selectedRole, setSelectedRole] = useState<UserRole>('Admin');
  const [users, setUsers] = useState<ApiUserRecord[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      setError('');
      try {
        const payload = await apiRequest<{ users: ApiUserRecord[] }>('/api/users');
        setUsers(payload.users ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load users';
        setError(message);
      }
    };

    void loadUsers();
  }, []);

  const roles = useMemo<RoleDef[]>(() => {
    const counts: Record<UserRole, number> = {
      Admin: 0,
      Analyst: 0,
      NormalUser: 0,
    };

    for (const user of users) {
      const normalized = (user.roles ?? []).map((role) => role.toLowerCase().trim());
      counts[roleFromApi(normalized)] += 1;
    }

    return baseRoles.map((role) => ({
      ...role,
      userCount: counts[role.role],
    }));
  }, [users]);

  const activeRole = roles.find((r) => r.role === selectedRole)!;
  const members = useMemo(() => {
    return users.filter((user) => {
      const normalized = (user.roles ?? []).map((role) => role.toLowerCase().trim());
      return roleFromApi(normalized) === selectedRole;
    });
  }, [selectedRole, users]);

  return (
    <div className="animate-fade-in" style={{ padding: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>Roles & Access</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Configure role-based permissions and access control
          </p>
        </div>
        <button
          id="create-role-btn"
          disabled
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
            borderRadius: 'var(--radius-md)', border: 'none',
            background: 'linear-gradient(135deg, var(--color-accent-blue), #7c3aed)',
            color: '#fff', cursor: 'not-allowed', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
            boxShadow: '0 2px 12px rgba(79,140,255,0.25)', transition: 'all 0.25s ease',
            opacity: 0.6,
          }}
        >
          <Plus size={16} /> Create role (coming soon)
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            backgroundColor: 'var(--color-accent-red-soft)',
            color: 'var(--color-accent-red)',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {/* Warning banner */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px',
          borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-accent-amber-soft)',
          border: '1px solid rgba(251,191,36,0.2)', marginBottom: '24px',
        }}
      >
        <AlertTriangle size={18} color="var(--color-accent-amber)" />
        <span style={{ fontSize: '13px', color: 'var(--color-accent-amber)' }}>
          Changes to permissions take effect immediately. Review carefully before saving.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
        {/* Role list */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-card)', overflow: 'hidden',
          }}
        >
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Roles</h2>
          </div>
          {roles.map((r) => {
            const isActive = selectedRole === r.role;
            return (
              <button
                key={r.role}
                id={`role-btn-${r.role.toLowerCase()}`}
                onClick={() => setSelectedRole(r.role)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', border: 'none', cursor: 'pointer',
                  backgroundColor: isActive ? 'var(--color-bg-card-hover)' : 'transparent',
                  borderLeft: isActive ? `3px solid ${r.color}` : '3px solid transparent',
                  transition: 'all 0.15s ease', fontFamily: 'inherit',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-md)',
                      backgroundColor: r.colorBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Shield size={16} color={r.color} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{r.role}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{r.userCount} user{r.userCount !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <ChevronRight size={16} color={isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)'} />
              </button>
            );
          })}
        </div>

        {/* Permission matrix */}
        <div
          className="animate-fade-in"
          style={{
            backgroundColor: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-card)', overflow: 'hidden',
          }}
        >
          {/* Role header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  backgroundColor: activeRole.colorBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Shield size={20} color={activeRole.color} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{activeRole.role}</h2>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{activeRole.description}</p>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Manage assignments from the Users page.
                </p>
              </div>
            </div>
            <span
              style={{
                fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '9999px',
                backgroundColor: activeRole.colorBg, color: activeRole.color,
              }}
            >
              {activeRole.permissions.length}/{allPermissions.length} permissions
            </span>
          </div>

          {/* Permissions list */}
          <div style={{ padding: '8px 0' }}>
            {allPermissions.map((perm) => {
              const hasPermission = activeRole.permissions.includes(perm.id);
              return (
                <div
                  key={perm.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 24px', transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                        backgroundColor: hasPermission ? 'var(--color-accent-green-soft)' : 'var(--color-accent-red-soft)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {hasPermission ? (
                        <Check size={14} color="var(--color-accent-green)" />
                      ) : (
                        <X size={14} color="var(--color-accent-red)" />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: hasPermission ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>{perm.label}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{perm.description}</div>
                    </div>
                  </div>
                  {/* Toggle */}
                  <div
                    style={{
                      width: 40, height: 22, borderRadius: '11px',
                      backgroundColor: hasPermission ? 'var(--color-accent-green)' : 'var(--color-border-subtle)',
                      position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 16, height: 16, borderRadius: '50%', backgroundColor: '#fff',
                        position: 'absolute', top: 3,
                        left: hasPermission ? 21 : 3,
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--color-border-subtle)', padding: '16px 24px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              Users in {selectedRole}
            </h3>
            {members.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No users assigned.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {members.map((member) => (
                  <span
                    key={`${member.email}-${member.username}`}
                    style={{
                      fontSize: '12px',
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      backgroundColor: activeRole.colorBg,
                      color: activeRole.color,
                    }}
                  >
                    {displayName(member)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              style={{
                padding: '9px 20px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)', backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '13px',
                fontWeight: 500, fontFamily: 'inherit', transition: 'all 0.15s ease',
              }}
            >
              Reset
            </button>
            <button
              id="save-permissions-btn"
              style={{
                padding: '9px 20px', borderRadius: 'var(--radius-md)', border: 'none',
                background: 'linear-gradient(135deg, var(--color-accent-blue), #7c3aed)',
                color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                fontFamily: 'inherit', boxShadow: '0 2px 12px rgba(79,140,255,0.25)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
