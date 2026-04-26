import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Share2, Crown, Users, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReferralRow {
  id: number;
  referredBusinessId: number;
  referredName: string | null;
  status: "pending" | "rewarded" | "processing" | "void";
  rewardDays: number | null;
  // Stripe credit issued in cents. Null on legacy rows or rows that took
  // the founder/comp Gold-days fallback path; the row label degrades to
  // "+N Gold days" instead of a dollar amount in those cases.
  creditAmountCents: number | null;
  createdAt: string;
  rewardedAt: string | null;
}

interface ReferralData {
  referralCode: string;
  isFoundingMember: boolean;
  foundingMemberNumber: number | null;
  goldDaysEarned: number;
  totalCreditCentsEarned: number;
  pendingCreditCents: number;
  referrals: ReferralRow[];
}

export function ReferAndEarnCard({ businessId }: { businessId: number }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<ReferralData>({
    queryKey: ["/api/businesses", businessId, "referrals"],
    enabled: !!businessId,
  });

  const code = data?.referralCode ?? "";
  const shareUrl =
    typeof window !== "undefined" && code
      ? `${window.location.origin}/create-business?ref=${encodeURIComponent(code)}`
      : "";

  const rewardedCount = data?.referrals.filter((r) => r.status === "rewarded").length ?? 0;
  const pendingCount = data?.referrals.filter((r) => r.status === "pending").length ?? 0;
  const pendingCreditCents = data?.pendingCreditCents ?? 0;
  const pendingCreditDollars =
    pendingCreditCents > 0 ? (pendingCreditCents / 100).toFixed(2) : null;
  const totalCreditCentsEarned = data?.totalCreditCentsEarned ?? 0;
  const totalCreditDollarsEarned =
    totalCreditCentsEarned > 0 ? (totalCreditCentsEarned / 100).toFixed(2) : null;
  // Most recent rewarded referrals — capped at 3 so the card stays compact.
  // Voided rows are excluded so the customer never sees an admin clawback.
  const recentRewarded = (data?.referrals ?? [])
    .filter((r) => r.status === "rewarded")
    .slice(0, 3);

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied!", description: "Share it with another local business." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: shareUrl, variant: "destructive" });
    }
  };

  const nativeShare = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join LocalList365",
          text: `Join the Moyock business directory — use my code ${code} and we both get 30 free days of Gold features.`,
          url: shareUrl,
        });
      } catch {}
    } else {
      copyShareLink();
    }
  };

  return (
    <Card
      className="bg-gradient-to-br from-[#0a4a82] to-[#073661] border-0 shadow-[0_8px_30px_rgba(10,74,130,0.3)] rounded-2xl text-white"
      data-testid="card-refer-and-earn"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-white/70 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Refer & Earn
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-white/70">Loading…</p>
        ) : (
          <>
            {data?.isFoundingMember && data.foundingMemberNumber && (
              <div
                className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-300/20 border border-amber-300/40 px-3 py-1"
                data-testid="badge-founding-member-dashboard"
              >
                <Crown className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-xs font-semibold text-amber-100">
                  Founding Member #{data.foundingMemberNumber}
                </span>
              </div>
            )}

            <div className="mb-3">
              <div className="text-xs text-white/60 mb-1">Your code</div>
              <div
                className="font-mono text-lg font-bold tracking-wider text-white bg-white/10 rounded-lg px-3 py-2"
                data-testid="text-referral-code"
              >
                {code || "—"}
              </div>
            </div>

            <p className="text-xs text-white/70 mb-3">
              When another business signs up with your code and activates a paid plan, you both
              get <span className="font-semibold text-amber-200">30 days of Gold</span>.
            </p>

            {pendingCreditDollars && (
              <div
                className="mb-3 rounded-lg bg-emerald-400/15 border border-emerald-300/40 px-3 py-2"
                data-testid="banner-pending-credit"
              >
                <div className="text-[10px] uppercase tracking-wide text-emerald-200/80">
                  Pending credit
                </div>
                <div className="text-sm font-semibold text-emerald-100">
                  Your next invoice will be reduced by{" "}
                  <span data-testid="text-pending-credit-amount">${pendingCreditDollars}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <div className="bg-white/10 rounded-lg py-2">
                <div className="text-lg font-bold" data-testid="text-referrals-rewarded">
                  {rewardedCount}
                </div>
                <div className="text-[10px] text-white/60 uppercase tracking-wide">Rewarded</div>
              </div>
              <div className="bg-white/10 rounded-lg py-2">
                <div className="text-lg font-bold" data-testid="text-referrals-pending">
                  {pendingCount}
                </div>
                <div className="text-[10px] text-white/60 uppercase tracking-wide">Pending</div>
              </div>
              <div className="bg-white/10 rounded-lg py-2">
                {/* Show lifetime credit earned when present, otherwise the
                    legacy Gold-days counter so founder/comp accounts (no
                    Stripe customer → no dollar credit issued) still see
                    their earned reward. */}
                {totalCreditDollarsEarned ? (
                  <>
                    <div className="text-lg font-bold" data-testid="text-credit-earned">
                      ${totalCreditDollarsEarned}
                    </div>
                    <div className="text-[10px] text-white/60 uppercase tracking-wide">Earned</div>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-bold" data-testid="text-gold-days-earned">
                      {data?.goldDaysEarned ?? 0}
                    </div>
                    <div className="text-[10px] text-white/60 uppercase tracking-wide">Gold Days</div>
                  </>
                )}
              </div>
            </div>

            {recentRewarded.length > 0 && (
              <div className="mb-3 rounded-lg bg-white/5 border border-white/10 p-2">
                <div className="text-[10px] uppercase tracking-wide text-white/60 mb-1.5 px-1">
                  Recent rewards
                </div>
                <ul className="space-y-1">
                  {recentRewarded.map((r) => {
                    const cents = r.creditAmountCents;
                    // Founder/comp fallback: no Stripe customer → reward came
                    // as +N Gold days, no dollar amount to show.
                    const label =
                      cents != null
                        ? `+$${(cents / 100).toFixed(2)}`
                        : `+${r.rewardDays ?? 30}d Gold`;
                    return (
                      <li
                        key={r.id}
                        className="flex items-center justify-between text-xs px-1"
                        data-testid={`row-rewarded-referral-${r.id}`}
                      >
                        <span className="truncate text-white/85" title={r.referredName ?? "Business"}>
                          {r.referredName ?? "Business"}
                        </span>
                        <span
                          className="font-semibold text-emerald-200 ml-2 shrink-0"
                          data-testid={`text-reward-amount-${r.id}`}
                        >
                          {label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={copyShareLink}
                className="flex-1 bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm"
                data-testid="button-copy-referral-link"
                disabled={!code}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" /> Copy Link
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={nativeShare}
                className="bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm"
                data-testid="button-share-referral"
                disabled={!code}
                aria-label="Share"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
