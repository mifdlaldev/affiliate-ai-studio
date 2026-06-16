"use server";

import { createServerClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { checkAndIncrementUsage } from "@/lib/usage/limits";
import {
  MODEL_SYSTEM_PROMPT,
  buildModelPrompt,
} from "@/lib/ai/prompts/model";
import { generateModelSchema } from "@/lib/validation/model";
import type { Json } from "@/lib/supabase/types";

/**
 * Structured output of the Model Prompt Generator flow. The shape
 * mirrors the JSON schema inside `MODEL_SYSTEM_PROMPT` / `buildModelPrompt`
 * and is persisted into `generations.result` (JSONB) for history + re-use.
 *
 * Extends the Photo Prompt schema with a `modelDescription` field that
 * describes the model (age, gender, vibe, pose, clothing) separately
 * from the visual prompt. The `prompt` field is the English visual
 * prompt for Midjourney / Leonardo / DALL-E; the remaining metadata
 * fields are in Bahasa Indonesia to match the dashboard's UI copy.
 */
export interface ModelPromptResult {
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
  modelDescription: string;
}

export type GenerateModelPromptsResult = {
  data?: ModelPromptResult[];
  error?: string;
};

/**
 * Server Action that runs the full Model Prompt Generator pipeline for
 * the signed-in user:
 *
 *   1. Verify the user is authenticated.
 *   2. Parse + Zod-validate the submitted form (productId, style, mood,
 *      setting, composition, gender, age, modelVibe).
 *   3. Atomically check + increment the monthly usage limit (50/month
 *      soft cap, enforced via the `increment_user_usage` Postgres RPC).
 *   4. Load the saved product (RLS already scopes to `user_id`).
 *   5. Build the prompt + call the text model in JSON mode.
 *   6. Parse the AI's JSON-array response into `ModelPromptResult[]`.
 *   7. Persist the generation into the `generations` table.
 *   8. Return the model prompts to the client.
 *
 * Never throws — every failure path returns `{ error: string }` so the
 * client can surface a friendly toast.
 */
export async function generateModelPrompts(
  formData: FormData
): Promise<GenerateModelPromptsResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login" };
    }

    const parsed = generateModelSchema.safeParse({
      productId: formData.get("productId"),
      style: formData.get("style"),
      mood: formData.get("mood"),
      setting: formData.get("setting"),
      composition: formData.get("composition"),
      gender: formData.get("gender"),
      age: formData.get("age"),
      modelVibe: formData.get("modelVibe"),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Input tidak valid",
      };
    }

    const {
      productId,
      style,
      mood,
      setting,
      composition,
      gender,
      age,
      modelVibe,
    } = parsed.data;

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
    const prompt = buildModelPrompt({
      product,
      style,
      mood,
      setting,
      composition,
      gender,
      age,
      modelVibe,
    });

    const result = await generateText({
      systemPrompt: MODEL_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
    });

    // 4. Parse the JSON-array response.
    let models: ModelPromptResult[];
    try {
      models = JSON.parse(result.content) as ModelPromptResult[];
    } catch (parseErr) {
      console.error(
        "Failed to parse model prompts AI response:",
        result.content,
        parseErr
      );
      return { error: "AI response tidak valid. Coba lagi." };
    }

    // 5. Persist the generation (non-fatal: the user still gets the
    //    model prompts even if the insert fails — log and move on).
    const { error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        model: result.model,
        module: "model",
        subtype: gender,
        status: "completed",
        input_prompt: prompt,
        result: models as unknown as Json,
        tokens_used: result.tokensUsed,
        duration_ms: result.durationMs,
      });

    if (insertError) {
      console.warn("Failed to save model prompt generation:", insertError);
    }

    return { data: models };
  } catch (err) {
    console.error("generateModelPrompts error:", err);
    return {
      error:
        err instanceof Error ? err.message : "Gagal generate model prompts",
    };
  }
}
