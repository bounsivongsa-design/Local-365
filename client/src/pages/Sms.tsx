import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  Sparkles,
  Loader2,
  Send,
  Trash2,
  Plus,
  AlertCircle,
  Coins,
  Phone,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AICreditsInfo { balance: number; isFounder: boolean; eligible: boolean }
interface SmsSubscriber { id: number; phone: string; name: string | null; source: string; optedInAt: string | null; optedOutAt: string | null }
interface SmsCampaign { id: number; body: string; status: string; recipientCount: number; successCount: number; failureCount: number; creditsCharged: number; sentAt: string | null; createdAt: string | null }
interface PreviewResp { finalBody: string; segments: number; recipients: number; creditsPerRecipient: number; totalCredits: number; provider: string }

const AI_DRAFT_COST = 3;

export default function SmsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const businessId = user?.linkedBusinessId ?? null;

  const [tab, setTab] = useState<"compose" | "subscribers" | "history">("compose");
  const [body, setBody] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiWhat, setAiWhat] = useState("");
  const [aiCta, setAiCta] = useState("");
  const [aiTone, setAiTone] = useState<"friendly" | "urgent" | "informative">("friendly");
  const [showAddSub, setShowAddSub] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [consent, setConsent] = useState(false);

  const credits = useQuery<AICreditsInfo>({
    queryKey: ["/api/businesses", businessId, "ai-credits"],
    enabled: !!businessId,
    retry: false,
    staleTime: 30_000,
  });
  const subs = useQuery<{ subscribers: SmsSubscriber[]; total: number; active: number }>({
    queryKey: ["/api/businesses", businessId, "sms/subscribers"],
    enabled: !!businessId,
  });
  const campaigns = useQuery<{ campaigns: SmsCampaign[] }>({
    queryKey: ["/api/businesses", businessId, "sms/campaigns"],
    enabled: !!businessId,
  });

  const isEligible = credits.data?.eligible === true;
  const balance = credits.data?.balance ?? 0;
  const isFounder = credits.data?.isFounder === true;

  const preview = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/businesses/${businessId}/sms/preview`, { body });
      return (await res.json()) as PreviewResp;
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/businesses/${businessId}/sms/send`, { body });
      return (await res.json()) as { sent: number; failed: number; creditsCharged: number; provider: string; providerNote?: string };
    },
    onSuccess: (data) => {
      toast({
        title: `SMS blast complete: ${data.sent} sent, ${data.failed} failed`,
        description: data.providerNote ?? `Charged ${data.creditsCharged} credits.`,
      });
      setBody("");
      preview.reset();
      credits.refetch();
      campaigns.refetch();
      setTab("history");
    },
    onError: (err: any) => {
      toast({
        title: "Send failed",
        description: err?.message || "Try again",
        variant: "destructive",
      });
    },
  });

  const aiDraft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/sms-draft", {
        businessId,
        what: aiWhat.trim(),
        cta: aiCta.trim() || undefined,
        tone: aiTone,
      });
      return (await res.json()) as { variants: { concise: string; warm: string; with_cta: string } };
    },
    onSuccess: (data) => {
      credits.refetch();
      toast({ title: "3 SMS drafts ready", description: "Pick one below." });
      // store on local state via a small hack — show all 3 in the dialog
      (window as any).__smsAi = data.variants;
      setAiOpen(true);
    },
    onError: (err: any) => {
      toast({ title: "AI draft failed", description: err?.message, variant: "destructive" });
    },
  });

  const addSub = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/businesses/${businessId}/sms/subscribers`, {
        phone: newPhone.trim(),
        name: newName.trim() || undefined,
        consentAttested: true,
      });
      return res.json();
    },
    onSuccess: () => {
      setNewPhone(""); setNewName(""); setConsent(false); setShowAddSub(false);
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId, "sms/subscribers"] });
      toast({ title: "Subscriber added" });
    },
    onError: (err: any) => {
      toast({ title: "Could not add", description: err?.message, variant: "destructive" });
    },
  });

  const removeSub = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/businesses/${businessId}/sms/subscribers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId, "sms/subscribers"] });
      toast({ title: "Removed" });
    },
  });

  if (authLoading) return <div className="container mx-auto p-8"><Skeleton className="h-64 w-full" /></div>;

  if (!isAuthenticated || !businessId) {
    return (
      <div className="container mx-auto p-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>SMS Broadcast</CardTitle>
            <CardDescription>For Gold business owners.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild data-testid="button-sms-signin"><Link to="/auth">Sign in</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Only show the Gold paywall when we have a definitive answer that the
  // business is NOT eligible. If the credits API errored, is still loading,
  // or returned no data, fall through and let the page render — the server
  // will enforce Gold on any mutating action anyway.
  if (credits.data && credits.data.eligible === false) {
    return (
      <div className="container mx-auto p-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> SMS Broadcast</CardTitle>
            <CardDescription>This feature is part of Gold membership.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-amber-500 hover:bg-amber-600"><Link to="/membership">Upgrade to Gold</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subList = subs.data?.subscribers ?? [];
  const camps = campaigns.data?.campaigns ?? [];
  const activeCount = subs.data?.active ?? 0;
  const previewData = preview.data;
  const canAfford = isFounder || (previewData ? balance >= previewData.totalCredits : true);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-[#0a4a82]">
            <MessageSquare className="h-7 w-7" /> SMS Broadcast
          </h1>
          <p className="text-muted-foreground mt-1">Text your opted-in customers. 2 credits per SMS segment.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <Coins className="h-4 w-4 text-amber-500" />
          {isFounder ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-900">Founder — unlimited</Badge>
          ) : (
            <span data-testid="text-sms-balance">Balance: <strong>{balance}</strong> credits</span>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="compose" data-testid="tab-sms-compose">Compose</TabsTrigger>
          <TabsTrigger value="subscribers" data-testid="tab-sms-subscribers">Subscribers ({activeCount})</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-sms-history">History ({camps.length})</TabsTrigger>
        </TabsList>

        {/* COMPOSE */}
        <TabsContent value="compose" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Write your message</CardTitle>
              <CardDescription>
                Keep it under 140 chars to stay in 1 segment (we auto-append "Reply STOP to opt out").
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="sms-body">Message</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => { setAiOpen(true); }}
                    disabled={!isFounder && balance < AI_DRAFT_COST}
                    data-testid="button-sms-ai-open"
                    className="h-7"
                  >
                    <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
                    AI draft ({AI_DRAFT_COST}cr)
                  </Button>
                </div>
                <Textarea
                  id="sms-body"
                  value={body}
                  onChange={(e) => { setBody(e.target.value); preview.reset(); }}
                  placeholder="Hi! Smith Home Repair has 2 openings next Tuesday for fence repairs. Call us at 252-555-0100 to grab one."
                  rows={5}
                  maxLength={1000}
                  data-testid="input-sms-body"
                />
                <p className="text-xs text-muted-foreground mt-1">{body.length}/140 (1 segment) · {body.length}/1000 max</p>
              </div>

              {aiOpen && (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="pt-4 space-y-3">
                    {(window as any).__smsAi ? (
                      <>
                        <p className="text-sm font-medium">Pick a draft:</p>
                        {Object.entries((window as any).__smsAi as Record<string, string>).map(([key, text]) => (
                          <button
                            key={key}
                            type="button"
                            className="w-full text-left p-3 rounded-lg border bg-white hover:border-amber-400 transition"
                            onClick={() => { setBody(text); (window as any).__smsAi = null; setAiOpen(false); preview.reset(); }}
                            data-testid={`button-pick-ai-${key}`}
                          >
                            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{key.replace("_", " ")}</p>
                            <p className="text-sm">{text}</p>
                            <p className="text-xs text-muted-foreground mt-1">{text.length} chars</p>
                          </button>
                        ))}
                        <Button type="button" variant="ghost" size="sm" onClick={() => { (window as any).__smsAi = null; setAiOpen(false); }}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">Tell the AI what to write about:</p>
                        <Textarea
                          value={aiWhat}
                          onChange={(e) => setAiWhat(e.target.value)}
                          placeholder="2 openings next Tuesday for fence repairs"
                          rows={2}
                          maxLength={500}
                          data-testid="input-ai-what"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={aiCta}
                            onChange={(e) => setAiCta(e.target.value)}
                            placeholder="CTA (optional): Call us"
                            maxLength={80}
                            data-testid="input-ai-cta"
                          />
                          <Select value={aiTone} onValueChange={(v) => setAiTone(v as any)}>
                            <SelectTrigger data-testid="select-ai-tone"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="friendly">Friendly</SelectItem>
                              <SelectItem value="informative">Informative</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={() => aiDraft.mutate()}
                            disabled={aiWhat.trim().length < 5 || aiDraft.isPending}
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                            data-testid="button-generate-ai-sms"
                          >
                            {aiDraft.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Generating</> : <><Sparkles className="h-4 w-4 mr-1" />Generate ({AI_DRAFT_COST}cr)</>}
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setAiOpen(false)}>Cancel</Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => preview.mutate()}
                disabled={body.trim().length < 5 || preview.isPending}
                data-testid="button-sms-preview"
                className="w-full"
              >
                {preview.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Preview cost &amp; final message
              </Button>

              {previewData && (
                <Card className="border-[#0a4a82]/20 bg-[#0a4a82]/5">
                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Final message (with footer)</p>
                      <p className="text-sm whitespace-pre-wrap font-mono bg-white p-2 rounded border" data-testid="text-sms-final">
                        {previewData.finalBody}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center p-2 bg-white rounded border">
                        <p className="text-xs text-muted-foreground">Recipients</p>
                        <p className="font-bold text-lg" data-testid="text-sms-recipients">{previewData.recipients}</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded border">
                        <p className="text-xs text-muted-foreground">Segments each</p>
                        <p className="font-bold text-lg">{previewData.segments}</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded border">
                        <p className="text-xs text-muted-foreground">Total credits</p>
                        <p className="font-bold text-lg text-amber-600" data-testid="text-sms-cost">{previewData.totalCredits}</p>
                      </div>
                    </div>
                    {!canAfford && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                        <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                        <span>You need <strong>{previewData.totalCredits}</strong> credits and have <strong>{balance}</strong>.</span>
                      </div>
                    )}
                    {previewData.recipients === 0 && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                        <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                        <span>No opted-in subscribers. Add some in the Subscribers tab first.</span>
                      </div>
                    )}
                    {previewData.provider === "stub" && (
                      <div className="flex items-start gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3 text-xs">
                        <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                        <span><strong>Stub mode:</strong> messages are logged to the server console, not actually delivered. Wire up Twilio (and complete US 10DLC carrier registration) to enable real SMS.</span>
                      </div>
                    )}
                    <Button
                      type="button"
                      onClick={() => send.mutate()}
                      disabled={send.isPending || !canAfford || previewData.recipients === 0}
                      className="w-full bg-[#0a4a82] hover:bg-[#0a4a82]/90"
                      data-testid="button-sms-send"
                    >
                      {send.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Sending...</> : <><Send className="h-4 w-4 mr-1" />Send to {previewData.recipients} subscriber{previewData.recipients === 1 ? "" : "s"}</>}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUBSCRIBERS */}
        <TabsContent value="subscribers" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>SMS Subscribers</CardTitle>
                <CardDescription>{activeCount} opted-in · {(subs.data?.total ?? 0) - activeCount} unsubscribed</CardDescription>
              </div>
              <Button onClick={() => setShowAddSub((s) => !s)} data-testid="button-add-sub">
                <Plus className="h-4 w-4 mr-1" />Add subscriber
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {showAddSub && (
                <Card className="border-[#0a4a82]/30 bg-[#0a4a82]/5">
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="new-phone">Phone (US, 10 digits)</Label>
                        <Input id="new-phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="252-555-0100" data-testid="input-new-phone" />
                      </div>
                      <div>
                        <Label htmlFor="new-name">Name (optional)</Label>
                        <Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Jane Doe" data-testid="input-new-name" />
                      </div>
                    </div>
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} data-testid="checkbox-consent" />
                      <span>
                        <ShieldCheck className="h-4 w-4 inline mr-1 text-green-600" />
                        I confirm this person gave me explicit permission to text them. (Required by law — TCPA)
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <Button onClick={() => addSub.mutate()} disabled={!consent || newPhone.trim().length < 7 || addSub.isPending} data-testid="button-save-sub">
                        {addSub.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                      </Button>
                      <Button variant="ghost" onClick={() => setShowAddSub(false)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {subs.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : subList.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No subscribers yet. Add some above.</p>
              ) : (
                <div className="space-y-1">
                  {subList.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 border rounded-lg" data-testid={`row-sub-${s.id}`}>
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm">{s.phone} {s.name && <span className="text-muted-foreground">· {s.name}</span>}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.optedOutAt ? <Badge variant="destructive">Opted out</Badge> : <Badge variant="secondary" className="bg-green-100 text-green-900">Active</Badge>}
                          {" "}· source: {s.source}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => removeSub.mutate(s.id)} data-testid={`button-remove-sub-${s.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Past Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              {campaigns.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : camps.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No campaigns sent yet.</p>
              ) : (
                <div className="space-y-2">
                  {camps.map((c) => (
                    <div key={c.id} className="border rounded-lg p-3" data-testid={`row-campaign-${c.id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {c.status === "sent" && c.failureCount === 0 && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {c.failureCount > 0 && <XCircle className="h-4 w-4 text-amber-600" />}
                          <Badge variant={c.status === "sent" ? "secondary" : "outline"}>{c.status}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {c.sentAt ? new Date(c.sentAt).toLocaleString() : new Date(c.createdAt!).toLocaleString()}
                          </span>
                        </div>
                        <span className="text-sm">
                          <strong className="text-green-700">{c.successCount}</strong> sent
                          {c.failureCount > 0 && <span className="text-amber-700"> · {c.failureCount} failed</span>}
                          <span className="text-muted-foreground"> · {c.creditsCharged}cr</span>
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap bg-muted/40 p-2 rounded border font-mono text-xs">{c.body}</p>
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
