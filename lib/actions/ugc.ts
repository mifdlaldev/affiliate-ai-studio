"use server";

import { createServerClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { checkAndIncrementUsage } from "@/lib/usage/limits";
import {
  UGC_SCRIPT_SYSTEM_PROMPT,
  buildUgcScriptPrompt,
} from "@/lib/ai/prompts/ugc-script";
import {
  UGC_STORYBOARD_SYSTEM_PROMPT,
  buildUgcStoryboardPrompt,
} from "@/lib/ai/prompts/ugc-storyboard";
import {
  UGC_PROMPT_SYSTEM_PROMPT,
  buildUgcPrompt,
} from "@/lib/ai/prompts/ugc-prompt";
import {
  UGC_BATCH_SYSTEM_PROMPT,
  buildUgcBatchPrompt,
} from "@/lib/ai/prompts/ugc-batch";
import {
  generateUgcScriptSchema,
  generateUgcStoryboardSchema,
  generateUgcPromptSchema,
  generateUgcBatchSchema,
} from "@/lib/validation/ugc";
import type { Json } from "@/lib/supabase/types";

// ---- Result type aliases --------------------------------------------------

export interface UgcScriptResult {
  title: string;
  text: string;
}

export interface UgcStoryboardPanel {
  panel: number;
  time: string;
  visuals: string;
  audio: string;
  text: string;
}

export interface UgcPromptItem {
  title: string;
  prompt: string;
  style: string;
  mood: string;
}

export interface UgcBatchItem {
  title: string;
  text: string;
}

export type GenerateUgcScriptResult = {
  data?: UgcScriptResult;
  error?: string;
};

export type GenerateUgcStoryboardResult = {
  data?: UgcStoryboardPanel[];
  error?: string;
};

export type GenerateUgcPromptResult = {
  data?: UgcPromptItem[];
  error?: string;
};

export type GenerateUgcBatchResult = {
  data?: UgcBatchItem[];
  error?: string;
};

// ---- 1. UGC Script --------------------------------------------------------

/**
 * Server Action that runs the full UGC Script pipeline for the
 * signed-in user:
 *
 *   1. Verify the user is authenticated.
 *   2. Parse + Zod-validate the submitted form (productId, platform,
 *      tone, audience).
 *   3. Atomically check + increment the monthly usage limit (50/month
 *      soft cap, enforced via the `increment_user_usage` Postgres RPC).
 *   4. Load the saved product (RLS already scopes to `user_id`).
 *   5. Build the prompt + call the text model in JSON mode.
 *   6. Parse the AI's JSON response into a `UgcScriptResult` (single
 *      object with `title` + `text`).
 *   7. Persist the generation into the `generations` table with
 *      `module: "ugc-script"` + `subtype: <platform>`.
 *   8. Return the script to the client.
 *
 * Never throws — every failure path returns `{ error: string }` so the
 * client can surface a friendly toast.
 */
export async function generateUgcScript(
  formData: FormData,
): Promise<GenerateUgcScriptResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login" };
    }

    const parsed = generateUgcScriptSchema.safeParse({
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
        "id, name, category, brand, price, target_market, usp, benefits",
      )
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return { error: "Produk tidak ditemukan" };
    }

    // 3. Build prompt + call the model in JSON mode.
    const prompt = buildUgcScriptPrompt({
      product,
      platform,
      tone,
      audience,
    });

    const result = await generateText({
      systemPrompt: UGC_SCRIPT_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
    });

    // 4. Parse the JSON-object response.
    let script: UgcScriptResult;
    try {
      script = JSON.parse(result.content) as UgcScriptResult;
    } catch (parseErr) {
      console.error(
        "Failed to parse UGC script AI response:",
        result.content,
        parseErr,
      );
      return { error: "AI response tidak valid. Coba lagi." };
    }

    // 5. Persist the generation (non-fatal: the user still gets the
    //    script even if the insert fails — log and move on).
    const { error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        model: result.model,
        module: "ugc-script",
        subtype: platform,
        status: "completed",
        input_prompt: prompt,
        result: script as unknown as Json,
        tokens_used: result.tokensUsed,
        duration_ms: result.durationMs,
      });

    if (insertError) {
      console.warn("Failed to save UGC script generation:", insertError);
    }

    return { data: script };
  } catch (err) {
    console.error("generateUgcScript error:", err);
    return {
      error: err instanceof Error ? err.message : "Gagal generate UGC script",
    };
  }
}

// ---- 2. UGC Storyboard ----------------------------------------------------

/**
 * Server Action that runs the full UGC Storyboard pipeline for the
 * signed-in user. Mirrors `generateUgcScript` but emits a 4-6 panel
 * storyboard (JSON array) instead of a single script.
 *
 * Steps 1-5 are identical: auth → Zod → usage limit → product load →
 * prompt + AI call. Step 6 parses the AI's JSON-array response into
 * `UgcStoryboardPanel[]`. Step 7 persists with
 * `module: "ugc-storyboard"`.
 */
export async function generateUgcStoryboard(
  formData: FormData,
): Promise<GenerateUgcStoryboardResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login" };
    }

    const parsed = generateUgcStoryboardSchema.safeParse({
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

    const prompt = buildUgcStoryboardPrompt({
      product,
      platform,
      tone,
    });

    const result = await generateText({
      systemPrompt: UGC_STORYBOARD_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
    });

    let storyboard: UgcStoryboardPanel[];
    try {
      storyboard = JSON.parse(result.content) as UgcStoryboardPanel[];
    } catch (parseErr) {
      console.error(
        "Failed to parse UGC storyboard AI response:",
        result.content,
        parseErr,
      );
      return { error: "AI response tidak valid. Coba lagi." };
    }

    const { error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        model: result.model,
        module: "ugc-storyboard",
        subtype: platform,
        status: "completed",
        input_prompt: prompt,
        result: storyboard as unknown as Json,
        tokens_used: result.tokensUsed,
        duration_ms: result.durationMs,
      });

    if (insertError) {
      console.warn("Failed to save UGC storyboard generation:", insertError);
    }

    return { data: storyboard };
  } catch (err) {
    console.error("generateUgcStoryboard error:", err);
    return {
      error:
        err instanceof Error ? err.message : "Gagal generate UGC storyboard",
    };
  }
}

// ---- 3. UGC Prompt (image) -------------------------------------------------

/**
 * Server Action that runs the full UGC Image-Prompt pipeline.
 *
 * Output is a JSON array of `{ title, prompt, style, mood }` objects
 * — each `prompt` is an English text ready to paste into Midjourney /
 * Stable Diffusion / DALL-E. The `subtype` column stores the
 * `style` so the dashboard can filter history by style.
 */
export async function generateUgcPrompt(
  formData: FormData,
): Promise<GenerateUgcPromptResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login" };
    }

    const parsed = generateUgcPromptSchema.safeParse({
      productId: formData.get("productId"),
      style: formData.get("style"),
      mood: formData.get("mood"),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Input tidak valid",
      };
    }

    const { productId, style, mood } = parsed.data;

    const usage = await checkAndIncrementUsage(user.id);
    if (!usage.allowed) {
      return {
        error: `Batas 50 generate/bulan tercapai. Sisa: ${usage.remaining}.`,
      };
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, category, brand, benefits, usp")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return { error: "Produk tidak ditemukan" };
    }

    const prompt = buildUgcPrompt({
      product,
      style,
      mood,
    });

    const result = await generateText({
      systemPrompt: UGC_PROMPT_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
    });

    let prompts: UgcPromptItem[];
    try {
      prompts = JSON.parse(result.content) as UgcPromptItem[];
    } catch (parseErr) {
      console.error(
        "Failed to parse UGC prompt AI response:",
        result.content,
        parseErr,
      );
      return { error: "AI response tidak valid. Coba lagi." };
    }

    const { error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        model: result.model,
        module: "ugc-prompt",
        subtype: style,
        status: "completed",
        input_prompt: prompt,
        result: prompts as unknown as Json,
        tokens_used: result.tokensUsed,
        duration_ms: result.durationMs,
      });

    if (insertError) {
      console.warn("Failed to save UGC prompt generation:", insertError);
    }

    return { data: prompts };
  } catch (err) {
    console.error("generateUgcPrompt error:", err);
    return {
      error: err instanceof Error ? err.message : "Gagal generate UGC prompt",
    };
  }
}

// ---- 4. UGC Batch ---------------------------------------------------------

/**
 * Server Action that runs the full UGC Batch pipeline: generate one
 * UGC script per product in a single AI call.
 *
 * Steps 1-3 are identical to the single-product actions. Step 4
 * loads ALL selected products in a single query (`.in("id", ...)`).
 * The model's JSON-array response is parsed into `UgcBatchItem[]`
 * (one per product, in the same order as the input). Persists with
 * `module: "ugc-batch"`.
 */
export async function generateUgcBatch(
  formData: FormData,
): Promise<GenerateUgcBatchResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login" };
    }

    // `productIds` is submitted as repeated form fields, so `getAll`
    // returns the full list.
    const parsed = generateUgcBatchSchema.safeParse({
      productIds: formData.getAll("productIds"),
      platform: formData.get("platform"),
      tone: formData.get("tone"),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Input tidak valid",
      };
    }

    const { productIds, platform, tone } = parsed.data;

    const usage = await checkAndIncrementUsage(user.id);
    if (!usage.allowed) {
      return {
        error: `Batas 50 generate/bulan tercapai. Sisa: ${usage.remaining}.`,
      };
    }

    // Load ALL selected products in a single round-trip. RLS scopes
    // the query to the signed-in user's `user_id`. If the user
    // submits product IDs they don't own, those rows are filtered
    // out by RLS and we'd end up with an empty list.
    const { data: products } = await supabase
      .from("products")
      .select("id, name, category, brand")
      .in("id", productIds);

    if (!products || products.length === 0) {
      return { error: "Produk tidak ditemukan" };
    }

    const prompt = buildUgcBatchPrompt({
      products,
      platform,
      tone,
    });

    const result = await generateText({
      systemPrompt: UGC_BATCH_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
    });

    let batch: UgcBatchItem[];
    try {
      batch = JSON.parse(result.content) as UgcBatchItem[];
    } catch (parseErr) {
      console.error(
        "Failed to parse UGC batch AI response:",
        result.content,
        parseErr,
      );
      return { error: "AI response tidak valid. Coba lagi." };
    }

    const { error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        model: result.model,
        module: "ugc-batch",
        subtype: platform,
        status: "completed",
        input_prompt: prompt,
        result: batch as unknown as Json,
        tokens_used: result.tokensUsed,
        duration_ms: result.durationMs,
      });

    if (insertError) {
      console.warn("Failed to save UGC batch generation:", insertError);
    }

    return { data: batch };
  } catch (err) {
    console.error("generateUgcBatch error:", err);
    return {
      error: err instanceof Error ? err.message : "Gagal generate UGC batch",
    };
  }
}
