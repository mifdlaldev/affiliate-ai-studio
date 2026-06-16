import { z } from "zod";

/**
 * Validation for the Content Calendar Generator form.
 *
 * The form has 6 fields:
 * - `productIds`: array of 1-10 UUIDs of saved products from the
 *                 `products` table. Multiple products are supported so
 *                 the calendar can rotate through a portfolio.
 * - `month`: integer 1-12 representing the target calendar month.
 * - `year`: integer 2026-2027 (project horizon for now).
 * - `contentTypes`: array of 1+ content-type enums the user wants the
 *                   calendar to rotate through (photo, video, story,
 *                   carousel, reel).
 * - `platform`: which social platform the calendar is targeting. The
 *               special value "mixed" tells the model to vary the
 *               platform per day.
 * - `tone`: writing style applied consistently to every day in the
 *           calendar.
 *
 * Error messages are in Indonesian to match the UI copy.
 *
 * NOTE: This project uses Zod 4, which uses the unified `error` option
 * for custom error messages on enums.
 */
export const generateCalendarSchema = z.object({
  productIds: z
    .array(z.string().uuid("ID produk tidak valid"))
    .min(1, "Pilih minimal 1 produk")
    .max(10, "Maksimal 10 produk untuk 1 calendar"),
  month: z
    .number()
    .int("Bulan harus bilangan bulat")
    .min(1, "Bulan minimal 1 (Januari)")
    .max(12, "Bulan maksimal 12 (Desember)"),
  year: z
    .number()
    .int("Tahun harus bilangan bulat")
    .min(2026, "Tahun minimal 2026")
    .max(2027, "Tahun maksimal 2027"),
  contentTypes: z
    .array(
      z.enum(["photo", "video", "story", "carousel", "reel"], {
        error: "Pilih content type yang valid",
      }),
    )
    .min(1, "Pilih minimal 1 content type")
    .max(5, "Maksimal 5 content type"),
  platform: z.enum(
    ["mixed", "tiktok", "instagram", "youtube", "twitter", "facebook"],
    { error: "Pilih platform" },
  ),
  tone: z.enum(
    ["casual", "professional", "funny", "inspirational", "controversial"],
    { error: "Pilih tone" },
  ),
});

export type GenerateCalendarInput = z.infer<typeof generateCalendarSchema>;
