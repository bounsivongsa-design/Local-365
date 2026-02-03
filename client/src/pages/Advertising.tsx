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
  ChevronRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import type { AdPricing, AdPlacement } from "@shared/schema";

const CATEGORIES = [
  "Home Repair", "Plumbing", "HVAC", "Electrical", "Roofing",
  "Landscaping", "Cleaning", "Painting", "Tree Care", "Remodeling & Addition",
  "New Construction", "Baby Sitting & Nanny", "Printing", "Web Design & Logo Design",
  "Photo & Video", "Auto Repair", "Small Engine Repair", "Trash & Junk Removal",
  "Tutor & Mentor Counseling", "Mind Body Soul", "Tax CPA", "Legal",
  "Woodworking & Lazer CNC", "Baking & Cooking", "Catering Food Trucks", "Event Planning & Rentals"
];

const placementIcons: Record<string, any> = {
  homepage_banner: Home,
  featured_listing: Star,
  category_spotlight: LayoutGrid,
  directory_boost: TrendingUp,
};

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
  const [formData, setFormData] = useState({
    placementType: "",
    title: "",
    description: "",
    imageUrl: "",
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
        description: "We'll review your ad and contact you about payment.",
      });
      setIsCreateOpen(false);
      setFormData({
        placementType: "",
        title: "",
        description: "",
        imageUrl: "",
        linkUrl: "",
        category: "",
      });
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
    createAdRequest.mutate(formData);
  };

  const selectedPricing = pricing?.find(p => p.placementType === formData.placementType);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a4a82]/5 to-background">
      <div className="bg-gradient-to-r from-[#0a4a82] to-[#0a4a82]/80 text-white py-16">
        <div className="container">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
              <Megaphone className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">Advertise Your Business</h1>
              <p className="text-white/80 mt-1">Reach more local customers with premium ad placements</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="mb-8 bg-gradient-to-r from-[#8a9a5b]/10 to-[#0a4a82]/10 rounded-xl p-6 border border-[#8a9a5b]/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#8a9a5b]/20 flex items-center justify-center">
                <Crown className="h-6 w-6 text-[#8a9a5b]" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Members Save 50% on Advertising!</h3>
                <p className="text-sm text-muted-foreground">
                  Plus get 2 months free when you prepay 6 months
                </p>
              </div>
            </div>
            <Link to="/membership">
              <Button variant="outline" className="border-[#8a9a5b] text-[#8a9a5b]" data-testid="button-view-membership">
                <Building2 className="mr-2 h-4 w-4" />
                View Membership Plans
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {!isAuthenticated ? (
          <Card className="max-w-2xl mx-auto text-center p-8">
            <Megaphone className="h-16 w-16 mx-auto text-[#0a4a82]/30 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Sign In to Advertise</h2>
            <p className="text-muted-foreground mb-6">
              Create a business account to purchase ad space and promote your business.
            </p>
            <Link to="/api/login">
              <Button size="lg" className="bg-[#0a4a82]">Sign In</Button>
            </Link>
          </Card>
        ) : user?.accountType !== "business" ? (
          <Card className="max-w-2xl mx-auto text-center p-8">
            <Megaphone className="h-16 w-16 mx-auto text-[#0a4a82]/30 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Business Account Required</h2>
            <p className="text-muted-foreground mb-6">
              Switch to a business account to advertise on Local List 365.
            </p>
            <Link to="/dashboard">
              <Button size="lg" className="bg-[#0a4a82]">Go to Dashboard</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Available Ad Placements</h2>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#0a4a82] hover:bg-[#093d6b]" data-testid="button-create-ad">
                      <Megaphone className="mr-2 h-4 w-4" />
                      Request Ad Space
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Megaphone className="h-5 w-5 text-[#0a4a82]" />
                        Request Ad Space
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Placement Type *</Label>
                        <Select 
                          value={formData.placementType} 
                          onValueChange={(v) => setFormData({ ...formData, placementType: v })}
                        >
                          <SelectTrigger data-testid="select-placement-type">
                            <SelectValue placeholder="Select ad placement" />
                          </SelectTrigger>
                          <SelectContent>
                            {pricing?.map((p) => (
                              <SelectItem key={p.placementType} value={p.placementType}>
                                {p.displayName} - ${(p.pricePerWeek / 100).toFixed(0)}/week
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedPricing && (
                          <p className="text-sm text-muted-foreground">{selectedPricing.description}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="title">Ad Title *</Label>
                        <Input
                          id="title"
                          placeholder="e.g., Spring Special - 20% Off"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                          data-testid="input-ad-description"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="imageUrl">Image URL (optional)</Label>
                        <Input
                          id="imageUrl"
                          placeholder="https://example.com/image.jpg"
                          value={formData.imageUrl}
                          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                          data-testid="input-ad-image"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="linkUrl">Link URL (optional)</Label>
                        <Input
                          id="linkUrl"
                          placeholder="https://yourbusiness.com"
                          value={formData.linkUrl}
                          onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
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

                      {selectedPricing && (
                        <div className="bg-muted p-4 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Price:</span>
                            <span className="text-2xl font-bold text-[#0a4a82]">
                              ${(selectedPricing.pricePerWeek / 100).toFixed(0)}/week
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            After submitting, we'll contact you to arrange payment and activate your ad.
                          </p>
                        </div>
                      )}

                      <Button 
                        type="submit" 
                        className="w-full bg-[#0a4a82] hover:bg-[#093d6b]"
                        disabled={createAdRequest.isPending}
                        data-testid="button-submit-ad"
                      >
                        {createAdRequest.isPending ? "Submitting..." : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Submit Ad Request
                          </>
                        )}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {pricingLoading ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <Skeleton className="h-10 w-10 rounded-full mb-4" />
                        <Skeleton className="h-6 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-full mb-4" />
                        <Skeleton className="h-8 w-24" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {pricing?.map((p) => {
                    const Icon = placementIcons[p.placementType] || Megaphone;
                    return (
                      <Card key={p.id} className="hover:shadow-lg transition-shadow" data-testid={`card-pricing-${p.placementType}`}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="w-12 h-12 rounded-full bg-[#0a4a82]/10 flex items-center justify-center">
                              <Icon className="h-6 w-6 text-[#0a4a82]" />
                            </div>
                            <Badge variant="secondary" className="text-lg font-bold">
                              ${(p.pricePerWeek / 100).toFixed(0)}/wk
                            </Badge>
                          </div>
                          <CardTitle className="mt-4">{p.displayName}</CardTitle>
                          <CardDescription>{p.description}</CardDescription>
                        </CardHeader>
                        <CardFooter>
                          <Button 
                            className="w-full bg-[#8a9a5b] hover:bg-[#7a8a4b]"
                            onClick={() => {
                              setFormData({ ...formData, placementType: p.placementType });
                              setIsCreateOpen(true);
                            }}
                            data-testid={`button-select-${p.placementType}`}
                          >
                            Select This Placement
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <Card className="sticky top-28">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-[#0a4a82]" />
                    My Ads
                  </CardTitle>
                  <CardDescription>Track your ad campaigns</CardDescription>
                </CardHeader>
                <CardContent>
                  {myAdsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : !myAds || myAds.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No ads yet</p>
                      <p className="text-xs mt-1">Request your first ad placement above!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myAds.map((ad) => (
                        <div key={ad.id} className="p-3 bg-muted/50 rounded-lg" data-testid={`card-my-ad-${ad.id}`}>
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <h4 className="font-medium text-sm line-clamp-1">{ad.title}</h4>
                            {getStatusBadge(ad.status || "pending")}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            {getPaymentBadge(ad.paymentStatus || "unpaid")}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {ad.impressions || 0} views
                            </span>
                            <span className="flex items-center gap-1">
                              <MousePointer className="h-3 w-3" />
                              {ad.clicks || 0} clicks
                            </span>
                          </div>
                          {ad.createdAt && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Requested {formatDistanceToNow(new Date(ad.createdAt), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <div className="mt-12 bg-gradient-to-br from-[#8a9a5b]/10 to-[#0a4a82]/5 rounded-2xl p-8 border border-[#8a9a5b]/20">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#0a4a82]/10 flex items-center justify-center">
                <Eye className="h-8 w-8 text-[#0a4a82]" />
              </div>
              <h3 className="font-bold text-lg mb-2">Maximum Visibility</h3>
              <p className="text-sm text-muted-foreground">
                Get your business in front of thousands of local customers actively looking for services.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#d4a373]/10 flex items-center justify-center">
                <TrendingUp className="h-8 w-8 text-[#d4a373]" />
              </div>
              <h3 className="font-bold text-lg mb-2">Track Performance</h3>
              <p className="text-sm text-muted-foreground">
                See exactly how many people view and click on your ads with real-time analytics.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#8a9a5b]/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-[#8a9a5b]" />
              </div>
              <h3 className="font-bold text-lg mb-2">Flexible Options</h3>
              <p className="text-sm text-muted-foreground">
                Choose from multiple placement types to fit your budget and marketing goals.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
