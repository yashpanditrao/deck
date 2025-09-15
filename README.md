# Deck Viewer Platform

A secure, standalone deck viewing platform that integrates with app.raisegate.com's deck sharing system. This platform allows users to securely view shared pitch decks with email verification.

## Features

- 🔐 **Secure Token-Based Access**: Validates shared deck tokens from the main RaiseGate app
- 📧 **Email Verification**: 6-digit code verification system using Supabase + Resend
- 📄 **PDF Deck Viewer**: Clean, responsive PDF viewing with navigation controls
- 💾 **Session Management**: Remembers verification status during the session
- 🎨 **Modern UI**: Built with shadcn/ui components and Tailwind CSS
- ⚡ **Fast & Responsive**: Next.js 15 with TypeScript

## How It Works

1. **Share**: A user from app.raisegate.com shares a deck with an investor's email
2. **Access**: The investor clicks the shared link (format: `/view/[token]`)
3. **Verify**: The platform validates their email matches the intended recipient (only required once per 24 hours)
4. **View**: After verification, the investor can securely view the deck
5. **Seamless Access**: Additional decks shared with the same email require no re-verification for 24 hours

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
│   │   ├── deck/
│   │   │   ├── validate/    # Token validation
│   │   │   └── access/      # Deck access after verification
│   │   └── verify/
│   │       ├── request-code/ # Request verification code
│   │       └── confirm-code/ # Verify code
│   └── view/
│       └── [token]/         # Main deck viewer page
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── EmailVerification.tsx
│   └── PdfViewer.tsx
├── lib/
│   ├── supabase.ts         # Supabase client configuration
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

Ensure your Supabase database has the `deck_share_links` table with the following structure:

```sql
CREATE TABLE deck_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id TEXT NOT NULL,
  deck_url TEXT NOT NULL,
  shared_by_user_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  verification_code TEXT,
  verification_code_expires TIMESTAMPTZ,
  is_verified BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## API Endpoints

- `POST /api/deck/validate` - Validate a share token
- `POST /api/verify/request-code` - Request email verification code
- `POST /api/verify/confirm-code` - Verify the 6-digit code
- `POST /api/deck/access` - Get deck URL after successful verification

## Integration with RaiseGate

This platform is designed to work alongside the main RaiseGate application:

1. RaiseGate creates share links in the `deck_share_links` table
2. Share links point to this platform: `https://your-domain.com/view/{token}`
3. This platform handles the verification and viewing process
4. Email notifications are sent via Supabase's Resend integration

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
- **Database-Level Security**: ID-based updates instead of token-based
