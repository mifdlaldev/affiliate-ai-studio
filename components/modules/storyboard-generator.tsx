"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  ArrowsClockwise,
  Camera,
  Eye,
  FilmSlate,
  Microphone,
  Package,
  Sparkle,
  SpeakerHigh,
  TextT,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateStoryboard,
  type StoryboardPanel,
} from "@/lib/actions/storyboard";
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
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram Reels" },
  { value: "youtube", label: "YouTube Shorts" },
];

const TONES: { value: Tone; label: string }[] = [
  { value: "casual", label: "Casual" },
  { value: "professional", label: "Professional" },
  { value: "funny", label: "Funny" },
  { value: "inspirational", label: "Inspirational" },
  { value: "controversial", label: "Controversial" },
];

const DURATIONS: { value: Duration; label: string }[] = [
  { value: "15", label: "15 detik" },
  { value: "30", label: "30 detik" },
  { value: "60", label: "60 detik" },
];

/** Format a panel number as a 2-digit zero-padded display ("01", "02"). */
function formatPanelNumber(panel: number): string {
  return String(panel).padStart(2, "0");
}

/**
 * Storyboard Generator module — fetches the user's saved products,
 * lets them pick one + set platform/tone/duration, then calls the
 * `generateStoryboard` server action to produce a 6-8 panel
 * cinematographic storyboard. Each result card is a visual scene
 * tile (NOT a table row) showing panel number, time badge, camera
 * angle, visual description, audio description, text overlay, and
 * transition type.
 *
 * Layout: 2-column scene gallery inside the result card.
 *
 * States covered:
 * - products loading (skeleton-ish placeholder on the form)
 * - products empty (full-width empty state + CTA to /produk)
 * - form idle (no results yet) — default
 * - form submitting — spinner + "Menghasilkan storyboard..."
 * - form error — error block + "Coba Lagi" retry
 * - form success — 2-column grid of scene cards
 */
export function StoryboardGenerator() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [tone, setTone] = useState<Tone>("casual");
  const [duration, setDuration] = useState<Duration>("30");
  const [results, setResults] = useState<StoryboardPanel[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        console.error("StoryboardGenerator: load products error:", fetchError);
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

  /**
   * Build a FormData from the current form state and dispatch the
   * server action. FormData is the boundary contract — the action
   * validates with Zod (see `lib/validation/storyboard.ts`) and
   * returns `{ data?: StoryboardPanel[]; error?: string }`.
   */
  async function runGeneration() {
    if (!selectedProductId || generating) return;

    setGenerating(true);
    setError(null);

    const formData = new FormData();
    formData.set("productId", selectedProductId);
    formData.set("platform", platform);
    formData.set("tone", tone);
    formData.set("duration", duration);

    const result = await generateStoryboard(formData);

    setGenerating(false);

    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    const panels = result.data ?? [];
    setResults(panels);
    toast.success("Storyboard berhasil dibuat!");
  }

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runGeneration();
  }

  function handleRetry() {
    void runGeneration();
  }

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
              untuk generate storyboard.
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
            Pilih produk dan atur target storyboard video affiliate Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleGenerate}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="storyboard-product">Produk</Label>
              <select
                id="storyboard-product"
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
              <Label htmlFor="storyboard-platform">Platform</Label>
              <select
                id="storyboard-platform"
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
              <Label htmlFor="storyboard-tone">Tone</Label>
              <select
                id="storyboard-tone"
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

            <div
              className="flex flex-col gap-2"
              role="radiogroup"
              aria-labelledby="storyboard-duration-label"
            >
              <Label id="storyboard-duration-label">Durasi</Label>
              <div className="grid grid-cols-3 gap-2">
                {DURATIONS.map((d) => {
                  const isActive = duration === d.value;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-label={d.label}
                      onClick={() => setDuration(d.value)}
                      className={
                        "h-8 rounded-lg border px-2.5 py-1 text-sm font-medium transition-colors " +
                        (isActive
                          ? "border-indigo-600 bg-indigo-600/10 text-indigo-700"
                          : "border-input bg-transparent text-slate-700 hover:border-slate-300")
                      }
                    >
                      {d.value}
                    </button>
                  );
                })}
              </div>
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
                  Generate Storyboard
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
            Storyboard 6-8 panel siap difilmkan. Setiap kartu adalah 1 shot
            dengan catatan kamera, audio, teks overlay, dan transisi.
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
          data-testid="storyboard-loading"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
        >
          <ArrowClockwise
            size={32}
            weight="bold"
            aria-hidden="true"
            className="animate-spin text-indigo-600"
          />
          <p className="text-sm font-medium text-slate-700">
            Menghasilkan storyboard...
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div
          data-testid="storyboard-error"
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
        <div
          data-testid="storyboard-gallery"
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {results.map((panel, index) => (
            <StoryboardCard key={`panel-${panel.panel}`} panel={panel} index={index} />
          ))}
        </div>
      );
    }

    // Default — form is idle and no results yet.
    return (
      <div
        data-testid="storyboard-empty"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
          <FilmSlate size={32} weight="duotone" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          Belum ada hasil
        </h3>
        <p className="max-w-sm text-sm text-slate-500">
          Pilih produk dan klik Generate untuk memulai. AI akan menghasilkan
          storyboard 6-8 panel siap difilmkan.
        </p>
      </div>
    );
  }
}

// ---- Single scene card ----------------------------------------------------

interface StoryboardCardProps {
  panel: StoryboardPanel;
  index: number;
}

/**
 * A single scene tile in the 2-column gallery. Renders the panel
 * number as a large display element (so the gallery reads like a real
 * film production board) and stacks the shot metadata (camera, audio,
 * text, transition) in clearly labelled sections.
 */
function StoryboardCard({ panel, index }: StoryboardCardProps) {
  return (
    <article
      data-testid="storyboard-card"
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-indigo-200"
    >
      {/* Header — large panel number + time badge */}
      <header className="flex items-start justify-between gap-3">
        <span
          className="font-mono text-2xl font-bold leading-none tracking-tight text-slate-300"
          aria-label={`Panel ${panel.panel}`}
        >
          {formatPanelNumber(panel.panel)}
        </span>
        <span className="shrink-0 rounded-full bg-indigo-600/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-indigo-700">
          {panel.time}
        </span>
      </header>

      {/* Camera angle — cinematographic shot metadata */}
      <div
        data-testid={`camera-angle-${index}`}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
      >
        <Camera
          size={14}
          weight="bold"
          aria-hidden="true"
          className="text-indigo-600"
        />
        {panel.cameraAngle || <span className="text-slate-400">-</span>}
      </div>

      <hr className="border-slate-100" />

      {/* Visual description */}
      <StoryboardSection
        icon={<Eye size={12} weight="bold" aria-hidden="true" />}
        label="Visual"
      >
        {panel.visuals}
      </StoryboardSection>

      {/* Audio description */}
      <StoryboardSection
        icon={
          panel.audio ? (
            <Microphone size={12} weight="bold" aria-hidden="true" />
          ) : (
            <SpeakerHigh size={12} weight="bold" aria-hidden="true" />
          )
        }
        label="Audio"
      >
        {panel.audio || <span className="text-slate-400">-</span>}
      </StoryboardSection>

      {/* Text overlay (optional) */}
      {panel.text ? (
        <StoryboardSection
          icon={<TextT size={12} weight="bold" aria-hidden="true" />}
          label="Teks"
        >
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
            {panel.text}
          </span>
        </StoryboardSection>
      ) : null}

      {/* Transition to the next panel */}
      {panel.transition ? (
        <div className="mt-1 flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600">
          <ArrowsClockwise
            size={12}
            weight="bold"
            aria-hidden="true"
            className="text-slate-400"
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Transition
          </span>
          <span className="text-slate-700">{panel.transition}</span>
        </div>
      ) : null}
    </article>
  );
}

interface StoryboardSectionProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

/** A small labelled row used inside a scene card. */
function StoryboardSection({ icon, label, children }: StoryboardSectionProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </div>
      <p className="text-sm leading-relaxed text-slate-700">{children}</p>
    </div>
  );
}
