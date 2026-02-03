import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
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
  Clock
} from "lucide-react";

type PaymentFrequency = "monthly" | "semi_annual" | "annual";

interface MembershipTier {
  id: string;
  name: string;
  monthlyPrice: number;
  features: string[];
  icon: typeof Building2;
  color: string;
  popular?: boolean;
}

const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    id: "basic",
    name: "Basic",
    monthlyPrice: 50,
    features: [
      "Business listing in directory",
      "Phone number displayed",
      "Customer reviews enabled",
      "Basic analytics"
    ],
    icon: Building2,
    color: "#0a4a82"
  },
  {
    id: "standard",
    name: "Standard",
    monthlyPrice: 100,
    features: [
      "Everything in Basic",
      "Business logo displayed",
      "Website link (hyperlink)",
      "Enhanced profile layout",
      "Priority support"
    ],
    icon: Star,
    color: "#8a9a5b",
    popular: true
  },
  {
    id: "premium",
    name: "Premium",
    monthlyPrice: 200,
    features: [
      "Everything in Standard",
      "Top of list placement",
      "Based on review count",
      "Featured badge on listing",
      "Premium analytics dashboard",
      "Priority customer matching"
    ],
    icon: Crown,
    color: "#d4a373"
  }
];

const PAYMENT_DISCOUNTS: Record<PaymentFrequency, { label: string; discount: number; description: string }> = {
  monthly: { label: "Monthly", discount: 0, description: "Pay month-to-month" },
  semi_annual: { label: "Semi-Annual", discount: 0.20, description: "6 months - Save 20%" },
  annual: { label: "Annual", discount: 0.45, description: "12 months - Save 45%" }
};

const AD_PRICING = {
  nonMember: {
    monthly: { small: 500, medium: 1000, large: 2000 },
    event: { small: 300, medium: 600, large: 1200 },
    freeMonths: 1,
    freeRequirement: 6
  },
  member: {
    monthly: { small: 250, medium: 500, large: 1000 },
    event: { small: 150, medium: 300, large: 600 },
    freeMonths: 2,
    freeRequirement: 6
  }
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

export default function BusinessMembership() {
  const { user, isAuthenticated } = useAuth();
  const [selectedFrequency, setSelectedFrequency] = useState<PaymentFrequency>("monthly");
  const [isNewMember] = useState(true);

  const { data: business } = useQuery({
    queryKey: ["/api/my-business"],
    enabled: isAuthenticated && user?.accountType === "business",
  });

  const currentTier = (business as any)?.membershipTier || "none";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a4a82]/5 to-background">
      <div className="bg-gradient-to-r from-[#0a4a82] to-[#0a4a82]/80 text-white py-16">
        <div className="container">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">Business Membership</h1>
              <p className="text-white/80 mt-1">Grow your business with Local List 365</p>
            </div>
          </div>
          {isNewMember && (
            <div className="mt-6 inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
              <Gift className="h-5 w-5 text-[#d4a373]" />
              <span className="font-medium">New Members: 1st Month FREE on Monthly Plans!</span>
            </div>
          )}
        </div>
      </div>

      <div className="container py-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Choose Your Payment Schedule</h2>
          <p className="text-muted-foreground">Save more with longer commitments</p>
        </div>

        <Tabs value={selectedFrequency} onValueChange={(v) => setSelectedFrequency(v as PaymentFrequency)} className="w-full">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3 mb-8">
            {Object.entries(PAYMENT_DISCOUNTS).map(([key, value]) => (
              <TabsTrigger key={key} value={key} className="relative" data-testid={`tab-${key}`}>
                {value.label}
                {value.discount > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-[#8a9a5b] text-white text-xs px-1.5">
                    {Math.round(value.discount * 100)}% OFF
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {MEMBERSHIP_TIERS.map((tier) => {
              const pricing = calculatePrice(tier.monthlyPrice, selectedFrequency, isNewMember);
              const Icon = tier.icon;
              const isCurrentTier = currentTier === tier.id;
              
              return (
                <Card 
                  key={tier.id} 
                  className={`relative overflow-visible ${tier.popular ? 'border-2 border-[#8a9a5b] shadow-lg scale-105' : ''}`}
                  data-testid={`card-tier-${tier.id}`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-[#8a9a5b] text-white">Most Popular</Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pt-8">
                    <div 
                      className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${tier.color}15` }}
                    >
                      <Icon className="h-8 w-8" style={{ color: tier.color }} />
                    </div>
                    <CardTitle className="text-2xl">{tier.name}</CardTitle>
                    <div className="mt-4">
                      {pricing.freeMonths > 0 && (
                        <div className="text-sm text-[#8a9a5b] font-medium mb-1">
                          First month FREE!
                        </div>
                      )}
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold" style={{ color: tier.color }}>
                          ${pricing.perMonth.toFixed(0)}
                        </span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      {selectedFrequency !== "monthly" && (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-muted-foreground">
                            ${pricing.total.toFixed(0)} total for {pricing.months} months
                          </p>
                          <p className="text-sm text-[#8a9a5b] font-medium">
                            Save ${pricing.savings.toFixed(0)}!
                          </p>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <ul className="space-y-3">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-[#8a9a5b] shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  
                  <CardFooter>
                    {isCurrentTier ? (
                      <Button className="w-full" variant="secondary" disabled>
                        Current Plan
                      </Button>
                    ) : (
                      <Button 
                        className="w-full" 
                        style={{ backgroundColor: tier.color }}
                        data-testid={`button-select-${tier.id}`}
                      >
                        {currentTier === "none" ? "Get Started" : "Upgrade"}
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </Tabs>

        <div className="mt-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
              <Megaphone className="h-6 w-6 text-[#0a4a82]" />
              Advertising Rates
            </h2>
            <p className="text-muted-foreground">Members save 50% on all advertising!</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  Non-Member Rates
                </CardTitle>
                <CardDescription>
                  1 month free with 6 months prepaid
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Monthly Advertising
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="bg-muted p-3 rounded text-center">
                        <p className="font-bold">${AD_PRICING.nonMember.monthly.small}</p>
                        <p className="text-muted-foreground">Small</p>
                      </div>
                      <div className="bg-muted p-3 rounded text-center">
                        <p className="font-bold">${AD_PRICING.nonMember.monthly.medium}</p>
                        <p className="text-muted-foreground">Medium</p>
                      </div>
                      <div className="bg-muted p-3 rounded text-center">
                        <p className="font-bold">${AD_PRICING.nonMember.monthly.large}</p>
                        <p className="text-muted-foreground">Large</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      2-Week Event Ads
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="bg-muted p-3 rounded text-center">
                        <p className="font-bold">${AD_PRICING.nonMember.event.small}</p>
                        <p className="text-muted-foreground">Small</p>
                      </div>
                      <div className="bg-muted p-3 rounded text-center">
                        <p className="font-bold">${AD_PRICING.nonMember.event.medium}</p>
                        <p className="text-muted-foreground">Medium</p>
                      </div>
                      <div className="bg-muted p-3 rounded text-center">
                        <p className="font-bold">${AD_PRICING.nonMember.event.large}</p>
                        <p className="text-muted-foreground">Large</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-[#8a9a5b]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-[#8a9a5b]" />
                    Member Rates
                  </CardTitle>
                  <Badge className="bg-[#8a9a5b] text-white">50% OFF</Badge>
                </div>
                <CardDescription>
                  2 months free with 6 months prepaid
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Monthly Advertising
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="bg-[#8a9a5b]/10 p-3 rounded text-center">
                        <p className="font-bold text-[#8a9a5b]">${AD_PRICING.member.monthly.small}</p>
                        <p className="text-muted-foreground">Small</p>
                      </div>
                      <div className="bg-[#8a9a5b]/10 p-3 rounded text-center">
                        <p className="font-bold text-[#8a9a5b]">${AD_PRICING.member.monthly.medium}</p>
                        <p className="text-muted-foreground">Medium</p>
                      </div>
                      <div className="bg-[#8a9a5b]/10 p-3 rounded text-center">
                        <p className="font-bold text-[#8a9a5b]">${AD_PRICING.member.monthly.large}</p>
                        <p className="text-muted-foreground">Large</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      2-Week Event Ads
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="bg-[#8a9a5b]/10 p-3 rounded text-center">
                        <p className="font-bold text-[#8a9a5b]">${AD_PRICING.member.event.small}</p>
                        <p className="text-muted-foreground">Small</p>
                      </div>
                      <div className="bg-[#8a9a5b]/10 p-3 rounded text-center">
                        <p className="font-bold text-[#8a9a5b]">${AD_PRICING.member.event.medium}</p>
                        <p className="text-muted-foreground">Medium</p>
                      </div>
                      <div className="bg-[#8a9a5b]/10 p-3 rounded text-center">
                        <p className="font-bold text-[#8a9a5b]">${AD_PRICING.member.event.large}</p>
                        <p className="text-muted-foreground">Large</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-16 bg-gradient-to-br from-[#8a9a5b]/10 to-[#0a4a82]/5 rounded-2xl p-8 border border-[#8a9a5b]/20">
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#0a4a82]/10 flex items-center justify-center">
                <Phone className="h-7 w-7 text-[#0a4a82]" />
              </div>
              <h3 className="font-bold mb-1">Direct Contact</h3>
              <p className="text-sm text-muted-foreground">
                Phone number displayed for easy customer contact
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#8a9a5b]/10 flex items-center justify-center">
                <Globe className="h-7 w-7 text-[#8a9a5b]" />
              </div>
              <h3 className="font-bold mb-1">Website Link</h3>
              <p className="text-sm text-muted-foreground">
                Drive traffic directly to your business website
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#d4a373]/10 flex items-center justify-center">
                <Image className="h-7 w-7 text-[#d4a373]" />
              </div>
              <h3 className="font-bold mb-1">Logo Display</h3>
              <p className="text-sm text-muted-foreground">
                Stand out with your professional business logo
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#0a4a82]/10 flex items-center justify-center">
                <TrendingUp className="h-7 w-7 text-[#0a4a82]" />
              </div>
              <h3 className="font-bold mb-1">Top Placement</h3>
              <p className="text-sm text-muted-foreground">
                Premium members appear first in search results
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Card className="max-w-2xl mx-auto p-8 border-[#0a4a82]/20">
            <Megaphone className="h-12 w-12 mx-auto text-[#0a4a82] mb-4" />
            <h2 className="text-2xl font-bold mb-2">Ready to Advertise?</h2>
            <p className="text-muted-foreground mb-6">
              Browse our advertising options and request ad placement for your business
            </p>
            <Link to="/advertising">
              <Button size="lg" className="bg-[#8a9a5b]" data-testid="button-go-advertising">
                <Megaphone className="mr-2 h-5 w-5" />
                View Advertising Options
              </Button>
            </Link>
          </Card>
        </div>

        {!isAuthenticated && (
          <div className="mt-8 text-center">
            <Card className="max-w-lg mx-auto p-8">
              <Building2 className="h-16 w-16 mx-auto text-[#0a4a82]/30 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Ready to Get Started?</h2>
              <p className="text-muted-foreground mb-6">
                Sign in or create a business account to join Local List 365
              </p>
              <Link to="/api/login">
                <Button size="lg" className="bg-[#0a4a82]">
                  Sign In to Get Started
                </Button>
              </Link>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
