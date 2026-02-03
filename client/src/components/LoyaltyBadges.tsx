import { Award, Star, Crown, Gem, Users, Check, Zap, Gift, Calendar, Infinity, TrendingUp, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TierInfo {
  level: string;
  annualVisits: number;
  annualPoints: number;
  lifetimeVisits: number;
  lifetimePoints: number;
  pointsPerDollar: number;
  bonusPercent: number;
  perks: string[];
  discount?: string;
}

const iconMap: Record<string, typeof Award> = {
  'Member': Users,
  'Silver Elite': Award,
  'Gold Elite': Star,
  'Platinum Elite': Crown,
  'Ambassador': Gem,
};

const tierBadges: TierInfo[] = [
  { 
    level: 'Member', 
    annualVisits: 0,
    annualPoints: 0,
    lifetimeVisits: 0,
    lifetimePoints: 0,
    pointsPerDollar: 10,
    bonusPercent: 0,
    perks: ['Local business deals', 'Community updates', 'Points never expire']
  },
  { 
    level: 'Silver Elite', 
    annualVisits: 10,
    annualPoints: 25000,
    lifetimeVisits: 100,
    lifetimePoints: 250000,
    pointsPerDollar: 11,
    bonusPercent: 10,
    perks: ['Priority scheduling', 'Birthday deal from locals', 'Early quote responses']
  },
  { 
    level: 'Gold Elite', 
    annualVisits: 25,
    annualPoints: 50000,
    lifetimeVisits: 250,
    lifetimePoints: 500000,
    pointsPerDollar: 12.5,
    bonusPercent: 25,
    perks: ['First dibs on services', 'Featured reviewer badge', 'Event early access']
  },
  { 
    level: 'Platinum Elite', 
    annualVisits: 50,
    annualPoints: 100000,
    lifetimeVisits: 500,
    lifetimePoints: 1000000,
    pointsPerDollar: 15,
    bonusPercent: 50,
    perks: ['Free upgrades when available', 'Priority support', 'Exclusive partner perks'],
    discount: '5% off'
  },
  { 
    level: 'Ambassador', 
    annualVisits: 100,
    annualPoints: 200000,
    lifetimeVisits: 1000,
    lifetimePoints: 2000000,
    pointsPerDollar: 17.5,
    bonusPercent: 75,
    perks: ['Free upgrades when available', 'Invite-only events', 'Concierge support'],
    discount: '10% off'
  }
];

const tierStyles: Record<string, {
  cardGradient: string;
  accentGradient: string;
  iconGradient: string;
  glowColor: string;
  textAccent: string;
}> = {
  'Member': {
    cardGradient: 'from-slate-800 via-slate-900 to-slate-950',
    accentGradient: 'from-slate-400 to-slate-500',
    iconGradient: 'from-slate-300 to-slate-400',
    glowColor: 'shadow-slate-500/20',
    textAccent: 'text-slate-300'
  },
  'Silver Elite': {
    cardGradient: 'from-slate-600 via-slate-700 to-slate-800',
    accentGradient: 'from-gray-300 via-white to-gray-300',
    iconGradient: 'from-gray-200 to-gray-400',
    glowColor: 'shadow-gray-400/30',
    textAccent: 'text-gray-200'
  },
  'Gold Elite': {
    cardGradient: 'from-amber-700 via-yellow-700 to-amber-800',
    accentGradient: 'from-amber-300 via-yellow-200 to-amber-400',
    iconGradient: 'from-amber-200 to-yellow-300',
    glowColor: 'shadow-amber-500/40',
    textAccent: 'text-amber-200'
  },
  'Platinum Elite': {
    cardGradient: 'from-cyan-700 via-sky-800 to-blue-900',
    accentGradient: 'from-cyan-300 via-sky-200 to-cyan-400',
    iconGradient: 'from-cyan-200 to-sky-300',
    glowColor: 'shadow-cyan-500/40',
    textAccent: 'text-cyan-200'
  },
  'Ambassador': {
    cardGradient: 'from-purple-700 via-violet-800 to-purple-900',
    accentGradient: 'from-purple-300 via-fuchsia-200 to-purple-400',
    iconGradient: 'from-purple-200 to-fuchsia-300',
    glowColor: 'shadow-purple-500/40',
    textAccent: 'text-purple-200'
  }
};

function getTierIndex(tier: string | null): number {
  if (!tier) return 0;
  const tierName = tier === "silver" ? "Silver Elite" 
    : tier === "gold" ? "Gold Elite"
    : tier === "platinum" ? "Platinum Elite"
    : tier === "ambassador" ? "Ambassador"
    : "Member";
  return tierBadges.findIndex(t => t.level === tierName);
}

function LoyaltyBadges() {
  const { user, isAuthenticated } = useAuth();
  
  const annualTierIndex = getTierIndex(user?.annualTier || null);
  const lifetimeTierIndex = getTierIndex(user?.lifetimeTier || null);
  const effectiveTierIndex = Math.max(annualTierIndex, lifetimeTierIndex);

  return (
    <div className="py-4">
      {/* Section Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium uppercase tracking-widest mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          Dual Status System
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Your Path to Elite</h2>
        <p className="text-white/50 max-w-2xl mx-auto">
          Earn both <span className="text-white font-medium">Annual Status</span> (resets yearly) and 
          <span className="text-white font-medium"> Lifetime Status</span> (accumulates forever). 
          Your effective tier is always the higher of the two.
        </p>
      </div>

      {/* User's Current Status */}
      {isAuthenticated && user && (
        <div className="mb-14">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white/80">
            <TrendingUp className="h-5 w-5 text-amber-400" />
            Your Current Status
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Annual Status */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#0a4a82] to-cyan-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-300" />
              <div className="relative bg-[#0a1628] rounded-2xl overflow-hidden border border-white/10">
                <div className="bg-gradient-to-r from-[#0a4a82] to-[#0369a1] p-4">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Calendar className="h-4 w-4" />
                    <span>Annual Status ({new Date().getFullYear()})</span>
                  </div>
                </div>
                <div className="p-5">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${tierStyles[tierBadges[annualTierIndex].level].accentGradient} text-slate-900 text-sm font-bold mb-4`}>
                    {tierBadges[annualTierIndex].level}
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Visits this year:</span>
                      <span className="font-bold text-white">{user.annualVisits || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Points this year:</span>
                      <span className="font-bold text-white">{(user.annualPoints || 0).toLocaleString()}</span>
                    </div>
                    {annualTierIndex < tierBadges.length - 1 && (
                      <div className="pt-3 border-t border-white/10">
                        <div className="text-xs text-white/40 mb-2">
                          {tierBadges[annualTierIndex + 1].annualVisits - (user.annualVisits || 0)} more visits to {tierBadges[annualTierIndex + 1].level}
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-[#0a4a82] to-cyan-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((user.annualVisits || 0) / tierBadges[annualTierIndex + 1].annualVisits * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Lifetime Status */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-300" />
              <div className="relative bg-[#0a1628] rounded-2xl overflow-hidden border border-white/10">
                <div className="bg-gradient-to-r from-purple-600 to-fuchsia-600 p-4">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Infinity className="h-4 w-4" />
                    <span>Lifetime Status</span>
                  </div>
                </div>
                <div className="p-5">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${tierStyles[tierBadges[lifetimeTierIndex].level].accentGradient} text-slate-900 text-sm font-bold mb-4`}>
                    {tierBadges[lifetimeTierIndex].level}
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Total visits:</span>
                      <span className="font-bold text-white">{user.lifetimeVisits || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Total points:</span>
                      <span className="font-bold text-white">{(user.lifetimePoints || 0).toLocaleString()}</span>
                    </div>
                    {lifetimeTierIndex < tierBadges.length - 1 && (
                      <div className="pt-3 border-t border-white/10">
                        <div className="text-xs text-white/40 mb-2">
                          {tierBadges[lifetimeTierIndex + 1].lifetimeVisits - (user.lifetimeVisits || 0)} more to Lifetime {tierBadges[lifetimeTierIndex + 1].level}
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((user.lifetimeVisits || 0) / tierBadges[lifetimeTierIndex + 1].lifetimeVisits * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Effective Status */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl blur opacity-40 group-hover:opacity-60 transition duration-300" />
              <div className="relative bg-[#0a1628] rounded-2xl overflow-hidden border border-white/10">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Star className="h-4 w-4 fill-white" />
                    <span>Your Effective Tier</span>
                  </div>
                </div>
                <div className="p-5">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${tierStyles[tierBadges[effectiveTierIndex].level].accentGradient} text-slate-900 text-base font-bold mb-4`}>
                    {tierBadges[effectiveTierIndex].level}
                  </div>
                  <p className="text-sm text-white/50">
                    You enjoy the benefits of your highest status tier. 
                    {annualTierIndex > lifetimeTierIndex 
                      ? " Your annual status is currently higher!"
                      : annualTierIndex < lifetimeTierIndex
                      ? " Your lifetime status provides your benefits."
                      : " Both tiers are equal."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tier Requirements Tabs */}
      <Tabs defaultValue="annual" className="mb-10">
        <div className="flex justify-center mb-10">
          <div className="bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl">
            <TabsList className="grid grid-cols-2 w-80 bg-transparent">
              <TabsTrigger 
                value="annual" 
                className="flex items-center gap-2 rounded-xl text-white/60 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#0a4a82] data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
              >
                <Calendar className="h-4 w-4" />
                Annual
              </TabsTrigger>
              <TabsTrigger 
                value="lifetime" 
                className="flex items-center gap-2 rounded-xl text-white/60 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
              >
                <Infinity className="h-4 w-4" />
                Lifetime
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="annual">
          <div className="text-center mb-10">
            <p className="text-white/40">Annual status resets January 1st. Earn it fresh each year!</p>
          </div>
          <TierCards isLifetime={false} />
        </TabsContent>

        <TabsContent value="lifetime">
          <div className="text-center mb-10">
            <p className="text-white/40">Lifetime status accumulates forever. Once earned, it's your permanent floor.</p>
          </div>
          <TierCards isLifetime={true} />
        </TabsContent>
      </Tabs>
      
      {/* Explanation section */}
      <div className="bg-gradient-to-br from-white/[0.05] to-transparent rounded-2xl p-8 text-center border border-white/10">
        <h3 className="font-bold text-lg mb-3 text-white">How It Works</h3>
        <p className="text-white/50 max-w-3xl mx-auto leading-relaxed">
          Each year, you start fresh on annual status. At year's end, if you don't re-qualify, you fall back to your 
          <span className="text-white font-medium"> Lifetime Status</span> - which never decreases.
          Your effective tier is always the <span className="text-amber-400 font-medium">higher</span> of annual or lifetime.
        </p>
      </div>
    </div>
  );
}

function TierCards({ isLifetime }: { isLifetime: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
      {tierBadges.map((badge, i) => {
        const IconComponent = iconMap[badge.level] || Award;
        const styles = tierStyles[badge.level];
        const visits = isLifetime ? badge.lifetimeVisits : badge.annualVisits;
        const points = isLifetime ? badge.lifetimePoints : badge.annualPoints;
        
        return (
          <div key={i} className="group perspective-1000">
            <div 
              className={`relative rounded-2xl overflow-hidden shadow-2xl ${styles.glowColor} hover:scale-105 hover:-rotate-1 transition-all duration-500 transform-gpu`}
            >
              {/* Card background with gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${styles.cardGradient}`} />
              
              {/* Decorative pattern overlay */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.15) 0%, transparent 50%), 
                                    radial-gradient(circle at 80% 70%, rgba(255,255,255,0.1) 0%, transparent 50%)`
                }} />
              </div>
              
              {/* Card content */}
              <div className="relative p-6">
                {/* Tier number */}
                <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-sm font-bold text-white/60 border border-white/10">
                  {i + 1}
                </div>
                
                {/* Icon with metallic effect */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${styles.iconGradient} flex items-center justify-center mb-5 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                  <IconComponent className="h-8 w-8 text-slate-800" />
                </div>
                
                {/* Title */}
                <h3 className="text-xl font-black text-white mb-1">{badge.level}</h3>
                
                {/* Requirement */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-sm font-medium ${styles.textAccent} border border-white/10 mb-4`}>
                  {visits === 0 ? 'Free' : `${visits.toLocaleString()} Visits`}
                </div>
                
                {points > 0 && (
                  <p className="text-xs text-white/40 mb-4">or {points.toLocaleString()} pts</p>
                )}
                
                {/* Points Earning - Clear breakdown */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl py-4 px-4 text-center mb-5 border border-white/10">
                  <div className="text-2xl font-black text-white mb-1">
                    {badge.pointsPerDollar} <span className="text-base font-medium text-white/60">pts/$1</span>
                  </div>
                  {badge.bonusPercent > 0 ? (
                    <div className="flex items-center justify-center gap-1.5 text-xs">
                      <span className="text-white/40">Base 10 pts</span>
                      <span className={`font-bold ${styles.textAccent}`}>+{badge.bonusPercent}% bonus</span>
                    </div>
                  ) : (
                    <div className="text-xs text-white/40">Base earning rate</div>
                  )}
                </div>
                
                {/* Perks list */}
                <div className="space-y-2.5 mb-5">
                  {badge.perks.map((perk, j) => (
                    <div key={j} className="flex items-start gap-2 text-sm">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${styles.iconGradient} flex items-center justify-center shrink-0`}>
                        <Check className="h-3 w-3 text-slate-800" />
                      </div>
                      <span className="text-white/60">{perk}</span>
                    </div>
                  ))}
                </div>
                
                {/* Discount badge */}
                {badge.discount && (
                  <div className="flex items-center justify-center">
                    <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/30">
                      <Gift className="h-4 w-4" />
                      {badge.discount}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default LoyaltyBadges;
