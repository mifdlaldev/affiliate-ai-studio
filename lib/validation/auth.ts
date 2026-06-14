import { z } from "zod";

/**
 * Validation for the Magic Link sign-in form.
 *
 * Used by `lib/actions/auth.ts#signInWithMagicLink` before calling
 * Supabase Auth. Messages are in Indonesian to match the UI copy.
 */
export const signInSchema = z.object({
  email: z
    .string()
    .min(1, "Email wajib diisi")
    .email("Format email tidak valid")
    .max(255, "Email terlalu panjang"),
});

export type SignInInput = z.infer<typeof signInSchema>;
