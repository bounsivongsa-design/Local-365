import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  Medal,
  Tag,
  CheckCircle2,
  X,
  ShoppingCart,
  Receipt,
  Percent,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
    monthlyPrice: 25,
    description: "Perfect for getting started",
    features: [
      "Business listing in directory",
      "Phone number displayed",
      "Customer reviews enabled",
      "Up to 4 categories",
      "Quote access: Round 3 (opens 48+ hrs after request)",
      "10% off advertising",
      "Add extra zip-code listings for $22.50/mo each (10% off)"
    ],
    icon: Medal,
    gradient: "from-amber-700 to-amber-900",
    iconBg: "bg-amber-100"
  },
  {
    id: "silver",
    dbId: "standard",
    name: "Silver",
    monthlyPrice: 50,
    description: "Most popular for growing businesses",
    features: [
      "Everything in Bronze",
      "Business logo displayed",
      "Website link (hyperlink)",
      "Up to 6 photos, 6 categories",
      "Quote access: Round 2 (opens 24+ hrs after request)",
      "Verified business badge",
      "Social media links",
      "25% off advertising",
      "Add extra zip-code listings for $37.50/mo each (25% off)"
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
    monthlyPrice: 100,
    description: "For businesses that want it all",
    features: [
      "Everything in Silver",
      "Top of search results",
      "Featured badge on listing",
      "Up to 10 photos, 8 categories",
      "Quote access: Round 1 (immediate, exclusive for first 24 hrs — requests stay open up to 10 days)",
      "30-sec promo video upload",
      "Advanced analytics dashboard",
      "50% off all advertising",
      "Add extra zip-code listings for $50/mo each (50% off)"
    ],
    icon: Crown,
    gradient: "from-amber-500 to-amber-700",
    iconBg: "bg-amber-100"
  }
];

const PAYMENT_DISCOUNTS: Record<PaymentFrequency, { label: string; discount: number; badge?: string }> = {
  monthly: { label: "Monthly", discount: 0 },
  semi_annual: { label: "Semi-Annual", discount: 0.10, badge: "Save 10%" },
  annual: { label: "Annual", discount: 0.225, badge: "Save 22.5%" }
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
  // Round to whole dollars so the displayed total matches what Stripe charges
  // (server stores annual prices rounded — e.g. Bronze annual is $233, not $232.50).
  const total = Math.round(discountedMonthlyPrice * paidMonths);
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
  const navigate = useNavigate();
  const [selectedFrequency, setSelectedFrequency] = useState<PaymentFrequency>("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<{ valid: boolean; message: string; discountType?: string; discountValue?: number; description?: string; expiresAt?: string; durationDays?: number } | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState<MembershipTier | null>(null);
  const [showGoldTrialDialog, setShowGoldTrialDialog] = useState(false);
  const [goldTrialPurchasedTier, setGoldTrialPurchasedTier] = useState<string>("");

  const { data: business } = useQuery<{ id: number; membershipTier: string; membershipTrialUsed: boolean }>({
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

  const { data: winBackData } = useQuery<{
    eligible: boolean;
    previousTier?: string;
    downgradedAt?: string;
    winBackEligibleAt?: string;
  }>({
    queryKey: ["/api/my-business/win-back"],
    enabled: isAuthenticated && user?.accountType === "business",
  });

  const verifiedRef = useRef(false);
  const [verifying, setVerifying] = useState(false);
  const successNotifiedRef = useRef(false);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const isSuccess = searchParams.get("success") === "true";

    if (isSuccess && sessionId && !verifiedRef.current) {
      verifiedRef.current = true;
      setVerifying(true);

      const verifySession = async (retries = 3): Promise<void> => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            await apiRequest("POST", "/api/stripe/verify-session", { sessionId });
            await queryClient.invalidateQueries({ queryKey: ["/api/my-business"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription-status"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
            setVerifying(false);
            return;
          } catch (err) {
            console.error(`Session verification attempt ${attempt} failed:`, err);
            if (attempt < retries) {
              await new Promise(r => setTimeout(r, 1500 * attempt));
            }
          }
        }
        setVerifying(false);
        toast({ title: "Verification issue", description: "Your payment was received but activation is pending. Please refresh the page or contact support if your plan doesn't update shortly.", variant: "destructive" });
      };

      verifySession();
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("success") === "true" && !verifying && !successNotifiedRef.current) {
      if (!user?.linkedBusinessId && (user as any)?.pendingMembershipTier) {
        successNotifiedRef.current = true;
        toast({ title: "Payment received!", description: "Now let's set up your business listing." });
        navigate("/create-business");
        return;
      }
      if (business) {
        const currentTier = business?.membershipTier;
        const displayTier = currentTier ? DB_TO_DISPLAY[currentTier] : null;
        if (currentTier && currentTier !== "none") {
          successNotifiedRef.current = true;
          if (displayTier === "gold" && business?.membershipTrialUsed) {
            const originalPurchased = currentTier === "premium" ? "" : (displayTier || "");
            setGoldTrialPurchasedTier(originalPurchased);
            setShowGoldTrialDialog(true);
          } else {
            toast({ title: "Welcome aboard!", description: "Your membership is now active. Thank you for joining Local List 365!" });
          }
        }
      }
    }
    if (searchParams.get("canceled") === "true") {
      toast({ title: "Checkout canceled", description: "No worries — you can subscribe anytime.", variant: "destructive" });
    }
  }, [business, verifying, user]);

  const currentTierDb = business?.membershipTier || "none";
  const currentTierDisplay = DB_TO_DISPLAY[currentTierDb] || currentTierDb;
  const isNewMember = !business?.membershipTrialUsed;

  const validatePromoCode = async (tier?: string) => {
    if (!promoCode.trim()) return;
    setValidatingPromo(true);
    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode.trim(), tier, businessId: business?.id }),
      });
      const data = await res.json();
      if (data.valid) {
        setPromoStatus({ valid: true, message: data.description || "Promo code applied!", discountType: data.discountType, discountValue: data.discountValue, description: data.description, expiresAt: data.expiresAt, durationDays: data.durationDays });
      } else {
        setPromoStatus({ valid: false, message: data.message || "Invalid promo code" });
      }
    } catch {
      setPromoStatus({ valid: false, message: "Could not connect to server. Please check your connection and try again." });
    } finally {
      setValidatingPromo(false);
    }
  };

  const openCheckout = (tier: MembershipTier) => {
    if (!isAuthenticated) {
      window.location.href = "/auth?mode=register&type=business";
      return;
    }
    setPromoCode("");
    setPromoStatus(null);
    setCheckoutTier(tier);
  };

  const handleProceedToPayment = async () => {
    if (!checkoutTier) return;
    setCheckoutLoading(checkoutTier.id);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tier: checkoutTier.id,
          frequency: selectedFrequency,
          promoCode: promoStatus?.valid ? promoCode : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.message || "Failed to start checkout", variant: "destructive" });
        return;
      }
      if (data.founderBypass) {
        toast({ title: "Gold Membership Activated!", description: data.message });
        await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/user/gold-trial-status"] });
        setCheckoutTier(null);
        navigate("/create-business");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to start checkout. Please try again.", variant: "destructive" });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const getCheckoutPricing = () => {
    if (!checkoutTier) return null;
    const pricing = calculatePrice(checkoutTier.monthlyPrice, selectedFrequency, isNewMember);
    let discount = 0;
    if (promoStatus?.valid && promoStatus.discountValue) {
      if (promoStatus.discountType === "percentage") {
        discount = pricing.total * (promoStatus.discountValue / 100);
      } else {
        discount = promoStatus.discountValue;
      }
    }
    const finalTotal = Math.max(0, pricing.total - discount);
    const hasFreeTrial = isNewMember || (promoStatus?.valid && promoStatus.discountType === "gold_trial");
    const trialDays = promoStatus?.valid && promoStatus.discountType === "gold_trial" && promoStatus.durationDays ? promoStatus.durationDays : 30;
    return { ...pricing, discount, finalTotal, hasFreeTrial, trialDays };
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

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0a4a82] to-[#062d54]">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto animate-pulse">
            <Loader2 className="h-10 w-10 text-white animate-spin" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Activating Your Membership</h2>
            <p className="text-white/70">Please wait while we confirm your payment...</p>
          </div>
        </div>
      </div>
    );
  }

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
              Join the premier business directory for the NC Outer Banks &amp; VA Hampton Roads. 
              Connect with local customers and watch your business thrive. 
              Pricing is per zip code — list in as many areas as you want.
            </p>
            
            {isNewMember && (
              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-[#d4a373] to-amber-500 text-white px-6 py-3 rounded-full shadow-lg shadow-amber-500/25">
                <Gift className="h-5 w-5" />
                <span className="font-semibold">New Members: First Month FREE!</span>
              </div>
            )}
            {winBackData?.eligible && winBackData.previousTier && (
              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-3 rounded-full shadow-lg shadow-emerald-500/25 mt-3" data-testid="banner-win-back">
                <Gift className="h-5 w-5" />
                <span className="font-semibold">
                  Welcome back! Rejoin at your previous {DB_TO_DISPLAY[winBackData.previousTier] || winBackData.previousTier} tier
                </span>
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
                      {isNewMember && tier.id !== "gold" && (
                        <div className="inline-flex items-center gap-1.5 bg-amber-400/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-semibold border border-amber-300/40">
                          <Crown className="h-4 w-4 text-amber-200" />
                          Gold access FREE for 30 days!
                        </div>
                      )}
                      {pricing.freeMonths > 0 && tier.id === "gold" && (
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
                        onClick={() => openCheckout(tier)}
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
              <Link to="/create-business">
                <Button size="lg" className="bg-[#0a4a82] hover:bg-[#083a6a] h-14 px-8 rounded-xl text-lg font-semibold" data-testid="button-get-started-bottom">
                  Create Your Business Listing
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!checkoutTier} onOpenChange={(open) => { if (!open) { setCheckoutTier(null); setPromoCode(""); setPromoStatus(null); } }}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          {checkoutTier && (() => {
            const checkoutPricing = getCheckoutPricing();
            const Icon = checkoutTier.icon;
            const freqLabel = selectedFrequency === "monthly" ? "Monthly" : selectedFrequency === "semi_annual" ? "Semi-Annual" : "Annual";
            const isLoading = checkoutLoading === checkoutTier.id;
            if (!checkoutPricing) return null;

            return (
              <>
                <div className={`bg-gradient-to-br ${checkoutTier.gradient} p-6 text-white`}>
                  <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-3 text-xl">
                      <div className={`w-10 h-10 rounded-xl ${checkoutTier.iconBg} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${checkoutTier.id === 'bronze' ? 'text-amber-700' : checkoutTier.id === 'silver' ? 'text-slate-600' : 'text-amber-600'}`} />
                      </div>
                      <div>
                        <span className="block">Order Summary</span>
                        <span className="block text-sm font-normal text-white/70">{checkoutTier.name} Membership — {freqLabel}</span>
                      </div>
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      Review your membership order and apply promo codes before proceeding to payment.
                    </DialogDescription>
                  </DialogHeader>
                </div>

                <div className="p-6 space-y-6">
                  {isNewMember && checkoutTier.id !== "gold" && (
                    <div className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4" data-testid="checkout-gold-trial-banner">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/25">
                          <Crown className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                            Enjoy Gold access FREE for 30 days!
                          </p>
                          <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5 leading-relaxed">
                            Get top search placement, featured badge, promo video, advanced analytics, and first-round quote access. After 30 days, you'll automatically move to your {checkoutTier.name} plan.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {(() => {
                      const fullPrice = checkoutTier.monthlyPrice * checkoutPricing.months;
                      const frequencyDiscount = PAYMENT_DISCOUNTS[selectedFrequency].discount;
                      const frequencySavings = fullPrice * frequencyDiscount;
                      const afterFreqPrice = fullPrice - frequencySavings;

                      return (
                        <>
                          <div className="flex justify-between items-center text-sm" data-testid="checkout-subtotal">
                            <span className="text-slate-600 dark:text-slate-400">
                              {checkoutTier.name} — {freqLabel}
                              {checkoutPricing.months > 1 && ` (${checkoutPricing.months} months)`}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              ${fullPrice.toFixed(2)}
                            </span>
                          </div>

                          {frequencySavings > 0 && (
                            <div className="flex justify-between items-center text-sm text-[#8a9a5b]" data-testid="checkout-frequency-savings">
                              <span className="flex items-center gap-1.5">
                                <Percent className="h-3.5 w-3.5" />
                                {freqLabel} discount ({(frequencyDiscount * 100).toFixed(0)}% off)
                              </span>
                              <span className="font-medium">-${frequencySavings.toFixed(2)}</span>
                            </div>
                          )}

                          {promoStatus?.valid && checkoutPricing.discount > 0 && (
                            <div data-testid="checkout-promo-discount">
                              <div className="flex justify-between items-center text-sm text-emerald-600">
                                <span className="flex items-center gap-1.5">
                                  <Tag className="h-3.5 w-3.5" />
                                  Promo: {promoCode}
                                  {promoStatus.discountType === "percentage" ? ` (${promoStatus.discountValue}% off)` : ` ($${promoStatus.discountValue} off)`}
                                </span>
                                <span className="font-medium">-${checkoutPricing.discount.toFixed(2)}</span>
                              </div>
                              {promoStatus.description && (
                                <p className="text-xs text-emerald-600/80 mt-1 ml-5" data-testid="checkout-promo-description">
                                  {promoStatus.description}
                                </p>
                              )}
                            </div>
                          )}

                          <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                            {checkoutPricing.hasFreeTrial ? (
                              <>
                                <div className="flex justify-between items-center" data-testid="checkout-total">
                                  <span className="font-bold text-lg text-slate-900 dark:text-white">
                                    Due Today
                                  </span>
                                  <span className="font-bold text-2xl text-emerald-600">
                                    FREE
                                  </span>
                                </div>
                                <div className="mt-2 bg-[#0a4a82]/5 rounded-lg p-3 border border-[#0a4a82]/10">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                      After {checkoutPricing.trialDays}-day trial
                                    </span>
                                    <span className="text-lg font-bold text-[#0a4a82] dark:text-blue-400">
                                      {selectedFrequency === "monthly"
                                        ? `$${checkoutTier.monthlyPrice.toFixed(2)}/mo`
                                        : `$${afterFreqPrice.toFixed(2)} / ${selectedFrequency === "semi_annual" ? "6 months" : "year"}`
                                      }
                                    </span>
                                  </div>
                                  {selectedFrequency !== "monthly" && (
                                    <p className="text-xs text-[#8a9a5b] font-medium mt-0.5">
                                      That's ${checkoutPricing.perMonth.toFixed(0)}/mo — save ${frequencySavings.toFixed(0)} vs monthly!
                                    </p>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                    <Gift className="h-3 w-3 text-emerald-500" />
                                    {checkoutPricing.trialDays}-day free trial included — no charge until trial ends
                                  </p>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex justify-between items-center" data-testid="checkout-total">
                                  <span className="font-bold text-lg text-slate-900 dark:text-white">
                                    Total Due
                                  </span>
                                  <span className="font-bold text-2xl text-[#0a4a82] dark:text-blue-400">
                                    ${(afterFreqPrice - checkoutPricing.discount).toFixed(2)}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                  {selectedFrequency === "monthly" ? "Billed monthly" : selectedFrequency === "semi_annual" ? "Billed every 6 months" : "Billed annually"}
                                </p>
                              </>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2.5 flex items-center gap-1.5">
                      <Tag className="h-4 w-4 text-[#d4a373]" />
                      Have a promo code?
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter promo code"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value.toUpperCase());
                          if (promoStatus) setPromoStatus(null);
                        }}
                        className="font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        data-testid="input-promo-code"
                      />
                      <Button
                        onClick={() => validatePromoCode(checkoutTier.id)}
                        disabled={!promoCode.trim() || validatingPromo}
                        variant="outline"
                        className="shrink-0 border-[#0a4a82] text-[#0a4a82] hover:bg-[#0a4a82]/5"
                        data-testid="button-apply-promo"
                      >
                        {validatingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                    {promoStatus && (
                      <div className={`mt-2.5 ${promoStatus.valid ? "text-emerald-600" : "text-red-500"}`}>
                        <div className="flex items-center gap-2 text-sm">
                          {promoStatus.valid ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}
                          <span data-testid="text-promo-status">
                            {promoStatus.valid
                              ? promoStatus.discountType === "gold_trial"
                                ? `Gold Trial — ${promoStatus.durationDays || 30} days free!`
                                : `${promoStatus.discountType === "percentage" ? `${promoStatus.discountValue}% off` : `$${promoStatus.discountValue} off`} — Code applied!`
                              : promoStatus.message}
                          </span>
                        </div>
                        {promoStatus.valid && promoStatus.description && (
                          <p className="text-xs text-emerald-700 mt-1 ml-6 font-medium" data-testid="text-promo-description">
                            {promoStatus.description}
                            {promoStatus.expiresAt && (() => {
                              const exp = new Date(promoStatus.expiresAt);
                              return ` (redeem by ${exp.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })})`;
                            })()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleProceedToPayment}
                    disabled={isLoading || validatingPromo}
                    className="w-full h-13 rounded-xl font-semibold text-base bg-[#0a4a82] hover:bg-[#083a6a] shadow-lg shadow-[#0a4a82]/25 transition-all duration-300"
                    data-testid="button-proceed-payment"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-5 w-5" />
                        {checkoutPricing.hasFreeTrial ? "Start Free Trial" : `Proceed to Payment — $${checkoutPricing.finalTotal.toFixed(2)}`}
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                    <Shield className="h-3.5 w-3.5" />
                    <span>Secure checkout powered by Stripe</span>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={showGoldTrialDialog} onOpenChange={setShowGoldTrialDialog}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 p-8 text-white text-center">
            <DialogHeader>
              <DialogTitle className="sr-only">Gold Trial Activated</DialogTitle>
              <DialogDescription className="sr-only">Your Gold membership trial is now active for 30 days.</DialogDescription>
            </DialogHeader>
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-5 shadow-lg">
              <Crown className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              Welcome to Gold!
            </h2>
            <p className="text-white/90 text-lg">
              Enjoy <span className="font-bold">30 days of Gold access</span> — completely free.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-slate-600 dark:text-slate-400 text-sm text-center leading-relaxed">
              For the next 30 days, your listing gets all Gold-tier benefits:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: TrendingUp, text: "Top of search results" },
                { icon: Award, text: "Featured badge" },
                { icon: Sparkles, text: "AI writing tools (listings, replies, deals)" },
                { icon: Clock, text: "1st-round quote access" },
                { icon: Star, text: "Up to 10 photos" },
                { icon: Sparkles, text: "Marketing Hub + AI Newsletter" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <item.icon className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">{item.text}</span>
                </div>
              ))}
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                After 30 days, you'll automatically transition to your purchased plan at no extra cost.
              </p>
            </div>
            <Button
              onClick={() => setShowGoldTrialDialog(false)}
              className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/25"
              data-testid="button-gold-trial-dismiss"
            >
              <Crown className="mr-2 h-5 w-5" />
              Let's Go!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
