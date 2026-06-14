"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { signInSchema } from "@/lib/validation/auth";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Result shape returned by Server Actions invoked through
 * `useActionState` on the client. The client treats `error` as a
 * user-facing message and `success + message` as the success toast.
 */
export type AuthState = {
  error?: string;
  success?: boolean;
  message?: string;
};

/**
 * Send a Magic Link to the given email address.
 *
 * Validates input with Zod, then asks Supabase to deliver a one-time
 * login link. The link target is the `/api/auth/callback` route which
 * exchanges the code for a session cookie.
 */
export async function signInWithMagicLink(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const supabase = await createServerClient();
  const origin = (await headers()).get("origin") ?? "";

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/api/auth/callback`,
    },
  });

  if (error) {
    console.error("Magic link error:", error);
    return { error: "Gagal mengirim magic link. Coba lagi." };
  }

  return {
    success: true,
    message: "Magic link telah dikirim. Cek email Anda.",
  };
}

/**
 * Start a Google OAuth flow. The Supabase client returns a hosted
 * authorization URL; we redirect the user there. Supabase sends the
 * user back to `/api/auth/callback` with a `code` we exchange for a
 * session.
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = await createServerClient();
  const origin = (await headers()).get("origin") ?? "";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/api/auth/callback`,
    },
  });

  if (error) {
    console.error("Google OAuth error:", error);
    redirect("/login?error=oauth_failed");
  }

  if (data.url) {
    redirect(data.url);
  }

  // Fallback: if no URL came back, bail to login with an error flag.
  redirect("/login?error=oauth_failed");
}

/**
 * Sign the current user out and redirect to the login page.
 */
export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
