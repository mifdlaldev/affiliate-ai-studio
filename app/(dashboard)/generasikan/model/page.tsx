import { UserCircle } from "@phosphor-icons/react/dist/ssr";
import { ModelGenerator } from "@/components/modules/model-generator";

/**
 * Model Prompt Generator route — Phase 2, Module 5 of the affiliate
 * content suite. Thin server-component wrapper that hands off to the
 * client-side `ModelGenerator` for the interactive form + result
 * panel. Auth + onboarding are enforced by the parent
 * `(dashboard)/layout.tsx`, so by the time we render here the user
 * is signed in and onboarded.
 */
export default function ModelPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <UserCircle
            size={24}
            weight="duotone"
            className="text-indigo-600"
          />
          Model Prompt Generator
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat prompt foto dengan model manusia yang sedang menggunakan
          atau memamerkan produk Anda, lengkap dengan deskripsi
          gender, usia, dan vibe.
        </p>
      </header>
      <ModelGenerator />
    </div>
  );
}
