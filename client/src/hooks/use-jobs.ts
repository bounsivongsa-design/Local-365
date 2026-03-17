import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type JobListingWithBusiness, type JobListing } from "@shared/schema";

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
      return res.json();
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
