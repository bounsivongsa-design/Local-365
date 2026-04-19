import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Tag,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  ExternalLink,
  Coins,
  Pause,
  Play,
  Archive,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PublicDeal {
  id: number; businessId: number; title: string; description: string;
  discountText: string; redemptionInstructions: string;
  startsAt: string; endsAt: string; clickCount: number;
  businessName: string;
  businessLogoUrl: string | null; businessCategory: string | null;
}
interface OwnerDeal {
  id: number; title: string; description: string; discountText: string;
  redemptionInstructions: string; startsAt: string; endsAt: string;
  status: string; clickCount: number; createdAt: string;
}
interface AICredits { balance: number; isFounder: boolean; eligible: boolean }

const AI_DEAL_COST = 3;

function formatDateTime(s: string): string {
  return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function toLocalInput(d: Date): string {
  const tz = d.getTime() - d.getTimezoneOffset() * 60_000;
  return new Date(tz).toISOString().slice(0, 16);
}

export default function DealsPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const businessId = user?.linkedBusinessId ?? null;
  const [tab, setTab] = useState<"browse" | "manage">("browse");

  const publicDeals = useQuery<{ deals: PublicDeal[]; total: number }>({
    queryKey: ["/api/deals"],
  });

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2 text-[#0a4a82]">
          <Tag className="h-7 w-7" /> Local Deals & Offers
        </h1>
        <p className="text-muted-foreground mt-1">Limited-time offers from Currituck County businesses.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="browse" data-testid="tab-deals-browse">Browse Deals</TabsTrigger>
          {isAuthenticated && businessId && (
            <TabsTrigger value="manage" data-testid="tab-deals-manage">Manage Mine</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="browse" className="mt-4">
          <BrowseDeals query={publicDeals} />
        </TabsContent>

        {isAuthenticated && businessId && (
          <TabsContent value="manage" className="mt-4">
            <ManageDeals businessId={businessId} onChanged={() => publicDeals.refetch()} toast={toast} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function BrowseDeals({ query }: { query: ReturnType<typeof useQuery<{ deals: PublicDeal[]; total: number }>> }) {
  const trackClick = useMutation({
    mutationFn: async (dealId: number) => {
      await apiRequest("POST", `/api/deals/${dealId}/click`);
    },
  });
  if (query.isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>;
  const list = query.data?.deals ?? [];
  if (list.length === 0) {
    return (
      <Card><CardContent className="py-16 text-center">
        <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-lg font-medium">No active deals right now</p>
        <p className="text-sm text-muted-foreground mt-1">Check back soon — local businesses post limited-time offers here.</p>
      </CardContent></Card>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {list.map((d) => {
        const hoursLeft = Math.max(0, Math.round((new Date(d.endsAt).getTime() - Date.now()) / 3_600_000));
        const endsSoon = hoursLeft < 24;
        return (
          <Card key={d.id} className="hover-elevate transition" data-testid={`card-deal-${d.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <Badge className="bg-[#d4a373] hover:bg-[#d4a373] text-white">{d.discountText}</Badge>
                {endsSoon && <Badge variant="destructive">Ends in {hoursLeft}h</Badge>}
              </div>
              <CardTitle className="text-lg mt-2">{d.title}</CardTitle>
              <CardDescription className="text-xs">
                <Link
                  to={`/directory/${d.businessId}`}
                  className="text-[#0a4a82] hover:underline font-medium"
                  data-testid={`link-deal-business-${d.id}`}
                >
                  {d.businessName}
                </Link>
                {d.businessCategory && <span className="text-muted-foreground"> · {d.businessCategory}</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{d.description}</p>
              <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
                <div className="flex items-start gap-1.5"><Calendar className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>Through {formatDateTime(d.endsAt)}</span></div>
                <div className="flex items-start gap-1.5"><Tag className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>{d.redemptionInstructions}</span></div>
              </div>
              <Button
                asChild
                className="w-full bg-[#0a4a82] hover:bg-[#0a4a82]/90"
                onClick={() => trackClick.mutate(d.id)}
                data-testid={`button-deal-claim-${d.id}`}
              >
                <Link to={`/directory/${d.businessId}`}>
                  <ExternalLink className="h-4 w-4 mr-1" /> View Business
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ManageDeals({ businessId, onChanged, toast }: { businessId: number; onChanged: () => void; toast: ReturnType<typeof useToast>["toast"] }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<OwnerDeal | null>(null);

  const credits = useQuery<AICredits>({
    queryKey: ["/api/businesses", businessId, "ai-credits"],
    retry: false,
  });
  const myDeals = useQuery<{ deals: OwnerDeal[]; eligible: boolean }>({
    queryKey: ["/api/businesses", businessId, "deals"],
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/businesses/${businessId}/deals/${id}`, { status });
    },
    onSuccess: () => { myDeals.refetch(); onChanged(); },
  });
  const remove = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/businesses/${businessId}/deals/${id}`);
    },
    onSuccess: () => { myDeals.refetch(); onChanged(); toast({ title: "Deleted" }); },
  });

  if (myDeals.data && !myDeals.data.eligible) {
    return (
      <Card>
        <CardHeader><CardTitle>Daily Deals require Gold</CardTitle></CardHeader>
        <CardContent>
          <Button asChild className="bg-amber-500 hover:bg-amber-600"><Link to="/membership">Upgrade to Gold</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coins className="h-4 w-4 text-amber-500" />
          {credits.data?.isFounder ? "Founder — unlimited AI" : `${credits.data?.balance ?? 0} AI credits`}
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} data-testid="button-new-deal">
          <Plus className="h-4 w-4 mr-1" /> New Deal
        </Button>
      </div>

      {showForm && (
        <DealForm
          businessId={businessId}
          editing={editing}
          credits={credits.data}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { myDeals.refetch(); onChanged(); }}
          toast={toast}
        />
      )}

      {myDeals.isLoading ? (
        <Skeleton className="h-32" />
      ) : (myDeals.data?.deals ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No deals yet. Click "New Deal" to create your first one.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {myDeals.data!.deals.map((d) => {
            const isExpired = new Date(d.endsAt) < new Date();
            const isLive = d.status === "active" && !isExpired && new Date(d.startsAt) <= new Date();
            return (
              <Card key={d.id} data-testid={`row-mine-deal-${d.id}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className="bg-[#d4a373] hover:bg-[#d4a373] text-white">{d.discountText}</Badge>
                        {isLive && <Badge className="bg-green-600 hover:bg-green-600">Live</Badge>}
                        {d.status === "paused" && <Badge variant="secondary">Paused</Badge>}
                        {d.status === "archived" && <Badge variant="outline">Archived</Badge>}
                        {isExpired && d.status === "active" && <Badge variant="destructive">Expired</Badge>}
                        <span className="text-xs text-muted-foreground">{d.clickCount} clicks</span>
                      </div>
                      <p className="font-semibold">{d.title}</p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{d.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDateTime(d.startsAt)} → {formatDateTime(d.endsAt)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(d); setShowForm(true); }} data-testid={`button-edit-deal-${d.id}`}>
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      {d.status === "active" ? (
                        <Button size="icon" variant="ghost" onClick={() => setStatus.mutate({ id: d.id, status: "paused" })}>
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : d.status === "paused" ? (
                        <Button size="icon" variant="ghost" onClick={() => setStatus.mutate({ id: d.id, status: "active" })}>
                          <Play className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button size="icon" variant="ghost" onClick={() => setStatus.mutate({ id: d.id, status: "archived" })}>
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove.mutate(d.id)} data-testid={`button-delete-deal-${d.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DealForm({ businessId, editing, credits, onClose, onSaved, toast }: {
  businessId: number;
  editing: OwnerDeal | null;
  credits: AICredits | undefined;
  onClose: () => void;
  onSaved: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const weekOut = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [discountText, setDiscountText] = useState(editing?.discountText ?? "");
  const [redemptionInstructions, setRedemptionInstructions] = useState(editing?.redemptionInstructions ?? "Mention this deal when you call or visit.");
  const [startsAt, setStartsAt] = useState(toLocalInput(editing ? new Date(editing.startsAt) : new Date()));
  const [endsAt, setEndsAt] = useState(toLocalInput(editing ? new Date(editing.endsAt) : weekOut));

  // AI Assist
  const [aiOpen, setAiOpen] = useState(false);
  const [aiOffer, setAiOffer] = useState("");
  const [aiVariants, setAiVariants] = useState<Record<string, { title: string; description: string }> | null>(null);

  const isFounder = credits?.isFounder === true;
  const balance = credits?.balance ?? 0;

  const aiDraft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/deal-draft", {
        businessId,
        offer: aiOffer.trim(),
        discountText: discountText.trim() || "see description",
      });
      return (await res.json()) as { variants: Record<string, { title: string; description: string }> };
    },
    onSuccess: (data) => {
      setAiVariants(data.variants);
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId, "ai-credits"] });
    },
    onError: (err: any) => toast({ title: "AI draft failed", description: err?.message, variant: "destructive" }),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        discountText: discountText.trim(),
        redemptionInstructions: redemptionInstructions.trim(),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      };
      if (editing) {
        await apiRequest("PATCH", `/api/businesses/${businessId}/deals/${editing.id}`, payload);
      } else {
        await apiRequest("POST", `/api/businesses/${businessId}/deals`, payload);
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Deal updated" : "Deal published" });
      onSaved();
      onClose();
    },
    onError: (err: any) => toast({ title: "Save failed", description: err?.message, variant: "destructive" }),
  });

  const valid = title.trim().length >= 3 && description.trim().length >= 10 && discountText.trim().length >= 2 && redemptionInstructions.trim().length >= 5 && new Date(endsAt) > new Date(startsAt) && new Date(endsAt) > new Date();

  return (
    <Card className="border-[#0a4a82]/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{editing ? "Edit deal" : "New deal"}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label htmlFor="deal-title">Title</Label>
            <Input id="deal-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Free fence inspection this weekend" data-testid="input-deal-title" />
          </div>
          <div>
            <Label htmlFor="deal-discount">Discount/Offer</Label>
            <Input id="deal-discount" value={discountText} onChange={(e) => setDiscountText(e.target.value)} maxLength={60} placeholder="20% off · BOGO · Free" data-testid="input-deal-discount" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label htmlFor="deal-desc">Description</Label>
            <Button
              type="button" size="sm" variant="outline"
              onClick={() => setAiOpen(true)}
              disabled={!isFounder && balance < AI_DEAL_COST}
              className="h-7"
              data-testid="button-deal-ai"
            >
              <Sparkles className="h-3 w-3 mr-1 text-amber-500" /> AI ({AI_DEAL_COST}cr)
            </Button>
          </div>
          <Textarea id="deal-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={800} rows={4} placeholder="What's included, who it's for, why it's a great deal..." data-testid="input-deal-desc" />
        </div>

        {aiOpen && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-4 space-y-3">
              {!aiVariants ? (
                <>
                  <p className="text-sm font-medium">Describe what's on offer:</p>
                  <Textarea value={aiOffer} onChange={(e) => setAiOffer(e.target.value)} maxLength={300} rows={2} placeholder="Free pressure-washing inspection for any fence repair quote booked this weekend" data-testid="input-deal-ai-offer" />
                  <div className="flex gap-2">
                    <Button onClick={() => aiDraft.mutate()} disabled={aiOffer.trim().length < 5 || aiDraft.isPending} className="bg-amber-500 hover:bg-amber-600 text-white" data-testid="button-deal-ai-generate">
                      {aiDraft.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Generating</> : <><Sparkles className="h-4 w-4 mr-1" />Generate ({AI_DEAL_COST}cr)</>}
                    </Button>
                    <Button variant="ghost" onClick={() => setAiOpen(false)}>Cancel</Button>
                  </div>
                  {!discountText && <p className="text-xs text-muted-foreground"><AlertCircle className="h-3 w-3 inline mr-1" />Tip: fill the Discount field above so AI uses the real promo, not invented ones.</p>}
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Pick a variant:</p>
                  {Object.entries(aiVariants).map(([key, v]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setTitle(v.title); setDescription(v.description); setAiVariants(null); setAiOpen(false); }}
                      className="w-full text-left p-3 rounded-lg border bg-white hover:border-amber-400"
                      data-testid={`button-deal-ai-pick-${key}`}
                    >
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{key}</p>
                      <p className="font-semibold text-sm">{v.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
                    </button>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => { setAiVariants(null); setAiOpen(false); }}>Cancel</Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="deal-start">Starts</Label>
            <Input id="deal-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} data-testid="input-deal-start" />
          </div>
          <div>
            <Label htmlFor="deal-end">Ends</Label>
            <Input id="deal-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} data-testid="input-deal-end" />
          </div>
        </div>
        <div>
          <Label htmlFor="deal-redeem">How to redeem</Label>
          <Input id="deal-redeem" value={redemptionInstructions} onChange={(e) => setRedemptionInstructions(e.target.value)} maxLength={400} data-testid="input-deal-redeem" />
        </div>

        <Button
          onClick={() => save.mutate()}
          disabled={!valid || save.isPending}
          className="w-full bg-[#0a4a82] hover:bg-[#0a4a82]/90"
          data-testid="button-save-deal"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (editing ? "Save changes" : "Publish deal")}
        </Button>
      </CardContent>
    </Card>
  );
}
