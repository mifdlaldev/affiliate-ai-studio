"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { VISION_MODEL, VISION_REASONING_EFFORT } from "@/lib/ai/config";
import { extractJson } from "@/lib/ai/json";
import { checkAndIncrementUsage } from "@/lib/usage/limits";
import {
  buildProductAnalyzePrompt,
  PRODUCT_ANALYZE_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/product-analyze";
import {
  productSchema,
  type ProductInput,
} from "@/lib/validation/product";
import type { Json } from "@/lib/supabase/types";

/**
 * Structured output of the Product Auto-Analyze flow. The shape mirrors
 * the JSON schema inside `buildProductAnalyzePrompt` and the column shape
 * of the `products` table (so we can pipe it into Task 12's "Save product"
 * step without reshaping).
 */
export interface ProductAnalysis {
  name: string;
  category: string;
  brand: string;
  price: string;
  target_market: string;
  usp: string;
  benefits: string;
}

export type AnalyzeProductResult = {
  data?: ProductAnalysis;
  error?: string;
};

type SourceType = "image" | "link" | "both";

/**
 * Run the full Product Auto-Analyze pipeline for the signed-in user:
 *
 *   1. Check the user's monthly usage limit (atomic via Postgres RPC).
 *   2. Send the image (data URL) + reference link to MiMo-V2.5-Free
 *      (vision-capable model on OpenCode Zen) via `lib/ai/client.ts`
 *      and ask for a structured JSON ProductAnalysis. If no image is
 *      provided, the text-only DeepSeek V4 Flash model is used.
 *   3. Persist the result to `product_analyses` (non-fatal — the user
 *      still gets their result even if the insert fails).
 *
 * The function never throws — all failure paths return an
 * `{ error: string }` payload so the client can show a toast.
 */
export async function analyzeProduct(
  imageUrl: string,
  referenceLink: string
): Promise<AnalyzeProductResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login terlebih dahulu" };
    }

    // 1. Atomic usage limit check + increment.
    const usage = await checkAndIncrementUsage(user.id);
    if (!usage.allowed) {
      return {
        error: `Anda sudah mencapai batas 50 generate bulan ini. Sisa: ${usage.remaining}. Coba lagi bulan depan.`,
      };
    }

    // 2. Build prompt and call the model. Vision-capable model is used
    //    when an image is provided; otherwise the text-only primary
    //    (DeepSeek V4 Flash Free) is used. The vision call also pins
    //    `reasoning` to a value MiMo accepts (primary's default `"max"`
    //    is rejected with 400 by the Xiaomi provider).
    const prompt = buildProductAnalyzePrompt({ imageUrl, linkContext: referenceLink });
    const result = await generateText({
      systemPrompt: PRODUCT_ANALYZE_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
      ...(imageUrl
        ? {
            model: VISION_MODEL,
            imageUrl,
            reasoning: VISION_REASONING_EFFORT,
          }
        : {}),
    });

    // 3. Parse JSON response. AI is instructed to return JSON only, but
    //    models like MiMo-V2.5 (with reasoning_effort: "high") often wrap
    //    the answer in a markdown code block. `extractJson` handles that.
    let analysis: ProductAnalysis;
    try {
      analysis = extractJson<ProductAnalysis>(result.content);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", result.content, parseErr);
      return { error: "AI response tidak valid. Coba lagi." };
    }

    // 4. Persist to product_analyses (non-fatal — the user keeps the
    //    in-memory result either way).
    const sourceType: SourceType =
      imageUrl && referenceLink ? "both" : imageUrl ? "image" : "link";

    const { error: insertError } = await supabase
      .from("product_analyses")
      .insert({
        user_id: user.id,
        source_type: sourceType,
        source_url: imageUrl || referenceLink || null,
        analysis_result: analysis as unknown as Json,
        tokens_used: result.tokensUsed,
      });

    if (insertError) {
      console.warn("Failed to save product analysis:", insertError);
    }

    return { data: analysis };
  } catch (err) {
    console.error("analyzeProduct error:", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Gagal menganalisis produk. Coba lagi.",
    };
  }
}

export type SaveProductResult = {
  success?: boolean;
  productId?: string;
  error?: string;
};

/**
 * Persist a product (filled in by Auto-Analyze and edited by the user)
 * to the `products` table. The row is always tagged with the signed-in
 * user's `id` from the Supabase Auth session, so RLS policies can scope
 * reads/writes to the owner.
 *
 * Validation is delegated to `productSchema` (see
 * `lib/validation/product.ts`); the first issue's message is surfaced
 * to the caller verbatim in Indonesian.
 *
 * Like `analyzeProduct`, this function never throws — it returns a
 * `{ error: string }` payload on every failure path so the client can
 * toast the user.
 */
export async function saveProduct(
  input: ProductInput
): Promise<SaveProductResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login terlebih dahulu" };
    }

    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        error: firstIssue?.message ?? "Validasi gagal",
      };
    }

    // Coerce empty strings to null for nullable URL columns so the table
    // stores a single canonical representation of "no value".
    const data = parsed.data;
    const imageUrl =
      data.image_url === "" || data.image_url == null ? null : data.image_url;
    const referenceLink =
      data.reference_link === "" || data.reference_link == null
        ? null
        : data.reference_link;

    const { data: inserted, error } = await supabase
      .from("products")
      .insert({
        user_id: user.id,
        name: data.name,
        category: data.category ?? null,
        brand: data.brand ?? null,
        price: data.price ?? null,
        target_market: data.target_market ?? null,
        usp: data.usp ?? null,
        benefits: data.benefits ?? null,
        image_url: imageUrl,
        reference_link: referenceLink,
      })
      .select("id")
      .single();

    if (error) {
      console.error("saveProduct error:", error);
      return { error: `Gagal menyimpan: ${error.message}` };
    }

    revalidatePath("/produk");
    return { success: true, productId: inserted.id };
  } catch (err) {
    console.error("saveProduct unexpected error:", err);
    return {
      error:
        err instanceof Error ? err.message : "Gagal menyimpan produk",
    };
  }
}

export type DeleteProductResult = {
  success?: boolean;
  error?: string;
};

/**
 * Delete a product owned by the signed-in user. RLS already enforces
 * `user_id = auth.uid()`, so a row that doesn't belong to the caller
 * simply won't be matched — we still pass `.eq("user_id", user.id)`
 * for defense-in-depth so the query is explicit about ownership.
 *
 * Never throws — returns `{ error: string }` on every failure path
 * so the client can toast the user.
 */
export async function deleteProduct(
  productId: string
): Promise<DeleteProductResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login terlebih dahulu" };
    }

    // RLS will enforce user_id check, but we add explicit filter for safety
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("user_id", user.id);

    if (error) {
      console.error("deleteProduct error:", error);
      return { error: `Gagal menghapus: ${error.message}` };
    }

    revalidatePath("/produk");
    return { success: true };
  } catch (err) {
    console.error("deleteProduct unexpected error:", err);
    return {
      error: err instanceof Error ? err.message : "Gagal menghapus produk",
    };
  }
}
