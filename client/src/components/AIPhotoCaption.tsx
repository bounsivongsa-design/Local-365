import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  Loader2,
  Coins,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AICreditsInfo {
  balance: number;
  monthlyAllowance: number;
  cycleResetsAt: string | null;
  isFounder: boolean;
  eligible: boolean;
}

interface CaptionResult {
  altText: string;
  caption: string;
  hashtags: string[];
  balance: number;
}

interface Props {
  businessId: number;
  imageUrl: string;
  /** Optional id for stable test selectors when many photos render. */
  photoKey?: string | number;
}

const COST = 2;

export function AIPhotoCaption({
  businessId,
  imageUrl,
  photoKey = 0,
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState("");
  const [result, setResult] = useState<CaptionResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
      const res = await apiRequest("POST", "/api/ai/photo-caption", {
        businessId,
        imageUrl,
        hint: hint.trim() || undefined,
      });
      return (await res.json()) as CaptionResult;
    },
    onSuccess: (data) => {
      setResult(data);
      credits.refetch();
    },
    onError: (err: any) => {
      const msg = err?.message || "Generation failed";
      toast({
        title: "AI assist unavailable",
        description: msg.includes("Not enough credits")
          ? "You're out of AI credits this cycle. Top up in your dashboard."
          : msg.includes("Could not load")
            ? "We couldn't read that photo. Try re-uploading."
            : msg.includes("Gold")
              ? "AI features require a Gold membership."
              : msg,
        variant: "destructive",
      });
    },
  });

  if (credits.isLoading) {
    return null;
  }
  if (!isEligible) return null;

  const copy = async (field: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
      toast({ title: "Copied", description: `${field} copied to clipboard.` });
    } catch {
      toast({
        title: "Copy failed",
        description: "Select the text and copy manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setResult(null);
          setHint("");
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          title="Generate caption with AI"
          className="absolute top-2 left-2 w-7 h-7 rounded-full bg-amber-500/95 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-lg hover:bg-amber-600"
          data-testid={`button-open-ai-photo-caption-${photoKey}`}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="dialog-ai-photo-caption"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Photo Caption & Alt-Text
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
                  Balance:{" "}
                  <strong data-testid="text-ai-balance">{balance}</strong>{" "}
                  credits
                </>
              )}
            </span>
          </div>
          <span className="text-xs text-amber-700">
            Cost: <strong>{COST} credits</strong> per photo
          </span>
        </div>

        <div className="rounded-lg overflow-hidden border border-border">
          <img
            src={
              imageUrl.startsWith("http") || imageUrl.startsWith("/")
                ? imageUrl
                : `/objects/${imageUrl}`
            }
            alt="Photo to caption"
            className="w-full max-h-64 object-contain bg-slate-50"
            data-testid="img-ai-photo-preview"
          />
        </div>

        {!result ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We'll look at the photo and write an accessibility alt-text, a
              social caption, and hashtags. The AI describes what it actually
              sees — give it a hint below if there's context it can't tell
              from the image (e.g., "before/after of a kitchen remodel").
            </p>
            <div className="space-y-2">
              <Label htmlFor="ai-photo-hint">Optional context</Label>
              <Input
                id="ai-photo-hint"
                placeholder="e.g. our team after a charity 5K"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                data-testid="input-ai-photo-hint"
              />
            </div>

            {!canAfford && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  You only have {balance} credits — this generation costs{" "}
                  {COST}. Wait for next month's grant or buy a credit pack.
                </span>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel-ai-photo"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canAfford || generate.isPending}
                onClick={() => generate.mutate()}
                className="bg-amber-500 hover:bg-amber-600"
                data-testid="button-generate-ai-photo"
              >
                {generate.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Looking at photo…
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
          <div className="space-y-4">
            <div className="space-y-2" data-testid="block-alt-text">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Alt-text (accessibility)
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copy("Alt-text", result.altText)}
                  data-testid="button-copy-alt-text"
                  className="h-7 gap-1"
                >
                  {copiedField === "Alt-text" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy
                </Button>
              </div>
              <p
                className="text-sm leading-relaxed text-foreground rounded-lg border border-border p-3 bg-slate-50"
                data-testid="text-alt-text"
              >
                {result.altText}
              </p>
            </div>

            <div className="space-y-2" data-testid="block-caption">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Social caption
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copy("Caption", result.caption)}
                  data-testid="button-copy-caption"
                  className="h-7 gap-1"
                >
                  {copiedField === "Caption" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy
                </Button>
              </div>
              <p
                className="text-sm leading-relaxed text-foreground rounded-lg border border-border p-3 bg-slate-50 whitespace-pre-line"
                data-testid="text-caption"
              >
                {result.caption}
              </p>
            </div>

            <div className="space-y-2" data-testid="block-hashtags">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Hashtags
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    copy(
                      "Hashtags",
                      result.hashtags.map((t) => `#${t}`).join(" "),
                    )
                  }
                  data-testid="button-copy-hashtags"
                  className="h-7 gap-1"
                >
                  {copiedField === "Hashtags" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy all
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.hashtags.map((tag, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="font-normal"
                    data-testid={`badge-hashtag-${i}`}
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResult(null)}
                data-testid="button-regenerate-photo"
              >
                Regenerate (costs another {COST})
              </Button>
              <Button
                type="button"
                onClick={() => setOpen(false)}
                className="bg-amber-500 hover:bg-amber-600"
                data-testid="button-close-photo-result"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
