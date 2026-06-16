import { Storefront } from "@phosphor-icons/react/dist/ssr";
import { MarketplaceGenerator } from "@/components/modules/marketplace-generator";

/**
 * Marketplace Product Description route — AI-powered marketplace
 * listing copy generator for Tokopedia, Shopee, Lazada, TikTok Shop,
 * and Bukalapak. Thin server-component wrapper that hands off to the
 * client-side `MarketplaceGenerator` for the interactive form +
 * result panel. Auth + onboarding are enforced by the parent
 * `(dashboard)/layout.tsx`, so by the time we render here the user is
 * signed in and onboarded.
 */
export default function MarketplacePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Storefront
            size={24}
            weight="duotone"
            className="text-indigo-600"
          />
          Marketplace
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat deskripsi listing produk marketplace (Tokopedia, Shopee,
          Lazada, TikTok Shop, Bukalapak) lengkap dengan judul SEO,
          deskripsi, bullet points, tags, dan CTA.
        </p>
      </header>
      <MarketplaceGenerator />
    </div>
  );
}
