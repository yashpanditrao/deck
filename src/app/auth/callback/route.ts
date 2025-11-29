import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const origin = url.origin;

  const code = searchParams.get("code");

  // if "next" is in param, use it as the redirect URL
  const nextParam = searchParams.get("next");
  let next = "/deck";

  if (nextParam && nextParam.startsWith("/")) {
    // If next points back to the login page, send users to the deck instead
    next = nextParam.startsWith("/auth/login") ? "/deck" : nextParam;
  }

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Console log after successful login
      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.log("User logged in successfully:", user?.email || user?.id);

      const forwardedHost = request.headers.get("x-forwarded-host");
      const forwardedProto =
        request.headers.get("x-forwarded-proto") ?? "https";
      const redirectOrigin = forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : origin;

      return NextResponse.redirect(`${redirectOrigin}${next}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
