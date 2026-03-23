import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { MembershipBadge } from "@/components/MembershipBadge";
import { Link } from "react-router-dom";
import { 
  ArrowLeft, 
  Upload, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  FileText, 
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Building2,
  Star,
  Crown,
  BarChart3,
  Settings,
  Plus,
  Eye,
  Briefcase,
  ArrowRight,
  TrendingUp,
  Phone,
  Globe,
  MapPin,
  Mail,
  MousePointerClick,
  MessageCircle,
  Shield,
  Megaphone,
  Tag,
  Users,
  Calendar,
  LayoutDashboard,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow, format, subDays, eachDayOfInterval } from "date-fns";
import type { Business } from "@shared/schema";

interface Receipt {
  id: number;
  fileName: string;
  fileUrl: string;
  status: string;
  uploadedAt: string;
}

interface ValidationStatus {
  isValidated: boolean;
  receipts: Receipt[];
}

function getTierDisplayName(tier: string | null | undefined): string {
  switch (tier) {
    case "premium": return "Gold";
    case "standard": return "Silver";
    case "basic": return "Bronze";
    default: return "None";
  }
}

interface AnalyticsData {
  totals: Record<string, number>;
  daily: Record<string, Record<string, number>>;
  allTime: Record<string, number>;
}

const EVENT_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  page_view: { label: "Page Views", icon: Eye, color: "#0a4a82" },
  phone_click: { label: "Phone Clicks", icon: Phone, color: "#8a9a5b" },
  email_click: { label: "Email Clicks", icon: Mail, color: "#d4a373" },
  website_click: { label: "Website Clicks", icon: Globe, color: "#6366f1" },
  directions_click: { label: "Directions", icon: MapPin, color: "#ef4444" },
};

function QuotePreferenceToggle({ businessId, initialValue }: { businessId: number; initialValue: boolean }) {
  const [enabled, setEnabled] = useState(initialValue);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (acceptsQuotes: boolean) => {
      const res = await apiRequest("POST", `/api/businesses/${businessId}/quote-preference`, { acceptsQuotes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/business"] });
    },
  });

  return (
    <div className="flex items-center justify-between h-12 px-3 rounded-xl border border-[#0a4a82]/15 bg-white">
      <span className="flex items-center gap-2 text-[#1a1a2e] text-sm font-medium">
        <MessageCircle className="h-4 w-4 text-[#0a4a82]" />
        Accept Quote Requests
      </span>
      <Switch
        checked={enabled}
        onCheckedChange={(checked) => {
          setEnabled(checked);
          mutation.mutate(checked, {
            onError: () => {
              setEnabled(!checked);
              toast({ title: "Error", description: "Failed to update preference.", variant: "destructive" });
            },
            onSuccess: () => {
              toast({ title: checked ? "Quotes enabled" : "Quotes disabled", description: checked ? "You'll receive quote requests from customers." : "You won't receive new quote requests." });
            },
          });
        }}
        data-testid="switch-quote-preference"
      />
    </div>
  );
}

function AnalyticsDashboard({ businessId }: { businessId: number }) {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics", businessId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/${businessId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    enabled: businessId > 0,
  });

  const chartData = useMemo(() => {
    if (!analytics) return [];
    const end = new Date();
    const start = subDays(end, 13);
    const days = eachDayOfInterval({ start, end });
    return days.map(day => {
      const key = format(day, "yyyy-MM-dd");
      const dayData = analytics.daily[key] || {};
      return {
        date: format(day, "MMM d"),
        page_view: dayData.page_view || 0,
        phone_click: dayData.phone_click || 0,
        email_click: dayData.email_click || 0,
        website_click: dayData.website_click || 0,
        directions_click: dayData.directions_click || 0,
        total: (dayData.page_view || 0) + (dayData.phone_click || 0) + (dayData.email_click || 0) + (dayData.website_click || 0) + (dayData.directions_click || 0),
      };
    });
  }, [analytics]);

  const maxTotal = useMemo(() => Math.max(...chartData.map(d => d.total), 1), [chartData]);

  if (isLoading) {
    return (
      <Card className="shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0a4a82]" />
        </CardContent>
      </Card>
    );
  }

  const totals30d = analytics?.totals || {};
  const totalInteractions = Object.values(totals30d).reduce((a, b) => a + b, 0);

  return (
    <Card className="bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl border-[#0a4a82]/10" data-testid="card-analytics">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-[#1a1a2e]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8a9a5b] to-[#6b7a42] flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          Listing Analytics
        </CardTitle>
        <CardDescription>Last 30 days of activity on your business listing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(EVENT_LABELS).map(([key, { label, icon: Icon, color }]) => (
            <div key={key} className="p-3 rounded-xl border-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${color}08, ${color}15)` }} data-testid={`stat-${key}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-[#1a1a2e] mt-1">{(totals30d[key] || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500 font-medium">{label}</p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-br from-[#0a4a82]/5 to-[#0a4a82]/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-[#1a1a2e]">Daily Traffic (14 days)</h4>
            <Badge className="text-xs bg-[#0a4a82] text-white border-0">
              <MousePointerClick className="h-3 w-3 mr-1" />
              {totalInteractions} total
            </Badge>
          </div>
          <div className="flex items-end gap-1.5 h-36" data-testid="chart-daily-traffic">
            {chartData.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1a1a2e] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {day.date}: {day.total} events
                </div>
                <div 
                  className="w-full rounded-t transition-all duration-300 group-hover:scale-y-105"
                  style={{ 
                    height: `${Math.max((day.total / maxTotal) * 100, 4)}%`,
                    background: day.total > 0 
                      ? `linear-gradient(to top, #0a4a82, #d4a373)` 
                      : 'rgba(10,74,130,0.1)',
                    minHeight: '4px',
                  }}
                />
                <span className="text-[9px] text-[#0a4a82]/60 font-medium leading-none hidden sm:block">{day.date.split(' ')[1]}</span>
              </div>
            ))}
          </div>
        </div>

        {analytics && Object.keys(analytics.allTime).length > 0 && (
          <div className="pt-4 border-t border-[#0a4a82]/10">
            <h4 className="text-sm font-semibold text-[#1a1a2e] mb-3">All-Time Totals</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(EVENT_LABELS).map(([key, { label, icon: Icon, color }]) => (
                <div key={key} className="flex items-center gap-2 text-sm p-2 rounded-lg" style={{ background: `${color}08` }}>
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                  <span className="text-gray-500">{label}:</span>
                  <span className="font-bold text-[#1a1a2e]">{(analytics.allTime[key] || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BusinessDashboard({ user, business }: { user: any; business: Business | null }) {
  const hasBusiness = !!business;
  const tier = business?.membershipTier;
  const tierName = getTierDisplayName(tier);

  return (
    <div className="container py-8 space-y-6">
      {!hasBusiness ? (
        <Card className="bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.15)] border-[#d4a373]/30 rounded-2xl">
          <CardContent className="py-12 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0a4a82] to-[#0a4a82]/70 flex items-center justify-center mx-auto mb-6">
              <Building2 className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-[#1a1a2e] mb-3" data-testid="text-no-business">
              Create Your Business Listing
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Get your business listed in the Local List 365 directory and start connecting with customers in your community.
            </p>
            <Link to="/create-business">
              <Button size="lg" className="bg-gradient-to-r from-[#0a4a82] to-[#083a6a] hover:from-[#083a6a] hover:to-[#062d54] h-14 px-8 rounded-xl text-lg font-semibold shadow-lg" data-testid="button-create-business">
                <Plus className="h-5 w-5 mr-2" />
                Create Business Listing
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="bg-gradient-to-br from-[#0a4a82] to-[#062d54] border-0 shadow-[0_8px_30px_rgba(10,74,130,0.3)] rounded-2xl text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-white/70">Your Listing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  {business.logoUrl ? (
                    <img src={business.logoUrl} alt={business.name} className="w-12 h-12 rounded-lg object-cover border-2 border-white/20" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white/15 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate" data-testid="text-business-name">{business.name}</p>
                    <p className="text-xs text-white/60">{business.category}</p>
                  </div>
                </div>
                <Link to={`/directory/${business.id}`} className="mt-4 block">
                  <Button size="sm" className="w-full bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm" data-testid="button-view-listing">
                    <Eye className="h-4 w-4 mr-2" />
                    View Public Listing
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#d4a373] to-[#b8834f] border-0 shadow-[0_8px_30px_rgba(212,163,115,0.3)] rounded-2xl text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-white/70">Membership</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-3">
                  {tier && tier !== "none" ? (
                    <MembershipBadge tier={tier} variant="compact" />
                  ) : (
                    <Badge className="bg-white/20 text-white border-0">No Membership</Badge>
                  )}
                </div>
                <p className="text-sm text-white/80 mb-4">
                  {tier && tier !== "none"
                    ? `You're on the ${tierName} plan`
                    : "Upgrade to get more visibility"}
                </p>
                <Link to="/membership">
                  <Button size="sm" className="w-full bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm" data-testid="button-manage-membership">
                    <Crown className="h-4 w-4 mr-2" />
                    {tier && tier !== "none" ? "Manage Plan" : "View Plans"}
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#8a9a5b] to-[#6b7a42] border-0 shadow-[0_8px_30px_rgba(138,154,91,0.3)] rounded-2xl text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-white/70">Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-5 w-5 text-amber-300 fill-amber-300" />
                  <span className="text-2xl font-bold text-white" data-testid="text-avg-rating">
                    {(business as any).averageRating ? Number((business as any).averageRating).toFixed(1) : "—"}
                  </span>
                  <span className="text-sm text-white/60">({(business as any).reviewCount || 0} reviews)</span>
                </div>
                <Link to={`/directory/${business.id}`}>
                  <Button size="sm" className="w-full bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm" data-testid="button-view-reviews">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Reviews
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card className="bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl border-[#0a4a82]/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-[#1a1a2e]">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0a4a82] to-[#0a4a82]/70 flex items-center justify-center">
                    <Settings className="h-4 w-4 text-white" />
                  </div>
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <a href="#listing-media" className="block">
                  <Button variant="outline" className="w-full justify-between h-12 rounded-xl border-[#0a4a82]/15 hover:bg-[#0a4a82]/5 hover:border-[#0a4a82]/30" data-testid="button-edit-listing">
                    <span className="flex items-center gap-2 text-[#1a1a2e]">
                      <Building2 className="h-4 w-4 text-[#0a4a82]" />
                      Manage Listing Media
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#0a4a82]" />
                  </Button>
                </a>
                <Link to="/jobs" className="block">
                  <Button variant="outline" className="w-full justify-between h-12 rounded-xl border-[#8a9a5b]/15 hover:bg-[#8a9a5b]/5 hover:border-[#8a9a5b]/30" data-testid="button-post-job">
                    <span className="flex items-center gap-2 text-[#1a1a2e]">
                      <Briefcase className="h-4 w-4 text-[#8a9a5b]" />
                      Post a Job ($7/week)
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#8a9a5b]" />
                  </Button>
                </Link>
                <Link to="/membership" className="block">
                  <Button variant="outline" className="w-full justify-between h-12 rounded-xl border-[#d4a373]/15 hover:bg-[#d4a373]/5 hover:border-[#d4a373]/30" data-testid="button-upgrade-plan">
                    <span className="flex items-center gap-2 text-[#1a1a2e]">
                      <Crown className="h-4 w-4 text-[#d4a373]" />
                      {tier && tier !== "none" ? "Upgrade Membership" : "Get a Membership"}
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#d4a373]" />
                  </Button>
                </Link>
                <Link to="/advertising" className="block">
                  <Button variant="outline" className="w-full justify-between h-12 rounded-xl border-[#0a4a82]/15 hover:bg-[#0a4a82]/5 hover:border-[#0a4a82]/30" data-testid="button-advertise">
                    <span className="flex items-center gap-2 text-[#1a1a2e]">
                      <BarChart3 className="h-4 w-4 text-[#0a4a82]" />
                      Advertise Your Business
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#0a4a82]" />
                  </Button>
                </Link>
                {tier && tier !== "none" && (
                  <QuotePreferenceToggle businessId={business.id} initialValue={(business as any).acceptsQuotes !== false} />
                )}
              </CardContent>
            </Card>

            <Card className="bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl border-[#0a4a82]/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-[#1a1a2e]">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#d4a373] to-[#d4a373]/70 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                  Business Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-[#0a4a82]/10">
                  <span className="text-gray-500">Category</span>
                  <span className="font-medium text-[#1a1a2e]" data-testid="text-business-category">{business.category}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#0a4a82]/10">
                  <span className="text-gray-500">Location</span>
                  <span className="font-medium text-[#1a1a2e]" data-testid="text-business-location">{business.city}, {business.state}</span>
                </div>
                {business.phone && (
                  <div className="flex justify-between py-2 border-b border-[#0a4a82]/10">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium text-[#1a1a2e]">{business.phone}</span>
                  </div>
                )}
                {business.websiteUrl && (
                  <div className="flex justify-between py-2 border-b border-[#0a4a82]/10">
                    <span className="text-gray-500">Website</span>
                    <a href={business.websiteUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[#0a4a82] hover:underline truncate max-w-[200px]">
                      {business.websiteUrl.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Credentials</span>
                  <div className="flex gap-1.5">
                    {business.hasLLC && <Badge className="text-xs bg-[#0a4a82]/10 text-[#0a4a82] border-0">LLC</Badge>}
                    {business.hasInsurance && <Badge className="text-xs bg-[#8a9a5b]/10 text-[#8a9a5b] border-0">Insured</Badge>}
                    {business.isLicensed && <Badge className="text-xs bg-[#d4a373]/10 text-[#d4a373] border-0">Licensed</Badge>}
                    {!business.hasLLC && !business.hasInsurance && !business.isLicensed && (
                      <span className="text-gray-400">None added</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <DashboardMediaManagement business={business} />

          <AnalyticsDashboard businessId={business.id} />
        </>
      )}
    </div>
  );
}

function DashboardMediaManagement({ business }: { business: Business }) {
  return (
    <div id="listing-media" className="space-y-5 scroll-mt-6">
      <h2 className="text-xl font-bold text-[#1a1a2e] flex items-center gap-2">
        <Settings className="h-5 w-5 text-[#0a4a82]" />
        Listing Media & Content
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DashboardLogoUploader business={business} />
        <DashboardGalleryManager business={business} />
      </div>
      <DashboardPromoVideoUploader business={business} />
    </div>
  );
}

function DashboardLogoUploader({ business }: { business: Business }) {
  const { toast } = useToast();
  const { uploadFile, isUploading, progress } = useUpload();
  const queryClient = useQueryClient();

  const tier = business.membershipTier;
  const isBronze = tier === "basic" || tier === "bronze";

  const saveMutation = useMutation({
    mutationFn: async (logoUrl: string) => {
      const res = await fetch(`/api/businesses/${business.id}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ logoUrl }),
      });
      if (!res.ok) throw new Error("Failed to save logo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", business.id] });
      toast({ title: "Logo updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save logo", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/businesses/${business.id}/logo`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove logo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", business.id] });
      toast({ title: "Logo removed" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (result) saveMutation.mutate(result.objectPath);
    e.target.value = "";
  };

  if (isBronze) {
    return (
      <Card className="rounded-2xl border-[#0a4a82]/10 opacity-75">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-400" />
            Business Logo
          </CardTitle>
          <CardDescription>Upgrade to Silver or Gold to upload a logo</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-[#0a4a82]/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[#0a4a82]" />
          Business Logo
        </CardTitle>
        <CardDescription>Visible on your listing and directory card</CardDescription>
      </CardHeader>
      <CardContent>
        {business.logoUrl ? (
          <div className="flex items-center gap-4">
            <img src={business.logoUrl} alt="Logo" className="w-16 h-16 rounded-lg object-cover border-2 border-[#0a4a82]/15" />
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} data-testid="input-logo-replace" />
                <Button type="button" variant="outline" size="sm" asChild><span><Upload className="h-3.5 w-3.5 mr-1" /> Replace</span></Button>
              </label>
              <Button type="button" variant="outline" size="sm" className="text-red-500 hover:text-red-600" onClick={() => deleteMutation.mutate()} data-testid="button-logo-remove">
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <label className="cursor-pointer block">
            <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} data-testid="input-logo-upload" />
            <div className="border-2 border-dashed border-[#0a4a82]/20 rounded-xl p-4 text-center hover:border-[#0a4a82]/40 transition-colors">
              <Upload className="h-6 w-6 mx-auto text-[#0a4a82]/50 mb-2" />
              <p className="text-sm text-muted-foreground">Upload logo (JPG, PNG, WebP)</p>
            </div>
          </label>
        )}
        {isUploading && (
          <div className="mt-3 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#0a4a82] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardGalleryManager({ business }: { business: Business }) {
  const { toast } = useToast();
  const { uploadFile, isUploading, progress } = useUpload();
  const queryClient = useQueryClient();

  const tier = business.membershipTier;
  const canUpload = tier === "standard" || tier === "premium";
  const maxPhotos = tier === "premium" ? 10 : tier === "standard" ? 6 : 0;
  const currentPhotos: string[] = (business as any).galleryPhotos || [];

  const addMutation = useMutation({
    mutationFn: async (photoUrl: string) => {
      const res = await fetch(`/api/businesses/${business.id}/gallery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photoUrl }),
      });
      if (!res.ok) throw new Error("Failed to add photo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", business.id] });
      toast({ title: "Photo added" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (photoUrl: string) => {
      const res = await fetch(`/api/businesses/${business.id}/gallery`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photoUrl }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", business.id] });
      toast({ title: "Photo removed" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (result) addMutation.mutate(result.objectPath);
    e.target.value = "";
  };

  if (!canUpload) {
    return (
      <Card className="rounded-2xl border-[#0a4a82]/10 opacity-75">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-slate-400" />
            Photo Gallery
          </CardTitle>
          <CardDescription>Upgrade to Silver or Gold to add photos</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-[#0a4a82]/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Star className="h-4 w-4 text-[#d4a373]" />
          Photo Gallery
          <Badge variant="secondary" className="ml-auto text-xs">{currentPhotos.length}/{maxPhotos}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentPhotos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {currentPhotos.map((photo, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                <img src={photo.startsWith("/objects/") ? photo : `/objects/${photo}`} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                  onClick={() => removeMutation.mutate(photo)}
                  data-testid={`button-remove-photo-${i}`}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
        {currentPhotos.length < maxPhotos && (
          <label className="cursor-pointer block">
            <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} data-testid="input-gallery-upload" />
            <div className="border-2 border-dashed border-[#d4a373]/20 rounded-xl p-3 text-center hover:border-[#d4a373]/40 transition-colors">
              <Upload className="h-5 w-5 mx-auto text-[#d4a373]/50 mb-1" />
              <p className="text-xs text-muted-foreground">Add photo</p>
            </div>
          </label>
        )}
        {isUploading && (
          <div className="mt-2 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#d4a373] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardPromoVideoUploader({ business }: { business: Business }) {
  const { toast } = useToast();
  const { uploadFile, isUploading, progress } = useUpload();
  const queryClient = useQueryClient();

  const tier = business.membershipTier;
  const isGold = tier === "premium";

  if (!isGold) return null;

  const saveMutation = useMutation({
    mutationFn: async (videoUrl: string) => {
      const res = await fetch(`/api/businesses/${business.id}/promo-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ videoUrl }),
      });
      if (!res.ok) throw new Error("Failed to save video");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", business.id] });
      toast({ title: "Promo video updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/businesses/${business.id}/promo-video`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", business.id] });
      toast({ title: "Video removed" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Video must be under 50MB.", variant: "destructive" });
      return;
    }
    const result = await uploadFile(file);
    if (result) saveMutation.mutate(result.objectPath);
    e.target.value = "";
  };

  return (
    <Card className="rounded-2xl border-yellow-200/50 bg-gradient-to-r from-yellow-50/50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Crown className="h-4 w-4 text-yellow-600" />
          Promo Video
          <Badge className="bg-yellow-100 text-yellow-800 border-0 text-xs ml-auto">Gold Exclusive</Badge>
        </CardTitle>
        <CardDescription>30-second promotional video for your listing</CardDescription>
      </CardHeader>
      <CardContent>
        {(business as any).promoVideoUrl ? (
          <div className="space-y-3">
            <video src={(business as any).promoVideoUrl} controls className="w-full rounded-xl max-h-48" />
            <div className="flex gap-2">
              <label className="cursor-pointer flex-1">
                <input type="file" accept="video/*" className="hidden" onChange={handleFileSelect} data-testid="input-video-replace" />
                <Button type="button" variant="outline" size="sm" className="w-full" asChild><span><Upload className="h-3.5 w-3.5 mr-1" /> Replace</span></Button>
              </label>
              <Button type="button" variant="outline" size="sm" className="text-red-500" onClick={() => deleteMutation.mutate()} data-testid="button-video-remove">
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <label className="cursor-pointer block">
            <input type="file" accept="video/*" className="hidden" onChange={handleFileSelect} data-testid="input-video-upload" />
            <div className="border-2 border-dashed border-yellow-300/40 rounded-xl p-4 text-center hover:border-yellow-400/60 transition-colors">
              <Upload className="h-6 w-6 mx-auto text-yellow-500/50 mb-2" />
              <p className="text-sm text-muted-foreground">Upload promo video (MP4, max 50MB)</p>
            </div>
          </label>
        )}
        {isUploading && (
          <div className="mt-3 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const isBusinessAccount = user?.accountType === "business";

  const { data: validationData, isLoading } = useQuery<ValidationStatus>({
    queryKey: ["/api/user/validation-status"],
    enabled: isAuthenticated && !isBusinessAccount,
  });

  const { data: business, isLoading: businessLoading } = useQuery<Business>({
    queryKey: ["/api/businesses", user?.linkedBusinessId],
    queryFn: async () => {
      if (!user?.linkedBusinessId) return null;
      const res = await fetch(`/api/businesses/${user.linkedBusinessId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated && isBusinessAccount && !!user?.linkedBusinessId,
  });

  const { uploadFile } = useUpload({
    onSuccess: async (response) => {
      try {
        const res = await fetch("/api/user/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            fileName: response.metadata.name,
            fileUrl: response.objectPath,
          }),
        });
        
        if (res.ok) {
          toast({
            title: "Receipt uploaded",
            description: "Your receipt has been submitted for review.",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/user/validation-status"] });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save receipt",
          variant: "destructive",
        });
      }
      setIsUploading(false);
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Please try again",
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      await uploadFile(file);
    }
  };

  const loading = authLoading || isLoading || (isBusinessAccount && businessLoading);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
            <p className="text-muted-foreground mb-4">
              Please sign in to access your dashboard.
            </p>
            <Link to="/">
              <Button>Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isValidated = validationData?.isValidated || false;
  const receipts = validationData?.receipts || [];
  const pendingReceipts = receipts.filter(r => r.status === "pending");

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending Review</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a4a82] via-[#0a4a82]/95 to-[#f5f0eb] pb-20">
      <div className="bg-gradient-to-r from-[#0a4a82] to-[#083a6a] border-b border-white/10">
        <div className="container py-8">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-4 text-white/80 hover:text-white hover:bg-white/10" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-[#d4a373]/50 shadow-lg">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="bg-[#d4a373] text-white text-xl font-bold">
                {user?.firstName?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-white">
                Welcome, {user?.firstName || "User"}!
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-white/70">{user?.email}</p>
                <Badge className={isBusinessAccount ? "bg-[#d4a373] text-white border-0" : "bg-[#8a9a5b] text-white border-0"} data-testid="badge-account-type">
                  {isBusinessAccount ? "Business Account" : "Customer Account"}
                </Badge>
                {user?.isAdmin && (
                  <Badge className="bg-red-500/90 text-white border-0" data-testid="badge-admin">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {user?.isAdmin && (
        <div className="container py-6">
          <Card className="bg-gradient-to-br from-[#1a1a2e] to-[#0a0a1a] border-0 shadow-[0_8px_30px_rgba(0,0,0,0.3)] rounded-2xl overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#d4a373]/20 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-[#d4a373]" />
                </div>
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    Admin Dashboard
                    <Badge className="bg-[#d4a373] text-white border-0 text-xs">Admin</Badge>
                  </CardTitle>
                  <CardDescription className="text-white/50">Manage your platform</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link to="/admin/ads" data-testid="link-admin-ads">
                  <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 text-center transition-all cursor-pointer group">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <Megaphone className="h-6 w-6 text-blue-400" />
                    </div>
                    <p className="text-white font-medium text-sm">Manage Ads</p>
                    <p className="text-white/40 text-xs mt-1">Ad placements & pricing</p>
                  </div>
                </Link>
                <Link to="/admin/promo-codes" data-testid="link-admin-promos">
                  <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 text-center transition-all cursor-pointer group">
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <Tag className="h-6 w-6 text-green-400" />
                    </div>
                    <p className="text-white font-medium text-sm">Promo Codes</p>
                    <p className="text-white/40 text-xs mt-1">Discounts & campaigns</p>
                  </div>
                </Link>
                <Link to="/directory" data-testid="link-admin-businesses">
                  <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 text-center transition-all cursor-pointer group">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <Building2 className="h-6 w-6 text-purple-400" />
                    </div>
                    <p className="text-white font-medium text-sm">Businesses</p>
                    <p className="text-white/40 text-xs mt-1">View all listings</p>
                  </div>
                </Link>
                <Link to="/events" data-testid="link-admin-events">
                  <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 text-center transition-all cursor-pointer group">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <Calendar className="h-6 w-6 text-amber-400" />
                    </div>
                    <p className="text-white font-medium text-sm">Events</p>
                    <p className="text-white/40 text-xs mt-1">Community calendar</p>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isBusinessAccount ? (
        <BusinessDashboard user={user} business={business || null} />
      ) : (
        <div className="container py-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-1 bg-gradient-to-br from-[#0a4a82] to-[#062d54] border-0 shadow-[0_8px_30px_rgba(10,74,130,0.3)] rounded-2xl text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ShieldCheck className="h-5 w-5 text-[#d4a373]" />
                Validation Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isValidated ? (
                <div className="text-center py-6">
                  <div className="w-20 h-20 rounded-full bg-[#8a9a5b]/30 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-10 w-10 text-[#8a9a5b]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#8a9a5b] mb-2">Verified Customer</h3>
                  <p className="text-white/70 text-sm">
                    You can now post in the community feed and access all features.
                  </p>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-20 h-20 rounded-full bg-[#d4a373]/20 flex items-center justify-center mx-auto mb-4">
                    <Clock className="h-10 w-10 text-[#d4a373]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#d4a373] mb-2">Pending Verification</h3>
                  <p className="text-white/70 text-sm mb-4">
                    Upload a receipt to verify your account and unlock community posting. Each business review requires a receipt from that specific business.
                  </p>
                  {pendingReceipts.length > 0 && (
                    <p className="text-sm text-white/60">
                      {pendingReceipts.length} receipt(s) pending review
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl border-[#0a4a82]/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#1a1a2e]">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#d4a373] to-[#b8834f] flex items-center justify-center">
                  <Upload className="h-4 w-4 text-white" />
                </div>
                Upload Proof of Purchase
              </CardTitle>
              <CardDescription>
                Submit receipts from local businesses to verify your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-[#0a4a82]/20 rounded-xl p-8 text-center hover:border-[#0a4a82]/40 transition-colors bg-gradient-to-br from-[#0a4a82]/3 to-[#d4a373]/5">
                <FileText className="h-12 w-12 text-[#0a4a82]/40 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">
                  Drag and drop your receipt here, or click to browse
                </p>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="receipt-upload"
                  data-testid="input-receipt-upload"
                />
                <label htmlFor="receipt-upload">
                  <Button asChild disabled={isUploading} className="bg-gradient-to-r from-[#0a4a82] to-[#083a6a] hover:from-[#083a6a] hover:to-[#062d54] shadow-md" data-testid="button-upload-receipt">
                    <span>
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Choose File
                        </>
                      )}
                    </span>
                  </Button>
                </label>
                <p className="text-xs text-gray-400 mt-4">
                  Supported formats: JPG, PNG, PDF (Max 10MB)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl border-[#0a4a82]/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#1a1a2e]">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8a9a5b] to-[#6b7a42] flex items-center justify-center">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                Your Submitted Receipts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {receipts.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-[#0a4a82]/20" />
                  <p className="text-gray-500">No receipts submitted yet.</p>
                  <p className="text-sm text-gray-400">Upload your first receipt to get verified!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {receipts.map((receipt) => (
                    <div
                      key={receipt.id}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-[#0a4a82]/5 to-transparent rounded-xl border border-[#0a4a82]/10"
                      data-testid={`receipt-item-${receipt.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(receipt.status)}
                        <div>
                          <p className="font-medium text-[#1a1a2e]">{receipt.fileName}</p>
                          <p className="text-xs text-gray-400">
                            Uploaded {formatDistanceToNow(new Date(receipt.uploadedAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(receipt.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
