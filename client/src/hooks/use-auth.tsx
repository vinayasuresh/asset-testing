import { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { LoginRequest, RegisterRequest, User, Tenant } from "@shared/schema";

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
}

interface AuthContextType {
  user: AuthUser | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const queryClient = useQueryClient();

  // Verify token on app load
  const { data: verifyData, isLoading: isVerifying } = useQuery({
    queryKey: ["/api/auth/verify"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) return null;

      const response = await fetch("/api/auth/verify", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        localStorage.removeItem("token");
        return null;
      }
      
      return response.json();
    },
    retry: false,
  });

  // Handle verify data with useEffect
  useEffect(() => {
    if (verifyData) {
      setUser(verifyData.user);
      setTenant(verifyData.tenant);
    }
  }, [verifyData]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const response = await apiRequest("POST", "/api/auth/login", credentials);
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("token", data.token);
      setUser(data.user);
      setTenant(data.tenant);
      queryClient.invalidateQueries();
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterRequest) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("token", data.token);
      setUser(data.user);
      setTenant(data.tenant);
      queryClient.invalidateQueries();
    },
  });

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setTenant(null);
    queryClient.clear();
  };

  const value: AuthContextType = {
    user,
    tenant,
    isAuthenticated: !!user,
    isLoading: isVerifying,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
