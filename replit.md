# Local List 365 - Currituck County Directory

## Overview
Local List 365 is a community platform for Currituck County, NC, connecting residents and visitors with local businesses and events. It offers a comprehensive business directory, an event calendar, a quote request system, and AI-powered tools. The platform supports local commerce through tiered advertising, business credentialing, and a job board, aiming to be a central hub for economic and social activity.

## User Preferences
Preferred communication style: Simple, everyday language.
Design theme: Coastal - ocean blue (#0a4a82), sandy beige (#d4a373/#f5f5dc), dune green (#8a9a5b)
Dev/prod parity: Anything verified in dev must also be verified in production. After deploys, re-check critical flows (auth, Stripe checkout, webhooks, AI features, impersonation, multi-zip, comp memberships) against the published app — production uses different env vars, real Stripe keys, real Resend, and a separate session store, so dev success does NOT guarantee prod success.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui (New York style variant)
- **State Management**: TanStack React Query
- **UI/UX Decisions**: Coastal color palette, shadcn/ui components, Zillow-style location search with geolocation and radius filtering, badges for business credentials and membership tiers.

### Backend
- **Runtime**: Node.js with Express.js (TypeScript, ESM modules)
- **API Pattern**: RESTful JSON APIs
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
- **Membership Tiers**: Bronze, Silver, Gold tiers with varying features, managed via Stripe subscriptions, including additional zip-code listings. Gold tier explicitly includes an AI Tools suite.
- **Advertising**: Carousel banner ads with tiered pricing and an in-browser ad designer. Ads open a preview modal; real ads link to business listings/websites, while placeholder examples offer "Get Your Ad Here" to drive leads. Business owners can now create new ad campaigns **inline from the Dashboard's "My Ad Campaigns" card** via `CreateAdDialog` (in `client/src/pages/Dashboard.tsx`) — tier-gated size selector (small/medium/large with `TIER_ALLOWED_AD_SIZES`), live monthly-price preview using `AD_BASE_PRICING_MONTHLY` × `TIER_DISCOUNT_MAP`, identical image-upload flow as the full Advertising page (direct upload with auto-resize, crop-first via `ImageCropper`, or in-browser `AdDesigner`), and the same `POST /api/ads/request` → `POST /api/stripe/ad-checkout` chain that honors `founderBypass` for instant activation. The dashboard buttons no longer navigate to `/advertising`; a small "See full pricing & tier comparison" link is preserved for users who want promo codes, video ads, or the full pricing page. The orange "EXAMPLE" diagonal corner ribbon was **removed entirely** from `AdCarousel.tsx` (large/medium/small) — the diagonal ribbon was visually bleeding into adjacent real ads at column boundaries (e.g. it appeared next to Back Bay Lawn Care's large banner) and confusing paying customers into thinking their ad was tagged "EXAMPLE". Placeholder/filler slides remain clearly distinguishable two ways: (1) the pricing pill in their content overlay reads "Large — $1,000/mo" / "Medium — $500/mo" / "Small — $250/mo" (real ads read "Featured" / "Ad"), and (2) clicking a placeholder opens the preview modal whose CTA is "Get Your Ad Here → /advertising" instead of "View Business Listing" (driven by `slide.id === 0`, since every placeholder has `id: 0` and every real DB ad has `id > 0` from the `ad_placements` serial PK). The `ExampleBanner` import was removed from `AdCarousel.tsx`. Real customer ads (`isRealImageAd === true`) render with `object-contain` (not `object-cover`) so the WHOLE uploaded banner is visible — phone numbers, service lists, and logos that advertisers bake into the design were getting clipped at the bottom by `object-cover` (e.g. Back Bay Lawn Care's "757-563-4705" was chopped off). Each ad container has `bg-[#0a3a6e]` matching the carousel section's gradient so any letterboxing from non-matching aspect ratios blends seamlessly into the background. Hover scale was also reduced from 1.05 → 1.02 because `object-contain` reveals the image edges, making large scale jumps feel jarring. The LARGE slot's aspect ratio is now **dynamic** — the slot resizes to match the currently-shown real ad's natural width/height, measured via an `<img onLoad>` handler that stores `naturalWidth/naturalHeight` per ad id in `realAdAspects` state (keyed by `slide.id`). A `largeSlotAspect` const computed before the JSX `return` reads `realAdAspects[currentLargeSlide.id]` and falls back to 16:9 for placeholder slides or before the image has loaded. This was added because a fixed 16:9 box was making customer banners look small/squished — Back Bay Lawn Care's roughly-square banner was sitting in a too-wide-for-its-height slot, leaving the phone number compressed against the bottom edge with empty `bg-[#0a3a6e]` letterboxing on the sides. With dynamic sizing, every uploaded banner fills its slot edge-to-edge regardless of whether the advertiser uploads a 1:1 square, 4:3, 16:9, or custom shape. The grid that contains the three columns also switched from `items-stretch` → `items-start` so the medium/small columns don't stretch when the large column grows tall to accommodate a square banner. Implemented in `client/src/components/AdCarousel.tsx`.
- **Business Analytics**: Tracks engagement metrics for listings.
- **Review System**: Customer reviews with optional proof of service and business responses.
- **Admin Dashboard**: Control center for platform management, user/business oversight, content moderation, and per-zip activity statistics.
- **AI Lab**: Admin-only sandbox for developing Gold-exclusive AI features, with an AI credit system.
- **Growth Features**: "Founding Urgency Banner" and "Refer-a-Business" program, including manual Stripe credit issuance for referrals.
- **AI-Powered Tools (Gold-exclusive)**: Listing Description Writer, Review Reply Generator, Quote Responder, Help Wanted Writer, Event Description Writer, Photo Caption & Alt-Text Generator, Daily Deals / Limited-Time Offers (with AI Deal Writer), SMS Broadcast (with AI SMS Drafter), Social Composer, Review Request Blasts, Email Newsletter (with AI Newsletter Draft, plus open/click tracking).
- **Technical Implementations**: Haversine formula for distance filtering, hierarchical category management, Stripe integration for subscriptions and payments, Gold auto-upgrade for new members, reusable image cropper.
- **Founder/Admin Bypasses**: All founder/admin bypass rules live in a single source-of-truth module at `server/lib/founderRules.ts`, exporting `FOUNDER_EMAILS`, `FOUNDER_BUSINESSES`, `shouldBypassCharges` (3-prong: admin OR founder email OR founder business name; used by every Stripe checkout — membership, ad, job, event, additional-zip), and `shouldBypassAiCredits` (4-prong: same as above PLUS the immutable `business.isFoundingMember` flag; used by AI credit deduction in `aiFeatures.ts` and the SMS Broadcast credit pool in `sms.ts`). The two AI surfaces additionally self-heal `ai_credits.is_founder_comp=true` on every authorized request so the no-user-context `reserveCredits`/`reserveSmsCredits` paths honor the bypass on subsequent calls; the AI Credits widget and credit-pack purchase route both OR `auth.isFounder || row.isFounderComp` so an admin-granted comp also flips the card to ∞ and blocks further credit purchases. Adding a new founder email or business now requires editing one file. Direct unit-test coverage in `server/__tests__/shouldBypassCharges.test.ts` and `server/__tests__/shouldBypassAiCredits.test.ts`.
- **Comp Memberships**: Admin-manageable Gold-equivalent access for businesses without Stripe charges, with audit logging and email notifications.
- **Admin "Sign in as" (Impersonation)**: Allows administrators to log in as other non-admin users for support.
- **Marketing Hub**: Gold-only KPI dashboard for marketing suite performance. Newsletter Open/Click rates are denominated against `trackable` sends (status='sent' AND `message_id IS NOT NULL`), not raw `delivered`. Legacy sends with NULL `message_id` (pre-tracking-rollout, or sends where Resend never returned an id) are surfaced separately as `untrackedSends` and excluded from rate math so old data can't artificially tank or inflate engagement metrics. The MarketingHub UI shows a "(of N tracked) — M legacy sends excluded" subtext on the Opens/Clicks tiles when `untrackedSends > 0`. Regression-tested in `server/__tests__/marketingHub.test.ts`.
- **Review-Request Funnel Linking**: Streamlines customer review submission via unique tokens.
- **Newsletter Send-Error Hardening**: The Resend SDK does NOT throw on a non-2xx response — it returns `{ data: null, error }`. The send route in `server/routes.ts` (`POST /api/businesses/:id/newsletter/campaigns/:cid/send`) explicitly checks `if (sendResult.error) throw` so failed sends are marked `status='failed'` with the error message persisted on the row, the campaign's `failureCount` is incremented, and the campaign flips to `status='failed'` when all recipients fail. Without this guard, a real Resend outage would silently mark every recipient `sent` while no email actually went out. End-to-end coverage in `server/__tests__/newsletterSendError.test.ts` (intercepts `globalThis.fetch` for `api.resend.com` and returns a 422).
- **Founding Member Badge & Roster**: 100-spot cap (`FOUNDING_LIMIT=100`). Admin can grant/revoke from the Growth tab via `POST /api/admin/businesses/:id/grant-founding-member` (auto-assigns next 1..100, idempotent) and `POST /api/admin/businesses/:id/revoke-founding-member`. The badge component (`client/src/components/FoundingMemberBadge.tsx`) renders three variants — compact / default / medallion — with a polished-gold gradient (#FFF4C2→#F5C842→#B8860B→#DAA520→#8B6914), inset highlight + inset shadow for raised relief, and an engraved Crown icon for a premium 3D look (no flat amber).
- **Admin Referral Overrides**: `POST /api/admin/referrals/:id/issue-credit` accepts an optional `{ customCents }` (validated 1..100000, i.e. $0.01–$1000.00) to override the default computed credit. New `POST /api/admin/referrals/:id/void` flips a referral to `status='void'`, sets `creditAmountCents=0` and `rewardedAt=now`, and console-logs an audit line. Voided rows are excluded from "pending" stats and the AdminReferrals UI exposes a custom-amount input + per-row Void button (with AlertDialog confirm). Status filter and badge handle the new `void` state. Customer-facing `GET /api/businesses/:id/referrals` returns `creditAmountCents` per row so `ReferAndEarnCard` can show actual dollar credit per rewarded referral (falls back to "Gold days" for legacy founder/comp rows where `creditAmountCents` is null but `rewardDays > 0`).

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