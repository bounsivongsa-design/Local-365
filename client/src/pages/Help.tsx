import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  HelpCircle,
  Users,
  Building2,
  Calendar,
  ArrowRight,
  Sparkles,
  Mail,
  MessageCircle,
  Gavel,
  Briefcase,
  Star,
  Megaphone,
  Tag,
  BarChart3,
  Send,
  Award,
  Crown,
  Gift,
  CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Step {
  text: string;
}

interface TopTask {
  id: string;
  title: string;
  audience: "customer" | "business" | "anyone";
  icon: typeof HelpCircle;
  summary: string;
  steps: Step[];
  ctaLabel: string;
  ctaTo: string;
  keywords: string;
}

const TOP_TASKS: TopTask[] = [
  {
    id: "find-business",
    title: "Find a local business",
    audience: "customer",
    icon: Search,
    summary:
      "Search the directory for plumbers, landscapers, restaurants, and more in your zip code.",
    steps: [
      { text: "Click 'Directory' in the top menu." },
      { text: "Pick a category, or type a keyword in the search bar." },
      { text: "Use the location picker (top right) to switch zip codes." },
      { text: "Click any listing to see contact info, photos, and reviews." },
    ],
    ctaLabel: "Open the Directory",
    ctaTo: "/directory",
    keywords: "search find directory businesses",
  },
  {
    id: "request-quote",
    title: "Request a quote from local pros",
    audience: "customer",
    icon: Gavel,
    summary:
      "Describe what you need once, and qualified businesses will send you their best price.",
    steps: [
      { text: "Click 'Get Quotes' in the menu." },
      { text: "Click 'New Quote Request' and describe the work." },
      { text: "Choose a category, budget range, and timeline." },
      { text: "Submit — Gold members see your request first (within 24 hrs)." },
    ],
    ctaLabel: "Start a quote request",
    ctaTo: "/quotes",
    keywords: "quote request bid estimate price",
  },
  {
    id: "create-account",
    title: "Create a free customer account",
    audience: "customer",
    icon: Users,
    summary:
      "Customer accounts are always free. You can request quotes, save favorites, and leave reviews.",
    steps: [
      { text: "Click 'Sign In' in the top right." },
      { text: "Pick the 'Customer' tab." },
      { text: "Enter your name, email, and a password (or use Google)." },
      { text: "You're in — start browsing." },
    ],
    ctaLabel: "Create a customer account",
    ctaTo: "/auth?mode=register",
    keywords: "signup register customer account free",
  },
  {
    id: "list-business",
    title: "List your business",
    audience: "business",
    icon: Building2,
    summary:
      "Get your business in front of locals. Your first 30 days of Gold features are free — no card required.",
    steps: [
      { text: "Click 'For Business' or 'Sign In'." },
      { text: "Pick the 'Business' tab and create an account." },
      { text: "Fill out your listing — name, services, photos, hours." },
      { text: "Done. Your free Gold trial starts the moment you publish." },
    ],
    ctaLabel: "Register your business",
    ctaTo: "/auth?mode=register&type=business",
    keywords: "list business signup register membership",
  },
  {
    id: "post-job",
    title: "Post a help wanted ad",
    audience: "business",
    icon: Briefcase,
    summary:
      "Hire locally. Bronze gets 1 active post, Silver gets 3, Gold gets unlimited.",
    steps: [
      { text: "Open your Dashboard." },
      { text: "Find the 'Quick Actions' grid and click 'Post a Job'." },
      { text: "Add a title, description, pay range, and how to apply." },
      { text: "Publish — it appears on the Help Wanted page right away." },
    ],
    ctaLabel: "Go to Help Wanted",
    ctaTo: "/jobs",
    keywords: "job posting hire helpwanted employees hiring",
  },
  {
    id: "respond-quotes",
    title: "Respond to quote requests",
    audience: "business",
    icon: MessageCircle,
    summary:
      "When customers in your category submit a quote request, you can pitch them directly.",
    steps: [
      { text: "Open your Dashboard." },
      { text: "Open the 'Quote Requests' inbox card." },
      { text: "Pick a request and write a short response with your price." },
      { text: "The customer is notified by email and SMS." },
    ],
    ctaLabel: "View quote requests",
    ctaTo: "/quotes",
    keywords: "respond reply quote requests bidding",
  },
  {
    id: "run-ad",
    title: "Run a banner ad on the homepage",
    audience: "business",
    icon: Megaphone,
    summary:
      "Get featured on the home page and directory carousel. Pricing scales by size and tier discounts apply.",
    steps: [
      { text: "Open your Dashboard." },
      { text: "Find the 'My Ad Campaigns' card and click 'Create Ad'." },
      { text: "Upload an image OR design one in the in-browser ad designer." },
      { text: "Pick a size, see the live monthly price, and check out." },
    ],
    ctaLabel: "Create an ad",
    ctaTo: "/dashboard",
    keywords: "advertising banner homepage carousel ad campaign",
  },
  {
    id: "post-event",
    title: "Post a local event",
    audience: "anyone",
    icon: Calendar,
    summary:
      "Add your event to the community calendar. Free for community events; paid promo slots for boosted reach.",
    steps: [
      { text: "Click 'Local Events' in the menu." },
      { text: "Click 'Submit an Event'." },
      { text: "Fill in the date, location, and description." },
      { text: "Submit — admins review and publish quickly." },
    ],
    ctaLabel: "Open events calendar",
    ctaTo: "/events",
    keywords: "event calendar submit local community festival",
  },
  {
    id: "ai-tools",
    title: "Use the AI writing tools (Gold)",
    audience: "business",
    icon: Sparkles,
    summary:
      "Gold members get monthly AI credits to write listings, review replies, deals, and newsletters in seconds.",
    steps: [
      { text: "Open your Dashboard." },
      { text: "Click any tool with the AI badge (Listing Writer, Review Reply, etc.)." },
      { text: "Tell it about your business and pick a tone." },
      { text: "Pick the variant you like, edit if needed, and publish." },
    ],
    ctaLabel: "Open Marketing Hub",
    ctaTo: "/marketing-hub",
    keywords: "ai artificial intelligence writing tools gold",
  },
  {
    id: "send-newsletter",
    title: "Send a newsletter (Gold)",
    audience: "business",
    icon: Send,
    summary:
      "Reach your subscribers with deals, news, or holiday hours — with open and click tracking.",
    steps: [
      { text: "Open your Dashboard and click 'Newsletter'." },
      { text: "Click 'New Campaign' and let the AI draft a subject + body." },
      { text: "Pick the recipient list, then send a test to yourself." },
      { text: "Hit Send. Track opens and clicks in the Marketing Hub." },
    ],
    ctaLabel: "Open Newsletter",
    ctaTo: "/newsletter",
    keywords: "newsletter email send campaign subscribers",
  },
  {
    id: "leave-review",
    title: "Leave a review for a business",
    audience: "customer",
    icon: Star,
    summary:
      "Help your neighbors find great pros — a 60-second review goes a long way.",
    steps: [
      { text: "Open the business listing in the directory." },
      { text: "Scroll to 'Reviews' and click 'Write a Review'." },
      { text: "Pick a star rating and write a short note." },
      { text: "Optionally upload a receipt to get a 'Verified Purchase' badge." },
    ],
    ctaLabel: "Browse the directory",
    ctaTo: "/directory",
    keywords: "review rating stars leave testimonial",
  },
  {
    id: "refer-business",
    title: "Refer a business and earn credit",
    audience: "business",
    icon: Gift,
    summary:
      "Send another business owner your referral link. When they pay for their first month, you get account credit.",
    steps: [
      { text: "Open your Dashboard." },
      { text: "Find the 'Refer & Earn' card and copy your referral link." },
      { text: "Share it by text, email, or social." },
      { text: "Once they sign up and pay, your credit is auto-applied to your next bill." },
    ],
    ctaLabel: "Find your referral link",
    ctaTo: "/dashboard",
    keywords: "refer referral earn credit reward affiliate",
  },
];

interface GlossaryItem {
  term: string;
  icon: typeof HelpCircle;
  definition: string;
  link?: { label: string; to: string };
}

const GLOSSARY: GlossaryItem[] = [
  {
    term: "Bronze, Silver, Gold tiers",
    icon: Award,
    definition:
      "These are the three business membership levels. Bronze is the starter tier with core directory features. Silver adds verified badges, logos, and your website link. Gold puts you at the top of search results, unlocks the AI writing tools, marketing hub, newsletter, SMS, and unlimited job posts.",
    link: { label: "See the full tier comparison", to: "/membership" },
  },
  {
    term: "Gold Trial",
    icon: Crown,
    definition:
      "Every new business gets 30 days of full Gold access for free — no credit card required. After it ends, you choose a paid tier or downgrade to Bronze.",
  },
  {
    term: "AI Credits",
    icon: Sparkles,
    definition:
      "Gold members get a monthly bucket of credits that powers the AI writing tools (Listing Writer, Review Reply Generator, Newsletter Drafter, etc.). One generation usually costs 1 credit. Founders get unlimited.",
  },
  {
    term: "Founding Member",
    icon: Crown,
    definition:
      "The first 100 businesses to join get a permanent gold-engraved 'Founding Member' badge on their listing, plus unlimited AI credits forever. Limited to 100 spots.",
  },
  {
    term: "Comp Membership",
    icon: Gift,
    definition:
      "An admin can grant a business free Gold-equivalent access (called 'comp'). It works exactly like paid Gold but with no charge — used for partners, sponsorships, or to help a business get on its feet.",
  },
  {
    term: "Refer & Earn",
    icon: Gift,
    definition:
      "Share your referral link with another business owner. When they sign up and pay for their first month, you receive account credit toward your own bill.",
  },
  {
    term: "Help Wanted",
    icon: Briefcase,
    definition:
      "Our local job board. Businesses post openings here and locals apply directly. Bronze gets 1 active post at a time, Silver gets 3, Gold is unlimited.",
  },
  {
    term: "Daily Deals",
    icon: Tag,
    definition:
      "Limited-time offers (Gold-only) that appear on your listing and on the Deals page. Great for slow days, flash sales, and seasonal promos.",
  },
  {
    term: "Marketing Hub",
    icon: BarChart3,
    definition:
      "A Gold-only KPI dashboard that shows you in one place how your newsletter, SMS, review requests, deals, and social campaigns are performing.",
  },
  {
    term: "Quote Request",
    icon: Gavel,
    definition:
      "A customer describes a job they need done; eligible businesses in that category can respond with their pitch and price. Gold members see new requests first.",
  },
  {
    term: "Verified Purchase",
    icon: CheckCircle2,
    definition:
      "When a customer uploads proof of service (a receipt or photo) with their review, it gets a 'Verified Purchase' badge so other shoppers trust it more.",
  },
  {
    term: "Banner Ad",
    icon: Megaphone,
    definition:
      "Paid promo slots in the rotating carousel on the home page and directory. Comes in three sizes (Small, Medium, Large) and tier discounts apply automatically.",
  },
];

const PATHS = [
  {
    title: "I'm looking for a business",
    description: "Find pros, request quotes, and read reviews.",
    icon: Users,
    href: "/directory",
    cta: "Browse the directory",
    accent: "from-[#0a4a82] to-[#1a6ab2]",
  },
  {
    title: "I own a business",
    description: "List your business and start your free Gold trial.",
    icon: Building2,
    href: "/membership",
    cta: "See membership options",
    accent: "from-[#8a9a5b] to-[#a8b87b]",
  },
  {
    title: "I'm posting an event or job",
    description: "Add a community event or post a help wanted ad.",
    icon: Calendar,
    href: "/events",
    cta: "Open the events page",
    accent: "from-[#d4a373] to-[#e4b383]",
  },
];

export default function Help() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    if (!normalized) return TOP_TASKS;
    return TOP_TASKS.filter((t) =>
      `${t.title} ${t.summary} ${t.keywords}`.toLowerCase().includes(normalized),
    );
  }, [normalized]);

  const filteredGlossary = useMemo(() => {
    if (!normalized) return GLOSSARY;
    return GLOSSARY.filter((g) =>
      `${g.term} ${g.definition}`.toLowerCase().includes(normalized),
    );
  }, [normalized]);

  const showingResults = normalized.length > 0;
  const noResults =
    showingResults && filteredTasks.length === 0 && filteredGlossary.length === 0;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0a4a82] via-[#0a4a82]/95 to-[#0a3a6e] py-16 px-4 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-white/15 mb-6">
            <HelpCircle className="h-8 w-8" />
          </div>
          <h1
            className="font-display text-4xl md:text-5xl font-bold mb-4"
            data-testid="text-help-title"
          >
            How can we help?
          </h1>
          <p className="text-lg text-white/85 max-w-2xl mx-auto mb-8">
            Plain-English answers, step-by-step guides, and a glossary that
            explains every feature on the site.
          </p>
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search — e.g. 'post a job', 'AI credits', 'leave a review'…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-12 h-14 text-base rounded-full bg-white text-foreground border-0 shadow-xl"
              data-testid="input-help-search"
            />
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-12 space-y-16">
        {/* Choose your path */}
        {!showingResults && (
          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-2">
              Choose your path
            </h2>
            <p className="text-center text-muted-foreground mb-8">
              Pick the one that sounds like you.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PATHS.map((p) => (
                <Link
                  key={p.title}
                  to={p.href}
                  data-testid={`card-path-${p.href.slice(1) || "home"}`}
                  className="group"
                >
                  <Card className="h-full transition-shadow hover:shadow-xl border-2 hover:border-[#d4a373]/50 overflow-hidden">
                    <div
                      className={`h-2 bg-gradient-to-r ${p.accent}`}
                      aria-hidden="true"
                    />
                    <CardContent className="p-6">
                      <div
                        className={`inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${p.accent} text-white mb-4`}
                      >
                        <p.icon className="h-6 w-6" />
                      </div>
                      <h3 className="font-bold text-lg mb-2">{p.title}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {p.description}
                      </p>
                      <div className="text-sm font-semibold text-[#0a4a82] inline-flex items-center gap-1 group-hover:gap-2 transition-[gap]">
                        {p.cta}
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* No results */}
        {noResults && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-8 text-center">
              <p className="text-base font-medium text-amber-900 mb-2">
                No results for "{query}"
              </p>
              <p className="text-sm text-amber-800 mb-4">
                Try a different word, or email us — we're happy to help.
              </p>
              <Button
                asChild
                variant="outline"
                className="border-amber-300 hover:bg-amber-100"
              >
                <a href="mailto:support@locallist365.com">
                  <Mail className="mr-2 h-4 w-4" />
                  Email support@locallist365.com
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Top tasks */}
        {filteredTasks.length > 0 && (
          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-2">
              {showingResults ? "Matching how-tos" : "Top how-tos"}
            </h2>
            <p className="text-muted-foreground mb-8">
              Step-by-step guides for the most common tasks.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredTasks.map((task) => (
                <Card
                  key={task.id}
                  className="hover:shadow-lg transition-shadow"
                  data-testid={`card-task-${task.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-[#0a4a82]/10 text-[#0a4a82] flex items-center justify-center">
                        <task.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-bold leading-snug">
                          {task.title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {task.summary}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ol className="space-y-2 mb-4">
                      {task.steps.map((step, idx) => (
                        <li
                          key={idx}
                          className="flex gap-3 text-sm"
                        >
                          <span className="flex-shrink-0 h-6 w-6 rounded-full bg-[#d4a373]/15 text-[#8b5a2b] font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-foreground/90 pt-0.5">
                            {step.text}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <Button
                      asChild
                      size="sm"
                      className="w-full bg-[#0a4a82] hover:bg-[#0a3a6e]"
                      data-testid={`button-cta-${task.id}`}
                    >
                      <Link to={task.ctaTo}>
                        {task.ctaLabel}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Glossary */}
        {filteredGlossary.length > 0 && (
          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-2">
              {showingResults ? "Matching terms" : "What is...?"}
            </h2>
            <p className="text-muted-foreground mb-8">
              Plain-language definitions for every feature you'll see on Local List 365.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGlossary.map((g) => (
                <Card
                  key={g.term}
                  className="hover:shadow-md transition-shadow"
                  data-testid={`card-glossary-${g.term.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-[#8a9a5b]/15 text-[#5a6a3b] flex items-center justify-center">
                        <g.icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-base mb-1.5">
                          {g.term}
                        </h3>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          {g.definition}
                        </p>
                        {g.link && (
                          <Link
                            to={g.link.to}
                            className="text-sm text-[#0a4a82] font-semibold inline-flex items-center gap-1 mt-2 hover:gap-2 transition-[gap]"
                            data-testid={`link-glossary-${g.term.replace(/\s+/g, "-").toLowerCase()}`}
                          >
                            {g.link.label}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Long-tail FAQ pointer */}
        {!showingResults && (
          <section>
            <Card className="bg-gradient-to-br from-[#f5f5dc]/40 to-white border-[#d4a373]/30">
              <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="font-display text-xl font-bold mb-2">
                    Have a more specific question?
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xl">
                    Our full FAQ covers billing, refunds, badges, analytics,
                    cancellations, and dozens of other detailed questions.
                  </p>
                </div>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-[#0a4a82] text-[#0a4a82] hover:bg-[#0a4a82] hover:text-white whitespace-nowrap"
                  data-testid="button-full-faq"
                >
                  <Link to="/faq">
                    Open the full FAQ
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Contact */}
        {!showingResults && (
          <section>
            <Card className="bg-[#0a4a82] text-white border-0">
              <CardContent className="p-8 text-center">
                <Mail className="h-10 w-10 mx-auto mb-4 text-white/80" />
                <h3 className="font-display text-2xl font-bold mb-2">
                  Still stuck? Email us.
                </h3>
                <p className="text-white/85 mb-6 max-w-xl mx-auto">
                  Our team is small and local. Send us a note and a real human
                  will get back to you — usually same day.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="bg-[#d4a373] hover:bg-[#c49363] text-white"
                  data-testid="button-email-support"
                >
                  <a href="mailto:support@locallist365.com">
                    <Mail className="mr-2 h-5 w-5" />
                    support@locallist365.com
                  </a>
                </Button>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
