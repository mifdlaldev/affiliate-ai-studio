"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  ChatCircleDots,
  Check,
  Copy,
  Package,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateCaptions,
  type CaptionResult,
} from "@/lib/actions/captions";
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
 * Minimal row shape we need to populate the product dropdown. RLS scopes
 * the query to the signed-in user; we only project `id` + `name` so the
 * payload stays small.
 */
interface ProductOption {
  id: string;
  name: string;
}

type Platform = "tiktok" | "instagram" | "youtube" | "twitter" | "facebook";
type Tone =
  | "casual"
  | "professional"
  | "funny"
  | "inspirational"
  | "controversial";

/**
 * CTA select value. The `none` sentinel serializes to an empty string
 * in FormData (matching the Zod schema's `nullable().optional()` shape)
 * and tells the server action to let the model pick the CTA.
 */
type Cta = "none" | "beli-sekarang" | "daftar" | "kunjungi" | "tanya";

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "Twitter / X" },
  { value: "facebook", label: "Facebook" },
];

const TONES: { value: Tone; label: string }[] = [
  { value: "casual", label: "Casual" },
  { value: "professional", label: "Professional" },
  { value: "funny", label: "Funny" },
  { value: "inspirational", label: "Inspirational" },
  { value: "controversial", label: "Controversial" },
];

const CTAS: { value: Cta; label: string; submitValue: string }[] = [
  { value: "none", label: "Tidak spesifik", submitValue: "" },
  { value: "beli-sekarang", label: "Beli Sekarang", submitValue: "beli-sekarang" },
  { value: "daftar", label: "Daftar", submitValue: "daftar" },
  { value: "kunjungi", label: "Kunjungi", submitValue: "kunjungi" },
  { value: "tanya", label: "Tanya", submitValue: "tanya" },
];

/** How long the "Tersalin!" label sticks after a successful copy. */
const COPY_FEEDBACK_MS = 2000;

/**
 * Caption Generator module — fetches the user's saved products, lets
 * them pick one + set platform/tone/audience/CTA, then calls the
 * `generateCaptions` server action to produce 3-5 multi-paragraph
 * caption variations. Each result card displays the caption body,
 * hashtags as pills, and a platform-specific usage tip.
 *
 * States covered:
 * - products loading (skeleton-ish placeholder on the form)
 * - products empty (full-width empty state + CTA to /produk)
 * - form idle (no results yet) — default
 * - form submitting — spinner + "Menghasilkan caption..."
 * - form error — error block + "Coba Lagi" retry
 * - form success — list of caption cards
 */
export function CaptionGenerator() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [tone, setTone] = useState<Tone>("casual");
  const [audience, setAudience] = useState<string>("");
  const [cta, setCta] = useState<Cta>("none");
  const [results, setResults] = useState<CaptionResult[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
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
        console.error("CaptionGenerator: load products error:", fetchError);
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
   * validates with Zod (see `lib/validation/caption.ts`) and returns
   * `{ data?: CaptionResult[]; error?: string }`.
   *
   * `mode` is `"submit"` for the form's onSubmit and `"retry"` for the
   * error panel's "Coba Lagi" button (same payload, just different
   * entry point so we can give each its own analytics event later).
   */
  async function runGeneration() {
    if (!selectedProductId || generating) return;

    setGenerating(true);
    setError(null);

    const formData = new FormData();
    formData.set("productId", selectedProductId);
    formData.set("platform", platform);
    formData.set("tone", tone);
    formData.set("audience", audience.trim());
    // Map the UI's "Tidak spesifik" sentinel to an empty string so the
    // Zod schema (which expects nullable CTA) treats it as omitted.
    formData.set("cta", CTAS.find((c) => c.value === cta)?.submitValue ?? "");

    const result = await generateCaptions(formData);

    setGenerating(false);

    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    const captions = result.data ?? [];
    setResults(captions);
    toast.success("Caption berhasil dibuat!");
  }

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runGeneration();
  }

  function handleRetry() {
    void runGeneration();
  }

  /**
   * Copy a single caption's body text to the clipboard and flip the
   * button label for `COPY_FEEDBACK_MS`. We deliberately copy the
   * caption text only — hashtags are a separate visual block on the
   * card so the user can grab them via the platform's native
   * click-and-drag, or compose caption + hashtags themselves in the
   * platform's composer.
   *
   * Falls back to a no-op if the Clipboard API is unavailable
   * (e.g. on http://, very old browsers).
   */
  async function handleCopy(captionText: string, index: number) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(captionText);
      } else {
        toast.error("Browser tidak mendukung clipboard");
        return;
      }
      setCopiedIndex(index);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopiedIndex(null);
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
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
            <Package size={32} weight="duotone" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="mb-1">Belum ada produk</CardTitle>
            <CardDescription>
              Buat produk dulu di Product Studio, lalu kembali ke sini
              untuk generate caption.
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
            Pilih produk dan atur target audiens caption Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleGenerate}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="caption-product">Produk</Label>
              <select
                id="caption-product"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={productsLoading}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
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
              <Label htmlFor="caption-platform">Platform</Label>
              <select
                id="caption-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="caption-tone">Tone</Label>
              <select
                id="caption-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="caption-audience">Target audience</Label>
              <Input
                id="caption-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="cth. Wanita 25-35, ibu rumah tangga, dll."
                maxLength={500}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="caption-cta">Call to action</Label>
              <select
                id="caption-cta"
                value={cta}
                onChange={(e) => setCta(e.target.value as Cta)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {CTAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="submit"
              disabled={generating || !selectedProductId}
              className="mt-2 w-full"
            >
              {generating ? (
                <>
                  <ArrowClockwise
                    size={16}
                    weight="bold"
                    aria-hidden="true"
                    className="animate-spin"
                  />
                  Menghasilkan...
                </>
              ) : (
                <>
                  <Sparkle size={16} weight="fill" aria-hidden="true" />
                  Generate Caption
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* RIGHT — result panel */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Hasil</CardTitle>
          <CardDescription>
            Caption yang dihasilkan AI. Klik tombol &ldquo;Salin&rdquo;
            untuk menyalin teks caption.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderResultContent()}</CardContent>
      </Card>
    </div>
  );

  // ----- Sub-renders ----------------------------------------------------

  function renderResultContent() {
    // Loading takes priority over every other result state. The user
    // explicitly kicked off a request; show the spinner.
    if (generating) {
      return (
        <div
          data-testid="caption-loading"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
        >
          <ArrowClockwise
            size={32}
            weight="bold"
            aria-hidden="true"
            className="animate-spin text-indigo-600"
          />
          <p className="text-sm font-medium text-slate-700">
            Menghasilkan caption...
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div
          data-testid="caption-error"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-rose-200 bg-rose-50 p-8 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <WarningCircle size={24} weight="duotone" aria-hidden="true" />
          </div>
          <p className="max-w-md text-sm font-medium text-rose-700">
            {error}
          </p>
          <Button type="button" variant="outline" onClick={handleRetry}>
            Coba Lagi
          </Button>
        </div>
      );
    }

    if (results && results.length > 0) {
      return (
        <ul className="flex flex-col gap-3">
          {results.map((caption, index) => {
            const isCopied = copiedIndex === index;
            return (
              <li
                key={`${caption.text}-${index}`}
                data-testid="caption-card"
                className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-indigo-200"
              >
                {/* Caption body — multi-paragraph, larger reading type.
                    Newlines in the AI output become line breaks here so
                    the rendered block matches the source text. */}
                <div className="mb-3 whitespace-pre-line text-base font-medium leading-relaxed text-slate-800">
                  {caption.text}
                </div>

                {/* Hashtag pills — `#tag1 #tag2 #tag3` rendered as one
                    pill per tag for easy click-and-drag on each token. */}
                {caption.hashtags && caption.hashtags.length > 0 ? (
                  <div
                    data-testid="caption-hashtags"
                    className="mb-3 flex flex-wrap gap-1.5"
                  >
                    {caption.hashtags.map((tag) => (
                      <span
                        key={`${tag}-${index}`}
                        className="rounded-full bg-indigo-600/10 px-2 py-0.5 text-xs font-semibold text-indigo-700"
                      >
                        {tag.startsWith("#") ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Platform-specific usage tip — small italic line. */}
                {caption.tips ? (
                  <p
                    data-testid="caption-tips"
                    className="mb-3 text-xs italic text-slate-500"
                  >
                    {caption.tips}
                  </p>
                ) : null}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(caption.text, index)}
                    aria-label={isCopied ? "Tersalin" : "Salin"}
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} weight="bold" aria-hidden="true" />
                        Tersalin!
                      </>
                    ) : (
                      <>
                        <Copy size={14} weight="bold" aria-hidden="true" />
                        Salin
                      </>
                    )}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      );
    }

    // Default — form is idle and no results yet.
    return (
      <div
        data-testid="caption-empty"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
          <ChatCircleDots size={32} weight="duotone" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          Belum ada hasil
        </h3>
        <p className="max-w-sm text-sm text-slate-500">
          Pilih produk dan klik Generate untuk memulai. AI akan menghasilkan
          3-5 caption siap pakai lengkap dengan hashtag dan tips.
        </p>
      </div>
    );
  }
}
