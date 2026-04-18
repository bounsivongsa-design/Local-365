# Local List 365 - Currituck County Directory

## Overview
Local List 365 is a community-focused local business directory and events platform for Currituck County, NC. Its purpose is to connect residents and visitors with local businesses, service providers, and community events. Key capabilities include a comprehensive business directory, an event calendar, a quote request system, and an AI-powered chatbot. The platform aims to foster community engagement and support local commerce through features like tiered advertising, business credentialing, and a job board.

## User Preferences
Preferred communication style: Simple, everyday language.
Design theme: Coastal - ocean blue (#0a4a82), sandy beige (#d4a373/#f5f5dc), dune green (#8a9a5b)

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui (New York style variant)
- **State Management**: TanStack React Query

### Backend
- **Runtime**: Node.js with Express.js (TypeScript, ESM modules)
- **API Pattern**: RESTful JSON APIs (`/api` prefix)
- **Authentication**: Custom email/password + Google OAuth, supporting `customer`, `business`, and `admin` account types. Admin accounts are seeded and not available for UI creation.
- **File Uploads**: Uppy with AWS S3-compatible presigned URLs

### Data Storage
- **Primary Database**: PostgreSQL via Drizzle ORM
- **Key-Value Store**: Replit Database

### Core Features
- **Business Listings**: Detailed profiles including credentials, operating hours, social media, keywords, categories, membership tiers, ratings, and media.
- **Quote System**: Allows customers to request quotes from businesses, with businesses able to respond with messages or formal quotes. All communication occurs within the platform.
- **Events Platform**: A local events calendar with Stripe payment integration for business-submitted event ads. Admin-created events are free and auto-approved.
- **Job Board**: Businesses can post help-wanted ads, with pricing based on membership tier.
- **Membership Tiers**: Bronze, Silver, Gold tiers with varying features, managed via Stripe subscriptions. Only businesses with active memberships appear in the public directory.
- **Advertising**: Carousel banner ads on Home and Directory pages, with tiered pricing and member discounts. An in-browser ad designer tool is available for creating ad images.
- **Business Analytics**: Tracks engagement metrics for business listings.
- **Review System**: Proof of service (receipt, invoice, email, etc.) is optional but earns a "Verified" badge. Business owners can confirm or dispute reviews. Verification statuses: `unverified`, `proof_submitted`, `business_confirmed`, `business_disputed`.
- **Review Owner Responses**: Businesses can post a single reply to customer reviews.
- **Contact Admin System**: Users can send messages to admins, with submissions stored and tracked.
- **Membership Expiration Alerts**: Notifies businesses before free/promo memberships expire.
- **Promo Codes**: Admin-managed codes for discounts or temporary Gold-tier access.
- **Tier-Locked Feature Greying**: Displays unavailable features with upgrade prompts based on membership tier.
- **Local Vendor Eligibility**: Policy ensures only local businesses are listed, with AI-powered verification checks for LLCs and document uploads for other credentials.
- **Password Reset**: Secure token-based password reset flow with email delivery via Resend. Tokens expire after 1 hour. Pages: `/forgot-password` and `/reset-password?token=...`.
- **Admin Dashboard**: A comprehensive control center for platform management, user/business oversight, content moderation, and analytics.
- **AI Lab (sandbox)**: Admin-only page at `/admin/ai-lab` for incubating the Gold-exclusive AI Suite. Phase 1A ships a credit system foundation: `ai_credit_packs` (4 SKUs at $10/$25/$75/$200), per-business `ai_credits` balance with monthly allowance, and an `ai_credit_transactions` ledger. Idempotent monthly grants (unique index on `business_id, type, grant_period`), atomic balance/ledger writes (DB transactions), unique `stripe_payment_intent_id` for Phase 1B safety. Founder businesses (Goat Locker Printing, Blackwater Technology Solutions) auto-flagged `is_founder_comp = true`. Admin endpoints under `/api/admin/ai-lab/*` (packs, balances, transactions, revenue, adjust, run-monthly-grant). Customer-facing flows untouched.
- **Growth Marketing Surface (Public)**: Homepage `<GrowthPromoSection>` (rendered after the AdCarousel) advertises both growth perks to logged-out visitors with a live "X/100 founding spots claimed" progress bar fed by `GET /api/public/founding-stats` (auth-free, returns only `{limit, claimed, remaining}` — no PII). Companion CTA pushes visitors to `/membership`. Section auto-flips copy from "Claim Your Founding Spot" → "Join the Directory" once the 100-slot roster fills.
- **Founding Urgency Banner (site-wide)**: Slim `<FoundingUrgencyBanner>` mounted above `<Navigation>` in `App.tsx`, shown on all public pages but auto-hidden on conversion/admin/auth/dashboard routes (`/membership`, `/create-business`, `/admin*`, `/dashboard`, `/account-setup`, `/edit-listing`, `/auth`). Reuses `/api/public/founding-stats`. Only renders when `claimed >= 1` AND `remaining > 0` (avoids a "0 of 100 spots left" cold-start mood and disappears once full). Switches from coastal-blue to amber-urgency styling when ≤25% of seats remain (or ≤10, whichever is greater). Dismissible via X button — preference persisted in localStorage (`ll365_founding_banner_dismissed`) and cross-tab synced via `storage` event.
- **Referral Reward Emails**: When `processMembershipActivation()` commits a referral reward (after the DB transaction), `notifyReferralRewarded()` (server/email.ts) sends two parallel Resend emails — one congratulating the referrer ("+30 days of Gold — thanks for the referral!") and one welcoming the referee ("Welcome bonus: +30 days of Gold on us"). Both emails are best-effort (`Promise.allSettled` + try/catch); a Resend outage never rolls back the reward. Skipped silently if `RESEND_API_KEY` is unset.
- **Refer-a-Business + Founding Members (Growth)**: Every business gets a unique `referralCode` (auto-issued at signup, format `REF-XXXXXX`). Signup form accepts a referral code (visible field at last step + automatic capture of `?ref=CODE` from URL via `use-referral-capture.ts`, persisted in localStorage with 30-day TTL to survive Stripe checkout). On paid-membership activation, `processMembershipActivation()` (server/referrals.ts) runs idempotently from createBusiness route + 5 stripe.ts entry points (verify-session, webhook, founder bypass): atomically assigns the next `foundingMemberNumber` (1-100, locked in for life) via SQL CTE, finds any pending referral, and extends `goldTrialEndDate` by 30 days for BOTH referrer and referee. Reuses existing `getEffectiveTier()` Gold-window logic so rewards expire cleanly. Referral state lives in `referrals` table (unique on `referredBusinessId` prevents double-rewards). Dashboard shows `<ReferAndEarnCard>` with code, copy-link button, native share, rewarded/pending/Gold-days counters, and Founding Member badge. `<FoundingMemberBadge>` renders on BusinessCard + BusinessDetails. Admin "Growth" tab (`/api/admin/referrals/stats`) shows totals, founding roster (X/100 progress bar), and top-referrers leaderboard. No business-funded customer discounts (saved for loyalty program).
- **AI Credit Promo Codes**: Admins (Doug/Nick) can mint `discount_type='ai_credits'` codes from the AI Lab Credits tab to hand out free credits to anyone — including non-Gold members — for testing. Reuses the existing `promo_codes` + `promo_code_usages` tables; redemption is idempotent per `(promo_code_id, business_id)` and runs in a single DB transaction (balance update + `promo_grant` ledger entry + usage row + counter bump). Endpoints: `GET/POST /api/admin/ai-lab/promo-codes`, `PATCH /api/admin/ai-lab/promo-codes/:id`, `POST /api/admin/ai-lab/promo-codes/redeem`. Self-serve member redemption UI deferred until Phase 1B AI features ship.

### UI/UX Decisions
- **Design Theme**: Coastal color palette.
- **Component Library**: shadcn/ui (New York style variant) for consistent design.
- **Location Search**: Zillow-style search with geolocation and radius filtering.
- **Badges**: Visual badges for business credentials and membership tiers.

### Technical Implementations
- **Distance Filtering**: Uses Haversine formula for location-based searches.
- **Category Management**: Hierarchical categories with community suggestion. Dashboard edit form supports primary + additional category editing with tier-based limits enforced both client-side and server-side.
- **Stripe Integration**: Handles subscriptions, payments, and webhooks.
- **Authentication**: Bcrypt for password hashing, PostgreSQL for session storage, and Google OAuth.
- **Gold Auto-Upgrade**: New Bronze/Silver members automatically receive 30 days of Gold-tier features.
- **Admin Delete Business**: Provides a dedicated route for complete business and associated data removal.
- **Session Verification**: Ensures secure handling of pending memberships post-Stripe checkout.
- **Uniqueness Constraints**: Prevents duplicate business registrations.
- **Business Hours Format**: Flexible JSON structure for specific daily hours or custom text.
- **Max Quotes**: Configurable limit on quotes received per request, with auto-closure.
- **Ad Preview Popup**: Interactive modal for viewing ad details and tracking outbound clicks.
- **Ad Slot Filling**: Fills empty ad slots with placeholder examples to maintain layout.
- **Image Cropper**: Reusable component for image cropping and resizing with aspect ratio enforcement.
- **Ad Designer**: In-browser tool for designing ads with customizable elements. Size-matched canvases: Large=1200×675 (16:9), Medium=1200×540 (20:9), Small=1200×500 (12:5). Each canvas matches the exact carousel display ratio — no cropping.
- **Events Calendar Display**: Events appear on the calendar only on their specified event date, with ad package duration controlling visibility.

## External Dependencies

### Third-Party Services
- **Supabase**: Client SDK for database interaction.
- **OpenAI**: AI chat integration via Replit AI Integrations proxy.
- **Replit Object Storage**: For file uploads.
- **Stripe**: Payment processing.
- **Resend**: Email notifications for administrative alerts.

### Key NPM Packages
- **UI Components**: Radix UI primitives, FullCalendar.
- **Database**: `drizzle-orm`, `pg`.
- **Validation**: `zod`, `drizzle-zod`.
- **Date Handling**: `date-fns`.