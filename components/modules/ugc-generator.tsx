"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  Check,
  Copy,
  FilmSlate,
  ImageSquare,
  Package,
  Sparkle,
  UsersThree,
  VideoCamera,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateUgcScript,
  generateUgcStoryboard,
  generateUgcPrompt,
  generateUgcBatch,
  type UgcScriptResult,
  type UgcStoryboardPanel,
  type UgcPromptItem,
  type UgcBatchItem,
} from "@/lib/actions/ugc";
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
 * Minimal row shape we need to populate the product dropdown. RLS
 * scopes the query to the signed-in user; we only project `id` + `name`
 * so the payload stays small.
 */
interface ProductOption {
  id: string;
  name: string;
}

// ---- Tab types -------------------------------------------------------------

type UgcTab = "script" | "storyboard" | "prompt" | "batch";

const TAB_ORDER: UgcTab[] = ["script", "storyboard", "prompt", "batch"];

const TAB_LABELS: Record<UgcTab, string> = {
  script: "Script",
  storyboard: "Storyboard",
  prompt: "Prompt",
  batch: "Batch",
};

// ---- Shared form enums ----------------------------------------------------

type Platform = "tiktok" | "instagram" | "youtube" | "facebook";
type Tone =
  | "casual"
  | "professional"
  | "funny"
  | "inspirational"
  | "controversial";
type PromptStyle = "selfie" | "unboxing" | "testimonial" | "lifestyle" | "flat-lay";
type PromptMood = "candid" | "energetic" | "calm" | "playful" | "luxurious";

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
];

const TONES: { value: Tone; label: string }[] = [
  { value: "casual", label: "Casual" },
  { value: "professional", label: "Professional" },
  { value: "funny", label: "Funny" },
  { value: "inspirational", label: "Inspirational" },
  { value: "controversial", label: "Controversial" },
];

const PROMPT_STYLES: { value: PromptStyle; label: string }[] = [
  { value: "selfie", label: "Selfie" },
  { value: "unboxing", label: "Unboxing" },
  { value: "testimonial", label: "Testimonial" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "flat-lay", label: "Flat Lay" },
];

const PROMPT_MOODS: { value: PromptMood; label: string }[] = [
  { value: "candid", label: "Candid" },
  { value: "energetic", label: "Energetic" },
  { value: "calm", label: "Calm" },
  { value: "playful", label: "Playful" },
  { value: "luxurious", label: "Luxurious" },
];

/** How long the "Tersalin!" label sticks after a successful copy. */
const COPY_FEEDBACK_MS = 2000;

// ============================================================================
// UGC Generator — 4-tab client component.
// ============================================================================
//
// The UGC page hosts 4 sub-modules in a single route, switched via a tablist:
//
//   - Script     → 1 product + platform + tone + audience → 1 UGC script
//   - Storyboard → 1 product + platform + tone             → 4-6 panel storyboard
//   - Prompt     → 1 product + style + mood                → 3-5 image-gen prompts
//   - Batch      → 2-5 products + platform + tone          → 1 script per product
//
// Each tab uses the same layout: a form panel on the left, a result
// panel on the right, with shared states (loading / error / empty /
// success). All four share the same `useEffect` to fetch the user's
// products; switching tabs does NOT refetch.
//
// States covered (per tab):
// - products loading (skeleton-ish placeholder on the form)
// - products empty (full-width empty state + CTA to /produk)
// - form idle (no results yet) — default
// - form submitting — spinner + tab-specific copy
// - form error — error block with the failed message
// - form success — tab-specific result cards
// ============================================================================

export function UgcGenerator() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<UgcTab>("script");

  // Script tab state
  const [scriptProductId, setScriptProductId] = useState<string>("");
  const [scriptPlatform, setScriptPlatform] = useState<Platform>("tiktok");
  const [scriptTone, setScriptTone] = useState<Tone>("casual");
  const [scriptAudience, setScriptAudience] = useState<string>("");
  const [scriptResults, setScriptResults] = useState<UgcScriptResult | null>(
    null,
  );
  const [scriptGenerating, setScriptGenerating] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Storyboard tab state
  const [storyboardProductId, setStoryboardProductId] = useState<string>("");
  const [storyboardPlatform, setStoryboardPlatform] =
    useState<Platform>("tiktok");
  const [storyboardTone, setStoryboardTone] = useState<Tone>("casual");
  const [storyboardResults, setStoryboardResults] = useState<
    UgcStoryboardPanel[] | null
  >(null);
  const [storyboardGenerating, setStoryboardGenerating] = useState(false);
  const [storyboardError, setStoryboardError] = useState<string | null>(null);

  // Prompt tab state
  const [promptProductId, setPromptProductId] = useState<string>("");
  const [promptStyle, setPromptStyle] = useState<PromptStyle>("selfie");
  const [promptMood, setPromptMood] = useState<PromptMood>("candid");
  const [promptResults, setPromptResults] = useState<UgcPromptItem[] | null>(
    null,
  );
  const [promptGenerating, setPromptGenerating] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  // Batch tab state
  const [batchProductIds, setBatchProductIds] = useState<string[]>([]);
  const [batchPlatform, setBatchPlatform] = useState<Platform>("tiktok");
  const [batchTone, setBatchTone] = useState<Tone>("casual");
  const [batchResults, setBatchResults] = useState<UgcBatchItem[] | null>(
    null,
  );
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Copy feedback — single shared timer across all tabs (only one tab
  // shows results at a time, so a single index is enough).
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
        console.error("UgcGenerator: load products error:", fetchError);
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

  // ----- Batch checkbox handlers -------------------------------------------

  function toggleBatchProduct(productId: string) {
    setBatchProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }
      // Enforce min 2, max 5 — silently ignore the 6th check.
      if (prev.length >= 5) {
        toast.error("Maksimal 5 produk untuk 1 batch");
        return prev;
      }
      return [...prev, productId];
    });
  }

  // ----- Per-tab generation handlers ---------------------------------------

  async function runScript() {
    if (!scriptProductId || scriptGenerating) return;
    setScriptGenerating(true);
    setScriptError(null);

    const formData = new FormData();
    formData.set("productId", scriptProductId);
    formData.set("platform", scriptPlatform);
    formData.set("tone", scriptTone);
    formData.set("audience", scriptAudience.trim());

    const result = await generateUgcScript(formData);
    setScriptGenerating(false);

    if (result.error) {
      setScriptError(result.error);
      toast.error(result.error);
      return;
    }

    if (result.data) {
      setScriptResults(result.data);
      toast.success("UGC script berhasil dibuat!");
    }
  }

  async function runStoryboard() {
    if (!storyboardProductId || storyboardGenerating) return;
    setStoryboardGenerating(true);
    setStoryboardError(null);

    const formData = new FormData();
    formData.set("productId", storyboardProductId);
    formData.set("platform", storyboardPlatform);
    formData.set("tone", storyboardTone);

    const result = await generateUgcStoryboard(formData);
    setStoryboardGenerating(false);

    if (result.error) {
      setStoryboardError(result.error);
      toast.error(result.error);
      return;
    }

    if (result.data) {
      setStoryboardResults(result.data);
      toast.success("Storyboard berhasil dibuat!");
    }
  }

  async function runPrompt() {
    if (!promptProductId || promptGenerating) return;
    setPromptGenerating(true);
    setPromptError(null);

    const formData = new FormData();
    formData.set("productId", promptProductId);
    formData.set("style", promptStyle);
    formData.set("mood", promptMood);

    const result = await generateUgcPrompt(formData);
    setPromptGenerating(false);

    if (result.error) {
      setPromptError(result.error);
      toast.error(result.error);
      return;
    }

    if (result.data) {
      setPromptResults(result.data);
      toast.success("Prompt foto berhasil dibuat!");
    }
  }

  async function runBatch() {
    if (batchProductIds.length < 2 || batchGenerating) return;
    setBatchGenerating(true);
    setBatchError(null);

    const formData = new FormData();
    for (const id of batchProductIds) {
      formData.append("productIds", id);
    }
    formData.set("platform", batchPlatform);
    formData.set("tone", batchTone);

    const result = await generateUgcBatch(formData);
    setBatchGenerating(false);

    if (result.error) {
      setBatchError(result.error);
      toast.error(result.error);
      return;
    }

    if (result.data) {
      setBatchResults(result.data);
      toast.success(`${result.data.length} UGC script berhasil dibuat!`);
    }
  }

  // ----- Form submit handlers ----------------------------------------------

  function handleScriptSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runScript();
  }

  function handleStoryboardSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runStoryboard();
  }

  function handlePromptSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runPrompt();
  }

  function handleBatchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runBatch();
  }

  // ----- Copy-to-clipboard --------------------------------------------------

  async function handleCopy(text: string, index: number) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
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

  // ----- Tab switching (a11y) -----------------------------------------------

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % TAB_ORDER.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TAB_ORDER.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    setActiveTab(TAB_ORDER[nextIndex] ?? activeTab);
  }

  // ----- Render ------------------------------------------------------------

  // Full-width empty state when the user has zero saved products. The
  // form is meaningless without a product, so we hide it entirely.
  if (!productsLoading && products.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
            <UsersThree size={32} weight="duotone" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="mb-1">Belum ada produk</CardTitle>
            <CardDescription>
              Buat produk dulu di Product Studio, lalu kembali ke sini
              untuk generate UGC script, storyboard, prompt, dan batch.
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
    <div className="space-y-6">
      {/* Tab bar — uses the WAI-ARIA tablist pattern so keyboard
          navigation (Arrow / Home / End) and screen readers work. */}
      <div
        role="tablist"
        aria-label="UGC Generator sub-modules"
        className="flex flex-wrap gap-1 border-b border-slate-200"
      >
        {TAB_ORDER.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`ugc-tab-${tab}`}
              aria-selected={isActive}
              aria-controls={`ugc-panel-${tab}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab)}
              onKeyDown={handleTabKeyDown}
              className={
                isActive
                  ? "relative px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors"
                  : "relative px-4 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
              }
            >
              {TAB_LABELS[tab]}
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-indigo-600"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Tab panels — only the active tab is rendered, so screen
          readers / tab-keys focus on the right form. */}
      {activeTab === "script" ? (
        <UgcScriptPanel
          products={products}
          productsLoading={productsLoading}
          productId={scriptProductId}
          setProductId={setScriptProductId}
          platform={scriptPlatform}
          setPlatform={setScriptPlatform}
          tone={scriptTone}
          setTone={setScriptTone}
          audience={scriptAudience}
          setAudience={setScriptAudience}
          results={scriptResults}
          generating={scriptGenerating}
          error={scriptError}
          copiedIndex={copiedIndex}
          onSubmit={handleScriptSubmit}
          onCopy={handleCopy}
        />
      ) : null}

      {activeTab === "storyboard" ? (
        <UgcStoryboardPanel
          products={products}
          productsLoading={productsLoading}
          productId={storyboardProductId}
          setProductId={setStoryboardProductId}
          platform={storyboardPlatform}
          setPlatform={setStoryboardPlatform}
          tone={storyboardTone}
          setTone={setStoryboardTone}
          results={storyboardResults}
          generating={storyboardGenerating}
          error={storyboardError}
          copiedIndex={copiedIndex}
          onSubmit={handleStoryboardSubmit}
          onCopy={handleCopy}
        />
      ) : null}

      {activeTab === "prompt" ? (
        <UgcPromptPanel
          products={products}
          productsLoading={productsLoading}
          productId={promptProductId}
          setProductId={setPromptProductId}
          style={promptStyle}
          setStyle={setPromptStyle}
          mood={promptMood}
          setMood={setPromptMood}
          results={promptResults}
          generating={promptGenerating}
          error={promptError}
          copiedIndex={copiedIndex}
          onSubmit={handlePromptSubmit}
          onCopy={handleCopy}
        />
      ) : null}

      {activeTab === "batch" ? (
        <UgcBatchPanel
          products={products}
          productsLoading={productsLoading}
          selectedProductIds={batchProductIds}
          onToggleProduct={toggleBatchProduct}
          platform={batchPlatform}
          setPlatform={setBatchPlatform}
          tone={batchTone}
          setTone={setBatchTone}
          results={batchResults}
          generating={batchGenerating}
          error={batchError}
          copiedIndex={copiedIndex}
          onSubmit={handleBatchSubmit}
          onCopy={handleCopy}
        />
      ) : null}
    </div>
  );
}

// ============================================================================
// Per-tab panel components
// ============================================================================
//
// Each panel owns its own left-form / right-result layout, mirroring
// the existing single-module generators. Splitting them keeps the
// parent `UgcGenerator` from ballooning and lets each tab evolve
// independently (e.g. add audience textarea to Storyboard later).
// ============================================================================

// ---- Script panel ---------------------------------------------------------

interface UgcScriptPanelProps {
  products: ProductOption[];
  productsLoading: boolean;
  productId: string;
  setProductId: (v: string) => void;
  platform: Platform;
  setPlatform: (v: Platform) => void;
  tone: Tone;
  setTone: (v: Tone) => void;
  audience: string;
  setAudience: (v: string) => void;
  results: UgcScriptResult | null;
  generating: boolean;
  error: string | null;
  copiedIndex: number | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCopy: (text: string, index: number) => void;
}

function UgcScriptPanel(props: UgcScriptPanelProps) {
  const {
    products,
    productsLoading,
    productId,
    setProductId,
    platform,
    setPlatform,
    tone,
    setTone,
    audience,
    setAudience,
    results,
    generating,
    error,
    copiedIndex,
    onSubmit,
    onCopy,
  } = props;

  return (
    <div
      role="tabpanel"
      id="ugc-panel-script"
      aria-labelledby="ugc-tab-script"
      className="grid grid-cols-1 gap-6 md:grid-cols-3"
    >
      {/* LEFT — form panel */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Pengaturan</CardTitle>
          <CardDescription>
            Pilih produk dan atur target audiens UGC script Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ugc-script-product">Produk</Label>
              <select
                id="ugc-script-product"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                disabled={productsLoading}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              >
                <option value="" disabled>
                  {productsLoading ? "Memuat produk..." : "Pilih produk"}
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ugc-script-platform">Platform</Label>
              <select
                id="ugc-script-platform"
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
              <Label htmlFor="ugc-script-tone">Tone</Label>
              <select
                id="ugc-script-tone"
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
              <Label htmlFor="ugc-script-audience">
                Target audience (opsional)
              </Label>
              <Input
                id="ugc-script-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="cth. Wanita 25-35, ibu rumah tangga"
                maxLength={500}
              />
            </div>

            <Button
              type="submit"
              disabled={generating || !productId}
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
                  Generate UGC Script
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
            Testimoni UGC yang dihasilkan AI. Klik tombol &ldquo;Salin&rdquo;
            untuk menyalin script lengkap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UgcScriptResultView
            results={results}
            generating={generating}
            error={error}
            copiedIndex={copiedIndex}
            onCopy={onCopy}
          />
        </CardContent>
      </Card>
    </div>
  );
}

interface UgcScriptResultViewProps {
  results: UgcScriptResult | null;
  generating: boolean;
  error: string | null;
  copiedIndex: number | null;
  onCopy: (text: string, index: number) => void;
}

function UgcScriptResultView({
  results,
  generating,
  error,
  copiedIndex,
  onCopy,
}: UgcScriptResultViewProps) {
  if (generating) {
    return (
      <div
        data-testid="ugc-script-loading"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
      >
        <ArrowClockwise
          size={32}
          weight="bold"
          aria-hidden="true"
          className="animate-spin text-indigo-600"
        />
        <p className="text-sm font-medium text-slate-700">
          Menghasilkan UGC script...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="ugc-script-error"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-rose-200 bg-rose-50 p-8 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <WarningCircle size={24} weight="duotone" aria-hidden="true" />
        </div>
        <p className="max-w-md text-sm font-medium text-rose-700">{error}</p>
      </div>
    );
  }

  if (results) {
    const isCopied = copiedIndex === 0;
    const fullText = `${results.title}\n\n${results.text}`;
    return (
      <div
        data-testid="ugc-script-card"
        className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-200"
      >
        <h3 className="mb-3 text-lg font-bold text-slate-800">
          {results.title}
        </h3>
        <div className="mb-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {results.text}
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onCopy(fullText, 0)}
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
      </div>
    );
  }

  // Default — form is idle and no results yet.
  return (
    <div
      data-testid="ugc-script-empty"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
        <VideoCamera size={32} weight="duotone" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold text-slate-800">Belum ada hasil</h3>
      <p className="max-w-sm text-sm text-slate-500">
        Pilih produk dan klik Generate untuk memulai. AI akan menghasilkan
        1 testimoni UGC siap pakai.
      </p>
    </div>
  );
}

// ---- Storyboard panel -----------------------------------------------------

interface UgcStoryboardPanelProps {
  products: ProductOption[];
  productsLoading: boolean;
  productId: string;
  setProductId: (v: string) => void;
  platform: Platform;
  setPlatform: (v: Platform) => void;
  tone: Tone;
  setTone: (v: Tone) => void;
  results: UgcStoryboardPanel[] | null;
  generating: boolean;
  error: string | null;
  copiedIndex: number | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCopy: (text: string, index: number) => void;
}

function UgcStoryboardPanel(props: UgcStoryboardPanelProps) {
  const {
    products,
    productsLoading,
    productId,
    setProductId,
    platform,
    setPlatform,
    tone,
    setTone,
    results,
    generating,
    error,
    copiedIndex,
    onSubmit,
    onCopy,
  } = props;

  return (
    <div
      role="tabpanel"
      id="ugc-panel-storyboard"
      aria-labelledby="ugc-tab-storyboard"
      className="grid grid-cols-1 gap-6 md:grid-cols-3"
    >
      {/* LEFT — form panel */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Pengaturan</CardTitle>
          <CardDescription>
            Pilih produk dan atur gaya storyboard UGC video Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ugc-storyboard-product">Produk</Label>
              <select
                id="ugc-storyboard-product"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                disabled={productsLoading}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              >
                <option value="" disabled>
                  {productsLoading ? "Memuat produk..." : "Pilih produk"}
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ugc-storyboard-platform">Platform</Label>
              <select
                id="ugc-storyboard-platform"
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
              <Label htmlFor="ugc-storyboard-tone">Tone</Label>
              <select
                id="ugc-storyboard-tone"
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
              disabled={generating || !productId}
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
                  <FilmSlate size={16} weight="fill" aria-hidden="true" />
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
            Storyboard 4-6 panel untuk video UGC. Klik &ldquo;Salin&rdquo;
            untuk menyalin panel tertentu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UgcStoryboardResultView
            results={results}
            generating={generating}
            error={error}
            copiedIndex={copiedIndex}
            onCopy={onCopy}
          />
        </CardContent>
      </Card>
    </div>
  );
}

interface UgcStoryboardResultViewProps {
  results: UgcStoryboardPanel[] | null;
  generating: boolean;
  error: string | null;
  copiedIndex: number | null;
  onCopy: (text: string, index: number) => void;
}

function formatStoryboardPanel(panel: UgcStoryboardPanel): string {
  return [
    `Panel ${panel.panel} (${panel.time})`,
    `Visual: ${panel.visuals}`,
    `Audio: ${panel.audio}`,
    panel.text ? `Teks: ${panel.text}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function UgcStoryboardResultView({
  results,
  generating,
  error,
  copiedIndex,
  onCopy,
}: UgcStoryboardResultViewProps) {
  if (generating) {
    return (
      <div
        data-testid="ugc-storyboard-loading"
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
        data-testid="ugc-storyboard-error"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-rose-200 bg-rose-50 p-8 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <WarningCircle size={24} weight="duotone" aria-hidden="true" />
        </div>
        <p className="max-w-md text-sm font-medium text-rose-700">{error}</p>
      </div>
    );
  }

  if (results && results.length > 0) {
    const total = results.length;
    return (
      <ul className="flex flex-col gap-4">
        {results.map((panel, index) => {
          const isCopied = copiedIndex === index;
          return (
            <li
              key={`panel-${panel.panel}`}
              data-testid="ugc-storyboard-card"
              className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-indigo-200"
            >
              {/* Card header — panel number + time */}
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-slate-800">
                  Panel {panel.panel}/{total}
                </h3>
                <span className="shrink-0 rounded-full bg-indigo-600/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-indigo-700">
                  {panel.time}
                </span>
              </div>

              {/* Scene table — Visual | Audio | Teks. CSS Grid so the
                  columns line up cleanly without a CSS <table>. */}
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="grid grid-cols-[100px_1fr] gap-px bg-slate-200 text-xs font-semibold text-slate-600">
                  <div className="bg-slate-50 px-2 py-1.5">Visual</div>
                  <div className="bg-slate-50 px-2 py-1.5">
                    {panel.visuals}
                  </div>
                  <div className="bg-slate-50 px-2 py-1.5">Audio</div>
                  <div className="bg-slate-50 px-2 py-1.5">{panel.audio}</div>
                  <div className="bg-slate-50 px-2 py-1.5">Teks</div>
                  <div className="bg-slate-50 px-2 py-1.5">
                    {panel.text || <span className="text-slate-400">-</span>}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCopy(formatStoryboardPanel(panel), index)}
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

  return (
    <div
      data-testid="ugc-storyboard-empty"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
        <FilmSlate size={32} weight="duotone" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold text-slate-800">Belum ada hasil</h3>
      <p className="max-w-sm text-sm text-slate-500">
        Pilih produk dan klik Generate untuk memulai. AI akan menghasilkan
        4-6 panel storyboard siap difilmkan.
      </p>
    </div>
  );
}

// ---- Prompt panel ---------------------------------------------------------

interface UgcPromptPanelProps {
  products: ProductOption[];
  productsLoading: boolean;
  productId: string;
  setProductId: (v: string) => void;
  style: PromptStyle;
  setStyle: (v: PromptStyle) => void;
  mood: PromptMood;
  setMood: (v: PromptMood) => void;
  results: UgcPromptItem[] | null;
  generating: boolean;
  error: string | null;
  copiedIndex: number | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCopy: (text: string, index: number) => void;
}

function UgcPromptPanel(props: UgcPromptPanelProps) {
  const {
    products,
    productsLoading,
    productId,
    setProductId,
    style,
    setStyle,
    mood,
    setMood,
    results,
    generating,
    error,
    copiedIndex,
    onSubmit,
    onCopy,
  } = props;

  return (
    <div
      role="tabpanel"
      id="ugc-panel-prompt"
      aria-labelledby="ugc-tab-prompt"
      className="grid grid-cols-1 gap-6 md:grid-cols-3"
    >
      {/* LEFT — form panel */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Pengaturan</CardTitle>
          <CardDescription>
            Pilih produk dan atur style + mood foto UGC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ugc-prompt-product">Produk</Label>
              <select
                id="ugc-prompt-product"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                disabled={productsLoading}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              >
                <option value="" disabled>
                  {productsLoading ? "Memuat produk..." : "Pilih produk"}
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ugc-prompt-style">Style</Label>
              <select
                id="ugc-prompt-style"
                value={style}
                onChange={(e) => setStyle(e.target.value as PromptStyle)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {PROMPT_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ugc-prompt-mood">Mood</Label>
              <select
                id="ugc-prompt-mood"
                value={mood}
                onChange={(e) => setMood(e.target.value as PromptMood)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {PROMPT_MOODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="submit"
              disabled={generating || !productId}
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
                  <ImageSquare size={16} weight="fill" aria-hidden="true" />
                  Generate Prompt
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
            Prompt image-generation siap pakai untuk Midjourney / SD / DALL-E.
            Klik &ldquo;Salin&rdquo; untuk menyalin prompt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UgcPromptResultView
            results={results}
            generating={generating}
            error={error}
            copiedIndex={copiedIndex}
            onCopy={onCopy}
          />
        </CardContent>
      </Card>
    </div>
  );
}

interface UgcPromptResultViewProps {
  results: UgcPromptItem[] | null;
  generating: boolean;
  error: string | null;
  copiedIndex: number | null;
  onCopy: (text: string, index: number) => void;
}

function UgcPromptResultView({
  results,
  generating,
  error,
  copiedIndex,
  onCopy,
}: UgcPromptResultViewProps) {
  if (generating) {
    return (
      <div
        data-testid="ugc-prompt-loading"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
      >
        <ArrowClockwise
          size={32}
          weight="bold"
          aria-hidden="true"
          className="animate-spin text-indigo-600"
        />
        <p className="text-sm font-medium text-slate-700">
          Menghasilkan prompt foto...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="ugc-prompt-error"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-rose-200 bg-rose-50 p-8 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <WarningCircle size={24} weight="duotone" aria-hidden="true" />
        </div>
        <p className="max-w-md text-sm font-medium text-rose-700">{error}</p>
      </div>
    );
  }

  if (results && results.length > 0) {
    return (
      <ul className="flex flex-col gap-4">
        {results.map((item, index) => {
          const isCopied = copiedIndex === index;
          return (
            <li
              key={`${item.title}-${index}`}
              data-testid="ugc-prompt-card"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-base font-bold text-slate-800">
                  {item.title}
                </h3>
              </div>

              {/* Full English prompt — monospace block for easy copy. */}
              <pre
                data-testid="ugc-prompt-block"
                className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800"
              >
                {item.prompt}
              </pre>

              {/* Style + mood badges. */}
              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  data-testid="ugc-prompt-badge-style"
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-600/10 px-2.5 py-1 text-xs font-medium text-indigo-700"
                >
                  <span className="text-[10px] uppercase tracking-wide text-indigo-500">
                    Style
                  </span>
                  <span>{item.style}</span>
                </span>
                <span
                  data-testid="ugc-prompt-badge-mood"
                  className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700"
                >
                  <span className="text-[10px] uppercase tracking-wide text-amber-500">
                    Mood
                  </span>
                  <span>{item.mood}</span>
                </span>
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCopy(item.prompt, index)}
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

  return (
    <div
      data-testid="ugc-prompt-empty"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
        <ImageSquare size={32} weight="duotone" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold text-slate-800">Belum ada hasil</h3>
      <p className="max-w-sm text-sm text-slate-500">
        Pilih produk dan klik Generate untuk memulai. AI akan menghasilkan
        3-5 prompt foto UGC siap pakai untuk Midjourney / Stable Diffusion.
      </p>
    </div>
  );
}

// ---- Batch panel ----------------------------------------------------------

interface UgcBatchPanelProps {
  products: ProductOption[];
  productsLoading: boolean;
  selectedProductIds: string[];
  onToggleProduct: (productId: string) => void;
  platform: Platform;
  setPlatform: (v: Platform) => void;
  tone: Tone;
  setTone: (v: Tone) => void;
  results: UgcBatchItem[] | null;
  generating: boolean;
  error: string | null;
  copiedIndex: number | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCopy: (text: string, index: number) => void;
}

function UgcBatchPanel(props: UgcBatchPanelProps) {
  const {
    products,
    productsLoading,
    selectedProductIds,
    onToggleProduct,
    platform,
    setPlatform,
    tone,
    setTone,
    results,
    generating,
    error,
    copiedIndex,
    onSubmit,
    onCopy,
  } = props;

  const selectedSet = new Set(selectedProductIds);
  const canSubmit = selectedProductIds.length >= 2 && !generating;

  return (
    <div
      role="tabpanel"
      id="ugc-panel-batch"
      aria-labelledby="ugc-tab-batch"
      className="grid grid-cols-1 gap-6 md:grid-cols-3"
    >
      {/* LEFT — form panel */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Pengaturan</CardTitle>
          <CardDescription>
            Pilih 2-5 produk untuk generate UGC script sekaligus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label>Produk ({selectedProductIds.length}/5)</Label>
              <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {productsLoading ? (
                  <p className="px-1 py-2 text-xs text-slate-500">
                    Memuat produk...
                  </p>
                ) : products.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-slate-500">
                    Belum ada produk.
                  </p>
                ) : (
                  products.map((p) => {
                    const checked = selectedSet.has(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm transition-colors hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleProduct(p.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/30"
                        />
                        <span className="text-slate-700">{p.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-slate-500">
                Minimal 2, maksimal 5 produk per batch.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ugc-batch-platform">Platform</Label>
              <select
                id="ugc-batch-platform"
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
              <Label htmlFor="ugc-batch-tone">Tone</Label>
              <select
                id="ugc-batch-tone"
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
              disabled={!canSubmit}
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
                  <UsersThree size={16} weight="fill" aria-hidden="true" />
                  Generate Batch
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
            1 UGC script per produk yang dipilih. Klik &ldquo;Salin&rdquo;
            untuk menyalin script tertentu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UgcBatchResultView
            products={products}
            selectedProductIds={selectedProductIds}
            results={results}
            generating={generating}
            error={error}
            copiedIndex={copiedIndex}
            onCopy={onCopy}
          />
        </CardContent>
      </Card>
    </div>
  );
}

interface UgcBatchResultViewProps {
  products: ProductOption[];
  selectedProductIds: string[];
  results: UgcBatchItem[] | null;
  generating: boolean;
  error: string | null;
  copiedIndex: number | null;
  onCopy: (text: string, index: number) => void;
}

function UgcBatchResultView({
  products,
  selectedProductIds,
  results,
  generating,
  error,
  copiedIndex,
  onCopy,
}: UgcBatchResultViewProps) {
  if (generating) {
    return (
      <div
        data-testid="ugc-batch-loading"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
      >
        <ArrowClockwise
          size={32}
          weight="bold"
          aria-hidden="true"
          className="animate-spin text-indigo-600"
        />
        <p className="text-sm font-medium text-slate-700">
          Menghasilkan batch script...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="ugc-batch-error"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-rose-200 bg-rose-50 p-8 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <WarningCircle size={24} weight="duotone" aria-hidden="true" />
        </div>
        <p className="max-w-md text-sm font-medium text-rose-700">{error}</p>
      </div>
    );
  }

  if (results && results.length > 0) {
    // Build a lookup of product id -> name for the result headers.
    // The action returns 1 script per product in the SAME ORDER as the
    // input. `selectedProductIds` mirrors that order.
    return (
      <ul className="flex flex-col gap-4">
        {results.map((item, index) => {
          const productId = selectedProductIds[index];
          const product = products.find((p) => p.id === productId);
          const isCopied = copiedIndex === index;
          const fullText = `${item.title}\n\n${item.text}`;
          return (
            <li
              key={`${item.title}-${index}`}
              data-testid="ugc-batch-card"
              className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-indigo-200"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-slate-800">
                  {product?.name ?? `Product ${index + 1}`}
                </h3>
                <span className="shrink-0 rounded-full bg-indigo-600/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                  {item.title}
                </span>
              </div>

              <div className="mb-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {item.text}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCopy(fullText, index)}
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

  return (
    <div
      data-testid="ugc-batch-empty"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
        <UsersThree size={32} weight="duotone" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold text-slate-800">Belum ada hasil</h3>
      <p className="max-w-sm text-sm text-slate-500">
        Pilih 2-5 produk di panel kiri, lalu klik Generate Batch. AI akan
        menghasilkan 1 UGC script per produk sekaligus.
      </p>
    </div>
  );
}
