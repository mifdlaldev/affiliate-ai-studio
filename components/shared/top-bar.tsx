"use client";

import { List, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { UserMenu } from "./user-menu";

interface TopBarProps {
  user: { email?: string | null };
  profile: { full_name?: string | null; avatar_url?: string | null } | null;
}

/**
 * Sticky 64px header. Holds the mobile hamburger (which dispatches a
 * custom `toggle-mobile-nav` event for `MobileNav` to listen for), a
 * search input on `md+` screens, and the user avatar dropdown.
 */
export function TopBar({ user, profile }: TopBarProps) {
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
            placeholder="Cari produk, proyek, atau aset..."
            className="w-80 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 lg:w-96"
            aria-label="Search"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <UserMenu user={user} profile={profile} />
      </div>
    </header>
  );
}
