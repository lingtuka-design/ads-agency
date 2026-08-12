import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface MeUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: "admin" | "publisher" | "advertiser" | null;
  account_status: string;
  avatar_url: string | null;
  must_change_password: number;
  company_name?: string | null;
  industry?: string | null;
  advertiser_verified?: number | null;
  publisher_id?: string | null;
  publisher_name?: string | null;
  publisher_status?: string | null;
  publisher_verified?: number | null;
  staff_role?: string | null;
}

interface AuthContextValue {
  user: MeUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isPublisher: boolean;
  isAdvertiser: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await api.get<{ user: MeUser | null }>("/api/auth/me");
      return res.user;
    },
    retry: false,
    staleTime: 60_000,
  });

  const value: AuthContextValue = {
    user: data ?? null,
    loading: isLoading,
    isAuthenticated: !!data,
    isAdmin: data?.role === "admin",
    isPublisher: data?.role === "publisher",
    isAdvertiser: data?.role === "advertiser",
    refresh: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
    },
    logout: async () => {
      await api.post("/api/auth/logout");
      qc.clear();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
