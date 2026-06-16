import { z } from "zod";

/**
 * Validation for the Model Prompt Generator form.
 *
 * The form has 8 fields:
 * - `productId`: UUID of a saved product from the `products` table
 * - `style`: visual treatment for the model photo (same as Photo)
 * - `mood`: emotional tone of the photo
 * - `setting`: physical environment where the model is photographed
 * - `composition`: framing/layout of the subject
 * - `gender`: pria / wanita / any
 * - `age`: remaja / dewasa / paruh baya / lansia
 * - `modelVibe`: casual / elegan / atletik / profesional
 *
 * Error messages are in Indonesian to match the UI copy.
 *
 * NOTE: This project uses Zod 4, which uses the unified `error` option
 * for custom error messages on enums.
 */
export const generateModelSchema = z.object({
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
  gender: z.enum(["pria", "wanita", "any"], {
    error: "Pilih gender model",
  }),
  age: z.enum(["remaja", "dewasa", "paruh baya", "lansia"], {
    error: "Pilih usia model",
  }),
  modelVibe: z.enum(["casual", "elegan", "atletik", "profesional"], {
    error: "Pilih vibe model",
  }),
});

export type GenerateModelInput = z.infer<typeof generateModelSchema>;
