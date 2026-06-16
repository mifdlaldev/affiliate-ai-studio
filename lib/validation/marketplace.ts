import { z } from "zod";

/**
 * Validation for the Marketplace Product Description Generator form.
 *
 * The form has 6 fields:
 * - `productId`: UUID of a saved product from the `products` table
 * - `platform`: which marketplace the listing is for (Tokopedia /
 *               Shopee / Lazada / TikTok Shop / Bukalapak)
 * - `style`: writing tone of the listing copy (profesional / kasual /
 *            persuasif / berbagi-cerita)
 * - `length`: target length bucket (pendek / sedang / panjang) — the
 *             prompt builder turns this into a word count
 * - `includeSpecs`: whether to include 1-2 technical-spec bullets in
 *                   the listing (boolean)
 * - `targetAudience`: optional free-text description of the target
 *                     audience (e.g. "ibu muda 28-40"). Optional
 *                     because the user can fall back to the product's
 *                     own `target_market` field.
 *
 * `includeSpecs` arrives as a string from the FormData (HTML form
 * checkbox). The `.transform` normalises it to a boolean so the rest
 * of the pipeline (prompt builder + action) sees a real bool.
 *
 * Error messages are in Indonesian to match the UI copy.
 *
 * NOTE: This project uses Zod 4, which uses the unified `error` option
 * for custom error messages on enums.
 */
export const generateMarketplaceSchema = z.object({
  productId: z.string().uuid("Pilih produk"),
  platform: z.enum(
    ["tokopedia", "shopee", "lazada", "tiktok-shop", "bukalapak"],
    { error: "Pilih platform" },
  ),
  style: z.enum(
    ["profesional", "kasual", "persuasif", "berbagi-cerita"],
    { error: "Pilih gaya penulisan" },
  ),
  length: z.enum(["pendek", "sedang", "panjang"], {
    error: "Pilih panjang deskripsi",
  }),
  includeSpecs: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true" || val === "on"),
  targetAudience: z
    .string()
    .min(3, "Target audience minimal 3 karakter")
    .max(500, "Target audience terlalu panjang (maks 500 karakter)")
    .nullable()
    .optional(),
});

export type GenerateMarketplaceInput = z.infer<typeof generateMarketplaceSchema>;
