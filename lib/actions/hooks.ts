"use server";

import { createServerClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { checkAndIncrementUsage } from "@/lib/usage/limits";
import {
  HOOK_SYSTEM_PROMPT,
  buildHookPrompt,
} from "@/lib/ai/prompts/hook";
import { generateHooksSchema } from "@/lib/validation/hook";
import type { Json } from "@/lib/supabase/types";

/**
 * Structured output of the Hook Generator flow. The shape mirrors the
 * JSON schema inside `HOOK_SYSTEM_PROMPT` / `buildHookPrompt` and is
 * persisted into `generations.result` (JSONB) for history + re-use.
 */
export interface HookResult {
  text: string;
  platform: string;
  tone: string;
  note?: string;
}

export type GenerateHooksResult = {
  data?: HookResult[];
  error?: string;
};

/**
 * Server Action that runs the full Hook Generator pipeline for the
 * signed-in user:
 *
 *   1. Verify the user is authenticated.
 *   2. Parse + Zod-validate the submitted form (productId, platform,
 *      tone, audience).
 *   3. Atomically check + increment the monthly usage limit (50/month
 *      soft cap, enforced via the `increment_user_usage` Postgres RPC).
 *   4. Load the saved product (RLS already scopes to `user_id`).
 *   5. Build the prompt + call the text model in JSON mode.
 *   6. Parse the AI's JSON-array response into `HookResult[]`.
 *   7. Persist the generation into the `generations` table.
 *   8. Return the hooks to the client.
 *
 * Never throws — every failure path returns `{ error: string }` so the
 * client can surface a friendly toast.
 */
export async function generateHooks(
  formData: FormData
): Promise<GenerateHooksResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login" };
    }

    const parsed = generateHooksSchema.safeParse({
      productId: formData.get("productId"),
      platform: formData.get("platform"),
      tone: formData.get("tone"),
      audience: formData.get("audience"),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Input tidak valid",
      };
    }

    const { productId, platform, tone, audience } = parsed.data;

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
    const prompt = buildHookPrompt({ product, platform, tone, audience });

    const result = await generateText({
      systemPrompt: HOOK_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
    });

    // 4. Parse the JSON-array response.
    let hooks: HookResult[];
    try {
      hooks = JSON.parse(result.content) as HookResult[];
    } catch (parseErr) {
      console.error(
        "Failed to parse hooks AI response:",
        result.content,
        parseErr
      );
      return { error: "AI response tidak valid. Coba lagi." };
    }

    // 5. Persist the generation (non-fatal: the user still gets the
    //    hooks even if the insert fails — log and move on).
    const { error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        model: result.model,
        module: "hook",
        subtype: platform,
        status: "completed",
        input_prompt: prompt,
        result: hooks as unknown as Json,
        tokens_used: result.tokensUsed,
        duration_ms: result.durationMs,
      });

    if (insertError) {
      console.warn("Failed to save hook generation:", insertError);
    }

    return { data: hooks };
  } catch (err) {
    console.error("generateHooks error:", err);
    return {
      error: err instanceof Error ? err.message : "Gagal generate hooks",
    };
  }
}
