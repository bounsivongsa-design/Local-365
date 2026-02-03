import { Award, Star, Crown, Gem, Users, Sparkles, Check, Zap, Gift, Calendar, Infinity, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TierInfo {
  level: string;
  annualVisits: number;
  annualPoints: number;
  lifetimeVisits: number;
  lifetimePoints: number;
  pointsBonus: string;
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

const styleMap: Record<string, { 
  cardBg: string;
  metallicClass: string;
  accentColor: string;
  borderGlow: string;
  textColor: string;
}> = {
  'Member': { 
    cardBg: 'from-slate-50 via-gray-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900',
    metallicClass: 'metallic-silver',
    accentColor: 'text-slate-500 dark:text-slate-400',
    borderGlow: 'border-slate-200 shadow-slate-300/20',
    textColor: 'text-slate-600'
  },
  'Silver Elite': { 
    cardBg: 'from-slate-50 via-gray-100 to-slate-200 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800',
    metallicClass: 'metallic-silver',
    accentColor: 'text-slate-600 dark:text-slate-300',
    borderGlow: 'border-slate-300 shadow-slate-400/30',
    textColor: 'text-slate-700'
  },
  'Gold Elite': { 
    cardBg: 'from-amber-50 via-yellow-100 to-orange-100 dark:from-amber-900/40 dark:via-yellow-900/30 dark:to-orange-900/40',
    metallicClass: 'metallic-gold',
    accentColor: 'text-amber-700 dark:text-amber-300',
    borderGlow: 'border-amber-400 shadow-amber-400/40',
    textColor: 'text-amber-800'
  },
  'Platinum Elite': { 
    cardBg: 'from-sky-50 via-cyan-100 to-blue-100 dark:from-cyan-900/40 dark:via-sky-900/30 dark:to-blue-900/40',
    metallicClass: 'metallic-platinum',
    accentColor: 'text-sky-700 dark:text-sky-300',
    borderGlow: 'border-sky-400 shadow-sky-400/40',
    textColor: 'text-sky-700'
  },
  'Ambassador': { 
    cardBg: 'from-violet-50 via-purple-100 to-fuchsia-100 dark:from-violet-900/40 dark:via-purple-900/30 dark:to-fuchsia-900/40',
    metallicClass: 'metallic-purple',
    accentColor: 'text-purple-700 dark:text-purple-300',
    borderGlow: 'border-purple-400 shadow-purple-400/40',
    textColor: 'text-purple-700'
  },
};

const tierBadges: TierInfo[] = [
  { 
    level: 'Member', 
    annualVisits: 0,
    annualPoints: 0,
    lifetimeVisits: 0,
    lifetimePoints: 0,
    pointsBonus: '10 pts/$1',
    perks: ['Earn 10 pts per $1', 'Local business deals', 'Community updates']
  },
  { 
    level: 'Silver Elite', 
    annualVisits: 10,
    annualPoints: 25000,
    lifetimeVisits: 100,
    lifetimePoints: 250000,
    pointsBonus: '+10% bonus',
    perks: ['Priority scheduling', 'Birthday deal from locals', 'Early quote responses']
  },
  { 
    level: 'Gold Elite', 
    annualVisits: 25,
    annualPoints: 50000,
    lifetimeVisits: 250,
    lifetimePoints: 500000,
    pointsBonus: '+25% bonus',
    perks: ['First dibs on services', 'Featured reviewer badge', 'Event early access']
  },
  { 
    level: 'Platinum Elite', 
    annualVisits: 50,
    annualPoints: 100000,
    lifetimeVisits: 500,
    lifetimePoints: 1000000,
    pointsBonus: '+50% bonus',
    perks: ['5% off at partners', 'Priority support', 'Seasonal local gifts'],
    discount: '5% off'
  },
  { 
    level: 'Ambassador', 
    annualVisits: 100,
    annualPoints: 200000,
    lifetimeVisits: 1000,
    lifetimePoints: 2000000,
    pointsBonus: '+75% bonus',
    perks: ['10% off at partners', 'Ambassador badge', 'Invite-only events'],
    discount: '10% off'
  }
];

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
    <div className="py-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/20 to-sand/30 text-primary text-sm font-semibold mb-4 shadow-sm">
          <Sparkles className="h-4 w-4" />
          Local 365 Rewards
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-3">
          Dual Elite Status System
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Earn both <strong>Annual Status</strong> (resets yearly) and <strong>Lifetime Status</strong> (accumulates forever). 
          Your effective tier is always the higher of the two!
        </p>
      </div>

      {/* User's Current Status */}
      {isAuthenticated && user && (
        <div className="mb-10 bg-white/90 dark:bg-slate-800/90 rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Your Elite Status
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Annual Status */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-5 w-5 text-blue-600" />
                <span className="font-semibold">Annual Status ({new Date().getFullYear()})</span>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <Badge className={`${styleMap[tierBadges[annualTierIndex].level].accentColor} ${styleMap[tierBadges[annualTierIndex].level].cardBg} text-base py-1 px-3`}>
                  {tierBadges[annualTierIndex].level}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Visits this year:</span>
                  <span className="font-medium">{user.annualVisits || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Points this year:</span>
                  <span className="font-medium">{(user.annualPoints || 0).toLocaleString()}</span>
                </div>
                {annualTierIndex < tierBadges.length - 1 && (
                  <div className="pt-2">
                    <div className="text-xs text-muted-foreground mb-1">
                      {tierBadges[annualTierIndex + 1].annualVisits - (user.annualVisits || 0)} more visits to {tierBadges[annualTierIndex + 1].level}
                    </div>
                    <Progress 
                      value={(user.annualVisits || 0) / tierBadges[annualTierIndex + 1].annualVisits * 100} 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Lifetime Status */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-3">
                <Infinity className="h-5 w-5 text-purple-600" />
                <span className="font-semibold">Lifetime Status</span>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <Badge className={`${styleMap[tierBadges[lifetimeTierIndex].level].accentColor} ${styleMap[tierBadges[lifetimeTierIndex].level].cardBg} text-base py-1 px-3`}>
                  {tierBadges[lifetimeTierIndex].level}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total visits:</span>
                  <span className="font-medium">{user.lifetimeVisits || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total points:</span>
                  <span className="font-medium">{(user.lifetimePoints || 0).toLocaleString()}</span>
                </div>
                {lifetimeTierIndex < tierBadges.length - 1 && (
                  <div className="pt-2">
                    <div className="text-xs text-muted-foreground mb-1">
                      {tierBadges[lifetimeTierIndex + 1].lifetimeVisits - (user.lifetimeVisits || 0)} more visits to Lifetime {tierBadges[lifetimeTierIndex + 1].level}
                    </div>
                    <Progress 
                      value={(user.lifetimeVisits || 0) / tierBadges[lifetimeTierIndex + 1].lifetimeVisits * 100} 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Effective Status */}
            <div className={`bg-gradient-to-br ${styleMap[tierBadges[effectiveTierIndex].level].cardBg} rounded-xl p-4 border-2 ${styleMap[tierBadges[effectiveTierIndex].level].borderGlow}`}>
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                <span className="font-semibold">Your Effective Tier</span>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <Badge className={`${styleMap[tierBadges[effectiveTierIndex].level].accentColor} bg-white/80 dark:bg-slate-800/80 text-lg py-1.5 px-4`}>
                  {tierBadges[effectiveTierIndex].level}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                You enjoy the benefits of your highest status tier. 
                {annualTierIndex > lifetimeTierIndex 
                  ? " Your annual status is currently higher!"
                  : annualTierIndex < lifetimeTierIndex
                  ? " Your lifetime status provides your benefits this year."
                  : " Both tiers are equal."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tier Requirements Tabs */}
      <Tabs defaultValue="annual" className="mb-8">
        <div className="flex justify-center mb-6">
          <TabsList className="grid grid-cols-2 w-80">
            <TabsTrigger value="annual" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Annual
            </TabsTrigger>
            <TabsTrigger value="lifetime" className="flex items-center gap-2">
              <Infinity className="h-4 w-4" />
              Lifetime
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="annual">
          <div className="text-center mb-6">
            <p className="text-muted-foreground text-sm">
              Annual status resets January 1st. Earn it fresh each year!
            </p>
          </div>
          <TierCards isLifetime={false} />
        </TabsContent>

        <TabsContent value="lifetime">
          <div className="text-center mb-6">
            <p className="text-muted-foreground text-sm">
              Lifetime status accumulates forever. Once earned, it's your permanent floor.
            </p>
          </div>
          <TierCards isLifetime={true} />
        </TabsContent>
      </Tabs>
      
      {/* Explanation section */}
      <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-6 text-center">
        <h3 className="font-semibold mb-2">How It Works (Like Marriott Bonvoy)</h3>
        <p className="text-sm text-muted-foreground max-w-3xl mx-auto">
          Each year, you start fresh on annual status. Earn visits and points throughout the year to climb the tiers.
          At year's end, if you don't re-qualify, you fall back to your <strong>Lifetime Status</strong> - which never decreases.
          Your effective tier is always the <strong>higher</strong> of annual or lifetime. Example: 4 months of heavy visiting 
          might earn you annual Platinum, but only lifetime Silver. Next year, if you visit less, you still keep Silver benefits!
        </p>
      </div>
    </div>
  );
}

function TierCards({ isLifetime }: { isLifetime: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {tierBadges.map((badge, i) => {
        const IconComponent = iconMap[badge.level] || Award;
        const styles = styleMap[badge.level] || styleMap['Member'];
        const visits = isLifetime ? badge.lifetimeVisits : badge.annualVisits;
        const points = isLifetime ? badge.lifetimePoints : badge.annualPoints;
        
        return (
          <div 
            key={i} 
            className={`group relative rounded-2xl overflow-hidden border-2 ${styles.borderGlow} shadow-[0_10px_40px_-10px] hover:shadow-[0_20px_50px_-10px] hover:scale-[1.02] transition-all duration-300`}
          >
            <div className={`relative h-full bg-gradient-to-br ${styles.cardBg} p-5`}>
              {/* Tier number badge */}
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-xs font-bold">
                {i + 1}
              </div>
              
              {/* Metallic icon container */}
              <div className="relative mx-auto mb-4 w-fit">
                <div className={`w-16 h-16 rounded-full ${styles.metallicClass} flex items-center justify-center`}>
                  <div className="w-12 h-12 rounded-full bg-white/90 dark:bg-slate-800/90 flex items-center justify-center shadow-inner">
                    <IconComponent className={`h-6 w-6 ${styles.accentColor}`} />
                  </div>
                </div>
              </div>
              
              {/* Title */}
              <h3 className={`text-center text-lg font-extrabold mb-1 ${styles.textColor} dark:text-white`}>
                {badge.level}
              </h3>
              
              {/* Visits/Points requirement */}
              <div className="flex flex-col items-center gap-1 mb-3">
                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/80 dark:bg-white/10 border border-white/50 dark:border-white/20 text-xs font-medium">
                  {visits === 0 ? 'Free' : `${visits.toLocaleString()} Visits`}
                </div>
                {points > 0 && (
                  <div className="text-xs text-muted-foreground">
                    or {points.toLocaleString()} pts
                  </div>
                )}
              </div>
              
              {/* Points Bonus */}
              <div className="bg-white/90 dark:bg-slate-800/90 rounded-lg py-2 px-3 text-center mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                <div className="flex items-center justify-center gap-1">
                  <Zap className={`h-4 w-4 ${styles.accentColor}`} />
                  <span className={`text-sm font-bold ${styles.accentColor}`}>{badge.pointsBonus}</span>
                </div>
              </div>
              
              {/* Perks list */}
              <div className="space-y-1.5 mb-3">
                {badge.perks.map((perk, j) => (
                  <div key={j} className="flex items-start gap-1.5 text-xs">
                    <Check className={`h-3 w-3 mt-0.5 shrink-0 ${styles.accentColor}`} />
                    <span className="text-muted-foreground">{perk}</span>
                  </div>
                ))}
              </div>
              
              {/* Discount badge (only for higher tiers) */}
              {badge.discount && (
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                    <Gift className="h-3 w-3" />
                    {badge.discount}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default LoyaltyBadges;
