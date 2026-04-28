import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Zap, TrendingUp, InfinityIcon, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AICreditTopUpModal } from "@/components/AICreditTopUpModal";

interface MonthUsage {
  totalCredits: number;
  totalCalls: number;
  totalCostCents: number;
  byFeature: Record<string, { credits: number; calls: number }>;
}
interface CreditsResponse {
  balance: number;
  monthlyAllowance: number;
  cycleResetsAt: string | null;
  isFounder: boolean;
  eligible: boolean;
  monthUsage?: MonthUsage;
}

const FEATURE_LABELS: Record<string, string> = {
  listing_description: "Listing Writer",
  review_reply: "Review Replies",
};

interface Props {
  businessId: number;
}

export function AICreditsCard({ businessId }: Props) {
  const [topUpOpen, setTopUpOpen] = useState(false);
  const { data, isLoading } = useQuery<CreditsResponse>({
    queryKey: ["/api/businesses", businessId, "ai-credits"],
    retry: false,
    staleTime: 30_000,
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-2xl" data-testid="skeleton-ai-credits-card" />;
  }
  // Hide entirely for non-Gold (403 -> data undefined / not eligible)
  if (!data || data.eligible !== true) return null;

  const usage = data.monthUsage ?? { totalCredits: 0, totalCalls: 0, totalCostCents: 0, byFeature: {} };
  const allowance = data.monthlyAllowance || 250;
  const usedPct = Math.min(100, Math.round((usage.totalCredits / allowance) * 100));
  const balancePct = Math.min(100, Math.round((data.balance / allowance) * 100));
  const featureEntries = Object.entries(usage.byFeature).sort(
    ([, a], [, b]) => b.credits - a.credits,
  );

  return (
    <Card
      className="bg-gradient-to-br from-[#fff8e7] to-[#fde8b8] border-amber-200 shadow-[0_8px_30px_rgba(212,163,115,0.25)] rounded-2xl overflow-hidden"
      data-testid="card-ai-credits"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-[#1a1a2e]">
          <span className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Credits
          </span>
          {data.isFounder ? (
            <Badge className="bg-gradient-to-r from-amber-400 to-amber-500 text-white border-0 shadow gap-1">
              <InfinityIcon className="h-3 w-3" />
              Founder
            </Badge>
          ) : (
            <Badge className="bg-white/80 text-amber-700 border border-amber-300">
              AI Assist
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Balance display */}
        {data.isFounder ? (
          <div className="bg-white/70 rounded-xl p-4 text-center">
            <div className="text-4xl font-bold text-amber-700" data-testid="text-balance-founder">
              ∞
            </div>
            <div className="text-xs text-amber-800/70 mt-1">
              Unlimited AI credits — thank you for being a founding business
            </div>
          </div>
        ) : (
          <div className="bg-white/70 rounded-xl p-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-[#1a1a2e]" data-testid="text-balance">
                {data.balance.toLocaleString()}
              </span>
              <span className="text-xs text-[#4a4a5a]">
                / {allowance.toLocaleString()} this cycle
              </span>
            </div>
            <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all"
                style={{ width: `${balancePct}%` }}
              />
            </div>
            {data.cycleResetsAt && (
              <div className="text-[11px] text-[#4a4a5a]/80 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Refills on{" "}
                {new Date(data.cycleResetsAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            )}
          </div>
        )}

        {/* This-month usage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              This month
            </span>
            <span className="text-xs text-[#4a4a5a]" data-testid="text-month-summary">
              {usage.totalCalls} {usage.totalCalls === 1 ? "call" : "calls"}
              {!data.isFounder && ` · ${usage.totalCredits} credits`}
            </span>
          </div>

          {usage.totalCalls === 0 ? (
            <div className="bg-white/50 rounded-lg p-3 text-xs text-[#4a4a5a] text-center">
              No AI usage yet this month.{" "}
              <span className="text-amber-700 font-medium">
                Try "Generate with AI" on your listing or reviews.
              </span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {featureEntries.map(([feat, v]) => {
                const label = FEATURE_LABELS[feat] || feat;
                const pct = usage.totalCredits
                  ? Math.round((v.credits / Math.max(usage.totalCredits, 1)) * 100)
                  : 0;
                return (
                  <div
                    key={feat}
                    className="bg-white/50 rounded-lg px-3 py-2"
                    data-testid={`row-feature-${feat}`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#1a1a2e]">{label}</span>
                      <span className="text-[#4a4a5a]">
                        {v.calls} {v.calls === 1 ? "call" : "calls"}
                        {!data.isFounder && ` · ${v.credits}cr`}
                      </span>
                    </div>
                    {!data.isFounder && (
                      <div className="h-1 rounded-full bg-amber-100 overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-amber-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top-up CTA (hidden for founders — they have ∞) */}
        {!data.isFounder && (
          <>
            {usedPct >= 75 && (
              <div className="rounded-lg bg-amber-100/70 border border-amber-300 px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
                <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  You've used {usedPct}% of this month's credits. Top up
                  below to keep AI tools running.
                </span>
              </div>
            )}
            <Button
              onClick={() => setTopUpOpen(true)}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-0"
              data-testid="button-topup-credits"
            >
              <Plus className="h-4 w-4 mr-1" />
              Buy more credits
            </Button>
            <AICreditTopUpModal
              open={topUpOpen}
              onOpenChange={setTopUpOpen}
              businessId={businessId}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
