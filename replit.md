# Local List 365 - Currituck County Directory

## Overview
Local List 365 is a community-focused platform for Currituck County, NC, connecting residents and visitors with local businesses and events. It features a comprehensive business directory, an event calendar, a quote request system, and AI-powered tools. The platform aims to foster community engagement and support local commerce through tiered advertising, business credentialing, and a job board, ultimately serving as a central hub for local economic and social activity.

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
- **Membership Tiers**: Bronze, Silver, Gold tiers with varying features, managed via Stripe subscriptions. Includes additional zip-code listings with tiered discounts.
- **Advertising**: Carousel banner ads with tiered pricing and an in-browser ad designer.
- **Business Analytics**: Tracks engagement metrics for listings.
- **Review System**: Customer reviews with optional proof of service and business responses.
- **Admin Dashboard**: Control center for platform management, user/business oversight, and content moderation.
- **AI Lab**: Admin-only sandbox for developing Gold-exclusive AI features, including an AI credit system.
- **Growth Features**: "Founding Urgency Banner" and "Refer-a-Business" program.
- **AI-Powered Tools (Gold-exclusive)**:
    - Listing Description Writer
    - Review Reply Generator
    - Quote Responder
    - Help Wanted Writer
    - Event Description Writer
    - Photo Caption & Alt-Text Generator (using gpt-4o-mini vision)
    - Daily Deals / Limited-Time Offers (with AI Deal Writer)
    - SMS Broadcast (with AI SMS Drafter, Twilio integration planned)
    - Social Composer (generates platform-tuned posts for Facebook, Instagram, Google Business Profile, Nextdoor)
    - Review Request Blasts (email/SMS to past customers with AI Drafter)
    - Email Newsletter (with AI Newsletter Draft)
- **Technical Implementations**: Haversine formula for distance filtering, hierarchical category management, Stripe integration for subscriptions and payments, Gold auto-upgrade for new members, reusable image cropper.
- **Multi-Zip Listings**: Owners can run separate listings in additional covered zips. Schema adds `ownerUserId`, `parentBusinessId`, `isAdditionalZip`, `status` to `businesses`. Routes in `server/multiZip.ts` cover my-businesses, switch, available-zips, add-zip-checkout, cancel-additional-zip. Stripe webhook (`type=additional_zip`) creates the child listing with no trial. Dashboard `ListingZipSwitcher` lets owners flip between locations and add a new zip. Archived child listings are filtered out of public reads in `server/storage.ts`.
- **Comp Memberships** (Task #16): `businesses.isCompedMembership` (+ `compedMembershipNote`, `compedMembershipGrantedAt`, `compedMembershipGrantedBy`, `compedMembershipExpiresAt`) gives a business Gold-equivalent access without any Stripe charge. The single source of truth `isCompActive(b)` lives in `shared/config/membership.ts` (true only when flag is on AND expiry is null/future). Honored by every `getEffectiveTier()`/`effectiveTier()` helper in `routes.ts`, `stripe.ts`, `multiZip.ts`, `aiFeatures.ts`, `newsletter.ts`, `social.ts`, `deals.ts`, `reviewRequests.ts`, `sms.ts`. Granted/revoked from the admin Businesses tab via `POST /api/admin/businesses/:id/comp` (admin-only) accepting `{active, note, expiresAt?}` — past/invalid `expiresAt` is rejected. Admin UI: a dedicated "Comp Memberships" panel (yellow card above the businesses table) lists every comped business with note, granted date, expiry, status, and Edit/Revoke buttons, fed by `GET /api/admin/comp-memberships`. The per-row "Comp" button on the main table opens a dialog with note + optional date-picker expiry; a "Gold (Comp) · until MMM d" amber badge renders next to the tier badge for any active comp. Orthogonal to `membershipTier` so it never collides with a real subscription, and `PATCH /api/admin/businesses/:id` excludes `membershipTier` from STRING_FIELDS so profile-edits can't accidentally promote/demote a paid plan.
- **Admin "Sign in as" (Impersonation)**: Admin can impersonate any non-admin user from the AdminDashboard users table (amber LogIn icon between Reset Password and Verify). `POST /api/admin/impersonate/:userId` stashes the original admin id on `req.session.impersonatorId` then `req.login()`s the target. `POST /api/admin/stop-impersonating` restores the admin via that stashed id and clears it. Guards: admin-only, can't impersonate self, can't impersonate another admin (`accountType==='admin' || isAdmin===true`). `GET /api/auth/user` surfaces an `impersonator: {id,email,firstName,lastName} | null` field so the global `ImpersonationBanner` (mounted in `App.tsx` above `FoundingUrgencyBanner`) renders an amber bar with "Return to admin" on every page during a session.
- **Review-Request Funnel Linking**: `/api/r/:token` redirects to `/directory/:bizId?reviewToken=…#leave-review` so the review form auto-opens. The `ReviewDialog` captures the token from URL on mount and passes it on submit; the review POST best-effort-updates the originating `review_requests` row to `status='completed'` with `completedReviewId` set (scoped by both `token` AND `businessId` to prevent cross-business tagging). The owner's `/review-requests` History tab shows a "View review" link on completed rows.

## Running Tests
Run the full automated test suite with:

```
npm test
```

Test files live under `server/__tests__/**/*.test.ts` and are discovered/executed by `script/run-tests.ts`, which shells out to `tsx --test`. Drop a new `*.test.ts` file anywhere under that directory and it will be picked up automatically — no script changes needed. Tests share the workspace Postgres database, so make sure the schema is up to date (`npm run db:push`) before running.

### Database schema sync

`npm run db:push` should always complete non-interactively. If you ever see drizzle-kit prompting "Do you want to truncate <table>?", that means a unique constraint in the live DB is named differently from what `shared/schema.ts` would generate (drizzle treats it as a new constraint on a populated table). Fix it by renaming/aligning the existing constraint in the DB to match drizzle's `<table>_<column>_unique` naming, rather than answering the prompt. For an already-drifted DB the one-time alignment that was applied for task #53 was:

```sql
-- locations.slug had a partial unique INDEX; replace with a real UNIQUE constraint
DROP INDEX locations_slug_unique;
ALTER TABLE locations ADD CONSTRAINT locations_slug_unique UNIQUE (slug);

-- legacy *_key constraint names → drizzle's *_unique names
ALTER TABLE businesses RENAME CONSTRAINT businesses_referral_code_key TO businesses_referral_code_unique;
ALTER TABLE businesses RENAME CONSTRAINT businesses_founding_member_number_key TO businesses_founding_member_number_unique;
ALTER TABLE referrals RENAME CONSTRAINT referrals_referred_business_id_key TO referrals_referred_business_id_unique;

-- redundant duplicates (the *_unique versions already exist)
ALTER TABLE newsletter_subscribers DROP CONSTRAINT newsletter_subscribers_unsubscribe_token_key;
ALTER TABLE review_requests DROP CONSTRAINT review_requests_token_key;
```

Fresh environments don't need any of this — drizzle creates everything from `shared/schema.ts` directly.

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