import { useState } from "react";
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
  ShieldCheck,
  ShieldOff,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  BadgeCheck,
} from "lucide-react";
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
    downgradesCount: number;
    customerAccounts: number;
    businessAccounts: number;
  };
  membershipBreakdown: Record<string, number>;
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
  isAdmin: boolean | null;
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
  verified: boolean | null;
  acceptsQuotes: boolean | null;
  createdAt: string | null;
};

type Tab = "overview" | "users" | "businesses";

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
  const [activeTab, setActiveTab] = useState<Tab>("overview");

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

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "businesses", label: "Businesses", icon: Building2 },
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
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "businesses" && <BusinessesTab />}
      </div>
    </div>
  );
}

function OverviewTab() {
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

  return (
    <div className="space-y-8">
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
            <MembershipRow label="Gold" count={mb["premium"] || 0} total={o?.totalBusinesses || 1} icon={Crown} barColor="bg-yellow-500" />
            <MembershipRow label="Silver" count={mb["standard"] || 0} total={o?.totalBusinesses || 1} icon={Star} barColor="bg-slate-400" />
            <MembershipRow label="Bronze" count={mb["basic"] || 0} total={o?.totalBusinesses || 1} icon={Medal} barColor="bg-amber-700" />
            <MembershipRow label="Free / None" count={mb["none"] || 0} total={o?.totalBusinesses || 1} icon={Users} barColor="bg-gray-300" />
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

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}`, { isAdmin });
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Admin status changed." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
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
                        {u.isAdmin && <Badge className="bg-red-100 text-red-800 text-xs">Admin</Badge>}
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
                          className={`h-8 w-8 p-0 ${u.isAdmin ? "text-red-500 hover:text-red-700 hover:bg-red-50" : "text-gray-400 hover:text-amber-600 hover:bg-amber-50"}`}
                          title={u.isAdmin ? "Remove Admin" : "Make Admin"}
                          onClick={() => toggleAdminMutation.mutate({ userId: u.id, isAdmin: !u.isAdmin })}
                          data-testid={`button-toggle-admin-${u.id}`}
                        >
                          {u.isAdmin ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
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
  const [editTier, setEditTier] = useState("");
  const [editVerified, setEditVerified] = useState(false);

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
    mutationFn: async ({ id, membershipTier, verified }: { id: number; membershipTier: string; verified: boolean }) => {
      await apiRequest("PATCH", `/api/admin/businesses/${id}`, { membershipTier, verified });
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Business updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setEditDialog(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const openEdit = (b: AdminBusiness) => {
    setEditDialog(b);
    setEditTier(b.membershipTier || "none");
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
                      <Badge className={`text-xs ${tierColor(b.membershipTier)}`}>{tierLabel(b.membershipTier)}</Badge>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-[#0a4a82] hover:bg-blue-50 rounded-lg gap-1"
                        onClick={() => openEdit(b)}
                        data-testid={`button-edit-biz-${b.id}`}
                      >
                        <UserCog className="h-4 w-4" />
                        Edit
                      </Button>
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

      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#0a4a82]" />
              Edit Business
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[#1a1a2e]">{editDialog?.name}</p>
            <div className="space-y-2">
              <Label>Membership Tier</Label>
              <Select value={editTier} onValueChange={setEditTier}>
                <SelectTrigger className="bg-white rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Free / None</SelectItem>
                  <SelectItem value="basic">Bronze</SelectItem>
                  <SelectItem value="standard">Silver</SelectItem>
                  <SelectItem value="premium">Gold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="biz-verified"
                checked={editVerified}
                onChange={(e) => setEditVerified(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0a4a82] cursor-pointer"
              />
              <label htmlFor="biz-verified" className="text-sm text-slate-600 cursor-pointer">Verified Business</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={() => editDialog && updateBizMutation.mutate({ id: editDialog.id, membershipTier: editTier, verified: editVerified })}
              disabled={updateBizMutation.isPending}
              className="bg-[#0a4a82] hover:bg-[#083a6a] text-white rounded-xl"
              data-testid="button-save-business"
            >
              {updateBizMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
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
