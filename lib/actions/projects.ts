"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import {
  createProjectSchema,
  updateProjectSchema,
} from "@/lib/validation/projects";

/**
 * Server Actions for the Projects module.
 *
 * All five actions follow the same "never throw" contract used by the
 * other modules in `lib/actions/`: any failure path returns a
 * `{ error: string }` payload (in Indonesian) so the client can
 * surface it via toast without having to wrap calls in try/catch.
 *
 * Authorization is enforced at two levels:
 *  1. Row-Level Security on the `projects` table (see
 *     `supabase/migrations/20260614000003_projects.sql`) — the `user_id`
 *     column is set from the Supabase Auth session, and the `auth.uid() =
 *     user_id` policy scopes every SELECT/INSERT/UPDATE/DELETE.
 *  2. Defensive `.eq("user_id", user.id)` in update/delete queries so
 *     a misconfigured RLS policy can never let one user mutate another
 *     user's row.
 */

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export type CreateProjectResult = {
  success?: boolean;
  projectId?: string;
  error?: string;
};

export type ListProjectsResult = {
  data: ProjectRow[];
  error?: string;
};

export type UpdateProjectResult = {
  success?: boolean;
  error?: string;
};

export type ArchiveProjectResult = {
  success?: boolean;
  error?: string;
};

export type DeleteProjectResult = {
  success?: boolean;
  error?: string;
};

const PROJECTS_ROUTE = "/projects";

/**
 * Extract a validated payload from a FormData object. Surfaces the
 * first Zod issue's Indonesian message so the client can show it
 * directly in a toast.
 */
function parseFormData<T>(
  fd: FormData,
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ message?: string }> } } }
): { data: T } | { error: string } {
  const raw: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string") {
      raw[key] = value;
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "Validasi gagal" };
  }
  return { data: parsed.data };
}

/**
 * Create a new project for the signed-in user. The row is tagged with
 * `user_id` from the Supabase Auth session; RLS blocks the insert if no
 * user is signed in.
 */
export async function createProject(
  formData: FormData
): Promise<CreateProjectResult> {
  try {
    const parsed = parseFormData(formData, createProjectSchema);
    if ("error" in parsed) {
      return { error: parsed.error };
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login terlebih dahulu" };
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: parsed.data.name,
        user_id: user.id,
        status: "Aktif",
      })
      .select("id")
      .single();

    if (error) {
      console.error("createProject error:", error);
      return { error: `Gagal membuat project: ${error.message}` };
    }

    revalidatePath(PROJECTS_ROUTE);
    return { success: true, projectId: data?.id };
  } catch (err) {
    console.error("createProject unexpected error:", err);
    return {
      error: err instanceof Error ? err.message : "Gagal membuat project",
    };
  }
}

/**
 * Fetch every project owned by the current user, ordered by
 * `created_at` descending. RLS handles the `user_id` filter, so we do
 * not pass an explicit `.eq("user_id", ...)` here — the policy will
 * return zero rows for an unauthenticated client.
 */
export async function listProjects(): Promise<ListProjectsResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: [] };
    }

    const { data, error } = await supabase
      .from("projects")
      .select("id, user_id, name, status, created_at, updated_at, archived_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("listProjects error:", error);
      return { data: [] };
    }

    return { data: (data ?? []) as ProjectRow[] };
  } catch (err) {
    console.error("listProjects unexpected error:", err);
    return { data: [] };
  }
}

/**
 * Rename a project owned by the current user. The double `.eq()` —
 * `id` and `user_id` — is a belt-and-suspenders guard against an RLS
 * regression: if the policy is ever disabled, the query still cannot
 * touch another user's row.
 */
export async function updateProject(
  formData: FormData
): Promise<UpdateProjectResult> {
  try {
    const parsed = parseFormData(formData, updateProjectSchema);
    if ("error" in parsed) {
      return { error: parsed.error };
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login terlebih dahulu" };
    }

    const { error } = await supabase
      .from("projects")
      .update({ name: parsed.data.name })
      .eq("id", parsed.data.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("updateProject error:", error);
      return { error: `Gagal mengubah project: ${error.message}` };
    }

    revalidatePath(PROJECTS_ROUTE);
    return { success: true };
  } catch (err) {
    console.error("updateProject unexpected error:", err);
    return {
      error: err instanceof Error ? err.message : "Gagal mengubah project",
    };
  }
}

/**
 * Mark a project as archived. We do not hard-delete on archive — the
 * `archived_at` timestamp + `status = 'Diarsipkan'` lets the user
 * restore projects later. RLS scopes the update to the owner; we also
 * pin the `user_id` explicitly in the query.
 */
export async function archiveProject(
  formData: FormData
): Promise<ArchiveProjectResult> {
  try {
    const id = formData.get("id");
    const parsed = updateProjectSchema.safeParse({ id, name: "x" });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return { error: firstIssue?.message ?? "ID project tidak valid" };
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login terlebih dahulu" };
    }

    const { error } = await supabase
      .from("projects")
      .update({
        status: "Diarsipkan",
        archived_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("archiveProject error:", error);
      return { error: `Gagal mengarsipkan project: ${error.message}` };
    }

    revalidatePath(PROJECTS_ROUTE);
    return { success: true };
  } catch (err) {
    console.error("archiveProject unexpected error:", err);
    return {
      error: err instanceof Error ? err.message : "Gagal mengarsipkan project",
    };
  }
}

/**
 * Hard-delete a project. RLS scopes the delete to the owner; we also
 * pin the `user_id` explicitly so a misconfigured policy cannot cross
 * tenants. Deleted rows cascade through `assets` and `generations`
 * because of the `ON DELETE CASCADE` foreign keys declared in
 * migrations 04 and 05.
 */
export async function deleteProject(
  formData: FormData
): Promise<DeleteProjectResult> {
  try {
    const id = formData.get("id");
    const parsed = updateProjectSchema.safeParse({ id, name: "x" });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return { error: firstIssue?.message ?? "ID project tidak valid" };
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Anda harus login terlebih dahulu" };
    }

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", parsed.data.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("deleteProject error:", error);
      return { error: `Gagal menghapus project: ${error.message}` };
    }

    revalidatePath(PROJECTS_ROUTE);
    return { success: true };
  } catch (err) {
    console.error("deleteProject unexpected error:", err);
    return {
      error: err instanceof Error ? err.message : "Gagal menghapus project",
    };
  }
}
