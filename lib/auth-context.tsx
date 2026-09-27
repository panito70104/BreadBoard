"use client";

/**
 * Who is signed in, for client components.
 *
 * The session itself is an httpOnly cookie the browser cannot read — this
 * context only mirrors the user the server reports. Inside the app the server
 * layout passes that user in up front (`initialUser`), so there is no loading
 * flash; on public pages it is fetched once on mount.
 *
 * TODO(auth): on Supabase, `login`/`signup`/`logout` call `supabase.auth.*`
 * and `refresh` reads `supabase.auth.getUser()`. Consumers of `useAuth()` do
 * not change.
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
import type { LoginCredentials, User, UserPreferences } from "@/types";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  /** True until the first answer from the server. */
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  signup: (input: { name: string; email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  /** Re-reads the user — call after anything that changes plan or minutes. */
  refresh: () => Promise<void>;
  updateProfile: (
    patch: Partial<Pick<User, "name">> & Partial<UserPreferences>,
  ) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  /** Server-provided user. `undefined` means "not known yet, fetch it". */
  initialUser?: User | null;
}) {
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [isLoading, setIsLoading] = useState(initialUser === undefined);

  useEffect(() => {
    if (initialUser !== undefined) return;
    let cancelled = false;

    api
      .getCurrentUser()
      .then((current) => {
        if (!cancelled) setUser(current);
      })
      .catch(() => {
        // A network blip on a public page just means "signed out" for now.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialUser]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const signedIn = await api.login(credentials);
    setUser(signedIn);
    return signedIn;
  }, []);

  const signup = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const created = await api.signup(input);
      setUser(created);
      return created;
    },
    [],
  );

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    setUser(await api.getCurrentUser());
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<User, "name">> & Partial<UserPreferences>) => {
      const updated = await api.updateProfile(patch);
      setUser(updated);
      return updated;
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      signup,
      logout,
      refresh,
      updateProfile,
    }),
    [user, isLoading, login, signup, logout, refresh, updateProfile],
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
