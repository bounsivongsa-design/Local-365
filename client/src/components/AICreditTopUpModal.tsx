import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Pack {
  sku: string;
  name: string;
  credits: number;
  priceCents: number;
  badge: string | null;
  pricePerCredit: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: number;
}

export function AICreditTopUpModal({ open, onOpenChange, businessId }: Props) {
  const { toast } = useToast();
  const [selectedSku, setSelectedSku] = useState<string>("popular");

  const { data, isLoading, isError } = useQuery<{ packs: Pack[] }>({
    queryKey: [`/api/ai/credit-packs?businessId=${businessId}`],
    enabled: open,
    staleTime: 60_000,
  });

  const checkout = useMutation({
    mutationFn: async (sku: string) => {
      const res = await apiRequest("POST", "/api/ai/credit-packs/checkout", {
        businessId,
        sku,
      });
      return (await res.json()) as { url?: string; message?: string };
    },
    onSuccess: (resp) => {
      if (resp.url) {
        window.location.href = resp.url;
      } else {
        toast({
          title: "Couldn't start checkout",
          description: resp.message ?? "Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (e: any) => {
      toast({
        title: "Couldn't start checkout",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-ai-topup">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Top up AI credits
          </DialogTitle>
          <DialogDescription>
            Buy a credit pack to keep your AI tools running. Credits never
            expire and stack on top of your monthly Gold allowance.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : isError || !data ? (
          <div
            className="rounded-lg bg-red-50 border border-red-200 px-4 py-6 text-sm text-red-700 text-center"
            data-testid="text-topup-error"
          >
            Couldn't load credit packs. Please close and try again.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.packs.map((p) => {
              const selected = selectedSku === p.sku;
              return (
                <button
                  key={p.sku}
                  type="button"
                  onClick={() => setSelectedSku(p.sku)}
                  className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                    selected
                      ? "border-amber-500 bg-amber-50 shadow-md"
                      : "border-slate-200 bg-white hover:border-amber-300"
                  }`}
                  data-testid={`pack-${p.sku}`}
                >
                  {p.badge && (
                    <Badge className="absolute -top-2 right-3 bg-amber-500 text-white border-0 shadow">
                      {p.badge}
                    </Badge>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-lg font-bold text-[#1a1a2e]">
                      {p.credits.toLocaleString()}
                      <span className="text-xs font-normal text-slate-500 ml-1">
                        credits
                      </span>
                    </div>
                    {selected && (
                      <CheckCircle2 className="h-5 w-5 text-amber-500 shrink-0" />
                    )}
                  </div>
                  <div className="text-2xl font-bold text-amber-700">
                    ${(p.priceCents / 100).toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {p.pricePerCredit.toFixed(2)}¢ per credit
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={checkout.isPending}
            data-testid="button-topup-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              // Guard: only checkout if the selected SKU exists in the
              // currently loaded catalog (prevents stale-default purchases
              // when the catalog failed to load).
              const valid = data?.packs?.some((p) => p.sku === selectedSku);
              if (!valid) {
                toast({
                  title: "Pick a credit pack",
                  description: "Please select an available pack first.",
                  variant: "destructive",
                });
                return;
              }
              checkout.mutate(selectedSku);
            }}
            disabled={
              !selectedSku ||
              checkout.isPending ||
              isLoading ||
              isError ||
              !data?.packs?.length
            }
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
            data-testid="button-topup-checkout"
          >
            {checkout.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Redirecting…
              </>
            ) : (
              "Continue to checkout"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
