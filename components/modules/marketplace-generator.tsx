"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  Check,
  Copy,
  Package,
  Storefront,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateMarketplaceDescription,
  type MarketplaceResult,
} from "@/lib/actions/marketplace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Marketplace Product Description Generator module — fetches the
 * user's saved products, lets them pick one + set marketplace
 * (Tokopedia/Shopee/Lazada/TikTok Shop/Bukalapak) + style + length +
 * includeSpecs + target audience, then calls the
 * `generateMarketplaceDescription` server action to produce a
 * single marketplace-ready listing copy.
 *
 * Each result card displays:
 * - The SEO-friendly `title` (headline).
 * - A `shortDescription` snippet.
 * - The full `description` body in a copyable monospace block.
 * - A list of `bulletPoints` rendered as a feature list.
 * - `tags` as small pill badges.
 * - A closing `cta` line.
 * - A copy button that copies the full listing copy (title + body +
 *   bullets + cta) to the clipboard.
 *
 * States covered:
 * - products loading (form disabled)
 * - products empty (full-width empty state + CTA to /produk)
 * - form idle (no results yet) — default
 * - form submitting — spinner + "Membuat deskripsi marketplace..."
 * - form error — error block with the failed message
 * - form success — marketplace listing card with all 6 fields
 */
function MarketplaceGenerator() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [platform, setPlatform] = useState<Platform>("shopee");
  const [style, setStyle] = useState<Style>("profesional");
  const [length, setLength] = useState<Length>("sedang");
  const [includeSpecs, setIncludeSpecs] = useState(true);
  const [targetAudience, setTargetAudience] = useState("");
  const [result, setResult] = useState<MarketplaceResult | null>(null);
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
        console.error(
          "MarketplaceGenerator: load products error:",
          fetchError,
        );
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
   * validates with Zod (see `lib/validation/marketplace.ts`) and
   * returns `{ data?: MarketplaceResult; error?: string }`.
   */
  async function runGeneration() {
    if (!selectedProductId || generating) return;

    setGenerating(true);
    setError(null);

    const formData = new FormData();
    formData.set("productId", selectedProductId);
    formData.set("platform", platform);
    formData.set("style", style);
    formData.set("length", length);
    formData.set("includeSpecs", includeSpecs ? "true" : "false");
    formData.set("targetAudience", targetAudience.trim());

    const response = await generateMarketplaceDescription(formData);

    setGenerating(false);

    if (response.error) {
      setError(response.error);
      toast.error(response.error);
      return;
    }

    setResult(response.data ?? null);
    toast.success("Deskripsi marketplace berhasil dibuat!");
  }

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runGeneration();
  }

  /**
   * Copy the full marketplace listing copy (title + shortDescription +
   * description + bulletPoints + cta) to the clipboard and flip the
   * button label for `COPY_FEEDBACK_MS`. Sellers want a single
   * paste-able blob, not field-by-field copying.
   *
   * Falls back to a no-op if the Clipboard API is unavailable
   * (e.g. on http://, very old browsers).
   */
  async function handleCopy() {
    if (!result) return;
    const fullText = [
      result.title,
      "",
      result.shortDescription,
      "",
      result.description,
      "",
      "Fitur Utama:",
      ...result.bulletPoints.map((p) => `• ${p}`),
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
              untuk generate deskripsi marketplace.
            </CardDescription>
          </div>
          <Button asChild>
            <Link
              href="/produk"
              className="inline-flex items-center gap-2"
            >
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
            Pilih produk, marketplace target, gaya penulisan, dan
            panjang deskripsi yang Anda inginkan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleGenerate}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="marketplace-product">Produk</Label>
              <select
                id="marketplace-product"
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
              <Label htmlFor="marketplace-platform">Platform</Label>
              <select
                id="marketplace-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className={SELECT_CLASSNAME}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="marketplace-style">Gaya</Label>
              <select
                id="marketplace-style"
                value={style}
                onChange={(e) => setStyle(e.target.value as Style)}
                className={SELECT_CLASSNAME}
              >
                {STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="marketplace-length">Panjang</Label>
              <select
                id="marketplace-length"
                value={length}
                onChange={(e) => setLength(e.target.value as Length)}
                className={SELECT_CLASSNAME}
              >
                {LENGTHS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="marketplace-include-specs"
                type="checkbox"
                checked={includeSpecs}
                onChange={(e) => setIncludeSpecs(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <Label
                htmlFor="marketplace-include-specs"
                className="cursor-pointer"
              >
                Sertakan spesifikasi teknis
              </Label>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="marketplace-audience">
                Target Audiens (opsional)
              </Label>
              <Input
                id="marketplace-audience"
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Cth: Ibu muda 28-40, peduli skincare"
                maxLength={500}
              />
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
                  <Storefront size={16} weight="bold" aria-hidden="true" />
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
   * - marketplace card if results exist
   * - empty placeholder otherwise
   */
  function renderResultPanel() {
    if (generating) {
      return (
        <div
          data-testid="marketplace-loading"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
        >
          <Storefront
            size={32}
            weight="duotone"
            aria-hidden="true"
            className="text-indigo-600"
          />
          <p className="text-sm font-medium text-slate-700">
            Membuat deskripsi marketplace...
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div
          data-testid="marketplace-error"
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
      return (
        <Card data-testid="marketplace-card" className="border-slate-200">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <CardTitle className="text-lg leading-tight">
                  {result.title}
                </CardTitle>
                <CardDescription className="mt-2">
                  {result.shortDescription}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopy()}
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
          <CardContent className="flex flex-col gap-4">
            <Textarea
              readOnly
              value={result.description}
              className="min-h-32 font-mono text-xs leading-relaxed"
            />

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Fitur Utama
              </p>
              <ul className="flex flex-col gap-1.5">
                {result.bulletPoints.map((point, index) => (
                  <li
                    key={`${point}-${index}`}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {result.tags.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.tags.map((tag) => (
                    <span
                      key={tag}
                      data-testid="marketplace-tag"
                      className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Call-to-Action
              </p>
              <p className="mt-1 text-sm font-medium text-indigo-900">
                {result.cta}
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div
        data-testid="marketplace-empty"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
          <Storefront size={32} weight="duotone" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          Belum ada hasil
        </h3>
        <p className="max-w-sm text-sm text-slate-500">
          Pilih produk dan klik Generate. AI akan membuat deskripsi
          listing marketplace lengkap (judul, deskripsi, bullet
          points, tags, CTA) yang siap di-paste ke Tokopedia, Shopee,
          Lazada, TikTok Shop, atau Bukalapak.
        </p>
      </div>
    );
  }
}

// ---- Local types & constants ---------------------------------------------

/**
 * Minimal row shape we need to populate the product dropdown. RLS scopes
 * the query to the signed-in user; we only project `id` + `name` so the
 * payload stays small.
 */
interface ProductOption {
  id: string;
  name: string;
}

type Platform = "tokopedia" | "shopee" | "lazada" | "tiktok-shop" | "bukalapak";
type Style = "profesional" | "kasual" | "persuasif" | "berbagi-cerita";
type Length = "pendek" | "sedang" | "panjang";

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "tokopedia", label: "Tokopedia" },
  { value: "shopee", label: "Shopee" },
  { value: "lazada", label: "Lazada" },
  { value: "tiktok-shop", label: "TikTok Shop" },
  { value: "bukalapak", label: "Bukalapak" },
];

const STYLES: { value: Style; label: string }[] = [
  { value: "profesional", label: "Profesional" },
  { value: "kasual", label: "Kasual" },
  { value: "persuasif", label: "Persuasif" },
  { value: "berbagi-cerita", label: "Berbagi Cerita" },
];

const LENGTHS: { value: Length; label: string }[] = [
  { value: "pendek", label: "Pendek (50-100 kata)" },
  { value: "sedang", label: "Sedang (150-250 kata)" },
  { value: "panjang", label: "Panjang (300-500 kata)" },
];

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

export { MarketplaceGenerator };
