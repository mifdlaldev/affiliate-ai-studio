import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Browser-side Supabase client.
 *
 * Use in Client Components, event handlers, and any code that runs in the
 * browser. Reads NEXT_PUBLIC_* env vars (safe to expose to the client).
 *
 * Singleton-safe: a new client is created per call, but @supabase/ssr
 * is light-weight; if you need to avoid re-instantiation in a hook, wrap
 * it in useMemo. Otherwise, just call createBrowserClient() directly.
 */
export function createBrowserClient() {
  return createSSRBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
