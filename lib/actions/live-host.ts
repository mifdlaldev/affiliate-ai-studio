"use server";

import { createServerClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { checkAndIncrementUsage } from "@/lib/usage/limits";
import {
  LIVE_HOST_SYSTEM_PROMPT,
  buildLiveHostPrompt,
} from "@/lib/ai/prompts/live-host";
import { generateLiveHostSchema } from "@/lib/validation/live-host";
import type { Json } from "@/lib/supabase/types";

/**
 * Structured output of the Live Host Script Generator flow. The shape
 * mirrors the JSON schema inside `LIVE_HOST_SYSTEM_PROMPT` /
 * `buildLiveHostPrompt` and is persisted into `generations.result`
 * (JSONB) for history + re-use.
 *
 * Unlike the Script Generator (which produces an array of script
 * variations), Live Host returns a single structured script: a title,
 * an array of time-stamped `segments`, and a closing CTA. Each
 * segment carries a `hostScript` (what the host says), `keyPoints`
 * (bullet recap), and an `engagementTip` (interaction prompt).
 */
export interface LiveHostSegment {
  time: string;
  segmentName: string;
  hostScript: string;
  keyPoints: string[];
  engagementTip: string;
}

export interface LiveHostResult {
  title: string;
  segments: LiveHostSegment[];
  cta: string;
}

export type GenerateLiveScriptResult = {
  data?: LiveHostResult;
  error?: string;
};

/**
 * Server Action that runs the full Live Host Script Generator pipeline
 * for the signed-in user:
 *
 *   1. Verify the user is authenticated.
 *   2. Parse + Zod-validate the submitted form (productId, platform,
 *      tone, audience, duration-in-minutes).
 *   3. Atomically check + increment the monthly usage limit (50/month
 *      soft cap, enforced via the `increment_user_usage` Postgres RPC).
 *   4. Load the saved product (RLS already scopes to `user_id`).
 *   5. Build the prompt + call the text model in JSON mode.
 *   6. Parse the AI's JSON response into `LiveHostResult`.
 *   7. Persist the generation into the `generations` table.
 *   8. Return the script to the client.
 *
 * Never throws — every failure path returns `{ error: string }` so the
 * client can surface a friendly toast.
 */
export async function generateLiveScript(
  formData: FormData,
): Promise<GenerateLiveScriptResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login" };
    }

    const parsed = generateLiveHostSchema.safeParse({
      productId: formData.get("productId"),
      platform: formData.get("platform"),
      tone: formData.get("tone"),
      audience: formData.get("audience"),
      duration: formData.get("duration"),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Input tidak valid",
      };
    }

    const { productId, platform, tone, audience, duration } = parsed.data;

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
    const prompt = buildLiveHostPrompt({
      product,
      platform,
      tone,
      audience,
      duration,
    });

    const result = await generateText({
      systemPrompt: LIVE_HOST_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
    });

    // 4. Parse the JSON response (single object, NOT an array).
    let script: LiveHostResult;
    try {
      script = JSON.parse(result.content) as LiveHostResult;
    } catch (parseErr) {
      console.error(
        "Failed to parse live-host AI response:",
        result.content,
        parseErr,
      );
      return { error: "AI response tidak valid. Coba lagi." };
    }

    // 5. Persist the generation (non-fatal: the user still gets the
    //    script even if the insert fails — log and move on).
    const { error: insertError } = await supabase.from("generations").insert({
      user_id: user.id,
      model: result.model,
      module: "live-host",
      subtype: platform,
      status: "completed",
      input_prompt: prompt,
      result: script as unknown as Json,
      tokens_used: result.tokensUsed,
      duration_ms: result.durationMs,
    });

    if (insertError) {
      console.warn("Failed to save live-host generation:", insertError);
    }

    return { data: script };
  } catch (err) {
    console.error("generateLiveScript error:", err);
    return {
      error:
        err instanceof Error ? err.message : "Gagal generate live script",
    };
  }
}
