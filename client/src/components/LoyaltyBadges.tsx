import { useState, useEffect } from "react";
import { Award, Star, Crown, Gem, Users, AlertCircle, Sparkles, Check, Zap, Gift, Clock, Ticket } from "lucide-react";

interface Badge {
  level: string;
  visits: number;
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

const tierBadges: Badge[] = [
  { 
    level: 'Member', 
    visits: 0, 
    pointsBonus: '10 pts/$1',
    perks: ['Member-only rates', 'Mobile check-in', 'Local event updates']
  },
  { 
    level: 'Silver Elite', 
    visits: 5, 
    pointsBonus: '+10% bonus',
    perks: ['Priority reservations', 'Birthday bonus points', 'Extended cancellations']
  },
  { 
    level: 'Gold Elite', 
    visits: 15, 
    pointsBonus: '+25% bonus',
    perks: ['Early event access', 'Welcome gift', 'Complimentary upgrades']
  },
  { 
    level: 'Platinum Elite', 
    visits: 30, 
    pointsBonus: '+50% bonus',
    perks: ['Exclusive experiences', 'VIP event seating', 'Dedicated support'],
    discount: '5% off'
  },
  { 
    level: 'Ambassador', 
    visits: 50, 
    pointsBonus: '+75% bonus',
    perks: ['Personal concierge', 'Annual choice benefit', 'Partner status'],
    discount: '10% off'
  }
];

function LoyaltyBadges() {
  const [badges] = useState<Badge[]>(tierBadges);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/20 to-sand/30 text-primary text-sm font-semibold mb-4 shadow-sm">
          <Sparkles className="h-4 w-4" />
          Marriott Bonvoy-Inspired Rewards
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-3">
          Currituck Elite Status Tiers
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Earn bonus points, unlock exclusive perks, and elevate your Currituck experience
        </p>
      </div>
      
      {error && (
        <div className="flex items-center justify-center gap-2 text-amber-600 mb-6">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {badges.map((badge, i) => {
          const IconComponent = iconMap[badge.level] || Award;
          const styles = styleMap[badge.level] || styleMap['Member'];
          
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
                
                {/* Visits requirement */}
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/80 dark:bg-white/10 border border-white/50 dark:border-white/20 text-xs font-medium">
                    {badge.visits === 0 ? 'Free' : `${badge.visits} Visits`}
                  </div>
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
      
      {/* Explanation section */}
      <div className="mt-8 bg-white/60 dark:bg-slate-800/60 rounded-xl p-6 text-center">
        <h3 className="font-semibold mb-2">Why Points Over Discounts?</h3>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Like Marriott Bonvoy, our program rewards you with bonus points that accumulate faster as you advance. 
          Discounts are reserved for our most loyal visitors (30+ visits) to ensure local businesses thrive 
          while still rewarding your loyalty. Redeem points for exclusive experiences, event tickets, and more!
        </p>
      </div>
    </div>
  );
}

export default LoyaltyBadges;
