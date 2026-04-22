# Local List 365 - Currituck County Directory

## Overview
Local List 365 is a community-focused platform for Currituck County, NC, connecting residents and visitors with local businesses and events. It features a comprehensive business directory, an event calendar, a quote request system, and AI-powered tools. The platform aims to foster community engagement and support local commerce through tiered advertising, business credentialing, and a job board, ultimately serving as a central hub for local economic and social activity.

## User Preferences
Preferred communication style: Simple, everyday language.
Design theme: Coastal - ocean blue (#0a4a82), sandy beige (#d4a373/#f5f5dc), dune green (#8a9a5b)

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
- **Comp Memberships**: `businesses.isCompedMembership` (+ `compedMembershipNote`, `compedMembershipGrantedAt`, `compedMembershipGrantedBy`) gives a business Gold-equivalent access without any Stripe charge. Honored by every `effectiveTier()` helper across `aiFeatures.ts`, `newsletter.ts`, `social.ts`, `deals.ts`, `reviewRequests.ts`, `sms.ts`, `stripe.ts`, `multiZip.ts`, plus the quote-priority check in `routes.ts`. Granted/revoked from the admin businesses table (Gift "Comp/Uncomp" button) via `POST /api/admin/businesses/:id/comp`; admin-only. Orthogonal to `membershipTier` so it never collides with a real subscription. The admin business PATCH (`/api/admin/businesses/:id`) explicitly excludes `membershipTier` from its STRING_FIELDS whitelist so a routine profile-edit can never accidentally promote/demote a paid plan — tier changes route exclusively through Stripe or the comp endpoint.
- **Review-Request Funnel Linking**: `/api/r/:token` redirects to `/directory/:bizId?reviewToken=…#leave-review` so the review form auto-opens. The `ReviewDialog` captures the token from URL on mount and passes it on submit; the review POST best-effort-updates the originating `review_requests` row to `status='completed'` with `completedReviewId` set (scoped by both `token` AND `businessId` to prevent cross-business tagging). The owner's `/review-requests` History tab shows a "View review" link on completed rows.

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