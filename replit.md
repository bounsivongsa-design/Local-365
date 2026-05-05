# Local List 365 - Currituck County Directory

## Overview
Local List 365 is a community platform for Currituck County, NC, designed to connect residents and visitors with local businesses and events. It provides a comprehensive business directory, an event calendar, a quote request system, and AI-powered tools. The platform aims to bolster local commerce through tiered advertising options, business credentialing, and a job board, establishing itself as a central hub for economic and social activity in the region.

## User Preferences
Preferred communication style: Simple, everyday language.
Design theme: Coastal - ocean blue (#0a4a82), sandy beige (#d4a373/#f5f5dc), dune green (#8a9a5b)
Dev/prod parity: Anything verified in dev must also be verified in production. After deploys, re-check critical flows (auth, Stripe checkout, webhooks, AI features, impersonation, multi-zip, comp memberships) against the published app — production uses different env vars, real Stripe keys, real Resend, and a separate session store, so dev success does NOT guarantee prod success.

## System Architecture

### Frontend
-   **Framework**: React 18 with TypeScript
-   **Styling**: Tailwind CSS with shadcn/ui (New York style variant)
-   **State Management**: TanStack React Query
-   **UI/UX Decisions**: Coastal color palette, shadcn/ui components, Zillow-style location search with geolocation and radius filtering, badges for business credentials and membership tiers. Help Center, onboarding cards, and contextual help hints are integrated for improved user experience.

### Backend
-   **Runtime**: Node.js with Express.js (TypeScript, ESM modules)
-   **API Pattern**: RESTful JSON APIs
-   **Authentication**: Custom email/password + Google OAuth, supporting `customer`, `business`, and `admin` account types. Bcrypt for password hashing, PostgreSQL for session storage.
-   **File Uploads**: Uppy with AWS S3-compatible presigned URLs

### Data Storage
-   **Primary Database**: PostgreSQL via Drizzle ORM
-   **Key-Value Store**: Replit Database

### Core Features
-   **Business Listings**: Detailed profiles, categories, ratings, and media.
-   **Quote System**: Facilitates customer quote requests and business responses.
-   **Events Platform**: Calendar with Stripe payment for event advertising.
-   **Job Board**: Businesses can post help-wanted ads based on membership tier.
-   **Membership Tiers**: Bronze, Silver, Gold tiers with varying features, managed via Stripe subscriptions, including additional zip-code listings. The Gold tier provides an AI Tools suite.
-   **Advertising**: Carousel banner ads with tiered pricing, an in-browser ad designer, and inline creation from the dashboard. Ads utilize `object-contain` for full image visibility and dynamic sizing.
-   **Business Analytics**: Tracks engagement metrics for listings.
-   **Review System**: Customer reviews with optional proof of service and business responses, including a review-request funnel.
-   **Admin Dashboard**: Control center for platform management, user/business oversight, content moderation, and per-zip activity statistics. Includes "Sign in as" (impersonation) for support, tools for managing comp memberships and referral overrides, and a "Traffic" analytics tab (requests-over-time line chart, top URLs, top referrers, HTTP status breakdown, request duration histogram, unique IP count) backed by an in-app `request_logs` table populated by the express middleware (auto-pruned at 30 days).
-   **AI Lab**: Admin-only sandbox for developing Gold-exclusive AI features, integrated with an AI credit system.
-   **Growth Features**: "Founding Urgency Banner" and "Refer-a-Business" program, with manual Stripe credit issuance for referrals.
-   **AI-Powered Tools (Gold-exclusive)**: A suite of AI tools for content generation, including listing descriptions, review replies, quote responses, help wanted ads, event descriptions, photo captions/alt-text, daily deals, SMS broadcasts, social media posts, and email newsletters with open/click tracking.
-   **Technical Implementations**: Utilizes the Haversine formula for distance filtering, hierarchical category management, and Stripe integration for all payment and subscription services. Founder/admin bypass rules are centrally managed for charges and AI credits. Newsletter send-error hardening ensures robust email delivery. Founding Member badge and roster management is also included.

## External Dependencies

### Third-Party Services
-   **Supabase**: Client SDK for database interaction.
-   **OpenAI**: AI chat integration via Replit AI Integrations proxy.
-   **Replit Object Storage**: For file uploads.
-   **Stripe**: Payment processing.
-   **Resend**: Email notifications.
-   **Twilio**: SMS service (planned integration).

### Key NPM Packages
-   **UI Components**: Radix UI primitives, FullCalendar.
-   **Database**: `drizzle-orm`, `pg`.
-   **Validation**: `zod`, `drizzle-zod`.
-   **Date Handling**: `date-fns`.