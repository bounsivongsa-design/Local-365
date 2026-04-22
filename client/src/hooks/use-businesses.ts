import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateBusinessRequest, type CreateReviewRequest } from "@shared/routes";
import { type BusinessWithRating, type ReviewWithUser } from "@shared/schema";

// List businesses
export function useBusinesses(filters?: { category?: string; search?: string }) {
  // Construct query key based on filters to ensure caching works correctly
  const queryKey = [api.businesses.list.path, filters?.category, filters?.search];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      // Build URL with query params manually since fetch doesn't support params object directly in the same way
      const url = new URL(window.location.origin + api.businesses.list.path);
      if (filters?.category && filters.category !== "All") url.searchParams.append("category", filters.category);
      if (filters?.search) url.searchParams.append("search", filters.search);

      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch businesses");
      // Use the Zod schema from routes to validate response if needed, 
      // but for arrays sometimes simpler to just cast if types are shared
      return await res.json() as BusinessWithRating[]; 
    },
  });
}

// Get single business
export function useBusiness(id: number) {
  return useQuery({
    queryKey: [api.businesses.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.businesses.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch business");
      return await res.json() as BusinessWithRating & { reviews: ReviewWithUser[] };
    },
    enabled: !!id,
  });
}

// Create business
export function useCreateBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateBusinessRequest) => {
      const res = await fetch(api.businesses.create.path, {
        method: api.businesses.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
         const error = await res.json();
         throw new Error(error.message || "Failed to create business");
      }
      return api.businesses.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.businesses.list.path] });
    },
  });
}

// Create review
export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ businessId, ...data }: CreateReviewRequest & { businessId: number; reviewRequestToken?: string }) => {
      const url = buildUrl(api.reviews.create.path, { id: businessId });
      const res = await fetch(url, {
        method: api.reviews.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to submit review");
      return api.reviews.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.businesses.get.path, variables.businessId] });
      queryClient.invalidateQueries({ queryKey: [api.businesses.list.path] });
    },
  });
}
