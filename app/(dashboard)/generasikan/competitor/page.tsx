import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { CompetitorAnalyzer } from "@/components/modules/competitor-analyzer";

/**
 * Competitor Analyzer route. Thin server-component wrapper that
 * hands off to the client-side `CompetitorAnalyzer` for the
 * interactive form + result panel. Auth + onboarding are enforced
 * by the parent `(dashboard)/layout.tsx`, so by the time we render
 * here the user is signed in and onboarded.
 */
export default function CompetitorPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <MagnifyingGlass
            size={24}
            weight="duotone"
            className="text-indigo-600"
          />
          Competitor Analyzer
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Analisis listing kompetitor di marketplace Indonesia (Shopee,
          Tokopedia, TikTok Shop, Lazada) untuk menemukan celah
          konten dan strategi affiliate yang lebih tajam.
        </p>
      </header>
      <CompetitorAnalyzer />
    </div>
  );
}
