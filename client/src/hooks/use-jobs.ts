import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type JobListingWithBusiness, type JobListing } from "@shared/schema";

export function useJobPricing(enabled: boolean = true) {
  return useQuery<{ tier: string; tierLabel: string; pricePerWeek: number }>({
    queryKey: ["/api/jobs/pricing"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/pricing", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pricing");
      return res.json();
    },
    enabled,
  });
}

export function useJobListings() {
  return useQuery<JobListingWithBusiness[]>({
    queryKey: ["/api/jobs"],
    queryFn: async () => {
      const res = await fetch("/api/jobs", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch job listings");
      return res.json();
    },
  });
}

export function useMyJobListings(enabled: boolean = true) {
  return useQuery<JobListing[]>({
    queryKey: ["/api/jobs/my-listings"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/my-listings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch your listings");
      return res.json();
    },
    enabled,
  });
}

export function useCreateJobListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; description: string; imageUrl?: string; contactPhone?: string; contactEmail?: string }) => {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create listing");
      }
      return res.json() as Promise<JobListing>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-listings"] });
    },
  });
}

export function useJobCheckout() {
  return useMutation({
    mutationFn: async (jobListingId: number) => {
      const res = await fetch("/api/stripe/job-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobListingId }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to start checkout");
      }
      return res.json() as Promise<{ url: string }>;
    },
  });
}

export function useUpdateJobListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { title?: string; description?: string; imageUrl?: string; contactPhone?: string; contactEmail?: string } }) => {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update listing");
      }
      return res.json() as Promise<JobListing>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-listings"] });
    },
  });
}

export function useDeleteJobListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete listing");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-listings"] });
    },
  });
}
