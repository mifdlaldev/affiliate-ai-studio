"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  Check,
  Copy,
  MagnifyingGlass,
  Package,
  Storefront,
  TrendDown,
  TrendUp,
  WarningCircle,
  Lightbulb,
  Rocket,
  CheckCircle,
  XCircle,
  ClipboardText,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  analyzeCompetitor,
  type CompetitorAnalysis,
} from "@/lib/actions/competitor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Minimal row shape we need to populate the product select. RLS scopes
 * the query to the signed-in user; we only project `id` + `name` so the
 * payload stays small.
 */
interface ProductOption {
  id: string;
  name: string;
}

type CompetitorPlatform = "shopee" | "tokopedia" | "tiktok-shop" | "lazada";

const PLATFORMS: { value: CompetitorPlatform; label: string }[] = [
  { value: "shopee", label: "Shopee" },
  { value: "tokopedia", label: "Tokopedia" },
  { value: "tiktok-shop", label: "TikTok Shop" },
  { value: "lazada", label: "Lazada" },
];

/** How long the "Tersalin!" label sticks after a successful copy. */
const COPY_FEEDBACK_MS = 2000;

/**
 * URL guard. Mirrors the Zod `.url()` rule on the server but as a
 * cheap client-side check so the user gets instant feedback before
 * the request round-trips. Allows `http://`, `https://`, and the
 * `www.` shorthand (the server's `.url()` will reject malformed
 * values either way).
 */
function isLikelyUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 10) return false;
  if (trimmed.length > 1000) return false;
  // Accept either a full scheme or a www. shortcut.
  return /^(https?:\/\/|www\.)/i.test(trimmed);
}

/**
 * Serialize a `CompetitorAnalysis` into a single text block for the
 * clipboard. Section headers match the on-screen layout so the pasted
 * result reads as a structured report, not a wall of text.
 */
function serializeAnalysis(analysis: CompetitorAnalysis): string {
  const lines: string[] = [];
  lines.push(`Kompetitor: ${analysis.competitorName}`);
  lines.push(`Harga: ${analysis.priceRange}`);
  lines.push(`Rating: ${analysis.rating}`);
  lines.push("");
  lines.push("KEKUATAN:");
  for (const s of analysis.strengths) lines.push(`- ${s}`);
  lines.push("");
  lines.push("KELEMAHAN:");
  for (const w of analysis.weaknesses) lines.push(`- ${w}`);
  lines.push("");
  lines.push("CONTENT GAPS:");
  for (const g of analysis.contentGaps) lines.push(`- ${g}`);
  lines.push("");
  lines.push("REKOMENDASI:");
  for (const r of analysis.recommendations) lines.push(`- ${r}`);
  lines.push("");
  lines.push("RINGKASAN:");
  lines.push(analysis.overallAssessment);
  return lines.join("\n");
}

/**
 * Competitor Analyzer module - fetches the user's saved products,
 * lets them pick one product + paste a competitor URL + choose a
 * marketplace, then calls the `analyzeCompetitor` server action to
 * produce a structured competitive analysis report.
 *
 * States covered:
 * - products loading
 * - products empty (full-width empty state + CTA to /produk)
 * - form idle (no results yet) - default
 * - form submitting - spinner + "Menganalisis kompetitor..."
 * - form error - error block + "Coba Lagi" retry
 * - form success - 6-section report (header, strengths, weaknesses,
 *   content gaps, recommendations, overall assessment) with a
 *   copy button on the result panel
 *
 * The form is a "set + go" flow: every field is required and the
 * Analyze button is disabled until the URL passes a cheap client-side
 * check (the server still re-validates with Zod).
 */
export function CompetitorAnalyzer() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productId, setProductId] = useState<string>("");
  const [competitorUrl, setCompetitorUrl] = useState<string>("");
  const [platform, setPlatform] =
    useState<CompetitorPlatform>("shopee");
  const [results, setResults] = useState<CompetitorAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch the user's saved products once on mount. RLS already scopes
  // the query to the caller; we only need id + name for the product
  // select.
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
          "CompetitorAnalyzer: load products error:",
          fetchError,
        );
        toast.error("Gagal memuat daftar produk");
        setProducts([]);
      } else {
        const list = (data ?? []) as ProductOption[];
        setProducts(list);
        // Pre-select the first product if there's exactly one - it
        // matches the "you have a product" flow without locking the
        // user out of changing the selection.
        if (list.length > 0 && !productId) {
          setProductId(list[0]!.id);
        }
      }
      setProductsLoading(false);
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
    // We intentionally do not depend on `productId` here - the auto-
    // select only fires on the initial mount, not when the user
    // clears the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
   * Inline form validation mirrors the Zod schema on the server. We
   * return early with a toast if the user tries to submit without a
   * product, a URL that doesn't look like a URL, or no platform.
   * `urlError` is bound to the input as inline feedback too - better
   * UX than waiting for the server to bounce the request.
   */
  const validationError = useMemo<string | null>(() => {
    if (!productId) return "Pilih produk";
    if (!competitorUrl.trim()) return "URL kompetitor wajib diisi";
    if (!isLikelyUrl(competitorUrl)) {
      return "Format URL tidak valid";
    }
    if (!platform) return "Pilih platform marketplace";
    return null;
  }, [productId, competitorUrl, platform]);

  /**
   * Build a FormData from the current form state and dispatch the
   * server action. FormData is the boundary contract - the action
   * validates with Zod (see `lib/validation/competitor.ts`) and
   * returns `{ data?: CompetitorAnalysis; error?: string }`.
   */
  async function runAnalysis() {
    if (analyzing) return;
    if (validationError) {
      setUrlError(
        validationError === "Format URL tidak valid"
          ? validationError
          : null,
      );
      toast.error(validationError);
      return;
    }

    setAnalyzing(true);
    setError(null);
    setUrlError(null);

    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("competitorUrl", competitorUrl.trim());
    formData.set("platform", platform);

    const result = await analyzeCompetitor(formData);

    setAnalyzing(false);

    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    if (result.data) {
      setResults(result.data);
      toast.success("Analisis kompetitor berhasil!");
    }
  }

  function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runAnalysis();
  }

  function handleRetry() {
    void runAnalysis();
  }

  /**
   * Re-validate the URL as the user types or pastes. We do a cheap
   * shape check; the server still does the real Zod validation. The
   * message is shown inline below the input so the user knows what's
   * wrong before they hit Analyze.
   */
  function handleUrlChange(value: string) {
    setCompetitorUrl(value);
    if (!value.trim()) {
      setUrlError(null);
      return;
    }
    if (!isLikelyUrl(value)) {
      setUrlError("Format URL tidak valid");
    } else {
      setUrlError(null);
    }
  }

  /**
   * Copy the full analysis to the clipboard as plain text. The
   * serializer breaks the report into labelled sections (KEKUATAN,
   * KELEMAHAN, ...) so the pasted result is readable in any doc
   * editor. Falls back to a no-op if the Clipboard API is missing.
   */
  async function handleCopy() {
    if (!results) return;
    try {
      if (!navigator.clipboard?.writeText) {
        toast.error("Browser tidak mendukung clipboard");
        return;
      }
      await navigator.clipboard.writeText(serializeAnalysis(results));
      setCopied(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, COPY_FEEDBACK_MS);
    } catch (err) {
      console.error("Copy to clipboard failed:", err);
      toast.error("Gagal menyalin ke clipboard");
    }
  }

  // ----- Render ---------------------------------------------------------

  // Full-width empty state when the user has zero saved products. The
  // form is meaningless without a product, so we hide it entirely.
  if (!productsLoading && products.length === 0) {
    return (
      <Card data-testid="competitor-empty-products">
        <CardContent className="flex flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
            <Package size={32} weight="duotone" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="mb-1">Belum ada produk</CardTitle>
            <CardDescription>
              Buat produk dulu di Product Studio, lalu kembali ke sini
              untuk menganalisis kompetitor marketplace.
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
      {/* LEFT - form panel */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Pengaturan</CardTitle>
          <CardDescription>
            Pilih produk Anda, paste URL listing kompetitor, dan pilih
            marketplace-nya. AI akan menghasilkan laporan analisis
            kompetitif lengkap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleAnalyze}>
            {/* Product select - single select */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="competitor-product">Produk Anda</Label>
              <select
                id="competitor-product"
                data-testid="competitor-product"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                disabled={productsLoading}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              >
                {productsLoading ? (
                  <option value="">Memuat produk...</option>
                ) : (
                  <>
                    <option value="">Pilih produk</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Competitor URL */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="competitor-url">URL Kompetitor</Label>
              <Input
                id="competitor-url"
                data-testid="competitor-url"
                type="url"
                inputMode="url"
                placeholder="https://shopee.co.id/..."
                value={competitorUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                aria-invalid={urlError ? true : undefined}
                aria-describedby={
                  urlError ? "competitor-url-error" : undefined
                }
                className="h-8"
              />
              {urlError ? (
                <p
                  id="competitor-url-error"
                  data-testid="competitor-url-error"
                  className="text-xs font-medium text-rose-600"
                >
                  {urlError}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Paste URL listing kompetitor dari marketplace yang
                  dipilih.
                </p>
              )}
            </div>

            {/* Platform */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="competitor-platform">Platform</Label>
              <select
                id="competitor-platform"
                data-testid="competitor-platform"
                value={platform}
                onChange={(e) =>
                  setPlatform(e.target.value as CompetitorPlatform)
                }
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="submit"
              disabled={analyzing || productsLoading}
              className="mt-2 w-full"
              data-testid="competitor-analyze"
            >
              {analyzing ? (
                <>
                  <ArrowClockwise
                    size={16}
                    weight="bold"
                    aria-hidden="true"
                    className="animate-spin"
                  />
                  Menganalisis...
                </>
              ) : (
                <>
                  <MagnifyingGlass
                    size={16}
                    weight="bold"
                    aria-hidden="true"
                  />
                  Analyze
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* RIGHT - result panel */}
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Hasil Analisis</CardTitle>
            <CardDescription>
              Laporan competitive intelligence yang dihasilkan AI. Klik
              &ldquo;Salin&rdquo; untuk menyalin ke clipboard.
            </CardDescription>
          </div>
          {results ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              data-testid="competitor-copy"
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check
                    size={14}
                    weight="bold"
                    aria-hidden="true"
                  />
                  Tersalin
                </>
              ) : (
                <>
                  <Copy size={14} weight="bold" aria-hidden="true" />
                  Salin
                </>
              )}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>{renderResultContent()}</CardContent>
      </Card>
    </div>
  );

  // ----- Sub-renders ----------------------------------------------------

  function renderResultContent() {
    // Loading takes priority over every other result state. The user
    // explicitly kicked off a request; show the spinner.
    if (analyzing) {
      return (
        <div
          data-testid="competitor-loading"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
        >
          <MagnifyingGlass
            size={32}
            weight="duotone"
            aria-hidden="true"
            className="animate-pulse text-indigo-600"
          />
          <p className="text-sm font-medium text-slate-700">
            Menganalisis kompetitor...
          </p>
          <p className="max-w-sm text-xs text-slate-500">
            AI sedang membaca listing kompetitor dan membandingkannya
            dengan produk Anda. Biasanya butuh 10-30 detik.
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div
          data-testid="competitor-error"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-rose-200 bg-rose-50 p-8 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <WarningCircle
              size={24}
              weight="duotone"
              aria-hidden="true"
            />
          </div>
          <p className="max-w-md text-sm font-medium text-rose-700">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleRetry}
            data-testid="competitor-retry"
          >
            Coba Lagi
          </Button>
        </div>
      );
    }

    if (results) {
      return (
        <div
          className="flex flex-col gap-5"
          data-testid="competitor-report"
        >
          {/* Header - competitor name + price + rating as prominent numbers */}
          <div
            data-testid="competitor-header"
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-white p-4"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-600">
                <Storefront
                  size={18}
                  weight="duotone"
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Kompetitor
                </p>
                <h3
                  data-testid="competitor-name"
                  className="truncate text-lg font-bold text-slate-800"
                >
                  {results.competitorName}
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-0.5 rounded-lg border border-slate-200 bg-white p-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Harga
                </span>
                <span
                  data-testid="competitor-price"
                  className="text-base font-bold text-slate-800"
                >
                  {results.priceRange}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg border border-slate-200 bg-white p-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Rating
                </span>
                <span
                  data-testid="competitor-rating"
                  className="text-base font-bold text-slate-800"
                >
                  {results.rating}
                </span>
              </div>
            </div>
          </div>

          {/* Strengths - green themed */}
          <SectionBlock
            testId="competitor-strengths"
            title="Kekuatan"
            icon={<CheckCircle size={16} weight="duotone" aria-hidden="true" />}
            tone="emerald"
            items={results.strengths}
          />

          {/* Weaknesses - red themed */}
          <SectionBlock
            testId="competitor-weaknesses"
            title="Kelemahan"
            icon={<XCircle size={16} weight="duotone" aria-hidden="true" />}
            tone="rose"
            items={results.weaknesses}
          />

          {/* Content Gaps - amber themed */}
          <SectionBlock
            testId="competitor-content-gaps"
            title="Content Gaps"
            icon={<Lightbulb size={16} weight="duotone" aria-hidden="true" />}
            tone="amber"
            items={results.contentGaps}
            intro="Peluang konten yang belum diliput kompetitor:"
          />

          {/* Recommendations - indigo themed */}
          <SectionBlock
            testId="competitor-recommendations"
            title="Rekomendasi"
            icon={<Rocket size={16} weight="duotone" aria-hidden="true" />}
            tone="indigo"
            items={results.recommendations}
            intro="Strategi konkret untuk konten affiliate Anda:"
          />

          {/* Overall assessment - bottom paragraph */}
          <div
            data-testid="competitor-overall"
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-center gap-2">
              <ClipboardText
                size={16}
                weight="duotone"
                aria-hidden="true"
                className="text-slate-600"
              />
              <h3 className="text-sm font-bold text-slate-800">
                Ringkasan Posisi Kompetitif
              </h3>
            </div>
            <p
              data-testid="competitor-overall-text"
              className="text-sm leading-relaxed text-slate-700"
            >
              {results.overallAssessment}
            </p>
          </div>
        </div>
      );
    }

    // Default - form is idle and no results yet.
    return (
      <div
        data-testid="competitor-empty"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
          <MagnifyingGlass
            size={32}
            weight="duotone"
            aria-hidden="true"
          />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          Belum ada analisis
        </h3>
        <p className="max-w-sm text-sm text-slate-500">
          Pilih produk Anda, paste URL listing kompetitor, lalu klik
          Analyze untuk mendapatkan laporan competitive intelligence
          lengkap.
        </p>
      </div>
    );
  }
}

/**
 * One section in the result report (strengths, weaknesses, content
 * gaps, recommendations). Renders a tone-coloured card with an icon,
 * a heading, an optional intro line, and a bulleted list. Empty
 * arrays render as a single subdued line so the layout doesn't
 * collapse.
 *
 * Tones pick from the existing palette (emerald, rose, amber,
 * indigo) - the same accents used by the calendar module - so the
 * visual language stays consistent across modules.
 */
function SectionBlock({
  testId,
  title,
  icon,
  tone,
  items,
  intro,
}: {
  testId: string;
  title: string;
  icon: React.ReactNode;
  tone: "emerald" | "rose" | "amber" | "indigo";
  items: string[];
  intro?: string;
}) {
  const toneStyles: Record<typeof tone, string> = {
    emerald: "border-emerald-200 bg-emerald-50",
    rose: "border-rose-200 bg-rose-50",
    amber: "border-amber-200 bg-amber-50",
    indigo: "border-indigo-200 bg-indigo-50",
  };
  const toneIconStyles: Record<typeof tone, string> = {
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-700",
    indigo: "bg-indigo-100 text-indigo-700",
  };
  const toneBulletStyles: Record<typeof tone, string> = {
    emerald: "border-emerald-200 bg-emerald-100/60 text-emerald-700",
    rose: "border-rose-200 bg-rose-100/60 text-rose-700",
    amber: "border-amber-200 bg-amber-100/60 text-amber-700",
    indigo: "border-indigo-200 bg-indigo-100/60 text-indigo-700",
  };

  return (
    <div
      data-testid={testId}
      className={`flex flex-col gap-2 rounded-xl border p-4 ${toneStyles[tone]}`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneIconStyles[tone]}`}
        >
          {icon}
        </div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {intro ? (
        <p className="text-xs text-slate-600">{intro}</p>
      ) : null}
      {items.length > 0 ? (
        <ul
          data-testid={`${testId}-list`}
          className="flex flex-col gap-1.5"
        >
          {items.map((item, i) => (
            <li
              key={i}
              data-testid={`${testId}-item-${i}`}
              className="flex items-start gap-2 text-sm leading-relaxed text-slate-700"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${toneBulletStyles[tone]}`}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs italic text-slate-500">
          Tidak ada data untuk bagian ini.
        </p>
      )}
    </div>
  );
}

// TrendUp/TrendDown imports retained for future use (e.g. price
// movement insights); currently unused but the icon set is small and
// pre-importing keeps the file consistent with the import-style
// pattern used by other modules.
void TrendUp;
void TrendDown;
