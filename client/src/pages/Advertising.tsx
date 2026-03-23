import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Megaphone, 
  Star, 
  TrendingUp, 
  Eye, 
  MousePointer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  Sparkles,
  Crown,
  LayoutGrid,
  Home,
  Building2,
  ChevronRight,
  Users,
  Calendar,
  Zap,
  ArrowRight,
  Gift,
  Check,
  Video,
  Pencil
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import type { AdPricing, AdPlacement } from "@shared/schema";

import { DIRECTORY_CATEGORY_NAMES } from "@shared/config/categories";
const CATEGORIES = DIRECTORY_CATEGORY_NAMES;

const placementIcons: Record<string, any> = {
  large_banner: Home,
  medium_banner: Home,
  small_banner: Home,
  category_spotlight: LayoutGrid,
  directory_boost: TrendingUp,
};

const BANNER_PLACEMENTS = ["large_banner", "medium_banner", "small_banner"];

const AD_BASE_PRICING = {
  monthly: { small: 250, medium: 500, large: 1000 },
  event2Week: { small: 25, medium: 35, large: 50 },
  eventMonthly: { small: 50, medium: 75, large: 100 },
};

const TIER_DISCOUNTS = [
  { id: null, name: "Basic", discount: 0, icon: Users, color: "slate", gradient: "from-slate-600 to-slate-800", badgeText: null },
  { id: "bronze", name: "Bronze", discount: 0.10, icon: Crown, color: "amber", gradient: "from-amber-700 to-amber-600", badgeText: "10% OFF" },
  { id: "silver", name: "Silver", discount: 0.25, icon: Crown, color: "gray", gradient: "from-gray-500 to-gray-400", badgeText: "25% OFF" },
  { id: "gold", name: "Gold", discount: 0.50, icon: Crown, color: "yellow", gradient: "from-yellow-600 to-amber-500", badgeText: "50% OFF" },
] as const;

function getTierPrice(basePrice: number, discount: number): number {
  return Math.round(basePrice * (1 - discount));
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-500 text-white"><CheckCircle2 className="h-3 w-3 mr-1" /> Active</Badge>;
    case "pending":
      return <Badge className="bg-yellow-500 text-white"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    case "expired":
      return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" /> Expired</Badge>;
    case "rejected":
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getPaymentBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-[#8a9a5b] text-white">Paid</Badge>;
    case "unpaid":
      return <Badge className="bg-orange-500 text-white">Awaiting Payment</Badge>;
    case "refunded":
      return <Badge variant="secondary">Refunded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function Advertising() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<AdPlacement | null>(null);
  const [formData, setFormData] = useState({
    placementType: "",
    adSize: "small" as "small" | "medium" | "large",
    title: "",
    description: "",
    imageUrl: "",
    videoUrl: "",
    linkUrl: "",
    category: "",
  });

  const { data: pricing, isLoading: pricingLoading } = useQuery<AdPricing[]>({
    queryKey: ["/api/ads/pricing"],
  });

  const { data: myAds, isLoading: myAdsLoading } = useQuery<AdPlacement[]>({
    queryKey: ["/api/ads/my-ads"],
    enabled: isAuthenticated && user?.accountType === "business",
  });

  const { data: linkedBusiness } = useQuery<any>({
    queryKey: ["/api/businesses", user?.linkedBusinessId],
    queryFn: async () => {
      if (!user?.linkedBusinessId) return null;
      const res = await fetch(`/api/businesses/${user.linkedBusinessId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated && user?.accountType === "business" && !!user?.linkedBusinessId,
  });

  const businessMedia: string[] = [];
  if (linkedBusiness?.logoUrl) businessMedia.push(linkedBusiness.logoUrl);
  if (linkedBusiness?.galleryPhotos?.length) businessMedia.push(...linkedBusiness.galleryPhotos);

  const membershipTier = linkedBusiness?.membershipTier || "none";
  const tierVideoLimits: Record<string, number> = { basic: 10, standard: 20, premium: 30 };
  const videoLimit = tierVideoLimits[membershipTier] || 0;

  const createAdRequest = useMutation({
    mutationFn: async (data: typeof formData) => {
      const selectedPricing = pricing?.find(p => p.placementType === data.placementType);
      const res = await fetch("/api/ads/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          pricePerWeek: selectedPricing?.pricePerWeek,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to submit ad request");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Ad Request Submitted!",
        description: "We'll review your ad and contact you about monthly billing.",
      });
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/ads/my-ads"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to submit ad request",
      });
    },
  });

  const updateAdRequest = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const res = await fetch(`/api/ads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update ad");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Ad Updated!", description: "Your ad changes have been saved." });
      setEditingAd(null);
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/ads/my-ads"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  function resetForm() {
    setFormData({ placementType: "", adSize: "small", title: "", description: "", imageUrl: "", videoUrl: "", linkUrl: "", category: "" });
    setEditingAd(null);
  }

  function openEditDialog(ad: AdPlacement) {
    setEditingAd(ad);
    setFormData({
      placementType: ad.placementType,
      adSize: (ad.adSize as "small" | "medium" | "large") || "small",
      title: ad.title,
      description: ad.description || "",
      imageUrl: ad.imageUrl || "",
      videoUrl: ad.videoUrl || "",
      linkUrl: ad.linkUrl || "",
      category: ad.category || "",
    });
    setIsCreateOpen(true);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.placementType || !formData.title) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select a placement type and enter a title.",
      });
      return;
    }
    if (editingAd) {
      updateAdRequest.mutate({ id: editingAd.id, data: formData });
    } else {
      createAdRequest.mutate(formData);
    }
  };

  const selectedPricing = pricing?.find(p => p.placementType === formData.placementType);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Premium Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a4a82] via-[#0a4a82]/95 to-[#083a6a]" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=600&fit=crop')] bg-cover bg-center opacity-15" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a4a82] via-transparent to-transparent" />
        
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#d4a373]/10 rounded-full blur-3xl" />
        
        <div className="relative container py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-white/20">
              <Megaphone className="h-4 w-4 text-[#d4a373]" />
              <span className="text-white/90 text-sm font-medium">Reach Thousands of Local Customers</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Advertise Your Business
              <span className="block bg-gradient-to-r from-[#d4a373] to-amber-300 bg-clip-text text-transparent">
                Where It Matters
              </span>
            </h1>
            
            <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              Premium ad placements that put your business in front of customers 
              actively searching for services in Moyock.
            </p>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" 
              className="fill-slate-50 dark:fill-slate-950"/>
          </svg>
        </div>
      </div>

      <div className="container py-16">
        {/* Member Savings Banner */}
        <div className="relative mb-16 bg-gradient-to-r from-[#8a9a5b] to-[#6b7a4a] rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920')] bg-cover bg-center opacity-10" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          
          <div className="relative p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Crown className="h-8 w-8 text-white" />
              </div>
              <div className="text-white">
                <h3 className="text-2xl font-bold">Members Save Up to 50% on All Advertising</h3>
                <p className="text-white/80 mt-1">
                  Bronze 10% off, Silver 25% off, Gold 50% off — plus 1 month free when you prepay 6 months
                </p>
              </div>
            </div>
            <Link to="/membership">
              <Button size="lg" className="bg-white text-[#8a9a5b] hover:bg-white/90 h-14 px-8 rounded-xl font-semibold shadow-lg" data-testid="button-view-membership">
                <Building2 className="mr-2 h-5 w-5" />
                View Membership
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Web Advertising Pricing Section */}
        <div className="mb-20" id="web-advertising">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4" data-testid="heading-web-advertising">
              Compare Advertising Rates
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Members enjoy exclusive discounts on all advertising options
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {TIER_DISCOUNTS.map((tier) => {
              const TierIcon = tier.icon;
              const isGold = tier.id === "gold";
              return (
                <div
                  key={tier.name}
                  className={`relative bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border ${isGold ? "ring-2 ring-[#8a9a5b] shadow-2xl shadow-[#8a9a5b]/20" : "border-slate-200/50 dark:border-slate-700/50"}`}
                  data-testid={`card-web-pricing-${tier.id || "basic"}`}
                >
                  {tier.badgeText && (
                    <div className="absolute -top-0 right-4 z-10">
                      <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-3 py-1.5 rounded-b-xl text-xs font-bold shadow-lg flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {tier.badgeText}
                      </div>
                    </div>
                  )}

                  <div className={`bg-gradient-to-br ${tier.gradient} p-5 text-white`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <TierIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{tier.name}</h3>
                        <p className="text-white/70 text-xs">
                          {tier.discount > 0 ? `${tier.discount * 100}% off all ads` : "Standard pricing"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Monthly Ads</h4>
                    </div>
                    <div className="space-y-2">
                      {(["small", "medium", "large"] as const).map((size) => (
                        <div key={size} className={`rounded-xl p-3 text-center ${tier.id ? "bg-[#8a9a5b]/10 border border-[#8a9a5b]/20" : "bg-slate-100 dark:bg-slate-700/50"}`}>
                          <p className={`text-xl font-bold ${tier.id ? "text-[#8a9a5b]" : "text-slate-900 dark:text-white"}`}>
                            ${getTierPrice(AD_BASE_PRICING.monthly[size], tier.discount)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{size}</p>
                        </div>
                      ))}
                    </div>

                    {isGold && (
                      <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-amber-200/50 dark:border-amber-700/30" data-testid="gold-promo-video-perk-web">
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">30-Sec Promo Video</span>
                        </div>
                        <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-1 ml-6">Upload a video spotlight to your business listing</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        {!isAuthenticated ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#0a4a82]/10 flex items-center justify-center">
                <Megaphone className="h-10 w-10 text-[#0a4a82]" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Sign In to Advertise</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8">
                Create a business account to purchase ad space and promote your business.
              </p>
              <Link to="/auth">
                <Button size="lg" className="bg-[#0a4a82] hover:bg-[#083a6a] h-14 px-8 rounded-xl text-lg font-semibold">
                  Sign In to Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        ) : user?.accountType !== "business" ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#0a4a82]/10 flex items-center justify-center">
                <Building2 className="h-10 w-10 text-[#0a4a82]" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Business Account Required</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8">
                Switch to a business account to advertise on Local List 365.
              </p>
              <Link to="/dashboard">
                <Button size="lg" className="bg-[#0a4a82] hover:bg-[#083a6a] h-14 px-8 rounded-xl text-lg font-semibold">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ad Placement Options</h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">Choose where your ad appears</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="bg-[#0a4a82] hover:bg-[#083a6a] h-12 px-6 rounded-xl font-semibold" data-testid="button-create-ad">
                      <Megaphone className="mr-2 h-5 w-5" />
                      Request Ad Space
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Megaphone className="h-5 w-5 text-[#0a4a82]" />
                        {editingAd ? "Edit Ad" : "Request Ad Space"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Placement Type *</Label>
                        <Select 
                          value={formData.placementType} 
                          onValueChange={(v) => setFormData({ ...formData, placementType: v })}
                          disabled={!!editingAd}
                        >
                          <SelectTrigger data-testid="select-placement-type">
                            <SelectValue placeholder="Select ad placement" />
                          </SelectTrigger>
                          <SelectContent>
                            {pricing?.map((p) => (
                              <SelectItem key={p.placementType} value={p.placementType}>
                                {p.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedPricing && (
                          <p className="text-sm text-muted-foreground">{selectedPricing.description}</p>
                        )}
                      </div>

                      {BANNER_PLACEMENTS.includes(formData.placementType) && (
                        <div className="space-y-2">
                          <Label>Ad Size *</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {(["small", "medium", "large"] as const).map((size) => {
                              const sizePricing = AD_BASE_PRICING.monthly[size];
                              const tierDiscount = TIER_DISCOUNTS.find(t => {
                                if (membershipTier === "basic") return t.id === "bronze";
                                if (membershipTier === "standard") return t.id === "silver";
                                if (membershipTier === "premium") return t.id === "gold";
                                return t.id === null;
                              });
                              const discount = tierDiscount?.discount || 0;
                              const finalPrice = getTierPrice(sizePricing, discount);
                              const isSelected = formData.adSize === size;
                              return (
                                <button
                                  key={size}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, adSize: size })}
                                  className={`rounded-xl p-3 text-center border-2 transition-all ${isSelected ? "border-[#0a4a82] bg-[#0a4a82]/5 ring-1 ring-[#0a4a82]/20" : "border-slate-200 hover:border-[#d4a373]/50"}`}
                                  data-testid={`ad-size-${size}`}
                                >
                                  <p className={`text-lg font-bold ${isSelected ? "text-[#0a4a82]" : "text-slate-700"}`}>${finalPrice}</p>
                                  <p className="text-xs text-slate-500 capitalize">{size}/mo</p>
                                  {discount > 0 && (
                                    <p className="text-[10px] text-green-600 font-medium mt-0.5">{discount * 100}% off</p>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="title">Ad Title *</Label>
                        <Input
                          id="title"
                          placeholder="e.g., Spring Special - 20% Off"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                          className="bg-white"
                          data-testid="input-ad-title"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          placeholder="Brief description of your ad..."
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                          className="bg-white"
                          data-testid="input-ad-description"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Ad Image</Label>
                        {businessMedia.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-[#4a4a5a]">Choose from your uploaded media:</p>
                            <div className="grid grid-cols-4 gap-2">
                              {businessMedia.map((url, i) => {
                                const src = url.startsWith("/objects/") ? url : `/objects/${url}`;
                                const isSelected = formData.imageUrl === url;
                                return (
                                  <div
                                    key={i}
                                    onClick={() => setFormData({ ...formData, imageUrl: url })}
                                    className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${isSelected ? "border-[#0a4a82] ring-2 ring-[#0a4a82]/30 scale-95" : "border-transparent hover:border-[#d4a373]/50"}`}
                                    data-testid={`media-option-${i}`}
                                  >
                                    <img src={src} alt={`Media ${i + 1}`} className="w-full h-full object-cover" />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className="pt-1">
                          <p className="text-xs text-[#4a4a5a] mb-1">{businessMedia.length > 0 ? "Or paste an external URL:" : "Paste an image URL:"}</p>
                          <Input
                            id="imageUrl"
                            placeholder="https://example.com/image.jpg"
                            value={formData.imageUrl}
                            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                            style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                            className="bg-white"
                            data-testid="input-ad-image"
                          />
                        </div>
                        {!businessMedia.length && user?.accountType === "business" && (
                          <p className="text-xs text-[#d4a373]">
                            Tip: Upload a logo and gallery photos on your listing page to easily use them here.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Video className="h-4 w-4" />
                          Video Ad URL (optional)
                          {videoLimit > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">max {videoLimit}s</Badge>
                          )}
                        </Label>
                        {videoLimit > 0 ? (
                          <>
                            <Input
                              placeholder="https://example.com/promo-video.mp4"
                              value={formData.videoUrl}
                              onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                              style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                              className="bg-white"
                              data-testid="input-ad-video"
                            />
                            <p className="text-xs text-slate-500">
                              {membershipTier === "premium" ? "Gold" : membershipTier === "standard" ? "Silver" : "Bronze"}: up to {videoLimit}-second video ad
                            </p>
                          </>
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                            <p className="text-xs text-slate-500">Video ads require a membership</p>
                            <p className="text-[10px] text-slate-400 mt-1">Bronze: 10s | Silver: 20s | Gold: 30s</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="linkUrl">Link URL (optional)</Label>
                        <Input
                          id="linkUrl"
                          placeholder="https://yourbusiness.com"
                          value={formData.linkUrl}
                          onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                          style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                          className="bg-white"
                          data-testid="input-ad-link"
                        />
                      </div>

                      {formData.placementType === "category_spotlight" && (
                        <div className="space-y-2">
                          <Label>Target Category</Label>
                          <Select 
                            value={formData.category} 
                            onValueChange={(v) => setFormData({ ...formData, category: v })}
                          >
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="bg-[#0a4a82]/5 p-4 rounded-xl border border-[#0a4a82]/10">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {BANNER_PLACEMENTS.includes(formData.placementType) ? "Monthly Price:" : "Weekly Price:"}
                          </span>
                          <span className="text-2xl font-bold text-[#0a4a82]">
                            {BANNER_PLACEMENTS.includes(formData.placementType) ? (
                              <>
                                ${getTierPrice(AD_BASE_PRICING.monthly[formData.adSize], TIER_DISCOUNTS.find(t => {
                                  if (membershipTier === "basic") return t.id === "bronze";
                                  if (membershipTier === "standard") return t.id === "silver";
                                  if (membershipTier === "premium") return t.id === "gold";
                                  return t.id === null;
                                })?.discount || 0)}/mo
                              </>
                            ) : selectedPricing ? (
                              <>
                                ${getTierPrice(selectedPricing.pricePerWeek / 100, TIER_DISCOUNTS.find(t => {
                                  if (membershipTier === "basic") return t.id === "bronze";
                                  if (membershipTier === "standard") return t.id === "silver";
                                  if (membershipTier === "premium") return t.id === "gold";
                                  return t.id === null;
                                })?.discount || 0)}/wk
                              </>
                            ) : "$0"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                          After submitting, we'll review and activate your ad.
                        </p>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full h-12 rounded-xl bg-[#0a4a82] hover:bg-[#083a6a] font-semibold"
                        disabled={createAdRequest.isPending || updateAdRequest.isPending}
                        data-testid="button-submit-ad"
                      >
                        {(createAdRequest.isPending || updateAdRequest.isPending) ? "Submitting..." : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            {editingAd ? "Save Changes" : "Submit Ad Request"}
                          </>
                        )}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {pricingLoading ? (
                <div className="grid md:grid-cols-2 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg">
                      <Skeleton className="h-12 w-12 rounded-xl mb-4" />
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-full mb-4" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Homepage Banners</h3>
                  <div className="grid md:grid-cols-3 gap-5 mb-10">
                    {pricing?.filter(p => BANNER_PLACEMENTS.includes(p.placementType)).map((p) => {
                      const Icon = placementIcons[p.placementType] || Megaphone;
                      const sizeLabel = p.placementType === "large_banner" ? "Large" : p.placementType === "medium_banner" ? "Medium" : "Small";
                      const sizeDesc = p.placementType === "large_banner" ? "Full-width" : p.placementType === "medium_banner" ? "75% width" : "Compact";
                      const gradients: Record<string, string> = {
                        large_banner: "from-[#0a4a82] to-[#083a6a]",
                        medium_banner: "from-[#8a9a5b] to-[#6b7a4a]",
                        small_banner: "from-[#d4a373] to-[#c49363]",
                      };
                      return (
                        <div 
                          key={p.id} 
                          className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-xl hover:-translate-y-1 transition-[shadow,transform] duration-200 border border-slate-100 dark:border-slate-700"
                          data-testid={`card-pricing-${p.placementType}`}
                        >
                          <div className={`bg-gradient-to-br ${gradients[p.placementType] || "from-slate-600 to-slate-800"} p-5`}>
                            <div className="flex items-center justify-between">
                              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <Icon className="h-6 w-6 text-white" />
                              </div>
                              <div className="text-right">
                                <span className="text-3xl font-bold text-white">
                                  ${(p.pricePerWeek * 4 / 100).toFixed(0)}
                                </span>
                                <span className="text-white/70 text-sm">/mo</span>
                              </div>
                            </div>
                          </div>
                          <div className="p-5">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-lg text-slate-900 dark:text-white">{sizeLabel} Banner</h3>
                              <Badge variant="outline" className="text-xs">{sizeDesc}</Badge>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-sm mb-5">{p.description}</p>
                            <Button 
                              className="w-full h-11 rounded-xl bg-[#8a9a5b] hover:bg-[#7a8a4b] font-semibold"
                              onClick={() => {
                                const size = p.placementType === "large_banner" ? "large" : p.placementType === "medium_banner" ? "medium" : "small";
                                setFormData({ ...formData, placementType: p.placementType, adSize: size as any });
                                setIsCreateOpen(true);
                              }}
                              data-testid={`button-select-${p.placementType}`}
                            >
                              Select This Placement
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Boost Your Listing</h3>
                  <div className="grid md:grid-cols-2 gap-5">
                    {pricing?.filter(p => !BANNER_PLACEMENTS.includes(p.placementType)).map((p) => {
                      const Icon = placementIcons[p.placementType] || Megaphone;
                      const gradients: Record<string, string> = {
                        category_spotlight: "from-purple-600 to-purple-800",
                        directory_boost: "from-amber-600 to-amber-700",
                      };
                      return (
                        <div 
                          key={p.id} 
                          className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-xl hover:-translate-y-1 transition-[shadow,transform] duration-200 border border-slate-100 dark:border-slate-700"
                          data-testid={`card-pricing-${p.placementType}`}
                        >
                          <div className={`bg-gradient-to-br ${gradients[p.placementType] || "from-slate-600 to-slate-800"} p-5`}>
                            <div className="flex items-center justify-between">
                              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <Icon className="h-6 w-6 text-white" />
                              </div>
                              <div className="text-right">
                                <span className="text-3xl font-bold text-white">
                                  ${(p.pricePerWeek / 100).toFixed(0)}
                                </span>
                                <span className="text-white/70 text-sm">/week</span>
                              </div>
                            </div>
                          </div>
                          <div className="p-5">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{p.displayName}</h3>
                            <p className="text-slate-600 dark:text-slate-400 text-sm mb-5">{p.description}</p>
                            <Button 
                              className="w-full h-11 rounded-xl bg-[#8a9a5b] hover:bg-[#7a8a4b] font-semibold"
                              onClick={() => {
                                setFormData({ ...formData, placementType: p.placementType });
                                setIsCreateOpen(true);
                              }}
                              data-testid={`button-select-${p.placementType}`}
                            >
                              Select This Placement
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* My Ads Sidebar */}
            <div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700 sticky top-28 overflow-hidden">
                <div className="bg-gradient-to-r from-[#0a4a82] to-[#083a6a] p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-white">
                      <h3 className="font-bold">My Ads</h3>
                      <p className="text-white/70 text-sm">Track your campaigns</p>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  {myAdsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-20 w-full rounded-xl" />
                      <Skeleton className="h-20 w-full rounded-xl" />
                    </div>
                  ) : !myAds || myAds.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <Megaphone className="h-8 w-8 opacity-50" />
                      </div>
                      <p className="font-medium">No ads yet</p>
                      <p className="text-sm mt-1">Request your first ad placement above!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myAds.map((ad) => (
                        <div key={ad.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl" data-testid={`card-my-ad-${ad.id}`}>
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <h4 className="font-medium text-sm line-clamp-1 text-slate-900 dark:text-white">{ad.title}</h4>
                            {getStatusBadge(ad.status || "pending")}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            {getPaymentBadge(ad.paymentStatus || "unpaid")}
                            {ad.adSize && (
                              <Badge variant="outline" className="text-[10px] capitalize">{ad.adSize}</Badge>
                            )}
                            {ad.videoUrl && (
                              <Badge variant="outline" className="text-[10px]"><Video className="h-2.5 w-2.5 mr-0.5" />Video</Badge>
                            )}
                          </div>
                          {ad.priceMonthly && (
                            <p className="text-xs font-semibold text-[#0a4a82] mb-2">
                              ${(ad.priceMonthly / 100).toFixed(0)}/mo
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <Eye className="h-3.5 w-3.5" />
                              {ad.impressions || 0} views
                            </span>
                            <span className="flex items-center gap-1.5">
                              <MousePointer className="h-3.5 w-3.5" />
                              {ad.clicks || 0} clicks
                            </span>
                          </div>
                          {ad.createdAt && (
                            <p className="text-xs text-slate-400 mt-2">
                              Requested {formatDistanceToNow(new Date(ad.createdAt), { addSuffix: true })}
                            </p>
                          )}
                          {(ad.status === "pending" || ad.status === "expired") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 h-8 text-xs text-[#0a4a82] hover:text-[#083a6a] hover:bg-[#0a4a82]/5 w-full"
                              onClick={() => openEditDialog(ad)}
                              data-testid={`button-edit-ad-${ad.id}`}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit Ad
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Benefits Section */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Why Advertise With Us?
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Get your business in front of customers who are actively searching for local services
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { 
                icon: Eye, 
                title: "Maximum Visibility", 
                desc: "Reach thousands of local customers actively looking for services",
                color: "text-[#0a4a82]",
                bg: "bg-[#0a4a82]/10"
              },
              { 
                icon: TrendingUp, 
                title: "Track Performance", 
                desc: "See exactly how many people view and click your ads in real-time",
                color: "text-[#d4a373]",
                bg: "bg-[#d4a373]/10"
              },
              { 
                icon: Sparkles, 
                title: "Flexible Options", 
                desc: "Choose from multiple placement types to fit your budget and goals",
                color: "text-[#8a9a5b]",
                bg: "bg-[#8a9a5b]/10"
              }
            ].map((item, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700 text-center hover:shadow-xl transition-shadow">
                <div className={`w-16 h-16 mx-auto mb-5 rounded-2xl ${item.bg} flex items-center justify-center`}>
                  <item.icon className={`h-8 w-8 ${item.color}`} />
                </div>
                <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-3">{item.title}</h3>
                <p className="text-slate-600 dark:text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
