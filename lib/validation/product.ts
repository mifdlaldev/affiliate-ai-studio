import { z } from "zod";

/**
 * Validation for the Product Studio "Save" form.
 *
 * Mirrors the column shape of the `products` table
 * (see `lib/supabase/types.ts` Database.public.Tables.products.Insert).
 * The only strictly-required field is `name`; everything else is nullable
 * because the form can be partially filled in by the user.
 *
 * `image_url` and `reference_link` accept either a valid http(s) URL or an
 * empty string. Empty strings are coerced to null at the storage layer
 * (Supabase Postgres treats the empty string and null differently and we
 * want a consistent representation in the table).
 *
 * Error messages are in Indonesian to match the UI copy.
 */
export const productSchema = z.object({
  name: z
    .string()
    .min(1, "Nama produk wajib diisi")
    .max(200, "Nama produk terlalu panjang (maks 200 karakter)"),
  category: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  target_market: z.string().nullable().optional(),
  usp: z.string().nullable().optional(),
  benefits: z.string().nullable().optional(),
  image_url: z
    .string()
    .url("Format URL foto tidak valid")
    .nullable()
    .optional()
    .or(z.literal("")),
  reference_link: z
    .string()
    .url("Format URL link tidak valid")
    .nullable()
    .optional()
    .or(z.literal("")),
});

export type ProductInput = z.infer<typeof productSchema>;
