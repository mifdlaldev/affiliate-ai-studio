"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  CalendarBlank,
  Check,
  Copy,
  Package,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateCalendar,
  type CalendarDayResult,
} from "@/lib/actions/calendar";
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
 * Minimal row shape we need to populate the product checkbox list. RLS
 * scopes the query to the signed-in user; we only project `id` + `name`
 * so the payload stays small.
 */
interface ProductOption {
  id: string;
  name: string;
}

type ContentType = "photo" | "video" | "story" | "carousel" | "reel";
type Platform = "mixed" | "tiktok" | "instagram" | "youtube";
type Tone =
  | "casual"
  | "professional"
  | "funny"
  | "inspirational"
  | "controversial";

/** Indonesian month names indexed 1-12. */
const MONTHS: { value: number; label: string }[] = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

/**
 * Years the calendar can target. Locked to the project horizon
 * (2026-2027) for now — see `lib/validation/calendar.ts`.
 */
const YEARS: number[] = [2026, 2027];

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "photo", label: "Foto" },
  { value: "video", label: "Video" },
  { value: "story", label: "Story" },
  { value: "carousel", label: "Carousel" },
  { value: "reel", label: "Reel" },
];

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "mixed", label: "Campuran" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
];

const TONES: { value: Tone; label: string }[] = [
  { value: "casual", label: "Casual" },
  { value: "professional", label: "Professional" },
  { value: "funny", label: "Funny" },
  { value: "inspirational", label: "Inspirational" },
  { value: "controversial", label: "Controversial" },
];

/** Day-of-week header labels, Monday-first to match the calendar grid. */
const WEEKDAYS: string[] = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/**
 * Max products the user can pick for a single calendar. Mirrors the
 * Zod cap on the server side (see `lib/validation/calendar.ts`).
 */
const MAX_SELECTED_PRODUCTS = 10;

/** How long the "Tersalin!" label sticks after a successful copy. */
const COPY_FEEDBACK_MS = 2000;

/**
 * Color tag for a given content type. Centralized here so the badge
 * class stays consistent across every day card. All variants are picked
 * from the project's existing palette (indigo, sky, emerald, amber,
 * rose) — no new colors introduced.
 */
const CONTENT_TYPE_BADGE_CLASS: Record<string, string> = {
  photo: "bg-sky-500/10 text-sky-700",
  video: "bg-indigo-600/10 text-indigo-700",
  story: "bg-amber-500/10 text-amber-700",
  carousel: "bg-emerald-500/10 text-emerald-700",
  reel: "bg-rose-500/10 text-rose-700",
};

/**
 * How many days a month has. February special-cases leap years using
 * the same rule the JS `Date` object uses (year divisible by 4 except
 * centuries not divisible by 400).
 */
function daysInMonth(month: number, year: number): number {
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

/**
 * 0-indexed day-of-week for the 1st of the given month, normalized so
 * Monday = 0 and Sunday = 6. `Date.prototype.getDay()` returns
 * Sunday = 0, so we shift.
 *
 * Example: 1 Jan 2026 is a Thursday → 3.
 */
function firstDayOffset(month: number, year: number): number {
  const jsDay = new Date(year, month - 1, 1).getDay();
  // JS: Sun=0, Mon=1, ..., Sat=6 → we want Mon=0, ..., Sun=6
  return (jsDay + 6) % 7;
}

/**
 * Build a 6-row × 7-col matrix of day cells, padded with `null` for
 * the leading blanks before the 1st of the month. The grid always
 * renders 6 rows so the layout doesn't shift between 28 and 31-day
 * months.
 */
function buildCalendarCells(
  month: number,
  year: number,
): (number | null)[] {
  const totalDays = daysInMonth(month, year);
  const offset = firstDayOffset(month, year);
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= totalDays; day++) {
    cells.push(day);
  }
  // Pad the tail to a full 6 × 7 = 42 cells so the grid is stable.
  while (cells.length < 42) {
    cells.push(null);
  }
  return cells;
}

/**
 * Look up a single day cell from the calendar data. The server returns
 * a flat list (1-31 days), we index into it by `day - 1`.
 */
function findDay(
  data: CalendarDayResult[] | null,
  day: number,
): CalendarDayResult | undefined {
  if (!data) return undefined;
  return data.find((d) => d.day === day);
}

/**
 * Truncate `text` to `max` characters and append an ellipsis when it
 * was actually cut. The hook line on a day card is one line with
 * ellipsis; truncation happens in JS (not CSS) so server-side
 * FormData / SSR would render the same way.
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}...`;
}

/**
 * Content Calendar Generator module — fetches the user's saved
 * products, lets them pick 1-10 products + month/year + content types +
 * platform + tone, then calls the `generateCalendar` server action to
 * produce a 28-31 day content calendar. The result renders as a 7-col
 * month grid (Senin-Minggu), with each day card showing the day
 * number, the product name, a content type badge, and the hook line.
 *
 * States covered:
 * - products loading (skeleton-ish placeholder on the form)
 * - products empty (full-width empty state + CTA to /produk)
 * - form idle (no results yet) — default
 * - form submitting — spinner + "Menyusun kalender 30 hari..."
 * - form error — error block + "Coba Lagi" retry
 * - form success — month grid with one day card per day
 */
export function CalendarGenerator() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    new Set(),
  );
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(2026);
  const [contentTypes, setContentTypes] = useState<Set<ContentType>>(
    new Set(["photo", "reel"]),
  );
  const [platform, setPlatform] = useState<Platform>("mixed");
  const [tone, setTone] = useState<Tone>("casual");
  const [results, setResults] = useState<CalendarDayResult[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedDay, setCopiedDay] = useState<number | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch the user's saved products once on mount. RLS already scopes
  // the query to the caller; we only need id + name for the checkbox
  // list. The list is scrollable and capped at MAX_VISIBLE_PRODUCTS in
  // the render, so loading 10+ products is fine.
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
        console.error("CalendarGenerator: load products error:", fetchError);
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
   * Toggle a product's selection state. We never exceed
   * `MAX_SELECTED_PRODUCTS` (mirrors the Zod cap on the server).
   */
  function toggleProduct(id: string) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_SELECTED_PRODUCTS) {
          toast.error(`Maksimal ${MAX_SELECTED_PRODUCTS} produk per kalender`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  function toggleContentType(value: ContentType) {
    setContentTypes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  /**
   * Inline form validation mirrors the Zod schema on the server. We
   * return early with a toast if the user tries to submit with no
   * products or no content types — better than waiting for the server
   * to bounce the request.
   */
  const validationError = useMemo<string | null>(() => {
    if (selectedProductIds.size === 0) {
      return "Pilih minimal 1 produk";
    }
    if (contentTypes.size === 0) {
      return "Pilih minimal 1 content type";
    }
    return null;
  }, [selectedProductIds, contentTypes]);

  /**
   * Build a FormData from the current form state and dispatch the
   * server action. FormData is the boundary contract — the action
   * validates with Zod (see `lib/validation/calendar.ts`) and returns
   * `{ data?: CalendarDayResult[]; error?: string }`. Arrays go in as
   * repeated form fields (`getAll("productIds")`).
   */
  async function runGeneration() {
    if (generating) return;
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setGenerating(true);
    setError(null);

    const formData = new FormData();
    for (const id of selectedProductIds) {
      formData.append("productIds", id);
    }
    formData.set("month", String(month));
    formData.set("year", String(year));
    for (const ct of contentTypes) {
      formData.append("contentTypes", ct);
    }
    formData.set("platform", platform);
    formData.set("tone", tone);

    const result = await generateCalendar(formData);

    setGenerating(false);

    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    const calendar = result.data ?? [];
    setResults(calendar);
    toast.success("Content calendar berhasil dibuat!");
  }

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runGeneration();
  }

  function handleRetry() {
    void runGeneration();
  }

  /**
   * Copy a single day's full card (day number + product + content type
   * + topic + hook) as plain text. The card is small enough that one
   * tap on the copy button gives the user everything they need to
   * paste into a doc.
   *
   * Falls back to a no-op if the Clipboard API is unavailable.
   */
  async function handleCopy(day: CalendarDayResult) {
    try {
      if (!navigator.clipboard?.writeText) {
        toast.error("Browser tidak mendukung clipboard");
        return;
      }
      const text = [
        `Hari ${day.day} - ${day.contentType} - ${day.platform}`,
        `Produk: ${day.productName}`,
        `Topik: ${day.topic}`,
        `Hook: ${day.hook}`,
      ].join("\n");
      await navigator.clipboard.writeText(text);

      setCopiedDay(day.day);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopiedDay(null);
        copyTimerRef.current = null;
      }, COPY_FEEDBACK_MS);
    } catch (err) {
      console.error("Copy to clipboard failed:", err);
      toast.error("Gagal menyalin ke clipboard");
    }
  }

  // Calendar grid is derived from `month` + `year`. We rebuild it
  // whenever the user changes either so the leading-blank cells update
  // even before the server returns.
  const calendarCells = useMemo(
    () => buildCalendarCells(month, year),
    [month, year],
  );

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
              untuk generate content calendar.
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
            Pilih produk, bulan, dan tentukan rotasi konten untuk kalender
            bulanan Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleGenerate}>
            {/* Product checkboxes — multi-select, scrollable */}
            <div className="flex flex-col gap-2">
              <Label>Produk (pilih 1-10)</Label>
              <div
                data-testid="calendar-product-list"
                className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-lg border border-input bg-transparent p-2"
              >
                {productsLoading ? (
                  <p className="px-2 py-1 text-xs text-slate-500">
                    Memuat produk...
                  </p>
                ) : (
                  products.map((product) => {
                    const checked = selectedProductIds.has(product.id);
                    return (
                      <label
                        key={product.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                          checked
                            ? "bg-indigo-600/10 font-medium text-indigo-700"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          data-testid={`calendar-product-${product.id}`}
                          checked={checked}
                          onChange={() => toggleProduct(product.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/30"
                        />
                        <span className="truncate">{product.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
              {selectedProductIds.size > 0 ? (
                <p className="text-xs text-slate-500">
                  {selectedProductIds.size} produk dipilih
                </p>
              ) : null}
            </div>

            {/* Month + year */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="calendar-month">Bulan</Label>
                <select
                  id="calendar-month"
                  data-testid="calendar-month"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="calendar-year">Tahun</Label>
                <select
                  id="calendar-year"
                  data-testid="calendar-year"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Content type checkboxes */}
            <div className="flex flex-col gap-2">
              <Label>Content Type (pilih minimal 1)</Label>
              <div
                data-testid="calendar-content-types"
                className="grid grid-cols-2 gap-1.5"
              >
                {CONTENT_TYPES.map((ct) => {
                  const checked = contentTypes.has(ct.value);
                  return (
                    <label
                      key={ct.value}
                      data-testid={`calendar-content-type-${ct.value}`}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-colors ${
                        checked
                          ? "border-indigo-600 bg-indigo-600/10 font-medium text-indigo-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleContentType(ct.value)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/30"
                      />
                      {ct.label}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Platform */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="calendar-platform">Platform</Label>
              <select
                id="calendar-platform"
                data-testid="calendar-platform"
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

            {/* Tone */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="calendar-tone">Tone</Label>
              <select
                id="calendar-tone"
                data-testid="calendar-tone"
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

            <Button
              type="submit"
              disabled={generating}
              className="mt-2 w-full"
              data-testid="calendar-generate"
            >
              {generating ? (
                <>
                  <ArrowClockwise
                    size={16}
                    weight="bold"
                    aria-hidden="true"
                    className="animate-spin"
                  />
                  Menyusun...
                </>
              ) : (
                <>
                  <Sparkle size={16} weight="fill" aria-hidden="true" />
                  Generate Calendar
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
            Content calendar bulanan yang dihasilkan AI. Klik tombol
            &ldquo;Salin&rdquo; untuk menyalin detail satu hari ke clipboard.
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
          data-testid="calendar-loading"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
        >
          <CalendarBlank
            size={32}
            weight="duotone"
            aria-hidden="true"
            className="animate-pulse text-indigo-600"
          />
          <p className="text-sm font-medium text-slate-700">
            {`Menyusun kalender ${daysInMonth(month, year)} hari...`}
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div
          data-testid="calendar-error"
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
        <div className="flex flex-col gap-3" data-testid="calendar-grid">
          {/* Month header — confirms which month the grid is showing. */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">
              {MONTHS.find((m) => m.value === month)?.label} {year}
            </h3>
            <span className="text-xs font-medium text-slate-500">
              {results.length} hari
            </span>
          </div>

          {/* Day-of-week header row. Senin is column 0, Minggu is 6. */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-slate-500">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                data-testid={`calendar-weekday-${wd}`}
                className="py-1"
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Day cells — 6 rows × 7 cols. Blank cells are `null` and
              render as an empty placeholder so the grid stays aligned
              even when the 1st falls on, say, a Thursday. */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarCells.map((cell, index) => {
              if (cell === null) {
                return (
                  <div
                    key={`blank-${index}`}
                    className="min-h-24 rounded-lg bg-slate-50"
                    aria-hidden="true"
                  />
                );
              }
              const dayData = findDay(results, cell);
              return (
                <DayCard
                  key={`day-${cell}`}
                  day={cell}
                  data={dayData}
                  isCopied={copiedDay === cell}
                  onCopy={handleCopy}
                />
              );
            })}
          </div>
        </div>
      );
    }

    // Default — form is idle and no results yet.
    return (
      <div
        data-testid="calendar-empty"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
          <CalendarBlank size={32} weight="duotone" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          Belum ada kalender
        </h3>
        <p className="max-w-sm text-sm text-slate-500">
          Pilih produk, atur bulan dan rotasi konten, lalu klik Generate
          untuk menyusun kalender 28-31 hari siap pakai.
        </p>
      </div>
    );
  }
}

/**
 * One day cell in the calendar grid. Renders the day number, the
 * product name (truncated), the content type as a small colored
 * badge, and the hook line (1 line, ellipsized). An optional copy
 * button is shown on hover so the grid doesn't feel cluttered.
 */
function DayCard({
  day,
  data,
  isCopied,
  onCopy,
}: {
  day: number;
  data: CalendarDayResult | undefined;
  isCopied: boolean;
  onCopy: (day: CalendarDayResult) => void;
}) {
  // Pad the day number for the missing-cell look — "01", "02", ...
  // so columns line up visually.
  const dayLabel = day.toString().padStart(2, "0");

  // The card body collapses to a placeholder when the server hasn't
  // returned data for this day yet (e.g. a partial response). We still
  // render the day number so the grid stays stable.
  if (!data) {
    return (
      <div
        data-testid="calendar-day-card"
        className="flex min-h-24 flex-col gap-1 rounded-lg border border-dashed border-slate-200 bg-white p-1.5"
      >
        <div className="text-xs font-bold text-slate-400">{dayLabel}</div>
      </div>
    );
  }

  const badgeClass =
    CONTENT_TYPE_BADGE_CLASS[data.contentType] ??
    "bg-slate-500/10 text-slate-700";

  return (
    <div
      data-testid="calendar-day-card"
      className="group flex min-h-24 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-1.5 transition-colors hover:border-indigo-200"
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-800">{dayLabel}</div>
        <button
          type="button"
          onClick={() => onCopy(data)}
          aria-label={isCopied ? "Tersalin" : "Salin"}
          className="rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-indigo-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 group-hover:opacity-100"
        >
          {isCopied ? (
            <Check size={12} weight="bold" aria-hidden="true" />
          ) : (
            <Copy size={12} weight="bold" aria-hidden="true" />
          )}
        </button>
      </div>
      <div
        data-testid="calendar-day-product"
        className="truncate text-[10px] font-medium text-slate-700"
        title={data.productName}
      >
        {truncate(data.productName, 18)}
      </div>
      <div className="flex flex-wrap gap-0.5">
        <span
          data-testid="calendar-day-content-type"
          className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${badgeClass}`}
        >
          {data.contentType}
        </span>
      </div>
      <div
        data-testid="calendar-day-hook"
        className="line-clamp-1 text-[10px] leading-tight text-slate-500"
        title={data.hook}
      >
        {truncate(data.hook, 40)}
      </div>
    </div>
  );
}
