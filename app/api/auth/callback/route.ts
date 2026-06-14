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
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
