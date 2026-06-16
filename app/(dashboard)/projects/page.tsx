import { Folders } from "@phosphor-icons/react/dist/ssr";
import { ProjectList } from "@/components/modules/project-list";

/**
 * Projects route — the top-level hub for user-owned project containers
 * (campaigns, reviews, unboxings). Projects group related products and
 * assets together so multi-product content workflows stay organised.
 *
 * This is a thin Server Component wrapper around the client-side
 * `ProjectList` module. Auth is enforced by the parent
 * `(dashboard)/layout.tsx`, so by the time we render here the user is
 * already signed in and onboarded. RLS on the `projects` table scopes
 * every read/write to the caller's `user_id`.
 */
export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Folders size={24} weight="duotone" className="text-indigo-600" />
          Projects
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelompokkan produk dan konten affiliate Anda ke dalam project
          (campaign, review, unboxing) biar workflow-nya rapi.
        </p>
      </header>
      <ProjectList />
    </div>
  );
}
