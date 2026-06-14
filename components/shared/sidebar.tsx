"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (next: boolean) => void;
}

/**
 * Desktop-only primary navigation. Renders `fixed` to the left edge and
 * collapses to an icon rail at 64px wide. Collapse state is owned by the
 * dashboard shell so the main content area can pad itself accordingly.
 */
export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Primary navigation"
      data-collapsed={collapsed}
      className={cn(
        "fixed left-0 top-0 z-30 hidden h-full border-r border-slate-200 bg-white transition-[width] duration-200 ease-out lg:block",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-slate-200 px-4",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <Link
            href="/"
            className="truncate text-base font-bold tracking-tight text-slate-800"
          >
            AffiliateAI
          </Link>
        )}
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className={cn(
            "rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <CaretRight size={16} aria-hidden="true" />
          ) : (
            <CaretLeft size={16} aria-hidden="true" />
          )}
        </button>
      </div>

      <nav className="space-y-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600/10 text-indigo-600"
                  : "text-slate-700 hover:bg-slate-100",
                collapsed && "justify-center"
              )}
            >
              <Icon
                size={20}
                weight={isActive ? "fill" : "regular"}
                aria-hidden="true"
                className="shrink-0"
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
