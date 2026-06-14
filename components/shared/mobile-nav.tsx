"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";

/**
 * Mobile slide-in drawer. Hidden on `lg+` (desktop) and rendered alongside
 * a backdrop that closes the drawer on click. Opens in response to a
 * `toggle-mobile-nav` CustomEvent dispatched by the top bar hamburger
 * button — keeping the trigger in the top bar decoupled from this view.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    function handleToggle() {
      setOpen((prev) => !prev);
    }
    window.addEventListener("toggle-mobile-nav", handleToggle);
    return () => window.removeEventListener("toggle-mobile-nav", handleToggle);
  }, []);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Mobile navigation"
        aria-hidden={!open}
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 border-r border-slate-200 bg-white transition-transform duration-200 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <Link
            href="/"
            className="text-base font-bold tracking-tight text-slate-800"
          >
            AffiliateAI
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Close menu"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav className="space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-600/10 text-indigo-600"
                    : "text-slate-700 hover:bg-slate-100"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={20} weight="regular" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
