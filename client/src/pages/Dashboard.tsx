import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
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
    <Card className="shadow-[0_8px_30px_rgba(0,0,0,0.12)]" data-testid="card-analytics">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-[#0a4a82]" />
          Listing Analytics
        </CardTitle>
        <CardDescription>Last 30 days of activity on your business listing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(EVENT_LABELS).map(([key, { label, icon: Icon, color }]) => (
            <div key={key} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50" data-testid={`stat-${key}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                </div>
              </div>
              <p className="text-xl font-bold text-[#1a1a2e]">{(totals30d[key] || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-[#1a1a2e]">Daily Traffic (14 days)</h4>
            <Badge variant="secondary" className="text-xs">
              <MousePointerClick className="h-3 w-3 mr-1" />
              {totalInteractions} total interactions
            </Badge>
          </div>
          <div className="flex items-end gap-1 h-32" data-testid="chart-daily-traffic">
            {chartData.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1a1a2e] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {day.date}: {day.total} events
                </div>
                <div 
                  className="w-full rounded-t-sm transition-all duration-300 group-hover:opacity-80"
                  style={{ 
                    height: `${Math.max((day.total / maxTotal) * 100, 4)}%`,
                    background: day.total > 0 
                      ? `linear-gradient(to top, #0a4a82, #0a4a82cc)` 
                      : '#e5e7eb',
                    minHeight: '4px',
                  }}
                />
                <span className="text-[9px] text-gray-400 leading-none hidden sm:block">{day.date.split(' ')[1]}</span>
              </div>
            ))}
          </div>
        </div>

        {analytics && Object.keys(analytics.allTime).length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-[#1a1a2e] mb-3">All-Time Totals</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {Object.entries(EVENT_LABELS).map(([key, { label, icon: Icon, color }]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                  <span className="text-gray-600">{label}:</span>
                  <span className="font-semibold text-[#1a1a2e]">{(analytics.allTime[key] || 0).toLocaleString()}</span>
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
        <Card className="shadow-[0_8px_30px_rgba(0,0,0,0.12)] border-[#d4a373]/30">
          <CardContent className="py-12 text-center">
            <div className="w-20 h-20 rounded-full bg-[#0a4a82]/10 flex items-center justify-center mx-auto mb-6">
              <Building2 className="h-10 w-10 text-[#0a4a82]" />
            </div>
            <h2 className="text-2xl font-bold text-[#1a1a2e] mb-3" data-testid="text-no-business">
              Create Your Business Listing
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Get your business listed in the Local List 365 directory and start connecting with customers in your community.
            </p>
            <Link to="/create-business">
              <Button size="lg" className="bg-[#0a4a82] hover:bg-[#083a6a] h-14 px-8 rounded-xl text-lg font-semibold" data-testid="button-create-business">
                <Plus className="h-5 w-5 mr-2" />
                Create Business Listing
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-500">Your Listing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  {business.logoUrl ? (
                    <img src={business.logoUrl} alt={business.name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#0a4a82]/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-[#0a4a82]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-[#1a1a2e] truncate" data-testid="text-business-name">{business.name}</p>
                    <p className="text-xs text-gray-500">{business.category}</p>
                  </div>
                </div>
                <Link to={`/directory/${business.id}`} className="mt-4 block">
                  <Button variant="outline" size="sm" className="w-full" data-testid="button-view-listing">
                    <Eye className="h-4 w-4 mr-2" />
                    View Public Listing
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-500">Membership</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-3">
                  {tier && tier !== "none" ? (
                    <MembershipBadge tier={tier} variant="compact" />
                  ) : (
                    <Badge variant="secondary" className="text-gray-500">No Membership</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {tier && tier !== "none"
                    ? `You're on the ${tierName} plan`
                    : "Upgrade to get more visibility and features"}
                </p>
                <Link to="/membership">
                  <Button variant="outline" size="sm" className="w-full" data-testid="button-manage-membership">
                    <Crown className="h-4 w-4 mr-2" />
                    {tier && tier !== "none" ? "Manage Plan" : "View Plans"}
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-500">Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                  <span className="text-2xl font-bold text-[#1a1a2e]" data-testid="text-avg-rating">
                    {business.averageRating ? Number(business.averageRating).toFixed(1) : "—"}
                  </span>
                  <span className="text-sm text-gray-500">({business.reviewCount || 0} reviews)</span>
                </div>
                <Link to={`/directory/${business.id}`}>
                  <Button variant="outline" size="sm" className="w-full" data-testid="button-view-reviews">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Reviews
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5 text-[#0a4a82]" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to={`/directory/${business.id}`} className="block">
                  <Button variant="outline" className="w-full justify-between h-12" data-testid="button-edit-listing">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Manage Listing
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/jobs" className="block">
                  <Button variant="outline" className="w-full justify-between h-12" data-testid="button-post-job">
                    <span className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Post a Job ($7/week)
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/membership" className="block">
                  <Button variant="outline" className="w-full justify-between h-12" data-testid="button-upgrade-plan">
                    <span className="flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      {tier && tier !== "none" ? "Upgrade Membership" : "Get a Membership"}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/advertising" className="block">
                  <Button variant="outline" className="w-full justify-between h-12" data-testid="button-advertise">
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Advertise Your Business
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-[#0a4a82]" />
                  Business Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Category</span>
                  <span className="font-medium text-[#1a1a2e]" data-testid="text-business-category">{business.category}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Location</span>
                  <span className="font-medium text-[#1a1a2e]" data-testid="text-business-location">{business.city}, {business.state}</span>
                </div>
                {business.phone && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium text-[#1a1a2e]">{business.phone}</span>
                  </div>
                )}
                {business.websiteUrl && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Website</span>
                    <a href={business.websiteUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[#0a4a82] hover:underline truncate max-w-[200px]">
                      {business.websiteUrl.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Credentials</span>
                  <div className="flex gap-1.5">
                    {business.hasLLC && <Badge variant="secondary" className="text-xs">LLC</Badge>}
                    {business.hasInsurance && <Badge variant="secondary" className="text-xs">Insured</Badge>}
                    {business.isLicensed && <Badge variant="secondary" className="text-xs">Licensed</Badge>}
                    {!business.hasLLC && !business.hasInsurance && !business.isLicensed && (
                      <span className="text-gray-400">None added</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <AnalyticsDashboard businessId={business.id} />
        </>
      )}
    </div>
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
    <div className="min-h-screen bg-muted/30 pb-20">
      <div className="bg-white/90 dark:bg-card/90 backdrop-blur-sm border-b">
        <div className="container py-8">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {user?.firstName?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight">
                Welcome, {user?.firstName || "User"}!
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-muted-foreground">{user?.email}</p>
                <Badge variant="outline" className={isBusinessAccount ? "border-[#0a4a82] text-[#0a4a82]" : "border-[#8a9a5b] text-[#8a9a5b]"} data-testid="badge-account-type">
                  {isBusinessAccount ? "Business Account" : "Customer Account"}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isBusinessAccount ? (
        <BusinessDashboard user={user} business={business || null} />
      ) : (
        <div className="container py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Validation Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isValidated ? (
                <div className="text-center py-6">
                  <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">Verified Customer</h3>
                  <p className="text-muted-foreground text-sm">
                    You can now post in the community feed and access all features.
                  </p>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                    <Clock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400 mb-2">Pending Verification</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Upload a receipt to verify your account and unlock community posting. Remember: each business review requires a receipt from that specific business.
                  </p>
                  {pendingReceipts.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {pendingReceipts.length} receipt(s) pending review
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Proof of Purchase
              </CardTitle>
              <CardDescription>
                Submit receipts from local businesses to verify your account. To leave a review for a specific business, you must upload a receipt from that business.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
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
                  <Button asChild disabled={isUploading} data-testid="button-upload-receipt">
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
                <p className="text-xs text-muted-foreground mt-4">
                  Supported formats: JPG, PNG, PDF (Max 10MB)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Your Submitted Receipts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {receipts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No receipts submitted yet.</p>
                  <p className="text-sm">Upload your first receipt to get verified!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {receipts.map((receipt) => (
                    <div
                      key={receipt.id}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                      data-testid={`receipt-item-${receipt.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(receipt.status)}
                        <div>
                          <p className="font-medium">{receipt.fileName}</p>
                          <p className="text-xs text-muted-foreground">
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
