import { VideoCamera } from "@phosphor-icons/react/dist/ssr";
import { ScriptGenerator } from "@/components/modules/script-generator";

/**
 * Script Generator route — Phase 2, Module 3 of the affiliate content
 * suite. Thin server-component wrapper that hands off to the
 * client-side `ScriptGenerator` for the interactive form + result
 * panel. Auth + onboarding are enforced by the parent
 * `(dashboard)/layout.tsx`, so by the time we render here the user
 * is signed in and onboarded.
 */
export default function ScriptPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <VideoCamera size={24} weight="duotone" className="text-indigo-600" />
          Script Generator
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat storyboard video pendek untuk produk affiliate Anda.
        </p>
      </header>
      <ScriptGenerator />
    </div>
  );
}
