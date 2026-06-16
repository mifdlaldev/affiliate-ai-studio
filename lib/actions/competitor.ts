"use server";

import { createServerClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { checkAndIncrementUsage } from "@/lib/usage/limits";
import {
  COMPETITOR_SYSTEM_PROMPT,
  buildCompetitorPrompt,
  type CompetitorPlatform,
} from "@/lib/ai/prompts/competitor";
import { analyzeCompetitorSchema } from "@/lib/validation/competitor";
import type { Json } from "@/lib/supabase/types";

/**
 * Structured output of the Competitor Analyzer flow. The shape mirrors the
 * JSON schema inside `COMPETITOR_SYSTEM_PROMPT` / `buildCompetitorPrompt`
 * and is persisted into `competitor_analyses.analysis_result` (JSONB) so
 * the user can re-open a past analysis without re-running the model.
 *
 * - `competitorName` / `priceRange` / `rating` come from the competitor's
 *   marketplace listing (or the model's best-effort estimate when the
 *   page could not be fetched).
 * - `strengths` / `weaknesses` are framed as a *differential* against the
 *   user's own product (so they read as comparison, not absolute).
 * - `contentGaps` is the highest-value field for affiliate marketers —
 *   concrete content ideas the competitor has not covered yet.
 * - `recommendations` translates the gaps into a concrete content plan
 *   (angle, target audience, platform, format).
 * - `overallAssessment` is a short conversational summary in Bahasa
 *   Indonesia that the UI can show as the headline insight.
 */
export interface CompetitorAnalysis {
  competitorName: string;
  priceRange: string;
  rating: string;
  strengths: string[];
  weaknesses: string[];
  contentGaps: string[];
  recommendations: string[];
  overallAssessment: string;
}

export type AnalyzeCompetitorResult = {
  data?: CompetitorAnalysis;
  error?: string;
};

/**
 * Server Action that runs the full Competitor Analyzer pipeline for the
 * signed-in user:
 *
 *   1. Verify the user is authenticated.
 *   2. Parse + Zod-validate the submitted form (productId, competitorUrl,
 *      platform).
 *   3. Atomically check + increment the user's monthly usage limit.
 *   4. Load the saved product (the comparison anchor) — RLS scopes the
 *      select to `user_id`.
 *   5. Build the user prompt + call the text model in JSON mode.
 *   6. Parse the AI's JSON-object response into `CompetitorAnalysis`.
 *   7. Persist the analysis into the `competitor_analyses` table.
 *   8. Return the analysis to the client.
 *
 * The competitor URL is stored in `shopee_url` or `tiktok_url`
 * depending on the chosen platform (Tokopedia / Lazada URLs fall
 * through as `null` in both columns for now — the model's analysis
 * is still saved and retrievable via the row id).
 *
 * Never throws — every failure path returns `{ error: string }` so
 * the client can surface a friendly toast.
 */
export async function analyzeCompetitor(
  formData: FormData,
): Promise<AnalyzeCompetitorResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login" };
    }

    const parsed = analyzeCompetitorSchema.safeParse({
      productId: formData.get("productId"),
      competitorUrl: formData.get("competitorUrl"),
      platform: formData.get("platform"),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Input tidak valid",
      };
    }

    const { productId, competitorUrl, platform } = parsed.data;

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
      .select("id, name, category, brand, price, target_market, usp")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return { error: "Produk tidak ditemukan" };
    }

    // 3. Build prompt + call the model in JSON mode.
    const prompt = buildCompetitorPrompt({
      product,
      competitorUrl,
      platform: platform as CompetitorPlatform,
    });

    const result = await generateText({
      systemPrompt: COMPETITOR_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
    });

    // 4. Parse the JSON-object response.
    let analysis: CompetitorAnalysis;
    try {
      const parsedJson: unknown = JSON.parse(result.content);
      analysis = parsedJson as CompetitorAnalysis;
    } catch (parseErr) {
      console.error(
        "analyzeCompetitor: failed to parse AI JSON response",
        parseErr,
      );
      return { error: "AI response tidak valid. Coba lagi." };
    }

    // 5. Persist to competitor_analyses (best-effort: log + continue on
    //    insert failure so the user still gets their analysis).
    const { error: insertError } = await supabase
      .from("competitor_analyses")
      .insert({
        user_id: user.id,
        shopee_url: platform === "shopee" ? competitorUrl : null,
        tiktok_url: platform === "tiktok-shop" ? competitorUrl : null,
        analysis_result: analysis as unknown as Json,
        tokens_used: result.tokensUsed,
      });

    if (insertError) {
      console.warn("Failed to save competitor analysis:", insertError);
    }

    return { data: analysis };
  } catch (err) {
    console.error("analyzeCompetitor error:", err);
    return {
      error:
        err instanceof Error ? err.message : "Gagal menganalisis kompetitor",
    };
  }
}
