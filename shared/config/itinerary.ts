export interface ItineraryPlanTier {
  id: string;
  name: string;
  monthlyPrice: number;
  semiAnnualPrice: number;
  annualPrice: number;
  color: string;
  description: string;
  features: string[];
  limits: {
    maxItineraries: number;
    maxDaysPerItinerary: number;
    maxActivitiesPerDay: number;
    customBranding: boolean;
    analyticsAccess: boolean;
    guestReviews: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
  };
}

export const ITINERARY_PLAN_TIERS: ItineraryPlanTier[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 75,
    semiAnnualPrice: 360,
    annualPrice: 495,
    color: "#3b82f6",
    description: "Perfect for small vacation rental hosts getting started",
    features: [
      "Up to 5 active itineraries",
      "7-day max itinerary length",
      "Up to 8 activities per day",
      "Drag-and-drop itinerary builder",
      "Pre-built local activity templates",
      "Shareable guest links",
      "Print-ready PDF export",
      "Basic analytics (views, clicks)",
      "Email support",
    ],
    limits: {
      maxItineraries: 5,
      maxDaysPerItinerary: 7,
      maxActivitiesPerDay: 8,
      customBranding: false,
      analyticsAccess: true,
      guestReviews: false,
      prioritySupport: false,
      apiAccess: false,
      whiteLabel: false,
    },
  },
  {
    id: "professional",
    name: "Professional",
    monthlyPrice: 150,
    semiAnnualPrice: 720,
    annualPrice: 990,
    color: "#8b5cf6",
    description: "Ideal for property managers with multiple listings",
    features: [
      "Up to 25 active itineraries",
      "14-day max itinerary length",
      "Up to 15 activities per day",
      "Everything in Starter",
      "Custom branding with your logo",
      "Guest review collection",
      "Advanced analytics dashboard",
      "Seasonal itinerary variants",
      "Multi-property management",
      "Integration with booking platforms",
      "Priority email & chat support",
    ],
    limits: {
      maxItineraries: 25,
      maxDaysPerItinerary: 14,
      maxActivitiesPerDay: 15,
      customBranding: true,
      analyticsAccess: true,
      guestReviews: true,
      prioritySupport: true,
      apiAccess: false,
      whiteLabel: false,
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: 300,
    semiAnnualPrice: 1440,
    annualPrice: 1980,
    color: "#f59e0b",
    description: "For large-scale hospitality businesses and resorts",
    features: [
      "Unlimited active itineraries",
      "30-day max itinerary length",
      "Unlimited activities per day",
      "Everything in Professional",
      "White-label solution",
      "API access for automation",
      "Dedicated account manager",
      "Custom integrations",
      "Multi-team collaboration",
      "Revenue tracking per itinerary",
      "Automated guest communication",
      "Phone, email & chat support",
    ],
    limits: {
      maxItineraries: -1,
      maxDaysPerItinerary: 30,
      maxActivitiesPerDay: -1,
      customBranding: true,
      analyticsAccess: true,
      guestReviews: true,
      prioritySupport: true,
      apiAccess: true,
      whiteLabel: true,
    },
  },
];

export interface BusinessPlacementTier {
  id: string;
  name: string;
  monthlyFee: number;
  description: string;
  features: string[];
  placementPriority: number;
}

export const BUSINESS_PLACEMENT_TIERS: BusinessPlacementTier[] = [
  {
    id: "basic-placement",
    name: "Basic Placement",
    monthlyFee: 25,
    description: "Get listed in itineraries as a suggested activity",
    features: [
      "Listed as a suggested local business",
      "Business name, category, and phone number shown",
      "Link to your Local List 365 profile",
      "Basic placement in relevant itinerary days",
    ],
    placementPriority: 1,
  },
  {
    id: "featured-placement",
    name: "Featured Placement",
    monthlyFee: 75,
    description: "Stand out with premium placement and rich content",
    features: [
      "Everything in Basic Placement",
      "Highlighted card with your logo and photos",
      "Special offer / coupon display in itinerary",
      "Higher placement in activity suggestions",
      "Direct booking / reservation link",
      "Featured badge on your listing",
    ],
    placementPriority: 2,
  },
  {
    id: "exclusive-placement",
    name: "Exclusive Placement",
    monthlyFee: 150,
    description: "Maximum visibility as the top recommended business",
    features: [
      "Everything in Featured Placement",
      "Top position in all relevant itinerary days",
      "Exclusive category placement (no competitors in same slot)",
      "Full-width promotional card with rich media",
      "Guest push notifications about your offers",
      "Monthly performance report",
      "Priority in Ziggy AI recommendations",
      "Custom call-to-action button",
    ],
    placementPriority: 3,
  },
];

export interface ItineraryTemplate {
  id: string;
  name: string;
  description: string;
  duration: number;
  tags: string[];
  season: "all" | "summer" | "winter" | "spring" | "fall";
}

export const ITINERARY_TEMPLATES: ItineraryTemplate[] = [
  { id: "romantic-weekend", name: "Romantic Weekend Escape", description: "A cozy 3-day couples getaway with beach walks, sunset dining, and spa time", duration: 3, tags: ["couples", "romantic", "relaxation"], season: "all" },
  { id: "family-beach-week", name: "Family Beach Week", description: "7-day family vacation with kids activities, water sports, and mini golf", duration: 7, tags: ["family", "kids", "beach", "water-sports"], season: "summer" },
  { id: "adventure-weekend", name: "Currituck Adventure Weekend", description: "Action-packed 3 days of kayaking, fishing, and nature tours", duration: 3, tags: ["adventure", "outdoors", "nature"], season: "all" },
  { id: "winter-getaway", name: "Cozy Winter Getaway", description: "5-day winter escape with fireplaces, hot tubs, and off-season charm", duration: 5, tags: ["winter", "cozy", "relaxation"], season: "winter" },
  { id: "foodie-tour", name: "Currituck Foodie Tour", description: "4-day culinary adventure through local seafood joints and hidden gems", duration: 4, tags: ["food", "dining", "local"], season: "all" },
  { id: "history-culture", name: "History & Culture Trail", description: "3-day exploration of lighthouses, museums, and historic sites", duration: 3, tags: ["history", "culture", "education"], season: "all" },
  { id: "fishing-trip", name: "Ultimate Fishing Trip", description: "5-day fishing excursion with charters, pier fishing, and crabbing", duration: 5, tags: ["fishing", "outdoors", "charter"], season: "summer" },
  { id: "girls-getaway", name: "Girls' Getaway Weekend", description: "3-day retreat with spa, shopping, wine tasting, and beach yoga", duration: 3, tags: ["girls-trip", "spa", "shopping"], season: "all" },
  { id: "golf-weekend", name: "Golf & Leisure Weekend", description: "3-day golf vacation with top Currituck courses and waterfront dining", duration: 3, tags: ["golf", "leisure", "dining"], season: "spring" },
  { id: "pet-friendly", name: "Pet-Friendly Currituck Trip", description: "4-day vacation with your furry friend — dog parks, pet-friendly dining", duration: 4, tags: ["pets", "dog-friendly", "outdoors"], season: "all" },
];

export function getItineraryPlanTier(tierId: string): ItineraryPlanTier | undefined {
  return ITINERARY_PLAN_TIERS.find((tier) => tier.id === tierId);
}

export function getBusinessPlacementTier(tierId: string): BusinessPlacementTier | undefined {
  return BUSINESS_PLACEMENT_TIERS.find((tier) => tier.id === tierId);
}

export function getItineraryTemplate(templateId: string): ItineraryTemplate | undefined {
  return ITINERARY_TEMPLATES.find((t) => t.id === templateId);
}

export function getTemplatesBySeason(season: ItineraryTemplate["season"]): ItineraryTemplate[] {
  if (season === "all") return ITINERARY_TEMPLATES;
  return ITINERARY_TEMPLATES.filter((t) => t.season === season || t.season === "all");
}

export function calculateItineraryPlanPrice(
  tierId: string,
  frequencyId: "monthly" | "semi-annual" | "annual"
): {
  basePrice: number;
  actualPrice: number;
  savings: number;
  perMonthEquivalent: number;
} {
  const tier = getItineraryPlanTier(tierId);
  if (!tier) throw new Error(`Invalid tier: ${tierId}`);

  const monthlyBase = tier.monthlyPrice;
  let actualPrice: number;
  let months: number;

  switch (frequencyId) {
    case "monthly":
      actualPrice = tier.monthlyPrice;
      months = 1;
      break;
    case "semi-annual":
      actualPrice = tier.semiAnnualPrice;
      months = 6;
      break;
    case "annual":
      actualPrice = tier.annualPrice;
      months = 12;
      break;
    default:
      throw new Error(`Invalid frequency: ${frequencyId}`);
  }

  const basePrice = monthlyBase * months;
  const savings = basePrice - actualPrice;
  const perMonthEquivalent = Math.round((actualPrice / months) * 100) / 100;

  return { basePrice, actualPrice, savings, perMonthEquivalent };
}

export function calculateBusinessPlacementCost(
  tierId: string,
  durationMonths: number
): { monthlyFee: number; totalCost: number; discount: number } {
  const tier = getBusinessPlacementTier(tierId);
  if (!tier) throw new Error(`Invalid tier: ${tierId}`);

  let discount = 0;
  if (durationMonths >= 12) discount = 0.20;
  else if (durationMonths >= 6) discount = 0.10;

  const totalBeforeDiscount = tier.monthlyFee * durationMonths;
  const discountAmount = totalBeforeDiscount * discount;
  const totalCost = totalBeforeDiscount - discountAmount;

  return {
    monthlyFee: tier.monthlyFee,
    totalCost: Math.round(totalCost * 100) / 100,
    discount,
  };
}

export function searchTemplates(query: string): ItineraryTemplate[] {
  const lowerQuery = query.toLowerCase();
  return ITINERARY_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}
