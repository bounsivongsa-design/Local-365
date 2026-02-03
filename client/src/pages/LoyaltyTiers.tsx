import LoyaltyBadges from "@/components/LoyaltyBadges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, MapPin, Star, Check, ExternalLink, Crown, Gift, Award } from "lucide-react";

export default function LoyaltyTiers() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background with coastal gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a4a82] via-[#0a4a82]/90 to-[#083a6a]" />
        
        {/* Ocean wave SVG decoration */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden">
          <svg 
            viewBox="0 0 1200 120" 
            preserveAspectRatio="none" 
            className="relative block w-full h-20"
          >
            <path 
              d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
              className="fill-slate-50 dark:fill-slate-900 opacity-25"
            />
            <path 
              d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
              className="fill-slate-50 dark:fill-slate-900 opacity-50"
            />
            <path 
              d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"
              className="fill-slate-50 dark:fill-slate-900"
            />
          </svg>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-20 right-10 w-64 h-64 bg-amber-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        
        <div className="relative container py-16 md:py-24 z-10">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-6 text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          
          <div className="max-w-3xl">
            {/* Premium badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400/20 backdrop-blur-sm border border-amber-400/30 text-amber-300 text-sm font-semibold mb-6">
              <Crown className="h-4 w-4" />
              Local 365 Rewards Program
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Elite Status
              <span className="block text-amber-400">Program</span>
            </h1>
            
            <p className="text-xl text-white/80 max-w-2xl leading-relaxed mb-8">
              Support local businesses, earn points with every visit, and unlock exclusive member perks. 
              The more you explore Currituck County, the more rewards you earn.
            </p>
            
            {/* Quick stats */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/10">
                <Award className="h-6 w-6 text-amber-400" />
                <div>
                  <div className="text-2xl font-bold text-white">5</div>
                  <div className="text-sm text-white/60">Elite Tiers</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/10">
                <Gift className="h-6 w-6 text-amber-400" />
                <div>
                  <div className="text-2xl font-bold text-white">+75%</div>
                  <div className="text-sm text-white/60">Max Points Bonus</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/10">
                <Sparkles className="h-6 w-6 text-amber-400" />
                <div>
                  <div className="text-2xl font-bold text-white">Free</div>
                  <div className="text-sm text-white/60">To Join</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-12">
        {/* Badges Component */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-white dark:border-slate-700 mb-12">
          <LoyaltyBadges />
        </div>

        {/* How It Works Section */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-10 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700 mb-12">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0a4a82]/10 text-[#0a4a82] text-sm font-semibold mb-4">
              <Sparkles className="h-4 w-4" />
              Getting Started
            </div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">How It Works</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: 1, title: 'Join Free', desc: 'Sign up and start earning 10 points per dollar spent at participating businesses.', color: 'from-[#0a4a82] to-[#083a6a]' },
              { step: 2, title: 'Visit & Earn', desc: 'Each visit to a participating business counts toward your elite status.', color: 'from-slate-500 to-slate-600' },
              { step: 3, title: 'Advance Tiers', desc: 'Move up through 5 elite tiers to earn bonus points (up to +75%) and exclusive perks.', color: 'from-amber-500 to-amber-600' },
              { step: 4, title: 'Redeem Rewards', desc: 'Use points for experiences, event tickets, and partner rewards. Top tiers get discounts.', color: 'from-purple-500 to-purple-600' }
            ].map((item) => (
              <div key={item.step} className="text-center group">
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-5 shadow-xl group-hover:scale-110 transition-transform duration-300`}>
                  <span className="text-3xl font-bold text-white">{item.step}</span>
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Participating Businesses Section */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-10 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-semibold mb-4">
              <Check className="h-4 w-4" />
              Partner Network
            </div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Participating Businesses</h2>
            <p className="text-slate-500 dark:text-slate-400">Earn points and perks at these local partners</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {participatingBusinesses.map((business, i) => (
              <Card key={i} className="overflow-hidden bg-white dark:bg-slate-800 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-0 ring-1 ring-slate-200/50 dark:ring-slate-700/50">
                <div className="relative">
                  <img 
                    src={business.image} 
                    alt={business.name} 
                    className="w-full h-44 object-cover"
                  />
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-green-500 text-white border-0 shadow-lg">Earn Points</Badge>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">{business.name}</h3>
                  </div>
                  <Badge variant="secondary" className="mb-3">{business.category}</Badge>
                  <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 mb-2">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{business.location}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm mb-4">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span className="font-bold text-slate-900 dark:text-white">{business.rating}</span>
                    <span className="text-slate-500">({business.reviews} reviews)</span>
                  </div>
                  <Button 
                    className="w-full bg-[#0a4a82] hover:bg-[#083a6a] text-white" 
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
              </Card>
            ))}
          </div>

          <div className="text-center mt-10 pt-8 border-t border-slate-200 dark:border-slate-700">
            <p className="text-slate-500 dark:text-slate-400 mb-4">Want your business listed here?</p>
            <Button variant="outline" className="border-[#0a4a82] text-[#0a4a82] hover:bg-[#0a4a82] hover:text-white">
              Become a Partner
            </Button>
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
