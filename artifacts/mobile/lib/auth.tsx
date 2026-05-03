import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  api,
  getStoredUser,
  loadToken,
  setStoredUser,
  setToken,
} from "./api";

export type Role = "client" | "freelancer" | "admin";

export type User = {
  id: number;
  email: string;
  fullName?: string;
  name?: string;
  role: Role;
  avatarUrl?: string | null;
};

type AuthResponse = {
  token?: string;
  accessToken?: string;
  user: User;
};

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    email: string;
    password: string;
    fullName: string;
    role: Role;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function pickToken(r: AuthResponse): string | undefined {
  return r.token ?? r.accessToken;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const refresh = useCallback(async () => {
    const token = await loadToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
      await setStoredUser(me);
    } catch {
      await setToken(null);
      await setStoredUser(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const cached = await getStoredUser<User>();
      if (cached) setUser(cached);
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const res = await api<AuthResponse>("/auth/login", {
          method: "POST",
          body: { email, password },
          auth: false,
        });
        const tok = pickToken(res);
        if (tok) await setToken(tok);
        setUser(res.user);
        await setStoredUser(res.user);
        await qc.invalidateQueries();
        return res.user;
      } finally {
        setLoading(false);
      }
    },
    [qc],
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      fullName: string;
      role: Role;
    }) => {
      setLoading(true);
      try {
        const res = await api<AuthResponse>("/auth/register", {
          method: "POST",
          body: input,
          auth: false,
        });
        const tok = pickToken(res);
        if (tok) await setToken(tok);
        setUser(res.user);
        await setStoredUser(res.user);
        await qc.invalidateQueries();
        return res.user;
      } finally {
        setLoading(false);
      }
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    await setToken(null);
    await setStoredUser(null);
    setUser(null);
    await qc.clear();
  }, [qc]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, ready, loading, login, register, logout, refresh }),
    [user, ready, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
