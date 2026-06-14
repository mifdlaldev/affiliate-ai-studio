"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { MobileNav } from "./mobile-nav";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  user: { email?: string | null };
  profile: { full_name?: string | null; avatar_url?: string | null } | null;
  children: ReactNode;
}

/**
 * Client-side shell that owns the sidebar collapse state so the main
 * content area can pad itself in sync. Wraps the server-rendered
 * children that come from each protected route.
 */
export function DashboardShell({
  user,
  profile,
  children,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <MobileNav />
      <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
      <div
        className={cn(
          "transition-[padding] duration-200 ease-out",
          collapsed ? "lg:pl-16" : "lg:pl-64"
        )}
      >
        <TopBar user={user} profile={profile} />
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
