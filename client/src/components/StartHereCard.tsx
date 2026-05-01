import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  X,
  ArrowRight,
  HelpCircle,
  Building2,
  Camera,
  Star,
  Crown,
  Search,
  Gavel,
  ShieldCheck,
} from "lucide-react";

interface Step {
  icon: typeof Sparkles;
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
}

const BUSINESS_STEPS: Step[] = [
  {
    icon: Building2,
    title: "1. Complete your listing",
    description:
      "Add your services, hours, and contact info so customers can find you.",
    ctaLabel: "Edit listing",
    ctaTo: "/edit-listing",
  },
  {
    icon: Camera,
    title: "2. Add photos and a logo",
    description:
      "Listings with photos get 3x more clicks. Upload a few of your best.",
    ctaLabel: "Add photos",
    ctaTo: "/edit-listing",
  },
  {
    icon: Star,
    title: "3. Ask your first customer for a review",
    description:
      "Reviews build trust. Use the review request tool to send one in 30 seconds.",
    ctaLabel: "Send a review request",
    ctaTo: "/review-requests",
  },
  {
    icon: Crown,
    title: "4. Try your free 30-day Gold trial",
    description:
      "Unlocks AI writing tools, marketing hub, newsletter, and more — no card required.",
    ctaLabel: "See Gold features",
    ctaTo: "/membership",
  },
];

const CUSTOMER_STEPS: Step[] = [
  {
    icon: Search,
    title: "1. Browse the directory",
    description:
      "Find local pros by category or keyword. Filter by your zip code.",
    ctaLabel: "Open directory",
    ctaTo: "/directory",
  },
  {
    icon: Gavel,
    title: "2. Request a quote",
    description:
      "Describe what you need once. Local businesses respond with their best price.",
    ctaLabel: "Get a quote",
    ctaTo: "/quotes",
  },
  {
    icon: ShieldCheck,
    title: "3. Get verified for trusted reviews",
    description:
      "Upload a receipt to earn the Verified Purchase badge on your reviews.",
    ctaLabel: "Verify my account",
    ctaTo: "/dashboard",
  },
];

interface StartHereCardProps {
  userId: string | undefined;
  accountType: "business" | "customer";
}

export function StartHereCard({ userId, accountType }: StartHereCardProps) {
  const storageKey = userId ? `startHereDismissed:${userId}` : null;
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    if (!storageKey) return;
    setDismissed(localStorage.getItem(storageKey) === "true");
  }, [storageKey]);

  if (dismissed || !storageKey) return null;

  const steps = accountType === "business" ? BUSINESS_STEPS : CUSTOMER_STEPS;
  const heading =
    accountType === "business"
      ? "Welcome! Here's how to get the most out of your listing."
      : "Welcome to Local List 365! Here's how to get started.";

  const handleDismiss = () => {
    if (storageKey) localStorage.setItem(storageKey, "true");
    setDismissed(true);
  };

  return (
    <Card
      className="bg-gradient-to-br from-[#fffaf0] via-white to-[#f5f5dc]/50 border-2 border-[#d4a373]/30 shadow-lg rounded-2xl overflow-hidden"
      data-testid="card-start-here"
    >
      <div className="h-1 bg-gradient-to-r from-[#d4a373] via-[#c49363] to-[#8a9a5b]" />
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-11 w-11 rounded-full bg-gradient-to-br from-[#d4a373] to-[#c49363] text-white flex items-center justify-center shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2
                className="font-display text-xl font-bold text-[#1a1a2e] leading-tight"
                data-testid="text-start-here-heading"
              >
                {heading}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                A quick checklist to get you up and running. You can dismiss
                this anytime.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 -mt-2 -mr-2 h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            aria-label="Dismiss start here checklist"
            data-testid="button-dismiss-start-here"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div
          className={`grid grid-cols-1 ${accountType === "business" ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"} gap-3`}
        >
          {steps.map((s) => (
            <div
              key={s.title}
              className="rounded-xl border border-[#d4a373]/20 bg-white/80 p-4 flex flex-col"
              data-testid={`start-here-step-${s.title.split(".")[0]}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-[#0a4a82]/10 text-[#0a4a82] flex items-center justify-center">
                  <s.icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-sm text-[#1a1a2e] leading-tight">
                  {s.title}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3 flex-1">
                {s.description}
              </p>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="w-full justify-between h-9 rounded-lg border-[#0a4a82]/20 hover:bg-[#0a4a82]/5 hover:border-[#0a4a82]/40 text-xs"
              >
                <Link to={s.ctaTo}>
                  {s.ctaLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-[#d4a373]/20 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Need help with something else?
          </p>
          <Link
            to="/help"
            className="text-sm font-semibold text-[#0a4a82] hover:text-[#0a3a6e] inline-flex items-center gap-1.5"
            data-testid="link-start-here-help"
          >
            <HelpCircle className="h-4 w-4" />
            Visit the Help Center
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
