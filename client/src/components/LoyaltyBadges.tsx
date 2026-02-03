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
    perks: ['5% off at partners', 'Free upgrades when available', 'Priority support'],
    discount: '5% off'
  },
  { 
    level: 'Ambassador', 
    annualVisits: 100,
    annualPoints: 200000,
    lifetimeVisits: 1000,
    lifetimePoints: 2000000,
    pointsBonus: '+75% bonus',
    perks: ['10% off at partners', 'Free upgrades when available', 'Invite-only events'],
    discount: '10% off'
  }
];

const tierStyles: Record<string, {
  gradient: string;
  headerGradient: string;
  iconBg: string;
  iconColor: string;
  ring: string;
  textColor: string;
}> = {
  'Member': {
    gradient: 'from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900',
    headerGradient: 'from-slate-500 to-slate-700',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    ring: 'ring-slate-200 dark:ring-slate-700',
    textColor: 'text-slate-600'
  },
  'Silver Elite': {
    gradient: 'from-slate-100 to-gray-200 dark:from-slate-700 dark:to-slate-800',
    headerGradient: 'from-slate-400 to-slate-600',
    iconBg: 'bg-gradient-to-br from-slate-200 to-gray-300',
    iconColor: 'text-slate-700',
    ring: 'ring-slate-300 dark:ring-slate-600',
    textColor: 'text-slate-700'
  },
  'Gold Elite': {
    gradient: 'from-amber-50 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/40',
    headerGradient: 'from-amber-400 to-amber-600',
    iconBg: 'bg-gradient-to-br from-amber-200 to-yellow-300',
    iconColor: 'text-amber-700',
    ring: 'ring-amber-300 dark:ring-amber-600',
    textColor: 'text-amber-700'
  },
  'Platinum Elite': {
    gradient: 'from-cyan-50 to-sky-100 dark:from-cyan-900/40 dark:to-sky-900/40',
    headerGradient: 'from-cyan-400 to-sky-600',
    iconBg: 'bg-gradient-to-br from-cyan-200 to-sky-300',
    iconColor: 'text-cyan-700',
    ring: 'ring-cyan-300 dark:ring-cyan-600',
    textColor: 'text-cyan-700'
  },
  'Ambassador': {
    gradient: 'from-purple-50 to-violet-100 dark:from-purple-900/40 dark:to-violet-900/40',
    headerGradient: 'from-purple-500 to-violet-600',
    iconBg: 'bg-gradient-to-br from-purple-200 to-violet-300',
    iconColor: 'text-purple-700',
    ring: 'ring-purple-300 dark:ring-purple-600',
    textColor: 'text-purple-700'
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
      {/* User's Current Status */}
      {isAuthenticated && user && (
        <div className="mb-12">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
            <TrendingUp className="h-6 w-6 text-[#0a4a82]" />
            Your Elite Status
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Annual Status */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl shadow-blue-200/30 dark:shadow-blue-900/30 ring-1 ring-blue-100 dark:ring-blue-800">
              <div className="bg-gradient-to-br from-[#0a4a82] to-[#083a6a] p-4">
                <div className="flex items-center gap-2 text-white">
                  <Calendar className="h-5 w-5" />
                  <span className="font-semibold">Annual Status ({new Date().getFullYear()})</span>
                </div>
              </div>
              <div className="p-5">
                <div className="mb-4">
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${tierStyles[tierBadges[annualTierIndex].level].iconBg} ${tierStyles[tierBadges[annualTierIndex].level].iconColor}`}>
                    {tierBadges[annualTierIndex].level}
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Visits this year:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{user.annualVisits || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Points this year:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{(user.annualPoints || 0).toLocaleString()}</span>
                  </div>
                  {annualTierIndex < tierBadges.length - 1 && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                      <div className="text-xs text-slate-500 mb-2">
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
            </div>

            {/* Lifetime Status */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl shadow-purple-200/30 dark:shadow-purple-900/30 ring-1 ring-purple-100 dark:ring-purple-800">
              <div className="bg-gradient-to-br from-purple-500 to-violet-600 p-4">
                <div className="flex items-center gap-2 text-white">
                  <Infinity className="h-5 w-5" />
                  <span className="font-semibold">Lifetime Status</span>
                </div>
              </div>
              <div className="p-5">
                <div className="mb-4">
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${tierStyles[tierBadges[lifetimeTierIndex].level].iconBg} ${tierStyles[tierBadges[lifetimeTierIndex].level].iconColor}`}>
                    {tierBadges[lifetimeTierIndex].level}
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Total visits:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{user.lifetimeVisits || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Total points:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{(user.lifetimePoints || 0).toLocaleString()}</span>
                  </div>
                  {lifetimeTierIndex < tierBadges.length - 1 && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                      <div className="text-xs text-slate-500 mb-2">
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
            </div>

            {/* Effective Status */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl shadow-amber-200/30 dark:shadow-amber-900/30 ring-1 ring-amber-100 dark:ring-amber-800">
              <div className="bg-gradient-to-br from-amber-400 to-amber-600 p-4">
                <div className="flex items-center gap-2 text-white">
                  <Star className="h-5 w-5 fill-white" />
                  <span className="font-semibold">Your Effective Tier</span>
                </div>
              </div>
              <div className="p-5">
                <div className="mb-4">
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-base font-bold ${tierStyles[tierBadges[effectiveTierIndex].level].iconBg} ${tierStyles[tierBadges[effectiveTierIndex].level].iconColor}`}>
                    {tierBadges[effectiveTierIndex].level}
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
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
        </div>
      )}

      {/* Tier Requirements Tabs */}
      <Tabs defaultValue="annual" className="mb-8">
        <div className="flex justify-center mb-8">
          <div className="bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-200/50 dark:border-slate-700/50">
            <TabsList className="grid grid-cols-2 w-80 bg-transparent">
              <TabsTrigger value="annual" className="flex items-center gap-2 rounded-xl data-[state=active]:bg-[#0a4a82] data-[state=active]:text-white">
                <Calendar className="h-4 w-4" />
                Annual
              </TabsTrigger>
              <TabsTrigger value="lifetime" className="flex items-center gap-2 rounded-xl data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                <Infinity className="h-4 w-4" />
                Lifetime
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="annual">
          <div className="text-center mb-8">
            <p className="text-slate-600 dark:text-slate-400">
              Annual status resets January 1st. Earn it fresh each year!
            </p>
          </div>
          <TierCards isLifetime={false} />
        </TabsContent>

        <TabsContent value="lifetime">
          <div className="text-center mb-8">
            <p className="text-slate-600 dark:text-slate-400">
              Lifetime status accumulates forever. Once earned, it's your permanent floor.
            </p>
          </div>
          <TierCards isLifetime={true} />
        </TabsContent>
      </Tabs>
      
      {/* Explanation section */}
      <div className="bg-gradient-to-br from-[#0a4a82]/5 to-purple-50 dark:from-[#0a4a82]/20 dark:to-purple-900/20 rounded-2xl p-8 text-center border border-[#0a4a82]/10 dark:border-[#0a4a82]/30">
        <h3 className="font-bold text-lg mb-3 text-slate-900 dark:text-white">How It Works</h3>
        <p className="text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
          Each year, you start fresh on annual status. Earn visits and points throughout the year to climb the tiers.
          At year's end, if you don't re-qualify, you fall back to your <strong className="text-slate-900 dark:text-white">Lifetime Status</strong> - which never decreases.
          Your effective tier is always the <strong className="text-slate-900 dark:text-white">higher</strong> of annual or lifetime.
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
        const styles = tierStyles[badge.level] || tierStyles['Member'];
        const visits = isLifetime ? badge.lifetimeVisits : badge.annualVisits;
        const points = isLifetime ? badge.lifetimePoints : badge.annualPoints;
        
        return (
          <div 
            key={i} 
            className={`group relative bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 ring-1 ${styles.ring}`}
          >
            {/* Gradient Header */}
            <div className={`bg-gradient-to-br ${styles.headerGradient} p-5 text-white relative`}>
              {/* Tier number */}
              <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-sm font-bold">
                {i + 1}
              </div>
              
              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl ${styles.iconBg} flex items-center justify-center shadow-lg mx-auto mb-3`}>
                <IconComponent className={`h-7 w-7 ${styles.iconColor}`} />
              </div>
              
              {/* Title */}
              <h3 className="text-center text-lg font-bold">{badge.level}</h3>
            </div>
            
            {/* Content */}
            <div className={`p-5 bg-gradient-to-b ${styles.gradient}`}>
              {/* Visits requirement */}
              <div className="text-center mb-4">
                <div className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white dark:bg-slate-700 shadow-sm text-sm font-bold ${styles.textColor} dark:text-white`}>
                  {visits === 0 ? 'Free' : `${visits.toLocaleString()} Visits`}
                </div>
                {points > 0 && (
                  <p className="text-xs text-slate-500 mt-2">or {points.toLocaleString()} pts</p>
                )}
              </div>
              
              {/* Points Bonus */}
              <div className={`bg-white dark:bg-slate-700 rounded-xl py-3 px-4 text-center mb-4 shadow-sm`}>
                <div className="flex items-center justify-center gap-1.5">
                  <Zap className={`h-4 w-4 ${styles.textColor}`} />
                  <span className={`font-bold ${styles.textColor}`}>{badge.pointsBonus}</span>
                </div>
              </div>
              
              {/* Perks list */}
              <div className="space-y-2 mb-4">
                {badge.perks.map((perk, j) => (
                  <div key={j} className="flex items-start gap-2 text-sm">
                    <div className={`w-4 h-4 rounded-full ${styles.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Check className={`h-2.5 w-2.5 ${styles.iconColor}`} />
                    </div>
                    <span className="text-slate-600 dark:text-slate-400">{perk}</span>
                  </div>
                ))}
              </div>
              
              {/* Discount badge */}
              {badge.discount && (
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-bold shadow-lg shadow-green-500/25">
                    <Gift className="h-4 w-4" />
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
