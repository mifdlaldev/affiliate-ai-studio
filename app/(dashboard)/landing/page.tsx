import { Globe } from "@phosphor-icons/react/dist/ssr";
import { LandingGenerator } from "@/components/modules/landing-generator";

/**
 * Landing Page route — AI-powered landing page copy generator for
 * affiliate products. Thin server-component wrapper that hands off to
 * the client-side `LandingGenerator` for the interactive form +
 * result panel. Auth + onboarding are enforced by the parent
 * `(dashboard)/layout.tsx`, so by the time we render here the user is
 * signed in and onboarded.
 */
export default function LandingPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Globe
            size={24}
            weight="duotone"
            className="text-indigo-600"
          />
          Landing Page
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat landing page affiliate lengkap dengan headline, hero,
          fitur, harga, FAQ, dan CTA — siap di-deploy untuk konversi
          tinggi.
        </p>
      </header>
      <LandingGenerator />
    </div>
  );
}
