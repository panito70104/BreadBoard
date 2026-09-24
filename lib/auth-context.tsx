"use client";

/**
 * Mock authentication context.
 *
 * There is no real auth: the session is a plain object kept in `localStorage`.
 * When a provider (NextAuth, Clerk, custom JWT) lands, only this file and the
 * auth calls in `lib/api.ts` change — components keep using `useAuth()`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import * as api from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/config";
import type { AuthSession, LoginCredentials, User } from "@/types";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  /** True until the stored session has been read on the client. */
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  signup: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.session);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: AuthSession | null) {
  try {
    if (session) {
      window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.session);
    }
  } catch {
    // Private mode / storage disabled — the demo still works in memory.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const stored = readStoredSession();
      if (stored) {
        if (!cancelled) {
          setUser(stored.user);
          setIsAuthenticated(true);
          setIsLoading(false);
        }
        return;
      }

      // No stored session: ask the API who we are. There is no demo account
      // standing in, so this comes back empty and the app renders signed out.
      // TODO(auth): redirect to /login from a route guard once auth is real.
      const currentUser = await api.getCurrentUser();
      if (!cancelled) {
        setUser(currentUser);
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((session: AuthSession) => {
    writeStoredSession(session);
    setUser(session.user);
    setIsAuthenticated(true);
    return session.user;
  }, []);

  const login = useCallback(
    async (credentials: LoginCredentials) => persist(await api.login(credentials)),
    [persist],
  );

  const signup = useCallback(
    async (input: { name: string; email: string; password: string }) =>
      persist(await api.signup(input)),
    [persist],
  );

  const logout = useCallback(async () => {
    await api.logout();
    writeStoredSession(null);
    setIsAuthenticated(false);
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      const stored = readStoredSession();
      if (stored) writeStoredSession({ ...stored, user: next });
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated, isLoading, login, signup, logout, updateUser }),
    [user, isAuthenticated, isLoading, login, signup, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  }
  return context;
}
