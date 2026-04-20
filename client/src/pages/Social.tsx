import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Share2,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Coins,
  Trash2,
  Save,
  AlertCircle,
} from "lucide-react";
import { SiFacebook, SiInstagram, SiGoogle, SiNextdoor } from "react-icons/si";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AICreditsInfo {
  balance: number;
  isFounder: boolean;
  eligible: boolean;
}
interface Variants {
  facebook?: string;
  instagram?: string;
  googleBusiness?: string;
  nextdoor?: string;
}
interface SocialDraft {
  id: number;
  sourceNotes: string;
  imageUrl: string | null;
  variants: Variants;
  status: "draft" | "posted";
  createdAt: string;
  updatedAt: string;
}

const COST = 5;

const PLATFORMS: Array<{
  key: keyof Variants;
  label: string;
  icon: any;
  color: string;
  limit: number;
  hint: string;
}> = [
  { key: "facebook", label: "Facebook", icon: SiFacebook, color: "#1877f2", limit: 600, hint: "Conversational, hashtags inline" },
  { key: "instagram", label: "Instagram", icon: SiInstagram, color: "#e4405f", limit: 2200, hint: "Hook + body + hashtag block" },
  { key: "googleBusiness", label: "Google Business Profile", icon: SiGoogle, color: "#4285f4", limit: 1500, hint: "Professional, with a CTA" },
  { key: "nextdoor", label: "Nextdoor", icon: SiNextdoor, color: "#00b246", limit: 2000, hint: "Neighborly, local-first" },
];

export default function SocialPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const businessId = user?.linkedBusinessId ?? null;
  const { toast: t } = useToast();

  const [tab, setTab] = useState<"compose" | "drafts">("compose");
  const [notes, setNotes] = useState("");
  const [tone, setTone] = useState<"friendly" | "professional" | "casual" | "exciting">("friendly");
  const [includeEmoji, setIncludeEmoji] = useState(true);
  const [variants, setVariants] = useState<Variants>({});
  const [draftId, setDraftId] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const credits = useQuery<AICreditsInfo>({
    queryKey: ["/api/businesses", businessId, "ai-credits"],
    enabled: !!businessId,
    retry: false,
    staleTime: 30_000,
  });
  const draftsQuery = useQuery<{ drafts: SocialDraft[] }>({
    queryKey: ["/api/businesses", businessId, "social/drafts"],
    enabled: !!businessId,
  });

  const isEligible = credits.data?.eligible === true;
  const balance = credits.data?.balance ?? 0;
  const isFounder = credits.data?.isFounder === true;
  const canAfford = isFounder || balance >= COST;

  const generate = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/social-composer", {
        businessId,
        notes: notes.trim(),
        tone,
        includeEmoji,
      });
      return (await res.json()) as { variants: Variants; balance: number };
    },
    onSuccess: (data) => {
      setVariants(data.variants);
      credits.refetch();
      toast({ title: "Posts generated", description: "Edit any of them, then copy & paste." });
    },
    onError: (err: any) => {
      toast({
        title: "AI generation failed",
        description: err?.message?.includes("Not enough credits")
          ? "You're out of AI credits this cycle. Top up in your dashboard."
          : err?.message?.includes("Gold")
            ? "Social Composer requires Gold."
            : err?.message || "Try again",
        variant: "destructive",
      });
    },
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (draftId) {
        const res = await apiRequest("PATCH", `/api/businesses/${businessId}/social/drafts/${draftId}`, {
          sourceNotes: notes,
          variants,
        });
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/businesses/${businessId}/social/drafts`, {
          sourceNotes: notes,
          variants,
        });
        return res.json();
      }
    },
    onSuccess: (data: any) => {
      const id = data?.draft?.id;
      if (id) setDraftId(id);
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId, "social/drafts"] });
      toast({ title: "Draft saved" });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err?.message, variant: "destructive" });
    },
  });

  const deleteDraft = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/businesses/${businessId}/social/drafts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId, "social/drafts"] });
      toast({ title: "Draft deleted" });
    },
  });

  const loadDraft = (d: SocialDraft) => {
    setDraftId(d.id);
    setNotes(d.sourceNotes);
    setVariants(d.variants || {});
    setTab("compose");
    toast({ title: "Draft loaded" });
  };
  const newDraft = () => {
    setDraftId(null);
    setNotes("");
    setVariants({});
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
      toast({ title: "Copied", description: "Now paste it into the platform." });
    } catch {
      toast({ title: "Copy failed", description: "Select the text and copy manually.", variant: "destructive" });
    }
  };

  const updateVariant = (key: keyof Variants, value: string) => {
    setVariants((prev) => ({ ...prev, [key]: value }));
  };

  if (authLoading) return <div className="container mx-auto p-8"><Skeleton className="h-64 w-full" /></div>;

  if (!isAuthenticated || !businessId) {
    return (
      <div className="container mx-auto p-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Social Composer</CardTitle>
            <CardDescription>For Gold business owners. One writeup → posts ready for every platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild data-testid="button-social-signin"><Link to="/auth">Sign in</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!credits.isLoading && !isEligible) {
    return (
      <div className="container mx-auto p-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" /> Social Composer</CardTitle>
            <CardDescription>This feature is part of Gold membership.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Upgrade to Gold to generate platform-tuned posts for Facebook, Instagram, Google Business Profile and Nextdoor — all from one writeup.
            </p>
            <Button asChild className="bg-amber-500 hover:bg-amber-600"><Link to="/membership">Upgrade to Gold</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const drafts = draftsQuery.data?.drafts ?? [];
  const hasVariants = Object.values(variants).some((v) => v && v.length > 0);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-[#0a4a82]">
            <Share2 className="h-7 w-7" /> Social Composer
          </h1>
          <p className="text-muted-foreground mt-1">
            One writeup → posts for Facebook, Instagram, Google Business Profile &amp; Nextdoor.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <Coins className="h-4 w-4 text-amber-500" />
          {isFounder ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-900">Founder — unlimited</Badge>
          ) : (
            <span data-testid="text-social-balance">Balance: <strong>{balance}</strong> credits</span>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "compose" | "drafts")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="compose" data-testid="tab-social-compose">Compose</TabsTrigger>
          <TabsTrigger value="drafts" data-testid="tab-social-drafts">Drafts ({drafts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
            {/* LEFT: input panel */}
            <Card className="lg:sticky lg:top-4 lg:self-start">
              <CardHeader>
                <CardTitle className="text-lg">What happened?</CardTitle>
                <CardDescription>Tell the AI in plain English. The more specific, the better.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="social-notes">Your notes</Label>
                  <Textarea
                    id="social-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Just finished a fence install on Caratoke Hwy — 200 ft of cedar with two gates. Customer was thrilled. Have great before/after photos. Booking April installs now."
                    rows={6}
                    maxLength={1500}
                    data-testid="input-social-notes"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{notes.length}/1500</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="social-tone">Tone</Label>
                    <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                      <SelectTrigger id="social-tone" data-testid="select-social-tone"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="exciting">Exciting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="social-emoji">Emoji</Label>
                    <Select value={includeEmoji ? "yes" : "no"} onValueChange={(v) => setIncludeEmoji(v === "yes")}>
                      <SelectTrigger id="social-emoji" data-testid="select-social-emoji"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Sparingly</SelectItem>
                        <SelectItem value="no">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!canAfford && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                    <span>You need <strong>{COST}</strong> credits and have <strong>{balance}</strong>. Top up in your dashboard.</span>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={() => generate.mutate()}
                  disabled={notes.trim().length < 5 || !canAfford || generate.isPending}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                  data-testid="button-generate-social"
                >
                  {generate.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating 4 posts...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Generate ({COST} credits)</>
                  )}
                </Button>

                {hasVariants && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={newDraft}
                      data-testid="button-social-new"
                    >
                      New
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => saveDraft.mutate()}
                      disabled={saveDraft.isPending}
                      data-testid="button-social-save"
                      className="flex-1"
                    >
                      {saveDraft.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                      {draftId ? "Update draft" : "Save draft"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* RIGHT: 4 platform cards */}
            <div className="space-y-4">
              {!hasVariants && !generate.isPending && (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Sparkles className="h-10 w-10 mx-auto mb-3 text-amber-600" />
                    <p>Your four posts will appear here once generated.</p>
                  </CardContent>
                </Card>
              )}
              {generate.isPending && (
                <Card><CardContent className="py-12 text-center">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-amber-500" />
                  <p className="mt-3 text-sm text-muted-foreground">Drafting four platform-tuned posts...</p>
                </CardContent></Card>
              )}
              {hasVariants && PLATFORMS.map(({ key, label, icon: Icon, color, limit, hint }) => {
                const text = variants[key] || "";
                const over = text.length > limit;
                return (
                  <Card key={key} data-testid={`card-platform-${key}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5" style={{ color }} />
                          <CardTitle className="text-base">{label}</CardTitle>
                          <span className="text-xs text-muted-foreground hidden sm:inline">— {hint}</span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => copyText(key, text)}
                          disabled={!text}
                          data-testid={`button-copy-${key}`}
                        >
                          {copiedKey === key ? (
                            <><Check className="h-4 w-4 mr-1" /> Copied</>
                          ) : (
                            <><Copy className="h-4 w-4 mr-1" /> Copy</>
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={text}
                        onChange={(e) => updateVariant(key, e.target.value)}
                        rows={key === "googleBusiness" ? 6 : 4}
                        className="font-sans text-sm"
                        data-testid={`textarea-${key}`}
                      />
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className={over ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {text.length}/{limit} chars{over && " — too long for this platform"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="drafts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Saved Drafts</CardTitle>
              <CardDescription>Pick up where you left off.</CardDescription>
            </CardHeader>
            <CardContent>
              {draftsQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No saved drafts yet.</p>
              ) : (
                <div className="space-y-2">
                  {drafts.map((d) => (
                    <div key={d.id} className="border rounded-lg p-3 flex items-start gap-3" data-testid={`row-draft-${d.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{d.sourceNotes}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Saved {new Date(d.updatedAt).toLocaleDateString()} ·
                          {" "}{Object.keys(d.variants || {}).filter((k) => (d.variants as any)[k]).length} platforms
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => loadDraft(d)} data-testid={`button-load-draft-${d.id}`}>Load</Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteDraft.mutate(d.id)}
                        disabled={deleteDraft.isPending}
                        data-testid={`button-delete-draft-${d.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
