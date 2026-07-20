"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import api, { ApiResponse } from "@/lib/api";
import { User } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function persistSession(access_token: string, refresh_token: string, userData: User) {
  localStorage.setItem("access_token", access_token);
  localStorage.setItem("refresh_token", refresh_token);
  localStorage.setItem("user", JSON.stringify(userData));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const token = localStorage.getItem("access_token");
    if (stored && token) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const isPublic = pathname === "/" || pathname.startsWith("/login");
    if (!loading && !user && !isPublic) {
      router.push("/login");
    }
  }, [loading, user, pathname, router]);

  const login = async (email: string, password: string) => {
    const res = await api.post<ApiResponse<{ access_token: string; refresh_token: string; user: User }>>(
      "/auth/login",
      { email, password }
    );
    const { access_token, refresh_token, user: userData } = res.data.data!;
    persistSession(access_token, refresh_token, userData);
    setUser(userData);
    router.push("/dashboard");
  };

  const loginWithGoogle = async (credential: string) => {
    const res = await api.post<ApiResponse<{ access_token: string; refresh_token: string; user: User }>>(
      "/auth/google",
      { credential }
    );
    const { access_token, refresh_token, user: userData } = res.data.data!;
    persistSession(access_token, refresh_token, userData);
    setUser(userData);
    router.push("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
