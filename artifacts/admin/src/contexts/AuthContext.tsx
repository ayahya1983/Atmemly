import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from "react";
import { useGetMe, getGetMeQueryKey, type Me } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface AuthContextType {
  user: Me | null;
  isLoading: boolean;
  login: (token: string, user: Me) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auth_token");
    }
    return null;
  });
  const [user, setUser] = useState<Me | null>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: meData, isLoading: isMeLoading, error } = useGetMe({
    query: {
      enabled: !!token && !user,
      retry: false,
      queryKey: getGetMeQueryKey(),
    },
  });

  useEffect(() => {
    if (meData) setUser(meData);
  }, [meData]);

  useEffect(() => {
    if (error) {
      localStorage.removeItem("auth_token");
      setToken(null);
      setUser(null);
    }
  }, [error]);

  const login = useCallback(
    (newToken: string, newUser: Me) => {
      localStorage.setItem("auth_token", newToken);
      setToken(newToken);
      setUser(newUser);
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
    queryClient.clear();
    setLocation("/");
  }, [setLocation, queryClient]);

  const isLoading = !!token && isMeLoading && !user;

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
