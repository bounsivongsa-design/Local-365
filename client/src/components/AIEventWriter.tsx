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
  eventTitle?: string;
  /** Pre-fills the "When" hint so the AI references the owner-set date. */
  eventDate?: string;
  /** Pre-fills the "Where" hint. */
  location?: string;
  /** Called when the user picks a variant. Should set the description field. */
  onApply: (text: string) => void;
}

const COST = 4;

export function AIEventWriter({
  businessId,
  eventTitle: titleProp,
  eventDate: dateProp,
  location: locProp,
  onApply,
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState(titleProp ?? "");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState(dateProp ?? "");
  const [location, setLocation] = useState(locProp ?? "");
  const [audience, setAudience] = useState("");
  const [highlights, setHighlights] = useState("");
  const [ticketInfo, setTicketInfo] = useState("");
  const [tone, setTone] = useState<
    "friendly" | "professional" | "playful" | "elegant"
  >("friendly");
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
      const res = await apiRequest("POST", "/api/ai/event-description", {
        businessId,
        facts: {
          eventTitle: eventTitle.trim(),
          eventType: eventType.trim() || undefined,
          eventDate: eventDate.trim() || undefined,
          location: location.trim() || undefined,
          audience: audience.trim() || undefined,
          highlights: highlights.trim() || undefined,
          ticketInfo: ticketInfo.trim() || undefined,
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
    return <Skeleton className="h-8 w-36" data-testid="skeleton-ai-event" />;
  }
  if (!isEligible) return null;

  const titleOk = eventTitle.trim().length >= 2;

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
          data-testid="button-open-ai-event-writer"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generate with AI
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="dialog-ai-event-writer"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Event Description Writer
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
            Cost: <strong>{COST} credits</strong> per generation
          </span>
        </div>

        {variants.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tell us about the event and we'll write three description
              options. The AI won't invent a date, venue, or ticket price —
              leave a field blank if you don't want it mentioned.
            </p>
            <div className="space-y-2">
              <Label htmlFor="ai-event-title">Event title *</Label>
              <Input
                id="ai-event-title"
                placeholder="e.g. Moyock Harvest Market"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                data-testid="input-ai-event-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ai-event-type">Event type (optional)</Label>
                <Input
                  id="ai-event-type"
                  placeholder="e.g. farmers market, concert, fundraiser"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  data-testid="input-ai-event-type"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-event-date">When (optional)</Label>
                <Input
                  id="ai-event-date"
                  placeholder="e.g. Sat Oct 5, 9am–2pm"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  data-testid="input-ai-event-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-event-location">Where (optional)</Label>
              <Input
                id="ai-event-location"
                placeholder="e.g. Currituck Co. Rural Center, Moyock"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                data-testid="input-ai-event-location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-event-highlights">
                Highlights / what's happening (optional)
              </Label>
              <Textarea
                id="ai-event-highlights"
                rows={3}
                placeholder="e.g. 30+ vendors, live music from a local band, food trucks, kids' craft tent"
                value={highlights}
                onChange={(e) => setHighlights(e.target.value)}
                data-testid="input-ai-event-highlights"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ai-event-audience">
                  Who it's for (optional)
                </Label>
                <Input
                  id="ai-event-audience"
                  placeholder="e.g. families, foodies, all ages"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  data-testid="input-ai-event-audience"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-event-tickets">
                  Tickets / cost (optional)
                </Label>
                <Input
                  id="ai-event-tickets"
                  placeholder="e.g. Free, $10 at the gate"
                  value={ticketInfo}
                  onChange={(e) => setTicketInfo(e.target.value)}
                  data-testid="input-ai-event-tickets"
                />
              </div>
            </div>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="ai-event-tone">Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                <SelectTrigger
                  id="ai-event-tone"
                  data-testid="select-ai-event-tone"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="playful">Playful</SelectItem>
                  <SelectItem value="elegant">Elegant</SelectItem>
                </SelectContent>
              </Select>
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
                data-testid="button-cancel-ai-event"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canAfford || !titleOk || generate.isPending}
                onClick={() => generate.mutate()}
                className="bg-amber-500 hover:bg-amber-600"
                data-testid="button-generate-ai-event"
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
                data-testid={`card-event-variant-${i}`}
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
                        description: "Review it, then continue with your event.",
                      });
                    }}
                    className="bg-amber-500 hover:bg-amber-600 gap-1"
                    data-testid={`button-apply-event-variant-${i}`}
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
                data-testid="button-regenerate-event"
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
