import { useMutation } from "@tanstack/react-query";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

type Impersonator = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

export function ImpersonationBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const impersonator = (user as unknown as { impersonator?: Impersonator | null } | null)?.impersonator ?? null;

  const stopMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/stop-impersonating");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Returned to admin account" });
      window.location.href = "/admin";
    },
    onError: (err: Error) => {
      toast({ title: "Could not return to admin", description: err.message, variant: "destructive" });
    },
  });

  if (!impersonator) return null;

  const adminLabel = [impersonator.firstName, impersonator.lastName].filter(Boolean).join(" ") || impersonator.email || "admin";
  const targetLabel = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "this user";

  return (
    <div
      className="w-full bg-amber-500 text-amber-950 border-b border-amber-700 shadow-md"
      data-testid="banner-impersonating"
    >
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-2 py-2 px-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span data-testid="text-impersonation-status">
            Signed in as <strong>{targetLabel}</strong> (admin: {adminLabel})
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="bg-amber-950 text-amber-50 hover:bg-amber-900"
          onClick={() => stopMutation.mutate()}
          disabled={stopMutation.isPending}
          data-testid="button-stop-impersonating"
        >
          {stopMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Return to admin"}
        </Button>
      </div>
    </div>
  );
}
