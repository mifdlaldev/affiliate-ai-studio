import { ImageSquare } from "@phosphor-icons/react/dist/ssr";
import { PhotoGenerator } from "@/components/modules/photo-generator";

/**
 * Photo Prompt Generator route — Phase 2, Module 4 of the affiliate
 * content suite. Thin server-component wrapper that hands off to the
 * client-side `PhotoGenerator` for the interactive form + result
 * panel. Auth + onboarding are enforced by the parent
 * `(dashboard)/layout.tsx`, so by the time we render here the user
 * is signed in and onboarded.
 */
export default function PhotoPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <ImageSquare
            size={24}
            weight="duotone"
            className="text-indigo-600"
          />
          Photo Prompt Generator
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat prompt foto detail untuk Midjourney, Leonardo, atau DALL-E
          dengan sekali klik.
        </p>
      </header>
      <PhotoGenerator />
    </div>
  );
}
