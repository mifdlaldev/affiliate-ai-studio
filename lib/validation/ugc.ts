import { z } from "zod";

/**
 * Validation schemas for the UGC Generator (4 sub-modules).
 *
 * The UGC page (`/ugc`) has 4 tabs, each with its own form:
 * - `UGC Script`     → `generateUgcScriptSchema` (1 product + platform + tone + audience)
 * - `UGC Storyboard` → `generateUgcStoryboardSchema` (1 product + platform + tone)
 * - `UGC Prompt`     → `generateUgcPromptSchema` (1 product + style + mood)
 * - `UGC Batch`      → `generateUgcBatchSchema` (2-5 products + platform + tone)
 *
 * UGC = User-Generated Content. The platform enum is intentionally
 * limited to the 4 platforms where UGC video performs best
 * (tiktok, instagram, youtube, facebook) — twitter is excluded
 * because UGC short video doesn't fit its text-first format.
 *
 * The tone enum matches the rest of the dashboard modules
 * (script, hook, calendar) so users can carry their voice across
 * the whole content workflow.
 *
 * Error messages are in Indonesian to match the UI copy.
 *
 * NOTE: This project uses Zod 4, which uses the unified `error` option
 * for custom error messages on enums.
 */

// ---- 1. UGC Script --------------------------------------------------------

export const generateUgcScriptSchema = z.object({
  productId: z.string().uuid("Pilih produk"),
  platform: z.enum(["tiktok", "instagram", "youtube", "facebook"], {
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
});

export type GenerateUgcScriptInput = z.infer<typeof generateUgcScriptSchema>;

// ---- 2. UGC Storyboard ----------------------------------------------------

export const generateUgcStoryboardSchema = z.object({
  productId: z.string().uuid("Pilih produk"),
  platform: z.enum(["tiktok", "instagram", "youtube", "facebook"], {
    error: "Pilih platform",
  }),
  tone: z.enum(
    ["casual", "professional", "funny", "inspirational", "controversial"],
    { error: "Pilih tone" },
  ),
});

export type GenerateUgcStoryboardInput = z.infer<
  typeof generateUgcStoryboardSchema
>;

// ---- 3. UGC Prompt (image-generation) -------------------------------------

export const generateUgcPromptSchema = z.object({
  productId: z.string().uuid("Pilih produk"),
  style: z.enum(["selfie", "unboxing", "lifestyle", "review", "testimonial"], {
    error: "Pilih style foto",
  }),
  mood: z.enum(["happy", "excited", "casual", "satisfied", "natural"], {
    error: "Pilih mood foto",
  }),
});

export type GenerateUgcPromptInput = z.infer<typeof generateUgcPromptSchema>;

// ---- 4. UGC Batch ---------------------------------------------------------

export const generateUgcBatchSchema = z.object({
  productIds: z
    .array(z.string().uuid("ID produk tidak valid"))
    .min(2, "Pilih minimal 2 produk untuk batch")
    .max(5, "Maksimal 5 produk untuk 1 batch"),
  platform: z.enum(["tiktok", "instagram", "youtube", "facebook"], {
    error: "Pilih platform",
  }),
  tone: z.enum(
    ["casual", "professional", "funny", "inspirational", "controversial"],
    { error: "Pilih tone" },
  ),
});

export type GenerateUgcBatchInput = z.infer<typeof generateUgcBatchSchema>;
