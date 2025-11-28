import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')

  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get('next') ?? '/deck'

  if (!next.startsWith('/')) {
    // if "next" is not a relative URL, use the default
    next = '/'
  }

  if (code) {
    const supabase = await createClient()

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Console log after successful login
      const { data: { user } } = await supabase.auth.getUser()
      console.log('User logged in successfully:', user?.email || user?.id)

      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`http://localhost:3000${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`http://localhost:3000${next}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`http://localhost:3000/auth/auth-code-error`)
}

