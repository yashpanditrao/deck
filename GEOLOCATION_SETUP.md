# IP Address & Geolocation Setup

## Understanding IP Addresses

### Development (localhost)
- **What you see**: `::1` or `127.0.0.1`
- **Why**: These are loopback addresses for local connections
- **This is CORRECT**: You're testing on your own machine

### Production
- **What you'll see**: Real IP addresses like `203.0.113.42`
- **Why**: Vercel/production servers inject real client IPs via headers
- **No code changes needed**: Works automatically when deployed

## Current Implementation

```typescript
// This code works correctly in both environments
const forwardedFor = request.headers.get('x-forwarded-for');
const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : 
                  request.headers.get('x-real-ip') || null;
```

### How It Works

#### On Vercel (Production)
```
User connects → Vercel Edge Network → Adds x-forwarded-for header → Your API
                                    ↓
                        Real IP: 203.0.113.42
```

#### On Localhost (Development)
```
You connect → localhost:3000 → Your API
                            ↓
                  Local IP: ::1
```

## Adding City/Country Detection

Currently, the `city` and `country` fields are set to `null`. Here's how to add geolocation:

### Option 1: Vercel's Geo Headers (FREE - Recommended)

Vercel automatically provides geo headers in production:

```typescript
// In /src/app/api/analytics/track/route.ts
const country = request.headers.get('x-vercel-ip-country') || null;
const city = request.headers.get('x-vercel-ip-city') || null;
const region = request.headers.get('x-vercel-ip-country-region') || null;
```

**Pros:**
- ✅ Free
- ✅ No API calls needed
- ✅ Works automatically on Vercel
- ✅ Fast (no external requests)

**Cons:**
- ❌ Only works on Vercel
- ❌ Limited to basic geo data

### Option 2: IPGeolocation.io API

**Free tier:** 1,000 requests/day

```typescript
// Add to environment variables
IPGEOLOCATION_API_KEY=your_api_key_here

// In /src/app/api/analytics/track/route.ts
async function getGeolocation(ip: string) {
  if (!process.env.IPGEOLOCATION_API_KEY || ip === '::1' || ip === '127.0.0.1') {
    return { country: null, city: null };
  }

  try {
    const response = await fetch(
      `https://api.ipgeolocation.io/ipgeo?apiKey=${process.env.IPGEOLOCATION_API_KEY}&ip=${ip}`,
      { cache: 'no-store' }
    );
    const data = await response.json();
    
    return {
      country: data.country_name || null,
      city: data.city || null,
    };
  } catch (error) {
    console.error('Geolocation lookup failed:', error);
    return { country: null, city: null };
  }
}

// Use it in view_start
const { country, city } = await getGeolocation(ipAddress || '');
```

### Option 3: MaxMind GeoLite2 (Self-hosted)

**Free**, but requires setup:

1. Download GeoLite2 database
2. Use `maxmind` npm package
3. Store DB file in your project

```bash
npm install maxmind
```

```typescript
import maxmind, { CityResponse } from 'maxmind';

const lookup = await maxmind.open<CityResponse>('/path/to/GeoLite2-City.mmdb');
const geo = lookup.get(ipAddress);

const country = geo?.country?.names?.en || null;
const city = geo?.city?.names?.en || null;
```

**Pros:**
- ✅ No API limits
- ✅ Fast lookups
- ✅ Privacy-friendly (no external calls)

**Cons:**
- ❌ Requires database file (~100MB)
- ❌ Need to update DB monthly
- ❌ More complex setup

## Recommended Approach

### For MVP / Testing
Use **Vercel Geo Headers** (Option 1) - it's free and works out of the box.

### For Production
Start with **Vercel Geo Headers**, then consider **MaxMind** if you need:
- More detailed location data
- Better privacy (no external calls)
- No rate limits

## Implementation Guide: Vercel Geo Headers

This is the easiest option. Just update your tracking API:

```typescript
// In /src/app/api/analytics/track/route.ts
// Add this after getting the IP address

const country = request.headers.get('x-vercel-ip-country') || null;
const city = request.headers.get('x-vercel-ip-city') || null;

// Then use these in your insert:
const { data: newView, error: insertError } = await supabaseAdmin
  .from('deck_views')
  .insert({
    // ... other fields
    country: country,
    city: city,
  })
```

That's it! When deployed to Vercel, it will automatically capture city/country.

## Testing

### Local Development
- IP will show as `::1`
- City/Country will be `null`
- **This is expected**

### Production (Vercel)
- IP will show real address
- City/Country will show actual location
- **No code changes needed**

### Test Without Deploying
You can't easily test this locally, but you can:

1. Deploy to Vercel preview
2. Share the preview link
3. Access from your phone (off WiFi)
4. Check analytics to see real IP/location

## Privacy Considerations

⚠️ **Important**: Storing IP addresses may have legal implications:

- **GDPR (EU)**: IP addresses are personal data
- **CCPA (California)**: Similar restrictions
- **Consider**: Hashing IPs or not storing them at all

### Option: Hash IPs

```typescript
import crypto from 'crypto';

function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

// Store hashed instead of raw
ip_address: ipAddress ? hashIP(ipAddress) : null,
```

This allows you to:
- ✅ Detect unique users
- ✅ Maintain privacy
- ❌ Can't reverse to original IP

## Summary

| Aspect | Development | Production |
|--------|-------------|------------|
| IP Address | `::1` (localhost) | Real IP (automatic) |
| City/Country | `null` | Real location (with geo service) |
| Action Needed | None | Add geo headers or API |
| Cost | Free | Free (Vercel) or varies |

**Bottom line**: The `::1` IP is correct for localhost. Deploy to Vercel and you'll automatically see real IPs! 🚀



