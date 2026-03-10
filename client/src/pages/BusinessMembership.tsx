import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Check,
  Star,
  Crown,
  Phone,
  Globe,
  Image,
  TrendingUp,
  Gift,
  Calendar,
  Megaphone,
  Sparkles,
  ChevronRight,
  Users,
  Clock,
  Zap,
  Shield,
  Award,
  ArrowRight,
  CreditCard,
  Loader2,
  Medal
} from "lucide-react";

type PaymentFrequency = "monthly" | "semi_annual" | "annual";

interface MembershipTier {
  id: string;
  dbId: string;
  name: string;
  monthlyPrice: number;
  features: string[];
  icon: typeof Building2;
  gradient: string;
  iconBg: string;
  popular?: boolean;
  description: string;
}

const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    id: "bronze",
    dbId: "basic",
    name: "Bronze",
    monthlyPrice: 50,
    description: "Perfect for getting started",
    features: [
      "Business listing in directory",
      "Phone number displayed",
      "Customer reviews enabled",
      "Up to 3 photos",
      "1 business category",
      "Basic quote access (3rd round)",
      "10% off advertising",
      "Email support"
    ],
    icon: Medal,
    gradient: "from-amber-700 to-amber-900",
    iconBg: "bg-amber-100"
  },
  {
    id: "silver",
    dbId: "standard",
    name: "Silver",
    monthlyPrice: 100,
    description: "Most popular for growing businesses",
    features: [
      "Everything in Bronze",
      "Business logo displayed",
      "Website link (hyperlink)",
      "Up to 10 photos, 3 categories",
      "Priority quote access (2nd round)",
      "Verified business badge",
      "Social media links",
      "25% off advertising",
      "Priority support"
    ],
    icon: Star,
    gradient: "from-slate-400 to-slate-600",
    iconBg: "bg-slate-100",
    popular: true
  },
  {
    id: "gold",
    dbId: "premium",
    name: "Gold",
    monthlyPrice: 200,
    description: "For businesses that want it all",
    features: [
      "Everything in Silver",
      "Top of search results",
      "Featured badge on listing",
      "Unlimited photos, 5 categories",
      "Priority quote access (1st round)",
      "30-sec promo video upload",
      "Advanced analytics dashboard",
      "Dedicated account manager",
      "50% off all advertising"
    ],
    icon: Crown,
    gradient: "from-amber-500 to-amber-700",
    iconBg: "bg-amber-100"
  }
];

const PAYMENT_DISCOUNTS: Record<PaymentFrequency, { label: string; discount: number; badge?: string }> = {
  monthly: { label: "Monthly", discount: 0 },
  semi_annual: { label: "Semi-Annual", discount: 0.20, badge: "Save 20%" },
  annual: { label: "Annual", discount: 0.45, badge: "Save 45%" }
};

function calculatePrice(basePrice: number, frequency: PaymentFrequency, isNewMember: boolean = false): { 
  total: number; 
  perMonth: number; 
  savings: number;
  months: number;
  freeMonths: number;
} {
  const discount = PAYMENT_DISCOUNTS[frequency].discount;
  const months = frequency === "monthly" ? 1 : frequency === "semi_annual" ? 6 : 12;
  const freeMonths = frequency === "monthly" && isNewMember ? 1 : 0;
  
  const discountedMonthlyPrice = basePrice * (1 - discount);
  const paidMonths = months - freeMonths;
  const total = discountedMonthlyPrice * paidMonths;
  const savings = (basePrice * months) - total;
  
  return { total, perMonth: discountedMonthlyPrice, savings, months, freeMonths };
}

const DB_TO_DISPLAY: Record<string, string> = {
  basic: "bronze",
  standard: "silver",
  premium: "gold",
};

export default function BusinessMembership() {
  const { user, isAuthenticated } = useAuth();
  const [selectedFrequency, setSelectedFrequency] = useState<PaymentFrequency>("monthly");
  const [isNewMember] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const { data: business } = useQuery({
    queryKey: ["/api/my-business"],
    enabled: isAuthenticated && user?.accountType === "business",
  });

  const { data: subscriptionStatus } = useQuery<{
    active: boolean;
    tier: string;
    tierDisplay: string;
    frequency: string;
    hasStripeSubscription: boolean;
  }>({
    queryKey: ["/api/stripe/subscription-status"],
    enabled: isAuthenticated && user?.accountType === "business",
  });

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({ title: "Welcome aboard!", description: "Your membership is now active. Thank you for joining Local List 365!" });
    }
    if (searchParams.get("canceled") === "true") {
      toast({ title: "Checkout canceled", description: "No worries — you can subscribe anytime.", variant: "destructive" });
    }
  }, []);

  const currentTierDb = (business as any)?.membershipTier || "none";
  const currentTierDisplay = DB_TO_DISPLAY[currentTierDb] || currentTierDb;

  const handleSelectTier = async (tier: MembershipTier) => {
    if (!isAuthenticated) {
      window.location.href = "/auth?mode=register";
      return;
    }

    if (user?.accountType !== "business") {
      toast({ title: "Business account required", description: "Please switch to a business account to subscribe.", variant: "destructive" });
      return;
    }

    if (!(business as any)?.id) {
      toast({ title: "Create your business first", description: "Please create a business listing before subscribing.", variant: "destructive" });
      return;
    }

    setCheckoutLoading(tier.id);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tier: tier.id, frequency: selectedFrequency }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.message || "Failed to start checkout", variant: "destructive" });
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const res = await fetch("/api/stripe/create-portal", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast({ title: "Error", description: "Failed to open billing portal", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a4a82] via-[#0a4a82]/95 to-[#0a4a82]/90" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=600&fit=crop')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a4a82] via-transparent to-transparent" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#d4a373]/10 rounded-full blur-3xl" />
        
        <div className="relative container py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-white/20">
              <Sparkles className="h-4 w-4 text-[#d4a373]" />
              <span className="text-white/90 text-sm font-medium">Trusted by Local Businesses</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Grow Your Business with
              <span className="block bg-gradient-to-r from-[#d4a373] to-amber-300 bg-clip-text text-transparent">
                Local List 365
              </span>
            </h1>
            
            <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              Join the premier business directory for Moyock and Currituck County. 
              Connect with local customers and watch your business thrive. 
              Pricing is per zip code — list in as many areas as you want.
            </p>
            
            {isNewMember && (
              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-[#d4a373] to-amber-500 text-white px-6 py-3 rounded-full shadow-lg shadow-amber-500/25">
                <Gift className="h-5 w-5" />
                <span className="font-semibold">New Members: First Month FREE!</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" 
                  className="fill-slate-50 dark:fill-slate-950"/>
          </svg>
        </div>
      </div>

      <div className="container py-16 md:py-20">
        {subscriptionStatus?.active && subscriptionStatus?.hasStripeSubscription && (
          <div className="max-w-2xl mx-auto mb-12">
            <div className="bg-gradient-to-r from-[#0a4a82]/5 to-[#d4a373]/5 border border-[#0a4a82]/20 rounded-2xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#0a4a82]/10 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-[#0a4a82]" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Active {subscriptionStatus.tierDisplay?.charAt(0).toUpperCase()}{subscriptionStatus.tierDisplay?.slice(1)} Membership
                  </p>
                  <p className="text-sm text-slate-500">Manage your billing, update payment methods, or change plans</p>
                </div>
              </div>
              <Button onClick={handleManageSubscription} variant="outline" className="rounded-xl" data-testid="button-manage-billing">
                Manage Billing
              </Button>
            </div>
          </div>
        )}

        <div className="max-w-md mx-auto mb-16">
          <div className="bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-200/50 dark:border-slate-700/50">
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(PAYMENT_DISCOUNTS).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setSelectedFrequency(key as PaymentFrequency)}
                  className={`relative py-3 px-4 rounded-xl font-medium text-sm transition-all duration-300 ${
                    selectedFrequency === key
                      ? "bg-[#0a4a82] text-white shadow-lg shadow-[#0a4a82]/25"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                  data-testid={`tab-${key}`}
                >
                  {value.label}
                  {value.badge && (
                    <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                      selectedFrequency === key 
                        ? "bg-[#d4a373] text-white" 
                        : "bg-[#8a9a5b] text-white"
                    }`}>
                      {value.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">
          {MEMBERSHIP_TIERS.map((tier) => {
            const pricing = calculatePrice(tier.monthlyPrice, selectedFrequency, isNewMember);
            const Icon = tier.icon;
            const isCurrentTier = currentTierDisplay === tier.id;
            const isLoading = checkoutLoading === tier.id;
            
            return (
              <div
                key={tier.id}
                className={`relative group ${tier.popular ? 'lg:-mt-4 lg:mb-4' : ''}`}
                data-testid={`card-tier-${tier.id}`}
              >
                {tier.popular && (
                  <div className="absolute -top-5 inset-x-0 flex justify-center z-10">
                    <div className="bg-gradient-to-r from-[#8a9a5b] to-[#6b7a4a] text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg shadow-[#8a9a5b]/30 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Most Popular
                    </div>
                  </div>
                )}
                
                <div className={`relative bg-white dark:bg-slate-800 rounded-3xl overflow-hidden transition-all duration-500 ${
                  tier.popular 
                    ? 'shadow-2xl shadow-[#8a9a5b]/20 ring-2 ring-[#8a9a5b] lg:scale-105' 
                    : 'shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-2xl hover:-translate-y-1'
                }`}>
                  <div className={`bg-gradient-to-br ${tier.gradient} p-8 text-white`}>
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`w-14 h-14 rounded-2xl ${tier.iconBg} flex items-center justify-center shadow-lg`}>
                        <Icon className={`h-7 w-7 ${tier.id === 'bronze' ? 'text-amber-700' : tier.id === 'silver' ? 'text-slate-600' : 'text-amber-600'}`} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">{tier.name}</h3>
                        <p className="text-white/80 text-sm">{tier.description}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      {pricing.freeMonths > 0 && (
                        <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                          <Gift className="h-4 w-4" />
                          First month FREE!
                        </div>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-bold">${pricing.perMonth.toFixed(0)}</span>
                        <span className="text-white/70 text-lg">/mo per zip code</span>
                      </div>
                      {selectedFrequency !== "monthly" && (
                        <p className="text-white/70 text-sm">
                          ${pricing.total.toFixed(0)} billed {selectedFrequency === "semi_annual" ? "every 6 months" : "annually"}
                          {pricing.savings > 0 && (
                            <span className="ml-2 text-white font-medium">
                              Save ${pricing.savings.toFixed(0)}!
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-8">
                    <ul className="space-y-4 mb-8">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            tier.id === 'bronze' 
                              ? 'bg-amber-100 dark:bg-amber-900/30' 
                              : tier.id === 'silver'
                              ? 'bg-slate-100 dark:bg-slate-700'
                              : 'bg-amber-100 dark:bg-amber-900/30'
                          }`}>
                            <Check className={`h-3 w-3 ${
                              tier.id === 'bronze' 
                                ? 'text-amber-700' 
                                : tier.id === 'silver'
                                ? 'text-slate-600 dark:text-slate-300'
                                : 'text-amber-600'
                            }`} />
                          </div>
                          <span className="text-slate-700 dark:text-slate-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    {isCurrentTier ? (
                      <Button className="w-full h-12 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed" disabled>
                        <Shield className="mr-2 h-5 w-5" />
                        Current Plan
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => handleSelectTier(tier)}
                        disabled={isLoading}
                        className={`w-full h-12 rounded-xl font-semibold text-base transition-all duration-300 ${
                          tier.popular
                            ? 'bg-[#8a9a5b] hover:bg-[#7a8a4b] shadow-lg shadow-[#8a9a5b]/25 hover:shadow-xl hover:shadow-[#8a9a5b]/30'
                            : tier.id === 'gold'
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/25'
                            : 'bg-[#0a4a82] hover:bg-[#083a6a]'
                        }`}
                        data-testid={`button-select-${tier.id}`}
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            {currentTierDisplay === "none" ? "Get Started" : "Upgrade Now"}
                            <ArrowRight className="ml-2 h-5 w-5" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Why Businesses Choose Local List 365
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Join hundreds of local businesses already growing with our platform
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Phone, title: "Direct Contact", desc: "Customers can reach you instantly", color: "text-[#0a4a82]", bg: "bg-[#0a4a82]/10" },
              { icon: Globe, title: "Website Traffic", desc: "Drive visitors to your site", color: "text-[#8a9a5b]", bg: "bg-[#8a9a5b]/10" },
              { icon: Award, title: "Build Trust", desc: "Verified reviews & ratings", color: "text-[#d4a373]", bg: "bg-[#d4a373]/10" },
              { icon: TrendingUp, title: "Grow Revenue", desc: "Premium placement = more leads", color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30" }
            ].map((item, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-shadow">
                <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-4`}>
                  <item.icon className={`h-6 w-6 ${item.color}`} />
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-24">
          <div className="relative bg-gradient-to-br from-[#0a4a82] to-[#083a6a] rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920')] bg-cover bg-center opacity-10" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#d4a373]/20 rounded-full blur-3xl" />
            
            <div className="relative p-12 md:p-16 text-center">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-white/20">
                <Megaphone className="h-4 w-4 text-[#d4a373]" />
                <span className="text-white/90 text-sm font-medium">Members Save Up to 50% on Advertising</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Boost Your Visibility
              </h2>
              <p className="text-white/80 max-w-xl mx-auto mb-8">
                Reach more customers with featured placements, banner ads, and sponsored listings across our platform.
              </p>
              
              <Link to="/advertising">
                <Button size="lg" className="bg-[#d4a373] hover:bg-[#c49363] text-white px-8 h-14 rounded-xl text-lg font-semibold shadow-lg shadow-[#d4a373]/30" data-testid="button-go-advertising">
                  <Megaphone className="mr-2 h-5 w-5" />
                  Explore Advertising
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {!isAuthenticated && (
          <div className="mt-16 text-center">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-12 max-w-2xl mx-auto border border-slate-200 dark:border-slate-700">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#0a4a82]/10 flex items-center justify-center">
                <Building2 className="h-10 w-10 text-[#0a4a82]" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Ready to Get Started?</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8">
                Sign in or create a business account to join the Local List 365 community
              </p>
              <Link to="/auth?mode=register">
                <Button size="lg" className="bg-[#0a4a82] hover:bg-[#083a6a] h-14 px-8 rounded-xl text-lg font-semibold">
                  Sign In to Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
