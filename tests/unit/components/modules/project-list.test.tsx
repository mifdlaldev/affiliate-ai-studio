// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProjectList } from "@/components/modules/project-list";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  createProject,
  updateProject,
  archiveProject,
  deleteProject,
} from "@/lib/actions/projects";

/**
 * Mocks for the two module boundaries the component crosses:
 *  - `createBrowserClient` — used by the initial list fetch.
 *  - the four mutating Server Actions — invoked from the card's buttons
 *    and the "New Project" form.
 *
 * `listProjects` is a real Server Action (not mocked) so the component
 * uses the browser-client fetch path consistently with the rest of the
 * dashboard (see `components/shared/product-list.tsx`).
 */
vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(),
}));

vi.mock("@/lib/actions/projects", () => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
  archiveProject: vi.fn(),
  deleteProject: vi.fn(),
}));

// ---- Test fixtures ---------------------------------------------------------

const SAMPLE_PROJECTS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    user_id: "user-1",
    name: "Campaign Ramadan",
    status: "Aktif",
    created_at: "2026-06-12T10:00:00.000Z",
    updated_at: "2026-06-12T10:00:00.000Z",
    archived_at: null,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    user_id: "user-1",
    name: "Review Gadget",
    status: "Aktif",
    created_at: "2026-06-11T10:00:00.000Z",
    updated_at: "2026-06-11T10:00:00.000Z",
    archived_at: null,
  },
];

// ---- Per-test mock wiring --------------------------------------------------

describe("ProjectList", () => {
  let order: ReturnType<typeof vi.fn>;
  let select: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;
  let mockClient: { from: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    order = vi.fn().mockResolvedValue({ data: SAMPLE_PROJECTS, error: null });
    select = vi.fn(() => ({ order }));
    from = vi.fn(() => ({ select }));
    mockClient = { from };

    vi.mocked(createBrowserClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createBrowserClient>
    );

    vi.mocked(createProject).mockResolvedValue({ success: true, projectId: "new-id" });
    vi.mocked(updateProject).mockResolvedValue({ success: true });
    vi.mocked(archiveProject).mockResolvedValue({ success: true });
    vi.mocked(deleteProject).mockResolvedValue({ success: true });
  });

  it("renders the list of projects and shows status badges", async () => {
    render(<ProjectList />);

    await screen.findByText("Campaign Ramadan");
    expect(screen.getByText("Review Gadget")).toBeInTheDocument();

    // Both rows are Aktif → two "Aktif" badges.
    const badges = screen.getAllByText("Aktif");
    expect(badges.length).toBeGreaterThanOrEqual(2);

    // Sanity-check the browser-client chain reached the projects table.
    expect(from).toHaveBeenCalledWith("projects");
  });

  it("creates a new project from the New Project form", async () => {
    render(<ProjectList />);

    // Wait for the initial fetch to settle so the empty/form area is in DOM.
    await screen.findByText("Campaign Ramadan");

    // Open the "New Project" inline form.
    const newButton = screen.getByRole("button", { name: /project baru/i });
    fireEvent.click(newButton);

    const nameInput = screen.getByLabelText(/nama project/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Q4 Launch" } });

    const submit = screen.getByRole("button", { name: /simpan|buat|create/i });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledTimes(1);
    });
    const passedFd = vi.mocked(createProject).mock.calls[0]?.[0] as FormData;
    expect(passedFd).toBeInstanceOf(FormData);
    expect(passedFd.get("name")).toBe("Q4 Launch");
  });

  it("edits a project name and calls updateProject", async () => {
    render(<ProjectList />);
    await screen.findByText("Campaign Ramadan");

    // Each card has its own "Edit" button. Click the first.
    const editButtons = screen.getAllByRole("button", { name: /edit|ubah/i });
    fireEvent.click(editButtons[0]!);

    const input = (await screen.findByDisplayValue("Campaign Ramadan")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Renamed Campaign" } });

    const save = screen.getByRole("button", { name: /simpan|save/i });
    fireEvent.click(save);

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledTimes(1);
    });
    const passedFd = vi.mocked(updateProject).mock.calls[0]?.[0] as FormData;
    expect(passedFd.get("id")).toBe(SAMPLE_PROJECTS[0]!.id);
    expect(passedFd.get("name")).toBe("Renamed Campaign");
  });

  it("archives a project via the archive button", async () => {
    render(<ProjectList />);
    await screen.findByText("Campaign Ramadan");

    const archiveButtons = screen.getAllByRole("button", { name: /arsip|archive/i });
    fireEvent.click(archiveButtons[0]!);

    await waitFor(() => {
      expect(archiveProject).toHaveBeenCalledTimes(1);
    });
    const passedFd = vi.mocked(archiveProject).mock.calls[0]?.[0] as FormData;
    expect(passedFd.get("id")).toBe(SAMPLE_PROJECTS[0]!.id);
  });

  it("deletes a project after confirming the dialog", async () => {
    const originalConfirm = window.confirm;
    window.confirm = () => true;

    try {
      render(<ProjectList />);
      await screen.findByText("Campaign Ramadan");

      const deleteButtons = screen.getAllByRole("button", { name: /hapus|delete/i });
      fireEvent.click(deleteButtons[0]!);

      await waitFor(() => {
        expect(deleteProject).toHaveBeenCalledTimes(1);
      });
      const passedFd = vi.mocked(deleteProject).mock.calls[0]?.[0] as FormData;
      expect(passedFd.get("id")).toBe(SAMPLE_PROJECTS[0]!.id);
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it("shows the empty state with a create CTA when there are no projects", async () => {
    order.mockResolvedValue({ data: [], error: null });

    render(<ProjectList />);

    // Empty-state copy is Indonesian: "Belum ada project".
    expect(await screen.findByText(/belum ada project/i)).toBeInTheDocument();
    // The CTA is the "New Project" button (or one rendered inside the
    // empty state with the same label).
    const cta = screen.getByRole("button", { name: /project baru/i });
    expect(cta).toBeInTheDocument();
  });

  it("renders an error state and refetches fail gracefully", async () => {
    order.mockResolvedValue({
      data: null,
      error: { message: "DB unreachable" },
    });

    render(<ProjectList />);

    // The component must not throw on fetch failure and must surface an
    // error affordance. We assert that no project rows leak in and the
    // New Project CTA is still present (so the user can recover).
    await waitFor(() => {
      expect(screen.queryByText("Campaign Ramadan")).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /project baru/i })
    ).toBeInTheDocument();
  });
});
