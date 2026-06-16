import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { HookGenerator } from "@/components/modules/hook-generator";

/**
 * Hook Generator route — Phase 2, Module 1 of the affiliate content
 * suite. Thin server-component wrapper that hands off to the
 * client-side `HookGenerator` for the interactive form + result
 * panel. Auth + onboarding are enforced by the parent
 * `(dashboard)/layout.tsx`, so by the time we render here the user
 * is signed in and onboarded.
 */
export default function HookPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Sparkle size={24} weight="duotone" className="text-indigo-600" />
          Hook Generator
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate hook ideas viral untuk produk affiliate Anda.
        </p>
      </header>
      <HookGenerator />
    </div>
  );
}
