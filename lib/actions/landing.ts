"use server";

import { createServerClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { extractJson } from "@/lib/ai/json";
import { checkAndIncrementUsage } from "@/lib/usage/limits";
import {
  LANDING_SYSTEM_PROMPT,
  buildLandingPrompt,
} from "@/lib/ai/prompts/landing";
import { generateLandingSchema } from "@/lib/validation/landing";
import type { Json } from "@/lib/supabase/types";

/**
 * Structured output of the Landing Page Generator flow. The shape
 * mirrors the JSON schema inside `LANDING_SYSTEM_PROMPT` /
 * `buildLandingPrompt` and is persisted into `generations.result`
 * (JSONB) for history + re-use.
 *
 * Landing pages are unique in that they have a complete 7-section
 * structure: headline, subheadline, heroDescription, features (array
 * of {title, description}), pricing (array of {plan, price, features}),
 * faq (array of {question, answer}), and cta. None of the other
 * generators produce this exact shape.
 */
export interface LandingResult {
  headline: string;
  subheadline: string;
  heroDescription: string;
  features: { title: string; description: string }[];
  pricing: { plan: string; price: string; features: string[] }[];
  faq: { question: string; answer: string }[];
  cta: string;
}

export type GenerateLandingResult = {
  data?: LandingResult;
  error?: string;
};

/**
 * Server Action that runs the full Landing Page Generator pipeline
 * for the signed-in user:
 *
 *   1. Verify the user is authenticated.
 *   2. Parse + Zod-validate the submitted form (productId, tone).
 *   3. Atomically check + increment the monthly usage limit (50/month
 *      soft cap, enforced via the `increment_user_usage` Postgres RPC).
 *   4. Load the saved product (RLS already scopes to `user_id`).
 *   5. Build the prompt + call the text model in JSON mode.
 *   6. Parse the AI's JSON-object response into `LandingResult`.
 *   7. Persist the generation into the `generations` table.
 *   8. Return the landing page to the client.
 *
 * Never throws — every failure path returns `{ error: string }` so the
 * client can surface a friendly toast.
 */
export async function generateLandingPage(
  formData: FormData,
): Promise<GenerateLandingResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login" };
    }

    const parsed = generateLandingSchema.safeParse({
      productId: formData.get("productId"),
      tone: formData.get("tone"),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Input tidak valid",
      };
    }

    const { productId, tone } = parsed.data;

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
        "id, name, category, brand, price, target_market, usp, benefits",
      )
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return { error: "Produk tidak ditemukan" };
    }

    // 3. Build prompt + call the model in JSON mode.
    const prompt = buildLandingPrompt({
      product,
      tone,
    });

    const result = await generateText({
      systemPrompt: LANDING_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
    });

    // 4. Parse the JSON-object response.
    let landing: LandingResult;
    try {
      landing = extractJson<LandingResult>(result.content);
    } catch (parseErr) {
      console.error(
        "generateLandingPage: failed to parse AI JSON",
        parseErr,
        result.content,
      );
      return { error: "AI response tidak valid. Coba lagi." };
    }

    // 5. Best-effort persist into `generations` (failure here does NOT
    //    block the user from seeing their landing page).
    const { error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        product_id: productId,
        model: result.model,
        module: "landing",
        subtype: tone,
        status: "completed",
        input_prompt: prompt,
        result: landing as unknown as Json,
        tokens_used: result.tokensUsed,
        duration_ms: result.durationMs,
      });

    if (insertError) {
      console.warn("Failed to save landing generation:", insertError);
    }

    return { data: landing };
  } catch (err) {
    console.error("generateLandingPage error:", err);
    return {
      error:
        err instanceof Error ? err.message : "Gagal generate landing page",
    };
  }
}
