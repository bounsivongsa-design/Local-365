import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
          <PlaceholderPanel
            icon={<CreditCard className="h-6 w-6" />}
            title="Credit System"
            phase="1A"
            description="Track per-business credit balances, monthly Gold allowance grants, credit pack purchases via Stripe, and full transaction history. Founder businesses bypass charges but their costs are tracked."
            buildSteps={[
              "Schema: ai_credits, ai_credit_transactions, ai_credit_packs",
              "Monthly grant cron (1st of month → 500 credits to all active Gold members)",
              "Stripe products for credit packs (one-time charges)",
              "Credit purchase flow + webhook handler",
              "Business-facing balance widget (preview here only)",
            ]}
          />
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
          <PlaceholderPanel
            icon={<TrendingUp className="h-6 w-6" />}
            title="AI Revenue Dashboard"
            phase="1A"
            description="Per-business and aggregate view of AI usage costs vs. revenue. Shows what each member is being charged, what they cost in API spend, and net profit per feature."
            buildSteps={[
              "Aggregate KPIs (revenue, cost, margin, this month + YTD)",
              "Per-business breakdown table with drill-down",
              "Feature-level revenue/cost split",
              "Cost spike alerts + budget caps",
              "Refund flow (admin can credit back)",
            ]}
          />
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
