import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Users,
  Building2,
  Calendar,
  Briefcase,
  MessageSquare,
  Megaphone,
  Tag,
  Crown,
  Star,
  Medal,
  AlertCircle,
  ArrowRight,
  BarChart3,
  FileText,
  CheckCircle2,
  XCircle,
  Eye,
  ArrowDown,
  Layers,
  Search,
  KeyRound,
  Trash2,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  BadgeCheck,
  FileCheck,
  ExternalLink,
  Upload,
  Scale,
  Award,
  ClipboardCheck,
  DollarSign,
  TrendingUp,
  Receipt,
  CircleDollarSign,
  Sparkles,
  Copy,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type AdminStats = {
  overview: {
    totalUsers: number;
    totalBusinesses: number;
    totalEvents: number;
    totalJobs: number;
    totalPosts: number;
    totalQuoteRequests: number;
    totalQuotes: number;
    totalAds: number;
    activeAds: number;
    pendingAds: number;
    totalPromos: number;
    usedPromos: number;
    pendingCategories: number;
    pendingEvents: number;
    unverifiedBusinesses: number;
    downgradesCount: number;
    customerAccounts: number;
    businessAccounts: number;
  };
  membershipBreakdown: Record<string, number>;
  revenueBreakdown: {
    subscriptions: {
      realized: {
        bronze: { count: number; monthly: number };
        silver: { count: number; monthly: number };
        gold: { count: number; monthly: number };
        total: number;
      };
      projected: {
        bronze: { count: number; monthly: number };
        silver: { count: number; monthly: number };
        gold: { count: number; monthly: number };
        total: number;
      };
      trialingCount: number;
    };
    ads: {
      realized: {
        small: { count: number; revenue: number };
        medium: { count: number; revenue: number };
        large: { count: number; revenue: number };
        total: number;
      };
      projected: {
        small: { count: number; revenue: number };
        medium: { count: number; revenue: number };
        large: { count: number; revenue: number };
        total: number;
      };
      unpaidActiveCount: number;
      totalPaid: number;
    };
    jobs: {
      activeJobs: number;
      totalEstimated: number;
    };
  };
  recentUsers: Array<{ id: string; email: string | null; firstName: string | null; lastName: string | null; accountType: string | null; createdAt: string | null }>;
  recentBusinesses: Array<{ id: number; name: string; membershipTier: string | null; verified: boolean | null; createdAt: string | null }>;
  recentQuoteRequests: Array<{ id: number; title: string; status: string | null; createdAt: string | null }>;
  recentAds: Array<{ id: number; title: string | null; status: string | null; placement: string | null; createdAt: string | null }>;
};

type AdminUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  accountType: string | null;
  
  isValidated: boolean | null;
  linkedBusinessId: number | null;
  googleId: string | null;
  createdAt: string | null;
};

type AdminBusiness = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  zipCode: string | null;
  membershipTier: string | null;
  membershipStartDate: string | null;
  membershipEndDate: string | null;
  originalMembershipTier: string | null;
  goldTrialEndDate: string | null;
  verified: boolean | null;
  acceptsQuotes: boolean | null;
  createdAt: string | null;
};

type Tab = "overview" | "users" | "businesses" | "events" | "promos" | "ads" | "quotes" | "growth";

function tierLabel(t: string | null | undefined) {
  if (!t || t === "none") return "No Plan";
  if (t === "premium") return "Gold";
  if (t === "standard") return "Silver";
  if (t === "basic") return "Bronze";
  return t;
}

function tierColor(t: string | null | undefined) {
  if (t === "premium") return "bg-yellow-500 text-white";
  if (t === "standard") return "bg-slate-400 text-white";
  if (t === "basic") return "bg-amber-700 text-white";
  return "bg-gray-200 text-gray-700";
}

function statusBadge(status: string | null) {
  if (status === "active" || status === "open") return <Badge className="bg-green-100 text-green-800 text-xs">{status === "open" ? "Open" : "Active"}</Badge>;
  if (status === "pending") return <Badge className="bg-amber-100 text-amber-800 text-xs">Pending</Badge>;
  if (status === "in_progress") return <Badge className="bg-blue-100 text-blue-800 text-xs">In Progress</Badge>;
  if (status === "completed" || status === "approved") return <Badge className="bg-blue-100 text-blue-800 text-xs">{status}</Badge>;
  if (status === "rejected" || status === "expired" || status === "cancelled") return <Badge className="bg-red-100 text-red-800 text-xs">{status}</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 text-xs">{status || "unknown"}</Badge>;
}

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  if (!isAuthenticated || user?.accountType !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="bg-white/95 backdrop-blur-sm p-8 text-center max-w-md">
          <Shield className="h-12 w-12 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-[#1a1a2e] mb-2">Admin Access Required</h2>
          <p className="text-slate-500 mb-4">You need admin privileges to view this page.</p>
          <Button onClick={() => navigate("/dashboard")} className="bg-[#0a4a82] hover:bg-[#083a6a] text-white rounded-xl">
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "businesses", label: "Businesses", icon: Building2 },
    { id: "events", label: "Events", icon: Calendar },
    { id: "promos", label: "Promos", icon: Tag },
    { id: "ads", label: "Ads", icon: Megaphone },
    { id: "quotes", label: "Quotes", icon: MessageSquare },
    { id: "growth", label: "Growth", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen pb-20">
      <div className="bg-gradient-to-b from-[#1a1a2e] to-[#0a0a1a] py-10 border-b border-white/10">
        <div className="container">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#d4a373]/20 rounded-xl">
              <Shield className="h-7 w-7 text-[#d4a373]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight" data-testid="heading-admin-dashboard">
                Admin Command Center
              </h1>
              <p className="text-white/50 text-sm">Manage and monitor your entire platform</p>
            </div>
          </div>
          <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-[#d4a373] text-white shadow-md"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-8">
        {activeTab === "overview" && <OverviewTab onSwitchTab={setActiveTab} />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "businesses" && <BusinessesTab />}
        {activeTab === "events" && <EventsTab />}
        {activeTab === "promos" && <PromosTab />}
        {activeTab === "ads" && <AdsTab />}
        {activeTab === "quotes" && <QuotesTab />}
        {activeTab === "growth" && <GrowthTab />}
      </div>
    </div>
  );
}

function OverviewTab({ onSwitchTab }: { onSwitchTab: (tab: Tab) => void }) {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch admin stats");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    );
  }

  const o = stats?.overview;
  const mb = stats?.membershipBreakdown || {};
  const rev = stats?.revenueBreakdown;
  const formatCents = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const subsRealized = rev?.subscriptions?.realized;
  const subsProjected = rev?.subscriptions?.projected;
  const adsRealized = rev?.ads?.realized;
  const adsProjected = rev?.ads?.projected;
  const trialingCount = rev?.subscriptions?.trialingCount || 0;
  const unpaidActiveAds = rev?.ads?.unpaidActiveCount || 0;
  const realizedMrr = (subsRealized?.total || 0) + (adsRealized?.total || 0) + (rev?.jobs?.totalEstimated || 0);
  const projectedMrr = (subsProjected?.total || 0) + (adsProjected?.total || 0) + (rev?.jobs?.totalEstimated || 0);
  const realizedAnnual = realizedMrr * 12;
  const projectedAnnual = projectedMrr * 12;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={o?.totalUsers || 0} sub={`${o?.customerAccounts || 0} customers · ${o?.businessAccounts || 0} businesses`} color="blue" />
        <StatCard icon={Building2} label="Businesses" value={o?.totalBusinesses || 0} sub={`${o?.unverifiedBusinesses || 0} unverified`} color="purple" />
        <StatCard icon={Calendar} label="Events" value={o?.totalEvents || 0} sub={`${o?.pendingEvents || 0} pending review`} color="green" />
        <StatCard icon={Briefcase} label="Active Jobs" value={o?.totalJobs || 0} sub="Help wanted posts" color="amber" />
        <StatCard icon={MessageSquare} label="Quote Requests" value={o?.totalQuoteRequests || 0} sub={`${o?.totalQuotes || 0} bids submitted`} color="teal" />
        <StatCard icon={Megaphone} label="Advertisements" value={o?.totalAds || 0} sub={`${o?.activeAds || 0} active · ${o?.pendingAds || 0} pending`} color="rose" />
        <StatCard icon={FileText} label="Community Posts" value={o?.totalPosts || 0} sub="Feed activity" color="indigo" />
        <StatCard icon={Tag} label="Promo Codes" value={o?.totalPromos || 0} sub={`${o?.usedPromos || 0} redeemed`} color="emerald" />
      </div>

      {((o?.pendingAds || 0) > 0 || (o?.pendingCategories || 0) > 0 || (o?.pendingEvents || 0) > 0 || (o?.unverifiedBusinesses || 0) > 0) && (
        <Card className="bg-amber-50 border-amber-200 shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-amber-900">Items Needing Attention</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              {(o?.pendingAds || 0) > 0 && (
                <Link to="/admin/ads" data-testid="link-pending-ads">
                  <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100 rounded-xl gap-2">
                    <Eye className="h-4 w-4" />
                    {o?.pendingAds} Pending Ad{(o?.pendingAds || 0) > 1 ? "s" : ""}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              )}
              {(o?.pendingEvents || 0) > 0 && (
                <Link to="/admin/events" data-testid="link-pending-events">
                  <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100 rounded-xl gap-2">
                    <Calendar className="h-4 w-4" />
                    {o?.pendingEvents} Pending Event{(o?.pendingEvents || 0) > 1 ? "s" : ""}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              )}
              {(o?.unverifiedBusinesses || 0) > 0 && (
                <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100 rounded-xl gap-2" onClick={() => onSwitchTab("businesses")} data-testid="link-unverified-businesses">
                  <Building2 className="h-4 w-4" />
                  {o?.unverifiedBusinesses} Unverified Business{(o?.unverifiedBusinesses || 0) > 1 ? "es" : ""}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
              {(o?.pendingCategories || 0) > 0 && (
                <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100 rounded-xl gap-2">
                  <Layers className="h-4 w-4" />
                  {o?.pendingCategories} Category Request{(o?.pendingCategories || 0) > 1 ? "s" : ""}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue & Subscriptions Breakdown */}
      <div className="space-y-4" data-testid="section-revenue-breakdown">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1a1a2e]">Revenue & Subscriptions</h3>
            <p className="text-xs text-slate-500">Monthly recurring revenue breakdown</p>
          </div>
        </div>

        {/* Revenue Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 border-0 rounded-2xl shadow-lg" data-testid="card-total-mrr">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-white/80" />
                <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Realized MRR</span>
              </div>
              <p className="text-2xl font-bold text-white" data-testid="text-realized-mrr">{formatCents(realizedMrr)}</p>
              <p className="text-xs text-white/70 mt-1">Actually billing now · Annual: {formatCents(realizedAnnual)}</p>
              <div className="mt-2 pt-2 border-t border-white/20">
                <p className="text-[11px] text-white/80">
                  <span className="font-semibold">Projected: </span>
                  <span data-testid="text-projected-mrr">{formatCents(projectedMrr)}/mo</span>
                  <span className="text-white/60"> · {formatCents(projectedAnnual)}/yr</span>
                </p>
                {trialingCount > 0 && (
                  <p className="text-[10px] text-white/60 mt-0.5">{trialingCount} on free trial (not yet billing)</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0" data-testid="card-subscription-revenue">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="h-4 w-4 text-[#0a4a82]" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subscriptions</span>
              </div>
              <p className="text-2xl font-bold text-[#1a1a2e]">{formatCents(subsRealized?.total || 0)}</p>
              <p className="text-xs text-slate-400 mt-1">{(subsRealized?.bronze?.count || 0) + (subsRealized?.silver?.count || 0) + (subsRealized?.gold?.count || 0)} billing now</p>
              <p className="text-[11px] text-slate-500 mt-1">Projected: <span className="font-semibold text-slate-700">{formatCents(subsProjected?.total || 0)}/mo</span></p>
            </CardContent>
          </Card>
          <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0" data-testid="card-ad-revenue">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Megaphone className="h-4 w-4 text-rose-500" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ad Revenue</span>
              </div>
              <p className="text-2xl font-bold text-[#1a1a2e]">{formatCents(adsRealized?.total || 0)}</p>
              <p className="text-xs text-slate-400 mt-1">{(adsRealized?.small?.count || 0) + (adsRealized?.medium?.count || 0) + (adsRealized?.large?.count || 0)} paid · {unpaidActiveAds} comped</p>
              <p className="text-[11px] text-slate-500 mt-1">Projected: <span className="font-semibold text-slate-700">{formatCents(adsProjected?.total || 0)}/mo</span></p>
            </CardContent>
          </Card>
          <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0" data-testid="card-job-revenue">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Job Listings</span>
              </div>
              <p className="text-2xl font-bold text-[#1a1a2e]">{formatCents(rev?.jobs?.totalEstimated || 0)}</p>
              <p className="text-xs text-slate-400 mt-1">{rev?.jobs?.activeJobs || 0} active postings</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Breakdowns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Subscription Breakdown */}
          <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0" data-testid="card-subscription-breakdown">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[#1a1a2e] text-sm font-semibold">
                <Crown className="h-4 w-4 text-yellow-500" />
                Subscription Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 px-1 pb-1 text-[10px] font-semibold text-slate-400 uppercase">
                <span>Tier</span>
                <span className="text-right">Realized</span>
                <span className="text-right">Projected</span>
              </div>
              <div className="grid grid-cols-3 items-center gap-2 py-2 px-3 rounded-xl bg-yellow-50 border border-yellow-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm font-medium text-[#1a1a2e]">Gold</span>
                </div>
                <div className="text-right">
                  <Badge className="bg-yellow-500 text-white text-[10px] px-1.5 mr-1">{subsRealized?.gold?.count || 0}</Badge>
                  <span className="text-xs font-semibold text-[#1a1a2e]">{formatCents(subsRealized?.gold?.monthly || 0)}</span>
                </div>
                <div className="text-right">
                  <Badge className="bg-yellow-200 text-yellow-900 text-[10px] px-1.5 mr-1">{subsProjected?.gold?.count || 0}</Badge>
                  <span className="text-xs font-semibold text-slate-600">{formatCents(subsProjected?.gold?.monthly || 0)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 items-center gap-2 py-2 px-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-400" />
                  <span className="text-sm font-medium text-[#1a1a2e]">Silver</span>
                </div>
                <div className="text-right">
                  <Badge className="bg-slate-400 text-white text-[10px] px-1.5 mr-1">{subsRealized?.silver?.count || 0}</Badge>
                  <span className="text-xs font-semibold text-[#1a1a2e]">{formatCents(subsRealized?.silver?.monthly || 0)}</span>
                </div>
                <div className="text-right">
                  <Badge className="bg-slate-200 text-slate-700 text-[10px] px-1.5 mr-1">{subsProjected?.silver?.count || 0}</Badge>
                  <span className="text-xs font-semibold text-slate-600">{formatCents(subsProjected?.silver?.monthly || 0)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 items-center gap-2 py-2 px-3 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-700" />
                  <span className="text-sm font-medium text-[#1a1a2e]">Bronze</span>
                </div>
                <div className="text-right">
                  <Badge className="bg-amber-700 text-white text-[10px] px-1.5 mr-1">{subsRealized?.bronze?.count || 0}</Badge>
                  <span className="text-xs font-semibold text-[#1a1a2e]">{formatCents(subsRealized?.bronze?.monthly || 0)}</span>
                </div>
                <div className="text-right">
                  <Badge className="bg-amber-200 text-amber-900 text-[10px] px-1.5 mr-1">{subsProjected?.bronze?.count || 0}</Badge>
                  <span className="text-xs font-semibold text-slate-600">{formatCents(subsProjected?.bronze?.monthly || 0)}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">Subscription MRR</span>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600">{formatCents(subsRealized?.total || 0)}</div>
                  <div className="text-[11px] text-slate-500">Projected: {formatCents(subsProjected?.total || 0)}</div>
                </div>
              </div>
              {trialingCount > 0 && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                  {trialingCount} subscriber{trialingCount > 1 ? "s" : ""} on free trial — counted in projected only.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Ad Revenue Breakdown */}
          <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0" data-testid="card-ad-breakdown">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[#1a1a2e] text-sm font-semibold">
                <Megaphone className="h-4 w-4 text-rose-500" />
                Advertising Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 px-1 pb-1 text-[10px] font-semibold text-slate-400 uppercase">
                <span>Size</span>
                <span className="text-right">Realized</span>
                <span className="text-right">Projected</span>
              </div>
              <div className="grid grid-cols-3 items-center gap-2 py-2 px-3 rounded-xl bg-rose-50 border border-rose-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-sm font-medium text-[#1a1a2e]">Large</span>
                </div>
                <div className="text-right">
                  <Badge className="bg-rose-500 text-white text-[10px] px-1.5 mr-1">{adsRealized?.large?.count || 0}</Badge>
                  <span className="text-xs font-semibold text-[#1a1a2e]">{formatCents(adsRealized?.large?.revenue || 0)}</span>
                </div>
                <div className="text-right">
                  <Badge className="bg-rose-200 text-rose-900 text-[10px] px-1.5 mr-1">{adsProjected?.large?.count || 0}</Badge>
                  <span className="text-xs font-semibold text-slate-600">{formatCents(adsProjected?.large?.revenue || 0)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 items-center gap-2 py-2 px-3 rounded-xl bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#0a4a82]" />
                  <span className="text-sm font-medium text-[#1a1a2e]">Medium</span>
                </div>
                <div className="text-right">
                  <Badge className="bg-[#0a4a82] text-white text-[10px] px-1.5 mr-1">{adsRealized?.medium?.count || 0}</Badge>
                  <span className="text-xs font-semibold text-[#1a1a2e]">{formatCents(adsRealized?.medium?.revenue || 0)}</span>
                </div>
                <div className="text-right">
                  <Badge className="bg-blue-200 text-blue-900 text-[10px] px-1.5 mr-1">{adsProjected?.medium?.count || 0}</Badge>
                  <span className="text-xs font-semibold text-slate-600">{formatCents(adsProjected?.medium?.revenue || 0)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 items-center gap-2 py-2 px-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500" />
                  <span className="text-sm font-medium text-[#1a1a2e]">Small</span>
                </div>
                <div className="text-right">
                  <Badge className="bg-gray-500 text-white text-[10px] px-1.5 mr-1">{adsRealized?.small?.count || 0}</Badge>
                  <span className="text-xs font-semibold text-[#1a1a2e]">{formatCents(adsRealized?.small?.revenue || 0)}</span>
                </div>
                <div className="text-right">
                  <Badge className="bg-gray-200 text-gray-700 text-[10px] px-1.5 mr-1">{adsProjected?.small?.count || 0}</Badge>
                  <span className="text-xs font-semibold text-slate-600">{formatCents(adsProjected?.small?.revenue || 0)}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">Ad MRR</span>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600">{formatCents(adsRealized?.total || 0)}</div>
                  <div className="text-[11px] text-slate-500">Projected: {formatCents(adsProjected?.total || 0)}</div>
                </div>
              </div>
              {unpaidActiveAds > 0 && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                  {unpaidActiveAds} active ad{unpaidActiveAds > 1 ? "s" : ""} not paid (comped/trial) — counted in projected only.
                </p>
              )}
              {(rev?.ads?.totalPaid || 0) > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Lifetime ad payments collected</span>
                  <span className="font-semibold text-slate-600">{formatCents(rev?.ads?.totalPaid || 0)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Job Listings Revenue */}
          <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0" data-testid="card-job-breakdown">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[#1a1a2e] text-sm font-semibold">
                <Briefcase className="h-4 w-4 text-amber-500" />
                Job Board Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-[#1a1a2e]">Active Job Posts</span>
                </div>
                <span className="text-lg font-bold text-[#1a1a2e]">{rev?.jobs?.activeJobs || 0}</span>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
                <p className="text-xs text-amber-700 font-semibold uppercase tracking-wider mb-1">Est. Monthly Revenue</p>
                <p className="text-2xl font-bold text-[#1a1a2e]">{formatCents(rev?.jobs?.totalEstimated || 0)}</p>
                <p className="text-xs text-slate-400 mt-1">Based on tier-specific weekly pricing</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 mb-2">Weekly Pricing by Tier</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-600 font-medium">Gold</span>
                    <span className="font-semibold">$10/wk</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Silver</span>
                    <span className="font-semibold">$15/wk</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-700 font-medium">Bronze</span>
                    <span className="font-semibold">$18/wk</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-medium">Basic</span>
                    <span className="font-semibold">$20/wk</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[#1a1a2e] text-lg">
              <BarChart3 className="h-5 w-5 text-[#0a4a82]" />
              Membership Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MembershipRow label="Gold" count={mb["premium"] || 0} total={o?.totalBusinesses || 1} icon={Crown} barColor="bg-yellow-500" />
            <MembershipRow label="Silver" count={mb["standard"] || 0} total={o?.totalBusinesses || 1} icon={Star} barColor="bg-slate-400" />
            <MembershipRow label="Bronze" count={mb["basic"] || 0} total={o?.totalBusinesses || 1} icon={Medal} barColor="bg-amber-700" />
            <MembershipRow label="No Plan" count={mb["none"] || 0} total={o?.totalBusinesses || 1} icon={Users} barColor="bg-gray-300" />
            {(o?.downgradesCount || 0) > 0 && (
              <div className="pt-2 border-t border-gray-100 flex items-center gap-2 text-sm text-red-500">
                <ArrowDown className="h-4 w-4" />
                {o?.downgradesCount} downgrade{(o?.downgradesCount || 0) > 1 ? "s" : ""} recorded
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[#1a1a2e] text-lg">
              <Users className="h-5 w-5 text-[#0a4a82]" />
              Recent Signups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {stats?.recentUsers?.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${u.accountType === "business" ? "bg-purple-500" : "bg-[#0a4a82]"}`}>
                      {u.firstName?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1a1a2e] truncate">
                        {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email || "Unknown"}
                      </p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-xs ${u.accountType === "business" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
                      {u.accountType || "customer"}
                    </Badge>
                    {u.createdAt && <span className="text-xs text-slate-400">{formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}</span>}
                  </div>
                </div>
              ))}
              {(!stats?.recentUsers || stats.recentUsers.length === 0) && <p className="text-sm text-slate-400 text-center py-8">No users yet</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-[#1a1a2e] text-lg">
                <MessageSquare className="h-5 w-5 text-teal-600" />
                Recent Quote Requests
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {stats?.recentQuoteRequests?.map((qr) => (
                <div key={qr.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1a1a2e] truncate">{qr.title}</p>
                    {qr.createdAt && <p className="text-xs text-slate-400">{formatDistanceToNow(new Date(qr.createdAt), { addSuffix: true })}</p>}
                  </div>
                  {statusBadge(qr.status)}
                </div>
              ))}
              {(!stats?.recentQuoteRequests || stats.recentQuoteRequests.length === 0) && <p className="text-sm text-slate-400 text-center py-8">No quote requests yet</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-[#1a1a2e] text-lg">
                <Megaphone className="h-5 w-5 text-rose-500" />
                Recent Ads
              </CardTitle>
              <Link to="/admin/ads">
                <Button variant="ghost" size="sm" className="text-[#0a4a82] text-xs gap-1">Manage <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {stats?.recentAds?.map((ad) => (
                <div key={ad.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1a1a2e] truncate">{ad.title || `Ad #${ad.id}`}</p>
                    <p className="text-xs text-slate-400">{ad.placement?.replace(/_/g, " ") || "unknown"}</p>
                  </div>
                  {statusBadge(ad.status)}
                </div>
              ))}
              {(!stats?.recentAds || stats.recentAds.length === 0) && <p className="text-sm text-slate-400 text-center py-8">No ads yet</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/admin/ads" data-testid="link-admin-manage-ads">
          <QuickActionCard icon={Megaphone} label="Manage Ads" sub="Review & approve" color="bg-rose-500/10" iconColor="text-rose-500" />
        </Link>
        <Link to="/admin/events" data-testid="link-admin-manage-events">
          <QuickActionCard icon={Calendar} label="Event Moderation" sub="Review & approve" color="bg-green-500/10" iconColor="text-green-500" />
        </Link>
        <Link to="/admin/promo-codes" data-testid="link-admin-manage-promos">
          <QuickActionCard icon={Tag} label="Promo Codes" sub="Create & track" color="bg-emerald-500/10" iconColor="text-emerald-500" />
        </Link>
        <Link to="/directory" data-testid="link-admin-view-directory">
          <QuickActionCard icon={Building2} label="Directory" sub="All business listings" color="bg-purple-500/10" iconColor="text-purple-500" />
        </Link>
        <Link to="/events" data-testid="link-admin-manage-events">
          <QuickActionCard icon={Calendar} label="Events" sub="Community calendar" color="bg-amber-500/10" iconColor="text-amber-500" />
        </Link>
        <Link to="/admin/ai-lab" data-testid="link-admin-ai-lab">
          <QuickActionCard icon={Star} label="AI Lab" sub="Pre-release sandbox" color="bg-[#d4a373]/10" iconColor="text-[#d4a373]" />
        </Link>
      </div>
    </div>
  );
}

function UsersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [resetDialog, setResetDialog] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<AdminUser | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [editUserDialog, setEditUserDialog] = useState<AdminUser | null>(null);
  const [editUserFirstName, setEditUserFirstName] = useState("");
  const [editUserLastName, setEditUserLastName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserAccountType, setEditUserAccountType] = useState("customer");

  const { data, isLoading, isError, refetch } = useQuery<{ users: AdminUser[]; total: number; page: number; pages: number }>({
    queryKey: ["/api/admin/users", search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/users?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      await apiRequest("POST", `/api/admin/users/${userId}/reset-password`, { newPassword: password });
    },
    onSuccess: () => {
      toast({ title: "Password Reset", description: "The user's password has been updated." });
      setResetDialog(null);
      setNewPassword("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      toast({ title: "User Deleted", description: "The account has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeleteDialog(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleValidatedMutation = useMutation({
    mutationFn: async ({ userId, isValidated }: { userId: string; isValidated: boolean }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}`, { isValidated });
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Validation status changed." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, body }: { userId: string; body: any }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}`, body);
    },
    onSuccess: () => {
      toast({ title: "User Updated", description: "Account details saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditUserDialog(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEditUser = (u: AdminUser) => {
    setEditUserDialog(u);
    setEditUserFirstName(u.firstName || "");
    setEditUserLastName(u.lastName || "");
    setEditUserEmail(u.email || "");
    setEditUserAccountType(u.accountType === "admin" ? "admin" : (u.accountType || "customer"));
  };

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10 bg-white rounded-xl border-slate-200"
            style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
            data-testid="input-search-users"
          />
        </div>
        <Button onClick={handleSearch} className="bg-[#0a4a82] hover:bg-[#083a6a] text-white rounded-xl" data-testid="button-search-users">
          Search
        </Button>
        {search && (
          <Button variant="ghost" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }} className="text-slate-500 rounded-xl">
            Clear
          </Button>
        )}
      </div>

      {isError && (
        <Card className="bg-red-50 border-red-200 rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Failed to load users. Please try again.</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="border-red-300 text-red-700 hover:bg-red-100 rounded-xl">Retry</Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left p-4 font-semibold text-slate-600">User</th>
                  <th className="text-left p-4 font-semibold text-slate-600">Type</th>
                  <th className="text-left p-4 font-semibold text-slate-600">Auth</th>
                  <th className="text-left p-4 font-semibold text-slate-600">Status</th>
                  <th className="text-left p-4 font-semibold text-slate-600">Joined</th>
                  <th className="text-right p-4 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td colSpan={6} className="p-4"><Skeleton className="h-8 w-full" /></td>
                    </tr>
                  ))
                ) : data?.users?.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors" data-testid={`row-user-${u.id}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${u.accountType === "business" ? "bg-purple-500" : "bg-[#0a4a82]"}`}>
                          {u.firstName?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[#1a1a2e] truncate">
                            {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email || "Unknown"}
                          </p>
                          <p className="text-xs text-slate-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge className={`text-xs ${u.accountType === "business" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
                        {u.accountType || "customer"}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge className={`text-xs ${u.googleId ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-700"}`}>
                        {u.googleId ? "Google" : "Email"}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        {u.accountType === "admin" && <Badge className="bg-red-100 text-red-800 text-xs">Admin</Badge>}
                        {u.isValidated ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">Verified</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-500 text-xs">Unverified</Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                      {u.createdAt ? format(new Date(u.createdAt), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-[#0a4a82] hover:text-[#083a6a] hover:bg-blue-50"
                          title="View Details"
                          onClick={() => setDetailUserId(u.id)}
                          data-testid={`button-view-user-${u.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-[#0a4a82] hover:text-[#083a6a] hover:bg-blue-50"
                          title="Edit Account"
                          onClick={() => openEditUser(u)}
                          data-testid={`button-edit-user-${u.id}`}
                        >
                          <UserCog className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                          title="Reset Password"
                          onClick={() => { setResetDialog(u); setNewPassword(""); }}
                          data-testid={`button-reset-pw-${u.id}`}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 w-8 p-0 ${u.isValidated ? "text-green-500 hover:text-green-700 hover:bg-green-50" : "text-gray-400 hover:text-green-600 hover:bg-green-50"}`}
                          title={u.isValidated ? "Revoke Verification" : "Verify User"}
                          onClick={() => toggleValidatedMutation.mutate({ userId: u.id, isValidated: !u.isValidated })}
                          data-testid={`button-verify-${u.id}`}
                        >
                          <BadgeCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete User"
                          onClick={() => setDeleteDialog(u)}
                          data-testid={`button-delete-user-${u.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-100">
              <p className="text-sm text-slate-400">{data.total} users total · Page {data.page} of {data.pages}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg gap-1">
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="rounded-lg gap-1">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editUserDialog} onOpenChange={(open) => !open && setEditUserDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-[#0a4a82]" />
              Edit Account
            </DialogTitle>
            <DialogDescription>
              Update the user's name, email, or account type. Changes are saved to their account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-user-first">First Name</Label>
                <Input
                  id="edit-user-first"
                  value={editUserFirstName}
                  onChange={(e) => setEditUserFirstName(e.target.value)}
                  className="bg-white rounded-xl"
                  style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                  data-testid="input-edit-user-first"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-last">Last Name</Label>
                <Input
                  id="edit-user-last"
                  value={editUserLastName}
                  onChange={(e) => setEditUserLastName(e.target.value)}
                  className="bg-white rounded-xl"
                  style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                  data-testid="input-edit-user-last"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-user-email">Email</Label>
              <Input
                id="edit-user-email"
                type="email"
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
                className="bg-white rounded-xl"
                style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                data-testid="input-edit-user-email"
              />
              {editUserDialog?.googleId && (
                <p className="text-[11px] text-amber-600">
                  Heads up: this account signed in with Google. Changing the email here will not change their Google login — they'll still need to use their original Google account to sign in.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select value={editUserAccountType} onValueChange={setEditUserAccountType}>
                <SelectTrigger className="bg-white rounded-xl" data-testid="select-edit-user-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  {editUserDialog?.accountType === "admin" && (
                    <SelectItem value="admin" disabled>Admin (cannot change)</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {editUserDialog?.accountType === "admin" && (
                <p className="text-[11px] text-slate-400">Admin role cannot be changed from this screen.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserDialog(null)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={() => {
                if (!editUserDialog) return;
                const body: any = {
                  firstName: editUserFirstName,
                  lastName: editUserLastName,
                  email: editUserEmail,
                };
                if (editUserDialog.accountType !== "admin") {
                  body.accountType = editUserAccountType;
                }
                updateUserMutation.mutate({ userId: editUserDialog.id, body });
              }}
              disabled={updateUserMutation.isPending}
              className="bg-[#0a4a82] hover:bg-[#083a6a] text-white rounded-xl"
              data-testid="button-save-user"
            >
              {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetDialog} onOpenChange={(open) => !open && setResetDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#0a4a82]" />
              Reset Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Resetting password for <span className="font-semibold text-[#1a1a2e]">{resetDialog?.email}</span>
            </p>
            {resetDialog?.googleId && (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                This user signed in with Google. Setting a password will switch them to email/password login.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-pw">New Password</Label>
              <Input
                id="new-pw"
                type="text"
                placeholder="Enter new password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-white rounded-xl"
                style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                data-testid="input-new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog(null)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={() => resetDialog && resetPasswordMutation.mutate({ userId: resetDialog.id, password: newPassword })}
              disabled={newPassword.length < 6 || resetPasswordMutation.isPending}
              className="bg-[#0a4a82] hover:bg-[#083a6a] text-white rounded-xl"
              data-testid="button-confirm-reset"
            >
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete User
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">
            Are you sure you want to permanently delete <span className="font-semibold text-[#1a1a2e]">{deleteDialog?.email}</span>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)} className="rounded-xl">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialog && deleteUserMutation.mutate(deleteDialog.id)}
              disabled={deleteUserMutation.isPending}
              className="rounded-xl"
              data-testid="button-confirm-delete"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserDetailsDialog userId={detailUserId} onClose={() => setDetailUserId(null)} />
    </div>
  );
}

function UserDetailsDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { data, isLoading } = useQuery<{ user: any; linkedBusiness: any }>({
    queryKey: ["/api/admin/users", userId, "details"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/details`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load details");
      return res.json();
    },
    enabled: !!userId,
  });

  const u = data?.user;
  const biz = data?.linkedBusiness;

  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-[#0a4a82]" />
            User Details
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        ) : u ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white ${u.accountType === "business" ? "bg-purple-500" : "bg-[#0a4a82]"}`}>
                {u.firstName?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1a1a2e]">
                  {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email || "Unknown"}
                </h3>
                <p className="text-sm text-slate-400">{u.email}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge className={`text-xs ${u.accountType === "business" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
                    {u.accountType || "customer"}
                  </Badge>
                  {u.accountType === "admin" && <Badge className="bg-red-100 text-red-800 text-xs">Admin</Badge>}
                  {u.isValidated ? (
                    <Badge className="bg-green-100 text-green-800 text-xs">Verified</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-500 text-xs">Unverified</Badge>
                  )}
                  <Badge className={`text-xs ${u.googleId ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-700"}`}>
                    {u.googleId ? "Google Auth" : "Email Auth"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DetailField label="User ID" value={u.id} mono />
              <DetailField label="Account Type" value={u.accountType || "customer"} />
              <DetailField label="Joined" value={u.createdAt ? format(new Date(u.createdAt), "MMM d, yyyy h:mm a") : "—"} />
              <DetailField label="Last Updated" value={u.updatedAt ? format(new Date(u.updatedAt), "MMM d, yyyy h:mm a") : "—"} />
              <DetailField label="Member Since" value={u.memberSince ? format(new Date(u.memberSince), "MMM d, yyyy") : "—"} />
              <DetailField label="Loyalty Tier" value={u.loyaltyTier || "member"} />
              <DetailField label="Loyalty Points" value={u.loyaltyPoints?.toLocaleString() || "0"} />
              <DetailField label="Customer Rating" value={u.customerRating ? `${u.customerRating}/5.0` : "5.0/5.0"} />
              <DetailField label="Projects Completed" value={u.projectsCompleted?.toString() || "0"} />
              <DetailField label="Total Spent" value={`$${parseFloat(u.totalSpent || "0").toFixed(2)}`} />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Community Engagement</p>
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="Posts" value={u.postCount?.toString() || "0"} />
                <DetailField label="Comments" value={u.commentCount?.toString() || "0"} />
                <DetailField label="Likes Received" value={u.likesReceived?.toString() || "0"} />
                <DetailField label="Badge" value={u.engagementBadge?.replace(/_/g, " ") || "None"} />
              </div>
            </div>

            {biz && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Linked Business</p>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Link to={`/directory/${biz.id}`} className="font-medium text-[#0a4a82] hover:underline">
                        {biz.name}
                      </Link>
                      <p className="text-xs text-slate-400 mt-0.5">{biz.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${tierColor(biz.membershipTier)}`}>{tierLabel(biz.membershipTier)}</Badge>
                      {biz.verified ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-300" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-4">User not found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-sm text-[#1a1a2e] mt-0.5 ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</p>
    </div>
  );
}

function BusinessesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [editDialog, setEditDialog] = useState<AdminBusiness | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [verifyDialog, setVerifyDialog] = useState<AdminBusiness | null>(null);
  const [docReviewNote, setDocReviewNote] = useState("");
  const [deleteBizDialog, setDeleteBizDialog] = useState<AdminBusiness | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{ businesses: AdminBusiness[]; total: number; page: number; pages: number }>({
    queryKey: ["/api/admin/businesses", search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/businesses?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load businesses");
      return res.json();
    },
  });

  const updateBizMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      await apiRequest("PATCH", `/api/admin/businesses/${id}`, body);
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Business updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setEditDialog(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Load full business data when the edit dialog opens
  const editFullQuery = useQuery<any>({
    queryKey: ["/api/admin/businesses", editDialog?.id, "full"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${editDialog!.id}/full`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load business details");
      return res.json();
    },
    enabled: !!editDialog,
  });

  useEffect(() => {
    if (editFullQuery.data) {
      setEditForm({
        name: editFullQuery.data.name || "",
        description: editFullQuery.data.description || "",
        category: editFullQuery.data.category || "",
        address: editFullQuery.data.address || "",
        city: editFullQuery.data.city || "",
        state: editFullQuery.data.state || "",
        zipCode: editFullQuery.data.zipCode || "",
        phone: editFullQuery.data.phone || "",
        email: editFullQuery.data.email || "",
        websiteUrl: editFullQuery.data.websiteUrl || "",
        ownerName: editFullQuery.data.ownerName || "",
        imageUrl: editFullQuery.data.imageUrl || "",
        logoUrl: editFullQuery.data.logoUrl || "",
        searchKeywords: editFullQuery.data.searchKeywords || "",
        localOperationDescription: editFullQuery.data.localOperationDescription || "",
        establishedYear: editFullQuery.data.establishedYear ?? "",
        establishedZipCode: editFullQuery.data.establishedZipCode || "",
        membershipTier: editFullQuery.data.membershipTier && editFullQuery.data.membershipTier !== "none" ? editFullQuery.data.membershipTier : "basic",
        verified: !!editFullQuery.data.verified,
        hasLLC: !!editFullQuery.data.hasLLC,
        hasInsurance: !!editFullQuery.data.hasInsurance,
        isLicensed: !!editFullQuery.data.isLicensed,
        isVeteran: !!editFullQuery.data.isVeteran,
        servicesCommercial: !!editFullQuery.data.servicesCommercial,
        servicesResidential: !!editFullQuery.data.servicesResidential,
        acceptsQuotes: editFullQuery.data.acceptsQuotes !== false,
      });
    }
  }, [editFullQuery.data]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const verificationQuery = useQuery<{
    business: any;
    checks: Array<{ id: number; checkType: string; status: string; result: string; details: string; checkedAt: string }>;
    documents: Array<{ id: number; documentType: string; fileName: string; fileUrl: string; status: string; adminNote: string | null; uploadedAt: string; reviewedAt: string | null }>;
  }>({
    queryKey: ["/api/admin/businesses", verifyDialog?.id, "verification"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${verifyDialog!.id}/verification`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load verification data");
      return res.json();
    },
    enabled: !!verifyDialog,
  });

  const triggerSosCheck = useMutation({
    mutationFn: async (businessId: number) => {
      await apiRequest("POST", `/api/businesses/${businessId}/verify-sos`);
    },
    onSuccess: () => {
      toast({ title: "SOS Check", description: "NC Secretary of State check completed." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", verifyDialog?.id, "verification"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateDocMutation = useMutation({
    mutationFn: async ({ docId, status, adminNote }: { docId: number; status: string; adminNote?: string }) => {
      await apiRequest("PATCH", `/api/admin/verification-documents/${docId}`, { status, adminNote });
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Document status updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", verifyDialog?.id, "verification"] });
      setDocReviewNote("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteBizMutation = useMutation({
    mutationFn: async (businessId: number) => {
      await apiRequest("DELETE", `/api/admin/businesses/${businessId}`);
    },
    onSuccess: () => {
      toast({ title: "Business Deleted", description: "The business listing has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeleteBizDialog(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const syncStripeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/businesses/sync-stripe-tiers", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      const changedRows = (data.results || []).filter((r: any) => r.changed);
      const summary = changedRows.length === 0
        ? "All businesses are already in sync with Stripe."
        : changedRows.map((r: any) => `${r.name}: ${r.note}`).join("\n");
      toast({
        title: `Synced ${data.changed} of ${data.total} businesses`,
        description: summary.slice(0, 400),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
    },
    onError: (err: Error) => toast({ title: "Sync failed", description: err.message, variant: "destructive" }),
  });

  const openEdit = (b: AdminBusiness) => {
    setEditDialog(b);
    setEditTier(b.membershipTier && b.membershipTier !== "none" ? b.membershipTier : "basic");
    setEditVerified(b.verified ?? false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by business name, email, or phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10 bg-white rounded-xl border-slate-200"
            style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
            data-testid="input-search-businesses"
          />
        </div>
        <Button onClick={handleSearch} className="bg-[#0a4a82] hover:bg-[#083a6a] text-white rounded-xl" data-testid="button-search-businesses">
          Search
        </Button>
        {search && (
          <Button variant="ghost" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }} className="text-slate-500 rounded-xl">
            Clear
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="outline"
          onClick={() => syncStripeMutation.mutate()}
          disabled={syncStripeMutation.isPending}
          className="rounded-xl border-[#d4a373] text-[#0a4a82] hover:bg-[#fdf6ee] gap-2"
          data-testid="button-sync-stripe-tiers"
          title="Re-read every business's tier and trial state from Stripe and update the database"
        >
          {syncStripeMutation.isPending ? "Syncing…" : "Sync from Stripe"}
        </Button>
      </div>

      {isError && (
        <Card className="bg-red-50 border-red-200 rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Failed to load businesses. Please try again.</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="border-red-300 text-red-700 hover:bg-red-100 rounded-xl">Retry</Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left p-4 font-semibold text-slate-600">Business</th>
                  <th className="text-left p-4 font-semibold text-slate-600">Contact</th>
                  <th className="text-left p-4 font-semibold text-slate-600">Membership</th>
                  <th className="text-left p-4 font-semibold text-slate-600">Status</th>
                  <th className="text-left p-4 font-semibold text-slate-600">Quotes</th>
                  <th className="text-left p-4 font-semibold text-slate-600">Created</th>
                  <th className="text-right p-4 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td colSpan={7} className="p-4"><Skeleton className="h-8 w-full" /></td>
                    </tr>
                  ))
                ) : data?.businesses?.map((b) => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors" data-testid={`row-biz-${b.id}`}>
                    <td className="p-4">
                      <div className="min-w-0">
                        <Link to={`/directory/${b.id}`} className="font-medium text-[#0a4a82] hover:underline truncate block">{b.name}</Link>
                        <p className="text-xs text-slate-400">{b.zipCode || "—"}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-0.5">
                        {b.email && <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="h-3 w-3" />{b.email}</p>}
                        {b.phone && <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" />{b.phone}</p>}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge className={`text-xs ${tierColor(b.membershipTier)}`} data-testid={`badge-tier-${b.id}`}>{tierLabel(b.membershipTier)}</Badge>
                      {b.goldTrialEndDate && b.originalMembershipTier && b.originalMembershipTier !== b.membershipTier && (
                        <p className="text-[10px] text-amber-700 mt-1 font-medium" data-testid={`text-trial-${b.id}`}>
                          Gold trial · signed up: {tierLabel(b.originalMembershipTier)}
                          <br />
                          ends {format(new Date(b.goldTrialEndDate), "MMM d, yyyy")}
                        </p>
                      )}
                      {b.membershipEndDate && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          exp {format(new Date(b.membershipEndDate), "MMM d")}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      {b.verified ? (
                        <Badge className="bg-green-100 text-green-800 text-xs">Verified</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-500 text-xs">Unverified</Badge>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge className={`text-xs ${b.acceptsQuotes !== false ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                        {b.acceptsQuotes !== false ? "Opted In" : "Opted Out"}
                      </Badge>
                    </td>
                    <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                      {b.createdAt ? format(new Date(b.createdAt), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        {!b.verified && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-green-600 hover:bg-green-50 rounded-lg gap-1"
                            onClick={() => updateBizMutation.mutate({ id: b.id, membershipTier: b.membershipTier || "none", verified: true })}
                            disabled={updateBizMutation.isPending}
                            data-testid={`button-verify-biz-${b.id}`}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Verify
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-amber-600 hover:bg-amber-50 rounded-lg gap-1"
                          onClick={() => setVerifyDialog(b)}
                          data-testid={`button-review-biz-${b.id}`}
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          Review
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-[#0a4a82] hover:bg-blue-50 rounded-lg gap-1"
                          onClick={() => openEdit(b)}
                          data-testid={`button-edit-biz-${b.id}`}
                        >
                          <UserCog className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-red-600 hover:bg-red-50 rounded-lg gap-1"
                          onClick={() => setDeleteBizDialog(b)}
                          title="Delete Business"
                          data-testid={`button-delete-biz-${b.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-100">
              <p className="text-sm text-slate-400">{data.total} businesses total · Page {data.page} of {data.pages}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg gap-1">
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="rounded-lg gap-1">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editDialog} onOpenChange={(open) => { if (!open) { setEditDialog(null); setEditForm({}); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#0a4a82]" />
              Edit Business — {editDialog?.name}
            </DialogTitle>
            <DialogDescription>
              Update any field on this business listing on behalf of the owner. Stripe billing fields and trial dates are not editable here — use Sync from Stripe instead.
            </DialogDescription>
          </DialogHeader>

          {editFullQuery.isLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {/* Basic Info */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-[#0a4a82] flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Basic Info
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="biz-name">Business Name</Label>
                    <Input id="biz-name" value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-name" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="biz-desc">Description</Label>
                    <Textarea id="biz-desc" value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="bg-white rounded-xl min-h-[80px]" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-desc" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="biz-cat">Primary Category</Label>
                    <Input id="biz-cat" value={editForm.category || ""} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-cat" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="biz-owner">Owner Name</Label>
                    <Input id="biz-owner" value={editForm.ownerName || ""} onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-owner" />
                  </div>
                </div>
              </section>

              {/* Address */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-[#0a4a82] flex items-center gap-2">
                  <Search className="h-4 w-4" /> Address
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-4 space-y-2">
                    <Label htmlFor="biz-addr">Street Address</Label>
                    <Input id="biz-addr" value={editForm.address || ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-addr" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="biz-city">City</Label>
                    <Input id="biz-city" value={editForm.city || ""} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-city" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="biz-state">State</Label>
                    <Input id="biz-state" value={editForm.state || ""} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-state" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="biz-zip">ZIP</Label>
                    <Input id="biz-zip" value={editForm.zipCode || ""} onChange={(e) => setEditForm({ ...editForm, zipCode: e.target.value })} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-zip" />
                  </div>
                </div>
              </section>

              {/* Contact */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-[#0a4a82] flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Contact
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="biz-phone">Phone</Label>
                    <Input id="biz-phone" value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-phone" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="biz-email">Email</Label>
                    <Input id="biz-email" type="email" value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-email" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="biz-web">Website URL</Label>
                    <Input id="biz-web" value={editForm.websiteUrl || ""} onChange={(e) => setEditForm({ ...editForm, websiteUrl: e.target.value })} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-web" />
                  </div>
                </div>
              </section>

              {/* Media */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-[#0a4a82]">Media</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="biz-img">Cover Image URL</Label>
                    <Input id="biz-img" value={editForm.imageUrl || ""} onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-img" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="biz-logo">Logo URL</Label>
                    <Input id="biz-logo" value={editForm.logoUrl || ""} onChange={(e) => setEditForm({ ...editForm, logoUrl: e.target.value })} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-logo" />
                  </div>
                </div>
              </section>

              {/* Credentials */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-[#0a4a82] flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Credentials & Local Status
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="biz-est-year">Established Year</Label>
                    <Input id="biz-est-year" type="number" value={editForm.establishedYear ?? ""} onChange={(e) => setEditForm({ ...editForm, establishedYear: e.target.value })} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-est-year" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="biz-est-zip">Established ZIP</Label>
                    <Input id="biz-est-zip" value={editForm.establishedZipCode || ""} onChange={(e) => setEditForm({ ...editForm, establishedZipCode: e.target.value })} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-est-zip" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="biz-local">Local Operation Description</Label>
                    <Textarea id="biz-local" value={editForm.localOperationDescription || ""} onChange={(e) => setEditForm({ ...editForm, localOperationDescription: e.target.value })} className="bg-white rounded-xl min-h-[60px]" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-local" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="biz-keywords">Search Keywords (comma-separated, max 250 chars)</Label>
                    <Input id="biz-keywords" value={editForm.searchKeywords || ""} onChange={(e) => setEditForm({ ...editForm, searchKeywords: e.target.value })} maxLength={250} className="bg-white rounded-xl" style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }} data-testid="input-biz-keywords" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {([
                    ["hasLLC", "Has LLC"],
                    ["hasInsurance", "Has Insurance"],
                    ["isLicensed", "Licensed"],
                    ["isVeteran", "Veteran-Owned"],
                    ["servicesCommercial", "Services Commercial"],
                    ["servicesResidential", "Services Residential"],
                    ["acceptsQuotes", "Accepts Quote Requests"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!editForm[key]}
                        onChange={(e) => setEditForm({ ...editForm, [key]: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-[#0a4a82] cursor-pointer"
                        data-testid={`checkbox-biz-${key}`}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </section>

              {/* Membership & Verification */}
              <section className="space-y-3 pt-2 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-[#0a4a82]">Membership & Verification</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Membership Tier</Label>
                    <Select value={editForm.membershipTier || "basic"} onValueChange={(v) => setEditForm({ ...editForm, membershipTier: v })}>
                      <SelectTrigger className="bg-white rounded-xl" data-testid="select-biz-tier">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="basic">Bronze</SelectItem>
                        <SelectItem value="standard">Silver</SelectItem>
                        <SelectItem value="premium">Gold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer pb-2">
                      <input
                        type="checkbox"
                        checked={!!editForm.verified}
                        onChange={(e) => setEditForm({ ...editForm, verified: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-[#0a4a82] cursor-pointer"
                        data-testid="checkbox-biz-verified"
                      />
                      Verified Business
                    </label>
                  </div>
                </div>
              </section>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={() => editDialog && updateBizMutation.mutate({ id: editDialog.id, body: editForm })}
              disabled={updateBizMutation.isPending || editFullQuery.isLoading}
              className="bg-[#0a4a82] hover:bg-[#083a6a] text-white rounded-xl"
              data-testid="button-save-business"
            >
              {updateBizMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteBizDialog} onOpenChange={(open) => !open && setDeleteBizDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" />
              Delete Business
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteBizDialog?.name}</strong>? This will remove the business listing, all related data (reviews, quotes, jobs, ads, events), and cancel any active Stripe subscription. The owner's user account will remain but be unlinked. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteBizDialog(null)} className="rounded-xl" data-testid="button-cancel-delete-biz">Cancel</Button>
            <Button
              onClick={() => deleteBizDialog && deleteBizMutation.mutate(deleteBizDialog.id)}
              disabled={deleteBizMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
              data-testid="button-confirm-delete-biz"
            >
              {deleteBizMutation.isPending ? "Deleting..." : "Delete Business"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!verifyDialog} onOpenChange={(open) => !open && setVerifyDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-amber-600" />
              Verification Review — {verifyDialog?.name}
            </DialogTitle>
          </DialogHeader>

          {verificationQuery.isLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="text-xs text-gray-400 block">Claims LLC</span>
                  <span className={`font-medium ${verificationQuery.data?.business?.hasLLC ? "text-green-700" : "text-gray-500"}`}>
                    {verificationQuery.data?.business?.hasLLC ? "Yes" : "No"}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="text-xs text-gray-400 block">Claims Insurance</span>
                  <span className={`font-medium ${verificationQuery.data?.business?.hasInsurance ? "text-green-700" : "text-gray-500"}`}>
                    {verificationQuery.data?.business?.hasInsurance ? "Yes" : "No"}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="text-xs text-gray-400 block">Claims Licensed</span>
                  <span className={`font-medium ${verificationQuery.data?.business?.isLicensed ? "text-green-700" : "text-gray-500"}`}>
                    {verificationQuery.data?.business?.isLicensed ? "Yes" : "No"}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="text-xs text-gray-400 block">Claims Veteran</span>
                  <span className={`font-medium ${verificationQuery.data?.business?.isVeteran ? "text-green-700" : "text-gray-500"}`}>
                    {verificationQuery.data?.business?.isVeteran ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-[#0a4a82]" />
                    AI Verification Checks
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => verifyDialog && triggerSosCheck.mutate(verifyDialog.id)}
                    disabled={triggerSosCheck.isPending}
                    data-testid="button-run-sos-check"
                  >
                    {triggerSosCheck.isPending ? "Checking..." : "Run NC SOS Check"}
                  </Button>
                </div>

                {(!verificationQuery.data?.checks || verificationQuery.data.checks.length === 0) ? (
                  <div className="p-4 rounded-lg bg-gray-50 border border-dashed border-gray-200 text-center">
                    <p className="text-sm text-gray-400">No AI checks have been run yet</p>
                    <p className="text-xs text-gray-400 mt-1">Click "Run NC SOS Check" to verify LLC status</p>
                  </div>
                ) : (
                  verificationQuery.data.checks.map((check) => {
                    let details: any = {};
                    try { details = JSON.parse(check.details || "{}"); } catch {}
                    const statusColor = check.status === "verified" ? "bg-green-100 text-green-800" :
                                       check.status === "not_found" ? "bg-red-100 text-red-800" :
                                       check.status === "error" ? "bg-red-100 text-red-700" :
                                       "bg-amber-100 text-amber-800";
                    return (
                      <div key={check.id} className="p-3 rounded-lg border border-gray-200 bg-white space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium uppercase text-gray-500">
                            {check.checkType === "nc_sos" ? "NC Secretary of State" : check.checkType}
                          </span>
                          <Badge className={`text-xs ${statusColor}`}>
                            {check.status === "verified" ? "Match Found" :
                             check.status === "not_found" ? "Not Found" :
                             check.status === "error" ? "Error" : "Needs Review"}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-700">{check.result}</p>
                        {details.notes && (
                          <p className="text-xs text-gray-500 italic">{details.notes}</p>
                        )}
                        {details.likelyRegisteredName && (
                          <p className="text-xs text-gray-500">
                            Likely registered as: <span className="font-medium">{details.likelyRegisteredName}</span>
                          </p>
                        )}
                        {details.flags && details.flags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {details.flags.map((flag: string, i: number) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200">{flag}</span>
                            ))}
                          </div>
                        )}
                        {details.sosSearchUrl && (
                          <a href={details.sosSearchUrl} target="_blank" rel="noopener noreferrer"
                             className="text-xs text-[#0a4a82] flex items-center gap-1 hover:underline">
                            <ExternalLink className="h-3 w-3" /> Verify on sosnc.gov
                          </a>
                        )}
                        <p className="text-[10px] text-gray-400">
                          Checked {check.checkedAt ? format(new Date(check.checkedAt), "MMM d, yyyy h:mm a") : "N/A"}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Upload className="h-4 w-4 text-[#0a4a82]" />
                  Uploaded Documents
                </h4>

                {(!verificationQuery.data?.documents || verificationQuery.data.documents.length === 0) ? (
                  <div className="p-4 rounded-lg bg-gray-50 border border-dashed border-gray-200 text-center">
                    <p className="text-sm text-gray-400">No documents uploaded by business</p>
                  </div>
                ) : (
                  verificationQuery.data.documents.map((doc) => {
                    const typeLabels: Record<string, string> = {
                      insurance_certificate: "Insurance Certificate (COI)",
                      business_license: "Business License",
                      contractor_license: "Contractor License",
                      other: "Other Document",
                    };
                    const docStatusColor = doc.status === "approved" ? "bg-green-100 text-green-800" :
                                          doc.status === "rejected" ? "bg-red-100 text-red-800" :
                                          "bg-amber-100 text-amber-800";
                    return (
                      <div key={doc.id} className="p-3 rounded-lg border border-gray-200 bg-white space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            {typeLabels[doc.documentType] || doc.documentType}
                          </span>
                          <Badge className={`text-xs ${docStatusColor}`}>{doc.status}</Badge>
                        </div>
                        <p className="text-xs text-gray-500">{doc.fileName}</p>
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-[#0a4a82] flex items-center gap-1 hover:underline"
                           data-testid={`link-view-doc-${doc.id}`}>
                          <Eye className="h-3 w-3" /> View Document
                        </a>
                        {doc.adminNote && (
                          <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded italic">{doc.adminNote}</p>
                        )}
                        {doc.status === "pending" && (
                          <div className="space-y-2 pt-1">
                            <Textarea
                              placeholder="Admin note (optional)"
                              value={docReviewNote}
                              onChange={(e) => setDocReviewNote(e.target.value)}
                              className="text-xs h-16 bg-white"
                              style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                              data-testid={`input-doc-note-${doc.id}`}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1"
                                onClick={() => updateDocMutation.mutate({ docId: doc.id, status: "approved", adminNote: docReviewNote })}
                                disabled={updateDocMutation.isPending}
                                data-testid={`button-approve-doc-${doc.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50 text-xs gap-1"
                                onClick={() => updateDocMutation.mutate({ docId: doc.id, status: "rejected", adminNote: docReviewNote })}
                                disabled={updateDocMutation.isPending}
                                data-testid={`button-reject-doc-${doc.id}`}
                              >
                                <XCircle className="h-3 w-3" /> Reject
                              </Button>
                            </div>
                          </div>
                        )}
                        {doc.reviewedAt && (
                          <p className="text-[10px] text-gray-400">
                            Reviewed {format(new Date(doc.reviewedAt), "MMM d, yyyy h:mm a")}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setVerifyDialog(null)} className="rounded-xl">
              Close
            </Button>
            {verifyDialog && !verifyDialog.verified && (
              <Button
                onClick={() => {
                  updateBizMutation.mutate({ id: verifyDialog.id, membershipTier: verifyDialog.membershipTier || "none", verified: true });
                  setVerifyDialog(null);
                }}
                disabled={updateBizMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white rounded-xl gap-1"
                data-testid="button-verify-from-review"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve & Verify Business
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: number; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "from-blue-500/10 to-blue-500/5 border-blue-200/50",
    purple: "from-purple-500/10 to-purple-500/5 border-purple-200/50",
    green: "from-green-500/10 to-green-500/5 border-green-200/50",
    amber: "from-amber-500/10 to-amber-500/5 border-amber-200/50",
    teal: "from-teal-500/10 to-teal-500/5 border-teal-200/50",
    rose: "from-rose-500/10 to-rose-500/5 border-rose-200/50",
    indigo: "from-indigo-500/10 to-indigo-500/5 border-indigo-200/50",
    emerald: "from-emerald-500/10 to-emerald-500/5 border-emerald-200/50",
  };
  const iconColors: Record<string, string> = {
    blue: "text-blue-600", purple: "text-purple-600", green: "text-green-600", amber: "text-amber-600",
    teal: "text-teal-600", rose: "text-rose-600", indigo: "text-indigo-600", emerald: "text-emerald-600",
  };
  return (
    <Card className={`bg-gradient-to-br ${colors[color]} backdrop-blur-sm rounded-2xl border shadow-sm hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${iconColors[color]}`} />
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-2xl font-bold text-[#1a1a2e]" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>{value.toLocaleString()}</p>
        <p className="text-xs text-slate-400 mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

function MembershipRow({ label, count, total, icon: Icon, barColor }: { label: string; count: number; total: number; icon: any; barColor: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-[#1a1a2e] font-medium">
          <Icon className="h-4 w-4 text-slate-400" />
          {label}
        </span>
        <span className="text-slate-500 font-semibold">{count} <span className="text-slate-300 font-normal">({pct}%)</span></span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuickActionCard({ icon: Icon, label, sub, color, iconColor }: { icon: any; label: string; sub: string; color: string; iconColor: string }) {
  return (
    <Card className="bg-white/95 backdrop-blur-sm rounded-2xl border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group">
      <CardContent className="p-5 text-center">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <p className="text-sm font-semibold text-[#1a1a2e]">{label}</p>
        <p className="text-xs text-slate-400 mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

function EventsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: events, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/events"] });

  const updateEvent = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: number; status: string; adminNote?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/events/${id}`, { status, adminNote });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      toast({ title: "Event updated" });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      toast({ title: "Event deleted" });
    },
  });

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;

  const pending = (events || []).filter((e: any) => e.status === "pending");
  const approved = (events || []).filter((e: any) => e.status === "approved");
  const denied = (events || []).filter((e: any) => e.status === "denied");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-[#1a1a2e]">Event Moderation</h2>

      {pending.length > 0 && (
        <Card className="bg-amber-50 border-amber-200 rounded-2xl">
          <CardHeader><CardTitle className="text-amber-800 flex items-center gap-2"><AlertCircle className="h-5 w-5" /> {pending.length} Pending Event{pending.length > 1 ? "s" : ""}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pending.map((event: any) => (
              <div key={event.id} className="bg-white p-4 rounded-xl border flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-[#1a1a2e]">{event.title}</p>
                  <p className="text-sm text-slate-500">{event.businessName || "Unknown"} &middot; {event.date ? format(new Date(event.date), "MMM d, yyyy") : "No date"}</p>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{event.description}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-lg" onClick={() => updateEvent.mutate({ id: event.id, status: "approved" })} data-testid={`btn-approve-event-${event.id}`}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" className="rounded-lg" onClick={() => updateEvent.mutate({ id: event.id, status: "denied", adminNote: "Denied by admin" })} data-testid={`btn-deny-event-${event.id}`}>
                    <XCircle className="h-4 w-4 mr-1" /> Deny
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 rounded-lg" onClick={() => { if (confirm("Delete this event?")) deleteEvent.mutate(event.id); }} data-testid={`btn-delete-event-${event.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="bg-white/95 backdrop-blur-sm rounded-2xl border-0 shadow-sm">
        <CardHeader><CardTitle className="text-[#1a1a2e]">All Events ({(events || []).length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-slate-500"><th className="pb-3 pr-4">Title</th><th className="pb-3 pr-4">Business</th><th className="pb-3 pr-4">Date</th><th className="pb-3 pr-4">Status</th><th className="pb-3">Actions</th></tr></thead>
              <tbody>
                {(events || []).map((event: any) => (
                  <tr key={event.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium text-[#1a1a2e]">{event.title}</td>
                    <td className="py-3 pr-4 text-slate-500">{event.businessName || "—"}</td>
                    <td className="py-3 pr-4 text-slate-500">{event.date ? format(new Date(event.date), "MMM d, yyyy") : "—"}</td>
                    <td className="py-3 pr-4">{statusBadge(event.status)}</td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        {event.status !== "approved" && <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600" onClick={() => updateEvent.mutate({ id: event.id, status: "approved" })}><CheckCircle2 className="h-3.5 w-3.5" /></Button>}
                        {event.status !== "denied" && <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500" onClick={() => updateEvent.mutate({ id: event.id, status: "denied" })}><XCircle className="h-3.5 w-3.5" /></Button>}
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500" onClick={() => { if (confirm("Delete?")) deleteEvent.mutate(event.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PromosTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState("percentage");
  const [newValue, setNewValue] = useState("");
  const [newDuration, setNewDuration] = useState("60");
  const [newMaxUses, setNewMaxUses] = useState("");
  const [newExpires, setNewExpires] = useState("");

  const { data: promos, isLoading } = useQuery<any[]>({ queryKey: ["/api/promo-codes"] });

  const createPromo = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/promo-codes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      toast({ title: "Promo code created" });
      setShowCreate(false);
      setNewCode(""); setNewDesc(""); setNewType("percentage"); setNewValue(""); setNewDuration("60"); setNewMaxUses(""); setNewExpires("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deletePromo = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/promo-codes/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      toast({ title: "Promo code deleted" });
    },
  });

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#1a1a2e]">Promo Codes</h2>
        <Button className="bg-[#0a4a82] hover:bg-[#083a6a] text-white rounded-xl" onClick={() => setShowCreate(true)} data-testid="btn-create-promo">
          <Tag className="h-4 w-4 mr-2" /> Create Promo Code
        </Button>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Promo Code</DialogTitle>
            <DialogDescription>Create a discount or gold trial code for businesses.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input placeholder="e.g. GOLD30" value={newCode} onChange={e => setNewCode(e.target.value)} data-testid="input-promo-code" style={{ color: "#1a1a2e" }} />
            </div>
            <div>
              <Label>Description</Label>
              <Input placeholder="Optional description" value={newDesc} onChange={e => setNewDesc(e.target.value)} data-testid="input-promo-desc" style={{ color: "#1a1a2e" }} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger data-testid="select-promo-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage Discount</SelectItem>
                  <SelectItem value="fixed">Fixed Amount Discount</SelectItem>
                  <SelectItem value="gold_trial">Gold Trial (Free Gold Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newType !== "gold_trial" && (
              <div>
                <Label>{newType === "percentage" ? "Discount %" : "Discount Amount (cents)"}</Label>
                <Input type="number" placeholder={newType === "percentage" ? "e.g. 25" : "e.g. 2500"} value={newValue} onChange={e => setNewValue(e.target.value)} data-testid="input-promo-value" style={{ color: "#1a1a2e" }} />
              </div>
            )}
            {newType === "gold_trial" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800 font-medium">Gold Trial: 60 Days Total</p>
                <p className="text-xs text-blue-600 mt-1">New businesses already get 30 days of Gold free. This promo adds 30 more days, giving them 60 days total.</p>
              </div>
            )}
            <div>
              <Label>Max Uses (optional)</Label>
              <Input type="number" placeholder="Unlimited if empty" value={newMaxUses} onChange={e => setNewMaxUses(e.target.value)} data-testid="input-promo-max-uses" style={{ color: "#1a1a2e" }} />
            </div>
            <div>
              <Label>Expires (optional)</Label>
              <Input type="date" value={newExpires} onChange={e => setNewExpires(e.target.value)} data-testid="input-promo-expires" style={{ color: "#1a1a2e" }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              className="bg-[#0a4a82] hover:bg-[#083a6a] text-white"
              disabled={!newCode || createPromo.isPending}
              data-testid="btn-submit-promo"
              onClick={() => {
                createPromo.mutate({
                  code: newCode,
                  description: newDesc || undefined,
                  discountType: newType,
                  discountValue: newType === "gold_trial" ? 0 : Number(newValue),
                  durationDays: newType === "gold_trial" ? Number(newDuration) : undefined,
                  maxUses: newMaxUses ? Number(newMaxUses) : undefined,
                  expiresAt: newExpires || undefined,
                });
              }}
            >
              {createPromo.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="bg-white/95 backdrop-blur-sm rounded-2xl border-0 shadow-sm">
        <CardContent className="pt-6">
          {(promos || []).length === 0 ? (
            <p className="text-center text-slate-400 py-8">No promo codes yet. Create one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-slate-500"><th className="pb-3 pr-4">Code</th><th className="pb-3 pr-4">Type</th><th className="pb-3 pr-4">Value</th><th className="pb-3 pr-4">Uses</th><th className="pb-3 pr-4">Status</th><th className="pb-3">Actions</th></tr></thead>
                <tbody>
                  {(promos || []).map((p: any) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-mono font-bold text-[#0a4a82]">{p.code}</td>
                      <td className="py-3 pr-4">
                        {p.discountType === "gold_trial" ? (
                          <Badge className="bg-amber-100 text-amber-800">Gold Trial {p.durationDays ? `(${p.durationDays}d)` : ""}</Badge>
                        ) : p.discountType === "percentage" ? (
                          <Badge className="bg-blue-100 text-blue-800">{p.discountValue}% Off</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800">${(p.discountValue / 100).toFixed(2)} Off</Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-500">{p.description || "—"}</td>
                      <td className="py-3 pr-4 text-slate-500">{p.currentUses || 0}{p.maxUses ? `/${p.maxUses}` : ""}</td>
                      <td className="py-3 pr-4">{p.isActive ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge className="bg-gray-100 text-gray-500">Inactive</Badge>}</td>
                      <td className="py-3">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-700" onClick={() => { if (confirm(`Delete promo "${p.code}"?`)) deletePromo.mutate(p.id); }} data-testid={`btn-delete-promo-${p.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: ads, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/ads"] });

  const updateAd = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; status?: string; paymentStatus?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/ads/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ads"] });
      toast({ title: "Ad updated" });
    },
  });

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;

  const pending = (ads || []).filter((a: any) => a.status === "pending");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-[#1a1a2e]">Ad Placements</h2>

      {pending.length > 0 && (
        <Card className="bg-amber-50 border-amber-200 rounded-2xl">
          <CardHeader><CardTitle className="text-amber-800 flex items-center gap-2"><AlertCircle className="h-5 w-5" /> {pending.length} Pending Ad{pending.length > 1 ? "s" : ""}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pending.map((ad: any) => (
              <div key={ad.id} className="bg-white p-4 rounded-xl border flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-[#1a1a2e]">{ad.title || "Untitled Ad"}</p>
                  <p className="text-sm text-slate-500">{ad.businessName || "Unknown"} &middot; {ad.placementType || "—"} &middot; Payment: {ad.paymentStatus || "unpaid"}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-lg" onClick={() => updateAd.mutate({ id: ad.id, status: "active" })} data-testid={`btn-approve-ad-${ad.id}`}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" className="rounded-lg" onClick={() => updateAd.mutate({ id: ad.id, status: "rejected" })} data-testid={`btn-reject-ad-${ad.id}`}>
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="bg-white/95 backdrop-blur-sm rounded-2xl border-0 shadow-sm">
        <CardHeader><CardTitle className="text-[#1a1a2e]">All Ads ({(ads || []).length})</CardTitle></CardHeader>
        <CardContent>
          {(ads || []).length === 0 ? (
            <p className="text-center text-slate-400 py-8">No ad placements yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-slate-500"><th className="pb-3 pr-4">Title</th><th className="pb-3 pr-4">Business</th><th className="pb-3 pr-4">Size</th><th className="pb-3 pr-4">Payment</th><th className="pb-3 pr-4">Status</th><th className="pb-3">Actions</th></tr></thead>
                <tbody>
                  {(ads || []).map((ad: any) => (
                    <tr key={ad.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-medium text-[#1a1a2e]">{ad.title || "Untitled"}</td>
                      <td className="py-3 pr-4 text-slate-500">{ad.businessName || "—"}</td>
                      <td className="py-3 pr-4"><Badge className="bg-blue-50 text-blue-700">{ad.placementType || "—"}</Badge></td>
                      <td className="py-3 pr-4">{ad.paymentStatus === "paid" ? <Badge className="bg-green-100 text-green-800">Paid</Badge> : <Badge className="bg-amber-100 text-amber-800">{ad.paymentStatus || "Unpaid"}</Badge>}</td>
                      <td className="py-3 pr-4">{statusBadge(ad.status)}</td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          {ad.status !== "active" && <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600" onClick={() => updateAd.mutate({ id: ad.id, status: "active" })}><CheckCircle2 className="h-3.5 w-3.5" /></Button>}
                          {ad.status === "active" && <Button size="sm" variant="ghost" className="h-7 px-2 text-amber-600" onClick={() => updateAd.mutate({ id: ad.id, status: "paused" })}><Eye className="h-3.5 w-3.5" /></Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuotesTab() {
  const { data: allRequests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/quote-requests"],
    queryFn: async () => {
      const res = await fetch("/api/admin/quote-requests", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = (allRequests || []).filter((r: any) => statusFilter === "all" || r.status === statusFilter);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#1a1a2e]">All Quote Requests</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-slate-200" />
              <p className="text-slate-400">No quote requests found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left p-4 font-semibold text-slate-600">Title</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Customer</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Category</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Budget</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Bids</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Status</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((req: any) => (
                    <tr key={req.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors" data-testid={`admin-quote-row-${req.id}`}>
                      <td className="p-4">
                        <p className="font-medium text-[#1a1a2e] truncate max-w-[200px]">{req.title}</p>
                        {req.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{req.description}</p>}
                      </td>
                      <td className="p-4 text-slate-600">
                        {req.customerName || "Unknown"}
                      </td>
                      <td className="p-4">
                        <Badge className="bg-[#0a4a82]/10 text-[#0a4a82] border-0 text-xs">{req.category}</Badge>
                      </td>
                      <td className="p-4 text-slate-600">{req.budget || "—"}</td>
                      <td className="p-4 text-slate-600">{req.quoteCount || 0}</td>
                      <td className="p-4">{statusBadge(req.status)}</td>
                      <td className="p-4 text-xs text-slate-400">
                        {req.createdAt ? formatDistanceToNow(new Date(req.createdAt), { addSuffix: true }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GrowthTab() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{
    totals: { totalReferrals: number; rewardedReferrals: number; pendingReferrals: number };
    founding: {
      limit: number;
      claimed: number;
      remaining: number;
      members: { id: number; name: string; membershipTier: string | null; foundingMemberNumber: number }[];
    };
    leaderboard: { businessId: number; businessName: string; rewarded: number; total: number }[];
  }>({
    queryKey: ["/api/admin/referrals/stats"],
  });

  if (isLoading) {
    return <div className="text-white/60">Loading growth metrics…</div>;
  }
  if (!data) {
    return <div className="text-white/60">No data yet.</div>;
  }

  const { totals, founding, leaderboard } = data;
  const claimedPct = Math.round((founding.claimed / founding.limit) * 100);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6" data-testid="tab-content-growth">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/95 p-6">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total Referrals</div>
          <div className="text-3xl font-bold text-[#0a4a82] mt-2" data-testid="stat-total-referrals">
            {totals.totalReferrals}
          </div>
          <div className="text-sm text-slate-500 mt-1">
            {totals.rewardedReferrals} rewarded · {totals.pendingReferrals} pending
          </div>
        </Card>
        <Card className="bg-white/95 p-6">
          <div className="text-xs uppercase tracking-wide text-slate-500">Founding Members</div>
          <div className="text-3xl font-bold text-amber-700 mt-2" data-testid="stat-founding-claimed">
            {founding.claimed} / {founding.limit}
          </div>
          <div className="mt-3 h-2 w-full bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-300 to-amber-500"
              style={{ width: `${claimedPct}%` }}
            />
          </div>
          <div className="text-sm text-slate-500 mt-2">{founding.remaining} slots remaining</div>
        </Card>
        <Card className="bg-white/95 p-6">
          <div className="text-xs uppercase tracking-wide text-slate-500">Reward Cost</div>
          <div className="text-3xl font-bold text-emerald-700 mt-2">
            {totals.rewardedReferrals * 60}d
          </div>
          <div className="text-sm text-slate-500 mt-1">
            Gold days granted (30d × 2 sides × {totals.rewardedReferrals})
          </div>
        </Card>
      </div>

      <Card className="bg-white/95">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#0a4a82]" />
            Top Referrers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-slate-500">No referrals yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b">
                <tr>
                  <th className="py-2">#</th>
                  <th className="py-2">Business</th>
                  <th className="py-2 text-right">Rewarded</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.businessId} className="border-b last:border-0" data-testid={`row-leaderboard-${row.businessId}`}>
                    <td className="py-2 font-semibold text-slate-400">{i + 1}</td>
                    <td className="py-2 font-medium text-[#1a1a2e]">{row.businessName}</td>
                    <td className="py-2 text-right font-bold text-emerald-700">{row.rewarded}</td>
                    <td className="py-2 text-right text-slate-600">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/95">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-600" />
            Founding Members Roster
          </CardTitle>
        </CardHeader>
        <CardContent>
          {founding.members.length === 0 ? (
            <p className="text-sm text-slate-500">No founding members assigned yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {founding.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200"
                  data-testid={`founder-${m.foundingMemberNumber}`}
                >
                  <span className="font-mono text-xs font-bold text-amber-800 w-10">
                    #{m.foundingMemberNumber}
                  </span>
                  <span className="text-sm text-slate-800 truncate flex-1">{m.name}</span>
                  <button
                    onClick={() => copy(`${m.name} (#${m.foundingMemberNumber})`)}
                    className="text-slate-400 hover:text-slate-700"
                    aria-label="Copy"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
