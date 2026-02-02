import LoyaltyBadges from "@/components/LoyaltyBadges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, MapPin, Star, Check, ExternalLink } from "lucide-react";

export default function LoyaltyTiers() {
  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <div className="bg-white/90 dark:bg-card/90 backdrop-blur-sm border-b">
        <div className="container py-12">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="font-display text-4xl font-bold tracking-tight">Loyalty Program</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Earn exclusive rewards and discounts with every visit to Currituck County. The more you explore, the more you save!
          </p>
        </div>
      </div>

      <div className="container py-8">
        <div className="bg-white/80 dark:bg-card/90 backdrop-blur-sm rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <LoyaltyBadges />
        </div>

        {/* How It Works Section */}
        <div className="mt-12 bg-white/80 dark:bg-card/90 backdrop-blur-sm rounded-2xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <h2 className="text-2xl font-bold mb-6 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-semibold mb-2">Book Your Stay</h3>
              <p className="text-muted-foreground text-sm">Reserve accommodations through our partner businesses in Currituck County.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="font-semibold mb-2">Earn Points</h3>
              <p className="text-muted-foreground text-sm">Every completed stay counts toward your loyalty tier progression.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-semibold mb-2">Unlock Rewards</h3>
              <p className="text-muted-foreground text-sm">Advance through tiers to unlock increasing discounts on future bookings.</p>
            </div>
          </div>
        </div>

        {/* Participating Businesses Section */}
        <div className="mt-12 bg-white/80 dark:bg-card/90 backdrop-blur-sm rounded-2xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Participating Businesses</h2>
            <p className="text-muted-foreground">These local partners honor your loyalty tier discounts</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {participatingBusinesses.map((business, i) => (
              <Card key={i} className="overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.15)] hover:translate-y-[-2px] transition-all duration-300">
                <img 
                  src={business.image} 
                  alt={business.name} 
                  className="w-full h-40 object-cover"
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-lg">{business.name}</h3>
                    <Badge variant="secondary" className="shrink-0">{business.category}</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{business.location}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm mb-3">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                    <span className="font-medium">{business.rating}</span>
                    <span className="text-muted-foreground">({business.reviews} reviews)</span>
                  </div>
                  <div className="pt-3 border-t space-y-3">
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                      <Check className="h-4 w-4" />
                      Accepts all loyalty tiers
                    </div>
                    <Button 
                      className="w-full" 
                      size="sm"
                      onClick={() => {
                        trackAffiliateClick(business);
                        window.open(generateAffiliateLink(business), '_blank');
                      }}
                      data-testid={`button-visit-${business.referralCode}`}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visit Website
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <p className="text-muted-foreground text-sm mb-4">Want your business listed here?</p>
            <Button variant="outline">Become a Partner</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const participatingBusinesses = [
  {
    name: "Corolla Beachfront Suites",
    category: "Lodging",
    location: "Corolla, NC",
    rating: "4.9",
    reviews: 128,
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop",
    website: "https://example.com/corolla-suites",
    referralCode: "LL365-CBS-001"
  },
  {
    name: "Duck Village Inn",
    category: "Lodging",
    location: "Duck, NC",
    rating: "4.8",
    reviews: 94,
    image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=300&fit=crop",
    website: "https://example.com/duck-village",
    referralCode: "LL365-DVI-002"
  },
  {
    name: "Currituck Adventure Tours",
    category: "Activities",
    location: "Currituck, NC",
    rating: "4.9",
    reviews: 256,
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop",
    website: "https://example.com/obx-adventures",
    referralCode: "LL365-OAT-003"
  },
  {
    name: "Sunset Grill & Oyster Bar",
    category: "Dining",
    location: "Nags Head, NC",
    rating: "4.7",
    reviews: 312,
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop",
    website: "https://example.com/sunset-grill",
    referralCode: "LL365-SGO-004"
  },
  {
    name: "Wild Horse Safari",
    category: "Activities",
    location: "Corolla, NC",
    rating: "4.9",
    reviews: 189,
    image: "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=400&h=300&fit=crop",
    website: "https://example.com/wild-horse-safari",
    referralCode: "LL365-WHS-005"
  },
  {
    name: "Coastal Kayak Rentals",
    category: "Activities",
    location: "Manteo, NC",
    rating: "4.8",
    reviews: 76,
    image: "https://images.unsplash.com/photo-1472745942893-4b9f730c7668?w=400&h=300&fit=crop",
    website: "https://example.com/coastal-kayak",
    referralCode: "LL365-CKR-006"
  }
];

// Generate tracked affiliate link with UTM parameters
function generateAffiliateLink(business: typeof participatingBusinesses[0]) {
  const baseUrl = business.website;
  const utmParams = new URLSearchParams({
    utm_source: 'locallist365',
    utm_medium: 'referral',
    utm_campaign: 'loyalty_program',
    utm_content: business.referralCode,
    ref: business.referralCode
  });
  return `${baseUrl}?${utmParams.toString()}`;
}

// Log click to backend for tracking
async function trackAffiliateClick(business: typeof participatingBusinesses[0]) {
  try {
    await fetch('/api/affiliate-clicks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: business.name,
        referralCode: business.referralCode,
        category: business.category,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Failed to track click:', error);
  }
}
