"use client";

import { useEffect, useRef } from "react";
import {
  MagnifyingGlass,
  Package,
  Folder,
  FileText,
  Spinner,
} from "@phosphor-icons/react/dist/ssr";
import type { SearchResults } from "@/lib/search";

type Entity = "product" | "project" | "asset";

interface SearchResultsDropdownProps {
  query: string;
  results: SearchResults;
  loading: boolean;
  onClose: () => void;
  onSelect: (id: string, entity: Entity) => void;
}

interface ResultItem {
  id: string;
  name: string;
  subtitle: string;
  entity: Entity;
}

const ENTITY_META: Record<Entity, { label: string; icon: typeof Package }> = {
  product: { label: "Produk", icon: Package },
  project: { label: "Proyek", icon: Folder },
  asset: { label: "Aset", icon: FileText },
};

export function SearchResultsDropdown({
  query,
  results,
  loading,
  onClose,
  onSelect,
}: SearchResultsDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (!query.trim()) {
    return null;
  }

  const sections: { entity: Entity; items: ResultItem[] }[] = ([
    {
      entity: "product" as const,
      items: results.products.map((p) => ({
        id: p.id,
        name: p.name,
        subtitle: [p.brand, p.category].filter(Boolean).join(" · "),
        entity: "product" as const,
      })),
    },
    {
      entity: "project" as const,
      items: results.projects.map((p) => ({
        id: p.id,
        name: p.name,
        subtitle: p.status,
        entity: "project" as const,
      })),
    },
    {
      entity: "asset" as const,
      items: results.assets.map((a) => ({
        id: a.id,
        name: a.name,
        subtitle: [a.type, a.subtype].filter(Boolean).join(" · "),
        entity: "asset" as const,
      })),
    },
  ] as const).filter((section) => section.items.length > 0);

  const hasResults = sections.length > 0;

  return (
    <div
      ref={ref}
      id="search-results"
      role="listbox"
      aria-label="Search results"
      className="absolute top-full left-0 right-0 z-30 mt-2 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-slate-500">
          <Spinner size={16} className="animate-spin" aria-hidden="true" />
          Mencari...
        </div>
      ) : !hasResults ? (
        <div className="px-4 py-6 text-center text-sm text-slate-500">
          <MagnifyingGlass
            size={20}
            weight="duotone"
            className="mx-auto mb-2 text-slate-300"
            aria-hidden="true"
          />
          Tidak ada hasil untuk &ldquo;{query}&rdquo;
        </div>
      ) : (
        <div className="py-2">
          {sections.map((section) => {
            const meta = ENTITY_META[section.entity];
            const Icon = meta.icon;
            return (
              <div key={section.entity} className="mb-1 last:mb-0">
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Icon size={14} weight="duotone" aria-hidden="true" />
                  {meta.label}
                </div>
                {section.items.map((item) => (
                  <button
                    key={`${item.entity}-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => onSelect(item.id, item.entity)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">
                        {item.name}
                      </div>
                      {item.subtitle && (
                        <div className="truncate text-xs text-slate-500">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
