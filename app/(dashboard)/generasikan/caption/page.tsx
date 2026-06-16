import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr";
import { CaptionGenerator } from "@/components/modules/caption-generator";

/**
 * Caption Generator route — Phase 2, Module 2 of the affiliate content
 * suite. Thin server-component wrapper that hands off to the
 * client-side `CaptionGenerator` for the interactive form + result
 * panel. Auth + onboarding are enforced by the parent
 * `(dashboard)/layout.tsx`, so by the time we render here the user
 * is signed in and onboarded.
 */
export default function CaptionPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <ChatCircleDots size={24} weight="duotone" className="text-indigo-600" />
          Caption Generator
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat caption engaging untuk produk affiliate Anda.
        </p>
      </header>
      <CaptionGenerator />
    </div>
  );
}
