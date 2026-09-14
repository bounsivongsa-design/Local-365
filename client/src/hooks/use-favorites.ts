import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { type BusinessWithRating } from "@shared/schema";

export const FAVORITES_QUERY_PATH = "/api/user/favorites";

/**
 * The user id is part of the cache key on purpose. This prevents a cached
 * favorite list from being reused when the session changes accounts.
 */
export function useFavorites() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<BusinessWithRating[]>({
    queryKey: [FAVORITES_QUERY_PATH, userId],
    queryFn: async () => {
      const response = await fetch(FAVORITES_QUERY_PATH, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to fetch favorites");
      }
      return response.json() as Promise<BusinessWithRating[]>;
    },
    enabled: isAuthenticated && !!userId,
  });
}

export function useToggleFavorite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  return useMutation({
    mutationFn: async ({ businessId, favorited }: { businessId: number; favorited: boolean }) => {
      const method = favorited ? "DELETE" : "POST";
      const response = await apiRequest(method, `/api/businesses/${businessId}/favorite`);
      return response.json() as Promise<{ businessId: number; favorited: boolean }>;
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: [FAVORITES_QUERY_PATH, userId] });
      }
    },
  });
}