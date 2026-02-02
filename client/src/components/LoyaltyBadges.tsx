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
  metallicClass: string;
  accentColor: string;
  borderGlow: string;
  textColor: string;
}> = {
  'Silver Visitor': { 
    cardBg: 'from-slate-50 via-gray-100 to-slate-200 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800',
    metallicClass: 'metallic-silver',
    accentColor: 'text-slate-600 dark:text-slate-300',
    borderGlow: 'border-slate-300 shadow-slate-400/30',
    textColor: 'text-slate-700'
  },
  'Gold Visitor': { 
    cardBg: 'from-amber-50 via-yellow-100 to-orange-100 dark:from-amber-900/40 dark:via-yellow-900/30 dark:to-orange-900/40',
    metallicClass: 'metallic-gold',
    accentColor: 'text-amber-700 dark:text-amber-300',
    borderGlow: 'border-amber-400 shadow-amber-400/40',
    textColor: 'text-amber-800'
  },
  'Platinum Visitor': { 
    cardBg: 'from-sky-50 via-cyan-100 to-blue-100 dark:from-cyan-900/40 dark:via-sky-900/30 dark:to-blue-900/40',
    metallicClass: 'metallic-platinum',
    accentColor: 'text-sky-700 dark:text-sky-300',
    borderGlow: 'border-sky-400 shadow-sky-400/40',
    textColor: 'text-sky-700'
  },
  'Titanium Visitor': { 
    cardBg: 'from-violet-50 via-purple-100 to-fuchsia-100 dark:from-violet-900/40 dark:via-purple-900/30 dark:to-fuchsia-900/40',
    metallicClass: 'metallic-purple',
    accentColor: 'text-purple-700 dark:text-purple-300',
    borderGlow: 'border-purple-400 shadow-purple-400/40',
    textColor: 'text-purple-700'
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
        <h2 className="text-3xl md:text-4xl font-bold mb-3">
          Currituck Insider Loyalty Tiers
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Unlock exclusive perks and savings with every visit to Currituck County
        </p>
      </div>
      
      {error && (
        <div className="flex items-center justify-center gap-2 text-amber-600 mb-6">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {badges.map((badge, i) => {
          const IconComponent = iconMap[badge.level] || Award;
          const styles = styleMap[badge.level] || styleMap['Silver Visitor'];
          const tierName = badge.level.replace(' Visitor', '');
          
          return (
            <div 
              key={i} 
              className={`group relative rounded-2xl overflow-hidden border-2 ${styles.borderGlow} shadow-[0_10px_40px_-10px] hover:shadow-[0_20px_50px_-10px] hover:scale-[1.02] transition-all duration-300`}
            >
              {/* Card background */}
              <div className={`relative h-full bg-gradient-to-br ${styles.cardBg} p-6`}>
                {/* Tier number badge */}
                <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </div>
                
                {/* Metallic icon container */}
                <div className="relative mx-auto mb-5 w-fit">
                  <div className={`w-20 h-20 rounded-full ${styles.metallicClass} flex items-center justify-center`}>
                    <div className="w-16 h-16 rounded-full bg-white/90 dark:bg-slate-800/90 flex items-center justify-center shadow-inner">
                      <IconComponent className={`h-8 w-8 ${styles.accentColor}`} />
                    </div>
                  </div>
                </div>
                
                {/* Title */}
                <h3 className={`text-center text-xl font-extrabold mb-1 ${styles.textColor} dark:text-white`}>
                  {tierName}
                </h3>
                <p className="text-center text-xs text-muted-foreground mb-4 uppercase tracking-wider font-medium">
                  Visitor Tier
                </p>
                
                {/* Stays requirement */}
                <div className="flex items-center justify-center gap-2 mb-5">
                  <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/80 dark:bg-white/10 border border-white/50 dark:border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                    <Check className={`h-4 w-4 ${styles.accentColor}`} />
                    <span className="text-sm font-semibold">{badge.stays} {badge.stays === 1 ? 'Stay' : 'Stays'}</span>
                  </div>
                </div>
                
                {/* Perk */}
                <div className="bg-white/90 dark:bg-slate-800/90 rounded-xl py-3 px-4 text-center shadow-[0_4px_12px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.5)]">
                  <p className={`text-lg font-bold ${styles.accentColor}`}>{badge.perk}</p>
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
