"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { List, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { createBrowserClient } from "@/lib/supabase/client";
import { globalSearch, type SearchResults } from "@/lib/search";
import { UserMenu } from "./user-menu";
import { SearchResultsDropdown } from "./search-results-dropdown";

interface TopBarProps {
  user: { email?: string | null };
  profile: { full_name?: string | null; avatar_url?: string | null } | null;
}

const SEARCH_DEBOUNCE_MS = 300;
const ENTITY_ROUTES: Record<"product" | "project" | "asset", string> = {
  product: "/produk",
  project: "/proyek",
  asset: "/assets",
};

const EMPTY_RESULTS: SearchResults = {
  products: [],
  projects: [],
  assets: [],
};

export function TopBar({ user, profile }: TopBarProps) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setIsOpen(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = nextQuery.trim();
    if (!trimmed) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const data = await globalSearch(supabase, trimmed);
        setResults(data);
      } catch (err) {
        console.error("Search error:", err);
        setResults(EMPTY_RESULTS);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleSelect = (
    _id: string,
    entity: "product" | "project" | "asset",
  ) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setIsOpen(false);
    setQuery("");
    setResults(EMPTY_RESULTS);
    setLoading(false);
    router.push(ENTITY_ROUTES[entity]);
  };

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        setIsOpen(false);
        setQuery("");
        setResults(EMPTY_RESULTS);
        setLoading(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  const hasQuery = query.trim().length > 0;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="-ml-2 rounded-md p-2 text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:hidden"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("toggle-mobile-nav"));
          }}
          aria-label="Toggle menu"
        >
          <List size={20} aria-hidden="true" />
        </button>

        <div className="relative hidden md:block">
          <MagnifyingGlass
            size={16}
            weight="bold"
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => setIsOpen(true)}
            placeholder="Cari produk, proyek, atau aset..."
            aria-label="Search"
            aria-expanded={isOpen}
            aria-controls="search-results"
            aria-autocomplete="list"
            role="combobox"
            className="w-80 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 lg:w-96"
          />
          {isOpen && hasQuery && (
            <SearchResultsDropdown
              query={query}
              results={results}
              loading={loading}
              onClose={() => setIsOpen(false)}
              onSelect={handleSelect}
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <UserMenu user={user} profile={profile} />
      </div>
    </header>
  );
}
