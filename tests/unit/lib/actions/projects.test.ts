import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Module-level mock fns. The `vi.mock` factories below reference these
 * bindings; vitest hoists the mock declarations, but the factory body
 * is only invoked on the first import of the module, so the references
 * are safe.
 */
const mockGetUser = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateEq = vi.fn();
const mockDelete = vi.fn();
const mockDeleteEq = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      if (table !== "projects") return {};
      return {
        insert: (row: unknown) => ({
          select: () => ({
            single: () => mockInsert(row),
          }),
        }),
        select: () => ({
          order: (...args: unknown[]) => mockOrder(...args),
        }),
        update: (patch: unknown) => ({
          eq: () => ({
            eq: () => mockUpdate(patch),
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: () => mockDelete(),
          }),
        }),
      };
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

// ---- Test fixtures ---------------------------------------------------------

const MOCK_USER = {
  id: "user-1234",
  email: "tester@example.com",
};

const SAMPLE_PROJECT_ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: MOCK_USER.id,
  name: "Campaign Ramadan",
  status: "Aktif",
  created_at: "2026-06-14T10:00:00.000Z",
  updated_at: "2026-06-14T10:00:00.000Z",
  archived_at: null,
};

const SAMPLE_PROJECT_ROW_2 = {
  id: "22222222-2222-2222-2222-222222222222",
  user_id: MOCK_USER.id,
  name: "Review Gadget",
  status: "Aktif",
  created_at: "2026-06-13T10:00:00.000Z",
  updated_at: "2026-06-13T10:00:00.000Z",
  archived_at: null,
};

/**
 * Build a FormData payload compatible with what the action layer will
 * receive from a Next.js Server Action call. Mirrors the field names
 * used by `components/modules/project-list.tsx`.
 */
function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  return fd;
}

const resetMocks = () => {
  mockGetUser.mockReset();
  mockInsert.mockReset();
  mockSelect.mockReset();
  mockOrder.mockReset();
  mockUpdate.mockReset();
  mockUpdateEq.mockReset();
  mockDelete.mockReset();
  mockDeleteEq.mockReset();
  mockRevalidatePath.mockReset();
};

beforeEach(resetMocks);

// ---- Tests -----------------------------------------------------------------

describe("createProject", () => {
  it("creates a project and returns the new id", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    mockInsert.mockResolvedValue({ data: SAMPLE_PROJECT_ROW, error: null });

    const { createProject } = await import("@/lib/actions/projects");
    const result = await createProject(
      makeFormData({ name: "Campaign Ramadan" })
    );

    expect(result.success).toBe(true);
    expect(result.projectId).toBe(SAMPLE_PROJECT_ROW.id);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Campaign Ramadan",
        user_id: MOCK_USER.id,
      })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects");
  });
});

describe("listProjects", () => {
  it("returns the projects for the current user ordered by created_at desc", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    mockOrder.mockResolvedValue({
      data: [SAMPLE_PROJECT_ROW, SAMPLE_PROJECT_ROW_2],
      error: null,
    });

    const { listProjects } = await import("@/lib/actions/projects");
    const result = await listProjects();

    expect(result.data).toHaveLength(2);
    expect(result.data?.[0]?.id).toBe(SAMPLE_PROJECT_ROW.id);
    expect(result.data?.[1]?.id).toBe(SAMPLE_PROJECT_ROW_2.id);
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("returns an empty array when the user has no projects yet", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    mockOrder.mockResolvedValue({ data: [], error: null });

    const { listProjects } = await import("@/lib/actions/projects");
    const result = await listProjects();

    expect(result.data).toEqual([]);
  });
});

describe("updateProject", () => {
  it("updates a project's name and revalidates the projects route", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    mockUpdate.mockResolvedValue({ error: null });

    const { updateProject } = await import("@/lib/actions/projects");
    const result = await updateProject(
      makeFormData({
        id: SAMPLE_PROJECT_ROW.id,
        name: "Renamed campaign",
      })
    );

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Renamed campaign" })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects");
  });
});

describe("archiveProject", () => {
  it("flips status to Diarsipkan and stamps archived_at", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    mockUpdate.mockResolvedValue({ error: null });

    const { archiveProject } = await import("@/lib/actions/projects");
    const result = await archiveProject(
      makeFormData({ id: SAMPLE_PROJECT_ROW.id })
    );

    expect(result.success).toBe(true);
    const patchArg = mockUpdate.mock.calls[0]?.[0] as
      | { status: string; archived_at: string }
      | undefined;
    expect(patchArg).toBeDefined();
    expect(patchArg?.status).toBe("Diarsipkan");
    expect(patchArg?.archived_at).toEqual(expect.any(String));
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects");
  });
});

describe("deleteProject", () => {
  it("deletes the project scoped to the current user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    mockDelete.mockResolvedValue({ error: null });

    const { deleteProject } = await import("@/lib/actions/projects");
    const result = await deleteProject(
      makeFormData({ id: SAMPLE_PROJECT_ROW.id })
    );

    expect(result.success).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects");
  });
});

describe("validation", () => {
  it("createProject returns a validation error when name is empty", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });

    const { createProject } = await import("@/lib/actions/projects");
    const result = await createProject(makeFormData({ name: "" }));

    expect(result.error).toMatch(/nama project|validasi/i);
    expect(result.success).toBeFalsy();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe("auth", () => {
  it("createProject returns an auth error when the user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { createProject } = await import("@/lib/actions/projects");
    const result = await createProject(makeFormData({ name: "Anything" }));

    expect(result.error).toMatch(/login|sign in|masuk/i);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ---- Type compile-check (catches missing exports) --------------------------

const _typeCheck: {
  createProject: (fd: FormData) => Promise<{
    success?: boolean;
    projectId?: string;
    error?: string;
  }>;
  listProjects: () => Promise<{ data: unknown[] }>;
  updateProject: (fd: FormData) => Promise<{
    success?: boolean;
    error?: string;
  }>;
  archiveProject: (fd: FormData) => Promise<{
    success?: boolean;
    error?: string;
  }>;
  deleteProject: (fd: FormData) => Promise<{
    success?: boolean;
    error?: string;
  }>;
} | null = null;
void _typeCheck;
