import { FilmSlate } from "@phosphor-icons/react/dist/ssr";
import { StoryboardGenerator } from "@/components/modules/storyboard-generator";

/**
 * Storyboard route — Phase 3 module of the affiliate content suite.
 * Thin server-component wrapper that hands off to the client-side
 * `StoryboardGenerator` for the interactive form + 2-column scene
 * gallery. Auth + onboarding are enforced by the parent
 * `(dashboard)/layout.tsx`, so by the time we render here the user
 * is signed in and onboarded.
 */
export default function StoryboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <FilmSlate size={24} weight="duotone" className="text-indigo-600" />
          Storyboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat storyboard 6-8 panel siap difilmkan untuk video affiliate Anda.
        </p>
      </header>
      <StoryboardGenerator />
    </div>
  );
}
