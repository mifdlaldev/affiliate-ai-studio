import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * OAuth + Magic Link callback handler.
 *
 * Supabase redirects users here with `?code=...` after a successful
 * sign-in (whether via Google OAuth or a Magic Link click). We exchange
 * the code for a session cookie, then send the user to `next` (defaults
 * to the dashboard root).
 *
 * On failure we redirect back to /login with a query-string flag the
 * login page can read to surface an error message.
 *
 * IMPORTANT: we build the `NextResponse` FIRST and pass it to
 * `createServerClient` so the Supabase client's `setAll` cookie
 * handler attaches the freshly-minted session cookies to it. In
 * Next.js 15+, `cookies().set()` from `next/headers` only mutates the
 * request-scoped cookie store — without the explicit `response.cookies`
 * write, the new session cookie never reaches the browser and the
 * dashboard's auth check bounces the user right back to `/login`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const redirectUrl = new URL(next, origin);
    const response = NextResponse.redirect(redirectUrl);
    const supabase = await createServerClient(response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
}
