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

The canonical, non-interactive way to sync the database with `shared/schema.ts` is:

```
npx tsx script/db-sync.ts
```

That script does three things in order, and each step is idempotent:

1. **`script/realign-schema-constraints.ts`** — renames any legacy `<table>_<column>_key` unique constraints to drizzle's expected `<table>_<column>_unique` naming (and drops duplicates if both exist), and promotes the partial UNIQUE INDEX on `locations.slug` to a real UNIQUE CONSTRAINT. This is what unblocks `drizzle-kit push` from prompting "Do you want to truncate <table>?" — the prompt fires whenever a live constraint is named differently from what drizzle would emit, and `--force` does NOT dismiss it.
2. **`drizzle-kit push --force`** — applies the schema in `shared/schema.ts` to the database.
3. **`script/check-schema-drift.ts`** — verifies that every column drizzle declares is present in the live DB **and** that every unique constraint / unique index name in `shared/schema.ts` matches `pg_constraint` / `pg_index`. If a legacy `<table>_<column>_key` name re-appears (e.g. after a fresh dump or DB reset), the check exits non-zero with a "rename X to Y" line that points at the alignment table below before any test is allowed to run.

`npm test` runs `script/check-schema-drift.ts --names-only` first and then `script/db-sync.ts` before the test suite. The names-only pre-check fails fast (non-zero exit, with a "rename X to Y" hint and the exact `ALTER TABLE … RENAME CONSTRAINT …` SQL) when a legacy `<table>_<column>_key` name is present, so a fresh dump or DB reset is visible immediately instead of being silently auto-healed by `realign-schema-constraints.ts`. If the names-only check passes, db-sync still reconciles any column-level changes (`drizzle-kit push --force`) before tests start. If you only want to push the schema, `npm run db:push` (which calls plain `drizzle-kit push`) still works on fresh DBs that have never seen the legacy `_key` constraint names — but on a long-lived workspace you should prefer `npx tsx script/db-sync.ts`.

The constraint-name aliases the realign script normalizes (kept here for reference; the script is the source of truth):

| Table | Legacy name | Canonical name |
| --- | --- | --- |
| `businesses` | `businesses_referral_code_key` | `businesses_referral_code_unique` |
| `businesses` | `businesses_founding_member_number_key` | `businesses_founding_member_number_unique` |
| `referrals` | `referrals_referred_business_id_key` | `referrals_referred_business_id_unique` |
| `newsletter_subscribers` | `newsletter_subscribers_unsubscribe_token_key` | `newsletter_subscribers_unsubscribe_token_unique` |
| `review_requests` | `review_requests_token_key` | `review_requests_token_unique` |
| `locations` | partial `UNIQUE INDEX locations_slug_unique WHERE slug IS NOT NULL` | `UNIQUE CONSTRAINT locations_slug_unique` |

Fresh environments don't need any of this — drizzle creates everything from `shared/schema.ts` directly, the realign script is a no-op, and `db-sync` succeeds in one pass.

#### Partial unique indexes

Postgres lets a `UNIQUE INDEX` carry a `WHERE …` predicate so the uniqueness check only applies to a subset of rows. drizzle-kit treats the predicate as part of the index identity: if the database has `WHERE x IS NOT NULL` and the schema declares a bare `uniqueIndex(...)` (or vice-versa), it will report drift on every push and may even prompt to truncate the table. **Whenever you add a partial unique index in Postgres (or discover an existing one), declare it in `shared/schema.ts` with the matching `.where(sql\`…\`)` clause — and conversely, do NOT add a `.where(…)` clause to a bare uniqueIndex unless the live DB actually carries that predicate, because that would itself create drift.**

The audit at the time of writing (task #58) confirmed exactly one partial unique index in the live DB:

| Index | Table | Predicate |
| --- | --- | --- |
| `ai_credit_txn_unique_grant_per_period` | `ai_credit_transactions` | `WHERE grant_period IS NOT NULL` |

Other `uniqueIndex(...)` declarations the task description called out (`newsletter_sub_business_email_idx`, `newsletter_send_campaign_sub_idx`, `sms_sub_business_phone_idx`, `sms_send_campaign_sub_idx`) were verified to be **plain (non-partial) unique indexes** in Postgres — every column they cover is `NOT NULL`, so a `WHERE … IS NOT NULL` predicate would be a no-op and adding one would only create drift. Each of those four declarations carries an inline comment in `shared/schema.ts` documenting that finding so future schema work doesn't get talked into adding a phantom predicate.

To re-run the audit yourself:

```sql
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE indexdef ILIKE '%WHERE%'
   AND schemaname = 'public';
```

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