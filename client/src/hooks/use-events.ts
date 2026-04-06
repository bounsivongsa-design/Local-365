import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type CreateEventRequest } from "@shared/routes";
import { type Event } from "@shared/schema";

export function useEvents(zipCode?: string) {
  const zip = zipCode || "";
  const url = zip ? `${api.events.list.path}?zipCode=${zip}` : api.events.list.path;
  return useQuery({
    queryKey: [api.events.list.path, zip],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch events");
      return api.events.list.responses[200].parse(await res.json());
    },
  });
}

export function useMyEvents(enabled: boolean = true) {
  return useQuery<Event[]>({
    queryKey: ["/api/events/my-events"],
    queryFn: async () => {
      const res = await fetch("/api/events/my-events", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch your events");
      return res.json();
    },
    enabled,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateEventRequest) => {
      const res = await fetch(api.events.create.path, {
        method: api.events.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create event");
      return api.events.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.events.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/my-events"] });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { title?: string; description?: string; location?: string; imageUrl?: string; flyerUrl?: string; promoVideoUrl?: string } }) => {
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update event");
      }
      return res.json() as Promise<Event>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.events.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/my-events"] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/events/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete event");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.events.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/my-events"] });
    },
  });
}
