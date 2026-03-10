# Local List 365 - Currituck County Directory

## Overview
Local List 365 is a community-focused local business directory and events platform for Currituck County and the Outer Banks (OBX) region of North Carolina. It connects visitors and residents with local businesses, service providers, events, and community features including a quote request system, and an AI-powered chatbot assistant named "Ziggy." The platform aims to be a comprehensive local resource, facilitating community engagement and supporting local commerce through features like tiered advertising and business credentialing.

## User Preferences
Preferred communication style: Simple, everyday language.
Design theme: Coastal - ocean blue (#0a4a82), sandy beige (#d4a373/#f5f5dc), dune green (#8a9a5b)

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: React Router DOM
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS with shadcn/ui (New York style variant)
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful JSON APIs (`/api` prefix)
- **Authentication**: Replit Auth with session management
- **File Uploads**: Uppy with AWS S3-compatible presigned URLs

### Data Storage
- **Primary Database**: PostgreSQL via Drizzle ORM
- **Key-Value Store**: Replit Database for simple key-value needs

### Key Database Tables
- `users`: Stores user accounts with `accountType` (loyalty columns still in DB but feature is deferred).
- `businesses`: Manages business listings with credentials (`hasLLC`, `hasInsurance`, `isLicensed`, `establishedYear`, `establishedZipCode`, `servicesCommercial`, `servicesResidential`), membership tiers, and ratings.
- `quoteRequests`: Handles customer project requests.
- `quotes`: Stores business bids on customer projects.
- `events`: Contains local events calendar data.
- `posts`: Stores community feed posts.
- `categoryRequests`: Stores community-submitted category suggestions (name, description, submitterEmail, status).

### Authentication System
Replit Auth manages user identity. Session data is stored in PostgreSQL. The system supports "customer" and "business" account types, with server-side validation and receipt upload requirements for user verification.

### Business Membership Tiers
- **Bronze** ($50/mo): Basic listing, 3 photos, 1 category, 10% ad discount
- **Silver** ($100/mo): Logo, website link, 10 photos, 3 categories, 25% ad discount, verified badge
- **Gold** ($200/mo): Featured placement, unlimited photos, 5 categories, 50% ad discount, priority support, 30-sec promo video upload
- DB stores as `basic`/`standard`/`premium`; displayed as Bronze/Silver/Gold

### UI/UX Decisions
- **Design Theme**: Coastal color palette.
- **Component Library**: shadcn/ui (New York style variant) for a consistent design system.
- **Location Search**: Zillow-style search with geolocation and radius filtering.
- **Content Organization**: Dynamic content updates based on selected location; categorized listings and event displays.
- **Advertising**: Tiered advertising models with 4-column pricing grids (Non-Member, Bronze, Silver, Gold).
- **Business Credentials**: Visual badges for LLC, Licensed, Insured, membership tier, and service types (Commercial/Residential).

### Technical Implementations
- **Distance Filtering**: Utilizes Haversine formula with zip code coordinate lookup (`client/src/lib/zip-coordinates.ts`). Businesses with unknown zip codes are excluded when radius filter is active.
- **Category Management**: 47+ categories with community-driven category suggestions via `POST /api/category-requests`.
- **Tiered Systems**: Implemented for advertising and business memberships.
- **Quote System**: Priority queue for businesses based on membership tier and ratings.

### Key Configuration Files
- `shared/config/categories.ts`: Full category hierarchy with subcategories (30+ top-level categories)
- `shared/config/membership.ts`: Membership tiers, pricing, payment frequencies, service areas, ad discount rates

### Key Components
- `TrustBadges`: Displays LLC, Insurance, Licensed badges (compact and full variants)
- `MembershipBadge`: Shows Bronze/Silver/Gold membership badge
- `BusinessCard`: Card with image, category, rating, trust badges, membership badge
- `LocationPicker`: Zillow-style location search dialog with geolocation support
- `EventCard`: Event display with date, location, and details
- `PromoVideoPlayer`: Displays uploaded promo video with Gold Exclusive badge (BusinessDetails.tsx)
- `PromoVideoUploader`: Upload/replace/delete promo video, Gold tier owners only (BusinessDetails.tsx)

## External Dependencies

### Third-Party Services
- **Supabase**: Client SDK for database interaction.
- **OpenAI**: AI chat integration via Replit AI Integrations proxy.
- **Replit Object Storage**: For file uploads (e.g., receipts).
- **Open-Meteo**: For local weather data.

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

## Deferred Features (For Future Implementation)

### Customer Loyalty / Elite Status Program
**Status**: Removed from active UI and backend routes. DB columns preserved. Code files preserved but disconnected.

**Dual Status System**:
- **Annual Status**: Resets yearly, based on annual visits, points, or spend
- **Lifetime Status**: Accumulates indefinitely, based on total visits, points, or spend
- The effective tier is the higher of annual or lifetime status

**Customer Tiers**: Member → Silver Elite → Gold Elite → Platinum Elite → Ambassador
- **Member**: 1x points, basic access
- **Silver**: 1.1x points, priority scheduling, birthday deals (10 visits OR 25K pts annual)
- **Gold**: 1.25x points, first dibs on services, featured reviewer badge (25 visits OR 50K pts annual)
- **Platinum**: 1.5x points, 5% off at partners, free upgrades (50 visits OR 100K pts annual)
- **Ambassador**: 1.75x points, 10% off at partners, invite-only events (100 visits AND $20K spend annual)

**DB Columns Still Present** (users table):
- Annual: `annual_points`, `annual_visits`, `annual_spent`, `annual_tier`, `status_year`
- Lifetime: `lifetime_points`, `lifetime_visits`, `lifetime_spent`, `lifetime_tier`
- Legacy: `loyalty_points`, `loyalty_tier`
- Badges: `engagement_badge`
- Business partner perks: `is_local365_partner`, `silver_perk`, `gold_perk`, `platinum_perk`, `ambassador_perk`

**Preserved Code Files** (not imported/routed, but available):
- `shared/loyalty.ts`: Core tier logic, calculations, formatting
- `client/src/pages/LoyaltyTiers.tsx`: Marketing/info page for the program
- `client/src/components/LoyaltyBadges.tsx`: Dashboard component for viewing progress

**To Re-enable**: Re-add `/loyalty` route in App.tsx, re-add nav item in Navigation.tsx, re-add loyalty badge in CommunityFeed.tsx, re-add backend routes in server/routes.ts (`/api/loyalty-badges`, `/api/user/profile`, `/api/user/loyalty/add-points`), re-add point awarding in quote request creation.
