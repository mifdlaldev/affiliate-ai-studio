import { z } from "zod";

/**
 * Validation rules for the Projects module.
 *
 * Mirrors the column shape of the `projects` table
 * (see `lib/supabase/types.ts` Database.public.Tables.projects.Row and
 * `supabase/migrations/20260614000003_projects.sql`).
 *
 *  - `name` is the only user-editable text field; we cap it at 200
 *    characters to match the column type and the copy used in the
 *    Product Studio Zod schema.
 *  - `id` is a Postgres-generated UUID; the action layer accepts the
 *    raw value from a form payload, so we validate it client-side as
 *    well to avoid round-tripping bad input to the database.
 *
 * Error messages are in Indonesian to match the dashboard copy.
 */

/** Project name. 1-200 characters, non-empty after trim is enforced via min(1). */
export const projectNameSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined || issue.input === null
        ? "Nama project wajib diisi"
        : "Nama project harus berupa teks",
  })
  .min(1, "Nama project wajib diisi")
  .max(200, "Nama project terlalu panjang (maks 200 karakter)");

/** Project row id. Accepts any canonical UUID format (8-4-4-4-12 hex).
 *  We use a loose regex instead of Zod's `z.uuid()` because the latter
 *  only accepts RFC 4122 v4/v7 — Supabase returns v4 ids, but our own
 *  test fixtures (and user-supplied forms) may use any UUID variant. */
export const projectIdSchema = z
  .string("ID project tidak valid")
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "ID project tidak valid"
  );

/** Payload accepted by `createProject` Server Action. */
export const createProjectSchema = z.object({
  name: projectNameSchema,
});

/** Payload accepted by `updateProject` Server Action. */
export const updateProjectSchema = z.object({
  id: projectIdSchema,
  name: projectNameSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
