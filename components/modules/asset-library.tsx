"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  CalendarBlank,
  ChatCircleDots,
  DownloadSimple,
  ImageSquare,
  MagnifyingGlass,
  Sparkle,
  UserCircle,
  VideoCamera,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react/dist/lib/types";
import {
  fetchAssets,
  fetchCompetitorAnalyses,
  type Asset,
  type FetchResult,
} from "@/lib/actions/assets";
import type { Json } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { downloadFile } from "@/lib/export/download";
import { exportAsJson } from "@/lib/export/json";
import { exportAsTxt } from "@/lib/export/txt";
import { cn } from "@/lib/utils";

/**
 * One tab in the module filter bar. `value` is the value passed to
 * `fetchAssets({ module })` - either `"all"` (no filter) or one of the
 * seven module names stored in `generations.module` /
 * `competitor_analyses`. Keeping the value lower-case mirrors the DB
 * values so no translation happens at fetch time.
 */
interface ModuleTab {
  value: string;
  label: string;
  icon: Icon;
  /** Tailwind classes for the badge + icon backgrounds. */
  badgeClass: string;
  iconClass: string;
}

const MODULE_TABS: readonly ModuleTab[] = [
  {
    value: "all",
    label: "Semua",
    icon: MagnifyingGlass,
    badgeClass: "bg-slate-100 text-slate-700",
    iconClass: "bg-slate-100 text-slate-600",
  },
  {
    value: "hook",
    label: "Hook",
    icon: Sparkle,
    badgeClass: "bg-indigo-100 text-indigo-700",
    iconClass: "bg-indigo-100 text-indigo-600",
  },
  {
    value: "caption",
    label: "Caption",
    icon: ChatCircleDots,
    badgeClass: "bg-sky-100 text-sky-700",
    iconClass: "bg-sky-100 text-sky-600",
  },
  {
    value: "script",
    label: "Script",
    icon: VideoCamera,
    badgeClass: "bg-amber-100 text-amber-700",
    iconClass: "bg-amber-100 text-amber-600",
  },
  {
    value: "photo",
    label: "Photo",
    icon: ImageSquare,
    badgeClass: "bg-emerald-100 text-emerald-700",
    iconClass: "bg-emerald-100 text-emerald-600",
  },
  {
    value: "model",
    label: "Model",
    icon: UserCircle,
    badgeClass: "bg-teal-100 text-teal-700",
    iconClass: "bg-teal-100 text-teal-600",
  },
  {
    value: "kalender",
    label: "Kalender",
    icon: CalendarBlank,
    badgeClass: "bg-rose-100 text-rose-700",
    iconClass: "bg-rose-100 text-rose-600",
  },
  {
    value: "competitor",
    label: "Kompetitor",
    icon: MagnifyingGlass,
    badgeClass: "bg-slate-200 text-slate-700",
    iconClass: "bg-slate-200 text-slate-600",
  },
];

/** Find the tab metadata for a given module value, falling back to "all". */
function getModuleTab(value: string): ModuleTab {
  return (
    MODULE_TABS.find((tab) => tab.value === value) ??
    (MODULE_TABS[0] as ModuleTab)
  );
}

const SEARCH_DEBOUNCE_MS = 300;
const PREVIEW_MAX_CHARS = 80;
const SKELETON_CARD_COUNT = 6;
const GENERATOR_ROUTES: Record<string, string> = {
  hook: "/generasikan/hook",
  caption: "/generasikan/caption",
  script: "/generasikan/script",
  photo: "/generasikan/photo",
  model: "/generasikan/model",
  kalender: "/generasikan/kalender",
  competitor: "/generasikan/competitor",
};

/**
 * Indonesian long date format, e.g. "12 Juni 2026".
 */
function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(
    new Date(iso),
  );
}

/**
 * Convert an ISO timestamp into a short Indonesian relative phrase
 * (e.g. "2 hari lalu", "1 minggu lalu", "Baru saja"). Falls back to the
 * long date format for anything older than a month.
 */
function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 1) return "Baru saja";
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays === 1) return "1 hari lalu";
  if (diffDays < 7) return `${diffDays} hari lalu`;
  if (diffWeeks === 1) return "1 minggu lalu";
  if (diffWeeks < 4) return `${diffWeeks} minggu lalu`;
  if (diffMonths === 1) return "1 bulan lalu";
  if (diffMonths < 12) return `${diffMonths} bulan lalu`;
  return formatLongDate(iso);
}

/**
 * Clip a preview string and add an ellipsis when truncated. We strip
 * surrounding quotes from the JSON-stringified value so the user reads
 * the actual content instead of `{"text":"..."}`.
 */
function clipPreview(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= PREVIEW_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, PREVIEW_MAX_CHARS)}…`;
}

/**
 * Format a JSON value for the detail modal. Falls back to the string
 * representation for values JSON.stringify can't handle (e.g. functions,
 * circular refs) so the modal never throws.
 */
function formatJson(value: Json | null | undefined): string {
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Asset Library — unified feed of every AI generation + competitor
 * analysis the signed-in user has saved. Replaces seven separate
 * per-module history pages with a single searchable grid.
 */
export function AssetLibrary() {
  const [activeModule, setActiveModule] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  /**
   * Bump from the error-state retry button to re-run the fetch effect.
   * The effect's dependency list reads `retryCount` so the new value
   * triggers a fresh load.
   */
  const [retryCount, setRetryCount] = useState<number>(0);

  // Debounce the search input so a re-fetch only fires once the user
  // pauses typing. We mirror the pattern from `components/shared/top-bar.tsx`
  // for consistency across the dashboard.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // The data fetching effect. The function is defined inside the effect
  // so React's lint rules recognise it as effect-local; we also depend
  // on `retryCount` so the "Coba lagi" button can re-trigger the load.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      setLoading(true);
      setError(null);
      try {
        const moduleFilter =
          activeModule === "all" ? undefined : activeModule;
        const trimmedSearch = debouncedSearch.trim();
        const searchFilter =
          trimmedSearch.length > 0 ? trimmedSearch : undefined;

        // The competitor module is sourced from a separate table, so we
        // always need to hit both endpoints when "all" is selected. When
        // the user picks a single module we still call both to keep the
        // result shape consistent (the other endpoint returns empty).
        const fetchGeneration =
          activeModule === "competitor"
            ? Promise.resolve<FetchResult>({ data: [], total: 0, page: 1 })
            : fetchAssets({ module: moduleFilter, search: searchFilter });
        const fetchCompetitor =
          activeModule === "all" || activeModule === "competitor"
            ? fetchCompetitorAnalyses()
            : Promise.resolve<FetchResult>({ data: [], total: 0, page: 1 });

        const [generationResult, competitorResult] = await Promise.all([
          fetchGeneration,
          fetchCompetitor,
        ]);

        if (cancelled) return;

        const merged: Asset[] = [
          ...generationResult.data,
          ...competitorResult.data,
        ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        setAssets(merged);
      } catch (err) {
        if (cancelled) return;
        console.error("AssetLibrary loadAssets error:", err);
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Gagal memuat aset",
        );
        setAssets([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAssets();
    return () => {
      cancelled = true;
    };
  }, [activeModule, debouncedSearch, retryCount]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleModuleChange = (next: string) => {
    setActiveModule(next);
  };

  const handleRetry = () => {
    setRetryCount((count) => count + 1);
  };

  return (
    <div className="space-y-4" data-testid="asset-library">
      {/* Top bar: search + scrollable tab strip. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <MagnifyingGlass
            size={14}
            weight="bold"
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Cari di asset library..."
            aria-label="Cari aset"
            className="h-9 pl-8"
          />
        </div>
        <div
          role="tablist"
          aria-label="Filter modul"
          className="-mx-4 flex w-full snap-x snap-mandatory items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
        >
          {MODULE_TABS.map((tab) => {
            const isActive = tab.value === activeModule;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleModuleChange(tab.value)}
                className={cn(
                  "inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                  isActive
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <tab.icon
                  size={12}
                  weight={isActive ? "fill" : "regular"}
                  aria-hidden="true"
                />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content area: loading / error / empty / grid. */}
      {loading ? (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
        >
          {Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
            <AssetCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <Card className="border-rose-200 bg-rose-50/60">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <WarningCircle size={24} weight="duotone" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-700">
                Gagal memuat aset
              </p>
              <p className="mt-1 text-xs text-rose-600/80">
                {error}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
            >
              <ArrowClockwise
                size={14}
                weight="bold"
                aria-hidden="true"
                className="mr-1.5"
              />
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={MagnifyingGlass}
          title="Belum ada konten"
          description="Belum ada konten yang di-generate. Mulai dengan salah satu generator di bawah ini."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm">
                <Link href="/generasikan/hook">Generate Hook</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/generasikan/caption">Generate Caption</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onClick={() => setSelectedAsset(asset)}
            />
          ))}
        </div>
      )}

      {/* Detail dialog: renders the full JSON result. */}
      <Dialog
        open={!!selectedAsset}
        onOpenChange={(open) => !open && setSelectedAsset(null)}
      >
        <DialogContent
          showCloseButton
          className="max-h-[85vh] max-w-2xl overflow-y-auto"
        >
          {selectedAsset ? (
            <AssetDetailView asset={selectedAsset} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Internal sub-components                                                  */
/* -------------------------------------------------------------------------- */

interface AssetCardProps {
  asset: Asset;
  onClick: () => void;
}

/**
 * Format a date as a compact filename-friendly token (e.g. "2026-06-14").
 */
function formatDateForFilename(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * One tile in the asset grid. The tile is a `<div>` (not a button) so
 * the inner content button and the export dropdown can both be real
 * interactive children without nesting buttons — which the HTML spec
 * disallows.
 */
function AssetCard({ asset, onClick }: AssetCardProps) {
  const tab = getModuleTab(asset.module);
  const preview = clipPreview(asset.previewText);

  return (
    <div
      className={cn(
        "group relative block w-full rounded-xl border border-slate-200 bg-white text-left shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
        "focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={`Lihat detail ${tab.label}: ${preview}`}
        className="block w-full rounded-xl p-4 text-left active:scale-[0.99]"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              tab.iconClass,
            )}
          >
            <tab.icon size={18} weight="duotone" aria-hidden="true" />
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              tab.badgeClass,
            )}
          >
            {tab.label}
          </span>
        </div>
        <p className="line-clamp-3 text-sm leading-relaxed text-slate-700">
          {preview}
        </p>
        <p className="mt-3 text-xs font-medium text-slate-400">
          {formatRelativeDate(asset.createdAt)}
        </p>
      </button>
      <ExportMenu asset={asset} />
    </div>
  );
}

interface ExportMenuProps {
  asset: Asset;
}

/**
 * Small dropdown anchored to the top-right of the asset card. Toggling
 * the trigger reveals "Download TXT" and "Download JSON" menu items;
 * selecting either triggers a browser download via the shared
 * `downloadFile` helper, then closes the menu. A click-outside
 * listener dismisses the menu without firing the card's detail-view
 * handler.
 */
function ExportMenu({ asset }: ExportMenuProps) {
  const [open, setOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const dateToken = formatDateForFilename(asset.createdAt);

  const handleDownloadTxt = () => {
    downloadFile(
      exportAsTxt(asset),
      `${asset.module}-${dateToken}.txt`,
      "text/plain",
    );
    setOpen(false);
  };

  const handleDownloadJson = () => {
    downloadFile(
      exportAsJson(asset),
      `${asset.module}-${dateToken}.json`,
      "application/json",
    );
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="absolute right-2 top-2"
      data-testid="export-menu"
    >
      <button
        type="button"
        aria-label="Export"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors",
          "hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
          open && "border-slate-300 bg-slate-50 text-slate-700",
        )}
      >
        <DownloadSimple size={14} weight="bold" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Export options"
          className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleDownloadTxt}
            className="block w-full rounded px-2.5 py-1.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none"
          >
            Download TXT
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleDownloadJson}
            className="block w-full rounded px-2.5 py-1.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none"
          >
            Download JSON
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Skeleton placeholder shown while the initial fetch is in flight. The
 * `data-testid` gives the test a stable selector to wait on.
 */
function AssetCardSkeleton() {
  return (
    <div
      data-testid="asset-card-skeleton"
      aria-hidden="true"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-14 animate-pulse rounded-full bg-slate-200" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mt-3 h-3 w-20 animate-pulse rounded bg-slate-200" />
    </div>
  );
}

interface AssetDetailViewProps {
  asset: Asset;
}

/**
 * Body of the detail dialog. Shows the module metadata in a header and
 * the full JSON result in a `<pre>` block so the formatting survives.
 */
function AssetDetailView({ asset }: AssetDetailViewProps) {
  const tab = getModuleTab(asset.module);
  const formatted = formatJson(asset.result);

  return (
    <div className="space-y-4">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              tab.iconClass,
            )}
          >
            <tab.icon size={20} weight="duotone" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base">
              Detail {tab.label}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {formatLongDate(asset.createdAt)}
              {asset.subtype ? ` • ${asset.subtype}` : null}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <Card>
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Konten
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <pre
            data-testid="asset-detail-json"
            className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800"
          >
            {formatted}
          </pre>
        </CardContent>
      </Card>

      {GENERATOR_ROUTES[asset.module] ? (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="outline">
            <Link href={GENERATOR_ROUTES[asset.module]}>
              Buka {tab.label}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
