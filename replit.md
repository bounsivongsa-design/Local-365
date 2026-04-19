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

### Backend
- **Runtime**: Node.js with Express.js (TypeScript, ESM modules)
- **API Pattern**: RESTful JSON APIs (`/api` prefix)
- **Authentication**: Custom email/password + Google OAuth, supporting `customer`, `business`, and `admin` account types.
- **File Uploads**: Uppy with AWS S3-compatible presigned URLs

### Data Storage
- **Primary Database**: PostgreSQL via Drizzle ORM
- **Key-Value Store**: Replit Database

### Core Features
- **Business Listings**: Detailed profiles including credentials, operating hours, social media, keywords, categories, membership tiers, ratings, and media.
- **Quote System**: Enables customers to request quotes and businesses to respond within the platform.
- **Events Platform**: Local events calendar with Stripe payment integration for business-submitted event ads.
- **Job Board**: Businesses can post help-wanted ads based on membership tier.
- **Membership Tiers**: Bronze, Silver, Gold tiers with varying features, managed via Stripe subscriptions.
- **Advertising**: Carousel banner ads with tiered pricing and an in-browser ad designer tool.
- **Business Analytics**: Tracks engagement metrics for business listings.
- **Review System**: Allows customer reviews with optional proof of service, business confirmation/dispute, and owner responses.
- **Admin Dashboard**: Comprehensive control center for platform management, user/business oversight, and content moderation.
- **AI Lab**: Admin-only sandbox for developing Gold-exclusive AI features, including an AI credit system.
- **Growth Features**: Includes a "Founding Urgency Banner" and "Refer-a-Business" program with unique referral codes and Gold-tier rewards.
- **AI Listing Description Writer**: Generates multiple description variants for Gold members.
- **AI Review Reply Generator**: Generates two reply variants for customer reviews for Gold members.
- **AI Quote Responder**: Gold-only AI assist (3 credits) that drafts two opening message variants for businesses responding to a customer quote request. Mounted in the response dialog on `/quotes`. Prompt is constrained to never quote a price — owner sets that separately. Founders are unmetered.
- **AI Help Wanted Writer**: Gold-only AI assist (5 credits) that drafts three Help Wanted ad variants (bullet, narrative, brief) from owner-supplied facts. Mounted in both the create and edit job-listing forms on `/jobs`. Prompt is constrained to never invent pay, hours, or perks not provided by the owner.
- **AI Credits Top-Up**: Gold owners can buy add-on credit packs (Starter 500/$10, Popular 1.5k/$25, Power 5k/$75, Pro 15k/$200) via Stripe one-time Checkout from the dashboard credits widget. Webhook applies credits with double-guarded idempotency (pre-check + UNIQUE on Stripe paymentIntent id). Founders are blocked at the API and don't see the button.

### UI/UX Decisions
- **Design Theme**: Coastal color palette.
- **Component Library**: shadcn/ui (New York style variant) for consistent design.
- **Location Search**: Zillow-style search with geolocation and radius filtering.
- **Badges**: Visual badges for business credentials and membership tiers.

### Technical Implementations
- **Distance Filtering**: Uses Haversine formula for location-based searches.
- **Category Management**: Hierarchical categories with community suggestion and tier-based limits.
- **Stripe Integration**: Handles subscriptions, payments, and webhooks.
- **Authentication**: Bcrypt for password hashing, PostgreSQL for session storage, and Google OAuth.
- **Gold Auto-Upgrade**: New Bronze/Silver members automatically receive 30 days of Gold-tier features.
- **Image Cropper**: Reusable component for image cropping and resizing.
- **Ad Designer**: In-browser tool for designing ads with customizable elements and size-matched canvases.

## External Dependencies

### Third-Party Services
- **Supabase**: Client SDK for database interaction.
- **OpenAI**: AI chat integration via Replit AI Integrations proxy.
- **Replit Object Storage**: For file uploads.
- **Stripe**: Payment processing.
- **Resend**: Email notifications.

### Key NPM Packages
- **UI Components**: Radix UI primitives, FullCalendar.
- **Database**: `drizzle-orm`, `pg`.
- **Validation**: `zod`, `drizzle-zod`.
- **Date Handling**: `date-fns`.