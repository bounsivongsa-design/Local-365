export interface EventCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export const EVENT_CATEGORIES: EventCategory[] = [
  { id: "concerts-music", name: "Concerts & Live Music", icon: "Music", description: "Live bands, concerts, and musical performances", color: "#8b5cf6" },
  { id: "festivals", name: "Festivals & Fairs", icon: "PartyPopper", description: "Community festivals, county fairs, and celebrations", color: "#f59e0b" },
  { id: "farmers-markets", name: "Farmers Markets", icon: "Apple", description: "Local produce, artisan goods, and farm stands", color: "#22c55e" },
  { id: "food-drink", name: "Food & Drink Events", icon: "UtensilsCrossed", description: "Food tastings, wine events, and culinary experiences", color: "#ef4444" },
  { id: "outdoor-adventure", name: "Outdoor & Adventure", icon: "Mountain", description: "Hiking, kayaking, fishing tournaments, and nature events", color: "#0ea5e9" },
  { id: "arts-culture", name: "Arts & Culture", icon: "Palette", description: "Art shows, gallery openings, and cultural events", color: "#ec4899" },
  { id: "fitness-wellness", name: "Fitness & Wellness", icon: "HeartPulse", description: "Yoga on the beach, 5K runs, and wellness workshops", color: "#14b8a6" },
  { id: "family-kids", name: "Family & Kids", icon: "Baby", description: "Family-friendly events, kids activities, and storytimes", color: "#f97316" },
  { id: "sports", name: "Sports & Recreation", icon: "Trophy", description: "Tournaments, leagues, and sporting events", color: "#3b82f6" },
  { id: "charity-fundraiser", name: "Charity & Fundraisers", icon: "Heart", description: "Charity events, galas, and community fundraisers", color: "#e11d48" },
  { id: "holiday-seasonal", name: "Holiday & Seasonal", icon: "Snowflake", description: "Holiday celebrations and seasonal events", color: "#6366f1" },
  { id: "networking-business", name: "Networking & Business", icon: "Briefcase", description: "Business mixers, chamber events, and professional networking", color: "#0d9488" },
  { id: "classes-workshops", name: "Classes & Workshops", icon: "GraduationCap", description: "Educational workshops, DIY classes, and skill building", color: "#a855f7" },
  { id: "nightlife", name: "Nightlife & Entertainment", icon: "Sparkles", description: "Bar events, comedy nights, karaoke, and late-night fun", color: "#7c3aed" },
  { id: "community-meetups", name: "Community Meetups", icon: "Users", description: "Neighborhood gatherings, book clubs, and social groups", color: "#059669" },
  { id: "religious-spiritual", name: "Religious & Spiritual", icon: "Church", description: "Church events, worship services, and spiritual gatherings", color: "#78716c" },
  { id: "real-estate-open-house", name: "Real Estate Open Houses", icon: "Home", description: "Open house events and property showcases", color: "#d97706" },
  { id: "beach-water", name: "Beach & Water Events", icon: "Waves", description: "Beach cleanups, surf contests, and waterfront activities", color: "#06b6d4" },
];

export interface EventPricingTier {
  id: string;
  name: string;
  weeklyPrice: number;
  monthlyPrice: number;
  memberWeeklyPrice: number;
  memberMonthlyPrice: number;
  features: string[];
  recommended?: boolean;
}

export const EVENT_PRICING_TIERS: EventPricingTier[] = [
  {
    id: "basic",
    name: "Basic",
    weeklyPrice: 15,
    monthlyPrice: 50,
    memberWeeklyPrice: 8,
    memberMonthlyPrice: 25,
    features: [
      "Text-only event listing",
      "Listed in event calendar",
      "Category placement",
      "Basic event details (date, time, location)",
      "Event link to your website",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    weeklyPrice: 50,
    monthlyPrice: 175,
    memberWeeklyPrice: 25,
    memberMonthlyPrice: 88,
    recommended: true,
    features: [
      "Everything in Basic",
      "Cover image / event flyer upload",
      "Integrated booking / RSVP form",
      "Social sharing buttons",
      "Highlighted listing in category",
      "Event reminder notifications to subscribers",
      "Attendee analytics dashboard",
    ],
  },
  {
    id: "featured",
    name: "Featured",
    weeklyPrice: 100,
    monthlyPrice: 350,
    memberWeeklyPrice: 50,
    memberMonthlyPrice: 175,
    features: [
      "Everything in Pro",
      "Top placement in calendar and listings",
      "Homepage event spotlight banner",
      "Push notifications to all nearby users",
      "Custom branding on event page",
      "Priority support for event setup",
      "Post-event analytics report",
      "Featured in weekly email newsletter",
    ],
  },
];

export function getEventCategoryById(id: string): EventCategory | undefined {
  return EVENT_CATEGORIES.find((cat) => cat.id === id);
}

export function searchEventCategories(query: string): EventCategory[] {
  const lowerQuery = query.toLowerCase();
  return EVENT_CATEGORIES.filter(
    (cat) =>
      cat.name.toLowerCase().includes(lowerQuery) ||
      cat.description.toLowerCase().includes(lowerQuery)
  );
}

export function getEventPricingTier(tierId: string): EventPricingTier | undefined {
  return EVENT_PRICING_TIERS.find((tier) => tier.id === tierId);
}

export function calculateEventCost(
  tierId: string,
  durationWeeks: number,
  isMember: boolean
): { total: number; savings: number; weeklyRate: number } {
  const tier = getEventPricingTier(tierId);
  if (!tier) throw new Error(`Invalid tier: ${tierId}`);

  const weeklyRate = isMember ? tier.memberWeeklyPrice : tier.weeklyPrice;
  const fullMonths = Math.floor(durationWeeks / 4);
  const remainingWeeks = durationWeeks % 4;

  const monthlyRate = isMember ? tier.memberMonthlyPrice : tier.monthlyPrice;
  const total = fullMonths * monthlyRate + remainingWeeks * weeklyRate;
  const fullPrice = durationWeeks * tier.weeklyPrice;
  const savings = fullPrice - total;

  return { total, savings, weeklyRate };
}

export function getEventCategoryCount(): number {
  return EVENT_CATEGORIES.length;
}
