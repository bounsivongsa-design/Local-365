import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Users,
  Building2,
  Calendar,
  Briefcase,
  MessageSquare,
  Megaphone,
  Tag,
  TrendingUp,
  Crown,
  Star,
  Medal,
  AlertCircle,
  ArrowRight,
  Activity,
  BarChart3,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  ArrowDown,
  Layers,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
    downgradesCount: number;
    customerAccounts: number;
    businessAccounts: number;
  };
  membershipBreakdown: Record<string, number>;
  recentUsers: Array<{
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    accountType: string | null;
    createdAt: string | null;
  }>;
  recentBusinesses: Array<{
    id: number;
    name: string;
    membershipTier: string | null;
    verified: boolean | null;
    createdAt: string | null;
  }>;
  recentQuoteRequests: Array<{
    id: number;
    title: string;
    status: string | null;
    createdAt: string | null;
  }>;
  recentAds: Array<{
    id: number;
    title: string | null;
    status: string | null;
    placement: string | null;
    createdAt: string | null;
  }>;
};

function tierLabel(t: string | null | undefined) {
  if (!t || t === "none") return "Free";
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
  if (status === "active") return <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>;
  if (status === "pending") return <Badge className="bg-amber-100 text-amber-800 text-xs">Pending</Badge>;
  if (status === "completed" || status === "approved") return <Badge className="bg-blue-100 text-blue-800 text-xs">{status}</Badge>;
  if (status === "rejected" || status === "expired" || status === "cancelled") return <Badge className="bg-red-100 text-red-800 text-xs">{status}</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 text-xs">{status || "unknown"}</Badge>;
}

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch admin stats");
      return res.json();
    },
    enabled: isAuthenticated && !!user?.isAdmin,
    refetchInterval: 30000,
  });

  if (!isAuthenticated || !user?.isAdmin) {
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

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="bg-gradient-to-b from-[#1a1a2e] to-[#0a0a1a] py-12">
          <div className="container">
            <Skeleton className="h-10 w-64 mb-2 bg-white/10" />
            <Skeleton className="h-5 w-96 bg-white/10" />
          </div>
        </div>
        <div className="container py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const o = stats?.overview;
  const mb = stats?.membershipBreakdown || {};

  return (
    <div className="min-h-screen pb-20">
      <div className="bg-gradient-to-b from-[#1a1a2e] to-[#0a0a1a] py-12 border-b border-white/10">
        <div className="container">
          <div className="flex items-center gap-3 mb-2">
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
        </div>
      </div>

      <div className="container py-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Users" value={o?.totalUsers || 0} sub={`${o?.customerAccounts || 0} customers · ${o?.businessAccounts || 0} businesses`} color="blue" />
          <StatCard icon={Building2} label="Businesses" value={o?.totalBusinesses || 0} sub="Registered listings" color="purple" />
          <StatCard icon={Calendar} label="Events" value={o?.totalEvents || 0} sub="Community calendar" color="green" />
          <StatCard icon={Briefcase} label="Active Jobs" value={o?.totalJobs || 0} sub="Help wanted posts" color="amber" />
          <StatCard icon={MessageSquare} label="Quote Requests" value={o?.totalQuoteRequests || 0} sub={`${o?.totalQuotes || 0} bids submitted`} color="teal" />
          <StatCard icon={Megaphone} label="Advertisements" value={o?.totalAds || 0} sub={`${o?.activeAds || 0} active · ${o?.pendingAds || 0} pending`} color="rose" />
          <StatCard icon={FileText} label="Community Posts" value={o?.totalPosts || 0} sub="Feed activity" color="indigo" />
          <StatCard icon={Tag} label="Promo Codes" value={o?.totalPromos || 0} sub={`${o?.usedPromos || 0} redeemed`} color="emerald" />
        </div>

        {((o?.pendingAds || 0) > 0 || (o?.pendingCategories || 0) > 0) && (
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0 lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[#1a1a2e] text-lg">
                <BarChart3 className="h-5 w-5 text-[#0a4a82]" />
                Membership Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MembershipRow label="Gold" dbKey="premium" count={mb["premium"] || 0} total={o?.totalBusinesses || 1} icon={Crown} barColor="bg-yellow-500" />
              <MembershipRow label="Silver" dbKey="standard" count={mb["standard"] || 0} total={o?.totalBusinesses || 1} icon={Star} barColor="bg-slate-400" />
              <MembershipRow label="Bronze" dbKey="basic" count={mb["basic"] || 0} total={o?.totalBusinesses || 1} icon={Medal} barColor="bg-amber-700" />
              <MembershipRow label="Free / None" dbKey="none" count={mb["none"] || 0} total={o?.totalBusinesses || 1} icon={Users} barColor="bg-gray-300" />
              {(o?.downgradesCount || 0) > 0 && (
                <div className="pt-2 border-t border-gray-100 flex items-center gap-2 text-sm text-red-500">
                  <ArrowDown className="h-4 w-4" />
                  {o?.downgradesCount} membership downgrade{(o?.downgradesCount || 0) > 1 ? "s" : ""} recorded
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0 lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-[#1a1a2e] text-lg">
                  <Users className="h-5 w-5 text-[#0a4a82]" />
                  Recent Signups
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {stats?.recentUsers?.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors" data-testid={`row-user-${u.id}`}>
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
                      {u.createdAt && (
                        <span className="text-xs text-slate-400">{formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}</span>
                      )}
                    </div>
                  </div>
                ))}
                {(!stats?.recentUsers || stats.recentUsers.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-8">No users yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-[#1a1a2e] text-lg">
                  <Building2 className="h-5 w-5 text-purple-600" />
                  Recent Businesses
                </CardTitle>
                <Link to="/directory" data-testid="link-view-all-businesses">
                  <Button variant="ghost" size="sm" className="text-[#0a4a82] text-xs gap-1">
                    View All <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {stats?.recentBusinesses?.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors" data-testid={`row-business-${b.id}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1a1a2e] truncate">{b.name}</p>
                      {b.createdAt && (
                        <p className="text-xs text-slate-400">{formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-xs ${tierColor(b.membershipTier)}`}>{tierLabel(b.membershipTier)}</Badge>
                      {b.verified ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-300" />
                      )}
                    </div>
                  </div>
                ))}
                {(!stats?.recentBusinesses || stats.recentBusinesses.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-8">No businesses yet</p>
                )}
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
                <Link to="/admin/ads" data-testid="link-view-all-ads">
                  <Button variant="ghost" size="sm" className="text-[#0a4a82] text-xs gap-1">
                    Manage <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {stats?.recentAds?.map((ad) => (
                  <div key={ad.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors" data-testid={`row-ad-${ad.id}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1a1a2e] truncate">{ad.title || `Ad #${ad.id}`}</p>
                      <p className="text-xs text-slate-400">{ad.placement?.replace(/_/g, " ") || "unknown"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(ad.status)}
                      {ad.createdAt && (
                        <span className="text-xs text-slate-400">{formatDistanceToNow(new Date(ad.createdAt), { addSuffix: true })}</span>
                      )}
                    </div>
                  </div>
                ))}
                {(!stats?.recentAds || stats.recentAds.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-8">No ads yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-[#1a1a2e] text-lg">
                <MessageSquare className="h-5 w-5 text-teal-600" />
                Recent Quote Requests
              </CardTitle>
              <Link to="/quotes" data-testid="link-view-all-quotes">
                <Button variant="ghost" size="sm" className="text-[#0a4a82] text-xs gap-1">
                  View All <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {stats?.recentQuoteRequests?.map((qr) => (
                <div key={qr.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors" data-testid={`row-quote-${qr.id}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1a1a2e] truncate">{qr.title}</p>
                    {qr.createdAt && (
                      <p className="text-xs text-slate-400">{formatDistanceToNow(new Date(qr.createdAt), { addSuffix: true })}</p>
                    )}
                  </div>
                  {statusBadge(qr.status)}
                </div>
              ))}
              {(!stats?.recentQuoteRequests || stats.recentQuoteRequests.length === 0) && (
                <p className="text-sm text-slate-400 text-center py-8">No quote requests yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/admin/ads" data-testid="link-admin-manage-ads">
            <QuickActionCard icon={Megaphone} label="Manage Ads" sub="Review & approve" color="bg-rose-500/10" iconColor="text-rose-500" />
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
        </div>
      </div>
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
    blue: "text-blue-600",
    purple: "text-purple-600",
    green: "text-green-600",
    amber: "text-amber-600",
    teal: "text-teal-600",
    rose: "text-rose-600",
    indigo: "text-indigo-600",
    emerald: "text-emerald-600",
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

function MembershipRow({ label, dbKey, count, total, icon: Icon, barColor }: { label: string; dbKey: string; count: number; total: number; icon: any; barColor: string }) {
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
