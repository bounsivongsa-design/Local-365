import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { Crown, X, ArrowRight } from "lucide-react";

interface FoundingStats {
  limit: number;
  claimed: number;
  remaining: number;
}

const STORAGE_KEY = "ll365_founding_banner_dismissed";
const HIDDEN_PATH_PREFIXES = [
  "/membership",
  "/create-business",
  "/admin",
  "/dashboard",
  "/account-setup",
  "/edit-listing",
  "/auth",
  "/forgot-password",
  "/reset-password",
];

export function FoundingUrgencyBanner() {
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  const onHiddenRoute = HIDDEN_PATH_PREFIXES.some((p) => pathname.startsWith(p));

  const { data } = useQuery<FoundingStats>({
    queryKey: ["/api/public/founding-stats"],
    staleTime: 60_000,
    enabled: !dismissed && !onHiddenRoute,
  });

  useEffect(() => {
    // Re-sync dismissed state if storage changes in another tab
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setDismissed(e.newValue === "1");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  if (dismissed || onHiddenRoute || !data) return null;

  const { limit, claimed, remaining } = data;
  // Only show urgency once spots are actually being claimed AND while seats remain.
  if (remaining <= 0) return null;
  if (claimed < 1) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  // Bump urgency tone when fewer than 25% of seats remain
  const isCritical = remaining <= Math.max(10, Math.floor(limit * 0.25));

  return (
    <div
      className={`relative w-full ${
        isCritical
          ? "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500"
          : "bg-gradient-to-r from-[#0a4a82] via-[#0d5a9e] to-[#0a4a82]"
      } text-white shadow-md`}
      data-testid="banner-founding-urgency"
    >
      <div className="container flex items-center justify-center gap-3 py-2 px-10 text-sm font-medium relative">
        <Crown
          className={`h-4 w-4 shrink-0 ${
            isCritical ? "text-[#073661]" : "text-amber-300"
          }`}
        />
        <span
          className={`text-center ${isCritical ? "text-[#073661]" : "text-white"}`}
        >
          <span className="font-bold">
            {remaining} of {limit} Founding Member spots left
          </span>
          <span className="hidden sm:inline">
            {" "}
            — locked-in pricing for life + permanent badge.
          </span>
        </span>
        <Link
          to="/membership"
          className={`hidden md:inline-flex items-center gap-1 ml-2 rounded-full px-3 py-0.5 text-xs font-bold transition ${
            isCritical
              ? "bg-[#073661] text-amber-300 hover:bg-[#052849]"
              : "bg-amber-300 text-[#073661] hover:bg-amber-400"
          }`}
          data-testid="link-banner-claim-spot"
        >
          Claim Yours <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          onClick={dismiss}
          aria-label="Dismiss founding member banner"
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition ${
            isCritical
              ? "text-[#073661] hover:bg-[#073661]/20"
              : "text-white/80 hover:bg-white/20"
          }`}
          data-testid="button-dismiss-founding-banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
