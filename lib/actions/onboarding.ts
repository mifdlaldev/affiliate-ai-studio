"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Result shape for the onboarding server action. The client uses the
 * `error` field to surface a friendly message; `success` is the happy
 * path signal. We never throw — every failure path is converted into a
 * structured return value so the modal can degrade gracefully.
 */
export type CompleteOnboardingResult = {
  success?: boolean;
  error?: string;
};

/**
 * Two realistic Indonesian-market sample products inserted when the
 * user opts in to demo data during onboarding. Both are fully formed
 * (name, brand, target market, USP, benefits) so the AI generators
 * have enough context to produce useful output immediately.
 */
const SAMPLE_PRODUCTS = [
  {
    name: "Skintific Mugwort",
    category: "kecantikan",
    brand: "Skintific",
    price: "Rp 89.000 - Rp 159.000",
    target_market: "Wanita 18-30 tahun yang peduli skincare",
    usp: "Calming skincare dengan mugwort alami, cocok untuk kulit sensitif.",
    benefits:
      "Mengatasi kemerahan dan iritasi\nMelembabkan kulit sensitif\nMenenangkan kulit berjerawat",
  },
  {
    name: "Sepatu Lari XYZ Sport",
    category: "fashion",
    brand: "XYZ Sport",
    price: "Rp 500.000 - Rp 800.000",
    target_market: "Pria/Wanita 20-40 tahun yang aktif berlari",
    usp: "Sepatu lari ringan dengan cushion nyaman untuk lari jarak jauh.",
    benefits:
      "Ringan dan breathable\nCushion nyaman untuk jarak jauh\nSol anti-slip untuk keamanan",
  },
];

/**
 * Mark the current user as onboarded, optionally inserting two
 * realistic sample products first so the dashboard is not empty.
 *
 * Behavior notes:
 *  - Sample-data insert is best-effort: if it fails, we still mark
 *    onboarding as complete so the user is not trapped on the modal.
 *  - The onboarding flag lives on `user_profiles.onboarding_completed`
 *    and is the single source of truth — the layout re-queries it
 *    after `revalidatePath` so the modal closes on the next render.
 *  - The function never throws; all errors are returned as
 *    `{ error: string }` so the client can render a friendly message.
 */
export async function completeOnboarding(
  loadSampleData: boolean
): Promise<CompleteOnboardingResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login terlebih dahulu" };
    }

    if (loadSampleData) {
      const productsToInsert = SAMPLE_PRODUCTS.map((p) => ({
        ...p,
        user_id: user.id,
      }));

      const { error: insertError } = await supabase
        .from("products")
        .insert(productsToInsert);

      if (insertError) {
        // Non-fatal: still mark onboarding as complete so the user is
        // not trapped on the modal by a transient DB error.
        console.error("Sample products insert error:", insertError);
      }
    }

    // Mark onboarding as complete
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);

    if (updateError) {
      console.error("Onboarding update error:", updateError);
      return {
        error: `Gagal menyelesaikan onboarding: ${updateError.message}`,
      };
    }

    revalidatePath("/produk");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("completeOnboarding error:", err);
    return {
      error:
        err instanceof Error ? err.message : "Gagal menyelesaikan onboarding",
    };
  }
}
