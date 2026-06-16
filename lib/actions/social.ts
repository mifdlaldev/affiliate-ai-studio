"use server";

import { createServerClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { extractJson } from "@/lib/ai/json";
import { checkAndIncrementUsage } from "@/lib/usage/limits";
import {
  SOCIAL_SYSTEM_PROMPT,
  buildSocialPrompt,
  type SocialPromptProduct,
} from "@/lib/ai/prompts/social";
import { generateSocialSchema } from "@/lib/validation/social";
import type { Json } from "@/lib/supabase/types";

/**
 * Structured output of the Social Media Content Calendar Generator
 * flow. The shape mirrors the JSON schema inside
 * `SOCIAL_SYSTEM_PROMPT` / `buildSocialPrompt` and is persisted into
 * `generations.result` (JSONB) for history + re-use.
 *
 * The social-media calendar is unique in that it produces an ARRAY of
 * 7 day-objects (vs. a single marketplace description or a single
 * live-stream script). Each day carries its own content type, topic,
 * caption, hashtags, and best posting time.
 */
export interface SocialDay {
  day: number;
  contentType: string;
  topic: string;
  caption: string;
  hashtags: string[];
  bestTime: string;
}

export interface SocialResult {
  platform: string;
  days: SocialDay[];
}

export type GenerateSocialResult = {
  data?: SocialResult;
  error?: string;
};

/**
 * Server Action that runs the full Social Media Content Calendar
 * Generator pipeline for the signed-in user:
 *
 *   1. Verify the user is authenticated.
 *   2. Parse + Zod-validate the submitted form (productId, platform,
 *      tone).
 *   3. Atomically check + increment the monthly usage limit (50/month
 *      soft cap, enforced via the `increment_user_usage` Postgres
 *      RPC).
 *   4. Load the saved product (RLS already scopes to `user_id`).
 *   5. Build the prompt + call the text model in JSON mode.
 *   6. Parse the AI's JSON-object response into `SocialResult`.
 *   7. Persist the generation into the `generations` table.
 *   8. Return the 7-day calendar to the client.
 *
 * Never throws — every failure path returns `{ error: string }` so
 * the client can surface a friendly toast.
 */
export async function generateSocialCalendar(
  formData: FormData,
): Promise<GenerateSocialResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login" };
    }

    const parsed = generateSocialSchema.safeParse({
      productId: formData.get("productId"),
      platform: formData.get("platform"),
      tone: formData.get("tone"),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Input tidak valid",
      };
    }

    const { productId, platform, tone } = parsed.data;

    // 1. Usage cap (50/month) — soft, enforced via DB function.
    const usage = await checkAndIncrementUsage(user.id);
    if (!usage.allowed) {
      return {
        error: `Batas 50 generate/bulan tercapai. Sisa: ${usage.remaining}.`,
      };
    }

    // 2. Load the product (RLS already enforces user_id scope).
    const { data: product, error: productError } = await supabase
      .from("products")
      .select(
        "id, name, brand, category, price, target_market, usp, benefits",
      )
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return { error: "Produk tidak ditemukan" };
    }

    // 3. Build prompt + call the model in JSON mode.
    const prompt = buildSocialPrompt({
      product: product as SocialPromptProduct,
      platform,
      tone,
    });

    const result = await generateText({
      systemPrompt: SOCIAL_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
    });

    // 4. Parse the JSON-object response.
    let social: SocialResult;
    try {
      social = extractJson<SocialResult>(result.content);
    } catch (parseErr) {
      console.error(
        "generateSocialCalendar: failed to parse AI JSON",
        parseErr,
        result.content,
      );
      return { error: "AI response tidak valid. Coba lagi." };
    }

    // 5. Best-effort persist into `generations` (failure here does
    //    NOT block the user from seeing their 7-day calendar).
    const { error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        product_id: productId,
        model: result.model,
        module: "social",
        subtype: platform,
        status: "completed",
        input_prompt: prompt,
        result: social as unknown as Json,
        tokens_used: result.tokensUsed,
        duration_ms: result.durationMs,
      });

    if (insertError) {
      console.warn("Failed to save social generation:", insertError);
    }

    return { data: social };
  } catch (err) {
    console.error("generateSocialCalendar error:", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Gagal generate social media calendar",
    };
  }
}
