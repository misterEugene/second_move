import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, readToken, setUnauthorizedHandler, writeToken } from '@/api/client';
import type { User } from '@/api/types';

interface AuthState {
  user: User | null;
  ready: boolean;
  unread: number;
  homePath: string;
  login(email: string, password: string): Promise<User>;
  register(body: Record<string, unknown>): Promise<User>;
  logout(): void;
  refreshUnread(): Promise<void>;
  setUnread(n: number): void;
  setUserName(name: string): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!readToken()) return;
    try {
      setUnread((await api<{ unread: number }>('/notifications')).unread);
    } catch {
      /* счётчик не критичен */
    }
  }, []);

  const logout = useCallback(() => {
    writeToken(null);
    setUser(null);
    setUnread(0);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      const back = window.location.pathname + window.location.search;
      window.history.pushState(null, '', `/login?redirect=${encodeURIComponent(back)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    (async () => {
      if (readToken()) {
        try {
          setUser(await api<User>('/auth/me'));
          void refreshUnread();
        } catch {
          writeToken(null);
        }
      }
      setReady(true);
    })();
  }, [logout, refreshUnread]);

  const session = useCallback(
    async (path: string, body: unknown) => {
      const res = await api<{ token: string; user: User }>(path, { method: 'POST', body });
      writeToken(res.token);
      setUser(res.user);
      void refreshUnread();
      return res.user;
    },
    [refreshUnread],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      unread,
      homePath: homeFor(user),
      login: (email, password) => session('/auth/login', { email, password }),
      register: (body) => session('/auth/register', body),
      logout,
      refreshUnread,
      setUnread,
      setUserName: (name) => setUser((u) => (u ? { ...u, name } : u)),
    }),
    [user, ready, unread, session, logout, refreshUnread],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Куда вести пользователя после входа. */
export function homeFor(user: User | null) {
  return user?.role === 'ORGANIZER' ? '/organizer' : user?.role === 'ADMIN' ? '/admin' : '/cabinet';
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth вне AuthProvider');
  return ctx;
}
