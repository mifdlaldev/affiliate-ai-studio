import { ShareNetwork } from "@phosphor-icons/react/dist/ssr";
import { SocialGenerator } from "@/components/modules/social-generator";

/**
 * Social Media Content Calendar route — AI-powered 7-day social
 * content calendar generator for TikTok, Instagram, YouTube, Twitter
 * / X, and Facebook. Thin server-component wrapper that hands off to
 * the client-side `SocialGenerator` for the interactive form +
 * 7-day result panel. Auth + onboarding are enforced by the parent
 * `(dashboard)/layout.tsx`, so by the time we render here the user
 * is signed in and onboarded.
 */
export default function SocialPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <ShareNetwork
            size={24}
            weight="duotone"
            className="text-indigo-600"
          />
          Social Media
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat kalender konten 7 hari untuk satu platform sosial
          (TikTok, Instagram, YouTube, Twitter, Facebook) lengkap
          dengan content type, topic, caption, hashtag, dan jam
          posting terbaik.
        </p>
      </header>
      <SocialGenerator />
    </div>
  );
}
