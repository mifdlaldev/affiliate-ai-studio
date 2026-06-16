import { z } from "zod";

/**
 * Validation for the Landing Page Generator form.
 *
 * The form has exactly 2 fields:
 * - `productId`: UUID of a saved product from the `products` table
 * - `tone`:      writing tone of the landing page copy. The Landing
 *                generator is intentionally simpler than the
 *                Marketplace generator: the model decides section
 *                length from the tone itself, so we don't need a
 *                separate `length` bucket or a `targetAudience`
 *                text field.
 *
 * Tones (Indonesian labels to match the rest of the app):
 * - `profesional` — formal, rapi, data-driven (B2B / premium products)
 * - `santai`      — casual, ramah, Gen-Z friendly (consumer products)
 * - `persuasif`   — urgent, FOMO, action-oriented (push conversion)
 * - `edukatif`    — tenang, jelas, value-first (kursus / ebook / info)
 *
 * Error messages are in Indonesian to match the UI copy.
 *
 * NOTE: This project uses Zod 4, which uses the unified `error` option
 * for custom error messages on enums.
 */
export const generateLandingSchema = z.object({
  productId: z.string().uuid("Pilih produk"),
  tone: z.enum(["profesional", "santai", "persuasif", "edukatif"], {
    error: "Pilih tone",
  }),
});

export type GenerateLandingInput = z.infer<typeof generateLandingSchema>;

/** Exported tone enum list — used by the UI dropdown to render labels. */
export const LANDING_TONES = [
  { value: "profesional", label: "Profesional" },
  { value: "santai", label: "Santai" },
  { value: "persuasif", label: "Persuasif" },
  { value: "edukatif", label: "Edukatif" },
] as const;

export type LandingTone = (typeof LANDING_TONES)[number]["value"];
