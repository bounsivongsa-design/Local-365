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
- **Authentication**: Custom email/password + Google OAuth (passport-local, passport-google-oauth20, bcrypt)
- **File Uploads**: Uppy with AWS S3-compatible presigned URLs

### Data Storage
- **Primary Database**: PostgreSQL via Drizzle ORM
- **Key-Value Store**: Replit Database

### Core Features
- **Business Listings**: Includes credentials (LLC, Insurance, Licensed, Veteran), business hours (specific day-by-day or custom text like "Online 24/7"), social media, search keywords, categories, membership tiers, ratings, logos, gallery photos, and promotional videos.
- **Quote System**: Enables customers to request quotes from businesses, with priority based on membership tier.
- **Events**: Comprehensive local events calendar.
- **Job Board**: Businesses can post help wanted ads, sorted by membership tier. Tier-based pricing: Gold $10/wk, Silver $15/wk, Bronze $18/wk, Basic $20/wk.
- **Membership Tiers**: Bronze, Silver, Gold tiers offering varying features and benefits, integrated with Stripe for subscriptions.
- **Advertising**: Tiered advertising models for website and event ads, with member discounts.
- **Business Analytics**: Tracks listing engagement (page views, clicks) for businesses.
- **Quote Messaging**: Customers and businesses can message back and forth within quote threads (`quote_messages` table) with read tracking (`readAt`). Navigation badge shows unread quote message count. No direct messaging between users outside of quotes (spam prevention). Dashboard inbox shows quote message threads only.
- **Contact Admin**: Users can submit messages to admin anytime via "Contact Admin" button in the dashboard inbox. Submissions stored in `admin_submissions` table with status tracking (pending/resolved). Admin can view and respond via `/api/admin/submissions`.
- **Membership Expiration Alerts**: Dashboard banner warns business owners 7 days before free/promo membership expires, with link to subscribe.
- **Promo Codes**: Admin-managed promotional discount codes for various discounts and restrictions.
- **Local Vendor Eligibility**: Policy enforces local-only business listings with verification during signup.
- **Admin Dashboard**: Full admin command center at `/admin` with platform-wide stats (users, businesses, memberships, ads, quotes, jobs, posts, promos), pending approvals alerts, membership breakdown charts, recent activity feeds, and quick-action links.
- **Event Moderation**: Admin event moderation queue at `/admin/events`. Business-submitted events default to "pending" status and require admin approval before appearing on the public calendar. Admins can approve, deny (with optional reason), unpublish, or delete events. Admin-created events auto-approve.
- **Business Verification System**: AI-powered NC Secretary of State registry check during business signup (auto-triggered when LLC is claimed). Document upload for insurance certificates, professional licenses, and veteran documentation. Admin verification review panel with AI check results, uploaded doc review (approve/reject with notes), and direct link to sosnc.gov for manual verification. Tables: `business_verification_checks`, `verification_documents`.

### UI/UX Decisions
- **Design Theme**: Coastal color palette.
- **Component Library**: shadcn/ui (New York style variant) for consistent design.
- **Location Search**: Zillow-style search with geolocation and radius filtering.
- **Badges**: Visual badges for business credentials and membership tiers.

### Technical Implementations
- **Distance Filtering**: Uses Haversine formula with zip code coordinates.
- **Category Management**: Hierarchical categories with community suggestion feature.
- **Stripe Integration**: Handles subscription checkout, webhooks for lifecycle management, and billing portal.
- **Authentication**: Passwords hashed with bcrypt; sessions stored in PostgreSQL. Google OAuth integration, gracefully disabled if not configured.
- **Gold Auto-Upgrade**: New Bronze/Silver members receive 30 days of Gold-tier features.
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