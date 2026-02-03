// Loyalty Program - Marriott Bonvoy Inspired Dual Status System
// Annual status resets each year, Lifetime status accumulates forever

export type LoyaltyTier = "member" | "silver" | "gold" | "platinum" | "ambassador";

// Tier order for comparison (higher index = higher tier)
export const TIER_ORDER: LoyaltyTier[] = ["member", "silver", "gold", "platinum", "ambassador"];

// Annual tier requirements (reset each year)
export const ANNUAL_TIER_REQUIREMENTS = {
  member: { visits: 0, points: 0, spent: 0 },
  silver: { visits: 10, points: 25000, spent: 500 },
  gold: { visits: 25, points: 50000, spent: 1500 },
  platinum: { visits: 50, points: 100000, spent: 5000 },
  ambassador: { visits: 100, points: 200000, spent: 20000 }, // Requires both visits AND spend threshold
};

// Lifetime tier requirements (much higher thresholds)
export const LIFETIME_TIER_REQUIREMENTS = {
  member: { visits: 0, points: 0, spent: 0 },
  silver: { visits: 100, points: 250000, spent: 5000 },
  gold: { visits: 250, points: 500000, spent: 15000 },
  platinum: { visits: 500, points: 1000000, spent: 50000 },
  ambassador: { visits: 1000, points: 2000000, spent: 100000 },
};

// Tier benefits
export const TIER_BENEFITS = {
  member: {
    pointsMultiplier: 1.0,
    discount: 0,
    perks: ["10 points per $1 spent", "Access to member-only deals"],
  },
  silver: {
    pointsMultiplier: 1.1,
    discount: 0,
    perks: ["+10% bonus points", "Priority customer service", "Early access to events"],
  },
  gold: {
    pointsMultiplier: 1.25,
    discount: 0,
    perks: ["+25% bonus points", "Exclusive Gold deals", "Free event upgrades when available"],
  },
  platinum: {
    pointsMultiplier: 1.5,
    discount: 0.05,
    perks: ["+50% bonus points", "5% discount at partners", "Priority reservations", "Annual local gift"],
  },
  ambassador: {
    pointsMultiplier: 1.75,
    discount: 0.10,
    perks: ["+75% bonus points", "10% discount at partners", "Personal concierge", "VIP experiences", "Ambassador lounge access"],
  },
};

// Calculate tier based on visits, points, and spend
export function calculateTier(
  visits: number,
  points: number,
  spent: number,
  requirements: typeof ANNUAL_TIER_REQUIREMENTS
): LoyaltyTier {
  // Check from highest tier down
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i];
    const req = requirements[tier];
    
    // For Ambassador, require BOTH visits AND spend threshold
    if (tier === "ambassador") {
      if (visits >= req.visits && spent >= req.spent) {
        return tier;
      }
    } else {
      // For other tiers, meet visits OR points threshold
      if (visits >= req.visits || points >= req.points) {
        return tier;
      }
    }
  }
  return "member";
}

// Calculate annual tier
export function calculateAnnualTier(visits: number, points: number, spent: number): LoyaltyTier {
  return calculateTier(visits, points, spent, ANNUAL_TIER_REQUIREMENTS);
}

// Calculate lifetime tier
export function calculateLifetimeTier(visits: number, points: number, spent: number): LoyaltyTier {
  return calculateTier(visits, points, spent, LIFETIME_TIER_REQUIREMENTS);
}

// Get the effective tier (higher of annual or lifetime)
export function getEffectiveTier(annualTier: LoyaltyTier, lifetimeTier: LoyaltyTier): LoyaltyTier {
  const annualIndex = TIER_ORDER.indexOf(annualTier);
  const lifetimeIndex = TIER_ORDER.indexOf(lifetimeTier);
  return annualIndex >= lifetimeIndex ? annualTier : lifetimeTier;
}

// Compare two tiers (returns positive if a > b, negative if a < b, 0 if equal)
export function compareTiers(a: LoyaltyTier, b: LoyaltyTier): number {
  return TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b);
}

// Get progress to next tier
export function getProgressToNextTier(
  currentTier: LoyaltyTier,
  visits: number,
  points: number,
  spent: number,
  isLifetime: boolean
): { nextTier: LoyaltyTier | null; visitProgress: number; pointProgress: number; spentProgress: number } {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  
  if (currentIndex >= TIER_ORDER.length - 1) {
    return { nextTier: null, visitProgress: 100, pointProgress: 100, spentProgress: 100 };
  }
  
  const nextTier = TIER_ORDER[currentIndex + 1];
  const requirements = isLifetime ? LIFETIME_TIER_REQUIREMENTS : ANNUAL_TIER_REQUIREMENTS;
  const req = requirements[nextTier];
  
  return {
    nextTier,
    visitProgress: Math.min(100, (visits / req.visits) * 100),
    pointProgress: Math.min(100, (points / req.points) * 100),
    spentProgress: Math.min(100, (spent / req.spent) * 100),
  };
}

// Format tier display name
export function formatTierName(tier: LoyaltyTier): string {
  switch (tier) {
    case "member": return "Member";
    case "silver": return "Silver Elite";
    case "gold": return "Gold Elite";
    case "platinum": return "Platinum Elite";
    case "ambassador": return "Ambassador";
    default: return "Member";
  }
}

// Get tier color for UI
export function getTierColor(tier: LoyaltyTier): { bg: string; text: string; border: string } {
  switch (tier) {
    case "ambassador":
      return { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-500/20" };
    case "platinum":
      return { bg: "bg-slate-400/10", text: "text-slate-600", border: "border-slate-400/20" };
    case "gold":
      return { bg: "bg-yellow-500/10", text: "text-yellow-600", border: "border-yellow-500/20" };
    case "silver":
      return { bg: "bg-gray-400/10", text: "text-gray-500", border: "border-gray-400/20" };
    default:
      return { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/20" };
  }
}
