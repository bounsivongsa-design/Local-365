import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Video,
  FileText,
  CreditCard,
  TrendingUp,
  Settings,
  ArrowLeft,
  Lock,
  Zap,
  Crown,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

/**
 * AI Lab — isolated admin-only sandbox for building out the Gold AI Suite.
 *
 * Nothing on this page is wired into customer-facing flows yet. Build features
 * here, then graduate them to the dashboard / business edit forms when ready.
 *
 * Phases (see roadmap below):
 *   1A — Credit system foundation + Stripe credit packs + admin revenue dashboard
 *   1B — AI text features (listing writer, quote drafts, job posts, listing coach)
 *   1C — AI ad generator (Imagen 4 + Flux via Replicate)
 *   1D — Image enhancement (Cloudinary)
 *   2  — AI reels (Creatomate)
 *   3  — Strategic reports (Review Insights, Competitor Intel)
 *   4  — Admin AI tools (moderation, verification, duplicates, churn)
 */
export default function AILab() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAuthenticated || user?.accountType !== "admin") {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200">
          <CardContent className="p-8 text-center">
            <Lock className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Admin Only</h2>
            <p className="text-muted-foreground mb-4">
              The AI Lab is restricted to platform administrators.
            </p>
            <Button onClick={() => navigate("/")} data-testid="button-go-home">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link to="/admin" className="text-sm text-muted-foreground hover:text-[#0a4a82] flex items-center gap-1" data-testid="link-back-admin">
              <ArrowLeft className="h-3 w-3" />
              Back to Admin
            </Link>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-[#0a4a82]">
            <Sparkles className="h-8 w-8 text-[#d4a373]" />
            AI Lab
          </h1>
          <p className="text-muted-foreground mt-1">
            Isolated sandbox for building the Gold AI Suite. Not live to users.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Pre-release
          </Badge>
          <Badge variant="outline" className="border-[#d4a373] text-[#d4a373] bg-[#f5f5dc]">
            <Crown className="h-3 w-3 mr-1" />
            Gold Tier Feature
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full" data-testid="tabs-ai-lab">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="credits" data-testid="tab-credits">Credits</TabsTrigger>
          <TabsTrigger value="concierge" data-testid="tab-concierge">Concierge</TabsTrigger>
          <TabsTrigger value="ads" data-testid="tab-ads">Ad Studio</TabsTrigger>
          <TabsTrigger value="revenue" data-testid="tab-revenue">Revenue</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Build Roadmap</CardTitle>
              <CardDescription>
                Each phase is built and tested in isolation here, then graduated
                to the production business dashboard when approved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ROADMAP.map((phase) => (
                  <div
                    key={phase.id}
                    className="flex items-start justify-between gap-4 p-4 border rounded-lg"
                    data-testid={`phase-${phase.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 rounded">
                          {phase.id}
                        </span>
                        <h3 className="font-semibold">{phase.title}</h3>
                        <StatusBadge status={phase.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">{phase.description}</p>
                      <div className="flex gap-1 flex-wrap mt-2">
                        {phase.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      ~{phase.effortDays}d
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-4">
            <StatCard
              icon={<Crown className="h-5 w-5" />}
              label="Included with Gold (monthly)"
              value="1 ad + 1 reel + unlimited text + 25 photo enhancements + 250 bonus credits"
              color="text-[#d4a373]"
            />
            <StatCard
              icon={<CreditCard className="h-5 w-5" />}
              label="Credit packs"
              value="$10 / $25 / $75 / $200"
              color="text-[#0a4a82]"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Target margin"
              value="~85% on all AI features"
              color="text-[#8a9a5b]"
            />
          </div>
        </TabsContent>

        {/* CREDITS — Phase 1A target */}
        <TabsContent value="credits" className="space-y-4">
          <CreditsPanel />
        </TabsContent>

        {/* CONCIERGE — Phase 1B/1C */}
        <TabsContent value="concierge" className="space-y-4">
          <PlaceholderPanel
            icon={<Wand2 className="h-6 w-6" />}
            title="AI Concierge Chat"
            phase="1B"
            description="Conversational AI that performs actions on behalf of Gold members — edit listing, draft quote replies, write job posts, generate ads. Function-calling layer with explicit approval gate before publishing anything."
            buildSteps={[
              "Chat UI with message history + cost preview",
              "OpenAI function calling with tool catalog",
              "Tools: updateListing, draftQuoteReply, createJobPost, runListingCoach",
              "Approval modal before any publish action",
              "Action audit log",
            ]}
          />
        </TabsContent>

        {/* AD STUDIO — Phase 1C */}
        <TabsContent value="ads" className="space-y-4">
          <PlaceholderPanel
            icon={<ImageIcon className="h-6 w-6" />}
            title="AI Ad Generator"
            phase="1C"
            description="User describes the ad they want, AI generates 3 variants using Imagen 4 (or Flux for photorealism) via Replicate. Server-side text overlay composition adds headline, CTA, contact info. Publishes directly to carousel ad slot."
            buildSteps={[
              "Replicate API integration (Imagen 4 + Flux 1.1 Pro)",
              "10-15 owned layout templates (header/body/CTA)",
              "Server-side composition (sharp/canvas)",
              "3-variant generation flow with regenerate",
              "Direct publish to existing carousel ad system",
            ]}
          />

          <PlaceholderPanel
            icon={<Video className="h-6 w-6" />}
            title="AI Reels (Phase 2)"
            phase="2"
            description="Template-based video reels via Creatomate. AI picks the right template (before/after, slideshow, promo), generates text overlays, suggests photos from gallery, renders 1080p MP4."
            buildSteps={[
              "Creatomate API integration",
              "Library of ~5 starter templates (slideshow, before/after, promo, grand opening, special)",
              "AI template selection + content fill",
              "Preview before publish",
            ]}
          />
        </TabsContent>

        {/* REVENUE — Phase 1A admin side */}
        <TabsContent value="revenue" className="space-y-4">
          <RevenuePanel />
        </TabsContent>

        {/* SETTINGS — model selection, pricing tweaks */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Lab Configuration
              </CardTitle>
              <CardDescription>
                Where you'll tune model choices, credit costs, and monthly allowances before going live.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ConfigRow label="Image model (primary)" value="Google Imagen 4 (via Replicate)" />
              <ConfigRow label="Image model (photorealism)" value="Flux 1.1 Pro (via Replicate)" />
              <ConfigRow label="Text model (premium copy)" value="Claude Sonnet" />
              <ConfigRow label="Text model (fast tasks)" value="GPT-4o" />
              <ConfigRow label="Video rendering" value="Creatomate (templates)" />
              <ConfigRow label="Image enhancement" value="Cloudinary" />
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  All API keys will be added as Replit secrets when each phase is wired up.
                  Nothing here makes external API calls until enabled.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Required Account Setups</CardTitle>
              <CardDescription>You handle these one-time signups; we add the API keys as secrets.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <SetupRow service="Replicate" url="https://replicate.com" purpose="Image + video AI models (Imagen, Flux, etc.)" />
              <SetupRow service="Creatomate" url="https://creatomate.com" purpose="Video reel rendering" />
              <SetupRow service="Cloudinary" url="https://cloudinary.com" purpose="Image enhancement (free tier)" />
              <SetupRow service="Anthropic" url="https://console.anthropic.com" purpose="Claude Sonnet for premium copy (optional)" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ────────────────── components ────────────────── */

function StatusBadge({ status }: { status: PhaseStatus }) {
  const styles: Record<PhaseStatus, string> = {
    planned: "bg-slate-100 text-slate-700 border-slate-300",
    in_progress: "bg-blue-50 text-blue-700 border-blue-300",
    ready: "bg-green-50 text-green-700 border-green-300",
    live: "bg-[#f5f5dc] text-[#0a4a82] border-[#d4a373]",
  };
  const labels: Record<PhaseStatus, string> = {
    planned: "Planned",
    in_progress: "Building",
    ready: "Ready to Graduate",
    live: "Live",
  };
  return <Badge variant="outline" className={styles[status]}>{labels[status]}</Badge>;
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 ${color} mb-2`}>
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-sm text-muted-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function PlaceholderPanel({
  icon,
  title,
  phase,
  description,
  buildSteps,
}: {
  icon: React.ReactNode;
  title: string;
  phase: string;
  description: string;
  buildSteps: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="text-[#0a4a82]">{icon}</div>
            <CardTitle>{title}</CardTitle>
            <Badge variant="outline" className="font-mono text-xs">Phase {phase}</Badge>
          </div>
          <StatusBadge status="planned" />
        </div>
        <CardDescription className="pt-2">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Build Plan
        </p>
        <ul className="space-y-1.5">
          {buildSteps.map((s, i) => (
            <li key={i} className="text-sm flex gap-2">
              <CheckCircle2 className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 p-3 bg-slate-50 border rounded text-xs text-muted-foreground italic flex items-center gap-2">
          <Zap className="h-3 w-3" />
          UI for this feature will be built right here in the Lab tab so you can preview it before it goes live to Gold members.
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function SetupRow({ service, url, purpose }: { service: string; url: string; purpose: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <div>
        <span className="font-medium">{service}</span>
        <p className="text-xs text-muted-foreground">{purpose}</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-[#0a4a82] hover:underline"
        data-testid={`link-setup-${service.toLowerCase()}`}
      >
        Open ↗
      </a>
    </div>
  );
}

/* ────────────────── roadmap ────────────────── */

type PhaseStatus = "planned" | "in_progress" | "ready" | "live";

const ROADMAP: Array<{
  id: string;
  title: string;
  description: string;
  status: PhaseStatus;
  effortDays: number;
  tags: string[];
}> = [
  {
    id: "1A",
    title: "Credit System Foundation",
    description: "DB schema, monthly Gold allowance grants, Stripe credit pack purchases, admin revenue dashboard.",
    status: "planned",
    effortDays: 3,
    tags: ["DB", "Stripe", "Admin"],
  },
  {
    id: "1B",
    title: "AI Text Features",
    description: "Listing auto-writer, quote reply drafts, job post writer, listing coach scorecard.",
    status: "planned",
    effortDays: 2,
    tags: ["GPT-4o", "Claude"],
  },
  {
    id: "1C",
    title: "AI Ad Generator",
    description: "Imagen 4 + Flux via Replicate. Owned templates. Direct publish to carousel.",
    status: "planned",
    effortDays: 4,
    tags: ["Replicate", "Imagen", "Flux"],
  },
  {
    id: "1D",
    title: "Image Enhancement",
    description: "Auto brightness/sharpen/crop on uploads via Cloudinary.",
    status: "planned",
    effortDays: 1,
    tags: ["Cloudinary"],
  },
  {
    id: "2",
    title: "AI Reels",
    description: "Template-based 15-30s video reels via Creatomate.",
    status: "planned",
    effortDays: 3,
    tags: ["Creatomate", "Video"],
  },
  {
    id: "3",
    title: "Strategic Reports",
    description: "Review Insights dashboard + Competitor Intel monthly report.",
    status: "planned",
    effortDays: 3,
    tags: ["Reports", "Gold-only"],
  },
  {
    id: "4",
    title: "Admin AI Tools",
    description: "Auto-moderation queue, document verification, duplicate detection, churn risk alerts.",
    status: "planned",
    effortDays: 5,
    tags: ["Admin", "Internal"],
  },
];

/* ────────────────── Phase 1A: live panels ────────────────── */

type Balance = {
  businessId: number;
  businessName: string;
  membershipTier: string | null;
  balance: number | null;
  monthlyAllowance: number | null;
  adsUsedThisCycle: number | null;
  reelsUsedThisCycle: number | null;
  enhancementsUsedThisCycle: number | null;
  cycleResetsAt: string | null;
  lastGrantAt: string | null;
  isFounderComp: boolean | null;
};
type Pack = {
  id: number;
  sku: string;
  name: string;
  credits: number;
  priceCents: number;
};
type Txn = {
  id: number;
  businessId: number;
  businessName: string | null;
  type: string;
  feature: string | null;
  creditsDelta: number;
  costCents: number;
  revenueCents: number;
  metadata: string | null;
  createdAt: string;
};

function fmtUsd(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type AiPromo = {
  id: number;
  code: string;
  description: string | null;
  aiCreditAmount: number | null;
  maxUses: number | null;
  currentUses: number | null;
  expiresAt: string | null;
  isActive: boolean | null;
  createdAt: string | null;
};

function CreditsPanel() {
  const { toast } = useToast();
  const [adjustBizId, setAdjustBizId] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>("");
  const [newCode, setNewCode] = useState("");
  const [newCredits, setNewCredits] = useState("500");
  const [newMaxUses, setNewMaxUses] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemBizId, setRedeemBizId] = useState<string>("");

  const balancesQ = useQuery<{ balances: Balance[] }>({
    queryKey: ["/api/admin/ai-lab/balances"],
  });
  const packsQ = useQuery<{ packs: Pack[] }>({
    queryKey: ["/api/admin/ai-lab/packs"],
  });
  const txnsQ = useQuery<{ transactions: Txn[] }>({
    queryKey: ["/api/admin/ai-lab/transactions"],
  });
  const promosQ = useQuery<{ promoCodes: AiPromo[] }>({
    queryKey: ["/api/admin/ai-lab/promo-codes"],
  });

  const createPromo = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/ai-lab/promo-codes", {
        code: newCode,
        aiCreditAmount: parseInt(newCredits, 10),
        maxUses: newMaxUses ? parseInt(newMaxUses, 10) : null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Promo code created" });
      setNewCode("");
      setNewMaxUses("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-lab/promo-codes"] });
    },
    onError: (err: any) => {
      toast({ title: "Create failed", description: err.message, variant: "destructive" });
    },
  });

  const togglePromo = useMutation({
    mutationFn: async (vars: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/ai-lab/promo-codes/${vars.id}`, {
        isActive: vars.isActive,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-lab/promo-codes"] });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const redeemPromo = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/ai-lab/promo-codes/redeem", {
        code: redeemCode,
        businessId: parseInt(redeemBizId, 10),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Redeemed",
        description: `+${data.credited.toLocaleString()} credits applied to business #${data.businessId}.`,
      });
      setRedeemCode("");
      setRedeemBizId("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-lab/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-lab/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-lab/promo-codes"] });
    },
    onError: (err: any) => {
      toast({ title: "Redeem failed", description: err.message, variant: "destructive" });
    },
  });

  const grantMonthly = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await apiRequest("POST", "/api/admin/ai-lab/run-monthly-grant", { dryRun });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data.dryRun ? "Dry run complete" : "Monthly grants applied",
        description: `${data.grantedCount} businesses granted, ${data.skippedCount} skipped (of ${data.totalGold} Gold).`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-lab/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-lab/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-lab/revenue"] });
    },
    onError: (err: any) => {
      toast({ title: "Grant failed", description: err.message, variant: "destructive" });
    },
  });

  const adjust = useMutation({
    mutationFn: async (vars: { businessId: number; creditsDelta: number; note?: string }) => {
      const res = await apiRequest("POST", "/api/admin/ai-lab/adjust", vars);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Balance updated" });
      setAdjustBizId(null);
      setAdjustAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-lab/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-lab/transactions"] });
    },
    onError: (err: any) => {
      toast({ title: "Adjustment failed", description: err.message, variant: "destructive" });
    },
  });

  const balances = balancesQ.data?.balances ?? [];
  const goldOnly = balances.filter((b) => b.membershipTier === "premium");

  return (
    <div className="space-y-4">
      {/* Credit packs catalog */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Credit Packs
              </CardTitle>
              <CardDescription>One-time top-ups Gold members can buy. Stripe wiring lands in Phase 1B.</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">Phase 1A</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {packsQ.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {packsQ.data?.packs.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border p-3 text-center"
                  data-testid={`pack-${p.sku}`}
                >
                  <p className="text-xs uppercase text-muted-foreground">{p.sku}</p>
                  <p className="text-2xl font-bold text-[#0a4a82] mt-1">
                    {p.credits.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">credits</p>
                  <p className="text-sm font-semibold mt-2">{fmtUsd(p.priceCents)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {(p.priceCents / p.credits).toFixed(2)}¢ / credit
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cron simulator */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Monthly Grant (Cron Simulator)
              </CardTitle>
              <CardDescription>
                Grants the included monthly bonus credits to every active Gold member and resets cycle counters.
                Production will run this on the 1st of each month.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => grantMonthly.mutate(true)}
                disabled={grantMonthly.isPending}
                data-testid="button-grant-dryrun"
              >
                Dry Run
              </Button>
              <Button
                onClick={() => grantMonthly.mutate(false)}
                disabled={grantMonthly.isPending}
                data-testid="button-grant-monthly"
                className="bg-[#0a4a82] hover:bg-[#083a66]"
              >
                {grantMonthly.isPending ? "Granting…" : "Run Monthly Grant"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Promo codes for free credits */}
      <Card data-testid="card-ai-promo">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Free-Credit Promo Codes
              </CardTitle>
              <CardDescription>
                Hand these out to anyone (Bronze, Silver, or no membership) so they can test AI features.
                Each business may redeem a given code only once.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create form */}
          <div className="rounded-lg border p-3 grid gap-2 md:grid-cols-[1fr_120px_120px_auto] items-end">
            <div>
              <label className="text-xs text-muted-foreground">Code</label>
              <Input
                placeholder="TESTAI100"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                className="h-9 font-mono"
                data-testid="input-promo-code"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Credits</label>
              <Input
                type="number"
                value={newCredits}
                onChange={(e) => setNewCredits(e.target.value)}
                className="h-9"
                data-testid="input-promo-credits"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Max Uses</label>
              <Input
                type="number"
                placeholder="∞"
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(e.target.value)}
                className="h-9"
                data-testid="input-promo-max-uses"
              />
            </div>
            <Button
              onClick={() => createPromo.mutate()}
              disabled={createPromo.isPending || !newCode.trim() || !newCredits}
              className="bg-[#0a4a82] hover:bg-[#083a66] h-9"
              data-testid="button-create-promo"
            >
              {createPromo.isPending ? "Creating…" : "Create Code"}
            </Button>
          </div>

          {/* Redeem form */}
          <div className="rounded-lg border border-dashed p-3 grid gap-2 md:grid-cols-[1fr_180px_auto] items-end bg-muted/30">
            <div>
              <label className="text-xs text-muted-foreground">Redeem Code</label>
              <Input
                placeholder="TESTAI100"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                className="h-9 font-mono"
                data-testid="input-redeem-code"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">For Business ID</label>
              <Input
                type="number"
                placeholder="e.g. 12"
                value={redeemBizId}
                onChange={(e) => setRedeemBizId(e.target.value)}
                className="h-9"
                data-testid="input-redeem-biz-id"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => redeemPromo.mutate()}
              disabled={redeemPromo.isPending || !redeemCode.trim() || !redeemBizId.trim()}
              className="h-9"
              data-testid="button-redeem-promo"
            >
              {redeemPromo.isPending ? "Redeeming…" : "Redeem on Behalf"}
            </Button>
          </div>

          {/* Codes list */}
          {promosQ.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (promosQ.data?.promoCodes ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No promo codes yet. Create one above to start handing out free credits.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-center">Uses</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promosQ.data!.promoCodes.map((p) => (
                    <TableRow key={p.id} data-testid={`row-promo-${p.id}`}>
                      <TableCell className="font-mono text-sm">{p.code}</TableCell>
                      <TableCell className="text-right font-mono">{(p.aiCreditAmount ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {p.currentUses ?? 0}{p.maxUses ? ` / ${p.maxUses}` : ""}
                      </TableCell>
                      <TableCell className="text-xs">{p.expiresAt ? fmtDate(p.expiresAt) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={p.isActive ? "default" : "outline"} className="text-[10px]">
                          {p.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => togglePromo.mutate({ id: p.id, isActive: !p.isActive })}
                          disabled={togglePromo.isPending}
                          data-testid={`button-toggle-promo-${p.id}`}
                        >
                          {p.isActive ? "Disable" : "Enable"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Balances table */}
      <Card>
        <CardHeader>
          <CardTitle>Business Credit Balances</CardTitle>
          <CardDescription>
            {goldOnly.length} Gold member{goldOnly.length === 1 ? "" : "s"} · {balances.length} total business{balances.length === 1 ? "" : "es"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {balancesQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : balances.length === 0 ? (
            <p className="text-sm text-muted-foreground">No businesses yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-center">Used (Ads / Reels / Enh)</TableHead>
                    <TableHead>Last Grant</TableHead>
                    <TableHead>Adjust</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((b) => (
                    <TableRow key={b.businessId} data-testid={`row-balance-${b.businessId}`}>
                      <TableCell className="font-medium">
                        {b.businessName}
                        {b.isFounderComp && (
                          <Badge variant="outline" className="ml-2 text-[10px] border-amber-400 text-amber-700">
                            Founder
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <TierBadge tier={b.membershipTier} />
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`balance-${b.businessId}`}>
                        {(b.balance ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {b.adsUsedThisCycle ?? 0} / {b.reelsUsedThisCycle ?? 0} / {b.enhancementsUsedThisCycle ?? 0}
                      </TableCell>
                      <TableCell className="text-xs">{fmtDate(b.lastGrantAt)}</TableCell>
                      <TableCell>
                        {adjustBizId === b.businessId ? (
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              placeholder="±100"
                              value={adjustAmount}
                              onChange={(e) => setAdjustAmount(e.target.value)}
                              className="h-8 w-20 text-xs"
                              data-testid={`input-adjust-${b.businessId}`}
                            />
                            <Button
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => {
                                const n = parseInt(adjustAmount, 10);
                                if (!isNaN(n) && n !== 0) {
                                  adjust.mutate({ businessId: b.businessId, creditsDelta: n, note: "Admin sandbox grant" });
                                }
                              }}
                              disabled={adjust.isPending}
                              data-testid={`button-confirm-adjust-${b.businessId}`}
                            >
                              Apply
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs"
                              onClick={() => { setAdjustBizId(null); setAdjustAmount(""); }}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => setAdjustBizId(b.businessId)}
                            data-testid={`button-adjust-${b.businessId}`}
                          >
                            Grant / Deduct
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Most recent 50 credit movements across all businesses.</CardDescription>
        </CardHeader>
        <CardContent>
          {txnsQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (txnsQ.data?.transactions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet. Run a monthly grant or adjust a balance to see activity here.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Feature</TableHead>
                    <TableHead className="text-right">Δ Credits</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txnsQ.data!.transactions.map((t) => (
                    <TableRow key={t.id} data-testid={`row-txn-${t.id}`}>
                      <TableCell className="text-xs">{fmtDate(t.createdAt)}</TableCell>
                      <TableCell className="text-xs">{t.businessName ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">{t.type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.feature ?? "—"}</TableCell>
                      <TableCell className={`text-right font-mono text-xs ${t.creditsDelta >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {t.creditsDelta > 0 ? "+" : ""}{t.creditsDelta.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs">{t.costCents > 0 ? fmtUsd(t.costCents) : "—"}</TableCell>
                      <TableCell className="text-right text-xs">{t.revenueCents > 0 ? fmtUsd(t.revenueCents) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type RevenueData = {
  windowStart: string;
  months: number;
  totals: {
    revenueCents: number;
    costCents: number;
    netCents: number;
    marginPct: number;
    creditsGranted: number;
    creditsPurchased: number;
    creditsUsed: number;
    transactionCount: number;
  };
  featureBreakdown: Array<{ feature: string; costCents: number; usageCount: number }>;
  perBusiness: Array<{
    businessId: number;
    businessName: string;
    membershipTier: string;
    revenueCents: number;
    costCents: number;
    netCents: number;
    creditsUsed: number;
  }>;
};

function RevenuePanel() {
  const [months, setMonths] = useState(1);
  const revenueQ = useQuery<RevenueData>({
    queryKey: ["/api/admin/ai-lab/revenue", months],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ai-lab/revenue?months=${months}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load revenue");
      return res.json();
    },
  });

  const t = revenueQ.data?.totals;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                AI Revenue & Cost
              </CardTitle>
              <CardDescription>
                Window: last {months} month{months === 1 ? "" : "s"} ·{" "}
                {revenueQ.data ? `since ${fmtDate(revenueQ.data.windowStart)}` : "loading"}
              </CardDescription>
            </div>
            <div className="flex gap-1">
              {[1, 3, 6, 12].map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={months === m ? "default" : "outline"}
                  className={months === m ? "bg-[#0a4a82] hover:bg-[#083a66]" : ""}
                  onClick={() => setMonths(m)}
                  data-testid={`button-window-${m}m`}
                >
                  {m}M
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {revenueQ.isLoading || !t ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiTile label="Revenue" value={fmtUsd(t.revenueCents)} tone="green" testId="kpi-revenue" />
              <KpiTile label="API Cost" value={fmtUsd(t.costCents)} tone="amber" testId="kpi-cost" />
              <KpiTile
                label="Net Profit"
                value={fmtUsd(t.netCents)}
                tone={t.netCents >= 0 ? "blue" : "red"}
                testId="kpi-net"
              />
              <KpiTile
                label="Margin"
                value={t.revenueCents > 0 ? `${t.marginPct}%` : "—"}
                tone="blue"
                testId="kpi-margin"
              />
              <KpiTile
                label="Credits Granted"
                value={t.creditsGranted.toLocaleString()}
                tone="slate"
                testId="kpi-granted"
              />
              <KpiTile
                label="Credits Purchased"
                value={t.creditsPurchased.toLocaleString()}
                tone="slate"
                testId="kpi-purchased"
              />
              <KpiTile
                label="Credits Used"
                value={t.creditsUsed.toLocaleString()}
                tone="slate"
                testId="kpi-used"
              />
              <KpiTile
                label="Transactions"
                value={t.transactionCount.toLocaleString()}
                tone="slate"
                testId="kpi-txn"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost by Feature</CardTitle>
          <CardDescription>Where your API spend is going. Empty until features start running.</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueQ.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (revenueQ.data?.featureBreakdown ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage logged in this window yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead className="text-right">Uses</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Avg Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueQ.data!.featureBreakdown.map((f) => (
                  <TableRow key={f.feature} data-testid={`feature-${f.feature}`}>
                    <TableCell className="font-mono text-xs">{f.feature}</TableCell>
                    <TableCell className="text-right">{f.usageCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{fmtUsd(f.costCents)}</TableCell>
                    <TableCell className="text-right">
                      {f.usageCount > 0 ? fmtUsd(Math.round(f.costCents / f.usageCount)) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-Business Profitability</CardTitle>
          <CardDescription>Sorted by net profit (revenue minus cost).</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (revenueQ.data?.perBusiness ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Credits Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueQ.data!.perBusiness.map((b) => (
                    <TableRow key={b.businessId} data-testid={`pb-row-${b.businessId}`}>
                      <TableCell className="font-medium">{b.businessName}</TableCell>
                      <TableCell><TierBadge tier={b.membershipTier} /></TableCell>
                      <TableCell className="text-right text-xs">{fmtUsd(b.revenueCents)}</TableCell>
                      <TableCell className="text-right text-xs">{fmtUsd(b.costCents)}</TableCell>
                      <TableCell className={`text-right text-xs font-semibold ${b.netCents >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {fmtUsd(b.netCents)}
                      </TableCell>
                      <TableCell className="text-right text-xs">{b.creditsUsed.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TierBadge({ tier }: { tier: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    premium: { label: "Gold", cls: "bg-[#f5f5dc] text-[#0a4a82] border-[#d4a373]" },
    standard: { label: "Silver", cls: "bg-slate-100 text-slate-700 border-slate-300" },
    basic: { label: "Bronze", cls: "bg-amber-50 text-amber-800 border-amber-300" },
  };
  const m = (tier && map[tier]) || { label: tier ?? "none", cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={`text-[10px] ${m.cls}`}>{m.label}</Badge>;
}

function KpiTile({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "blue" | "red" | "slate";
  testId: string;
}) {
  const tones: Record<typeof tone, string> = {
    green: "border-green-300 bg-green-50 text-green-800",
    amber: "border-amber-300 bg-amber-50 text-amber-800",
    blue: "border-[#d4a373] bg-[#f5f5dc] text-[#0a4a82]",
    red: "border-red-300 bg-red-50 text-red-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  } as const;
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`} data-testid={testId}>
      <p className="text-[10px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
