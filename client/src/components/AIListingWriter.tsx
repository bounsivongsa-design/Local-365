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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  /** Called when the user picks a variant. Should set the description field. */
  onApply: (text: string) => void;
}

const COST = 5;

export function AIListingWriter({ businessId, onApply }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState("");
  const [years, setYears] = useState("");
  const [unique, setUnique] = useState("");
  const [tone, setTone] = useState<"professional" | "friendly" | "luxury" | "casual">("friendly");
  const [variants, setVariants] = useState<Variant[]>([]);

  // Hide entirely for non-Gold businesses (403 GOLD_REQUIRED).
  // The query is gated by `enabled: open` so we don't probe until the user
  // clicks the trigger, but we ALSO need to gate the trigger itself so
  // non-Gold owners never see a button. We do that with a separate cheap
  // probe — the same endpoint, run on mount.
  const credits = useQuery<AICreditsInfo>({
    queryKey: ["/api/businesses", businessId, "ai-credits"],
    retry: false,
    staleTime: 30_000,
  });

  // If the credits query 403s (non-Gold), render nothing.
  const isEligible = credits.data?.eligible === true;
  const balance = credits.data?.balance ?? 0;
  const isFounder = credits.data?.isFounder === true;
  const canAfford = isFounder || balance >= COST;

  const generate = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/listing-description", {
        businessId,
        facts: {
          services: services.trim() || undefined,
          yearsInBusiness: years.trim() || undefined,
          uniqueValueProps: unique.trim() || undefined,
          tone,
        },
      });
      return (await res.json()) as { variants: Variant[]; balance: number };
    },
    onSuccess: (data) => {
      setVariants(data.variants);
      // Refresh balance display
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
            : msg,
        variant: "destructive",
      });
    },
  });

  if (credits.isLoading) {
    return <Skeleton className="h-9 w-40" data-testid="skeleton-ai-writer" />;
  }
  if (!isEligible) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
          data-testid="button-open-ai-writer"
        >
          <Sparkles className="h-4 w-4" />
          Generate with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-ai-writer">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Listing Writer
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
                  Balance: <strong data-testid="text-ai-balance">{balance}</strong> credits
                </>
              )}
            </span>
          </div>
          <span className="text-xs text-amber-700">
            Cost: <strong>{COST} credits</strong> per generation
          </span>
        </div>

        {variants.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tell us a few facts about your business and we'll write three
              polished description options. Pick the one you like best.
            </p>
            <div className="space-y-2">
              <Label htmlFor="ai-services">What services do you offer?</Label>
              <Input
                id="ai-services"
                placeholder="e.g. residential plumbing, drain cleaning, water heater install"
                value={services}
                onChange={(e) => setServices(e.target.value)}
                data-testid="input-ai-services"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ai-years">Years in business</Label>
                <Input
                  id="ai-years"
                  type="number"
                  placeholder="e.g. 8"
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                  data-testid="input-ai-years"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-tone">Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                  <SelectTrigger id="ai-tone" data-testid="select-ai-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="luxury">Luxury</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-unique">What makes you different? (optional)</Label>
              <Textarea
                id="ai-unique"
                rows={2}
                placeholder="e.g. veteran-owned, 24/7 emergency, 100% satisfaction guarantee"
                value={unique}
                onChange={(e) => setUnique(e.target.value)}
                data-testid="input-ai-unique"
              />
            </div>

            {!canAfford && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  You only have {balance} credits — this generation costs {COST}.
                  Wait for next month's grant or buy a credit pack.
                </span>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel-ai-writer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canAfford || generate.isPending}
                onClick={() => generate.mutate()}
                className="bg-amber-500 hover:bg-amber-600"
                data-testid="button-generate-ai"
              >
                {generate.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating…
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
              Pick the variant you like best. We'll drop it into your
              description field — you can still edit it after.
            </p>
            {variants.map((v, i) => (
              <div
                key={i}
                className="rounded-lg border border-border p-4 space-y-2 hover:border-amber-300 transition"
                data-testid={`card-variant-${i}`}
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
                        title: "Description updated",
                        description: "Don't forget to save your listing.",
                      });
                    }}
                    className="bg-amber-500 hover:bg-amber-600 gap-1"
                    data-testid={`button-apply-variant-${i}`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Use this
                  </Button>
                </div>
                <p className="text-sm leading-relaxed text-foreground">{v.text}</p>
              </div>
            ))}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setVariants([]);
                }}
                data-testid="button-regenerate"
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
