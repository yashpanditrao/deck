# Deck Viewer Platform

A secure, standalone deck viewing platform that integrates with app.raisegate.com's deck sharing system. This platform allows users to securely view shared pitch decks with email verification.

## Features

- 🔐 **Secure Token-Based Access**: Validates shared deck tokens from the main RaiseGate app
- 📧 **Email Verification**: 6-digit code verification system using Supabase + Resend
- 📄 **PDF Deck Viewer**: Clean, responsive PDF viewing with navigation controls
- 📊 **Analytics Dashboard**: Track views, engagement, and viewer behavior (inspired by Papermark)
- 💾 **Session Management**: Remembers verification status and viewing sessions
- 🎨 **Modern UI**: Built with shadcn/ui components and Tailwind CSS
- ⚡ **Fast & Responsive**: Next.js 15 with TypeScript

## How It Works

1. **Share**: A user from app.raisegate.com shares a deck with an investor's email
2. **Access**: The investor clicks the shared link (format: `/view?token=[token]`)
3. **Verify**: The platform validates their email matches the intended recipient (only required once per 24 hours)
4. **View**: After verification, the investor can securely view the deck
5. **Track**: Analytics automatically track viewing sessions, page views, and engagement
6. **Analyze**: Deck owners can view detailed analytics at `/analytics?token=[token]`
7. **Seamless Access**: Additional decks shared with the same email require no re-verification for 24 hours

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Email**: Resend (via Supabase integration)
- **PDF Viewing**: react-pdf

## Project Structure

```
src/
├── app/
│   ├── api/                 # API routes
│   │   ├── analytics/
│   │   │   ├── track/       # Track viewing events
│   │   │   └── deck/        # Get deck analytics
│   │   ├── deck/
│   │   │   ├── validate/    # Token validation
│   │   │   ├── view/        # Deck view endpoint
│   │   │   └── serve/       # Serve PDF files
│   │   └── verify/
│   │       ├── request-code/ # Request verification code
│   │       └── confirm-code/ # Verify code
│   ├── analytics/           # Analytics dashboard page
│   └── view/                # Main deck viewer page
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── EmailVerification.tsx
│   └── PdfViewer.tsx
├── lib/
│   ├── supabase.ts         # Supabase client configuration
│   ├── jwt.ts              # JWT utilities
│   └── utils.ts            # Utility functions
└── types/
    └── database.ts         # TypeScript database types
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the `.env.local` file and add your Supabase credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

### 3. Database Schema

Run the SQL migrations in your Supabase dashboard:

1. **Core Tables**: Set up your base tables (`deck_share_links`, `deck_files`)
2. **Analytics Tables**: Run the migration from `supabase_analytics_migration.sql`

This will create the analytics tracking tables:
- `deck_views`: Tracks viewing sessions
- `page_views`: Tracks individual page views

See `ANALYTICS_SETUP.md` for detailed instructions.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## API Endpoints

### Deck Access
- `POST /api/deck/view` - Get deck information for viewing
- `GET /api/deck/serve/[token]` - Serve PDF file

### Verification
- `POST /api/verify/request-code` - Request email verification code
- `POST /api/verify/confirm-code` - Verify the 6-digit code
- `GET /api/access/requirements` - Get access requirements for a deck

### Analytics
- `POST /api/analytics/track` - Track viewing events (start, page views, end)
- `GET /api/analytics/deck` - Get analytics data for a specific deck

## Analytics Feature

The platform includes a comprehensive analytics system inspired by [Papermark](https://github.com/mfts/papermark):

### Tracked Metrics
- **Total Views**: All-time view count
- **Unique Viewers**: Distinct viewer count (by email or session)
- **Average Duration**: Time spent per session
- **Completion Rate**: % of viewers who completed the deck
- **Page Engagement**: Most viewed pages
- **Views Over Time**: Daily view trends
- **Viewer Details**: Email, location, duration, pages viewed

### Session Continuity
- Sessions are cached in browser localStorage
- If a viewer returns within 24 hours, the session resumes
- No duplicate view counting for returning visitors

### Access Analytics
To view analytics for a shared deck:
```
https://your-domain.com/analytics?token=YOUR_SHARE_LINK_TOKEN
```

See `ANALYTICS_SETUP.md` for detailed documentation.

## Integration with RaiseGate

This platform is designed to work alongside the main RaiseGate application:

1. RaiseGate creates share links in the `deck_share_links` table
2. Share links point to this platform: `https://your-domain.com/view?token={token}`
3. This platform handles the verification and viewing process
4. Analytics automatically track all viewing sessions
5. Email notifications are sent via Supabase's Resend integration

## Deployment

The application can be deployed on any platform that supports Next.js:

- **Vercel** (recommended)
- **Netlify**
- **Railway**
- **Self-hosted**

Make sure to configure your environment variables in the deployment platform.

## Security Features

### 🔐 **Multi-Layer Security Architecture**
- **RLS Policies**: Row Level Security enabled with specific access controls
- **Anon Client Usage**: Most operations use anonymous client, not service role
- **Input Validation**: All API endpoints validate input format and types
- **Token Validation**: Tokens must meet minimum length and format requirements
- **Email Format Validation**: Regex validation for all email inputs
- **Token Age Limits**: Automatic rejection of tokens older than 30 days
- **Verification Filters**: Database queries filter for verified records only
- **Session Expiry**: 24-hour verification sessions with automatic cleanup
- **Error Handling**: Secure error messages that don't leak sensitive info

### 🛡️ **API Security Measures**
- **Limited Service Role Usage**: Admin privileges only when absolutely necessary
- **Field-Specific Queries**: Only select required fields, never `SELECT *`
- **Double Email Verification**: Email matching enforced at multiple levels
- **Code Format Validation**: 6-digit codes must match exact pattern
- **Database-Level Security**: ID-based updates instead of token-based.
