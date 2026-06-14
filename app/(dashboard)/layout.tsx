import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/shared/dashboard-shell";

/**
 * Protected route group layout. Verifies a Supabase session server-side
 * and redirects unauthenticated users to `/login` before any shell UI
 * is rendered. The shell itself is a client component so it can own
 * sidebar collapse state.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // The onboarding trigger creates a profile row on signup, so this
  // should always resolve to a single record — but use maybeSingle to
  // avoid throwing if the trigger is ever skipped.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, avatar_url, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <DashboardShell user={user} profile={profile}>{children}</DashboardShell>
  );
}
