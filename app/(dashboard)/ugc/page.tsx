import { UsersThree } from "@phosphor-icons/react/dist/ssr";
import { UgcGenerator } from "@/components/modules/ugc-generator";

/**
 * UGC Generator route — Phase 3 module of the affiliate content
 * suite. Thin server-component wrapper that hands off to the
 * client-side `UgcGenerator` for the interactive 4-tab generator
 * (Script / Storyboard / Prompt / Batch).
 *
 * Auth + onboarding are enforced by the parent `(dashboard)/layout.tsx`,
 * so by the time we render here the user is signed in and onboarded.
 */
export default function UgcPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <UsersThree size={24} weight="duotone" className="text-indigo-600" />
          UGC Generator
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat testimoni UGC, storyboard video, prompt foto, dan batch script
          untuk produk affiliate Anda.
        </p>
      </header>
      <UgcGenerator />
    </div>
  );
}
