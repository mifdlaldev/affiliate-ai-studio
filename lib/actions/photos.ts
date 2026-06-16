"use server";

import { createServerClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { checkAndIncrementUsage } from "@/lib/usage/limits";
import {
  PHOTO_SYSTEM_PROMPT,
  buildPhotoPrompt,
} from "@/lib/ai/prompts/photo";
import { generatePhotoSchema } from "@/lib/validation/photo";
import type { Json } from "@/lib/supabase/types";

/**
 * Structured output of the Photo Prompt Generator flow. The shape
 * mirrors the JSON schema inside `PHOTO_SYSTEM_PROMPT` / `buildPhotoPrompt`
 * and is persisted into `generations.result` (JSONB) for history + re-use.
 *
 * `prompt` is the English visual prompt intended for Midjourney / Leonardo
 * / DALL-E. The remaining metadata fields are in Bahasa Indonesia to
 * match the dashboard's UI copy.
 */
export interface PhotoPromptResult {
  title: string;
  prompt: string;
  style: string;
  mood: string;
  setting: string;
  composition: string;
  aspectRatio: string;
  lighting: string;
  colorPalette: string;
  cameraAngle: string;
}

export type GeneratePhotoPromptsResult = {
  data?: PhotoPromptResult[];
  error?: string;
};

/**
 * Server Action that runs the full Photo Prompt Generator pipeline for
 * the signed-in user:
 *
 *   1. Verify the user is authenticated.
 *   2. Parse + Zod-validate the submitted form (productId, style, mood,
 *      setting, composition).
 *   3. Atomically check + increment the monthly usage limit (50/month
 *      soft cap, enforced via the `increment_user_usage` Postgres RPC).
 *   4. Load the saved product (RLS already scopes to `user_id`).
 *   5. Build the prompt + call the text model in JSON mode.
 *   6. Parse the AI's JSON-array response into `PhotoPromptResult[]`.
 *   7. Persist the generation into the `generations` table.
 *   8. Return the photo prompts to the client.
 *
 * Never throws — every failure path returns `{ error: string }` so the
 * client can surface a friendly toast.
 */
export async function generatePhotoPrompts(
  formData: FormData
): Promise<GeneratePhotoPromptsResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login" };
    }

    const parsed = generatePhotoSchema.safeParse({
      productId: formData.get("productId"),
      style: formData.get("style"),
      mood: formData.get("mood"),
      setting: formData.get("setting"),
      composition: formData.get("composition"),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Input tidak valid",
      };
    }

    const { productId, style, mood, setting, composition } = parsed.data;

    // 1. Atomic usage limit check + increment.
    const usage = await checkAndIncrementUsage(user.id);
    if (!usage.allowed) {
      return {
        error: `Batas 50 generate/bulan tercapai. Sisa: ${usage.remaining}.`,
      };
    }

    // 2. Load the saved product (RLS scopes to `user_id`).
    const { data: product, error: productError } = await supabase
      .from("products")
      .select(
        "id, name, category, brand, price, target_market, usp, benefits"
      )
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return { error: "Produk tidak ditemukan" };
    }

    // 3. Build prompt + call the model in JSON mode.
    const prompt = buildPhotoPrompt({
      product,
      style,
      mood,
      setting,
      composition,
    });

    const result = await generateText({
      systemPrompt: PHOTO_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
    });

    // 4. Parse the JSON-array response.
    let photos: PhotoPromptResult[];
    try {
      photos = JSON.parse(result.content) as PhotoPromptResult[];
    } catch (parseErr) {
      console.error(
        "Failed to parse photo prompts AI response:",
        result.content,
        parseErr
      );
      return { error: "AI response tidak valid. Coba lagi." };
    }

    // 5. Persist the generation (non-fatal: the user still gets the
    //    photo prompts even if the insert fails — log and move on).
    const { error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        model: result.model,
        module: "photo",
        subtype: style,
        status: "completed",
        input_prompt: prompt,
        result: photos as unknown as Json,
        tokens_used: result.tokensUsed,
        duration_ms: result.durationMs,
      });

    if (insertError) {
      console.warn("Failed to save photo prompt generation:", insertError);
    }

    return { data: photos };
  } catch (err) {
    console.error("generatePhotoPrompts error:", err);
    return {
      error:
        err instanceof Error ? err.message : "Gagal generate photo prompts",
    };
  }
}
