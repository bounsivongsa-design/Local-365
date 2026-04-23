import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Mail,
  MessageSquare,
  Star,
  Tag,
  Share2,
  Users,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";

interface MarketingHubData {
  rangeDays: number;
  since: string;
  totalReach: number;
  newsletter: {
    recipients: number;
    delivered: number;
    failed: number;
    campaigns: number;
    deliveryRate: number;
    subscribersTotal: number;
    subscribersActive: number;
    last: { id: number; subject: string; sentAt: string; recipients: number } | null;
  };
  sms: {
    recipients: number;
    delivered: number;
    failed: number;
    campaigns: number;
    creditsSpent: number;
    deliveryRate: number;
    subscribersTotal: number;
    subscribersActive: number;
    last: { id: number; body: string; sentAt: string; recipients: number } | null;
  };
  reviewRequests: {
    sent: number;
    clicked: number;
    completed: number;
    failed: number;
    clickRate: number;
    completionRate: number;
    last: {
      id: number;
      recipientName: string | null;
      recipientEmail: string | null;
      channel: string;
      status: string;
      sentAt: string;
      clickedAt: string | null;
      completedReviewId: number | null;
    } | null;
  };
  deals: {
    createdInWindow: number;
    clicksInWindow: number;
    currentlyActive: number;
    last: {
      id: number;
      title: string;
      discountText: string;
      status: string;
      startsAt: string;
      endsAt: string;
      clickCount: number;
      createdAt: string;
    } | null;
  };
  social: {
    drafts: number;
    posted: number;
    last: { id: number; sourceNotes: string; status: string; createdAt: string } | null;
  };
  suppressions: { email: number; phone: number };
}

function fmtAgo(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

function StatTile({
  label,
  value,
  testid,
}: {
  label: string;
  value: string | number;
  testid?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-[#1a1a2e]" data-testid={testid}>
        {value}
      </div>
    </div>
  );
}

export default function MarketingHub() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const businessId = user?.linkedBusinessId ?? null;
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const hubQuery = useQuery<MarketingHubData>({
    queryKey: ["/api/businesses", businessId, "marketing-hub", { days }],
    queryFn: async () => {
      const r = await fetch(
        `/api/businesses/${businessId}/marketing-hub?days=${days}`,
        { credentials: "include" },
      );
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Failed");
      return r.json();
    },
    enabled: !!businessId,
  });

  if (authLoading) {
    return (
      <div className="container max-w-6xl mx-auto py-10 px-4">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="container max-w-6xl mx-auto py-10 px-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Marketing Hub</h1>
        <p className="text-slate-600">Please sign in to see your marketing performance.</p>
      </div>
    );
  }
  if (!businessId) {
    return (
      <div className="container max-w-6xl mx-auto py-10 px-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Marketing Hub</h1>
        <p className="text-slate-600">Link a business to your account to see this dashboard.</p>
      </div>
    );
  }

  const isGoldRequired =
    hubQuery.error &&
    hubQuery.error instanceof Error &&
    /Gold/i.test(hubQuery.error.message);

  if (isGoldRequired) {
    return (
      <div className="container max-w-3xl mx-auto py-10 px-4 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-amber-500 mb-3" />
        <h1 className="text-3xl font-bold mb-2 text-[#1a1a2e]">Marketing Hub</h1>
        <p className="text-slate-600 mb-6">
          The Marketing Hub is a Gold-only feature. Upgrade to see open/click/bounce
          stats from every Marketing Suite tool in one place.
        </p>
        <Link to="/membership">
          <Button className="bg-[#0a4a82] hover:bg-[#0a4a82]/90">Upgrade to Gold</Button>
        </Link>
      </div>
    );
  }

  const data = hubQuery.data;
  const loading = hubQuery.isLoading;

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a2e]" data-testid="text-hub-title">
            Marketing Hub
          </h1>
          <p className="text-slate-600">
            One view of every campaign you've run across Newsletter, SMS, Review Requests,
            Deals, and Social.
          </p>
        </div>
        <Tabs
          value={String(days)}
          onValueChange={(v) => setDays(Number(v) as 7 | 30 | 90)}
        >
          <TabsList data-testid="tabs-range">
            <TabsTrigger value="7" data-testid="tab-range-7">7 days</TabsTrigger>
            <TabsTrigger value="30" data-testid="tab-range-30">30 days</TabsTrigger>
            <TabsTrigger value="90" data-testid="tab-range-90">90 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Headline reach card */}
      <Card className="border-[#0a4a82]/20 bg-gradient-to-br from-[#0a4a82]/5 to-[#d4a373]/5">
        <CardContent className="py-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-[#0a4a82]/10 p-3">
              <TrendingUp className="h-6 w-6 text-[#0a4a82]" />
            </div>
            <div>
              <div className="text-sm uppercase tracking-wide text-slate-500">
                Total reach (last {data?.rangeDays ?? days} days)
              </div>
              <div
                className="text-4xl font-bold text-[#1a1a2e]"
                data-testid="text-total-reach"
              >
                {loading ? "…" : (data?.totalReach ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">
                Email delivered + SMS delivered + review requests sent
              </div>
            </div>
          </div>
          {!loading && (data?.suppressions.email || 0) + (data?.suppressions.phone || 0) > 0 && (
            <div className="flex items-center gap-2 text-amber-700 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span data-testid="text-suppressions">
                {data!.suppressions.email} email · {data!.suppressions.phone} phone suppressed
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Newsletter */}
          <Card data-testid="card-newsletter">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mail className="h-5 w-5 text-[#0a4a82]" />
                  Email Newsletter
                </CardTitle>
                <Link to="/newsletter">
                  <Button variant="ghost" size="sm">
                    Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
              <CardDescription>
                {data.newsletter.campaigns} campaign{data.newsletter.campaigns === 1 ? "" : "s"} sent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  label="Delivered"
                  value={data.newsletter.delivered.toLocaleString()}
                  testid="stat-newsletter-delivered"
                />
                <StatTile
                  label="Delivery rate"
                  value={`${data.newsletter.deliveryRate}%`}
                  testid="stat-newsletter-rate"
                />
                <StatTile
                  label="Failed"
                  value={data.newsletter.failed.toLocaleString()}
                  testid="stat-newsletter-failed"
                />
                <StatTile
                  label="Subscribers"
                  value={`${data.newsletter.subscribersActive} / ${data.newsletter.subscribersTotal}`}
                  testid="stat-newsletter-subs"
                />
              </div>
              <div className="text-xs text-slate-600 pt-1 border-t border-slate-100">
                {data.newsletter.last ? (
                  <>
                    Last sent: <span className="font-medium">{data.newsletter.last.subject}</span>{" "}
                    · {fmtAgo(data.newsletter.last.sentAt)}
                  </>
                ) : (
                  <span className="text-slate-400">No campaigns sent yet</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* SMS */}
          <Card data-testid="card-sms">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5 text-[#0a4a82]" />
                  SMS Broadcast
                </CardTitle>
                <Link to="/sms">
                  <Button variant="ghost" size="sm">
                    Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
              <CardDescription>
                {data.sms.campaigns} campaign{data.sms.campaigns === 1 ? "" : "s"} sent ·{" "}
                {data.sms.creditsSpent} credits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  label="Delivered"
                  value={data.sms.delivered.toLocaleString()}
                  testid="stat-sms-delivered"
                />
                <StatTile
                  label="Delivery rate"
                  value={`${data.sms.deliveryRate}%`}
                  testid="stat-sms-rate"
                />
                <StatTile
                  label="Failed"
                  value={data.sms.failed.toLocaleString()}
                  testid="stat-sms-failed"
                />
                <StatTile
                  label="Subscribers"
                  value={`${data.sms.subscribersActive} / ${data.sms.subscribersTotal}`}
                  testid="stat-sms-subs"
                />
              </div>
              <div className="text-xs text-slate-600 pt-1 border-t border-slate-100">
                {data.sms.last ? (
                  <>
                    Last blast {fmtAgo(data.sms.last.sentAt)} ·{" "}
                    {data.sms.last.recipients} recipient{data.sms.last.recipients === 1 ? "" : "s"}
                  </>
                ) : (
                  <span className="text-slate-400">No SMS campaigns yet</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Review Requests */}
          <Card data-testid="card-review-requests">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Star className="h-5 w-5 text-[#0a4a82]" />
                  Review Requests
                </CardTitle>
                <Link to="/review-requests">
                  <Button variant="ghost" size="sm">
                    Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
              <CardDescription>
                {data.reviewRequests.sent} sent · {data.reviewRequests.completed} review
                {data.reviewRequests.completed === 1 ? "" : "s"} earned
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  label="Clicked"
                  value={`${data.reviewRequests.clicked} (${data.reviewRequests.clickRate}%)`}
                  testid="stat-rr-clicked"
                />
                <StatTile
                  label="Completed"
                  value={`${data.reviewRequests.completed} (${data.reviewRequests.completionRate}%)`}
                  testid="stat-rr-completed"
                />
                <StatTile
                  label="Failed"
                  value={data.reviewRequests.failed.toLocaleString()}
                  testid="stat-rr-failed"
                />
                <StatTile
                  label="Sent"
                  value={data.reviewRequests.sent.toLocaleString()}
                  testid="stat-rr-sent"
                />
              </div>
              <div className="text-xs text-slate-600 pt-1 border-t border-slate-100">
                {data.reviewRequests.last ? (
                  <>
                    Last asked{" "}
                    <span className="font-medium">
                      {data.reviewRequests.last.recipientName ||
                        data.reviewRequests.last.recipientEmail ||
                        "a customer"}
                    </span>{" "}
                    {fmtAgo(data.reviewRequests.last.sentAt)}
                    {data.reviewRequests.last.completedReviewId && (
                      <Badge variant="secondary" className="ml-2">earned a review</Badge>
                    )}
                  </>
                ) : (
                  <span className="text-slate-400">No review requests yet</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Deals */}
          <Card data-testid="card-deals">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Tag className="h-5 w-5 text-[#0a4a82]" />
                  Daily Deals
                </CardTitle>
                <Link to="/deals">
                  <Button variant="ghost" size="sm">
                    Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
              <CardDescription>
                {data.deals.currentlyActive} live now ·{" "}
                {data.deals.createdInWindow} created in window
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  label="Active"
                  value={data.deals.currentlyActive.toLocaleString()}
                  testid="stat-deals-active"
                />
                <StatTile
                  label="Clicks (window)"
                  value={data.deals.clicksInWindow.toLocaleString()}
                  testid="stat-deals-clicks"
                />
              </div>
              <div className="text-xs text-slate-600 pt-1 border-t border-slate-100">
                {data.deals.last ? (
                  <>
                    Latest: <span className="font-medium">{data.deals.last.title}</span> ·{" "}
                    {data.deals.last.discountText} · {data.deals.last.clickCount} click
                    {data.deals.last.clickCount === 1 ? "" : "s"}
                  </>
                ) : (
                  <span className="text-slate-400">No deals yet</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Social Composer */}
          <Card data-testid="card-social">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Share2 className="h-5 w-5 text-[#0a4a82]" />
                  Social Composer
                </CardTitle>
                <Link to="/social">
                  <Button variant="ghost" size="sm">
                    Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
              <CardDescription>
                {data.social.drafts} draft{data.social.drafts === 1 ? "" : "s"} created ·{" "}
                {data.social.posted} marked posted
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  label="Drafts"
                  value={data.social.drafts.toLocaleString()}
                  testid="stat-social-drafts"
                />
                <StatTile
                  label="Posted"
                  value={data.social.posted.toLocaleString()}
                  testid="stat-social-posted"
                />
              </div>
              <div className="text-xs text-slate-600 pt-1 border-t border-slate-100">
                {data.social.last ? (
                  <>Latest draft {fmtAgo(data.social.last.createdAt)}</>
                ) : (
                  <span className="text-slate-400">No drafts yet</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* List health */}
          <Card data-testid="card-list-health">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-[#0a4a82]" />
                List Health
              </CardTitle>
              <CardDescription>Point-in-time across all suites</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  label="Email subscribers"
                  value={data.newsletter.subscribersActive.toLocaleString()}
                />
                <StatTile
                  label="SMS subscribers"
                  value={data.sms.subscribersActive.toLocaleString()}
                />
                <StatTile
                  label="Email suppressed"
                  value={data.suppressions.email.toLocaleString()}
                  testid="stat-supp-email"
                />
                <StatTile
                  label="Phone suppressed"
                  value={data.suppressions.phone.toLocaleString()}
                  testid="stat-supp-phone"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
