import { createServerClient } from "@/lib/supabase/server";

/**
 * Result of a usage check + increment RPC call against the
 * `increment_user_usage` Postgres function. The function atomically
 * bumps the user's monthly generation count and reports whether the
 * caller is still within the soft limit.
 */
export interface UsageCheck {
  allowed: boolean;
  remaining: number;
}

/**
 * Atomically check whether `userId` is within the monthly generation
 * limit, and if so increment the count. The actual counter logic lives
 * in the `increment_user_usage` Postgres function (see migration
 * `20260614000008_increment_user_usage.sql`) so that the read-decide-
 * write happens in a single round-trip without a race.
 *
 * Throws when the RPC returns an error or returns no data. Callers
 * should treat a thrown error as a hard failure (e.g. show a network
 * error toast) and let `allowed === false` flow through as the soft
 * limit-reached UX.
 */
export async function checkAndIncrementUsage(
  userId: string
): Promise<UsageCheck> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("increment_user_usage", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`Failed to check usage: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error("No usage data returned from increment_user_usage");
  }

  const result = data[0];
  return {
    allowed: result.allowed,
    remaining: result.remaining,
  };
}
