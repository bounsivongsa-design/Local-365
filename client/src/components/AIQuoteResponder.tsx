import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2, Coins, AlertCircle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AICreditsInfo {
  balance: number;
  monthlyAllowance: number;
  cycleResetsAt: string | null;
  isFounder: boolean;
  eligible: boolean;
}

interface Variant {
  label: string;
  text: string;
}

interface Props {
  businessId: number;
  quoteRequestId: number;
  /** Called when the user picks a variant. Should set the message field. */
  onApply: (text: string) => void;
}

const COST = 3;

export function AIQuoteResponder({ businessId, quoteRequestId, onApply }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<"warm" | "professional" | "inquisitive">("warm");
  const [variants, setVariants] = useState<Variant[]>([]);

  const credits = useQuery<AICreditsInfo>({
    queryKey: ["/api/businesses", businessId, "ai-credits"],
    retry: false,
    staleTime: 30_000,
  });

  const isEligible = credits.data?.eligible === true;
  const balance = credits.data?.balance ?? 0;
  const isFounder = credits.data?.isFounder === true;
  const canAfford = isFounder || balance >= COST;

  const generate = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/quote-response", {
        businessId,
        quoteRequestId,
        tone,
      });
      return (await res.json()) as { variants: Variant[]; balance: number };
    },
    onSuccess: (data) => {
      setVariants(data.variants);
      credits.refetch();
    },
    onError: (err: any) => {
      const msg = err?.message || "Generation failed";
      toast({
        title: "AI assist unavailable",
        description: msg.includes("Not enough credits")
          ? "You're out of AI credits this cycle. Top up in your dashboard."
          : msg.includes("Gold")
            ? "AI features require a Gold membership."
            : msg.includes("no longer accepting")
              ? "This quote request is closed."
              : msg,
        variant: "destructive",
      });
    },
  });

  if (credits.isLoading) {
    return <Skeleton className="h-8 w-36" data-testid="skeleton-ai-quote" />;
  }
  if (!isEligible) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setVariants([]);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
          data-testid="button-open-ai-quote-responder"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Draft with AI
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="dialog-ai-quote-responder"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Quote Responder
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
          <div className="flex items-center gap-2 text-amber-800">
            <Coins className="h-4 w-4" />
            <span>
              {isFounder ? (
                <strong>Founder unlimited</strong>
              ) : (
                <>
                  Balance: <strong data-testid="text-ai-balance">{balance}</strong>{" "}
                  credits
                </>
              )}
            </span>
          </div>
          <span className="text-xs text-amber-700">
            Cost: <strong>{COST} credits</strong> per draft
          </span>
        </div>

        {variants.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We'll draft two opening messages tailored to this customer's
              project. The AI never quotes a price — you set that yourself.
            </p>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="ai-quote-tone">Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                <SelectTrigger id="ai-quote-tone" data-testid="select-ai-quote-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="inquisitive">Inquisitive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!canAfford && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  You only have {balance} credits — this draft costs {COST}.
                  Wait for next month's grant or buy a credit pack.
                </span>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel-ai-quote"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canAfford || generate.isPending}
                onClick={() => generate.mutate()}
                className="bg-amber-500 hover:bg-amber-600"
                data-testid="button-generate-ai-quote"
              >
                {generate.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Drafting…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate ({COST} credits)
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pick one to drop into the message field. You can still edit it
              after.
            </p>
            {variants.map((v, i) => (
              <div
                key={i}
                className="rounded-lg border border-border p-4 space-y-2 hover:border-amber-300 transition"
                data-testid={`card-quote-variant-${i}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    {v.label}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onApply(v.text);
                      setOpen(false);
                      setVariants([]);
                      toast({
                        title: "Message updated",
                        description: "Review it, add a price if ready, then send.",
                      });
                    }}
                    className="bg-amber-500 hover:bg-amber-600 gap-1"
                    data-testid={`button-apply-quote-variant-${i}`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Use this
                  </Button>
                </div>
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                  {v.text}
                </p>
              </div>
            ))}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setVariants([])}
                data-testid="button-regenerate-quote"
              >
                Regenerate (costs another {COST})
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
