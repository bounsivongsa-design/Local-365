export interface MembershipTier {
  id: string;
  name: string;
  monthlyPrice: number;
  semiAnnualPrice: number;
  annualPrice: number;
  pricingBasis: "per_zip_code";
  color: string;
  badgeGradient: string;
  features: string[];
  limits: {
    maxPhotos: number;
    maxCategories: number;
    quoteAccessLevel: "basic" | "standard" | "priority";
    responseWindow: string;
    analyticsAccess: boolean;
    prioritySupport: boolean;
    featuredPlacement: boolean;
    socialLinksAllowed: boolean;
    couponCreation: boolean;
    verifiedBadge: boolean;
  };
}

export const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    id: "bronze",
    name: "Bronze",
    monthlyPrice: 50,
    semiAnnualPrice: 240,
    annualPrice: 330,
    pricingBasis: "per_zip_code",
    color: "#cd7f32",
    badgeGradient: "from-amber-700 via-amber-500 to-amber-700",
    features: [
      "Business listing with phone number",
      "Customer reviews and ratings",
      "Category listing placement",
      "Basic business profile page",
      "Up to 3 photos",
      "1 business category",
      "Basic quote access (3rd round)",
      "Monthly performance email",
    ],
    limits: {
      maxPhotos: 3,
      maxCategories: 1,
      quoteAccessLevel: "basic",
      responseWindow: "48 hours",
      analyticsAccess: false,
      prioritySupport: false,
      featuredPlacement: false,
      socialLinksAllowed: false,
      couponCreation: false,
      verifiedBadge: false,
    },
  },
  {
    id: "silver",
    name: "Silver",
    monthlyPrice: 100,
    semiAnnualPrice: 480,
    annualPrice: 660,
    pricingBasis: "per_zip_code",
    color: "#c0c0c0",
    badgeGradient: "from-gray-400 via-gray-200 to-gray-400",
    features: [
      "Everything in Bronze",
      "Logo display on listing",
      "Website link on profile",
      "Up to 10 photos",
      "Up to 3 business categories",
      "Standard quote access (2nd round)",
      "Social media links",
      "Basic analytics dashboard",
      "Create customer coupons",
      "Verified business badge",
    ],
    limits: {
      maxPhotos: 10,
      maxCategories: 3,
      quoteAccessLevel: "standard",
      responseWindow: "24 hours",
      analyticsAccess: true,
      prioritySupport: false,
      featuredPlacement: false,
      socialLinksAllowed: true,
      couponCreation: true,
      verifiedBadge: true,
    },
  },
  {
    id: "gold",
    name: "Gold",
    monthlyPrice: 200,
    semiAnnualPrice: 960,
    annualPrice: 1320,
    pricingBasis: "per_zip_code",
    color: "#ffd700",
    badgeGradient: "from-yellow-500 via-amber-300 to-yellow-500",
    features: [
      "Everything in Silver",
      "Top of list placement (by reviews)",
      "Unlimited photos",
      "Up to 5 business categories",
      "Priority quote access (1st round)",
      "Featured in search results",
      "Advanced analytics dashboard",
      "Priority customer support",
      "Custom business page branding",
      "Monthly spotlight in newsletter",
      "50% off advertising rates",
    ],
    limits: {
      maxPhotos: -1,
      maxCategories: 5,
      quoteAccessLevel: "priority",
      responseWindow: "2 hours (emergency) / 24 hours (standard)",
      analyticsAccess: true,
      prioritySupport: true,
      featuredPlacement: true,
      socialLinksAllowed: true,
      couponCreation: true,
      verifiedBadge: true,
    },
  },
];

export interface PaymentFrequency {
  id: string;
  name: string;
  label: string;
  discount: number;
  trialInfo: string;
  billingCycles: number;
}

export const PAYMENT_FREQUENCIES: PaymentFrequency[] = [
  {
    id: "monthly",
    name: "Monthly",
    label: "per month",
    discount: 0,
    trialInfo: "1st month FREE for new members",
    billingCycles: 1,
  },
  {
    id: "semi-annual",
    name: "Semi-Annual",
    label: "every 6 months",
    discount: 0.20,
    trialInfo: "Save 20% — billed every 6 months",
    billingCycles: 6,
  },
  {
    id: "annual",
    name: "Annual",
    label: "per year",
    discount: 0.45,
    trialInfo: "Save 45% — best value, billed annually",
    billingCycles: 12,
  },
];

export interface ServiceArea {
  state: string;
  stateAbbr: string;
  cities: string[];
}

export const SERVICE_AREAS: ServiceArea[] = [
  {
    state: "North Carolina",
    stateAbbr: "NC",
    cities: [
      "Corolla",
      "Carova Beach",
      "Knotts Island",
      "Moyock",
      "Currituck",
      "Barco",
      "Maple",
      "Shawboro",
      "Sligo",
      "Grandy",
      "Jarvisburg",
      "Point Harbor",
      "Powells Point",
      "Harbinger",
      "Aydlett",
      "Coinjock",
      "Poplar Branch",
      "Mamie",
      "Snowden",
      "Duck",
      "Southern Shores",
      "Kitty Hawk",
      "Kill Devil Hills",
      "Nags Head",
      "Manteo",
      "Wanchese",
      "Hatteras",
      "Ocracoke",
      "Elizabeth City",
      "Edenton",
      "Hertford",
      "Camden",
      "Columbia",
      "Plymouth",
      "Williamston",
    ],
  },
  {
    state: "Virginia",
    stateAbbr: "VA",
    cities: [
      "Virginia Beach",
      "Chesapeake",
      "Norfolk",
      "Suffolk",
      "Hampton",
      "Newport News",
      "Portsmouth",
      "Williamsburg",
      "Smithfield",
      "Franklin",
      "Courtland",
    ],
  },
];

export function getMembershipTier(tierId: string): MembershipTier | undefined {
  return MEMBERSHIP_TIERS.find((tier) => tier.id === tierId);
}

export function getPaymentFrequency(freqId: string): PaymentFrequency | undefined {
  return PAYMENT_FREQUENCIES.find((freq) => freq.id === freqId);
}

export function calculateMembershipPrice(
  tierId: string,
  frequencyId: string,
  isNewMember: boolean = false
): {
  basePrice: number;
  discountedPrice: number;
  savings: number;
  perMonthEquivalent: number;
  firstMonthFree: boolean;
} {
  const tier = getMembershipTier(tierId);
  const frequency = getPaymentFrequency(frequencyId);
  if (!tier || !frequency) throw new Error("Invalid tier or frequency");

  let basePrice: number;
  let discountedPrice: number;

  switch (frequencyId) {
    case "monthly":
      basePrice = tier.monthlyPrice;
      discountedPrice = tier.monthlyPrice;
      break;
    case "semi-annual":
      basePrice = tier.monthlyPrice * 6;
      discountedPrice = tier.semiAnnualPrice;
      break;
    case "annual":
      basePrice = tier.monthlyPrice * 12;
      discountedPrice = tier.annualPrice;
      break;
    default:
      throw new Error(`Invalid frequency: ${frequencyId}`);
  }

  const firstMonthFree = isNewMember && frequencyId === "monthly";
  const savings = basePrice - discountedPrice;
  const perMonthEquivalent = discountedPrice / frequency.billingCycles;

  return {
    basePrice,
    discountedPrice,
    savings,
    perMonthEquivalent: Math.round(perMonthEquivalent * 100) / 100,
    firstMonthFree,
  };
}

export function getAllServiceCities(): string[] {
  return SERVICE_AREAS.flatMap((area) => area.cities);
}

export function getCitiesByState(stateAbbr: string): string[] {
  const area = SERVICE_AREAS.find((a) => a.stateAbbr === stateAbbr);
  return area?.cities || [];
}

export function isServiceAreaCity(city: string): boolean {
  const allCities = getAllServiceCities();
  return allCities.some((c) => c.toLowerCase() === city.toLowerCase());
}

export function getMembershipTierByPrice(monthlyPrice: number): MembershipTier | undefined {
  return MEMBERSHIP_TIERS.find((tier) => tier.monthlyPrice === monthlyPrice);
}

export interface BadgeInfo {
  label: string;
  gradient: string;
  icon: string;
  description: string;
}

export function getMembershipBadge(tierId: string): BadgeInfo | undefined {
  const tier = getMembershipTier(tierId);
  if (!tier) return undefined;
  return {
    label: `${tier.name} Member`,
    gradient: tier.badgeGradient,
    icon: tierId === "gold" ? "Crown" : tierId === "silver" ? "Award" : "Medal",
    description: `${tier.name} tier business member`,
  };
}

export const MEMBER_AD_RATES = {
  small: { member: 250, nonMember: 500 },
  medium: { member: 500, nonMember: 1000 },
  large: { member: 1000, nonMember: 2000 },
} as const;

export const EVENT_2WEEK_AD_RATES = {
  small: { member: 75, nonMember: 150 },
  medium: { member: 150, nonMember: 300 },
  large: { member: 300, nonMember: 600 },
} as const;

export const EVENT_MONTHLY_AD_RATES = {
  small: { member: 125, nonMember: 250 },
  medium: { member: 250, nonMember: 500 },
  large: { member: 450, nonMember: 900 },
} as const;

export type AdSize = keyof typeof MEMBER_AD_RATES;

export function getAdRate(
  size: AdSize,
  isMember: boolean,
  adType: "monthly" | "event2Week" | "eventMonthly" = "monthly"
): number {
  const rates = adType === "event2Week"
    ? EVENT_2WEEK_AD_RATES
    : adType === "eventMonthly"
    ? EVENT_MONTHLY_AD_RATES
    : MEMBER_AD_RATES;
  return isMember ? rates[size].member : rates[size].nonMember;
}
