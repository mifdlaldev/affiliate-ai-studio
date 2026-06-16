import { z } from "zod";

/**
 * Validation for the Competitor Analyzer form.
 *
 * The form has 3 fields:
 * - `productId`: UUID of a saved product from the `products` table.
 *                The product is the comparison anchor — the model uses
 *                its name/category/brand/price/target_market/usp to
 *                frame the competitor's strengths/weaknesses as a
 *                *differential* vs the user's own product.
 * - `competitorUrl`: URL of the competitor's product listing on the
 *                    chosen marketplace. Min 10 chars (to skip empty
 *                    paste), max 1000 chars (defensive cap — real
 *                    marketplace URLs are well under 500 chars).
 * - `platform`: which Indonesian marketplace the competitor URL is on
 *               (Shopee / Tokopedia / TikTok Shop / Lazada). Used so
 *               the model knows which marketplace's listing format to
 *               expect (Shopee seller notes differ from Tokopedia,
 *               TikTok Shop has UGC-heavy content, Lazada has coupon
 *               stacks, etc.).
 *
 * Error messages are in Indonesian to match the UI copy.
 *
 * NOTE: This project uses Zod 4, which uses the unified `error` option
 * for custom error messages on enums.
 */
export const analyzeCompetitorSchema = z.object({
  productId: z.string().uuid("Pilih produk"),
  competitorUrl: z
    .string()
    .url("Format URL tidak valid")
    .min(10, "URL kompetitor terlalu pendek")
    .max(1000, "URL kompetitor terlalu panjang (maks 1000 karakter)"),
  platform: z.enum(["shopee", "tokopedia", "tiktok-shop", "lazada"], {
    error: "Pilih platform marketplace",
  }),
});

export type AnalyzeCompetitorInput = z.infer<typeof analyzeCompetitorSchema>;
