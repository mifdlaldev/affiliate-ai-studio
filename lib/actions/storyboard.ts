"use server";

import { createServerClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { checkAndIncrementUsage } from "@/lib/usage/limits";
import {
  STORYBOARD_SYSTEM_PROMPT,
  buildStoryboardPrompt,
} from "@/lib/ai/prompts/storyboard";
import { generateStoryboardSchema } from "@/lib/validation/storyboard";
import type { Json } from "@/lib/supabase/types";

/**
 * Structured output of the Storyboard Generator flow. The shape
 * mirrors the JSON schema inside `STORYBOARD_SYSTEM_PROMPT` /
 * `buildStoryboardPrompt` and is persisted into `generations.result`
 * (JSONB) for history + re-use.
 *
 * Difference vs. `UgcStoryboardPanel`: this one adds the
 * cinematographic fields `cameraAngle` and `transition` so the user
 * has a real shot list (not just a UGC casual list).
 */
export interface StoryboardPanel {
  panel: number;
  time: string;
  visuals: string;
  audio: string;
  text: string;
  cameraAngle: string;
  transition: string;
}

export type GenerateStoryboardResult = {
  data?: StoryboardPanel[];
  error?: string;
};

/**
 * Server Action that runs the full Storyboard Generator pipeline for
 * the signed-in user:
 *
 *   1. Verify the user is authenticated.
 *   2. Parse + Zod-validate the submitted form (productId, platform,
 *      tone, duration).
 *   3. Atomically check + increment the monthly usage limit (50/month
 *      soft cap, enforced via the `increment_user_usage` Postgres RPC).
 *   4. Load the saved product (RLS already scopes to `user_id`).
 *   5. Build the prompt + call the text model in JSON mode.
 *   6. Parse the AI's JSON-array response into `StoryboardPanel[]`.
 *   7. Persist the result in `generations` with `module: "storyboard"`
 *      and `subtype: platform` so the dashboard can filter history.
 *
 * Never throws — every failure path returns `{ error: string }` so the
 * client can render the failure inline.
 */
export async function generateStoryboard(
  formData: FormData,
): Promise<GenerateStoryboardResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login" };
    }

    const parsed = generateStoryboardSchema.safeParse({
      productId: formData.get("productId"),
      platform: formData.get("platform"),
      tone: formData.get("tone"),
      duration: formData.get("duration"),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Input tidak valid",
      };
    }

    const { productId, platform, tone, duration } = parsed.data;

    const usage = await checkAndIncrementUsage(user.id);
    if (!usage.allowed) {
      return {
        error: `Batas 50 generate/bulan tercapai. Sisa: ${usage.remaining}.`,
      };
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select(
        "id, name, category, brand, price, target_market, usp, benefits",
      )
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return { error: "Produk tidak ditemukan" };
    }

    const prompt = buildStoryboardPrompt({
      product,
      platform,
      tone,
      duration,
    });

    const result = await generateText({
      systemPrompt: STORYBOARD_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
    });

    let panels: StoryboardPanel[];
    try {
      panels = JSON.parse(result.content) as StoryboardPanel[];
    } catch (parseErr) {
      console.error(
        "Failed to parse storyboard AI response:",
        result.content,
        parseErr,
      );
      return { error: "AI response tidak valid. Coba lagi." };
    }

    // Best-effort persist — log and move on if the insert fails so the
    // user still gets their result.
    const { error: insertError } = await supabase.from("generations").insert({
      user_id: user.id,
      model: result.model,
      module: "storyboard",
      subtype: platform,
      status: "completed",
      result: panels as unknown as Json,
      tokens_used: result.tokensUsed,
      duration_ms: result.durationMs,
    });

    if (insertError) {
      console.warn("Failed to save storyboard generation:", insertError);
    }

    return { data: panels };
  } catch (err) {
    console.error("generateStoryboard error:", err);
    return {
      error:
        err instanceof Error ? err.message : "Gagal generate storyboard",
    };
  }
}
