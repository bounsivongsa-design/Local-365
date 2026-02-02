import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Award, Star, Crown, Gem, AlertCircle } from "lucide-react";

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

const colorMap: Record<string, { color: string; bgColor: string }> = {
  'Silver Visitor': { color: 'text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  'Gold Visitor': { color: 'text-yellow-500', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20' },
  'Platinum Visitor': { color: 'text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
  'Titanium Visitor': { color: 'text-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-900/20' },
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
    <div className="py-8">
      <h2 className="text-3xl font-bold mb-6">Your OBX Insider Badges</h2>
      <p className="text-muted-foreground mb-8">Earn exclusive perks and discounts by visiting the Outer Banks!</p>
      
      {error && (
        <div className="flex items-center gap-2 text-amber-600 mb-4">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {badges.map((badge, i) => {
          const IconComponent = iconMap[badge.level] || Award;
          const colors = colorMap[badge.level] || { color: 'text-gray-400', bgColor: 'bg-gray-100' };
          
          return (
            <Card key={i} className="p-6 text-center shadow-lg shadow-black/5 hover:shadow-xl transition-shadow">
              <div className={`w-16 h-16 ${colors.bgColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
                <IconComponent className={`h-8 w-8 ${colors.color}`} />
              </div>
              <h3 className="text-xl font-semibold mb-2">{badge.level}</h3>
              <p className="text-muted-foreground text-sm mb-3">Stays Required: {badge.stays}</p>
              <p className="text-primary font-medium">{badge.perk}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default LoyaltyBadges;
