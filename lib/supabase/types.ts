/**
 * Stub Supabase Database type.
 *
 * Will be REGENERATED in Task 5 after DB migrations:
 *   pnpm dlx supabase gen types typescript --project-id=<id> > lib/supabase/types.ts
 *
 * For now, the empty structure satisfies the Supabase client's generic constraint
 * so we can wire up the browser/server/middleware clients in Task 4.
 */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
