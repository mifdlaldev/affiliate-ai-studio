"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  FloppyDisk,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  archiveProject,
  createProject,
  deleteProject,
  updateProject,
} from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Folders } from "@phosphor-icons/react/dist/ssr";

/**
 * One row from the `projects` table. Mirrors `lib/actions/projects.ts`
 * `ProjectRow` — the component re-fetches the same shape through the
 * browser client so it can refresh without a full page reload.
 */
interface Project {
  id: string;
  user_id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/** Status labels match the `status` CHECK constraint in migration 03. */
const STATUS_ACTIVE = "Aktif";
const STATUS_ARCHIVED = "Diarsipkan";

/**
 * Format a UTC ISO timestamp to a short Indonesian date string. We use
 * the `id-ID` locale for day/month/year ordering and skip the time to
 * keep the card rows compact.
 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Read-only grid of projects owned by the signed-in user. RLS scopes
 * the read to the caller; mutating operations route through Server
 * Actions (`createProject`, `updateProject`, `archiveProject`,
 * `deleteProject`) defined in `lib/actions/projects.ts`.
 *
 * The component owns its own create/edit/load lifecycle (no
 * `refreshKey` prop) so it can be dropped into the `/projects` route
 * without a parent driver.
 */
export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Inline "New Project" form state.
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Inline "Edit" state. We only edit one row at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Track which row is mid-action so the right button shows a spinner.
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    setHasError(false);
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, user_id, name, status, created_at, updated_at, archived_at"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Load projects error:", error);
        toast.error("Gagal memuat daftar project");
        setHasError(true);
        setProjects([]);
      } else {
        setProjects((data ?? []) as Project[]);
      }
    } catch (err) {
      console.error("loadProjects unexpected error:", err);
      toast.error("Gagal memuat daftar project");
      setHasError(true);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Nama project wajib diisi");
      return;
    }
    setIsSubmittingCreate(true);
    const fd = new FormData();
    fd.append("name", trimmed);
    const result = await createProject(fd);
    setIsSubmittingCreate(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Project "${trimmed}" dibuat`);
    setNewName("");
    setIsCreating(false);
    loadProjects();
  }

  function startEdit(project: Project) {
    setEditingId(project.id);
    setEditingName(project.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (!trimmed) {
      toast.error("Nama project wajib diisi");
      return;
    }
    setIsSubmittingEdit(true);
    const fd = new FormData();
    fd.append("id", editingId);
    fd.append("name", trimmed);
    const result = await updateProject(fd);
    setIsSubmittingEdit(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Nama project diubah");
    cancelEdit();
    loadProjects();
  }

  async function handleArchive(project: Project) {
    setBusyId(project.id);
    const fd = new FormData();
    fd.append("id", project.id);
    const result = await archiveProject(fd);
    setBusyId(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Project "${project.name}" diarsipkan`);
    loadProjects();
  }

  async function handleDelete(project: Project) {
    const confirmed = window.confirm(
      `Hapus project "${project.name}"? Semua asset di dalamnya akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.`
    );
    if (!confirmed) return;

    setBusyId(project.id);
    const fd = new FormData();
    fd.append("id", project.id);
    const result = await deleteProject(fd);
    setBusyId(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Project "${project.name}" dihapus`);
    loadProjects();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        {/* When the list is empty, the EmptyState below already has its
            own CTA — duplicating the button here would cause two
            matching elements for the same screen-reader label. */}
        {!isCreating && projects.length > 0 && (
          <Button onClick={() => setIsCreating(true)}>
            <Plus size={16} weight="bold" className="mr-1" />
            Project Baru
          </Button>
        )}
      </div>

      {isCreating && (
        <Card data-size="sm">
          <CardHeader>
            <CardTitle>Project Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="new-project-name">Nama project</Label>
                <Input
                  id="new-project-name"
                  name="name"
                  placeholder="cth. Campaign Ramadan 2026"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  disabled={isSubmittingCreate}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isSubmittingCreate || newName.trim().length === 0}
                >
                  <FloppyDisk size={16} weight="bold" className="mr-1" />
                  {isSubmittingCreate ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewName("");
                  }}
                  disabled={isSubmittingCreate}
                >
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {hasError && !loading && projects.length === 0 ? (
        <EmptyState
          icon={Folders}
          title="Gagal memuat project"
          description="Terjadi kesalahan saat mengambil data. Coba lagi, atau mulai dengan membuat project baru."
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadProjects}>
                Coba lagi
              </Button>
              <Button onClick={() => setIsCreating(true)}>
                <Plus size={16} weight="bold" className="mr-1" />
                Project Baru
              </Button>
            </div>
          }
        />
      ) : projects.length === 0 && !loading ? (
        <EmptyState
          icon={Folders}
          title="Belum ada project"
          description="Mulai dengan membuat project pertama Anda untuk mengelompokkan produk dan konten."
          action={
            <Button onClick={() => setIsCreating(true)}>
              <Plus size={16} weight="bold" className="mr-1" />
              Project Baru
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const isEditing = editingId === project.id;
            const isBusy = busyId === project.id;
            const isArchived = project.status === STATUS_ARCHIVED;
            return (
              <Card key={project.id} data-size="sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    {isEditing ? (
                      <form
                        onSubmit={handleSaveEdit}
                        className="flex-1 space-y-2"
                      >
                        <Label htmlFor={`edit-name-${project.id}`} className="sr-only">
                          Nama project
                        </Label>
                        <Input
                          id={`edit-name-${project.id}`}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                          disabled={isSubmittingEdit}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={
                              isSubmittingEdit || editingName.trim().length === 0
                            }
                          >
                            <FloppyDisk size={14} weight="bold" className="mr-1" />
                            {isSubmittingEdit ? "Menyimpan..." : "Simpan"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                            disabled={isSubmittingEdit}
                          >
                            Batal
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <CardTitle className="line-clamp-2">{project.name}</CardTitle>
                    )}
                    <span
                      className={
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                        (isArchived
                          ? "bg-slate-200 text-slate-700"
                          : "bg-emerald-100 text-emerald-700")
                      }
                    >
                      {project.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                      Dibuat {formatDate(project.created_at)}
                    </span>
                    {!isEditing && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(project)}
                          disabled={isBusy}
                          aria-label="Edit project"
                        >
                          <PencilSimple size={14} weight="bold" className="mr-1" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleArchive(project)}
                          disabled={isBusy || isArchived}
                          aria-label="Arsipkan project"
                        >
                          <Archive size={14} weight="bold" className="mr-1" />
                          Arsip
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(project)}
                          disabled={isBusy}
                          aria-label="Hapus project"
                        >
                          <Trash size={14} weight="bold" className="mr-1" />
                          Hapus
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {loading && projects.length === 0 ? (
        <p className="text-sm text-slate-500">Memuat project...</p>
      ) : null}
    </div>
  );
}
