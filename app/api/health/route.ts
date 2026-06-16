"use server";

import { createServerClient } from "@/lib/supabase/server";

/**
 * Lightweight health check for uptime monitoring.
 * Returns 200 with status "ok" if the app is healthy.
 */
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.from("user_profiles").select("id", { count: "exact", head: true });

    if (error) {
      return Response.json(
        { status: "degraded", db: "unreachable" },
        { status: 503 }
      );
    }

    return Response.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
