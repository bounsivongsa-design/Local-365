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