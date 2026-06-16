import { z } from "zod";

/**
 * Validation for the Caption Generator form.
 *
 * The form has 5 fields:
 * - `productId`: UUID of a saved product from the `products` table
 * - `platform`: which social platform the caption will be posted on
 * - `tone`: writing style for the caption
 * - `audience`: optional free-text description of the target audience
 *               (e.g. "ibu rumah tangga 30-45", "mahasiswi semester 1-2").
 *               Optional because the user can fall back to the product's
 *               own `target_market` field.
 * - `cta`: optional call-to-action type. When omitted, the model picks a
 *          contextually appropriate one.
 *
 * Error messages are in Indonesian to match the UI copy.
 *
 * NOTE: This project uses Zod 4, which uses the unified `error` option
 * for custom error messages on enums.
 */
export const generateCaptionsSchema = z.object({
  productId: z.string().uuid("Pilih produk"),
  platform: z.enum(
    ["tiktok", "instagram", "youtube", "twitter", "facebook"],
    { error: "Pilih platform" },
  ),
  tone: z.enum(
    ["casual", "professional", "funny", "inspirational", "controversial"],
    { error: "Pilih tone" },
  ),
  audience: z
    .string()
    .min(3, "Target audience minimal 3 karakter")
    .max(500, "Target audience terlalu panjang (maks 500 karakter)")
    .nullable()
    .optional(),
  cta: z
    .enum(["beli-sekarang", "daftar", "kunjungi", "tanya"])
    .nullable()
    .optional(),
});

export type GenerateCaptionsInput = z.infer<typeof generateCaptionsSchema>;
