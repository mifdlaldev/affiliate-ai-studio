import { z } from "zod";

/**
 * Validation for the Social Media Content Calendar form.
 *
 * The form has 3 fields:
 * - `productId`: UUID of a saved product from the `products` table
 * - `platform`: which social platform the 7-day calendar is for
 *               (tiktok / instagram / youtube / twitter / facebook)
 * - `tone`: voice/style of the social copy (kasual / profesional /
 *          energik / inspiratif / edukatif)
 *
 * Error messages are in Indonesian to match the UI copy.
 *
 * NOTE: This project uses Zod 4, which uses the unified `error` option
 * for custom error messages on enums.
 */
export const generateSocialSchema = z.object({
  productId: z.string().uuid("Pilih produk"),
  platform: z.enum(
    ["tiktok", "instagram", "youtube", "twitter", "facebook"],
    { error: "Pilih platform" },
  ),
  tone: z.enum(
    ["kasual", "profesional", "energik", "inspiratif", "edukatif"],
    { error: "Pilih tone" },
  ),
});

export type GenerateSocialInput = z.infer<typeof generateSocialSchema>;
