import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { CalendarGenerator } from "@/components/modules/calendar-generator";

/**
 * Content Calendar Generator route — Phase 2, Module 7 of the
 * affiliate content suite. Thin server-component wrapper that hands
 * off to the client-side `CalendarGenerator` for the interactive form
 * + result panel. Auth + onboarding are enforced by the parent
 * `(dashboard)/layout.tsx`, so by the time we render here the user is
 * signed in and onboarded.
 */
export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <CalendarBlank
            size={24}
            weight="duotone"
            className="text-indigo-600"
          />
          Content Calendar
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Susun kalender konten bulanan 28-31 hari untuk produk affiliate
          Anda dengan sekali klik.
        </p>
      </header>
      <CalendarGenerator />
    </div>
  );
}
