"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  Check,
  Copy,
  Package,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateModelPrompts,
  type ModelPromptResult,
} from "@/lib/actions/models";
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

type Style = "minimalist" | "professional" | "lifestyle" | "creative";
type Mood = "warm" | "cool" | "dramatic" | "natural" | "playful";
type Setting = "studio" | "outdoor" | "lifestyle" | "macro";
type Composition = "close-up" | "flat-lay" | "hero" | "lifestyle";
type Gender = "pria" | "wanita" | "any";
type Age = "remaja" | "dewasa" | "paruh baya" | "lansia";
type ModelVibe = "casual" | "elegan" | "atletik" | "profesional";

const STYLES: { value: Style; label: string }[] = [
  { value: "minimalist", label: "Minimalist" },
  { value: "professional", label: "Professional" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "creative", label: "Creative" },
];

const MOODS: { value: Mood; label: string }[] = [
  { value: "warm", label: "Warm" },
  { value: "cool", label: "Cool" },
  { value: "dramatic", label: "Dramatic" },
  { value: "natural", label: "Natural" },
  { value: "playful", label: "Playful" },
];

const SETTINGS: { value: Setting; label: string }[] = [
  { value: "studio", label: "Studio" },
  { value: "outdoor", label: "Outdoor" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "macro", label: "Macro" },
];

const COMPOSITIONS: { value: Composition; label: string }[] = [
  { value: "close-up", label: "Close-up" },
  { value: "flat-lay", label: "Flat Lay" },
  { value: "hero", label: "Hero" },
  { value: "lifestyle", label: "Lifestyle" },
];

const GENDERS: { value: Gender; label: string }[] = [
  { value: "pria", label: "Pria" },
  { value: "wanita", label: "Wanita" },
  { value: "any", label: "Semua" },
];

const AGES: { value: Age; label: string }[] = [
  { value: "remaja", label: "Remaja" },
  { value: "dewasa", label: "Dewasa" },
  { value: "paruh baya", label: "Paruh Baya" },
  { value: "lansia", label: "Lansia" },
];

const MODEL_VIBES: { value: ModelVibe; label: string }[] = [
  { value: "casual", label: "Kasual" },
  { value: "elegan", label: "Elegan" },
  { value: "atletik", label: "Atletik" },
  { value: "profesional", label: "Profesional" },
];

/** How long the "Tersalin!" label sticks after a successful copy. */
const COPY_FEEDBACK_MS = 2000;

/**
 * Shared className for the inline `<select>` inputs. Tailwind classes
 * are duplicated per-element (not extracted) so each select stays a
 * drop-in replacement that matches the photo-generator styling.
 */
const SELECT_CLASSNAME =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

/**
 * Model Prompt Generator module — fetches the user's saved products,
 * lets them pick one + set style/mood/setting/composition + model
 * profile (gender, age, vibe), then calls the `generateModelPrompts`
 * server action to produce 3-5 model prompt variations intended for
 * Midjourney / Leonardo / DALL-E.
 *
 * Each result card displays:
 * - A short hooked title in Bahasa Indonesia.
 * - The full English visual prompt in a copyable, monospace block.
 * - A teal `Model` badge with the `modelDescription` (age, gender,
 *   vibe, pose, clothing) so the user can see the model profile at a
 *   glance without scanning the prompt body.
 * - Four metadata badges (Aspect Ratio, Lighting, Color Palette,
 *   Camera Angle) for at-a-glance comparison.
 * - A copy button that copies the full prompt text to the clipboard.
 *
 * States covered:
 * - products loading (skeleton-ish placeholder on the form)
 * - products empty (full-width empty state + CTA to /produk)
 * - form idle (no results yet) — default
 * - form submitting — spinner + "Membuat prompt model..."
 * - form error — error block with the failed message
 * - form success — list of prompt cards with model + metadata badges
 */
export function ModelGenerator() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [style, setStyle] = useState<Style>("minimalist");
  const [mood, setMood] = useState<Mood>("warm");
  const [setting, setSetting] = useState<Setting>("studio");
  const [composition, setComposition] = useState<Composition>("hero");
  const [gender, setGender] = useState<Gender>("any");
  const [age, setAge] = useState<Age>("dewasa");
  const [modelVibe, setModelVibe] = useState<ModelVibe>("casual");
  const [results, setResults] = useState<ModelPromptResult[] | null>(null);
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
        console.error("ModelGenerator: load products error:", fetchError);
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
   * validates with Zod (see `lib/validation/model.ts`) and returns
   * `{ data?: ModelPromptResult[]; error?: string }`.
   */
  async function runGeneration() {
    if (!selectedProductId || generating) return;

    setGenerating(true);
    setError(null);

    const formData = new FormData();
    formData.set("productId", selectedProductId);
    formData.set("style", style);
    formData.set("mood", mood);
    formData.set("setting", setting);
    formData.set("composition", composition);
    formData.set("gender", gender);
    formData.set("age", age);
    formData.set("modelVibe", modelVibe);

    const result = await generateModelPrompts(formData);

    setGenerating(false);

    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    const models = result.data ?? [];
    setResults(models);
    toast.success("Prompt model berhasil dibuat!");
  }

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runGeneration();
  }

  /**
   * Copy a single model prompt's full English text to the clipboard
   * and flip the button label for `COPY_FEEDBACK_MS`. We copy just the
   * `prompt` field (not the title, model description, or metadata)
   * because that's exactly what the user wants to paste into
   * Midjourney / Leonardo.
   *
   * Falls back to a no-op if the Clipboard API is unavailable
   * (e.g. on http://, very old browsers).
   */
  async function handleCopy(model: ModelPromptResult, index: number) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(model.prompt);
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
              untuk generate prompt model.
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
            Pilih produk, atur gaya visual foto, dan profil model yang
            Anda inginkan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleGenerate}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="model-product">Produk</Label>
              <select
                id="model-product"
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
              <Label htmlFor="model-style">Style</Label>
              <select
                id="model-style"
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
              <Label htmlFor="model-mood">Mood</Label>
              <select
                id="model-mood"
                value={mood}
                onChange={(e) => setMood(e.target.value as Mood)}
                className={SELECT_CLASSNAME}
              >
                {MOODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="model-setting">Setting</Label>
              <select
                id="model-setting"
                value={setting}
                onChange={(e) => setSetting(e.target.value as Setting)}
                className={SELECT_CLASSNAME}
              >
                {SETTINGS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="model-composition">Komposisi</Label>
              <select
                id="model-composition"
                value={composition}
                onChange={(e) =>
                  setComposition(e.target.value as Composition)
                }
                className={SELECT_CLASSNAME}
              >
                {COMPOSITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="model-gender">Gender</Label>
              <select
                id="model-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className={SELECT_CLASSNAME}
              >
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="model-age">Usia</Label>
              <select
                id="model-age"
                value={age}
                onChange={(e) => setAge(e.target.value as Age)}
                className={SELECT_CLASSNAME}
              >
                {AGES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="model-vibe">Vibe</Label>
              <select
                id="model-vibe"
                value={modelVibe}
                onChange={(e) => setModelVibe(e.target.value as ModelVibe)}
                className={SELECT_CLASSNAME}
              >
                {MODEL_VIBES.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="submit"
              disabled={!selectedProductId || generating}
              className="mt-2"
            >
              {generating ? (
                <>
                  <ArrowClockwise
                    size={16}
                    weight="bold"
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Membuat prompt...
                </>
              ) : (
                <>
                  <UserCircle size={16} weight="bold" aria-hidden="true" />
                  Generate Prompt Model
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
   * - list of model prompt cards if results exist
   * - empty placeholder otherwise
   */
  function renderResultPanel() {
    if (generating) {
      return (
        <div
          data-testid="model-loading"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
        >
          <UserCircle
            size={32}
            weight="duotone"
            aria-hidden="true"
            className="text-indigo-600"
          />
          <p className="text-sm font-medium text-slate-700">
            Membuat prompt model...
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div
          data-testid="model-error"
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

    if (results && results.length > 0) {
      return (
        <ul className="flex flex-col gap-4">
          {results.map((model, index) => {
            const isCopied = copiedIndex === index;
            return (
              <li
                key={`${model.title}-${index}`}
                data-testid="model-card"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="text-base font-bold text-slate-800">
                    {model.title}
                  </h3>
                </div>

                <pre
                  data-testid="model-prompt-block"
                  className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800"
                >
                  {model.prompt}
                </pre>

                {/* Model description badge — model-specific. Teal so it
                    visually distinguishes from the photo metadata badges
                    below (which are indigo/amber/emerald/sky). */}
                <div className="mt-3">
                  <span
                    data-testid="model-badge-description"
                    className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-700"
                  >
                    <span className="text-[10px] uppercase tracking-wide text-teal-500">
                      Model
                    </span>
                    <span>{model.modelDescription}</span>
                  </span>
                </div>

                {/* Metadata badges. */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    data-testid="model-badge-aspect"
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-600/10 px-2.5 py-1 text-xs font-medium text-indigo-700"
                  >
                    <span className="text-[10px] uppercase tracking-wide text-indigo-500">
                      Rasio
                    </span>
                    <span>{model.aspectRatio}</span>
                  </span>
                  <span
                    data-testid="model-badge-lighting"
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700"
                  >
                    <span className="text-[10px] uppercase tracking-wide text-amber-500">
                      Cahaya
                    </span>
                    <span>{model.lighting}</span>
                  </span>
                  <span
                    data-testid="model-badge-palette"
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700"
                  >
                    <span className="text-[10px] uppercase tracking-wide text-emerald-500">
                      Palet
                    </span>
                    <span>{model.colorPalette}</span>
                  </span>
                  <span
                    data-testid="model-badge-angle"
                    className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-700"
                  >
                    <span className="text-[10px] uppercase tracking-wide text-sky-500">
                      Angle
                    </span>
                    <span>{model.cameraAngle}</span>
                  </span>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(model, index)}
                    aria-label={isCopied ? "Tersalin" : "Salin"}
                  >
                    {isCopied ? (
                      <>
                        <Check
                          size={14}
                          weight="bold"
                          aria-hidden="true"
                        />
                        Tersalin!
                      </>
                    ) : (
                      <>
                        <Copy
                          size={14}
                          weight="bold"
                          aria-hidden="true"
                        />
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
        data-testid="model-empty"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
          <UserCircle size={32} weight="duotone" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          Belum ada hasil
        </h3>
        <p className="max-w-sm text-sm text-slate-500">
          Pilih produk dan mulai generate prompt model. AI akan
          menghasilkan 3-5 variasi prompt Midjourney / Leonardo siap
          pakai lengkap dengan deskripsi model, aspek, pencahayaan,
          palet warna, dan angle.
        </p>
      </div>
    );
  }
}
