import { z } from "zod";

/**
 * Validation for the Script Generator form.
 *
 * The form has 5 fields:
 * - `productId`: UUID of a saved product from the `products` table
 * - `platform`: which social platform the video will be posted on
 * - `tone`: writing style for the script
 * - `audience`: optional free-text description of the target audience
 *               (e.g. "ibu rumah tangga 30-45", "mahasiswi semester 1-2").
 *               Optional because the user can fall back to the product's
 *               own `target_market` field.
 * - `duration`: total video duration in seconds. Only 15, 30, and 60 are
 *               supported because the prompt builder is calibrated to
 *               scene counts that fit those buckets.
 *
 * Error messages are in Indonesian to match the UI copy.
 *
 * NOTE: This project uses Zod 4, which uses the unified `error` option
 * for custom error messages on enums.
 */
export const generateScriptSchema = z.object({
  productId: z.string().uuid("Pilih produk"),
  platform: z.enum(["tiktok", "instagram", "youtube"], {
    error: "Pilih platform",
  }),
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
  duration: z.enum(["15", "30", "60"], {
    error: "Pilih durasi video",
  }),
});

export type GenerateScriptInput = z.infer<typeof generateScriptSchema>;
