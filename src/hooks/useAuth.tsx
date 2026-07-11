import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyMetaOnSession,
  getCurrentMetaOnAuth,
  loginMetaOn,
  logoutMetaOn,
  type MetaOnUser
} from "../api/uniplanetApi";

interface AuthContextValue {
  authVersion: number;
  error?: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setManualSession: (userIdx: number, sessionId: string) => Promise<void>;
  user: MetaOnUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MetaOnUser | null>(null);
  const [authVersion, setAuthVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    getCurrentMetaOnAuth()
      .then((auth) => {
        if (cancelled) return;
        setUser(auth.authenticated ? auth.user : null);
        setError(undefined);
      })
      .catch((caught) => {
        if (cancelled) return;
        setUser(null);
        setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (userId: string, password: string) => {
    setError(undefined);
    try {
      const auth = await loginMetaOn(userId, password);
      setUser(auth.user);
      setAuthVersion((version) => version + 1);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      throw caught;
    }
  }, []);

  const setManualSession = useCallback(async (userIdx: number, sessionId: string) => {
    setError(undefined);
    try {
      const auth = await applyMetaOnSession(userIdx, sessionId);
      setUser(auth.user);
      setAuthVersion((version) => version + 1);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      throw caught;
    }
  }, []);

  const logout = useCallback(async () => {
    setError(undefined);
    await logoutMetaOn();
    setUser(null);
    setAuthVersion((version) => version + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      authVersion,
      error,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      setManualSession,
      user
    }),
    [authVersion, error, isLoading, login, logout, setManualSession, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return value;
}
