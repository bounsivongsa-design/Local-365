/**
 * Marketing Hub — single Gold-only landing page that rolls up activity
 * across every Marketing Suite (Newsletter, SMS, Review Requests, Deals,
 * Social Composer) into one ROI-style view.
 *
 * Pure read endpoint. No new tables. Range-scoped via ?days=7|30|90.
 */
import type { Express, Request, Response } from "express";
import { db as pgDb } from "./db";
import { isCompActive } from "@shared/config/membership";
import {
  businesses,
  users,
  newsletterCampaigns,
  newsletterSubscribers,
  newsletterSends,
  smsCampaigns,
  smsSubscribers,
  reviewRequests,
  deals,
  socialDrafts,
  recipientSuppressions,
} from "@shared/schema";
import { and, eq, sql, desc, gte, isNotNull, count } from "drizzle-orm";
import { isAuthenticated } from "./replit_integrations/auth";

function effectiveTier(b: typeof businesses.$inferSelect): string {
  if (b.isFoundingMember === true) return "premium";
  if (isCompActive(b)) return "premium";
  if (b.membershipTier === "premium") return "premium";
  if (b.goldTrialEndDate && new Date(b.goldTrialEndDate) > new Date()) return "premium";
  return b.membershipTier ?? "none";
}

async function authorizeOwner(
  req: Request,
  res: Response,
  businessId: number,
  requireGold = false,
): Promise<{ business: typeof businesses.$inferSelect } | null> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  const [user] = await pgDb
    .select({ id: users.id, linkedBusinessId: users.linkedBusinessId, accountType: users.accountType })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  const [biz] = await pgDb
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId));
  if (!biz) {
    res.status(404).json({ message: "Business not found" });
    return null;
  }
  const isAdmin = user.accountType === "admin";
  if (user.linkedBusinessId !== biz.id && !isAdmin) {
    res.status(403).json({ message: "You don't own this business" });
    return null;
  }
  if (requireGold && effectiveTier(biz) !== "premium") {
    res.status(403).json({
      message: "Marketing Hub requires Gold membership.",
      code: "GOLD_REQUIRED",
    });
    return null;
  }
  return { business: biz };
}

function pct(num: number, denom: number): number {
  if (!denom) return 0;
  return Math.round((num / denom) * 1000) / 10; // one decimal
}

export function registerMarketingHubRoutes(app: Express) {
  /**
   * GET /api/businesses/:id/marketing-hub?days=30
   *
   * Returns a single object with per-suite KPIs scoped to the last `days`
   * (default 30). Subscriber and suppression counts are point-in-time
   * (not range-scoped) since they describe current list health.
   */
  app.get(
    "/api/businesses/:id/marketing-hub",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const businessId = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(businessId)) {
        return res.status(400).json({ message: "Invalid business id" });
      }
      const auth = await authorizeOwner(req, res, businessId, true);
      if (!auth) return;

      const daysRaw = parseInt((req.query.days as string) || "30", 10);
      const days = [7, 30, 90].includes(daysRaw) ? daysRaw : 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // ── Newsletter ────────────────────────────────────────────────
      // Aggregate over campaigns SENT in the window. Recipient/success/
      // failure counts come off the campaign row; opens & clicks are
      // stamped per-recipient by the Resend webhook (email.opened /
      // email.clicked) onto newsletter_sends.
      const [nlTotals] = await pgDb
        .select({
          campaigns: count(newsletterCampaigns.id),
          recipients: sql<number>`COALESCE(SUM(${newsletterCampaigns.recipientCount}), 0)`,
          delivered: sql<number>`COALESCE(SUM(${newsletterCampaigns.successCount}), 0)`,
          failed: sql<number>`COALESCE(SUM(${newsletterCampaigns.failureCount}), 0)`,
        })
        .from(newsletterCampaigns)
        .where(
          and(
            eq(newsletterCampaigns.businessId, businessId),
            eq(newsletterCampaigns.status, "sent"),
            isNotNull(newsletterCampaigns.sentAt),
            gte(newsletterCampaigns.sentAt, since),
          ),
        );

      // Engagement: join newsletter_sends → newsletter_campaigns so we
      // only count opens/clicks for THIS business's campaigns sent in the
      // window (not all-time, not other businesses sharing the webhook).
      //
      // `trackable` excludes sends with NULL message_id — those are legacy
      // rows from before open/click tracking shipped, so the Resend webhook
      // has no id to match against and they can NEVER be stamped opened/
      // clicked. Counting them in the rate denominator would tank reported
      // open/click rates artificially. `untrackedSends` is surfaced
      // separately so the UI can footnote it.
      const [nlEngagement] = await pgDb
        .select({
          opened: sql<number>`COUNT(*) FILTER (WHERE ${newsletterSends.openedAt} IS NOT NULL)`,
          clicked: sql<number>`COUNT(*) FILTER (WHERE ${newsletterSends.clickedAt} IS NOT NULL)`,
          trackable: sql<number>`COUNT(*) FILTER (WHERE ${newsletterSends.status} = 'sent' AND ${newsletterSends.messageId} IS NOT NULL)`,
          untracked: sql<number>`COUNT(*) FILTER (WHERE ${newsletterSends.status} = 'sent' AND ${newsletterSends.messageId} IS NULL)`,
        })
        .from(newsletterSends)
        .innerJoin(newsletterCampaigns, eq(newsletterSends.campaignId, newsletterCampaigns.id))
        .where(
          and(
            eq(newsletterCampaigns.businessId, businessId),
            eq(newsletterSends.status, "sent"),
            isNotNull(newsletterCampaigns.sentAt),
            gte(newsletterCampaigns.sentAt, since),
          ),
        );

      const [nlSubs] = await pgDb
        .select({
          total: count(newsletterSubscribers.id),
          active: sql<number>`COUNT(*) FILTER (WHERE ${newsletterSubscribers.unsubscribedAt} IS NULL)`,
        })
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.businessId, businessId));

      const [nlLast] = await pgDb
        .select({
          id: newsletterCampaigns.id,
          subject: newsletterCampaigns.subject,
          sentAt: newsletterCampaigns.sentAt,
          recipients: newsletterCampaigns.recipientCount,
        })
        .from(newsletterCampaigns)
        .where(
          and(
            eq(newsletterCampaigns.businessId, businessId),
            eq(newsletterCampaigns.status, "sent"),
            isNotNull(newsletterCampaigns.sentAt),
          ),
        )
        .orderBy(desc(newsletterCampaigns.sentAt))
        .limit(1);

      // ── SMS Broadcast ─────────────────────────────────────────────
      const [smsTotals] = await pgDb
        .select({
          campaigns: count(smsCampaigns.id),
          recipients: sql<number>`COALESCE(SUM(${smsCampaigns.recipientCount}), 0)`,
          delivered: sql<number>`COALESCE(SUM(${smsCampaigns.successCount}), 0)`,
          failed: sql<number>`COALESCE(SUM(${smsCampaigns.failureCount}), 0)`,
          credits: sql<number>`COALESCE(SUM(${smsCampaigns.creditsCharged}), 0)`,
        })
        .from(smsCampaigns)
        .where(
          and(
            eq(smsCampaigns.businessId, businessId),
            eq(smsCampaigns.status, "sent"),
            isNotNull(smsCampaigns.sentAt),
            gte(smsCampaigns.sentAt, since),
          ),
        );

      const [smsSubs] = await pgDb
        .select({
          total: count(smsSubscribers.id),
          active: sql<number>`COUNT(*) FILTER (WHERE ${smsSubscribers.optedOutAt} IS NULL)`,
        })
        .from(smsSubscribers)
        .where(eq(smsSubscribers.businessId, businessId));

      const [smsLast] = await pgDb
        .select({
          id: smsCampaigns.id,
          body: smsCampaigns.body,
          sentAt: smsCampaigns.sentAt,
          recipients: smsCampaigns.recipientCount,
        })
        .from(smsCampaigns)
        .where(
          and(
            eq(smsCampaigns.businessId, businessId),
            eq(smsCampaigns.status, "sent"),
            isNotNull(smsCampaigns.sentAt),
          ),
        )
        .orderBy(desc(smsCampaigns.sentAt))
        .limit(1);

      // ── Review Requests ───────────────────────────────────────────
      // Window is by sentAt so the "30-day funnel" matches the campaign
      // marketers actually see. clicked + completed are computed from the
      // same row set.
      const [rrTotals] = await pgDb
        .select({
          sent: sql<number>`COUNT(*) FILTER (WHERE ${reviewRequests.sentAt} IS NOT NULL)`,
          clicked: sql<number>`COUNT(*) FILTER (WHERE ${reviewRequests.clickedAt} IS NOT NULL)`,
          completed: sql<number>`COUNT(*) FILTER (WHERE ${reviewRequests.completedReviewId} IS NOT NULL)`,
          failed: sql<number>`COUNT(*) FILTER (WHERE ${reviewRequests.status} = 'failed')`,
        })
        .from(reviewRequests)
        .where(
          and(
            eq(reviewRequests.businessId, businessId),
            gte(reviewRequests.sentAt, since),
          ),
        );

      const [rrLast] = await pgDb
        .select({
          id: reviewRequests.id,
          recipientName: reviewRequests.recipientName,
          recipientEmail: reviewRequests.recipientEmail,
          channel: reviewRequests.channel,
          status: reviewRequests.status,
          sentAt: reviewRequests.sentAt,
          clickedAt: reviewRequests.clickedAt,
          completedReviewId: reviewRequests.completedReviewId,
        })
        .from(reviewRequests)
        .where(
          and(
            eq(reviewRequests.businessId, businessId),
            isNotNull(reviewRequests.sentAt),
          ),
        )
        .orderBy(desc(reviewRequests.sentAt))
        .limit(1);

      // ── Deals ─────────────────────────────────────────────────────
      // Click count is lifetime per deal (stored as a counter), so the
      // "in-window" interpretation here is: deals CREATED in the window,
      // plus a separate "currently active" tally (point-in-time).
      const now = new Date();
      const [dealsTotals] = await pgDb
        .select({
          createdInWindow: count(deals.id),
          clicksInWindow: sql<number>`COALESCE(SUM(${deals.clickCount}), 0)`,
        })
        .from(deals)
        .where(
          and(
            eq(deals.businessId, businessId),
            gte(deals.createdAt, since),
          ),
        );

      const [dealsActive] = await pgDb
        .select({ active: count(deals.id) })
        .from(deals)
        .where(
          and(
            eq(deals.businessId, businessId),
            eq(deals.status, "active"),
            sql`${deals.startsAt} <= ${now}`,
            sql`${deals.endsAt} > ${now}`,
          ),
        );

      const [dealsLast] = await pgDb
        .select({
          id: deals.id,
          title: deals.title,
          discountText: deals.discountText,
          status: deals.status,
          startsAt: deals.startsAt,
          endsAt: deals.endsAt,
          clickCount: deals.clickCount,
          createdAt: deals.createdAt,
        })
        .from(deals)
        .where(eq(deals.businessId, businessId))
        .orderBy(desc(deals.createdAt))
        .limit(1);

      // ── Social Composer ───────────────────────────────────────────
      const [socialTotals] = await pgDb
        .select({
          drafts: count(socialDrafts.id),
          posted: sql<number>`COUNT(*) FILTER (WHERE ${socialDrafts.status} = 'posted')`,
        })
        .from(socialDrafts)
        .where(
          and(
            eq(socialDrafts.businessId, businessId),
            gte(socialDrafts.createdAt, since),
          ),
        );

      const [socialLast] = await pgDb
        .select({
          id: socialDrafts.id,
          sourceNotes: socialDrafts.sourceNotes,
          status: socialDrafts.status,
          createdAt: socialDrafts.createdAt,
        })
        .from(socialDrafts)
        .where(eq(socialDrafts.businessId, businessId))
        .orderBy(desc(socialDrafts.createdAt))
        .limit(1);

      // ── List health (point-in-time) ───────────────────────────────
      const [suppCounts] = await pgDb
        .select({
          email: sql<number>`COUNT(*) FILTER (WHERE ${recipientSuppressions.contactType} = 'email')`,
          phone: sql<number>`COUNT(*) FILTER (WHERE ${recipientSuppressions.contactType} = 'phone')`,
        })
        .from(recipientSuppressions)
        .where(eq(recipientSuppressions.businessId, businessId));

      // Coerce SQL numerics → plain numbers (pg returns strings for SUM/COUNT)
      const n = (v: unknown) => Number(v ?? 0);

      const newsletter = {
        recipients: n(nlTotals?.recipients),
        delivered: n(nlTotals?.delivered),
        failed: n(nlTotals?.failed),
        campaigns: n(nlTotals?.campaigns),
        deliveryRate: pct(n(nlTotals?.delivered), n(nlTotals?.recipients)),
        opened: n(nlEngagement?.opened),
        clicked: n(nlEngagement?.clicked),
        // Number of in-window sends that CAN be tracked by the Resend
        // open/click webhook (status='sent' AND message_id IS NOT NULL).
        // Used as the denominator for openRate/clickRate so legacy sends
        // (sent before tracking shipped) don't tank the rate.
        trackable: n(nlEngagement?.trackable),
        // Sends that delivered but have no Resend message_id, so engagement
        // can never be stamped on them. Surfaced separately so the UI can
        // footnote "(of N tracked) — M legacy sends excluded".
        untrackedSends: n(nlEngagement?.untracked),
        // Open/click rates are denominated against TRACKABLE sends so
        // legacy/untracked sends don't artificially deflate the number.
        // Falls back to delivered when nothing is yet tracked (degrades
        // to old behavior so a brand-new install isn't a divide-by-zero).
        openRate: pct(
          n(nlEngagement?.opened),
          n(nlEngagement?.trackable) || n(nlTotals?.delivered),
        ),
        clickRate: pct(
          n(nlEngagement?.clicked),
          n(nlEngagement?.trackable) || n(nlTotals?.delivered),
        ),
        subscribersTotal: n(nlSubs?.total),
        subscribersActive: n(nlSubs?.active),
        last: nlLast ?? null,
      };

      const sms = {
        recipients: n(smsTotals?.recipients),
        delivered: n(smsTotals?.delivered),
        failed: n(smsTotals?.failed),
        campaigns: n(smsTotals?.campaigns),
        creditsSpent: n(smsTotals?.credits),
        deliveryRate: pct(n(smsTotals?.delivered), n(smsTotals?.recipients)),
        subscribersTotal: n(smsSubs?.total),
        subscribersActive: n(smsSubs?.active),
        last: smsLast ?? null,
      };

      const reviewReqs = {
        sent: n(rrTotals?.sent),
        clicked: n(rrTotals?.clicked),
        completed: n(rrTotals?.completed),
        failed: n(rrTotals?.failed),
        clickRate: pct(n(rrTotals?.clicked), n(rrTotals?.sent)),
        completionRate: pct(n(rrTotals?.completed), n(rrTotals?.sent)),
        last: rrLast ?? null,
      };

      const dealsBlock = {
        createdInWindow: n(dealsTotals?.createdInWindow),
        clicksInWindow: n(dealsTotals?.clicksInWindow),
        currentlyActive: n(dealsActive?.active),
        last: dealsLast ?? null,
      };

      const social = {
        drafts: n(socialTotals?.drafts),
        posted: n(socialTotals?.posted),
        last: socialLast ?? null,
      };

      const suppressions = {
        email: n(suppCounts?.email),
        phone: n(suppCounts?.phone),
      };

      // Headline: total people reached across all paid channels in window
      const totalReach = newsletter.delivered + sms.delivered + reviewReqs.sent;

      res.json({
        rangeDays: days,
        since: since.toISOString(),
        totalReach,
        newsletter,
        sms,
        reviewRequests: reviewReqs,
        deals: dealsBlock,
        social,
        suppressions,
      });
    },
  );
}
