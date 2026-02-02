import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Award, Star, Crown, Gem, AlertCircle, Sparkles } from "lucide-react";

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
  iconColor: string; 
  iconBg: string;
  gradient: string;
  border: string;
  glow: string;
  badge: string;
}> = {
  'Silver Visitor': { 
    iconColor: 'text-slate-500', 
    iconBg: 'bg-gradient-to-br from-slate-200 to-slate-400',
    gradient: 'bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900',
    border: 'border-slate-300 dark:border-slate-600',
    glow: 'hover:shadow-slate-300/50 dark:hover:shadow-slate-500/30',
    badge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
  },
  'Gold Visitor': { 
    iconColor: 'text-amber-600', 
    iconBg: 'bg-gradient-to-br from-yellow-300 to-amber-500',
    gradient: 'bg-gradient-to-br from-amber-50 via-white to-yellow-50 dark:from-amber-950 dark:via-amber-900/50 dark:to-yellow-950',
    border: 'border-amber-300 dark:border-amber-600',
    glow: 'hover:shadow-amber-300/50 dark:hover:shadow-amber-500/30',
    badge: 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200'
  },
  'Platinum Visitor': { 
    iconColor: 'text-sky-500', 
    iconBg: 'bg-gradient-to-br from-sky-300 to-blue-500',
    gradient: 'bg-gradient-to-br from-sky-50 via-white to-blue-50 dark:from-sky-950 dark:via-blue-900/50 dark:to-sky-950',
    border: 'border-sky-300 dark:border-sky-600',
    glow: 'hover:shadow-sky-300/50 dark:hover:shadow-sky-500/30',
    badge: 'bg-sky-200 text-sky-800 dark:bg-sky-800 dark:text-sky-200'
  },
  'Titanium Visitor': { 
    iconColor: 'text-violet-500', 
    iconBg: 'bg-gradient-to-br from-violet-400 to-purple-600',
    gradient: 'bg-gradient-to-br from-violet-50 via-white to-purple-50 dark:from-violet-950 dark:via-purple-900/50 dark:to-violet-950',
    border: 'border-violet-300 dark:border-violet-600',
    glow: 'hover:shadow-violet-300/50 dark:hover:shadow-violet-500/30',
    badge: 'bg-violet-200 text-violet-800 dark:bg-violet-800 dark:text-violet-200'
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
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Sparkles className="h-4 w-4" />
          Loyalty Program
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Your OBX Insider Badges</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">Earn exclusive perks and discounts with every visit to the Outer Banks!</p>
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
          
          return (
            <Card 
              key={i} 
              className={`relative overflow-hidden p-6 text-center border-2 ${styles.gradient} ${styles.border} shadow-lg ${styles.glow} hover:shadow-2xl hover:scale-[1.02] transition-all duration-300`}
            >
              {/* Decorative corner accent */}
              <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full ${styles.iconBg} opacity-20 blur-xl`} />
              
              {/* Icon */}
              <div className={`relative w-20 h-20 ${styles.iconBg} rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-300`}>
                <IconComponent className="h-10 w-10 text-white drop-shadow-md" />
              </div>
              
              {/* Title */}
              <h3 className="text-xl font-bold mb-3">{badge.level}</h3>
              
              {/* Stays badge */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${styles.badge} text-xs font-semibold mb-4`}>
                <span>{badge.stays} {badge.stays === 1 ? 'Stay' : 'Stays'} Required</span>
              </div>
              
              {/* Perk */}
              <div className="pt-4 border-t border-current/10">
                <p className="text-lg font-bold text-primary">{badge.perk}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default LoyaltyBadges;
