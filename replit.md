# Local List 365 - Currituck County Directory

## Overview

Local List 365 is a community-focused local business directory and events platform for Currituck County and the Outer Banks (OBX) region of North Carolina. The application connects visitors and residents with local businesses, service providers, events, and community features including a loyalty program, quote request system, and AI-powered chatbot assistant named "Ziggy."

Key features include:
- Business directory with categories, ratings, and reviews
- Local events calendar
- Quote request system connecting customers with service providers
- User validation through receipt uploads
- Loyalty tier program (Explorer → Ambassador)
- AI chatbot for local recommendations
- Community feed with posts and engagement

## User Preferences

Preferred communication style: Simple, everyday language.

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

### Authentication System
- Replit Auth handles user identity
- Session storage in PostgreSQL (sessions table)
- User accounts support two types: "customer" and "business"
- Validation system requires proof-of-purchase receipt uploads

### Shared Code Pattern
- /shared directory contains code used by both client and server
- Schema definitions, route types, and models are shared
- TypeScript path aliases ensure consistent imports

## External Dependencies

### Third-Party Services
- **Supabase**: Client SDK configured (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- **OpenAI**: AI chat integration via Replit AI Integrations proxy
- **Google Cloud Storage**: File storage capability
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
- VITE_SUPABASE_URL: Supabase project URL
- VITE_SUPABASE_ANON_KEY: Supabase anonymous key