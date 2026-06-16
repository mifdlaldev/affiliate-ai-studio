"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  Check,
  Copy,
  Globe,
  Package,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateLandingPage,
  type LandingResult,
} from "@/lib/actions/landing";
import { LANDING_TONES, type LandingTone } from "@/lib/validation/landing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Landing Page Generator module — fetches the user's saved products,
 * lets them pick one + set a writing tone (profesional / santai /
 * persuasif / edukatif), then calls the `generateLandingPage` server
 * action to produce a complete 7-section landing page (headline +
 * subheadline + heroDescription + features grid + pricing + FAQ
 * accordion preview + CTA).
 *
 * Each result card displays:
 * - The `headline` + `subheadline` as the hero.
 * - A `heroDescription` paragraph.
 * - A `features` grid (cards).
 * - A `pricing` table (1-3 plans).
 * - A `faq` accordion preview (native <details> elements — semantic,
 *   zero-dep, and accessible by default).
 * - A closing `cta` line.
 * - A copy button that copies the full landing page (all 7 sections)
 *   to the clipboard.
 *
 * States covered:
 * - products loading (form disabled)
 * - products empty (full-width empty state + CTA to /produk)
 * - form idle (no results yet) — default
 * - form submitting — spinner + "Membuat landing page..."
 * - form error — error block with the failed message
 * - form success — landing page card with all 7 sections
 */
function LandingGenerator() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [tone, setTone] = useState<LandingTone>("profesional");
  const [result, setResult] = useState<LandingResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch the user's saved products once on mount. RLS already scopes
  // the query to the caller; we only need id + name for the dropdown.
  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      const supabase = createBrowserClient();
      const { data, error: fetchError } = await supabase
        .from("products")
        .select("id, name")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (fetchError) {
        console.error("LandingGenerator: load products error:", fetchError);
        toast.error("Gagal memuat daftar produk");
        setProducts([]);
      } else {
        setProducts((data ?? []) as ProductOption[]);
      }
      setProductsLoading(false);
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  // Always clear the copy-feedback timer on unmount so we don't try to
  // setState on a torn-down component (React 19 is stricter here).
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  /**
   * Build a FormData from the current form state and dispatch the
   * server action. FormData is the boundary contract — the action
   * validates with Zod (see `lib/validation/landing.ts`) and returns
   * `{ data?: LandingResult; error?: string }`.
   */
  async function runGeneration() {
    if (!selectedProductId || generating) return;

    setGenerating(true);
    setError(null);

    const formData = new FormData();
    formData.set("productId", selectedProductId);
    formData.set("tone", tone);

    const response = await generateLandingPage(formData);

    setGenerating(false);

    if (response.error) {
      setError(response.error);
      toast.error(response.error);
      return;
    }

    setResult(response.data ?? null);
    toast.success("Landing page berhasil dibuat!");
  }

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runGeneration();
  }

  /**
   * Copy the full landing page (all 7 sections) to the clipboard and
   * flip the button label for `COPY_FEEDBACK_MS`. Marketers want a
   * single paste-able blob, not section-by-section copying.
   *
   * Falls back to a no-op if the Clipboard API is unavailable
   * (e.g. on http://, very old browsers).
   */
  async function handleCopy() {
    if (!result) return;

    const featuresBlock = result.features
      .map((f) => `• ${f.title} — ${f.description}`)
      .join("\n");

    const pricingBlock = result.pricing
      .map(
        (p) =>
          `${p.plan} — ${p.price}\n` +
          p.features.map((f) => `  - ${f}`).join("\n"),
      )
      .join("\n\n");

    const faqBlock = result.faq
      .map((q) => `Q: ${q.question}\nA: ${q.answer}`)
      .join("\n\n");

    const fullText = [
      result.headline,
      result.subheadline,
      "",
      result.heroDescription,
      "",
      "FITUR UTAMA:",
      featuresBlock,
      "",
      "PILIHAN PAKET:",
      pricingBlock,
      "",
      "FAQ:",
      faqBlock,
      "",
      result.cta,
    ].join("\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullText);
      } else {
        toast.error("Browser tidak mendukung clipboard");
        return;
      }
      setCopied(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
      }, COPY_FEEDBACK_MS);
    } catch (err) {
      console.error("Copy to clipboard failed:", err);
      toast.error("Gagal menyalin ke clipboard");
    }
  }

  // Empty-state full card: shown when the user has no saved products
  // yet. Renders inline (not in the result panel) so it doesn't push
  // the form off-screen.
  if (!productsLoading && products.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
            <Package size={32} weight="duotone" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="mb-1">Belum ada produk</CardTitle>
            <CardDescription>
              Buat produk dulu di Product Studio, lalu kembali ke sini
              untuk generate landing page.
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/produk" className="inline-flex items-center gap-2">
              <Package size={16} weight="bold" aria-hidden="true" />
              Buat produk dulu
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* LEFT — form panel */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Pengaturan</CardTitle>
          <CardDescription>
            Pilih produk dan tone penulisan. AI akan membuat landing
            page lengkap (headline, subheadline, hero, fitur, harga,
            FAQ, dan CTA) yang siap di-deploy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleGenerate}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="landing-product">Produk</Label>
              <select
                id="landing-product"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={productsLoading}
                className={SELECT_CLASSNAME}
              >
                <option value="" disabled>
                  {productsLoading ? "Memuat produk..." : "Pilih produk"}
                </option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="landing-tone">Tone Penulisan</Label>
              <select
                id="landing-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as LandingTone)}
                className={SELECT_CLASSNAME}
              >
                {LANDING_TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Tone menentukan seluruh suara halaman — profesional
                untuk B2B, santai untuk consumer, persuasif untuk
                push konversi, edukatif untuk kursus.
              </p>
            </div>

            <Button
              type="submit"
              disabled={!selectedProductId || generating}
              className="mt-2 inline-flex items-center gap-2"
            >
              {generating ? (
                <>
                  <ArrowClockwise
                    size={16}
                    weight="bold"
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Membuat...
                </>
              ) : (
                <>
                  <Globe size={16} weight="bold" aria-hidden="true" />
                  Generate
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* RIGHT — result panel */}
      <div className="md:col-span-2">{renderResultPanel()}</div>
    </div>
  );

  /**
   * Renders the result panel. Pulled out as a nested function so the
   * main component body can stay focused on state + handlers. Returns:
   * - loading spinner if a request is in flight
   * - error block if the last request failed
   * - landing card if results exist
   * - empty placeholder otherwise
   */
  function renderResultPanel() {
    if (generating) {
      return (
        <div
          data-testid="landing-loading"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
        >
          <Globe
            size={32}
            weight="duotone"
            aria-hidden="true"
            className="text-indigo-600"
          />
          <p className="text-sm font-medium text-slate-700">
            Membuat landing page...
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div
          data-testid="landing-error"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-rose-200 bg-rose-50 p-12 text-center"
        >
          <WarningCircle
            size={32}
            weight="duotone"
            aria-hidden="true"
            className="text-rose-600"
          />
          <p className="text-sm font-medium text-rose-700">{error}</p>
        </div>
      );
    }

    if (result) {
      return <LandingResultCard result={result} onCopy={handleCopy} copied={copied} />;
    }

    return (
      <div
        data-testid="landing-empty"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
          <Globe size={32} weight="duotone" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          Belum ada hasil
        </h3>
        <p className="max-w-sm text-sm text-slate-500">
          Pilih produk dan klik Generate. AI akan membuat landing page
          lengkap (headline, subheadline, hero, fitur, harga, FAQ, dan
          CTA) yang siap di-deploy untuk affiliate marketing.
        </p>
      </div>
    );
  }
}

// ---- Sub-component: landing result card -----------------------------------

/**
 * Renders the parsed `LandingResult` as a single scrollable card with
 * all 7 sections: hero, features grid, pricing, FAQ accordion, CTA,
 * plus a copy button. Pulled out so the main component body stays
 * focused on form + state.
 */
function LandingResultCard({
  result,
  onCopy,
  copied,
}: {
  result: LandingResult;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <Card
      data-testid="landing-card"
      className="border-slate-200"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1.5">
            {/* Hero — headline + subheadline */}
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Hero
            </p>
            <CardTitle
              data-testid="landing-headline"
              className="text-xl leading-tight text-slate-900"
            >
              {result.headline}
            </CardTitle>
            <p
              data-testid="landing-subheadline"
              className="text-sm font-medium text-slate-600"
            >
              {result.subheadline}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCopy}
            className="shrink-0"
          >
            {copied ? (
              <>
                <Check
                  size={14}
                  weight="bold"
                  className="text-emerald-600"
                  aria-hidden="true"
                />
                Tersalin
              </>
            ) : (
              <>
                <Copy size={14} weight="bold" aria-hidden="true" />
                Copy
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* Hero description */}
        <p
          data-testid="landing-hero-description"
          className="text-sm leading-relaxed text-slate-700"
        >
          {result.heroDescription}
        </p>

        {/* Features grid */}
        {result.features.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fitur Utama
            </p>
            <div
              data-testid="landing-features-grid"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {result.features.map((feature, index) => (
                <div
                  key={`${feature.title}-${index}`}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {feature.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pricing table */}
        {result.pricing.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pilihan Paket
            </p>
            <div
              data-testid="landing-pricing-table"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {result.pricing.map((plan, index) => (
                <div
                  key={`${plan.plan}-${index}`}
                  className="flex flex-col gap-2 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4"
                >
                  <p className="text-sm font-bold text-slate-900">
                    {plan.plan}
                  </p>
                  <p className="text-lg font-bold text-indigo-700">
                    {plan.price}
                  </p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {plan.features.map((f, fIndex) => (
                      <li
                        key={`${plan.plan}-feature-${fIndex}`}
                        className="flex items-start gap-2 text-xs text-slate-700"
                      >
                        <Check
                          size={12}
                          weight="bold"
                          className="mt-0.5 shrink-0 text-indigo-600"
                          aria-hidden="true"
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQ accordion preview — native <details> for a11y by default */}
        {result.faq.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pertanyaan Umum (FAQ)
            </p>
            <div
              data-testid="landing-faq-accordion"
              className="flex flex-col divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200"
            >
              {result.faq.map((item, index) => (
                <details
                  key={`${item.question}-${index}`}
                  className="group bg-white"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    <span>{item.question}</span>
                    <span
                      aria-hidden="true"
                      className="text-slate-400 transition-transform group-open:rotate-90"
                    >
                      ›
                    </span>
                  </summary>
                  <p className="px-4 pb-3 text-sm leading-relaxed text-slate-600">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* CTA — closing sales line */}
        <div
          data-testid="landing-cta"
          className="rounded-lg border border-indigo-200 bg-indigo-50 p-4"
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <Sparkle
              size={14}
              weight="duotone"
              className="text-indigo-600"
              aria-hidden="true"
            />
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Call-to-Action
            </p>
          </div>
          <p className="text-sm font-semibold leading-relaxed text-indigo-900">
            {result.cta}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Local types & constants ----------------------------------------------

/**
 * Minimal row shape we need to populate the product dropdown. RLS scopes
 * the query to the signed-in user; we only project `id` + `name` so the
 * payload stays small.
 */
interface ProductOption {
  id: string;
  name: string;
}

/** How long to keep the "Tersalin" copy confirmation visible. */
const COPY_FEEDBACK_MS = 2000;

/**
 * Shared class string for the native <select> elements. We use the
 * native control (instead of a custom Radix Select) because the field
 * counts are small and the visual cost of a fully styled Radix
 * dropdown outweighs the benefit for a simple form.
 */
const SELECT_CLASSNAME =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-800 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export { LandingGenerator };
