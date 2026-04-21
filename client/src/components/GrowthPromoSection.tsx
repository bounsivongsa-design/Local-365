import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Crown, Gift, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FoundingStats {
  limit: number;
  claimed: number;
  remaining: number;
}

export function GrowthPromoSection() {
  const { data } = useQuery<FoundingStats>({
    queryKey: ["/api/public/founding-stats"],
    staleTime: 60_000,
  });

  const claimed = data?.claimed ?? 0;
  const limit = data?.limit ?? 100;
  const remaining = data?.remaining ?? limit;
  const pct = Math.min(100, Math.round((claimed / limit) * 100));
  const slotsLeft = remaining > 0;

  return (
    <section
      className="py-16 bg-gradient-to-br from-[#0a4a82] via-[#073661] to-[#052849] relative overflow-hidden"
      data-testid="section-growth-promo"
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, #d4a373 1px, transparent 1px), radial-gradient(circle at 70% 70%, #d4a373 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="container relative">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-300/20 border border-amber-300/40 px-4 py-1.5 mb-4">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span className="text-xs font-semibold text-amber-100 uppercase tracking-wider">
              For Local Businesses
            </span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-3">
            Two Perks. Zero Catches.
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Get rewarded for joining early — and for bringing other Moyock
            businesses with you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Founding Member */}
          <div
            className="rounded-2xl bg-gradient-to-br from-amber-400/15 to-amber-600/10 border border-amber-300/30 p-7 backdrop-blur-sm"
            data-testid="card-founding-promo"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-300/20 rounded-xl border border-amber-300/40">
                <Crown className="h-6 w-6 text-amber-300" />
              </div>
              <h3 className="text-xl font-bold text-white">
                Founding Member 100
              </h3>
            </div>
            <p className="text-white/80 text-sm mb-5">
              The first 100 paid businesses get a permanent numbered badge
              shown on every listing — and locked-in pricing for life. Once
              all 100 spots are claimed, the door closes for good.
            </p>

            <div className="mb-2 flex items-baseline justify-between text-white">
              <span className="font-mono text-2xl font-bold" data-testid="text-founding-claimed">
                {claimed} <span className="text-white/50 text-base">/ {limit}</span>
              </span>
              <span className="text-sm text-amber-200 font-semibold" data-testid="text-founding-remaining">
                {slotsLeft ? `${remaining} spots left` : "All claimed"}
              </span>
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Refer-a-Business */}
          <div
            className="rounded-2xl bg-gradient-to-br from-emerald-400/15 to-emerald-600/10 border border-emerald-300/30 p-7 backdrop-blur-sm"
            data-testid="card-referral-promo"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-emerald-300/20 rounded-xl border border-emerald-300/40">
                <Gift className="h-6 w-6 text-emerald-300" />
              </div>
              <h3 className="text-xl font-bold text-white">
                Refer a Business, Earn 30 Days of Gold
              </h3>
            </div>
            <p className="text-white/80 text-sm mb-5">
              Share your referral code with another Moyock business owner.
              When they sign up for any paid plan, you{" "}
              <span className="font-semibold text-emerald-200">both</span> get
              30 free days of Gold features added to your account. No limit on
              how many you can refer.
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white/5 rounded-lg py-2 px-1">
                <div className="text-xs text-white/50 uppercase tracking-wide">You</div>
                <div className="text-emerald-300 font-bold text-lg">+30d</div>
              </div>
              <div className="bg-white/5 rounded-lg py-2 px-1">
                <div className="text-xs text-white/50 uppercase tracking-wide">Them</div>
                <div className="text-emerald-300 font-bold text-lg">+30d</div>
              </div>
              <div className="bg-white/5 rounded-lg py-2 px-1">
                <div className="text-xs text-white/50 uppercase tracking-wide">Cap</div>
                <div className="text-white font-bold text-lg">∞</div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-10">
          <Link to="/membership">
            <Button
              size="lg"
              className="bg-amber-300 hover:bg-amber-400 text-[#073661] font-bold text-base px-8 shadow-lg"
              data-testid="button-claim-founding-spot"
            >
              {slotsLeft ? "Claim Your Founding Spot" : "Join the Directory"}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
          <p className="text-xs text-white/50 mt-3">
            Memberships start at $25/mo · Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}
