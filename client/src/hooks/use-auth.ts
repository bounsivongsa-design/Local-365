import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

// Dev mode mock users for testing
const DEV_MOCK_USERS: Record<string, User> = {
  customer: {
    id: "dev-customer-1",
    email: "customer@test.com",
    passwordHash: null,
    googleId: null,
    firstName: "Test",
    lastName: "Customer",
    profileImageUrl: null,
    accountType: "customer",
    isValidated: true,
    linkedBusinessId: null,
    // Annual status (current year)
    annualPoints: 35000,
    annualVisits: 18,
    annualSpent: "2500.00",
    annualTier: "gold",
    statusYear: new Date().getFullYear(),
    // Lifetime status
    lifetimePoints: 85000,
    lifetimeVisits: 65,
    lifetimeSpent: "8500.00",
    lifetimeTier: "silver",
    // Legacy/calculated fields
    loyaltyPoints: 35000,
    loyaltyTier: "gold", // Effective tier (higher of annual or lifetime)
    customerRating: "4.8",
    projectsCompleted: 5,
    totalSpent: "8500.00",
    isAdmin: false,
    engagementBadge: null,
    postCount: 0,
    commentCount: 0,
    likesReceived: 0,
    memberSince: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  business: {
    id: "dev-business-1",
    email: "business@test.com",
    passwordHash: null,
    googleId: null,
    firstName: "Local",
    lastName: "Business",
    profileImageUrl: null,
    accountType: "business",
    isValidated: true,
    linkedBusinessId: 30,
    annualPoints: 0,
    annualVisits: 0,
    annualSpent: "0",
    annualTier: "member",
    statusYear: new Date().getFullYear(),
    lifetimePoints: 0,
    lifetimeVisits: 0,
    lifetimeSpent: "0",
    lifetimeTier: "member",
    loyaltyPoints: 0,
    loyaltyTier: "member",
    customerRating: null,
    projectsCompleted: 0,
    totalSpent: "0",
    isAdmin: false,
    engagementBadge: null,
    postCount: 0,
    commentCount: 0,
    likesReceived: 0,
    memberSince: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

// Check localStorage for dev mode user
function getDevModeUser(): User | null {
  if (import.meta.env.DEV) {
    const devUser = localStorage.getItem("dev_mode_user");
    if (devUser && DEV_MOCK_USERS[devUser]) {
      return DEV_MOCK_USERS[devUser];
    }
  }
  return null;
}

async function fetchUser(): Promise<User | null> {
  // Check for dev mode bypass first
  const devUser = getDevModeUser();
  if (devUser) {
    return devUser;
  }

  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  if (import.meta.env.DEV) {
    localStorage.removeItem("dev_mode_user");
  }
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  window.location.href = "/auth";
}

// Dev mode login helpers (only work in development)
export function devModeLogin(userType: "customer" | "business") {
  if (import.meta.env.DEV) {
    localStorage.setItem("dev_mode_user", userType);
    window.location.reload();
  }
}

export function devModeLogout() {
  if (import.meta.env.DEV) {
    localStorage.removeItem("dev_mode_user");
    window.location.reload();
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
