import { FolderOpen } from "@phosphor-icons/react/dist/ssr";
import { AssetLibrary } from "@/components/modules/asset-library";

/**
 * Asset Library route — Task 2 of the asset library feature. Thin
 * server-component wrapper that hands off to the client-side
 * `AssetLibrary` for the searchable, filterable feed. Auth +
 * onboarding are enforced by the parent `(dashboard)/layout.tsx`, so by
 * the time we render here the user is signed in and onboarded.
 */
export default function AssetsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <FolderOpen size={24} weight="duotone" className="text-indigo-600" />
          Asset Library
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Semua hasil generate AI Anda, tersimpan rapi di satu tempat.
        </p>
      </header>
      <AssetLibrary />
    </div>
  );
}
