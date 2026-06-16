"use server";

import { createServerClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { checkAndIncrementUsage } from "@/lib/usage/limits";
import {
  CALENDAR_SYSTEM_PROMPT,
  buildCalendarPrompt,
} from "@/lib/ai/prompts/calendar";
import { generateCalendarSchema } from "@/lib/validation/calendar";
import type { Json } from "@/lib/supabase/types";

/**
 * Structured output of the Content Calendar Generator flow. The shape
 * mirrors the JSON schema inside `CALENDAR_SYSTEM_PROMPT` /
 * `buildCalendarPrompt` and is persisted into `generations.result` (JSONB)
 * for history + re-use.
 *
 * The `day` is 1-indexed (1 = first day of the target month). The
 * `productId` + `productName` are echoed from the user-selected product
 * list (so the calendar can be re-attached to the same products later
 * via the `result` JSONB column). `contentType` + `platform` follow
 * the user's chosen content rotation; `topic` + `hook` are the actual
 * copy that the content creator can execute the next day.
 */
export interface CalendarDayResult {
  day: number;
  productId: string;
  productName: string;
  contentType: string;
  platform: string;
  topic: string;
  hook: string;
}

export type GenerateCalendarResult = {
  data?: CalendarDayResult[];
  error?: string;
};

/**
 * Server Action that runs the full Content Calendar Generator pipeline
 * for the signed-in user:
 *
 *   1. Verify the user is authenticated.
 *   2. Parse + Zod-validate the submitted form (productIds, month, year,
 *      contentTypes, platform, tone).
 *   3. Atomically check + increment the monthly usage limit (50/month
 *      soft cap, enforced via the `increment_user_usage` Postgres RPC).
 *   4. Load ALL selected products in a single query (`.in("id", ...)`)
 *      so the model can spread them across the month.
 *   5. Build the prompt + call the text model in JSON mode.
 *   6. Parse the AI's JSON-array response into `CalendarDayResult[]`.
 *   7. Persist the generation into the `generations` table.
 *   8. Return the calendar to the client.
 *
 * Never throws — every failure path returns `{ error: string }` so the
 * client can surface a friendly toast.
 */
export async function generateCalendar(
  formData: FormData
): Promise<GenerateCalendarResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login" };
    }

    // Arrays (`productIds`, `contentTypes`) are submitted as repeated
    // form fields, so `getAll` returns the full list. Numbers come back
    // as strings from FormData and need an explicit `Number()` cast
    // before Zod's `z.number()` validator can accept them.
    const parsed = generateCalendarSchema.safeParse({
      productIds: formData.getAll("productIds"),
      month: Number(formData.get("month")),
      year: Number(formData.get("year")),
      contentTypes: formData.getAll("contentTypes"),
      platform: formData.get("platform"),
      tone: formData.get("tone"),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Input tidak valid",
      };
    }

    const { productIds, month, year, contentTypes, platform, tone } =
      parsed.data;

    // 1. Atomic usage limit check + increment.
    const usage = await checkAndIncrementUsage(user.id);
    if (!usage.allowed) {
      return {
        error: `Batas 50 generate/bulan tercapai. Sisa: ${usage.remaining}.`,
      };
    }

    // 2. Load ALL selected products in a single round-trip. RLS scopes
    //    the query to the signed-in user's `user_id`, so we never see
    //    products owned by other users. If the user somehow submits
    //    product IDs they don't own, those rows are filtered out by RLS
    //    and we'd end up with an empty list — handle that case.
    const { data: products } = await supabase
      .from("products")
      .select("id, name, category, brand")
      .in("id", productIds);

    if (!products || products.length === 0) {
      return { error: "Produk tidak ditemukan" };
    }

    // 3. Build prompt + call the model in JSON mode.
    const prompt = buildCalendarPrompt({
      products,
      month,
      year,
      contentTypes,
      platform,
      tone,
    });

    const result = await generateText({
      systemPrompt: CALENDAR_SYSTEM_PROMPT,
      prompt,
      jsonMode: true,
    });

    // 4. Parse the JSON-array response.
    let calendar: CalendarDayResult[];
    try {
      calendar = JSON.parse(result.content) as CalendarDayResult[];
    } catch (parseErr) {
      console.error(
        "Failed to parse calendar AI response:",
        result.content,
        parseErr,
      );
      return { error: "AI response tidak valid. Coba lagi." };
    }

    // 5. Persist the generation (non-fatal: the user still gets the
    //    calendar even if the insert fails — log and move on).
    //    `subtype` stores the target month in ISO-ish form (YYYY-MM) so
    //    the dashboard can later filter history by month.
    const subtype = `${year}-${String(month).padStart(2, "0")}`;
    const { error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        model: result.model,
        module: "calendar",
        subtype,
        status: "completed",
        input_prompt: prompt,
        result: calendar as unknown as Json,
        tokens_used: result.tokensUsed,
        duration_ms: result.durationMs,
      });

    if (insertError) {
      console.warn("Failed to save calendar generation:", insertError);
    }

    return { data: calendar };
  } catch (err) {
    console.error("generateCalendar error:", err);
    return {
      error:
        err instanceof Error ? err.message : "Gagal generate content calendar",
    };
  }
}
