"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  CalendarBlank,
  Check,
  Copy,
  Package,
  ShareNetwork,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateSocialCalendar,
  type SocialResult,
  type SocialDay,
} from "@/lib/actions/social";
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
 * Social Media Content Calendar module — fetches the user's saved
 * products, lets them pick one + a social platform (TikTok / Instagram
 * / YouTube / Twitter / Facebook) + a writing tone, then calls the
 * `generateSocialCalendar` server action to produce a 7-day content
 * calendar for that single platform.
 *
 * Each day-card displays:
 * - The day number (1..7)
 * - The content type (Reels / Story / Carousel / Short / Tweet / etc)
 * - The topic (short hook-style topic)
 * - The caption (ready-to-paste copy)
 * - The hashtags (rendered as small pill badges with #)
 * - The best posting time (in WIB)
 * - A per-day copy button so the user can copy just one day's caption
 *   + hashtags at a time
 *
 * States covered:
 * - products loading (form disabled)
 * - products empty (full-width empty state + CTA to /produk)
 * - form idle (no results yet) — default
 * - form submitting — spinner + "Membuat kalender..."
 * - form error — error block with the failed message
 * - form success — 7 day cards in a responsive grid
 */

type Platform = "tiktok" | "instagram" | "youtube" | "twitter" | "facebook";
type Tone =
  | "kasual"
  | "profesional"
  | "energik"
  | "inspiratif"
  | "edukatif";

/** Minimal row shape we need to populate the product dropdown. */
interface ProductOption {
  id: string;
  name: string;
}

function SocialGenerator() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [tone, setTone] = useState<Tone>("kasual");
  const [result, setResult] = useState<SocialResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedDay, setCopiedDay] = useState<number | null>(null);

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
          "SocialGenerator: load products error:",
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

  /**
   * Build a FormData from the current form state and dispatch the
   * server action. FormData is the boundary contract — the action
   * validates with Zod (see `lib/validation/social.ts`) and returns
   * `{ data?: SocialResult; error?: string }`.
   */
  async function runGeneration() {
    if (!selectedProductId || generating) return;

    setGenerating(true);
    setError(null);

    const formData = new FormData();
    formData.set("productId", selectedProductId);
    formData.set("platform", platform);
    formData.set("tone", tone);

    const response = await generateSocialCalendar(formData);

    setGenerating(false);

    if (response.error) {
      setError(response.error);
      toast.error(response.error);
      return;
    }

    setResult(response.data ?? null);
    toast.success("Kalender social media berhasil dibuat!");
  }

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runGeneration();
  }

  /**
   * Copy a single day's caption + hashtags to the clipboard and
   * flash the per-day "Tersalin" badge for `COPY_FEEDBACK_MS`.
   * Falls back to a no-op if the Clipboard API is unavailable.
   */
  async function handleCopyDay(day: SocialDay) {
    const text = `${day.caption}\n\n${day.hashtags.join(" ")}`;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        toast.error("Browser tidak mendukung clipboard");
        return;
      }
      setCopiedDay(day.day);
      toast.success(`Caption hari ke-${day.day} tersalin!`);
      setTimeout(() => {
        setCopiedDay((current) => (current === day.day ? null : current));
      }, COPY_FEEDBACK_MS);
    } catch (err) {
      console.error("Copy to clipboard failed:", err);
      toast.error("Gagal menyalin caption");
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
              untuk generate kalender social media 7 hari.
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
            Pilih produk, platform sosial, dan tone yang Anda inginkan.
            AI akan membuat kalender 7 hari siap posting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleGenerate}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="social-product">Produk</Label>
              <select
                id="social-product"
                data-testid="social-product"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={productsLoading}
                className={SELECT_CLASSNAME}
                required
              >
                <option value="" disabled>
                  {productsLoading
                    ? "Memuat produk..."
                    : "Pilih produk"}
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="social-platform">Platform</Label>
              <select
                id="social-platform"
                data-testid="social-platform"
                value={platform}
                onChange={(e) =>
                  setPlatform(e.target.value as Platform)
                }
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
              <Label htmlFor="social-tone">Tone</Label>
              <select
                id="social-tone"
                data-testid="social-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className={SELECT_CLASSNAME}
              >
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="submit"
              disabled={!selectedProductId || generating || productsLoading}
              className="mt-2 inline-flex items-center gap-2"
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
                  Generate 7-Day Calendar
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
            Kalender 7 hari untuk platform pilihan Anda. Klik tombol
            &ldquo;Salin&rdquo; untuk menyalin caption + hashtags satu
            hari.
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
          data-testid="social-loading"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
        >
          <ShareNetwork
            size={32}
            weight="duotone"
            aria-hidden="true"
            className="text-indigo-600"
          />
          <p className="text-sm font-medium text-slate-700">
            Membuat kalender social media...
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div
          data-testid="social-error"
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
            onClick={() => void runGeneration()}
          >
            Coba Lagi
          </Button>
        </div>
      );
    }

    if (result) {
      return (
        <div
          data-testid="social-result"
          className="flex flex-col gap-3"
        >
          <div className="mb-1 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            <CalendarBlank
              size={14}
              weight="bold"
              aria-hidden="true"
            />
            Platform: {result.platform} - 7 hari
          </div>
          <div
            data-testid="social-days"
            className="grid grid-cols-1 gap-3"
          >
            {result.days.map((day) => (
              <DayCard
                key={day.day}
                day={day}
                copied={copiedDay === day.day}
                onCopy={() => void handleCopyDay(day)}
              />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div
        data-testid="social-empty"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
          <ShareNetwork
            size={32}
            weight="duotone"
            aria-hidden="true"
          />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          Belum ada hasil
        </h3>
        <p className="max-w-sm text-sm text-slate-500">
          Pilih produk + platform + tone di panel kiri, lalu klik
          &ldquo;Generate 7-Day Calendar&rdquo;. AI akan membuat
          caption siap posting untuk 7 hari ke depan.
        </p>
      </div>
    );
  }
}

// ---- Sub-components --------------------------------------------------------

interface DayCardProps {
  day: SocialDay;
  copied: boolean;
  onCopy: () => void;
}

function DayCard({ day, copied, onCopy }: DayCardProps) {
  return (
    <Card
      data-testid="social-day-card"
      data-day={day.day}
      className="border-slate-200"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {day.day}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {day.contentType}
              </span>
            </div>
            <CardTitle className="text-base leading-snug text-slate-800">
              {day.topic}
            </CardTitle>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCopy}
            data-testid={`social-day-copy-${day.day}`}
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
                Salin
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {day.caption}
        </p>
        <div
          data-testid={`social-day-hashtags-${day.day}`}
          className="flex flex-wrap gap-1.5"
        >
          {day.hashtags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 border-t border-slate-100 pt-2 text-xs text-slate-500">
          <CalendarBlank
            size={12}
            weight="bold"
            aria-hidden="true"
          />
          <span>Best time: {day.bestTime}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Static option lists ---------------------------------------------------

const PLATFORMS: ReadonlyArray<{ value: Platform; label: string }> = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "Twitter / X" },
  { value: "facebook", label: "Facebook" },
];

const TONES: ReadonlyArray<{ value: Tone; label: string }> = [
  { value: "kasual", label: "Kasual" },
  { value: "profesional", label: "Profesional" },
  { value: "energik", label: "Energik" },
  { value: "inspiratif", label: "Inspiratif" },
  { value: "edukatif", label: "Edukatif" },
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

export { SocialGenerator };
