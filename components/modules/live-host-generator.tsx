"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  Broadcast,
  Check,
  Copy,
  Package,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateLiveScript,
  type LiveHostResult,
} from "@/lib/actions/live-host";
import { Button } from "@/components/ui/button";
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

type Platform = "tiktok" | "instagram" | "youtube";
type Tone =
  | "casual"
  | "professional"
  | "funny"
  | "inspirational"
  | "controversial";
type Duration = "15" | "30" | "60";

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "tiktok", label: "TikTok Live" },
  { value: "instagram", label: "Instagram Live" },
  { value: "youtube", label: "YouTube Live" },
];

const TONES: { value: Tone; label: string }[] = [
  { value: "casual", label: "Casual" },
  { value: "professional", label: "Professional" },
  { value: "funny", label: "Funny" },
  { value: "inspirational", label: "Inspirational" },
  { value: "controversial", label: "Controversial" },
];

const DURATIONS: { value: Duration; label: string }[] = [
  { value: "15", label: "15 menit" },
  { value: "30", label: "30 menit" },
  { value: "60", label: "60 menit" },
];

/** How long the "Tersalin!" label sticks after a successful copy. */
const COPY_FEEDBACK_MS = 2000;

/**
 * Serialize a single live-host script into a readable plain-text
 * outline that the user can paste straight into a doc or notes app.
 * The format mirrors the card so the copy and the visual stay in sync.
 */
function formatLiveScriptForClipboard(
  script: LiveHostResult,
  duration: string,
): string {
  const segmentLines = script.segments
    .map(
      (segment) =>
        `[${segment.time}] ${segment.segmentName}\n` +
        `Host: ${segment.hostScript}\n` +
        `Key Points:\n` +
        segment.keyPoints.map((point) => `  - ${point}`).join("\n") +
        `\nEngagement: ${segment.engagementTip}`,
    )
    .join("\n\n");

  return [
    `${script.title} (${duration} menit)`,
    "",
    segmentLines.trim(),
    "",
    `CTA: ${script.cta}`,
  ].join("\n");
}

/**
 * Live Host Script Generator module — fetches the user's saved
 * products, lets them pick one + set platform/tone/audience/duration-
 * in-minutes, then calls the `generateLiveScript` server action to
 * produce a structured live-streaming host script. Each result card
 * displays a segment block (Waktu / Segment / Host Script / Key
 * Points / Engagement Tip), the script's title + duration badge, a
 * copy button that copies the whole outline, and the closing CTA.
 *
 * Duration is in MINUTES (15/30/60), unlike the Script Generator
 * which uses seconds — live streams are long-form content.
 *
 * States covered:
 * - products loading (skeleton-ish placeholder on the form)
 * - products empty (full-width empty state + CTA to /produk)
 * - form idle (no results yet) — default
 * - form submitting — spinner + "Menghasilkan script live..."
 * - form error — error block + "Coba Lagi" retry
 * - form success — script card with segment blocks
 */
export function LiveHostGenerator() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [tone, setTone] = useState<Tone>("casual");
  const [audience, setAudience] = useState<string>("");
  const [duration, setDuration] = useState<Duration>("30");
  const [result, setResult] = useState<LiveHostResult | null>(null);
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
        console.error("LiveHostGenerator: load products error:", fetchError);
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
   * validates with Zod (see `lib/validation/live-host.ts`) and
   * returns `{ data?: LiveHostResult; error?: string }`.
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
    formData.set("duration", duration);

    const response = await generateLiveScript(formData);

    setGenerating(false);

    if (response.error) {
      setError(response.error);
      toast.error(response.error);
      return;
    }

    if (!response.data) {
      setError("AI response kosong. Coba lagi.");
      toast.error("AI response kosong. Coba lagi.");
      return;
    }

    setResult(response.data);
    toast.success("Live script berhasil dibuat!");
  }

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runGeneration();
  }

  function handleRetry() {
    void runGeneration();
  }

  /**
   * Copy the full live script (title + segments + CTA) to the
   * clipboard and flip the button label for `COPY_FEEDBACK_MS`.
   * We copy the whole script as plain text so the user can paste it
   * straight into a doc or notes app.
   *
   * Falls back to a no-op if the Clipboard API is unavailable
   * (e.g. on http://, very old browsers).
   */
  async function handleCopy() {
    if (!result) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(
          formatLiveScriptForClipboard(result, duration),
        );
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
              untuk generate live script.
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
            Pilih produk dan atur target audiens sesi live streaming Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleGenerate}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="live-host-product">Produk</Label>
              <select
                id="live-host-product"
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
              <Label htmlFor="live-host-platform">Platform</Label>
              <select
                id="live-host-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="live-host-tone">Tone</Label>
              <select
                id="live-host-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              >
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="live-host-audience">Target Audience</Label>
              <input
                id="live-host-audience"
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Contoh: Bunda muda 28-40 tahun"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="live-host-duration">Durasi</Label>
              <select
                id="live-host-duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value as Duration)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              >
                {DURATIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="submit"
              disabled={!selectedProductId || generating || productsLoading}
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
                  Generate Live Script
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
            Outline sesi live yang dihasilkan AI. Klik tombol &ldquo;Salin&rdquo;
            untuk menyalin seluruh script live.
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
          data-testid="live-host-loading"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
        >
          <ArrowClockwise
            size={32}
            weight="bold"
            aria-hidden="true"
            className="animate-spin text-indigo-600"
          />
          <p className="text-sm font-medium text-slate-700">
            Menghasilkan script live...
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div
          data-testid="live-host-error"
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

    if (result) {
      return (
        <div className="flex flex-col gap-4">
          <div
            data-testid="live-host-card"
            className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-indigo-200"
          >
            {/* Card header — title + duration badge */}
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-800">
                {result.title}
              </h3>
              <span className="shrink-0 rounded-full bg-indigo-600/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                {duration} menit
              </span>
            </div>

            {/* Segments — one block per phase of the live. Each block
                shows the timing, segment name, host script, key points
                as a list, and an engagement tip. */}
            <ul
              data-testid="live-host-segments"
              className="flex flex-col gap-3"
            >
              {result.segments.map((segment, index) => (
                <li
                  key={`${segment.time}-${index}`}
                  data-testid="live-segment"
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
                >
                  {/* Header row — timing + segment name */}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-xs font-semibold text-white">
                      {segment.time}
                    </span>
                    <span className="rounded-full bg-indigo-600/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                      {segment.segmentName}
                    </span>
                  </div>

                  {/* Host script — the main narration */}
                  <div className="mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Host Script
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-800">
                      {segment.hostScript}
                    </p>
                  </div>

                  {/* Key points — bulleted recap */}
                  <div className="mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Key Points
                    </p>
                    <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
                      {segment.keyPoints.map((point, pointIndex) => (
                        <li key={`${segment.time}-point-${pointIndex}`}>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Engagement tip — single-line interaction prompt */}
                  <div className="rounded-md border border-amber-100 bg-amber-50/70 p-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Engagement Tip
                    </p>
                    <p className="mt-0.5 text-sm text-amber-900">
                      {segment.engagementTip}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Closing CTA — at the bottom of the script. */}
            <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                CTA
              </p>
              <p className="mt-1 text-sm text-slate-800">
                {result.cta}
              </p>
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                aria-label={copied ? "Tersalin" : "Salin"}
              >
                {copied ? (
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
          </div>
        </div>
      );
    }

    // Default — form is idle and no results yet.
    return (
      <div
        data-testid="live-host-empty"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
          <Broadcast size={32} weight="duotone" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          Belum ada hasil
        </h3>
        <p className="max-w-sm text-sm text-slate-500">
          Pilih produk dan klik Generate untuk memulai. AI akan menghasilkan
          outline live streaming siap pakai lengkap dengan script per segment.
        </p>
      </div>
    );
  }
}
