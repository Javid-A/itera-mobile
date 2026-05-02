import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { login as loginRequest, register as registerRequest } from '../api/auth';
import { saveAuthData, getStoredUser, clearAuthData } from '../services/tokenStorage';
import { setUnauthorizedHandler } from '../services/apiClient';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  username: string | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    userId: null,
    username: null,
  });

  // Rehydrate session on app start
  useEffect(() => {
    getStoredUser().then((user) => {
      if (user) {
        setState({ isAuthenticated: true, isLoading: false, userId: user.userId, username: user.username });
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    });
  }, []);

  // 401 → apiClient interceptor token'ı zaten siliyor; burada React state'i de
  // flip'liyoruz ki RootNavigator login'e redirect etsin. Cache temizlenir ki
  // bir sonraki kullanıcı eski stale veriyi görmesin.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.clear();
      setState({ isAuthenticated: false, isLoading: false, userId: null, username: null });
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  const login = async (username: string, password: string) => {
    const timeZone = resolveDeviceTimeZone();
    const data = await loginRequest({ username, password, timeZone });
    await saveAuthData(data.token, data.userId, data.username);
    setState({ isAuthenticated: true, isLoading: false, userId: data.userId, username: data.username });
  };

  const register = async (username: string, password: string) => {
    const timeZone = resolveDeviceTimeZone();
    const data = await registerRequest({ username, password, timeZone });
    await saveAuthData(data.token, data.userId, data.username);
    setState({ isAuthenticated: true, isLoading: false, userId: data.userId, username: data.username });
  };

  const logout = async () => {
    await clearAuthData();
    queryClient.clear();
    setState({ isAuthenticated: false, isLoading: false, userId: null, username: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Captured at registration so the server can draw day boundaries in the user's TZ — never the
// device clock at request time, which the user can spoof. Server accepts unknown ids and falls
// back to UTC, so a missing/garbled value here is non-fatal.
function resolveDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
