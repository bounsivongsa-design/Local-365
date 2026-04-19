import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2, Coins, AlertCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AICreditsInfo {
  balance: number;
  isFounder: boolean;
  eligible: boolean;
}

interface DraftResult {
  subject: string;
  bodyHtml: string;
  balance: number;
}

interface Props {
  businessId: number;
  onAccept: (draft: { subject: string; bodyHtml: string }) => void;
}

const COST = 3;

export function AINewsletterAssist({ businessId, onAccept }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState("");
  const [what, setWhat] = useState("");
  const [when, setWhen] = useState("");
  const [cta, setCta] = useState("");
  const [tone, setTone] = useState<"friendly" | "professional" | "casual" | "exciting">("friendly");
  const [result, setResult] = useState<DraftResult | null>(null);

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
      const res = await apiRequest("POST", "/api/ai/newsletter-draft", {
        businessId,
        audience: audience.trim() || undefined,
        what: what.trim(),
        when: when.trim() || undefined,
        cta: cta.trim() || undefined,
        tone,
      });
      return (await res.json()) as DraftResult;
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
          : msg.includes("Gold")
            ? "AI features require a Gold membership."
            : msg,
        variant: "destructive",
      });
    },
  });

  if (credits.isLoading) return null;
  if (!isEligible) return null;

  const accept = () => {
    if (!result) return;
    onAccept({ subject: result.subject, bodyHtml: result.bodyHtml });
    setOpen(false);
    setResult(null);
    toast({ title: "Draft loaded", description: "Edit anything you'd like before sending." });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 border-amber-500/40 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          data-testid="button-open-ai-newsletter"
        >
          <Sparkles className="h-4 w-4" />
          AI Draft
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl" data-testid="dialog-ai-newsletter">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Newsletter Draft
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-500" />
            {isFounder ? (
              <Badge variant="secondary" className="bg-amber-100 text-amber-900">Founder — unlimited</Badge>
            ) : (
              <span data-testid="text-newsletter-ai-balance">Balance: <strong>{balance}</strong> credits</span>
            )}
          </div>
          <span className="text-muted-foreground">Cost: <strong>{COST}</strong></span>
        </div>

        {!result ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="ai-news-what">What's this email about?</Label>
              <Textarea
                id="ai-news-what"
                value={what}
                onChange={(e) => setWhat(e.target.value)}
                placeholder="e.g. Saturday we're running a 20% off lawn-treatment special for new customers; we just hired two new techs so wait times are shorter."
                rows={3}
                data-testid="input-ai-news-what"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ai-news-audience">Audience (optional)</Label>
                <Input
                  id="ai-news-audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="past customers, neighbors"
                  data-testid="input-ai-news-audience"
                />
              </div>
              <div>
                <Label htmlFor="ai-news-when">When (optional)</Label>
                <Input
                  id="ai-news-when"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  placeholder="this Saturday, all April"
                  data-testid="input-ai-news-when"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ai-news-cta">Call to action (optional)</Label>
              <Input
                id="ai-news-cta"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="reply to book, call us, visit our shop"
                data-testid="input-ai-news-cta"
              />
            </div>
            <div>
              <Label htmlFor="ai-news-tone">Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                <SelectTrigger id="ai-news-tone" data-testid="select-ai-news-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Friendly &amp; warm</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="exciting">Exciting &amp; energetic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!canAfford && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                <span>
                  You need <strong>{COST}</strong> credits and have <strong>{balance}</strong>.
                  Top up from your dashboard.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Subject line</Label>
              <div className="rounded-lg border bg-muted/30 p-3 font-medium" data-testid="text-ai-news-subject">
                {result.subject}
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Body preview</Label>
              <div
                className="rounded-lg border bg-white p-4 text-sm prose prose-sm max-w-none dark:bg-zinc-900"
                data-testid="text-ai-news-body"
                dangerouslySetInnerHTML={{ __html: result.bodyHtml }}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                A footer with your business address and an unsubscribe link is added automatically when you send.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!result ? (
            <Button
              type="button"
              onClick={() => generate.mutate()}
              disabled={!what.trim() || !canAfford || generate.isPending}
              data-testid="button-generate-ai-news"
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {generate.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Drafting...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate ({COST} credits)</>
              )}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResult(null)}
                data-testid="button-regenerate-ai-news"
              >
                Try again ({COST} more)
              </Button>
              <Button
                type="button"
                onClick={accept}
                data-testid="button-use-ai-news"
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                Use this draft
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
