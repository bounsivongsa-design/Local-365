# Local List 365 - Currituck County Directory

## Overview

Local List 365 is a community-focused local business directory and events platform for Currituck County and the Outer Banks (OBX) region of North Carolina. The application connects visitors and residents with local businesses, service providers, events, and community features including a customer elite status loyalty program, quote request system, and AI-powered chatbot assistant named "Ziggy."

Key features include:
- Business directory with 26 categories, ratings, and reviews
- Local events calendar
- Quote/bid system connecting customers with service providers
- User validation through receipt uploads
- Elite Status loyalty program for customers (Member → Silver → Gold → Platinum → Ambassador)
- AI chatbot "Ziggy" for local recommendations
- Community feed with posts and engagement
- Account types: Customer and Business with distinct features

## Recent Changes

### February 2026
- **Location-Based Search**: Scalable location system for expanding to multiple regions
  - LocationPicker component in navigation header for selecting city/zip/region
  - Location context stores user's selected location in localStorage
  - Homepage dynamically updates hero text and content based on selected location
  - API endpoints: /api/locations, /api/locations/search, /api/businesses/by-location, /api/events/by-location
  - Database fields: city, state, zipCode added to businesses and events tables
  - Locations table stores supported regions with zipCodes array
- **Loyalty Program Redesign**: Local 365 dual elite status system
  - **Dual Status System**: Annual status (resets yearly) + Lifetime status (accumulates forever)
  - Effective tier is the HIGHER of annual or lifetime status
  - 5 tiers: Member (free), Silver Elite, Gold Elite, Platinum Elite, Ambassador
  - Annual requirements: 10/25/50/100 visits OR 25k/50k/100k/200k points per year
  - Lifetime requirements: 100/250/500/1000 visits OR 250k/500k/1M/2M points total
  - Point multipliers (+10% to +75% bonus) instead of heavy discounts
  - Discounts only at top tiers (5% at Platinum, 10% at Ambassador)
  - Status reversion: If you don't re-qualify annually, you fall back to lifetime status
  - Dev mode panel for testing customer/business account types
- **Quote/Bid System with Priority Queue**: Customers post project requests, businesses submit competitive quotes
  - Business accounts see customer ratings, projects completed, and total spent on each request
  - Helps businesses assess customer reliability before bidding
  - **Priority Access System**: Premium/Standard/Basic tier businesses get first access to quote requests
    - Top 5 businesses per round get priority access with customer contact info (phone/email)
    - Sorted by: membership tier (Premium > Standard > Basic), then by averageRating, then reviewCount
    - Emergency categories (HVAC, Electrical, Plumbing, Roofing) = 2-hour response window
    - Standard categories = 24-hour response window
    - When priority window expires, next batch of 5 businesses get access
  - **Vendor Response Metrics**: Track vendor response times and reliability
    - Database table: vendorMetrics tracks totalAssignments, responsesOnTime, responsesLate, noResponses
    - Response rating (0-5) calculated based on on-time response percentage
    - Low-rated customer exemption: vendors not penalized for slow responses to customers rated below 3.0
    - API endpoints: /api/vendors/metrics, /api/my-business/metrics
- **Local 365 Partner Program**: Businesses can offer exclusive perks to elite members
  - Database fields: isLocal365Partner, silverPerk, goldPerk, platinumPerk, ambassadorPerk
  - BusinessCard shows "Local 365 Partner" badge for participating businesses
  - BusinessDetails page shows tier-specific perks with styled cards
  - Example perks: "Local rates for golf", "Free appetizer", "Priority scheduling"
- **Animated Video Logo**: Header now displays animated video logo
- **Account Type System**: Customer vs Business accounts with server-side validation
- **Paid Advertising System**: Businesses can purchase ad placements
  - 4 placement types: Homepage Banner ($99/wk), Featured Listing ($49/wk), Category Spotlight ($29/wk), Directory Boost ($19/wk)
  - Business UI at /advertising for requesting ad placements
  - Admin UI at /admin/ads for reviewing and approving ads (requires isAdmin flag)
  - AdBanner component displays active ads on homepage and directory
  - Tracks impressions and clicks for analytics
  - Manual payment workflow (pending → paid → active)
  - Server-side price validation (ignores client-provided prices)
- **Business Credentials & Trust Badges**: Visual indicators for LLC and insurance status
  - Database fields: hasLLC, hasInsurance on businesses table
  - TrustBadges component with compact (cards) and full (details) variants
  - Badge types: "Verified" (both), "LLC" (registered only), "Insured" (insurance only), "Unverified" (neither)
  - BusinessCard shows compact trust badge on each listing
  - BusinessDetails shows full Business Credentials section with warnings for unverified businesses
  - Helps customers identify legitimate businesses vs "shade tree" operators
- **Business Membership Tiers**: Paid membership levels for business visibility
  - 3 tiers: Basic ($50/mo), Standard ($100/mo), Premium ($200/mo)
  - Basic: Business listing with phone and reviews
  - Standard: + Logo and website link
  - Premium: + Top of list placement based on reviews
  - Payment options: Monthly (1st month free for new), Semi-Annual (20% off), Annual (45% off)
  - Database fields: membershipTier, membershipPaymentFrequency, membershipStartDate, membershipEndDate, membershipTrialUsed, phone, websiteUrl, logoUrl
  - MembershipBadge component displays tier on business cards and details
  - BusinessDetails shows phone/website when available
  - Advertising page shows member discount (50% off) promotion
  - Member advertising rates: Small $250, Medium $500, Large $1000 (vs non-member $500/$1000/$2000)
  - 2-week event ads: Member $150/$300/$600 (vs non-member $300/$600/$1200)

## User Preferences

Preferred communication style: Simple, everyday language.
Design theme: Coastal - ocean blue (#0a4a82), sandy beige (#d4a373/#f5f5dc), dune green (#8a9a5b)

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: React Router DOM for client-side navigation
- **State Management**: TanStack React Query for server state caching and synchronization
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style variant)
- **Forms**: React Hook Form with Zod schema validation
- **Build Tool**: Vite with custom path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful JSON APIs under /api prefix
- **Authentication**: Replit Auth integration with session management
- **File Uploads**: Uppy with AWS S3-compatible presigned URLs

### Data Storage
- **Primary Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: shared/schema.ts and shared/models/
- **Migrations**: Drizzle Kit with migrations stored in /migrations
- **Key-Value Store**: Replit Database for simple key-value needs (categories, best-of data)

### Key Database Tables
- `users`: User accounts with accountType (customer/business), loyaltyPoints, loyaltyTier
- `businesses`: Business listings with categories, ratings, reviews
- `quoteRequests`: Customer project requests for quotes
- `quotes`: Business bids on customer projects
- `events`: Local events calendar
- `posts`: Community feed posts

### Authentication System
- Replit Auth handles user identity
- Session storage in PostgreSQL (sessions table)
- User accounts support two types: "customer" and "business"
- Validation system requires proof-of-purchase receipt uploads
- Server-side account type validation on quote endpoints

### Loyalty Program Structure (Dual Status - Local 365)

**Annual Status** (resets Jan 1):
| Tier | Annual Visits | Annual Points | Points Bonus | Discount |
|------|---------------|---------------|--------------|----------|
| Member | Free | Free | 10 pts/$1 | None |
| Silver Elite | 10 | 25,000 | +10% | None |
| Gold Elite | 25 | 50,000 | +25% | None |
| Platinum Elite | 50 | 100,000 | +50% | 5% off |
| Ambassador | 100 | 200,000 | +75% | 10% off |

**Lifetime Status** (never resets):
| Tier | Lifetime Visits | Lifetime Points |
|------|-----------------|-----------------|
| Member | Free | Free |
| Silver Elite | 100 | 250,000 |
| Gold Elite | 250 | 500,000 |
| Platinum Elite | 500 | 1,000,000 |
| Ambassador | 1,000 | 2,000,000 |

Your effective tier is the HIGHER of your annual or lifetime status. If you don't re-qualify annually, you fall back to your lifetime tier.

## External Dependencies

### Third-Party Services
- **Supabase**: Client SDK configured (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- **OpenAI**: AI chat integration via Replit AI Integrations proxy
- **Replit Object Storage**: File storage for receipts and uploads
- **Weather API**: Open-Meteo for local weather data

### Key NPM Packages
- **UI Components**: Full Radix UI primitive set, FullCalendar for events
- **Database**: drizzle-orm, pg (PostgreSQL client)
- **Validation**: zod, drizzle-zod
- **Date Handling**: date-fns
- **HTTP Client**: Built-in fetch, axios available

### Environment Variables Required
- DATABASE_URL: PostgreSQL connection string
- AI_INTEGRATIONS_OPENAI_API_KEY: OpenAI API access
- AI_INTEGRATIONS_OPENAI_BASE_URL: OpenAI proxy URL
- SESSION_SECRET: Session encryption key
- DEFAULT_OBJECT_STORAGE_BUCKET_ID: Object storage bucket
