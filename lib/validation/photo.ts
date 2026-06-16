import { z } from "zod";

/**
 * Validation for the Photo Prompt Generator form.
 *
 * The form has 5 fields:
 * - `productId`: UUID of a saved product from the `products` table
 * - `style`: visual treatment for the photo
 * - `mood`: emotional tone of the photo
 * - `setting`: physical environment where the product is photographed
 * - `composition`: framing/layout of the subject
 *
 * Error messages are in Indonesian to match the UI copy.
 *
 * NOTE: This project uses Zod 4, which uses the unified `error` option
 * for custom error messages on enums.
 */
export const generatePhotoSchema = z.object({
  productId: z.string().uuid("Pilih produk"),
  style: z.enum(["minimalist", "professional", "lifestyle", "creative"], {
    error: "Pilih style foto",
  }),
  mood: z.enum(["warm", "cool", "dramatic", "natural", "playful"], {
    error: "Pilih mood foto",
  }),
  setting: z.enum(["studio", "outdoor", "lifestyle", "macro"], {
    error: "Pilih setting foto",
  }),
  composition: z.enum(["close-up", "flat-lay", "hero", "lifestyle"], {
    error: "Pilih komposisi foto",
  }),
});

export type GeneratePhotoInput = z.infer<typeof generatePhotoSchema>;
