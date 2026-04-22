import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Star,
  Mail,
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  Coins,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  ShieldAlert,
  BellOff,
  BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EligibleCustomer {
  key: string;
  userId: string | null;
  email: string | null;
  phone: string | null;
  name: string | null;
  source: "quote_request" | "review";
  lastInteractionAt: string | null;
  askedRecently: boolean;
  lastAskedAt: string | null;
  suppressed: boolean;
  suppressionReason: string | null;
}

interface RecentBouncesResponse {
  bounces: RecentBounce[];
  total: number;
  last7Days: number;
  last30Days: number;
  hasMore?: boolean;
}

interface RecentBounce {
  id: number;
  contactType: string;
  contact: string;
  reason: string;
  createdAt: string | null;
}

interface BounceSpikeAlertRow {
  id: number;
  alertedAt: string | null;
  bounceCount: number;
}

interface BounceSpikeAlertsResponse {
  alerts: BounceSpikeAlertRow[];
  sinceDays: number;
}

interface ReviewRequestRow {
  id: number;
  recipientEmail: string | null;
  recipientPhone: string | null;
  recipientName: string | null;
  channel: string;
  status: string;
  sentAt: string | null;
  clickedAt: string | null;
  errorMsg: string | null;
  completedReviewId: number | null;
  createdAt: string;
}

type FailureCategory = "no_transport" | "rejected" | "permanent" | "sms" | "sms_permanent" | "other";

function classifyError(msg: string | null): { category: FailureCategory; label: string; hint: string } {
  if (!msg) {
    return { category: "other", label: "Failed", hint: "No additional detail was captured." };
  }
  const lower = msg.toLowerCase();
  if (lower.includes("not configured") || lower.includes("no transport")) {
    return {
      category: "no_transport",
      label: "Email service not configured",
      hint: "The Resend API key is missing on the server. Nothing was actually sent — contact support to enable email.",
    };
  }
  if (lower.startsWith("email[suppressed]") || lower.startsWith("email[permanent]")) {
    return {
      category: "permanent",
      label: "Permanently undeliverable — fix the address",
      hint: "Resend has marked this email address as permanently unsendable (hard bounce or on its suppression list). Retrying will fail. Update the customer's email, then clear the suppression to send again.",
    };
  }
  if (lower.startsWith("sms[suppressed]") || lower.startsWith("sms[permanent]")) {
    return {
      category: "sms_permanent",
      label: "Permanently undeliverable — fix the number",
      hint: "This phone number was flagged unsendable. Update the number and clear the suppression before retrying.",
    };
  }
  if (lower.startsWith("sms:")) {
    return {
      category: "sms",
      label: "Carrier rejected the text",
      hint: "Double-check the phone number, or have the recipient text START to your number to opt back in.",
    };
  }
  if (lower.startsWith("email:")) {
    return {
      category: "rejected",
      label: "Email provider rejected this address",
      hint: "Usually a typo or a temporary Resend outage. Fix the address (or wait, then retry).",
    };
  }
  return { category: "other", label: "Failed", hint: msg };
}

function isPermanentCategory(c: FailureCategory): boolean {
  return c === "permanent" || c === "sms_permanent";
}

interface BounceAlertPrefs {
  threshold: number | null;
  cadenceHours: number | null;
  muted: boolean;
  defaults: { threshold: number; cadenceHours: number; lookbackHours: number };
}

interface AICreditsInfo {
  balance: number;
  isFounder: boolean;
  eligible: boolean;
}

const AI_COST = 3;

export default function ReviewRequestsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const businessId = user?.linkedBusinessId ?? null;
  const [tab, setTab] = useState<"pick" | "compose" | "history">("pick");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<"email" | "sms" | "both">("email");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smsBody, setSmsBody] = useState("");
  const [aiNotes, setAiNotes] = useState("");
  const [aiTone, setAiTone] = useState<"friendly" | "professional" | "grateful">("friendly");

  const eligibleQuery = useQuery<{ customers: EligibleCustomer[]; total: number; cooldownDays: number }>({
    queryKey: ["/api/businesses", businessId, "review-requests/eligible"],
    enabled: !!businessId,
  });
  const historyQuery = useQuery<{ requests: ReviewRequestRow[]; summary: any }>({
    queryKey: ["/api/businesses", businessId, "review-requests"],
    enabled: !!businessId,
  });
  const recentBouncesQuery = useQuery<RecentBouncesResponse>({
    queryKey: ["/api/businesses", businessId, "review-requests/recent-bounces"],
    enabled: !!businessId,
  });
  const bounceAlertPrefsQuery = useQuery<BounceAlertPrefs>({
    queryKey: ["/api/businesses", businessId, "review-requests/bounce-alert-prefs"],
    enabled: !!businessId,
  });
  const bounceAlertsQuery = useQuery<BounceSpikeAlertsResponse>({
    queryKey: ["/api/businesses", businessId, "bounce-spike-alerts"],
    enabled: !!businessId,
  });
  const credits = useQuery<AICreditsInfo>({
    queryKey: ["/api/businesses", businessId, "ai-credits"],
    enabled: !!businessId,
    staleTime: 30_000,
  });

  const isEligible = credits.data?.eligible === true;
  const isFounder = credits.data?.isFounder === true;
  const balance = credits.data?.balance ?? 0;
  const cooldownDays = eligibleQuery.data?.cooldownDays ?? 90;

  const customers = useMemo(() => {
    const all = eligibleQuery.data?.customers ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(
      (c) =>
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q),
    );
  }, [eligibleQuery.data, search]);

  const eligibleSelected = useMemo(() => {
    const all = eligibleQuery.data?.customers ?? [];
    const map = new Map(all.map((c) => [c.key, c]));
    return Array.from(selected)
      .map((k) => map.get(k))
      .filter((c): c is EligibleCustomer => !!c && !c.askedRecently && !c.suppressed);
  }, [selected, eligibleQuery.data]);

  const failedRows = useMemo(
    () => (historyQuery.data?.requests ?? []).filter((r) => r.status === "failed"),
    [historyQuery.data],
  );

  const retryableKeys = useMemo(() => {
    const all = eligibleQuery.data?.customers ?? [];
    const byEmail = new Map<string, EligibleCustomer>();
    const byPhone = new Map<string, EligibleCustomer>();
    for (const c of all) {
      if (c.email) byEmail.set(c.email.toLowerCase(), c);
      if (c.phone) byPhone.set(c.phone, c);
    }
    const keys = new Set<string>();
    for (const r of failedRows) {
      // Skip permanently undeliverable rows — re-blasting them would
      // just burn another Resend call and ding our sender reputation.
      const cls = classifyError(r.errorMsg);
      if (isPermanentCategory(cls.category)) continue;
      const email = r.recipientEmail?.toLowerCase() ?? null;
      const phone = r.recipientPhone ?? null;
      const match = (email && byEmail.get(email)) || (phone && byPhone.get(phone)) || null;
      if (match && !match.askedRecently && !match.suppressed) keys.add(match.key);
    }
    return keys;
  }, [failedRows, eligibleQuery.data]);

  // Local edit buffer so threshold/cadence inputs stay editable while
  // the user is mid-type (instead of being stomped by the query payload
  // on every cache update). Synced from the query in `useEffect`-ish
  // fashion via `useMemo` keyed by the response identity.
  const [prefsDraft, setPrefsDraft] = useState<{
    threshold: string;
    cadenceHours: string;
  }>({ threshold: "", cadenceHours: "" });
  // Re-hydrate the draft whenever the server payload changes (initial
  // load, after a successful save, or on background refetch). Empty
  // string in the input means "use the default" which serializes to
  // null on save.
  useEffect(() => {
    const data = bounceAlertPrefsQuery.data;
    if (!data) return;
    setPrefsDraft({
      threshold: data.threshold == null ? "" : String(data.threshold),
      cadenceHours: data.cadenceHours == null ? "" : String(data.cadenceHours),
    });
  }, [bounceAlertPrefsQuery.data]);

  const saveBounceAlertPrefs = useMutation({
    mutationFn: async (vars: {
      threshold?: number | null;
      cadenceHours?: number | null;
      muted?: boolean;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/businesses/${businessId}/review-requests/bounce-alert-prefs`,
        vars,
      );
      return (await res.json()) as BounceAlertPrefs;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["/api/businesses", businessId, "review-requests/bounce-alert-prefs"],
        data,
      );
      toast({
        title: "Bounce alert preferences saved",
        description: data.muted
          ? "Email heads-ups are muted. You'll still see the panel here."
          : `We'll email you when this listing logs ${data.threshold ?? data.defaults.threshold}+ bounces in ${data.defaults.lookbackHours}h, no more often than every ${data.cadenceHours ?? data.defaults.cadenceHours}h.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't save preferences",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendTestBounceAlert = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/businesses/${businessId}/review-requests/bounce-alert-prefs/test`,
      );
      return (await res.json()) as {
        ok: boolean;
        recipientEmail: string;
        bounceCount: number;
        windowHours: number;
      };
    },
    onSuccess: (data) => {
      toast({
        title: "Test alert sent",
        description: `Sent to ${data.recipientEmail}. Check your inbox (and spam folder) for the heads-up email.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't send test alert",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const clearAllWebhookBounces = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/businesses/${businessId}/review-requests/suppressions/clear-webhook-bounces`,
      );
      return (await res.json()) as { ok: boolean; cleared: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId, "review-requests/eligible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId, "review-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId, "review-requests/recent-bounces"] });
      toast({
        title: data.cleared > 0 ? `Cleared ${data.cleared} bounce${data.cleared === 1 ? "" : "s"}` : "Nothing to clear",
        description:
          data.cleared > 0
            ? "Those addresses can be retried now. Make sure you've fixed the underlying issue first."
            : "There were no webhook-recorded bounces to clear.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't clear bounces",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const clearSuppression = useMutation({
    mutationFn: async (vars: { contactType: "email" | "phone"; contact: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/businesses/${businessId}/review-requests/suppressions/clear`,
        vars,
      );
      return (await res.json()) as { ok: boolean; cleared: number };
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId, "review-requests/eligible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId, "review-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId, "review-requests/recent-bounces"] });
      toast({
        title: data.cleared > 0 ? "Suppression cleared" : "Nothing to clear",
        description:
          data.cleared > 0
            ? `${vars.contact} can be retried now.`
            : `${vars.contact} was not on the suppression list.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't clear suppression",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const retryFailed = () => {
    if (retryableKeys.size === 0) {
      toast({
        title: "Nothing to retry",
        description:
          failedRows.length === 0
            ? "There are no failed sends in your history."
            : "Failed recipients are no longer in your eligible list (or are within the 90-day cooldown).",
      });
      return;
    }
    setSelected(new Set(retryableKeys));
    setTab("compose");
    toast({
      title: `Retrying ${retryableKeys.size} failed recipient${retryableKeys.size === 1 ? "" : "s"}`,
      description: "Review or tweak your message, then send.",
    });
  };

  const aiDraft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/review-request-draft", {
        businessId,
        ownerNotes: aiNotes.trim() || undefined,
        tone: aiTone,
        channel,
      });
      return (await res.json()) as { emailSubject: string; emailBody: string; smsBody: string };
    },
    onSuccess: (data) => {
      setEmailSubject(data.emailSubject);
      setEmailBody(data.emailBody);
      setSmsBody(data.smsBody);
      credits.refetch();
      toast({ title: "Draft loaded", description: "Edit anything you'd like before sending." });
    },
    onError: (err: any) => {
      const msg = err?.message || "AI generation failed";
      toast({
        title: "AI assist unavailable",
        description: msg.includes("Not enough credits")
          ? "You're out of AI credits. Top up in your dashboard."
          : msg.includes("Gold")
            ? "AI features require Gold."
            : msg,
        variant: "destructive",
      });
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/businesses/${businessId}/review-requests/send`, {
        customerKeys: eligibleSelected.map((c) => c.key),
        channel,
        emailSubject: channel !== "sms" ? emailSubject : undefined,
        emailBody: channel !== "sms" ? emailBody : undefined,
        smsBody: channel !== "email" ? smsBody : undefined,
      });
      return (await res.json()) as {
        success: number;
        failure: number;
        cooldownExcluded: number;
        suppressed: number;
        failures?: Array<{
          key: string;
          name: string | null;
          contact: string | null;
          channel: string;
          errorMsg: string;
        }>;
      };
    },
    onSuccess: (data) => {
      const failures = data.failures ?? [];
      const previewLines = failures
        .slice(0, 3)
        .map((f) => `• ${f.name || f.contact || f.key}: ${f.errorMsg}`);
      const more = failures.length > 3 ? `\n…and ${failures.length - 3} more (see History tab)` : "";
      const extraParts: string[] = [];
      if (data.cooldownExcluded > 0) extraParts.push(`${data.cooldownExcluded} skipped for cooldown`);
      if (data.suppressed > 0)
        extraParts.push(
          `${data.suppressed} skipped — permanently undeliverable`,
        );
      const extraLine = extraParts.length ? extraParts.join(" · ") + "." : "";
      toast({
        title: `Sent ${data.success} review request${data.success === 1 ? "" : "s"}`,
        description:
          data.failure > 0
            ? `${data.failure} failed${extraLine ? " · " + extraLine : ""}\n${previewLines.join("\n")}${more}`
            : extraLine || "All recipients reached.",
        variant: data.failure > 0 ? "destructive" : "default",
        duration: data.failure > 0 ? 10000 : 5000,
      });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId, "review-requests/eligible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId, "review-requests"] });
      setTab("history");
    },
    onError: (err: any) => {
      toast({ title: "Send failed", description: err?.message || "Try again", variant: "destructive" });
    },
  });

  if (!user) {
    return <div className="p-8 text-center">Please sign in.</div>;
  }
  if (!businessId) {
    return <div className="p-8 text-center">No business linked to this account.</div>;
  }

  const canCompose =
    eligibleSelected.length > 0 &&
    ((channel !== "sms" && emailSubject.trim().length >= 2 && emailBody.trim().length >= 10) ||
      (channel === "sms" && smsBody.trim().length >= 10) ||
      (channel === "both" && emailSubject.trim().length >= 2 && emailBody.trim().length >= 10 && smsBody.trim().length >= 10));

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
     <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-[#0a4a82]">
            <Star className="h-7 w-7" /> Review Request Blasts
          </h1>
          <p className="text-muted-foreground mt-1">
            Ask past customers for a review by email or text. {cooldownDays}-day per-customer cooldown.
          </p>
        </div>
        {isEligible && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <Coins className="h-4 w-4 text-amber-500" />
            {isFounder ? (
              <Badge variant="secondary" className="bg-amber-100 text-amber-900">Founder — unlimited</Badge>
            ) : (
              <span data-testid="text-rr-balance">Balance: <strong>{balance}</strong> credits</span>
            )}
          </div>
        )}
      </div>

      {(recentBouncesQuery.data?.bounces.length ?? 0) > 0 && (
        <Card className="border-red-200 bg-red-50/30" data-testid="card-rr-recent-bounces">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2 text-red-900">
                  <ShieldAlert className="h-4 w-4" /> Recently auto-suppressed
                </CardTitle>
                <CardDescription className="text-red-800/80">
                  These addresses were flagged by the email provider as permanently undeliverable
                  (hard bounce or spam complaint) after a recent send. We've stopped sending to
                  them. Fix the address with the customer, then clear the entry to retry.
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <Badge
                    variant="outline"
                    className="border-red-300 text-red-800"
                    data-testid="badge-bounces-total"
                  >
                    {recentBouncesQuery.data!.total} total
                    {recentBouncesQuery.data!.hasMore
                      ? ` (showing ${recentBouncesQuery.data!.bounces.length})`
                      : ""}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-red-300 text-red-800"
                    data-testid="badge-bounces-7d"
                  >
                    {recentBouncesQuery.data!.last7Days} in last 7d
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-red-300 text-red-800"
                    data-testid="badge-bounces-30d"
                  >
                    {recentBouncesQuery.data!.last30Days} in last 30d
                  </Badge>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-red-300 text-red-800 hover:bg-red-100"
                      disabled={
                        clearAllWebhookBounces.isPending ||
                        recentBouncesQuery.data!.total === 0
                      }
                      data-testid="button-clear-all-bounces"
                    >
                      {clearAllWebhookBounces.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : null}
                      Clear all webhook bounces
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent data-testid="dialog-confirm-clear-all-bounces">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear all webhook bounces?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes all {recentBouncesQuery.data!.total} auto-suppressions
                        recorded from email provider bounces and spam complaints for this
                        business. Manual opt-outs are not affected. If the underlying address
                        problems aren't fixed, those addresses will likely be re-suppressed on
                        the next send and may hurt your sender reputation.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-clear-all-bounces">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => clearAllWebhookBounces.mutate()}
                        data-testid="button-confirm-clear-all-bounces"
                      >
                        Clear all
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="border border-red-200 rounded-lg divide-y divide-red-100 bg-white max-h-[280px] overflow-y-auto">
              {recentBouncesQuery.data!.bounces.map((b) => (
                <div
                  key={b.id}
                  className="p-3 flex items-start gap-3"
                  data-testid={`row-rr-bounce-${b.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate" data-testid={`text-bounce-contact-${b.id}`}>
                      {b.contact}
                    </div>
                    <div className="text-xs text-red-700 mt-0.5 break-words" data-testid={`text-bounce-reason-${b.id}`}>
                      {b.reason.replace(/^webhook:\s*/, "")}
                    </div>
                    {b.createdAt && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(b.createdAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">{b.contactType}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-red-300 text-red-800 hover:bg-red-100"
                    disabled={clearSuppression.isPending}
                    onClick={() =>
                      clearSuppression.mutate({
                        contactType: b.contactType === "phone" ? "phone" : "email",
                        contact: b.contact,
                      })
                    }
                    data-testid={`button-clear-bounce-${b.id}`}
                  >
                    {clearSuppression.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                    Clear
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {bounceAlertPrefsQuery.data && (() => {
        const prefs = bounceAlertPrefsQuery.data;
        const effectiveThreshold = prefs.threshold ?? prefs.defaults.threshold;
        const effectiveCadence = prefs.cadenceHours ?? prefs.defaults.cadenceHours;
        const parsedThreshold = prefsDraft.threshold === "" ? null : Number(prefsDraft.threshold);
        const parsedCadence = prefsDraft.cadenceHours === "" ? null : Number(prefsDraft.cadenceHours);
        const thresholdValid =
          parsedThreshold === null ||
          (Number.isInteger(parsedThreshold) && parsedThreshold >= 1 && parsedThreshold <= 10000);
        const cadenceValid =
          parsedCadence === null ||
          (Number.isInteger(parsedCadence) && parsedCadence >= 1 && parsedCadence <= 720);
        const hasChanges =
          (prefs.threshold ?? null) !== parsedThreshold ||
          (prefs.cadenceHours ?? null) !== parsedCadence;
        return (
          <Card data-testid="card-bounce-alert-prefs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BellOff className="h-4 w-4" /> Bounce alerts
              </CardTitle>
              <CardDescription>
                When this listing logs <strong>{effectiveThreshold}+</strong> webhook bounces in the last
                {" "}
                {prefs.defaults.lookbackHours}h, we email you a heads-up. We won't ping you again for
                {" "}
                <strong>{effectiveCadence}h</strong>. Tune these for your volume — high-volume
                businesses usually want a higher floor and a slower cadence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label
                className="flex items-start gap-3 cursor-pointer"
                data-testid="row-bounce-alert-mute"
              >
                <Checkbox
                  checked={prefs.muted}
                  disabled={saveBounceAlertPrefs.isPending}
                  onCheckedChange={(checked) =>
                    saveBounceAlertPrefs.mutate({ muted: checked === true })
                  }
                  data-testid="checkbox-bounce-alert-mute"
                />
                <div className="text-sm">
                  <div className="font-medium">Mute the email heads-up</div>
                  <div className="text-muted-foreground">
                    The "Recently auto-suppressed" panel above still shows everything — you just
                    won't get an email about it.
                  </div>
                </div>
              </label>

              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${prefs.muted ? "opacity-60" : ""}`}>
                <div className="space-y-1">
                  <Label htmlFor="input-bounce-alert-threshold">Bounce threshold</Label>
                  <Input
                    id="input-bounce-alert-threshold"
                    type="number"
                    min={1}
                    max={10000}
                    inputMode="numeric"
                    placeholder={`Default: ${prefs.defaults.threshold}`}
                    value={prefsDraft.threshold}
                    disabled={prefs.muted || saveBounceAlertPrefs.isPending}
                    onChange={(e) =>
                      setPrefsDraft((d) => ({ ...d, threshold: e.target.value.replace(/[^0-9]/g, "") }))
                    }
                    data-testid="input-bounce-alert-threshold"
                  />
                  <div className="text-xs text-muted-foreground">
                    Bounces per {prefs.defaults.lookbackHours}h before we ping you. Leave blank to use
                    the default ({prefs.defaults.threshold}).
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="input-bounce-alert-cadence">Cadence (hours between emails)</Label>
                  <Input
                    id="input-bounce-alert-cadence"
                    type="number"
                    min={1}
                    max={720}
                    inputMode="numeric"
                    placeholder={`Default: ${prefs.defaults.cadenceHours}`}
                    value={prefsDraft.cadenceHours}
                    disabled={prefs.muted || saveBounceAlertPrefs.isPending}
                    onChange={(e) =>
                      setPrefsDraft((d) => ({ ...d, cadenceHours: e.target.value.replace(/[^0-9]/g, "") }))
                    }
                    data-testid="input-bounce-alert-cadence"
                  />
                  <div className="text-xs text-muted-foreground">
                    Common picks: 24 (daily), 168 (weekly digest). Range 1–720.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={sendTestBounceAlert.isPending}
                  onClick={() => sendTestBounceAlert.mutate()}
                  data-testid="button-bounce-alert-test"
                >
                  {sendTestBounceAlert.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3 mr-1" />
                  )}
                  Send test alert
                </Button>
                <div className="flex items-center gap-2 ml-auto">
                {hasChanges && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={saveBounceAlertPrefs.isPending}
                    onClick={() =>
                      setPrefsDraft({
                        threshold: prefs.threshold == null ? "" : String(prefs.threshold),
                        cadenceHours: prefs.cadenceHours == null ? "" : String(prefs.cadenceHours),
                      })
                    }
                    data-testid="button-bounce-alert-reset"
                  >
                    Discard changes
                  </Button>
                )}
                <Button
                  size="sm"
                  type="button"
                  disabled={
                    prefs.muted ||
                    saveBounceAlertPrefs.isPending ||
                    !thresholdValid ||
                    !cadenceValid ||
                    !hasChanges
                  }
                  onClick={() =>
                    saveBounceAlertPrefs.mutate({
                      threshold: parsedThreshold,
                      cadenceHours: parsedCadence,
                    })
                  }
                  data-testid="button-bounce-alert-save"
                >
                  {saveBounceAlertPrefs.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : null}
                  Save preferences
                </Button>
                </div>
              </div>
              {(!thresholdValid || !cadenceValid) && (
                <p className="text-xs text-destructive" data-testid="text-bounce-alert-error">
                  Threshold must be 1–10000 and cadence must be 1–720 hours.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {businessId && (() => {
        const alerts = bounceAlertsQuery.data?.alerts ?? [];
        const sinceDays = bounceAlertsQuery.data?.sinceDays ?? 30;
        return (
          <Card className="border-amber-200 bg-amber-50/30" data-testid="card-rr-bounce-alerts">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                    <BellRing className="h-4 w-4" /> Bounce-alert emails we sent you
                  </CardTitle>
                  <CardDescription className="text-amber-800/80">
                    When a cluster of bounces shows up on your account we email you a heads-up
                    so you can clean your contact list. Last {sinceDays} days.
                  </CardDescription>
                </div>
                {!bounceAlertsQuery.isLoading && !bounceAlertsQuery.isError && (
                  <Badge
                    variant="outline"
                    className="border-amber-300 text-amber-800"
                    data-testid="badge-bounce-alerts-count"
                  >
                    {alerts.length} alert{alerts.length === 1 ? "" : "s"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {bounceAlertsQuery.isLoading ? (
                <Skeleton className="h-12 w-full rounded-lg" data-testid="loading-rr-bounce-alerts" />
              ) : bounceAlertsQuery.isError ? (
                <p className="text-xs text-red-700" data-testid="error-rr-bounce-alerts">
                  Couldn't load bounce-alert history. Please refresh.
                </p>
              ) : alerts.length === 0 ? (
                <p
                  className="text-sm text-amber-800/80"
                  data-testid="empty-rr-bounce-alerts"
                >
                  No bounce-alert emails sent in the last {sinceDays} days — you're not being over-emailed.
                </p>
              ) : (
                <ul
                  className="border border-amber-200 rounded-lg divide-y divide-amber-100 bg-white max-h-[220px] overflow-y-auto"
                  data-testid="list-rr-bounce-alerts"
                >
                  {alerts.map((a) => (
                    <li
                      key={a.id}
                      className="p-3 flex items-center justify-between gap-3"
                      data-testid={`row-rr-bounce-alert-${a.id}`}
                    >
                      <div className="text-sm" data-testid={`text-bounce-alert-date-${a.id}`}>
                        {a.alertedAt
                          ? new Date(a.alertedAt).toLocaleString()
                          : "—"}
                      </div>
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-amber-800"
                        data-testid={`text-bounce-alert-count-${a.id}`}
                      >
                        {a.bounceCount} bounce{a.bounceCount === 1 ? "" : "s"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="pick" data-testid="tab-rr-pick">
            Customers ({customers.length})
          </TabsTrigger>
          <TabsTrigger value="compose" data-testid="tab-rr-compose">
            Compose ({eligibleSelected.length})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-rr-history">
            History ({historyQuery.data?.requests.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* PICK */}
        <TabsContent value="pick" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pick customers to ask</CardTitle>
              <CardDescription>
                Built from past quote requesters and reviewers. Customers asked in the last {cooldownDays} days are locked out.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or phone"
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    data-testid="input-rr-search"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const keys = customers
                      .filter((c) => !c.askedRecently && !c.suppressed)
                      .map((c) => c.key);
                    setSelected(new Set(keys));
                  }}
                  data-testid="button-rr-select-all"
                >
                  Select all ({customers.filter((c) => !c.askedRecently && !c.suppressed).length})
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set())} data-testid="button-rr-clear">
                  Clear
                </Button>
              </div>

              {eligibleQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Star className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No past customers yet.</p>
                  <p className="text-sm mt-1">As people request quotes from you, they'll appear here.</p>
                </div>
              ) : (
                <div className="border rounded-lg divide-y max-h-[480px] overflow-y-auto">
                  {customers.map((c) => {
                    const checked = selected.has(c.key) && !c.suppressed;
                    const disabled = c.askedRecently || c.suppressed;
                    return (
                      <label
                        key={c.key}
                        className={`flex items-center gap-3 p-3 ${disabled ? "opacity-60 cursor-not-allowed bg-muted/30" : "cursor-pointer hover:bg-muted/30"}`}
                        data-testid={`row-rr-customer-${c.key}`}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(v) => {
                            const next = new Set(selected);
                            if (v && !c.suppressed) next.add(c.key);
                            else next.delete(c.key);
                            setSelected(next);
                          }}
                          data-testid={`check-rr-${c.key}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{c.name || c.email || c.phone}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {c.email && <span>{c.email}</span>}
                            {c.email && c.phone && <span> · </span>}
                            {c.phone && <span>{c.phone}</span>}
                          </div>
                          {c.suppressed && c.suppressionReason && (
                            <div
                              className="text-xs text-red-700 mt-1 truncate"
                              title={c.suppressionReason}
                              data-testid={`text-rr-suppression-reason-${c.key}`}
                            >
                              {c.suppressionReason}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="text-xs">
                            {c.source === "quote_request" ? "Quoted" : "Reviewer"}
                          </Badge>
                          {c.suppressed ? (
                            <span
                              className="text-xs text-red-700 flex items-center gap-1"
                              data-testid={`badge-rr-suppressed-${c.key}`}
                            >
                              <ShieldAlert className="h-3 w-3" /> Permanently undeliverable
                            </span>
                          ) : c.askedRecently ? (
                            <span className="text-xs text-amber-700 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Asked recently
                            </span>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => setTab("compose")}
                  disabled={eligibleSelected.length === 0}
                  className="bg-[#0a4a82] hover:bg-[#0a4a82]/90"
                  data-testid="button-rr-continue"
                >
                  Continue with {eligibleSelected.length} selected
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMPOSE */}
        <TabsContent value="compose" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Compose your ask</CardTitle>
              <CardDescription>
                {eligibleSelected.length} eligible recipient{eligibleSelected.length === 1 ? "" : "s"} ready.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Channel</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                  <SelectTrigger className="max-w-xs" data-testid="select-rr-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email"><Mail className="h-4 w-4 inline mr-2" />Email only</SelectItem>
                    <SelectItem value="sms"><MessageSquare className="h-4 w-4 inline mr-2" />SMS only</SelectItem>
                    <SelectItem value="both">Both (email + SMS where available)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isEligible && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 font-medium text-amber-900">
                    <Sparkles className="h-4 w-4" /> AI Drafter <Badge variant="outline" className="text-xs">{AI_COST} credits</Badge>
                  </div>
                  <Textarea
                    placeholder="Optional: anything specific to mention? (e.g. 'we just finished their roof and they were thrilled')"
                    value={aiNotes}
                    onChange={(e) => setAiNotes(e.target.value)}
                    rows={2}
                    data-testid="input-rr-ai-notes"
                  />
                  <div className="flex items-center gap-2">
                    <Select value={aiTone} onValueChange={(v) => setAiTone(v as any)}>
                      <SelectTrigger className="w-40" data-testid="select-rr-ai-tone"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="grateful">Grateful</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      onClick={() => aiDraft.mutate()}
                      disabled={aiDraft.isPending || (!isFounder && balance < AI_COST)}
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                      data-testid="button-rr-ai-draft"
                    >
                      {aiDraft.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Generate Draft
                    </Button>
                    {!isFounder && balance < AI_COST && (
                      <span className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Need {AI_COST}, have {balance}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {(channel === "email" || channel === "both") && (
                <div className="space-y-2">
                  <Label htmlFor="rr-subject">Email subject</Label>
                  <Input
                    id="rr-subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Quick favor — would you leave a review?"
                    data-testid="input-rr-subject"
                  />
                  <Label htmlFor="rr-body">Email body</Label>
                  <Textarea
                    id="rr-body"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Thanks again for trusting us with your project..."
                    rows={6}
                    data-testid="input-rr-body"
                  />
                  <p className="text-xs text-muted-foreground">
                    A "Leave a Review" button (with click tracking) and your business address are added automatically.
                  </p>
                </div>
              )}

              {(channel === "sms" || channel === "both") && (
                <div className="space-y-2">
                  <Label htmlFor="rr-sms">SMS message</Label>
                  <Textarea
                    id="rr-sms"
                    value={smsBody}
                    onChange={(e) => setSmsBody(e.target.value)}
                    placeholder="Hey! Thanks for trusting us. Mind leaving a quick review?"
                    rows={3}
                    data-testid="input-rr-sms"
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">
                    {smsBody.length}/160 characters. The review link is appended automatically.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTab("pick")} data-testid="button-rr-back">Back</Button>
                <Button
                  onClick={() => send.mutate()}
                  disabled={!canCompose || send.isPending}
                  className="bg-[#0a4a82] hover:bg-[#0a4a82]/90"
                  data-testid="button-rr-send"
                >
                  {send.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send to {eligibleSelected.length}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-lg">Sent requests</CardTitle>
                  {historyQuery.data?.summary && (
                    <CardDescription>
                      {historyQuery.data.summary.sent} sent · {historyQuery.data.summary.clicked} clicked · {historyQuery.data.summary.completed} completed · {historyQuery.data.summary.failed} failed
                    </CardDescription>
                  )}
                </div>
                {failedRows.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={retryFailed}
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    data-testid="button-rr-retry-failed"
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Retry failed ({retryableKeys.size}/{failedRows.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {historyQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !historyQuery.data?.requests.length ? (
                <p className="text-center text-muted-foreground py-8">No requests sent yet.</p>
              ) : (
                <div className="border rounded-lg divide-y max-h-[480px] overflow-y-auto">
                  {historyQuery.data.requests.map((r) => {
                    const isFailed = r.status === "failed";
                    const failure = isFailed ? classifyError(r.errorMsg) : null;
                    return (
                      <div
                        key={r.id}
                        className={`p-3 flex items-start gap-3 ${isFailed ? "bg-red-50/40" : ""}`}
                        data-testid={`row-rr-history-${r.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {r.recipientName || r.recipientEmail || r.recipientPhone}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.recipientEmail && <span>{r.recipientEmail}</span>}
                            {r.recipientEmail && r.recipientPhone && <span> · </span>}
                            {r.recipientPhone && <span>{r.recipientPhone}</span>}
                            <span> · {new Date(r.createdAt).toLocaleDateString()}</span>
                          </div>
                          {failure && (
                            <div
                              className="mt-2 rounded border border-red-200 bg-red-50 p-2"
                              data-testid={`error-rr-history-${r.id}`}
                            >
                              <div className="flex items-center gap-1.5 text-xs font-medium text-red-800">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                <span data-testid={`error-rr-label-${r.id}`}>{failure.label}</span>
                              </div>
                              <div className="mt-1 text-xs text-red-700">{failure.hint}</div>
                              {r.errorMsg && (
                                <div
                                  className="mt-1 text-[11px] text-red-600/80 font-mono break-all"
                                  data-testid={`error-rr-raw-${r.id}`}
                                >
                                  {r.errorMsg}
                                </div>
                              )}
                              {isPermanentCategory(failure.category) && (failure.category === "permanent" ? r.recipientEmail : r.recipientPhone) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2 h-7 text-xs border-red-300 text-red-800 hover:bg-red-100"
                                  disabled={clearSuppression.isPending}
                                  onClick={() =>
                                    clearSuppression.mutate(
                                      failure.category === "permanent"
                                        ? { contactType: "email", contact: r.recipientEmail! }
                                        : { contactType: "phone", contact: r.recipientPhone! },
                                    )
                                  }
                                  data-testid={`button-clear-suppression-${r.id}`}
                                >
                                  {clearSuppression.isPending ? (
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  ) : null}
                                  I fixed the address — clear suppression
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs mt-0.5">{r.channel}</Badge>
                        <div className="mt-0.5">
                          <StatusBadge status={r.status} />
                        </div>
                        {r.status === "completed" && r.completedReviewId && (
                          <a
                            href={`/directory/${businessId}#review-${r.completedReviewId}`}
                            className="text-xs text-[#0a4a82] hover:underline whitespace-nowrap mt-1"
                            data-testid={`link-view-review-${r.id}`}
                          >
                            View review
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
     </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; Icon: any }> = {
    queued: { label: "Queued", cls: "bg-gray-100 text-gray-700", Icon: Clock },
    sent: { label: "Sent", cls: "bg-blue-100 text-blue-800", Icon: Send },
    clicked: { label: "Clicked", cls: "bg-amber-100 text-amber-800", Icon: Star },
    completed: { label: "Reviewed", cls: "bg-green-100 text-green-800", Icon: CheckCircle2 },
    failed: { label: "Failed", cls: "bg-red-100 text-red-800", Icon: AlertCircle },
  };
  const item = map[status] ?? map.queued;
  const Icon = item.Icon;
  return (
    <Badge className={`${item.cls} text-xs gap-1`}>
      <Icon className="h-3 w-3" /> {item.label}
    </Badge>
  );
}
