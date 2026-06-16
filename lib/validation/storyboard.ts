import { z } from "zod";

/**
 * Validation for the Storyboard Generator form.
 *
 * The form has 4 fields:
 * - `productId`: UUID of a saved product from the `products` table
 * - `platform`: which social platform the storyboard targets
 * - `tone`: writing style for the audio narration
 * - `duration`: total video duration in seconds. Only 15, 30, and 60
 *   are supported because the prompt builder is calibrated to
 *   panel counts that fit those buckets (6 / 7 / 8 panels).
 *
 * Error messages are in Indonesian to match the UI copy.
 *
 * NOTE: This project uses Zod 4, which uses the unified `error` option
 * for custom error messages on enums.
 */
export const generateStoryboardSchema = z.object({
  productId: z.string().uuid("Pilih produk"),
  platform: z.enum(["tiktok", "instagram", "youtube"], {
    error: "Pilih platform",
  }),
  tone: z.enum(
    ["casual", "professional", "funny", "inspirational", "controversial"],
    { error: "Pilih tone" },
  ),
  duration: z.enum(["15", "30", "60"], {
    error: "Pilih durasi video",
  }),
});

export type GenerateStoryboardInput = z.infer<typeof generateStoryboardSchema>;
