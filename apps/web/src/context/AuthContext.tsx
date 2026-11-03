import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { adminLogin } from "../services/api";

export interface AdminUser {
  id: string;
  email: string;
  role: string;
}

interface AuthContextType {
  token: string | null;
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // In-memory token storage only (strictly never in localStorage or sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Silent refresh via rotating httpOnly cookie
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.token) {
          setToken(json.data.token);
          setUser(json.data.user);
          return json.data.token;
        }
      }
      // Refresh failed or revoked
      setToken(null);
      setUser(null);
      return null;
    } catch {
      setToken(null);
      setUser(null);
      return null;
    }
  }, []);

  // Silent refresh attempt on application mount
  useEffect(() => {
    let mounted = true;
    refreshAccessToken().finally(() => {
      if (mounted) {
        setIsLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [refreshAccessToken]);

  const login = async (credentials: { email: string; password: string }) => {
    const res = await adminLogin(credentials);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {
      // Ignore network errors during logout
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
