import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, HelpCircle, UserPlus, Building2, Search, Gavel, Calendar, Briefcase, CreditCard, Star, Shield, BarChart3, Megaphone } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
  richContent?: boolean;
  links?: { label: string; to: string }[];
}

interface FAQCategory {
  id: string;
  title: string;
  icon: typeof HelpCircle;
  items: FAQItem[];
}

const FAQ_DATA: FAQCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: UserPlus,
    items: [
      {
        question: "How do I create a customer account?",
        answer: "Go to the Sign In page and click the \"Customer\" tab. Fill in your name, email, and create a password. Customer accounts are always free — you'll never be charged. Once signed up, you can browse businesses, request quotes, view events, and explore local job postings.",
        links: [{ label: "Create an account", to: "/auth?mode=register" }],
      },
      {
        question: "How do I create a business account?",
        answer: "Go to the Sign In page and click the \"Business\" tab. Enter your business name, your name, email, and password. After registration, you'll be guided to set up your business listing with details like your services, hours, photos, and contact info. Your first month is free — no charges until month two.",
        links: [{ label: "Register your business", to: "/auth?mode=register&type=business" }],
      },
      {
        question: "What's the difference between a customer account and a business account?",
        answer: "A customer account is always free. You can search the directory, request quotes from businesses, view events, browse job listings, and leave reviews. A business account lets you create and manage a listing in the directory, respond to quote requests, post job openings, and access analytics about your listing. Business accounts require a membership subscription (Bronze, Silver, or Gold).",
      },
      {
        question: "How do I sign in?",
        answer: "Click \"Sign In\" in the top navigation. You can sign in with your email and password, or use Google sign-in if you registered that way. If you're a business owner, you can use the Customer or Business Owner toggle under Sign In — both use the same email and password you registered with.",
        links: [{ label: "Go to Sign In", to: "/auth" }],
      },
    ],
  },
  {
    id: "directory",
    title: "Finding Businesses",
    icon: Search,
    items: [
      {
        question: "How do I search for a local business?",
        answer: "Use the search bar on the Home page or go to the Directory page. You can type a business name, service type (like \"plumber\" or \"landscaping\"), or keyword. Results show businesses in Moyock, NC (27958) sorted by relevance and membership tier. You can also filter by category using the category buttons at the top of the directory.",
        links: [{ label: "Browse the directory", to: "/directory" }],
      },
      {
        question: "What do the badges on business listings mean?",
        answer: "Badges indicate verified credentials. \"LLC\" means the business is a registered LLC. \"Licensed\" means they hold a professional license. \"Insured\" means they carry business insurance. \"Veteran\" indicates a veteran-owned business. These badges are set by the business owner during registration and help you quickly identify trusted providers.",
      },
      {
        question: "What do Bronze, Silver, and Gold badges mean?",
        answer: "These show a business's membership tier. Gold members appear first in search results with a featured badge and have the most profile features (video, more photos, advanced analytics). Silver members get a verified badge, logo display, and website link. Bronze is the starter tier with core directory features. All tiers provide legitimate listings — the tier simply reflects the level of investment in their online presence.",
      },
      {
        question: "How do I contact a business?",
        answer: "Open a business listing from the directory and you'll see their contact options: phone number (click to call), email, website link, and social media profiles — depending on their membership tier. You can also request a quote directly if the business accepts quotes.",
      },
    ],
  },
  {
    id: "quotes",
    title: "Requesting Quotes",
    icon: Gavel,
    items: [
      {
        question: "How do I request a quote from local businesses?",
        answer: "Go to the Quotes page and click \"New Quote Request.\" Describe the work you need (e.g., \"fence installation\" or \"house painting\"), select a category, set your budget range, and choose a timeline. Your request will be visible to businesses in that category. Gold members see it first (within 24 hours), Silver members see it next (24–48 hours), and Bronze members see it after 48 hours.",
        links: [{ label: "Request a quote", to: "/quotes" }],
      },
      {
        question: "How long does it take to get quotes back?",
        answer: "It depends on the businesses in that category. Gold-tier businesses see your request immediately and can respond within hours. Silver-tier businesses see it after 24 hours, and Bronze-tier businesses after 48 hours. This staggered system gives premium businesses first opportunity while ensuring all businesses can eventually respond.",
      },
      {
        question: "Can I message a business about my quote?",
        answer: "Yes. Once a business responds to your quote request, a messaging thread opens between you and that business. You can ask follow-up questions, share details, negotiate pricing, and coordinate the work — all within the quote thread on your dashboard.",
      },
      {
        question: "Do I have to accept a quote?",
        answer: "No. Requesting a quote is free and non-binding. You can receive multiple quotes, compare them, ask questions, and choose the best fit — or choose none at all.",
      },
    ],
  },
  {
    id: "events",
    title: "Events & Activities",
    icon: Calendar,
    items: [
      {
        question: "How do I find local events?",
        answer: "Go to the Events page from the main navigation. You can view events in a Calendar view (monthly layout) or Card view (scrollable list). Events include community gatherings, business promotions, local markets, and seasonal activities happening in Currituck County.",
        links: [{ label: "View events", to: "/events" }],
      },
      {
        question: "Can I add my own event?",
        answer: "Business account holders can promote events through the advertising system. Email us at support@locallist365.com to get your community event listed, or use the advertising page to purchase promoted event placement that reaches more people.",
        links: [{ label: "Learn about advertising", to: "/advertising" }],
      },
    ],
  },
  {
    id: "jobs",
    title: "Help Wanted / Jobs",
    icon: Briefcase,
    items: [
      {
        question: "How do I browse local job openings?",
        answer: "Go to the Help Wanted page from the main navigation. Jobs are listed with the business name, position title, description, and pay details. Gold-tier business postings appear first, followed by Silver, Bronze, and Basic listings. Click on any listing to see the full details and how to apply.",
        links: [{ label: "Browse jobs", to: "/jobs" }],
      },
      {
        question: "How do I post a job as a business owner?",
        answer: "From your Dashboard, look for the Help Wanted or Job Posting section. You can create a job listing with a title, description, pay range, and application instructions. A membership is required to post jobs. Pricing is based on your tier: Gold members pay $10/week, Silver $15/week, and Bronze $18/week. Higher-tier postings also appear higher in search results.",
        links: [{ label: "Go to dashboard", to: "/dashboard" }],
      },
    ],
  },
  {
    id: "membership",
    title: "Business Membership & Billing",
    icon: CreditCard,
    items: [
      {
        question: "What are the membership tiers and pricing?",
        answer: "MEMBERSHIP_TIERS_SPECIAL",
        richContent: true,
        links: [{ label: "View membership plans", to: "/membership" }],
      },
      {
        question: "How do I upgrade or change my membership?",
        answer: "Go to the Membership page or your Dashboard and select a new tier. You'll go through a checkout process via Stripe. If you're upgrading, the new tier takes effect immediately. Your billing will adjust at the next cycle.",
        links: [{ label: "Manage membership", to: "/membership" }],
      },
      {
        question: "How do I use a promo code?",
        answer: "When you select a membership tier and proceed to checkout, you'll see a promo code field in the order summary dialog. Enter your code and click \"Apply.\" If valid, the discount will appear in your order total before you proceed to payment. Promo codes may be limited to specific tiers or have expiration dates.",
      },
      {
        question: "Is there a free trial?",
        answer: "Yes! Every new business gets 30 days of Gold-tier access completely free — no matter which tier you choose. Even if you purchase Bronze or Silver, you'll enjoy top search placement, featured badge, promo video upload, advanced analytics, and first-round quote access for a full month. After 30 days, your listing automatically transitions to the tier you purchased. No extra charges, no action needed.",
      },
      {
        question: "How do I cancel my membership?",
        answer: "You can manage your subscription through the Stripe billing portal, accessible from your Dashboard. Cancellations take effect at the end of your current billing period — you'll keep your tier benefits until then. Your business listing remains in the directory but with reduced visibility after cancellation.",
      },
    ],
  },
  {
    id: "business-listing",
    title: "Managing Your Business Listing",
    icon: Building2,
    items: [
      {
        question: "How do I set up my business listing?",
        answer: "After creating a business account, you'll be guided through a multi-step form. You'll enter your business name and description, owner contact info, established year and zip code (must be 27958 — Moyock, NC), category and services, business hours, and optional extras like photos, logo, and social media links. Take your time — you can always update your listing later from your Dashboard.",
        links: [{ label: "Create a listing", to: "/create-business" }],
      },
      {
        question: "How do I update my business information?",
        answer: "Sign in and go to your Dashboard. From there, you can edit your business details, update hours, add or change photos, update your description, and manage your contact info. Changes appear immediately in the directory.",
        links: [{ label: "Go to dashboard", to: "/dashboard" }],
      },
      {
        question: "How do I add photos to my listing?",
        answer: "During business setup or from your Dashboard edit screen, you can upload photos of your work, storefront, team, or products. The number of photos you can display depends on your tier: Bronze is a basic text listing with no photos, Silver allows a logo and up to 6 photos, and Gold allows a logo, up to 10 photos, plus a 30-second promotional video.",
      },
      {
        question: "What categories can I choose?",
        answer: "There are dozens of categories including Home Services, Auto Repair, Restaurants, Pet Care, Health & Wellness, Professional Services, and many more. You can select a primary category and additional categories based on your tier (Bronze: 4, Silver: 6, Gold: 8). If you don't see your category, you can suggest a new one and we'll review it.",
      },
    ],
  },
  {
    id: "analytics",
    title: "Business Analytics",
    icon: BarChart3,
    items: [
      {
        question: "How do I see how my listing is performing?",
        answer: "Sign in and go to your Dashboard. You'll see analytics tracking how many people viewed your listing, clicked your phone number, clicked your email, visited your website, and requested directions. This helps you understand how customers are finding and interacting with your business.",
        links: [{ label: "View your dashboard", to: "/dashboard" }],
      },
      {
        question: "What analytics are available for each tier?",
        answer: "All tiers see basic page view counts. Gold members get the most detailed analytics including click tracking for every contact method, trending data over time, and insights into which search terms are bringing visitors to their listing.",
      },
    ],
  },
  {
    id: "advertising",
    title: "Advertising",
    icon: Megaphone,
    items: [
      {
        question: "How does advertising work?",
        answer: "Local List 365 offers carousel banner ad placements on the Home page and Directory page in three sizes: Large (full-width hero banner), Medium (mid-page spotlight), and Small (compact card). Ads rotate in carousels so multiple businesses get visibility. Members receive discounts on ad pricing: Gold gets 50% off, Silver gets 25% off, and Bronze gets 10% off.",
        links: [{ label: "Learn about advertising", to: "/advertising" }],
      },
      {
        question: "How do I purchase an ad?",
        answer: "Visit the Advertising page to see available placements and pricing. Select the ad type you want, upload your creative (image or video), and complete the purchase. Ads are reviewed before going live. Your membership discount is automatically applied at checkout.",
        links: [{ label: "Browse ad options", to: "/advertising" }],
      },
    ],
  },
  {
    id: "trust-safety",
    title: "Trust & Safety",
    icon: Shield,
    items: [
      {
        question: "How do I know businesses are legitimate?",
        answer: "Local List 365 is exclusively for businesses operating in Moyock, NC (27958). All businesses must verify their local presence during registration. Additionally, businesses can display verified credential badges (LLC, Licensed, Insured, Veteran-owned) and earn customer reviews. Higher-tier memberships indicate a greater investment in their online presence.",
      },
      {
        question: "How do I leave a review?",
        answer: "Visit a business's listing page in the directory and scroll to the reviews section. You'll need to be signed in with a customer account and upload a receipt or proof of purchase to leave a review.\n\nWe ask that all reviews be respectful and constructive. Focus on your specific experience — what went well, what could be improved, and what others should know. Vague complaints or personal attacks without details are not helpful and may be removed.\n\nReviews are not a place for back-and-forth arguments. If you have a dispute with a business, please reach out to them directly or contact us at support@locallist365.com. Our goal is to keep the review space honest, fair, and useful for the entire Moyock community.\n\nLocal List 365 reserves the right to remove any review that does not adhere to our Terms of Service, at any time and without prior notice.",
      },
      {
        question: "How do I report a problem?",
        answer: "If you encounter an issue with a business listing, a suspicious quote, or any content on the platform, please email us at support@locallist365.com. We take community safety seriously and will investigate all reports promptly.",
      },
    ],
  },
];

export default function FAQ() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string>("getting-started");

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const activeData = FAQ_DATA.find((c) => c.id === activeCategory) || FAQ_DATA[0];

  return (
    <div className="min-h-[calc(100vh-144px)] bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="bg-gradient-to-br from-[#0a4a82] via-[#0a4a82]/95 to-[#1a6ab2] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-6">
            <HelpCircle className="h-8 w-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="heading-faq">
            How Can We Help?
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            Find answers to common questions about using Local List 365 — from creating your account to managing your business listing.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          <nav className="lg:w-72 shrink-0">
            <div className="lg:sticky lg:top-24 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 px-3">
                Topics
              </p>
              {FAQ_DATA.map((category) => {
                const Icon = category.icon;
                const isActive = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                      isActive
                        ? "bg-[#0a4a82] text-white shadow-md shadow-[#0a4a82]/20"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                    data-testid={`faq-category-${category.id}`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                    {category.title}
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                    }`}>
                      {category.items.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-6">
              {(() => { const Icon = activeData.icon; return <Icon className="h-6 w-6 text-[#0a4a82]" />; })()}
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="faq-active-category-title">
                {activeData.title}
              </h2>
            </div>

            <div className="space-y-3">
              {activeData.items.map((item, index) => {
                const itemId = `${activeCategory}-${index}`;
                const isOpen = openItems.has(itemId);
                return (
                  <div
                    key={itemId}
                    className={`rounded-2xl border transition-all duration-200 ${
                      isOpen
                        ? "border-[#0a4a82]/20 bg-white dark:bg-slate-800 shadow-lg shadow-[#0a4a82]/5"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                    data-testid={`faq-item-${itemId}`}
                  >
                    <button
                      onClick={() => toggleItem(itemId)}
                      className="w-full flex items-start gap-4 p-5 text-left"
                      data-testid={`faq-toggle-${itemId}`}
                    >
                      <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isOpen ? "bg-[#0a4a82] text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                      }`}>
                        <HelpCircle className="h-4 w-4" />
                      </div>
                      <span className="flex-1 font-bold text-base leading-snug" style={{ color: "#1a1a2e" }}>
                        {item.question}
                      </span>
                      <ChevronDown className={`h-5 w-5 shrink-0 mt-0.5 text-slate-400 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`} />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5">
                        <div className="ml-0 sm:ml-12 border-t border-slate-100 dark:border-slate-700 pt-4">
                          <div className="text-slate-600 dark:text-slate-300 leading-[1.8] text-[15px] space-y-3">
                            {item.richContent && item.answer === "MEMBERSHIP_TIERS_SPECIAL" ? (
                              <>
                                <p>There are three membership tiers:</p>
                                <div className="space-y-3 my-2">
                                  <div className="rounded-xl border border-amber-700/20 bg-gradient-to-r from-amber-50 to-amber-50/50 dark:from-amber-900/20 dark:to-transparent p-4">
                                    <div className="font-bold text-amber-800 dark:text-amber-400 text-base mb-1">Bronze — $25/month</div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">Basic directory listing with phone number, reviews, up to 4 categories, and 3rd-round quote access.</p>
                                  </div>
                                  <div className="rounded-xl border border-slate-300/60 bg-gradient-to-r from-slate-100 to-slate-50/50 dark:from-slate-700/30 dark:to-transparent p-4">
                                    <div className="font-bold text-slate-700 dark:text-slate-300 text-base mb-1">Silver — $50/month</div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">Everything in Bronze plus logo display, website link, up to 6 photos and categories, verified badge, social media links, and 2nd-round quote access.</p>
                                  </div>
                                  <div className="rounded-xl border border-yellow-500/40 bg-gradient-to-r from-yellow-50 to-amber-50/30 dark:from-yellow-900/20 dark:to-transparent p-4 shadow-sm">
                                    <div className="font-bold text-yellow-900 dark:text-yellow-400 text-base mb-1">Gold — $100/month</div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">Everything in Silver plus top search placement, featured badge, up to 10 photos and 8 categories, 30-second promo video, advanced analytics, and exclusive 1st-round quote access.</p>
                                  </div>
                                </div>
                                <p className="text-sm font-medium text-[#0a4a82] dark:text-blue-400 bg-[#0a4a82]/5 dark:bg-blue-400/10 px-4 py-2.5 rounded-lg">Save 10% with semi-annual billing or 22.5% with annual billing.</p>
                              </>
                            ) : (
                              item.answer.split("\n\n").map((paragraph, pi) => {
                                if (paragraph.startsWith("•")) {
                                  return (
                                    <div key={pi} className="flex gap-2.5 items-start">
                                      <span className="text-[#0a4a82] font-bold mt-0.5 shrink-0">•</span>
                                      <span className="flex-1">{paragraph.slice(1).trim()}</span>
                                    </div>
                                  );
                                }
                                return <p key={pi}>{paragraph}</p>;
                              })
                            )}
                          </div>
                          {item.links && item.links.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {item.links.map((link) => (
                                <Link
                                  key={link.to}
                                  to={link.to}
                                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0a4a82] hover:text-[#083a6a] dark:text-blue-400 dark:hover:text-blue-300 bg-[#0a4a82]/5 hover:bg-[#0a4a82]/10 px-3 py-1.5 rounded-lg transition-colors"
                                  data-testid={`faq-link-${link.to.replace(/[^a-z]/g, "-")}`}
                                >
                                  {link.label} →
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-16 text-center bg-gradient-to-br from-[#0a4a82]/5 to-[#d4a373]/5 rounded-3xl p-10 border border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Still have questions?
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
            Can't find what you're looking for? We're here to help.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/auth?mode=register"
              className="inline-flex items-center gap-2 bg-[#0a4a82] hover:bg-[#083a6a] text-white px-6 py-3 rounded-xl font-semibold transition-colors shadow-lg shadow-[#0a4a82]/25"
              data-testid="faq-cta-register"
            >
              <UserPlus className="h-4 w-4" />
              Create a Free Account
            </Link>
            <Link
              to="/directory"
              className="inline-flex items-center gap-2 border-2 border-[#0a4a82] text-[#0a4a82] hover:bg-[#0a4a82]/5 px-6 py-3 rounded-xl font-semibold transition-colors"
              data-testid="faq-cta-directory"
            >
              <Search className="h-4 w-4" />
              Browse the Directory
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
