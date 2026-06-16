import { Broadcast } from "@phosphor-icons/react/dist/ssr";
import { LiveHostGenerator } from "@/components/modules/live-host-generator";

/**
 * Live Host route — AI-powered live streaming script generator.
 * Thin server-component wrapper that hands off to the client-side
 * `LiveHostGenerator` for the interactive form + result panel.
 * Auth + onboarding are enforced by the parent `(dashboard)/layout.tsx`,
 * so by the time we render here the user is signed in and onboarded.
 */
export default function LiveHostPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Broadcast size={24} weight="duotone" className="text-indigo-600" />
          Live Host
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat outline script live streaming (TikTok/IG/YouTube Live) untuk
          produk affiliate Anda.
        </p>
      </header>
      <LiveHostGenerator />
    </div>
  );
}
