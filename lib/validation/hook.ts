import { z } from "zod";

/**
 * Validation for the Hook Generator form.
 *
 * The form has 4 fields:
 * - `productId`: UUID of a saved product from the `products` table
 * - `platform`: which social platform the hooks will be used on
 * - `tone`: writing style for the hooks
 * - `audience`: optional free-text description of the target audience
 *               (e.g. "ibu rumah tangga 30-45", "mahasiswi semester 1-2").
 *               Optional because the user can fall back to the product's
 *               own `target_market` field.
 *
 * Error messages are in Indonesian to match the UI copy.
 *
 * NOTE: The original spec wrote `required_error: "..."` (a Zod 3 option).
 * This project uses Zod 4, which removed `required_error` in favor of the
 * unified `error` option. Same UX, modern API.
 */
export const generateHooksSchema = z.object({
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
});

export type GenerateHooksInput = z.infer<typeof generateHooksSchema>;
