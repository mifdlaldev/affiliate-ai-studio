import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { OnboardingWrapper } from "@/components/shared/onboarding-wrapper";

/**
 * Protected route group layout. Verifies a Supabase session server-side
 * and redirects unauthenticated users to `/login` before any shell UI
 * is rendered. The shell itself is a client component so it can own
 * sidebar collapse state.
 *
 * The layout is also responsible for deciding whether the first-run
 * onboarding modal should appear. It reads `onboarding_completed` from
 * `user_profiles` and passes the boolean down to `OnboardingWrapper`,
 * which is a client component that owns the modal lifecycle.
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

  const showOnboarding = !profile?.onboarding_completed;

  return (
    <>
      <DashboardShell user={user} profile={profile}>
        {children}
      </DashboardShell>
      <OnboardingWrapper showOnboarding={showOnboarding} />
    </>
  );
}
