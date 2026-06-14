"use server";

import { createServerClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { checkAndIncrementUsage } from "@/lib/usage/limits";
import { analyzeImage } from "@/lib/image-analysis/blip";
import {
  buildProductAnalyzePrompt,
  PRODUCT_ANALYZE_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/product-analyze";
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
 *   2. If an image was uploaded, ask BLIP-2 for a text description
 *      (non-fatal — a failed image analysis just yields empty context).
 *   3. Hand the description + reference link to DeepSeek V4 Flash via
 *      `lib/ai/client.ts` and ask for a structured JSON ProductAnalysis.
 *   4. Persist the result to `product_analyses` (non-fatal — the user
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

    // 2. Image caption via BLIP-2 (non-fatal — empty fallback is fine).
    let imageDescription = "";
    if (imageUrl) {
      try {
        imageDescription = await analyzeImage(imageUrl);
      } catch (err) {
        // Non-fatal: continue with empty description so the user still
        // gets a result based on the reference link alone.
        console.warn("BLIP-2 image analysis failed:", err);
      }
    }

    // 3. Build prompt and call AI with JSON mode enforced.
    const prompt = buildProductAnalyzePrompt(imageDescription, referenceLink);
    const result = await generateText({
      systemPrompt: PRODUCT_ANALYZE_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
    });

    // 4. Parse JSON response. AI is instructed to return JSON only, but
    //    defensive parse keeps a single bad response from killing the UX.
    let analysis: ProductAnalysis;
    try {
      analysis = JSON.parse(result.content) as ProductAnalysis;
    } catch {
      console.error("Failed to parse AI response:", result.content);
      return { error: "AI response tidak valid. Coba lagi." };
    }

    // 5. Persist to product_analyses (non-fatal — the user keeps the
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
