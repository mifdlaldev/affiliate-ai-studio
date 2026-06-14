import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextResponse } from "next/server";
import type { Database } from "./types";

/**
 * Server-side Supabase client for Server Components, Server Actions,
 * and Route Handlers. Reads/writes auth cookies via next/headers so the
 * session is shared with the browser client.
 *
 * Always call this inside an async context — cookies() in Next.js 15+
 * is async. Do not memoize the result across requests; each request has
 * its own cookie store.
 *
 * @param response - Optional `NextResponse` for **Route Handlers** that
 *   need the auth session cookie to actually reach the browser. In
 *   Next.js 15+, `cookies().set()` from `next/headers` only mutates the
 *   request-scoped cookie store — it does NOT add `Set-Cookie` headers
 *   to the outgoing response. Route Handlers that do an
 *   `exchangeCodeForSession` (or any other call that mints new cookies)
 *   must pass the `NextResponse` they're about to return so the new
 *   cookies are attached to it. Server Components / Server Actions can
 *   omit this argument; the root middleware (`lib/supabase/middleware.ts`)
 *   refreshes the session on the next request and picks up the
 *   in-memory cookie changes.
 */
export async function createServerClient(response?: NextResponse) {
  const cookieStore = await cookies();

  return createSSRServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              if (response) {
                response.cookies.set(name, value, options);
              }
            });
          } catch {
            // Called from a Server Component (read-only context). The
            // root middleware refreshes the session, so this is safe to
            // ignore. (Route Handlers always pass a `response`, so the
            // `response.cookies.set` call above is the one that actually
            // ships the new cookie to the browser in that case.)
          }
        },
      },
    }
  );
}
