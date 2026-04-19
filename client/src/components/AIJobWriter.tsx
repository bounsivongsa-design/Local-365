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
  /** Pre-fills the modal so the owner doesn't re-type the title. */
  jobTitle?: string;
  /** Called when the user picks a variant. Should set the description field. */
  onApply: (text: string) => void;
}

const COST = 5;

export function AIJobWriter({ businessId, jobTitle: jobTitleProp, onApply }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [jobTitle, setJobTitle] = useState(jobTitleProp ?? "");
  const [role, setRole] = useState("");
  const [requirements, setRequirements] = useState("");
  const [payRange, setPayRange] = useState("");
  const [hours, setHours] = useState("");
  const [perks, setPerks] = useState("");
  const [tone, setTone] = useState<"friendly" | "professional" | "casual" | "energetic">(
    "friendly",
  );
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
      const res = await apiRequest("POST", "/api/ai/job-description", {
        businessId,
        facts: {
          jobTitle: jobTitle.trim(),
          role: role.trim() || undefined,
          requirements: requirements.trim() || undefined,
          payRange: payRange.trim() || undefined,
          hours: hours.trim() || undefined,
          perks: perks.trim() || undefined,
          tone,
        },
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
            : msg,
        variant: "destructive",
      });
    },
  });

  if (credits.isLoading) {
    return <Skeleton className="h-8 w-36" data-testid="skeleton-ai-job" />;
  }
  if (!isEligible) return null;

  const titleOk = jobTitle.trim().length >= 2;

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
          data-testid="button-open-ai-job-writer"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generate with AI
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="dialog-ai-job-writer"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Help Wanted Writer
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
            Cost: <strong>{COST} credits</strong> per generation
          </span>
        </div>

        {variants.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tell us about the role and we'll write three Help Wanted ad
              options. The AI won't invent a pay rate or perks — leave a field
              blank if you don't want it mentioned.
            </p>
            <div className="space-y-2">
              <Label htmlFor="ai-job-title">Job title *</Label>
              <Input
                id="ai-job-title"
                placeholder="e.g. HVAC Technician"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                data-testid="input-ai-job-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-job-role">What does the role do? (optional)</Label>
              <Textarea
                id="ai-job-role"
                rows={2}
                placeholder="e.g. service residential HVAC systems, troubleshoot, install"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                data-testid="input-ai-job-role"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-job-requirements">Requirements (optional)</Label>
              <Textarea
                id="ai-job-requirements"
                rows={2}
                placeholder="e.g. 2+ years experience, EPA cert, valid NC driver's license"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                data-testid="input-ai-job-requirements"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ai-job-pay">Pay range (optional)</Label>
                <Input
                  id="ai-job-pay"
                  placeholder="e.g. $25–35/hr"
                  value={payRange}
                  onChange={(e) => setPayRange(e.target.value)}
                  data-testid="input-ai-job-pay"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-job-hours">Hours (optional)</Label>
                <Input
                  id="ai-job-hours"
                  placeholder="e.g. Mon–Fri, full time"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  data-testid="input-ai-job-hours"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-job-perks">Perks (optional)</Label>
              <Input
                id="ai-job-perks"
                placeholder="e.g. company truck, paid training, health insurance"
                value={perks}
                onChange={(e) => setPerks(e.target.value)}
                data-testid="input-ai-job-perks"
              />
            </div>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="ai-job-tone">Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                <SelectTrigger id="ai-job-tone" data-testid="select-ai-job-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="energetic">Energetic</SelectItem>
                </SelectContent>
              </Select>
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
                data-testid="button-cancel-ai-job"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canAfford || !titleOk || generate.isPending}
                onClick={() => generate.mutate()}
                className="bg-amber-500 hover:bg-amber-600"
                data-testid="button-generate-ai-job"
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
              Pick the variant you like best. We'll drop it into your description
              field — you can still edit it after.
            </p>
            {variants.map((v, i) => (
              <div
                key={i}
                className="rounded-lg border border-border p-4 space-y-2 hover:border-amber-300 transition"
                data-testid={`card-job-variant-${i}`}
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
                        description: "Review it, then continue with your post.",
                      });
                    }}
                    className="bg-amber-500 hover:bg-amber-600 gap-1"
                    data-testid={`button-apply-job-variant-${i}`}
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
                data-testid="button-regenerate-job"
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
