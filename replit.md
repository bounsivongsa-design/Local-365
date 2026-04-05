# Local List 365 - Currituck County Directory

## Overview
Local List 365 is a community-focused local business directory and events platform exclusively for Currituck County, North Carolina. It connects visitors and residents with local businesses, service providers, events, and community features, including a quote request system and an AI-powered chatbot assistant named "Ziggy." The platform aims to be a comprehensive local resource, facilitating community engagement and supporting local commerce through features like tiered advertising and business credentialing, covering various Currituck County communities.

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
- **Authentication**: Custom email/password + Google OAuth (passport-local, passport-google-oauth20, bcrypt). Three account types: `customer`, `business`, `admin`. Admin accounts are seeded on startup for designated emails; admin creation is NOT available through any UI — only via direct database or code changes.
- **File Uploads**: Uppy with AWS S3-compatible presigned URLs

### Data Storage
- **Primary Database**: PostgreSQL via Drizzle ORM
- **Key-Value Store**: Replit Database

### Core Features
- **Business Listings**: Includes credentials (LLC, Insurance, Licensed, Veteran), business hours (specific day-by-day or custom text like "Online 24/7"), social media, search keywords, categories, membership tiers, ratings, logos, gallery photos, and promotional videos.
- **Quote System**: Enables customers to request quotes from businesses, with priority based on membership tier.
- **Events**: Comprehensive local events calendar.
- **Job Board**: Businesses can post help wanted ads, sorted by membership tier. Membership required. Tier-based pricing: Gold $10/wk, Silver $15/wk, Bronze $18/wk.
- **Membership Tiers**: Bronze, Silver, Gold tiers offering varying features and benefits, integrated with Stripe for subscriptions. New signup flow: Register → Choose plan & pay on /membership (CC required) → Create business listing on /create-business → Dashboard. Pending membership stored on user record until business is created, then transferred.
- **Directory Visibility**: Only businesses with active membership (tier != "none") appear in the public directory. Example/seed businesses always visible. Cancellation removes from directory when tier resets to "none".
- **Cancellation Handling**: Dashboard shows cancellation warning banner with removal date. Stripe webhook handles tier reset on subscription cancellation.
- **Advertising**: Carousel banner ads displayed on Home page and Directory page in three sizes (Large, Medium, Small). Tiered pricing with member discounts (Gold 50%, Silver 25%, Bronze 10%). Stripe stale customer recovery: validates stored customer IDs before use, auto-creates new ones if stale.
- **Business Analytics**: Tracks listing engagement (page views, clicks) for businesses.
- **Review Owner Responses**: Business owners can post a single reply to each customer review on their listing. Responses are shown below the review with "Owner Response" label, timestamp, and business icon. One response per review, max 1000 characters, stored in `ownerResponse` and `ownerResponseDate` columns on the reviews table.
- **Quote Messaging**: Customers and businesses can message back and forth within quote threads (`quote_messages` table) with read tracking (`readAt`). Navigation badge shows unread quote message count. No direct messaging between users outside of quotes (spam prevention). Dashboard inbox shows quote message threads only.
- **Contact Admin**: Users can submit messages to admin anytime via "Contact Admin" button in the dashboard inbox. Submissions stored in `admin_submissions` table with status tracking (pending/resolved). Admin can view and respond via `/api/admin/submissions`.
- **Membership Expiration Alerts**: Dashboard banner warns business owners 7 days before free/promo membership expires, with link to subscribe.
- **Promo Codes**: Admin-managed promotional codes. Types: (1) percentage/fixed discount codes for Stripe checkout, (2) `gold_trial` codes that directly grant Gold-tier access for 30 or 60 days. Gold trial codes are redeemed from the business Dashboard (not at checkout). When a gold trial expires, the business reverts to their previous tier via `checkExpiredGoldTrials()` background job. Schema: `promoCodes.durationDays` stores trial length; `businesses.goldTrialEndDate` and `businesses.originalMembershipTier` track active trials.
- **Tier-Locked Feature Greying**: Dashboard shows tier-locked features (promo video upload, photo gallery) as greyed-out cards with upgrade prompts instead of hiding them. Promo video = Gold exclusive; gallery = Silver+.
- **Local Vendor Eligibility**: Policy enforces local-only business listings with verification during signup.
- **Admin Account System**: Dedicated "admin" account type (alongside "customer" and "business"). Admin accounts skip business/membership flows and go straight to admin dashboard. Admin accounts are seeded on startup for `boun.sivongsa@gmail.com` and `locallist365@gmail.com`. Admins CANNOT be created or promoted via any UI — only through code/database. The old `isAdmin` boolean flag is deprecated; all checks use `accountType === "admin"`. Navigation shows "Admin" link for admin accounts.
- **Admin Dashboard**: Full admin command center at `/admin` with platform-wide stats (users, businesses, memberships, ads, quotes, jobs, posts, promos), pending approvals alerts, membership breakdown charts, recent activity feeds, and quick-action links.
- **Event Moderation**: Admin event moderation queue at `/admin/events`. Business-submitted events default to "pending" status and require admin approval before appearing on the public calendar. Admins can approve, deny (with optional reason), unpublish, or delete events. Admin-created events auto-approve.
- **Business Verification System**: AI-powered NC Secretary of State registry check during business signup (auto-triggered when LLC is claimed). Document upload for insurance certificates, professional licenses, and veteran documentation. Admin verification review panel with AI check results, uploaded doc review (approve/reject with notes), and direct link to sosnc.gov for manual verification. Tables: `business_verification_checks`, `verification_documents`.

### UI/UX Decisions
- **Design Theme**: Coastal color palette.
- **Component Library**: shadcn/ui (New York style variant) for consistent design.
- **Location Search**: Zillow-style search with geolocation and radius filtering.
- **Badges**: Visual badges for business credentials and membership tiers.

### Deployment Rule
- **Any schema or code changes made in dev MUST be republished to production to stay in sync, unless the user explicitly says not to.** Always republish after making changes — never assume production has the latest schema or code. Verify prod schema matches dev before considering work complete.

### Technical Implementations
- **Distance Filtering**: Uses Haversine formula with zip code coordinates.
- **Category Management**: Hierarchical categories with community suggestion feature.
- **Stripe Integration**: Handles subscription checkout, webhooks for lifecycle management, and billing portal.
- **Authentication**: Passwords hashed with bcrypt; sessions stored in PostgreSQL. Google OAuth integration, gracefully disabled if not configured.
- **Gold Auto-Upgrade**: New Bronze/Silver members receive 30 days of Gold-tier features. Gold trial metadata (goldTrialEndDate, originalMembershipTier) is retrieved from Stripe subscription during business creation when transferring pending membership. Stripe product name shows the original tier (e.g., "Bronze Membership") with " — Gold Trial" suffix, not "Gold Membership".
- **Admin Delete Business**: Dedicated `DELETE /api/admin/businesses/:businessId` route with full cascading cleanup and Stripe subscription cancellation. Available via trash icon in admin Businesses tab.
- **Session Verification**: Both `/membership` and `/create-business` pages call `POST /api/stripe/verify-session` on redirect from Stripe checkout. The verify-session endpoint handles new users (no business yet) by storing pending membership tier on the user record, with auth check ensuring session userId matches authenticated user.
- **Uniqueness Constraints**: Prevents duplicate business registrations by name and zip code.
- **Downgrade Tracking**: Records membership downgrades for win-back campaigns.
- **Business Hours Format**: Stored as JSON in `businessHours` column. Two modes: `{ _mode: "specific", Monday: { open, close, closed }, ... }` for day-by-day, or `{ _mode: "text", _note: "..." }` for custom text. Legacy data without `_mode` treated as specific.
- **Max Quotes**: Quote requests support `maxQuotes` (5, 10, or null/unlimited) and `receivedQuotesCount`. Request auto-closes when limit is reached. One quote per business per request enforced.

### Future: Multi-Zip-Code Expansion
- Currently single zip code (27958 Moyock). Each business tied to one zip.
- Expansion approach: "service areas" model where a business profile stays in one place but can select additional zip codes they serve.
- Key decisions needed before building: membership scope per zip, ad pricing per zip, quote routing across areas, area selector UX.
- Existing Moyock data will not be affected — expansion is additive.
- Estimated effort: 2-3 sessions once business rules are decided.

## External Dependencies

### Third-Party Services
- **Supabase**: Client SDK for database interaction.
- **OpenAI**: AI chat integration via Replit AI Integrations proxy.
- **Replit Object Storage**: For file uploads.
- **Open-Meteo**: For local weather data.
- **Stripe**: Payment processing for subscriptions and one-time purchases.

### Key NPM Packages
- **UI Components**: Radix UI primitives, FullCalendar.
- **Database**: `drizzle-orm`, `pg`.
- **Validation**: `zod`, `drizzle-zod`.
- **Date Handling**: `date-fns`.

### Environment Variables Required
- `DATABASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `SESSION_SECRET`
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID`
- `GOOGLE_CLIENT_ID` (optional, for Google OAuth)
- `GOOGLE_CLIENT_SECRET` (optional, for Google OAuth)
- `Stripeintegration` (Stripe Secret Key)
- `Stripepublishable` (Stripe Publishable Key)