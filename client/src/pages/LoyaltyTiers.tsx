import LoyaltyBadges from "@/components/LoyaltyBadges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, MapPin, Star, Check, ExternalLink, Crown, Gift, Award, ChevronRight } from "lucide-react";

export default function LoyaltyTiers() {
  return (
    <div className="min-h-screen bg-[#030712]">
      {/* Immersive Hero Section */}
      <div className="relative min-h-[70vh] overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: 'url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop)',
          }}
        />
        
        {/* Dark overlay with gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-[#030712]" />
        
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-amber-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        
        {/* Content */}
        <div className="relative z-10 container pt-8 pb-20 flex flex-col min-h-[70vh]">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-8 text-white/60 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          
          <div className="flex-1 flex flex-col justify-center items-center text-center max-w-4xl mx-auto">
            {/* Premium badge */}
            <div className="inline-flex items-center gap-2 w-fit px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/20 backdrop-blur-xl border border-amber-500/30 text-amber-400 text-sm font-medium mb-8 shadow-lg shadow-amber-500/10">
              <Crown className="h-4 w-4" />
              <span className="tracking-wide uppercase">Local 365 Elite Program</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 leading-[0.9] tracking-tight">
              Unlock
              <span className="block bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                Elite Status
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/70 max-w-2xl leading-relaxed mb-12 font-light">
              Experience the rewards of loyalty. Every visit brings you closer to 
              <span className="text-white font-medium"> exclusive perks</span>, 
              <span className="text-amber-400 font-medium"> bonus points</span>, and 
              <span className="text-white font-medium"> VIP treatment</span>.
            </p>
            
            {/* Stats row */}
            <div className="flex flex-wrap justify-center gap-8 md:gap-16">
              {[
                { value: '5', label: 'Elite Tiers', color: 'from-slate-400 to-slate-200' },
                { value: '+75%', label: 'Max Bonus', color: 'from-amber-400 to-amber-200' },
                { value: 'Free', label: 'To Join', color: 'from-emerald-400 to-emerald-200' },
              ].map((stat, i) => (
                <div key={i} className="group text-center">
                  <div className={`text-4xl md:text-5xl font-black bg-gradient-to-b ${stat.color} bg-clip-text text-transparent mb-1 group-hover:scale-110 transition-transform duration-300`}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-white/50 uppercase tracking-widest font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Scroll indicator */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center gap-2 text-white/40">
              <span className="text-xs uppercase tracking-widest">Explore</span>
              <div className="w-px h-8 bg-gradient-to-b from-white/40 to-transparent" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 -mt-12">
        {/* Badges Component */}
        <div className="container">
          <div className="bg-white/[0.03] backdrop-blur-2xl rounded-[2rem] p-8 md:p-12 border border-white/10 shadow-2xl shadow-black/50 mb-16">
            <LoyaltyBadges />
          </div>
        </div>

        {/* How It Works Section */}
        <div className="container mb-16">
          <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl rounded-[2rem] p-10 md:p-14 border border-white/10">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-medium uppercase tracking-widest mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                Getting Started
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4">How It Works</h2>
              <p className="text-white/50 max-w-xl mx-auto">Four simple steps to start earning rewards</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { step: 1, title: 'Join Free', desc: 'Sign up and start earning 10 points per dollar at participating businesses.', gradient: 'from-[#0a4a82] to-[#0369a1]' },
                { step: 2, title: 'Visit & Earn', desc: 'Each visit counts toward your elite status and bonus multipliers.', gradient: 'from-slate-600 to-slate-700' },
                { step: 3, title: 'Level Up', desc: 'Advance through 5 tiers for up to +75% bonus points on every purchase.', gradient: 'from-amber-500 to-amber-600' },
                { step: 4, title: 'Enjoy Perks', desc: 'Unlock VIP treatment, discounts, and exclusive experiences.', gradient: 'from-purple-500 to-purple-600' }
              ].map((item, i) => (
                <div key={item.step} className="group relative">
                  {/* Connector line */}
                  {i < 3 && (
                    <div className="hidden md:block absolute top-10 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px bg-gradient-to-r from-white/20 to-transparent" />
                  )}
                  
                  <div className="relative text-center">
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mx-auto mb-6 shadow-xl shadow-black/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 border border-white/20`}>
                      <span className="text-3xl font-black text-white">{item.step}</span>
                    </div>
                    <h3 className="font-bold text-xl text-white mb-3">{item.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Participating Businesses Section */}
        <div className="container pb-20">
          <div className="bg-gradient-to-br from-white/[0.05] to-transparent backdrop-blur-xl rounded-[2rem] p-10 md:p-14 border border-white/10">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium uppercase tracking-widest mb-6">
                <Check className="h-3.5 w-3.5" />
                Partner Network
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Where to Earn</h2>
              <p className="text-white/50">Earn points and unlock perks at these local partners</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {participatingBusinesses.map((business, i) => (
                <div 
                  key={i} 
                  className="group relative bg-white/[0.03] rounded-2xl overflow-hidden border border-white/10 hover:border-white/20 transition-all duration-500 hover:-translate-y-2"
                >
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={business.image} 
                      alt={business.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute top-4 right-4">
                      <div className="px-3 py-1.5 rounded-full bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-bold shadow-lg">
                        Earn Points
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="font-bold text-xl text-white mb-1">{business.name}</h3>
                      <div className="flex items-center gap-2 text-white/70 text-sm">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{business.location}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <Badge variant="secondary" className="bg-white/10 text-white/70 border-white/10">
                        {business.category}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                        <span className="font-bold text-white">{business.rating}</span>
                        <span className="text-white/40">({business.reviews})</span>
                      </div>
                    </div>
                    <Button 
                      className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/20 backdrop-blur-sm group/btn" 
                      onClick={() => {
                        trackAffiliateClick(business);
                        window.open(generateAffiliateLink(business), '_blank');
                      }}
                      data-testid={`button-visit-${business.referralCode}`}
                    >
                      <span>Visit Website</span>
                      <ChevronRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-14 pt-10 border-t border-white/10">
              <p className="text-white/40 mb-5">Want your business listed here?</p>
              <Button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold px-8 shadow-lg shadow-amber-500/25">
                Become a Partner
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
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
