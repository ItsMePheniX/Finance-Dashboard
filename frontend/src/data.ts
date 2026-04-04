import type { NavItem } from './types';

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', section: 'overview' },
  { id: 'transactions', label: 'Transactions', icon: 'arrow-left-right', section: 'overview' },
  { id: 'analytics', label: 'Analytics', icon: 'bar-chart-3', section: 'overview' },
  { id: 'users', label: 'Users', icon: 'users', section: 'management', adminOnly: true },
  { id: 'roles', label: 'Roles & Access', icon: 'shield-check', section: 'management', adminOnly: true },
];
