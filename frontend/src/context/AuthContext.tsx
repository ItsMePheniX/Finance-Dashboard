import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<boolean>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  clearError: () => void;
}

type ApiUser = {
  id?: string;
  email?: string;
  username?: string;
  full_name?: string;
  role?: string;
  roles?: string[];
};

type ApiAuthResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  requires_email_confirmation?: boolean;
  user?: ApiUser;
  message?: string;
};

type ApiErrorResponse = {
  message?: string;
  error?: string;
};

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
  fullName?: string;
};

export type RegisterResult = {
  success: boolean;
  requiresEmailConfirmation: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

const accessTokenStorageKey = 'finance-dashboard.access-token';

function normalizeRole(rawRole: string | undefined, roles: string[] | undefined): UserRole {
  const normalized = (rawRole ?? '').toLowerCase().trim();
  const normalizedRoles = (roles ?? []).map((role) => role.toLowerCase().trim());

  if (normalized === 'admin' || normalizedRoles.includes('admin')) {
    return 'Admin';
  }
  if (normalized === 'analyst' || normalizedRoles.includes('analyst')) {
    return 'Analyst';
  }
  if (normalized === 'normal_user' || normalizedRoles.includes('normal_user')) {
    return 'NormalUser';
  }
  return 'NormalUser';
}

function toDisplayName(user: ApiUser): string {
  const raw = (user.full_name ?? user.username ?? user.email ?? 'User').trim();
  if (!raw.includes('@')) {
    return raw;
  }

  const local = raw.split('@')[0] ?? 'user';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return 'U';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function mapApiUserToUser(user: ApiUser): User {
  const name = toDisplayName(user);
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: normalizeRole(user.role, user.roles),
    roles: user.roles,
    name,
    initials: toInitials(name),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const apiBaseUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
    []
  );
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string>(() => {
    return localStorage.getItem(accessTokenStorageKey) ?? '';
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearSession = () => {
    setUser(null);
    setAccessToken('');
    localStorage.removeItem(accessTokenStorageKey);
  };

  const persistAccessToken = (token: string) => {
    const trimmed = token.trim();
    setAccessToken(trimmed);
    if (trimmed) {
      localStorage.setItem(accessTokenStorageKey, trimmed);
      return;
    }
    localStorage.removeItem(accessTokenStorageKey);
  };

  const parseErrorMessage = async (response: Response, fallback: string): Promise<string> => {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorResponse;
    if (payload.message?.trim()) {
      return payload.message;
    }
    return fallback;
  };

  const loadProfile = async (token: string): Promise<boolean> => {
    if (!token.trim()) {
      return false;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        return false;
      }

      const payload = (await response.json()) as { user?: ApiUser };
      if (!payload.user) {
        return false;
      }

      setUser(mapApiUserToUser(payload.user));
      return true;
    } catch {
      return false;
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        clearSession();
        return false;
      }

      const payload = (await response.json()) as ApiAuthResponse;
      if (!payload.access_token) {
        clearSession();
        return false;
      }

      persistAccessToken(payload.access_token);

      if (payload.user) {
        setUser(mapApiUserToUser(payload.user));
      } else {
        const ok = await loadProfile(payload.access_token);
        if (!ok) {
          clearSession();
          return false;
        }
      }

      return true;
    } catch {
      clearSession();
      return false;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setIsLoading(true);

      const token = accessToken.trim();
      if (token) {
        const ok = await loadProfile(token);
        if (ok) {
          if (!cancelled) {
            setIsLoading(false);
          }
          return;
        }
      }

      await refreshSession();
      if (!cancelled) {
        setIsLoading(false);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const login = async (identifier: string, password: string): Promise<boolean> => {
    setError(null);

    try {
      const payload = identifier.includes('@')
        ? { email: identifier.trim(), password }
        : { username: identifier.trim(), password };

      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setError(await parseErrorMessage(response, 'Invalid credentials'));
        return false;
      }

      const data = (await response.json()) as ApiAuthResponse;
      if (!data.access_token) {
        setError('Login failed: missing access token');
        return false;
      }

      persistAccessToken(data.access_token);

      if (data.user) {
        setUser(mapApiUserToUser(data.user));
      } else {
        const ok = await loadProfile(data.access_token);
        if (!ok) {
          setError('Login succeeded but profile could not be loaded');
          clearSession();
          return false;
        }
      }

      return true;
    } catch {
      setError('Unable to reach the server');
      return false;
    }
  };

  const register = async (input: RegisterInput): Promise<RegisterResult> => {
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: input.username,
          email: input.email,
          password: input.password,
          full_name: input.fullName,
        }),
      });

      if (!response.ok) {
        setError(await parseErrorMessage(response, 'Registration failed'));
        return { success: false, requiresEmailConfirmation: false };
      }

      const data = (await response.json()) as ApiAuthResponse;
      const requiresEmailConfirmation = Boolean(data.requires_email_confirmation);

      if (data.access_token) {
        persistAccessToken(data.access_token);
        if (data.user) {
          setUser(mapApiUserToUser(data.user));
        } else {
          const ok = await loadProfile(data.access_token);
          if (!ok) {
            clearSession();
            setError('Registered successfully, but failed to load profile');
            return { success: false, requiresEmailConfirmation };
          }
        }
      }

      return { success: true, requiresEmailConfirmation };
    } catch {
      setError('Unable to reach the server');
      return { success: false, requiresEmailConfirmation: false };
    }
  };

  const logout = async () => {
    const token = accessToken.trim();

    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
        credentials: 'include',
      });
    } finally {
      clearSession();
      setError(null);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        refreshSession,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
