# Local List 365 - Currituck County Directory

## Overview
Local List 365 is a community-focused platform for Currituck County, NC, aiming to connect residents and visitors with local businesses and events. It serves as a central hub for local economic and social activity by providing a comprehensive business directory, an event calendar, a quote request system, and AI-powered tools. The platform supports local commerce through tiered advertising, business credentialing, and a job board.

## User Preferences
Preferred communication style: Simple, everyday language.
Design theme: Coastal - ocean blue (#0a4a82), sandy beige (#d4a373/#f5f5dc), dune green (#8a9a5b)
Dev/prod parity: Anything verified in dev must also be verified in production. After deploys, re-check critical flows (auth, Stripe checkout, webhooks, AI features, impersonation, multi-zip, comp memberships) against the published app — production uses different env vars, real Stripe keys, real Resend, and a separate session store, so dev success does NOT guarantee prod success.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui (New York style variant)
- **State Management**: TanStack React Query
- **UI/UX Decisions**: Coastal color palette, shadcn/ui components, Zillow-style location search with geolocation and radius filtering across 41 zip codes. Badges for business credentials and membership tiers.

### Backend
- **Runtime**: Node.js with Express.js (TypeScript, ESM modules)
- **API Pattern**: RESTful JSON APIs (`/api` prefix)
- **Authentication**: Custom email/password + Google OAuth, supporting `customer`, `business`, and `admin` account types. Bcrypt for password hashing, PostgreSQL for session storage.
- **File Uploads**: Uppy with AWS S3-compatible presigned URLs

### Data Storage
- **Primary Database**: PostgreSQL via Drizzle ORM
- **Key-Value Store**: Replit Database

### Core Features
- **Business Listings**: Detailed profiles, categories, ratings, and media.
- **Quote System**: Facilitates customer quote requests and business responses.
- **Events Platform**: Calendar with Stripe payment for event ads.
- **Job Board**: Businesses can post help-wanted ads based on membership tier.
- **Membership Tiers**: Bronze, Silver, Gold tiers with varying features, managed via Stripe subscriptions. Includes additional zip-code listings. Gold tier feature list explicitly enumerates the AI Tools suite (Listing Writer, Review Reply, Quote Responder, Help Wanted, Event Description, Photo Caption/Alt-Text, Deal Writer, SMS Drafter, Social Composer, Review Request Blasts, AI Newsletter, Marketing Hub) so prospective members can see exactly what's included.
- **Advertising**: Carousel banner ads with tiered pricing and an in-browser ad designer. Every ad in the "Featured Local Businesses" carousel — placeholder example ads AND real paid ads — opens a preview modal on click so users actually see the ad's full image, headline, and copy first. Modal CTAs branch on `slide.id`: real ads (id>0) get "View Business Listing" / "Visit Website" buttons (and fire a click-tracking POST to `/api/ads/:id/click`), while placeholder examples (id===0) show an "Example Ad" badge plus a single "Get Your Ad Here" button that routes to `/advertising`, so empty spots actively generate leads instead of being dead clicks. Real paid ads (`id>0`, not a placeholder fill, has `imageUrl`) render the user-uploaded banner CLEAN — full opacity, no dark gradient overlay, no duplicated business-name + title text — with only a small "Featured" badge in the top-right corner. This applies across `AdCarousel` (large/medium/small slots) AND `AdBanner` (large/medium/small banners). The legacy treatment (dim image + dark gradient + overlay text) is reserved for placeholders, where the image is just generic stock decoration. Regression that drove this change: Back Bay Lawn Care's medium-banner ad uploaded a fully-designed flyer (logo, "VETERAN OWNED" badge, "NOW ACCEPTING NEW CLIENTS" headline, 6-bullet service list, phone number) and the previous treatment dimmed it to 75% opacity AND painted a black gradient over the bottom 60% — completely covering their phone number "757-563-4705" — then stamped a duplicate "Back Bay Lawn Care" + title overlay on top.
- **Business Analytics**: Tracks engagement metrics for listings.
- **Review System**: Customer reviews with optional proof of service and business responses.
- **Admin Dashboard**: Control center for platform management, user/business oversight, and content moderation. Includes a per-zip activity table (Activity by Zip Code) showing businesses, paid businesses, active ads, active jobs, events, quote bids, ad impressions and clicks per zip — sorted by total activity desc so the busiest zips bubble to the top and the bottom rows surface where to focus new advertising and outreach. Backed by `GET /api/admin/stats/by-zip` which pre-aggregates each child table in its own subquery to avoid SUM() row-fanout when a single business has multiple ads/jobs/quotes.
- **AI Lab**: Admin-only sandbox for developing Gold-exclusive AI features, including an AI credit system.
- **Growth Features**: "Founding Urgency Banner" and "Refer-a-Business" program. The public `GET /api/public/founding-stats` counter (used by both the home-page Founding Member 100 card and the urgency banner) counts any business in a paid state — `membership_tier IN ('basic','standard','premium')` OR `is_comped_membership=true` OR `is_founding_member=true` — capped at 100 for display. We do NOT count only the `is_founding_member` flag because that flag is only set by the Stripe webhook → `processMembershipActivation` pipeline; comp memberships, admin tier changes, and seed inserts all skip it, which used to leave the counter showing 0/100 even after real customers signed up. The flag still drives the permanent numbered badge for new Stripe signups. Admins can manually issue Stripe credit on referrals (with optional custom-cents override for partial refunds, mid-cycle upgrades, or goodwill bumps), or void rows to retire them from pending/lifetime stats; voided rows preserve `creditAmountCents` for audit and are guarded against re-credit (manual Stripe refund still required if credit was already issued). Customers see per-referral $ credit on the Refer-and-Earn card with a `totalCreditCentsEarned` lifetime total; legacy founder/comp rows fall back to "+N Gold days".
- **AI-Powered Tools (Gold-exclusive)**: Listing Description Writer, Review Reply Generator, Quote Responder, Help Wanted Writer, Event Description Writer, Photo Caption & Alt-Text Generator, Daily Deals / Limited-Time Offers (with AI Deal Writer), SMS Broadcast (with AI SMS Drafter), Social Composer, Review Request Blasts, Email Newsletter (with AI Newsletter Draft, plus open/click tracking via Resend webhooks → newsletter_sends.openedAt/clickedAt with first-touch semantics; surfaced as opens/clicks/openRate/clickRate in the Marketing Hub. Open/click rates use a `trackable` denominator — sends with a Resend message_id, i.e. those the engagement webhook can match — with `untrackedSends` surfaced separately so legacy NULL-message_id rows don't artificially deflate rates; falls back to `delivered` only when `trackable=0` to preserve backward behavior on legacy datasets).
- **Technical Implementations**: Haversine formula for distance filtering, hierarchical category management, Stripe integration for subscriptions and payments, Gold auto-upgrade for new members, reusable image cropper.
- **Stripe Founder/Admin Bypass**: A unified 3-pronged check (`shouldBypassCharges(user, biz)` in `server/stripe.ts`) gates EVERY paid Stripe checkout endpoint — membership (`/api/stripe/create-checkout`), ad placement (`/api/stripe/ad-checkout`), job listing (`/api/stripe/job-listing-checkout`), and event ad (`/api/stripe/event-checkout`). Returns `true` for: (1) any user with `accountType='admin'`, (2) any user whose email is in `FOUNDER_EMAILS` (e.g. `boun.sivongsa@gmail.com`), or (3) any business whose normalized name matches `FOUNDER_BUSINESSES` (e.g. "Blackwater Technology Solutions" — the normalizer strips LLC/Inc/Corp/Ltd/Co + punctuation). Mirrors `shouldBypassChargesForOwner` in `server/multiZip.ts` so behavior is consistent across every paid surface. Regression that drove this fix: ad/job/event checkouts previously ONLY checked `isFounderBusiness(biz.name)` — meaning a founder/admin whose business was saved with an abbreviated name (e.g. "Blackwater Tech Solutions" vs canonical "Blackwater Technology Solutions") would silently get billed real Stripe money instead of bypassing. All four checkouts now return `{ founderBypass: true }` and activate the resource for free without ever touching Stripe. Membership checkout activates the Gold tier directly (`processMembershipActivation`); ad/event checkouts flip `paymentStatus='paid'` + `status='active'`/`'approved'`; job checkout flips `isActive=true` + `paymentStatus='paid'`. Direct unit-test coverage in `server/__tests__/shouldBypassCharges.test.ts` (admin bypass, founder-email bypass, founder-business bypass with LLC suffix, negative case for ordinary users, defensive null/undefined, case-insensitive email match).
- **Multi-Zip Listings**: Owners can manage separate listings in additional covered zip codes. Founders (`FOUNDER_BUSINESSES`/`FOUNDER_EMAILS` in `server/multiZip.ts`) and any user with `accountType='admin'` bypass the additional-zip Stripe charge entirely — `quoteAddZipForOwner` returns `priceMonthly: 0` + `bypass: true` so the confirm modal shows "Activate for free", and `startAddZipCheckoutForOwner` inserts the child listing directly (mirroring `handleAdditionalZipCheckoutCompleted` but with `stripeSubscriptionId: null`, no founding number, no Gold trial) and returns `{ founderBypass: true }` instead of a Stripe Checkout URL. The frontend (`ListingZipSwitcher`) handles `founderBypass` with a toast + cache invalidation, mirroring the same pattern used by `/api/stripe/ad-checkout`.
- **Comp Memberships**: Provides Gold-equivalent access to businesses without Stripe charges, manageable via the admin dashboard. The grant/revoke flow lives in `setBusinessCompMembership` (server/comp.ts), called by `POST /api/admin/businesses/:id/comp`. The helper wraps the business-row update + `compMembershipAudit` insert in a single Drizzle transaction so a failed audit insert rolls back the comp flag — never leaves the business comped without a corresponding "who/when/why" row. On revoke ALL comp columns (incl. `compedMembershipReminder7Sent`/`Reminder1Sent` and `compedWelcomeEmailSentAt`) are cleared so the next grant starts clean. Recipient email resolution prefers `business.email` and falls back to the linked owner user's email so a missing business email still gets the welcome notice. Email side-effects (`notifyCompGranted`/`notifyCompRevoked`) are fire-and-forget in the route handler, NOT in the helper, so a slow Resend call never blocks the admin response or the audit write. Direct unit-test coverage in `server/__tests__/setBusinessCompMembership.test.ts` (grant, indefinite-grant, revoke, owner-email fallback, re-grant resets reminder flags, unknown-id returns null).
- **Admin "Sign in as" (Impersonation)**: Allows administrators to temporarily log in as other non-admin users for support and debugging.
- **Marketing Hub**: A Gold-only KPI dashboard aggregating marketing suite performance.
- **Review-Request Funnel Linking**: Streamlines the process for customers to leave reviews via unique tokens.

## External Dependencies

### Third-Party Services
- **Supabase**: Client SDK for database interaction.
- **OpenAI**: AI chat integration via Replit AI Integrations proxy.
- **Replit Object Storage**: For file uploads.
- **Stripe**: Payment processing.
- **Resend**: Email notifications.
- **Twilio**: SMS service (planned integration).

### Key NPM Packages
- **UI Components**: Radix UI primitives, FullCalendar.
- **Database**: `drizzle-orm`, `pg`.
- **Validation**: `zod`, `drizzle-zod`.
- **Date Handling**: `date-fns`.