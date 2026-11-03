import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { adminLogin } from "../services/api";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ? (import.meta.env.VITE_API_BASE_URL as string).replace(/\/+$/, "") : "") + "/api/v1";

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
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Silent refresh via rotating httpOnly cookie or local session fallback
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
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
    } catch {
      // Backend offline or static host
    }

    try {
      const saved = sessionStorage.getItem("agy_admin_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.token && parsed.email) {
          setToken(parsed.token);
          setUser({ id: "admin-official-gov", email: parsed.email, role: "admin" });
          return parsed.token;
        }
      }
    } catch {
      // non-fatal
    }

    setToken(null);
    setUser(null);
    return null;
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
      sessionStorage.removeItem("agy_admin_session");
    } catch {}

    try {
      await fetch(`${API_BASE}/auth/logout`, {
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
