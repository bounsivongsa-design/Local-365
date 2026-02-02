import { useState, useEffect } from "react";
import { Award, Star, Crown, Gem, AlertCircle, Sparkles, Check } from "lucide-react";

interface Badge {
  level: string;
  stays: number;
  perk: string;
}

const iconMap: Record<string, typeof Award> = {
  'Silver Visitor': Award,
  'Gold Visitor': Star,
  'Platinum Visitor': Crown,
  'Titanium Visitor': Gem,
};

const styleMap: Record<string, { 
  cardBg: string;
  iconGradient: string;
  accentColor: string;
  glowColor: string;
  ringColor: string;
  textGradient: string;
}> = {
  'Silver Visitor': { 
    cardBg: 'from-slate-100 via-gray-50 to-slate-200 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800',
    iconGradient: 'from-slate-400 via-gray-300 to-slate-500',
    accentColor: 'text-slate-600 dark:text-slate-300',
    glowColor: 'shadow-slate-400/40',
    ringColor: 'ring-slate-300 dark:ring-slate-600',
    textGradient: 'from-slate-600 to-gray-500'
  },
  'Gold Visitor': { 
    cardBg: 'from-amber-100 via-yellow-50 to-orange-100 dark:from-amber-900/40 dark:via-yellow-900/30 dark:to-orange-900/40',
    iconGradient: 'from-yellow-400 via-amber-500 to-orange-500',
    accentColor: 'text-amber-700 dark:text-amber-300',
    glowColor: 'shadow-amber-400/50',
    ringColor: 'ring-amber-400 dark:ring-amber-500',
    textGradient: 'from-amber-600 to-orange-600'
  },
  'Platinum Visitor': { 
    cardBg: 'from-cyan-100 via-sky-50 to-blue-100 dark:from-cyan-900/40 dark:via-sky-900/30 dark:to-blue-900/40',
    iconGradient: 'from-cyan-400 via-sky-500 to-blue-600',
    accentColor: 'text-sky-700 dark:text-sky-300',
    glowColor: 'shadow-sky-400/50',
    ringColor: 'ring-sky-400 dark:ring-sky-500',
    textGradient: 'from-cyan-600 to-blue-600'
  },
  'Titanium Visitor': { 
    cardBg: 'from-violet-100 via-purple-50 to-fuchsia-100 dark:from-violet-900/40 dark:via-purple-900/30 dark:to-fuchsia-900/40',
    iconGradient: 'from-violet-500 via-purple-500 to-fuchsia-600',
    accentColor: 'text-purple-700 dark:text-purple-300',
    glowColor: 'shadow-purple-400/50',
    ringColor: 'ring-purple-400 dark:ring-purple-500',
    textGradient: 'from-violet-600 to-fuchsia-600'
  },
};

const dummyBadges: Badge[] = [
  { level: 'Silver Visitor', stays: 1, perk: '5% off next booking' },
  { level: 'Gold Visitor', stays: 3, perk: '10% off next booking' },
  { level: 'Platinum Visitor', stays: 5, perk: '15% off next booking' },
  { level: 'Titanium Visitor', stays: 8, perk: '20% off next booking' }
];

function LoyaltyBadges() {
  const [badges, setBadges] = useState<Badge[]>(dummyBadges);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBadges() {
      try {
        const response = await fetch('/api/loyalty-badges');
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            setBadges(data);
          }
        }
      } catch (err) {
        setError('Failed to load badges — try refreshing.');
      }
    }
    fetchBadges();
  }, []);

  return (
    <div className="py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/20 to-sand/30 text-primary text-sm font-semibold mb-4 shadow-sm">
          <Sparkles className="h-4 w-4" />
          Exclusive Rewards
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-primary via-primary to-sand bg-clip-text text-transparent">
          OBX Insider Loyalty Tiers
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Unlock exclusive perks and savings with every visit to the Outer Banks
        </p>
      </div>
      
      {error && (
        <div className="flex items-center justify-center gap-2 text-amber-600 mb-6">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {badges.map((badge, i) => {
          const IconComponent = iconMap[badge.level] || Award;
          const styles = styleMap[badge.level] || styleMap['Silver Visitor'];
          const tierName = badge.level.replace(' Visitor', '');
          
          return (
            <div 
              key={i} 
              className={`group relative rounded-2xl p-[2px] bg-gradient-to-br ${styles.iconGradient} shadow-lg ${styles.glowColor} hover:shadow-2xl hover:scale-[1.03] transition-all duration-300`}
            >
              {/* Inner card */}
              <div className={`relative h-full rounded-[14px] bg-gradient-to-br ${styles.cardBg} p-6 overflow-hidden`}>
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                
                {/* Tier number */}
                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/50 dark:bg-white/10 flex items-center justify-center text-sm font-bold opacity-60">
                  {i + 1}
                </div>
                
                {/* Icon with ring */}
                <div className="relative mx-auto mb-5 w-fit">
                  <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${styles.iconGradient} p-[3px] shadow-xl ${styles.glowColor} ring-4 ${styles.ringColor} ring-offset-2 ring-offset-white dark:ring-offset-slate-900`}>
                    <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                      <IconComponent className={`h-9 w-9 bg-gradient-to-br ${styles.iconGradient} bg-clip-text`} style={{ color: 'transparent', background: `linear-gradient(to bottom right, var(--tw-gradient-stops))`, WebkitBackgroundClip: 'text', backgroundClip: 'text' }} />
                    </div>
                  </div>
                  {/* Decorative dots */}
                  <div className={`absolute -top-1 -left-1 w-3 h-3 rounded-full bg-gradient-to-br ${styles.iconGradient} opacity-60`} />
                  <div className={`absolute -bottom-1 -right-1 w-2 h-2 rounded-full bg-gradient-to-br ${styles.iconGradient} opacity-40`} />
                </div>
                
                {/* Title */}
                <h3 className={`text-center text-xl font-extrabold mb-1 bg-gradient-to-r ${styles.textGradient} bg-clip-text text-transparent`}>
                  {tierName}
                </h3>
                <p className="text-center text-xs text-muted-foreground mb-4 uppercase tracking-wider font-medium">
                  Visitor Tier
                </p>
                
                {/* Stays requirement */}
                <div className="flex items-center justify-center gap-2 mb-5">
                  <div className={`flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/70 dark:bg-white/10 border border-white/50 dark:border-white/20 shadow-sm`}>
                    <Check className={`h-4 w-4 ${styles.accentColor}`} />
                    <span className="text-sm font-semibold">{badge.stays} {badge.stays === 1 ? 'Stay' : 'Stays'}</span>
                  </div>
                </div>
                
                {/* Perk */}
                <div className={`text-center py-3 px-4 rounded-xl bg-gradient-to-r ${styles.iconGradient} bg-opacity-10`} style={{ background: `linear-gradient(to right, rgba(var(--tw-gradient-stops)))` }}>
                  <div className="bg-white/90 dark:bg-slate-900/90 rounded-lg py-2 px-3">
                    <p className={`text-lg font-bold ${styles.accentColor}`}>{badge.perk}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LoyaltyBadges;
