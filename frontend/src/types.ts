export type UserRole = 'Admin' | 'Analyst' | 'NormalUser';

export interface User {
  id?: string;
  email?: string;
  username?: string;
  name: string;
  initials: string;
  role: UserRole;
  roles?: string[];
  avatar?: string;
}

export interface MetricCard {
  id: string;
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  delta?: number;
  deltaLabel?: string;
  trend: 'up' | 'down' | 'neutral';
  icon: string;
}

export interface Transaction {
  id: string;
  description: string;
  vendor: string;
  category: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  icon: string;
}

export interface CategoryExpense {
  name: string;
  amount: number;
  color: string;
  percentage: number;
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

export type NavItem = {
  id: string;
  label: string;
  icon: string;
  section: 'overview' | 'management';
  adminOnly?: boolean;
};

export type TimePeriod = 'this_month' | 'last_3_months' | 'last_6_months' | 'custom';
